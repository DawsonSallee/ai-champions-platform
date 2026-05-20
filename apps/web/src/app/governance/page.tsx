import Link from "next/link";
import { db } from "@/db/client";
import { approvals, projects, users } from "@/db/schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { safe } from "@/lib/safe-query";
import { DbDownBanner } from "@/components/DbDownBanner";
import { StatusBadge } from "@/components/StatusBadge";
import { TierBadge } from "@/components/TierBadge";
import { gateForReviewerRole, type ApprovalGate } from "@/lib/display";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function GovernancePage() {
  const result = await safe(async () => {
    const pending = await db
      .selectDistinct({ projectId: approvals.projectId })
      .from(approvals)
      .innerJoin(projects, eq(projects.id, approvals.projectId))
      .where(and(eq(approvals.status, "Pending"), isNull(projects.deletedAt)));

    if (pending.length === 0) return [];

    const ids = pending.map((p) => p.projectId);

    const rows = await db
      .select({
        approval: approvals,
        project: projects,
        championName: users.displayName,
      })
      .from(approvals)
      .innerJoin(projects, eq(projects.id, approvals.projectId))
      .leftJoin(users, eq(users.id, projects.championUserId))
      .where(inArray(approvals.projectId, ids))
      .orderBy(asc(approvals.createdAt));

    type Item = {
      projectId: string;
      title: string;
      tier: typeof projects.$inferSelect.complexityTier;
      status: typeof projects.$inferSelect.status;
      championName: string | null;
      totalReviewers: number;
      decidedReviewers: number;
      currentGate: ApprovalGate | null;
      soonestSla: Date | null;
      anyOverdue: boolean;
    };
    const map = new Map<string, Item>();
    for (const r of rows) {
      const slot = map.get(r.project.id) ?? {
        projectId: r.project.id,
        title: r.project.title,
        tier: r.project.complexityTier,
        status: r.project.status,
        championName: r.championName,
        totalReviewers: 0,
        decidedReviewers: 0,
        currentGate: null,
        soonestSla: null,
        anyOverdue: false,
      };
      slot.totalReviewers++;
      if (r.approval.status !== "Pending") slot.decidedReviewers++;
      if (r.approval.status === "Pending") {
        const g = gateForReviewerRole(r.approval.reviewerRoleCode);
        if (!slot.currentGate) slot.currentGate = g;
        if (r.approval.slaDueAt) {
          if (!slot.soonestSla || r.approval.slaDueAt < slot.soonestSla)
            slot.soonestSla = r.approval.slaDueAt;
          if (r.approval.slaDueAt.getTime() < Date.now()) slot.anyOverdue = true;
        }
      }
      map.set(r.project.id, slot);
    }

    return [...map.values()].sort((a, b) => {
      if (a.anyOverdue !== b.anyOverdue) return a.anyOverdue ? -1 : 1;
      return (
        (a.soonestSla?.getTime() ?? Number.POSITIVE_INFINITY) -
        (b.soonestSla?.getTime() ?? Number.POSITIVE_INFINITY)
      );
    });
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Governance</h1>

      {!result.ok && <DbDownBanner message={result.error} />}

      {result.ok && result.value.length === 0 ? (
        <div className="card p-12 text-center text-sm text-ink-subtle">
          No projects are currently awaiting review.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle text-left text-[11px] uppercase tracking-wider text-ink-subtle">
              <tr>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Gate</th>
                <th className="px-4 py-3">Champion</th>
                <th className="px-4 py-3 text-right">Reviewers</th>
                <th className="px-4 py-3 text-right">SLA due</th>
              </tr>
            </thead>
            <tbody>
              {result.ok &&
                result.value.map((p) => (
                  <tr
                    key={p.projectId}
                    className="border-t border-surface-divider hover:bg-surface-subtle"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/projects/${p.projectId}?tab=approvals`}
                        className="font-medium text-ink hover:text-brand"
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <TierBadge tier={p.tier} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {p.currentGate ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {p.championName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-muted tabular-nums">
                      {p.decidedReviewers} / {p.totalReviewers}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${
                        p.anyOverdue
                          ? "font-semibold text-rose-700"
                          : "text-ink-muted"
                      }`}
                    >
                      {formatDate(p.soonestSla)}
                      {p.anyOverdue ? " · Overdue" : ""}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
