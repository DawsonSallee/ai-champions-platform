/**
 * ROI Engine — pure functions, no I/O.
 *
 * Mirrors the legacy ROI Calculator workbook:
 *   - Layer 1 (Current State): baseline hours, role, frequency
 *   - Layer 2 (Future State):  new hours after automation, quality hours
 *   - Layer 3 (ROI):           annual hours saved, efficiency %, annual $ saved
 *
 * The hourly rate is resolved by the caller from cost_rate_history
 * (date-aware lookup, equivalent to the workbook's XLOOKUP behavior).
 *
 * Realized-savings-to-date replaces the Power BI DAX measure.
 */

export type RoiStepInput = {
  /** Hours required to perform one instance of the manual task. */
  baselineHours: number;
  /** Hours required to perform one instance AFTER automation. 0 = fully automated. */
  newHours: number;
  /** Hours saved per instance by reducing errors / rework. */
  qualityIncreaseHours: number;
  /** Times this task runs in a year. */
  freqPerYear: number;
  /** Resolved hourly rate for the role on the audit date. */
  hourlyRate: number;
};

export type RoiStepResult = {
  annualSavedHours: number;
  efficiencyGainPct: number | null; // null when baselineHours = 0
  annualSavedUsd: number;
  annualQualityHours: number;
  annualQualityUsd: number;
};

export type RoiTotals = {
  annualSavedHours: number;
  annualSavedUsd: number;
  annualQualityHours: number;
  annualQualityUsd: number;
};

/** Compute one step. */
export function computeStep(s: RoiStepInput): RoiStepResult {
  const annualSavedHours = (s.baselineHours - s.newHours) * s.freqPerYear;
  const efficiencyGainPct =
    s.baselineHours === 0 ? null : (s.baselineHours - s.newHours) / s.baselineHours;
  const annualSavedUsd = annualSavedHours * s.hourlyRate;
  const annualQualityHours = s.qualityIncreaseHours * s.freqPerYear;
  const annualQualityUsd = annualQualityHours * s.hourlyRate;

  return {
    annualSavedHours,
    efficiencyGainPct,
    annualSavedUsd,
    annualQualityHours,
    annualQualityUsd,
  };
}

/** Compute every step and the aggregated totals. */
export function computeRoi(steps: RoiStepInput[]): {
  steps: RoiStepResult[];
  totals: RoiTotals;
} {
  const computed = steps.map(computeStep);
  const totals = computed.reduce<RoiTotals>(
    (acc, r) => ({
      annualSavedHours: acc.annualSavedHours + r.annualSavedHours,
      annualSavedUsd: acc.annualSavedUsd + r.annualSavedUsd,
      annualQualityHours: acc.annualQualityHours + r.annualQualityHours,
      annualQualityUsd: acc.annualQualityUsd + r.annualQualityUsd,
    }),
    {
      annualSavedHours: 0,
      annualSavedUsd: 0,
      annualQualityHours: 0,
      annualQualityUsd: 0,
    },
  );
  return { steps: computed, totals };
}

/**
 * Resolve the hourly rate effective on a given date.
 * Mirrors the workbook's date-aware XLOOKUP against the cost-rate sheet.
 *
 * Picks the entry with the latest `beginDate` ≤ `asOf`. Returns null when
 * there is no historical entry that applies yet (caller decides what to do).
 */
export function resolveRate(
  history: ReadonlyArray<{ beginDate: string; hourlyRate: number }>,
  asOf: string,
): number | null {
  let best: { beginDate: string; hourlyRate: number } | null = null;
  for (const entry of history) {
    if (entry.beginDate <= asOf) {
      if (best === null || entry.beginDate > best.beginDate) {
        best = entry;
      }
    }
  }
  return best ? best.hourlyRate : null;
}

/**
 * A time-bounded ROI version. Each version's projection is in effect
 * from `periodStart` until `supersededAt` (or `null` = still active).
 */
export type RoiVersionPeriod = {
  periodStart: Date;
  supersededAt: Date | null;
  annualSavedUsd: number;
};

/**
 * Realized savings to date — iterates every version of a project's ROI,
 * prorating each version's annual savings by the days it was in effect
 * up to `asOfDate`.
 *
 * Days-in-year uses 365 (matching the documented DAX).
 */
export function realizedAcrossVersions(args: {
  versions: ReadonlyArray<RoiVersionPeriod>;
  asOfDate: Date;
}): number {
  let total = 0;
  for (const v of args.versions) {
    const start = v.periodStart;
    if (args.asOfDate.getTime() < start.getTime()) continue;

    const end =
      v.supersededAt && v.supersededAt.getTime() < args.asOfDate.getTime()
        ? v.supersededAt
        : args.asOfDate;

    // Treat supersededAt as exclusive (V2 starts the day after V1 ends).
    const days =
      Math.floor(
        (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
      ) + (v.supersededAt && v.supersededAt.getTime() <= args.asOfDate.getTime() ? 0 : 1);

    if (days <= 0) continue;
    total += (days / 365) * v.annualSavedUsd;
  }
  return total;
}

/**
 * Status of a single ROI version relative to today.
 *
 *   active      — currently in effect (supersededAt is null)
 *   review_due  — active AND today >= nextReviewDate
 *   superseded  — a later version has taken over
 */
export type RoiVersionStatus = "active" | "review_due" | "superseded";

export function versionStatus(args: {
  supersededAt: Date | null;
  nextReviewDate: Date | null;
  asOfDate?: Date;
}): RoiVersionStatus {
  const now = args.asOfDate ?? new Date();
  if (args.supersededAt && args.supersededAt.getTime() <= now.getTime())
    return "superseded";
  if (
    args.nextReviewDate &&
    args.nextReviewDate.getTime() <= now.getTime()
  )
    return "review_due";
  return "active";
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
