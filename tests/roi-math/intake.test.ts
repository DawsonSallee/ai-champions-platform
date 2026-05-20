import { describe, expect, it } from "vitest";
import {
  assignTier,
  type IntakeAnswers,
} from "../../apps/web/src/domains/intake/wizard";

const base: IntakeAnswers = {
  customizesBehavior: true,
  hasRestrictedData: false,
  hasErpWriteAccess: false,
  touchesHrSystem: false,
  trainsCustomAiModel: false,
  companyWideRollout: false,
  touchesNonM365: false,
  usesPremiumPlatformFeatures: false,
};

describe("tier wizard", () => {
  it("Tier 1A when no customization", () => {
    expect(assignTier({ ...base, customizesBehavior: false }).tier).toBe("1A");
  });

  it("Tier 1B by default — pure M365 standard automation", () => {
    expect(assignTier(base).tier).toBe("1B");
  });

  it("Tier 1C when premium features are used", () => {
    expect(assignTier({ ...base, usesPremiumPlatformFeatures: true }).tier).toBe(
      "1C",
    );
  });

  it("Tier 2 when non-M365 systems are involved", () => {
    expect(assignTier({ ...base, touchesNonM365: true }).tier).toBe("2");
  });

  it("Tier 3 escalators dominate — restricted data", () => {
    const r = assignTier({
      ...base,
      hasRestrictedData: true,
      touchesNonM365: true,
      usesPremiumPlatformFeatures: true,
    });
    expect(r.tier).toBe("3");
    expect(r.triggers).toContain("Handles restricted data");
  });

  it("Tier 3 enumerates all triggers in rationale", () => {
    const r = assignTier({
      ...base,
      hasErpWriteAccess: true,
      touchesHrSystem: true,
      trainsCustomAiModel: true,
      companyWideRollout: true,
    });
    expect(r.tier).toBe("3");
    expect(r.triggers).toHaveLength(4);
  });
});
