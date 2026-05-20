import { describe, expect, it } from "vitest";
import {
  computeRoi,
  computeStep,
  realizedAcrossVersions,
  resolveRate,
  versionStatus,
} from "../../apps/web/src/domains/roi/engine";

describe("computeStep — Layer 3 row math", () => {
  it("fully automated task: zero new hours", () => {
    const result = computeStep({
      baselineHours: 2,
      newHours: 0,
      qualityIncreaseHours: 0.5,
      freqPerYear: 52,
      hourlyRate: 80,
    });
    expect(result.annualSavedHours).toBe(104);
    expect(result.efficiencyGainPct).toBe(1);
    expect(result.annualSavedUsd).toBe(104 * 80);
    expect(result.annualQualityHours).toBe(26);
    expect(result.annualQualityUsd).toBe(26 * 80);
  });

  it("partially automated task", () => {
    const result = computeStep({
      baselineHours: 4,
      newHours: 1,
      qualityIncreaseHours: 0,
      freqPerYear: 12,
      hourlyRate: 60,
    });
    expect(result.annualSavedHours).toBe(36);
    expect(result.efficiencyGainPct).toBe(0.75);
    expect(result.annualSavedUsd).toBe(2160);
  });

  it("zero baseline returns null efficiency", () => {
    const r = computeStep({
      baselineHours: 0,
      newHours: 0,
      qualityIncreaseHours: 0,
      freqPerYear: 1,
      hourlyRate: 50,
    });
    expect(r.efficiencyGainPct).toBeNull();
    expect(r.annualSavedUsd).toBe(0);
  });
});

describe("computeRoi totals", () => {
  it("aggregates across steps", () => {
    const { totals } = computeRoi([
      { baselineHours: 1, newHours: 0, qualityIncreaseHours: 1, freqPerYear: 4, hourlyRate: 58.5 },
      { baselineHours: 0.5, newHours: 0, qualityIncreaseHours: 1, freqPerYear: 4, hourlyRate: 58.5 },
      { baselineHours: 0, newHours: 0, qualityIncreaseHours: 1, freqPerYear: 4, hourlyRate: 58.5 },
    ]);
    expect(totals.annualSavedHours).toBeCloseTo(6, 6);
    expect(totals.annualQualityHours).toBeCloseTo(12, 6);
    expect(totals.annualSavedUsd).toBeCloseTo(351, 4);
    expect(totals.annualQualityUsd).toBeCloseTo(702, 4);
  });
});

describe("resolveRate — date-aware XLOOKUP equivalent", () => {
  const history = [
    { beginDate: "2023-01-01", hourlyRate: 50 },
    { beginDate: "2024-06-01", hourlyRate: 55 },
    { beginDate: "2026-01-01", hourlyRate: 62 },
  ];
  it("picks the entry whose begin date is the latest ≤ asOf", () => {
    expect(resolveRate(history, "2023-05-01")).toBe(50);
    expect(resolveRate(history, "2024-05-31")).toBe(50);
    expect(resolveRate(history, "2024-06-01")).toBe(55);
    expect(resolveRate(history, "2025-12-31")).toBe(55);
    expect(resolveRate(history, "2026-01-01")).toBe(62);
  });
  it("returns null when no entry applies yet", () => {
    expect(resolveRate(history, "2022-12-31")).toBeNull();
  });
});

describe("realizedAcrossVersions — sequential ROI versions", () => {
  it("returns 0 if asOfDate is before all versions started", () => {
    expect(
      realizedAcrossVersions({
        versions: [
          {
            periodStart: new Date(Date.UTC(2026, 5, 1)),
            supersededAt: null,
            annualSavedUsd: 10000,
          },
        ],
        asOfDate: new Date(Date.UTC(2026, 4, 31)),
      }),
    ).toBe(0);
  });

  it("prorates a single active version", () => {
    // Sept 1 → Dec 31 = 122 days, at $10k/yr → ~$3,342
    const v = realizedAcrossVersions({
      versions: [
        {
          periodStart: new Date(Date.UTC(2026, 8, 1)),
          supersededAt: null,
          annualSavedUsd: 10000,
        },
      ],
      asOfDate: new Date(Date.UTC(2026, 11, 31)),
    });
    expect(v).toBeCloseTo((122 / 365) * 10000, 4);
  });

  it("sums sequential V1 + V2 with different annual values", () => {
    // V1: Jan 1 → Jun 30 (181 days) at $12k = $5,950ish
    // V2: Jul 1 → Dec 31 (184 days) at $18k = $9,074ish
    const v = realizedAcrossVersions({
      versions: [
        {
          periodStart: new Date(Date.UTC(2026, 0, 1)),
          supersededAt: new Date(Date.UTC(2026, 6, 1)),
          annualSavedUsd: 12000,
        },
        {
          periodStart: new Date(Date.UTC(2026, 6, 1)),
          supersededAt: null,
          annualSavedUsd: 18000,
        },
      ],
      asOfDate: new Date(Date.UTC(2026, 11, 31)),
    });
    const v1Days = 181;
    const v2Days = 184;
    const expected = (v1Days / 365) * 12000 + (v2Days / 365) * 18000;
    expect(v).toBeCloseTo(expected, 4);
  });

  it("never accrues value past asOfDate", () => {
    // V1 active forever, today is 10 days in, annual = $36,500 → ~$1,000
    const v = realizedAcrossVersions({
      versions: [
        {
          periodStart: new Date(Date.UTC(2026, 0, 1)),
          supersededAt: null,
          annualSavedUsd: 36500,
        },
      ],
      asOfDate: new Date(Date.UTC(2026, 0, 10)),
    });
    expect(v).toBeCloseTo(1000, 4);
  });
});

describe("versionStatus", () => {
  it("returns superseded once another version takes over", () => {
    expect(
      versionStatus({
        supersededAt: new Date(Date.UTC(2026, 0, 1)),
        nextReviewDate: null,
        asOfDate: new Date(Date.UTC(2026, 5, 1)),
      }),
    ).toBe("superseded");
  });

  it("returns review_due when past nextReviewDate but still active", () => {
    expect(
      versionStatus({
        supersededAt: null,
        nextReviewDate: new Date(Date.UTC(2026, 0, 1)),
        asOfDate: new Date(Date.UTC(2026, 5, 1)),
      }),
    ).toBe("review_due");
  });

  it("returns active when current and not yet due", () => {
    expect(
      versionStatus({
        supersededAt: null,
        nextReviewDate: new Date(Date.UTC(2027, 0, 1)),
        asOfDate: new Date(Date.UTC(2026, 5, 1)),
      }),
    ).toBe("active");
  });
});
