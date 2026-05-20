import { and, desc, eq, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  approvals,
  auditEvents,
  businessUnits,
  projects,
  roiCalculations,
  users,
} from "@/db/schema";
import {
  realizedAcrossVersions,
  type RoiVersionPeriod,
} from "../roi/engine";

/**
 * Dashboard aggregations — server-computed.
 */

export type DashboardKpis = {
  totalRealizedUsd: number;
  totalAnnualSavingsUsd: number;
  totalHoursSaved: number;
  completedProjects: number;
  activeProjects: number;
  pendingApprovals: number;
  overdueApprovals: number;
  reviewsDue: number;
};

/**
 * Pull every (non-deleted) ROI version with its parent project + BU.
 * Used by every realized-$ aggregation below.
 */
async function fetchAllVersions() {
  return await db
    .select({
      project: projects,
      version: roiCalculations,
      buCode: businessUnits.code,
      buName: businessUnits.displayName,
    })
    .from(roiCalculations)
    .innerJoin(projects, eq(projects.id, roiCalculations.projectId))
    .leftJoin(businessUnits, eq(businessUnits.id, projects.businessUnitId))
    .where(and(isNull(projects.deletedAt), isNull(roiCalculations.deletedAt)));
}

/** Group versions by project id. */
function groupVersionsByProject(
  rows: Awaited<ReturnType<typeof fetchAllVersions>>,
) {
  const byProject = new Map<
    string,
    {
      project: typeof projects.$inferSelect;
      versions: RoiVersionPeriod[];
      latestAnnualSavings: number;
      latestAnnualHours: number;
      buName: string | null;
    }
  >();
  for (const r of rows) {
    const slot =
      byProject.get(r.project.id) ??
      ({
        project: r.project,
        versions: [],
        latestAnnualSavings: 0,
        latestAnnualHours: 0,
        buName: r.buName,
      } as never);
    slot.versions.push({
      periodStart: new Date(r.version.periodStart),
      supersededAt: r.version.supersededAt
        ? new Date(r.version.supersededAt)
        : null,
      annualSavedUsd: Number(r.version.computedAnnualSavingsUsd ?? 0),
    });
    // Keep the latest (highest periodStart) version's annual totals as
    // the "current annualized" figure.
    const isLatest = !r.version.supersededAt;
    if (isLatest) {
      slot.latestAnnualSavings = Number(
        r.version.computedAnnualSavingsUsd ?? 0,
      );
      slot.latestAnnualHours = Number(
        r.version.computedAnnualSavingsHours ?? 0,
      );
    }
    byProject.set(r.project.id, slot);
  }
  return byProject;
}

export async function getKpis(asOf: Date = new Date()): Promise<DashboardKpis> {
  const versionsRows = await fetchAllVersions();
  const grouped = groupVersionsByProject(versionsRows);

  let totalRealizedUsd = 0;
  let totalAnnualSavingsUsd = 0;
  let totalHoursSaved = 0;
  for (const slot of grouped.values()) {
    totalAnnualSavingsUsd += slot.latestAnnualSavings;
    totalHoursSaved += slot.latestAnnualHours;
    totalRealizedUsd += realizedAcrossVersions({
      versions: slot.versions,
      asOfDate: asOf,
    });
  }

  // Project counts (including projects with no ROI yet).
  const allProjects = await db
    .select({ status: projects.status })
    .from(projects)
    .where(isNull(projects.deletedAt));
  let completed = 0;
  let active = 0;
  for (const p of allProjects) {
    if (p.status === "Completed") completed++;
    else if (
      [
        "IntakeSubmitted",
        "UnderReview",
        "ITApprovalPending",
        "ITApproved",
        "InProgress",
        "AITeamReview",
      ].includes(p.status)
    )
      active++;
  }

  const approvalRows = await db
    .select({ status: approvals.status, slaDueAt: approvals.slaDueAt })
    .from(approvals)
    .innerJoin(projects, eq(projects.id, approvals.projectId))
    .where(and(eq(approvals.status, "Pending"), isNull(projects.deletedAt)));
  const pendingApprovals = approvalRows.length;
  const overdueApprovals = approvalRows.filter(
    (a) => a.slaDueAt && a.slaDueAt.getTime() < asOf.getTime(),
  ).length;

  const dueRows = await db
    .select({ projectId: roiCalculations.projectId })
    .from(roiCalculations)
    .innerJoin(projects, eq(projects.id, roiCalculations.projectId))
    .where(
      and(
        isNull(projects.deletedAt),
        isNull(roiCalculations.deletedAt),
        isNull(roiCalculations.supersededAt),
        isNotNull(roiCalculations.nextReviewDate),
        lte(roiCalculations.nextReviewDate, asOf.toISOString().slice(0, 10)),
      ),
    );
  const reviewsDue = dueRows.length;

  return {
    totalRealizedUsd,
    totalAnnualSavingsUsd,
    totalHoursSaved,
    completedProjects: completed,
    activeProjects: active,
    pendingApprovals,
    overdueApprovals,
    reviewsDue,
  };
}

export async function getChampionLeaderboard(limit = 8) {
  const rows = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      email: users.email,
      projectCount: sql<number>`count(distinct ${projects.id})::int`,
      totalSavings: sql<number>`coalesce(sum(case when ${roiCalculations.supersededAt} is null then ${roiCalculations.computedAnnualSavingsUsd} else 0 end)::float, 0)`,
      completed: sql<number>`count(distinct case when ${projects.status} = 'Completed' then ${projects.id} end)::int`,
    })
    .from(users)
    .innerJoin(
      projects,
      and(eq(projects.championUserId, users.id), isNull(projects.deletedAt)),
    )
    .leftJoin(
      roiCalculations,
      and(
        eq(roiCalculations.projectId, projects.id),
        isNull(roiCalculations.deletedAt),
      ),
    )
    .where(isNotNull(projects.championUserId))
    .groupBy(users.id, users.displayName, users.email)
    .orderBy(
      sql`coalesce(sum(case when ${roiCalculations.supersededAt} is null then ${roiCalculations.computedAnnualSavingsUsd} else 0 end), 0) desc`,
    )
    .limit(limit);
  return rows;
}

export async function getTierDistribution() {
  return await db
    .select({
      tier: projects.complexityTier,
      count: sql<number>`count(*)::int`,
    })
    .from(projects)
    .where(isNull(projects.deletedAt))
    .groupBy(projects.complexityTier);
}

export async function getStatusDistribution() {
  return await db
    .select({
      status: projects.status,
      count: sql<number>`count(*)::int`,
    })
    .from(projects)
    .where(isNull(projects.deletedAt))
    .groupBy(projects.status);
}

export async function getRealizedByBusinessUnit(asOf: Date = new Date()) {
  const grouped = groupVersionsByProject(await fetchAllVersions());
  const sumByBu = new Map<string, { name: string; value: number }>();
  for (const slot of grouped.values()) {
    if (!slot.buName) continue;
    const realized = realizedAcrossVersions({
      versions: slot.versions,
      asOfDate: asOf,
    });
    const cur = sumByBu.get(slot.buName) ?? { name: slot.buName, value: 0 };
    cur.value += realized;
    sumByBu.set(slot.buName, cur);
  }
  return [...sumByBu.values()].sort((a, b) => b.value - a.value);
}

export async function getMonthlyRealizedSeries(
  asOf: Date = new Date(),
  monthsBack = 18,
) {
  const grouped = groupVersionsByProject(await fetchAllVersions());
  const series: Array<{ month: string; cumulative: number }> = [];
  const start = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - monthsBack, 1),
  );
  for (let i = 0; i <= monthsBack; i++) {
    const cursor = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1),
    );
    const eom = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0),
    );
    const asOfThisMonth = eom.getTime() > asOf.getTime() ? asOf : eom;

    let total = 0;
    for (const slot of grouped.values()) {
      total += realizedAcrossVersions({
        versions: slot.versions,
        asOfDate: asOfThisMonth,
      });
    }
    const label = cursor.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    series.push({ month: label, cumulative: Math.round(total) });
  }
  return series;
}

export async function getRecentActivity(limit = 10) {
  // Drop orphans — events whose project entity has since been removed
  // (left over from prior demo seeds or hard deletes).
  const rows = await db
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      entityType: auditEvents.entityType,
      entityId: auditEvents.entityId,
      occurredAt: auditEvents.occurredAt,
      actorName: users.displayName,
      afterJson: auditEvents.afterJson,
      beforeJson: auditEvents.beforeJson,
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorUserId))
    .orderBy(desc(auditEvents.occurredAt))
    .limit(limit * 3);

  const projectIds = rows
    .filter((r) => r.entityType === "project")
    .map((r) => r.entityId);
  const alive = new Set(
    projectIds.length > 0
      ? (
          await db
            .select({ id: projects.id })
            .from(projects)
            .where(inArray(projects.id, projectIds))
        ).map((p) => p.id)
      : [],
  );
  return rows
    .filter((r) => r.entityType !== "project" || alive.has(r.entityId))
    .slice(0, limit);
}

export async function getProjectTitlesByIds(ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const rows = await db
    .select({ id: projects.id, title: projects.title })
    .from(projects);
  return new Map(
    rows.filter((r) => ids.includes(r.id)).map((r) => [r.id, r.title]),
  );
}

/**
 * Projects whose active ROI version has a nextReviewDate in the past.
 */
export async function getReviewsDue() {
  return await db
    .select({
      projectId: projects.id,
      title: projects.title,
      tier: projects.complexityTier,
      versionLabel: roiCalculations.versionLabel,
      nextReviewDate: roiCalculations.nextReviewDate,
      championName: users.displayName,
    })
    .from(roiCalculations)
    .innerJoin(projects, eq(projects.id, roiCalculations.projectId))
    .leftJoin(users, eq(users.id, projects.championUserId))
    .where(
      and(
        isNull(projects.deletedAt),
        isNull(roiCalculations.deletedAt),
        isNull(roiCalculations.supersededAt),
        isNotNull(roiCalculations.nextReviewDate),
        lte(
          roiCalculations.nextReviewDate,
          new Date().toISOString().slice(0, 10),
        ),
      ),
    );
}
