/**
 * ROI service — DB-bound.
 *
 * The model:
 *   - Each project has many `roi_calculations` rows (versions).
 *   - Each version covers [periodStart, supersededAt ?? today].
 *   - Saving a new version auto-closes the prior active version
 *     (sets its supersededAt = new version's periodStart).
 *   - `nextReviewDate` is a nag — when today >= nextReviewDate, the
 *     project surfaces in the "due for review" list and weekly nudge.
 */
import { db } from "@/db/client";
import {
  costRateHistory,
  roiCalculations,
  roiSteps,
} from "@/db/schema";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { audited, type AuditContext } from "@/lib/audit";
import {
  computeRoi,
  realizedAcrossVersions,
  resolveRate,
  type RoiVersionPeriod,
} from "./engine";

export type RoiStepDraft = {
  name: string;
  description?: string;
  roleCode: string;
  freqPerYear: number;
  baselineHours: number;
  newHours: number;
  qualityIncreaseHours: number;
};

async function loadRates(asOf: string) {
  const rows = await db.select().from(costRateHistory);
  const byRole = new Map<string, { beginDate: string; hourlyRate: number }[]>();
  for (const r of rows) {
    if (!byRole.has(r.roleCode)) byRole.set(r.roleCode, []);
    byRole.get(r.roleCode)!.push({
      beginDate: r.beginDate,
      hourlyRate: Number(r.hourlyRate),
    });
  }
  return (roleCode: string) => {
    const hist = byRole.get(roleCode);
    if (!hist) return null;
    return resolveRate(hist, asOf);
  };
}

export async function getVersionsForProject(projectId: string) {
  return await db
    .select()
    .from(roiCalculations)
    .where(
      and(
        eq(roiCalculations.projectId, projectId),
        isNull(roiCalculations.deletedAt),
      ),
    )
    .orderBy(asc(roiCalculations.periodStart));
}

export async function getLatestVersion(projectId: string) {
  const [v] = await db
    .select()
    .from(roiCalculations)
    .where(
      and(
        eq(roiCalculations.projectId, projectId),
        isNull(roiCalculations.deletedAt),
      ),
    )
    .orderBy(desc(roiCalculations.createdAt))
    .limit(1);
  if (!v) return null;
  const steps = await db
    .select()
    .from(roiSteps)
    .where(eq(roiSteps.roiCalculationId, v.id))
    .orderBy(asc(roiSteps.stepOrder));
  return { calc: v, steps };
}

export async function getActiveVersion(projectId: string) {
  const [v] = await db
    .select()
    .from(roiCalculations)
    .where(
      and(
        eq(roiCalculations.projectId, projectId),
        isNull(roiCalculations.deletedAt),
        isNull(roiCalculations.supersededAt),
      ),
    )
    .orderBy(desc(roiCalculations.periodStart))
    .limit(1);
  return v ?? null;
}

/**
 * Realized $ to date for one project, iterating its versions.
 */
export async function realizedForProject(
  projectId: string,
  asOf: Date = new Date(),
): Promise<number> {
  const versions = await getVersionsForProject(projectId);
  return realizedAcrossVersions({
    versions: versions.map<RoiVersionPeriod>((v) => ({
      periodStart: new Date(v.periodStart),
      supersededAt: v.supersededAt ? new Date(v.supersededAt) : null,
      annualSavedUsd: Number(v.computedAnnualSavingsUsd ?? 0),
    })),
    asOfDate: asOf,
  });
}

export type SaveRoiCalculationInput = {
  projectId: string;
  versionLabel: string;
  periodStart: string; // YYYY-MM-DD
  nextReviewDate?: string | null; // YYYY-MM-DD
  steps: RoiStepDraft[];
};

/**
 * Persist a new ROI version snapshot.
 *
 * Side-effects:
 *   - Resolves hourly rates from cost_rate_history as of `periodStart`.
 *   - Computes totals from steps and caches them on the row.
 *   - If a prior active version exists, sets its `supersededAt` to
 *     `periodStart` (so they don't overlap).
 *   - Wraps everything in one audited transaction.
 */
export async function saveRoiCalculation(
  input: SaveRoiCalculationInput,
  ctx: AuditContext,
) {
  const rateOf = await loadRates(input.periodStart);
  const resolved = input.steps.map((s) => {
    const rate = rateOf(s.roleCode);
    if (rate == null)
      throw new Error(
        `No hourly rate found for role ${s.roleCode} on or before ${input.periodStart}`,
      );
    return { ...s, hourlyRate: rate };
  });

  const computed = computeRoi(
    resolved.map((s) => ({
      baselineHours: s.baselineHours,
      newHours: s.newHours,
      qualityIncreaseHours: s.qualityIncreaseHours,
      freqPerYear: s.freqPerYear,
      hourlyRate: s.hourlyRate,
    })),
  );

  return await audited({
    ctx,
    entityType: "roi_calculation",
    entityId: input.projectId,
    action: "create",
    run: async (tx) => {
      // Close any currently-active version for this project.
      await tx
        .update(roiCalculations)
        .set({ supersededAt: input.periodStart })
        .where(
          and(
            eq(roiCalculations.projectId, input.projectId),
            isNull(roiCalculations.supersededAt),
            isNull(roiCalculations.deletedAt),
          ),
        );

      const [calc] = await tx
        .insert(roiCalculations)
        .values({
          projectId: input.projectId,
          versionLabel: input.versionLabel,
          periodStart: input.periodStart,
          nextReviewDate: input.nextReviewDate ?? null,
          supersededAt: null,
          computedAnnualSavingsUsd: computed.totals.annualSavedUsd.toFixed(2),
          computedAnnualSavingsHours:
            computed.totals.annualSavedHours.toFixed(2),
          computedQualityValueUsd: computed.totals.annualQualityUsd.toFixed(2),
          computedQualityHours: computed.totals.annualQualityHours.toFixed(2),
        })
        .returning();

      for (let i = 0; i < resolved.length; i++) {
        const s = resolved[i];
        await tx.insert(roiSteps).values({
          roiCalculationId: calc.id,
          stepOrder: i + 1,
          name: s.name,
          description: s.description,
          roleCode: s.roleCode,
          freqPerYear: s.freqPerYear.toString(),
          baselineHours: s.baselineHours.toString(),
          newHours: s.newHours.toString(),
          qualityIncreaseHours: s.qualityIncreaseHours.toString(),
        });
      }
      return { result: calc, after: { calc, computed: computed.totals } };
    },
  });
}

/**
 * Push out (or remove) the nextReviewDate on the active version.
 */
export async function setNextReviewDate(args: {
  projectId: string;
  nextReviewDate: string | null;
  ctx: AuditContext;
}) {
  const active = await getActiveVersion(args.projectId);
  if (!active) throw new Error("No active ROI version");

  return await audited({
    ctx: args.ctx,
    entityType: "roi_calculation",
    entityId: active.id,
    action: "update",
    before: { nextReviewDate: active.nextReviewDate },
    run: async (tx) => {
      const [row] = await tx
        .update(roiCalculations)
        .set({ nextReviewDate: args.nextReviewDate })
        .where(eq(roiCalculations.id, active.id))
        .returning();
      return { result: row, after: { nextReviewDate: row.nextReviewDate } };
    },
  });
}

/**
 * In-place edit of any version (active or prior) without creating a new
 * version. Resolves rates as of the *version's own* periodStart, so
 * editing a prior version uses the rates that were in effect when that
 * version applied — not today's rates.
 */
export async function reviseVersion(args: {
  versionId: string;
  steps: RoiStepDraft[];
  ctx: AuditContext;
}) {
  const [version] = await db
    .select()
    .from(roiCalculations)
    .where(eq(roiCalculations.id, args.versionId))
    .limit(1);
  if (!version) throw new Error("Version not found");

  const rateOf = await loadRates(version.periodStart);
  const resolved = args.steps.map((s) => {
    const rate = rateOf(s.roleCode);
    if (rate == null)
      throw new Error(`No hourly rate found for role ${s.roleCode}`);
    return { ...s, hourlyRate: rate };
  });
  const computed = computeRoi(
    resolved.map((s) => ({
      baselineHours: s.baselineHours,
      newHours: s.newHours,
      qualityIncreaseHours: s.qualityIncreaseHours,
      freqPerYear: s.freqPerYear,
      hourlyRate: s.hourlyRate,
    })),
  );

  return await audited({
    ctx: args.ctx,
    entityType: "roi_calculation",
    entityId: version.id,
    action: "update",
    run: async (tx) => {
      await tx.delete(roiSteps).where(eq(roiSteps.roiCalculationId, version.id));
      for (let i = 0; i < resolved.length; i++) {
        const s = resolved[i];
        await tx.insert(roiSteps).values({
          roiCalculationId: version.id,
          stepOrder: i + 1,
          name: s.name,
          description: s.description,
          roleCode: s.roleCode,
          freqPerYear: s.freqPerYear.toString(),
          baselineHours: s.baselineHours.toString(),
          newHours: s.newHours.toString(),
          qualityIncreaseHours: s.qualityIncreaseHours.toString(),
        });
      }
      const [row] = await tx
        .update(roiCalculations)
        .set({
          computedAnnualSavingsUsd: computed.totals.annualSavedUsd.toFixed(2),
          computedAnnualSavingsHours:
            computed.totals.annualSavedHours.toFixed(2),
          computedQualityValueUsd: computed.totals.annualQualityUsd.toFixed(2),
          computedQualityHours: computed.totals.annualQualityHours.toFixed(2),
        })
        .where(eq(roiCalculations.id, version.id))
        .returning();
      return { result: row, after: { totals: computed.totals } };
    },
  });
}

/** Backwards-compatible alias for callers expecting the active-only API. */
export async function reviseActiveVersion(args: {
  projectId: string;
  steps: RoiStepDraft[];
  ctx: AuditContext;
}) {
  const active = await getActiveVersion(args.projectId);
  if (!active) throw new Error("No active ROI version");
  return await reviseVersion({
    versionId: active.id,
    steps: args.steps,
    ctx: args.ctx,
  });
}

void sql;
