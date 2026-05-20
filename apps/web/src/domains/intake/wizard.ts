/**
 * Tier self-assignment wizard.
 *
 * Deterministic decision tree over the Technology Allowlist questions.
 * Answers are recorded on the project so an auditor can see WHY a tier
 * was assigned.
 */

export type IntakeAnswers = {
  /** Q1: Does the build customize behavior at all? (No → Tier 1A) */
  customizesBehavior: boolean;
  /** Q4 (asked first because it's a hard escalator): high-risk attributes. */
  hasRestrictedData: boolean;
  hasErpWriteAccess: boolean;
  touchesHrSystem: boolean;
  trainsCustomAiModel: boolean;
  companyWideRollout: boolean;
  /** Q2: Touches anything outside the M365 tenant? */
  touchesNonM365: boolean;
  /** Q3: Uses premium platform features? */
  usesPremiumPlatformFeatures: boolean;
};

export type ComplexityTier = "1A" | "1B" | "1C" | "2" | "3";

export type TierDecision = {
  tier: ComplexityTier;
  rationale: string;
  triggers: string[];
};

export function assignTier(a: IntakeAnswers): TierDecision {
  const triggers: string[] = [];

  // Q1 — no customization at all
  if (!a.customizesBehavior) {
    return {
      tier: "1A",
      rationale: "No custom automation; standard M365 usage only.",
      triggers: [],
    };
  }

  // Q4 — hard escalators to Tier 3
  if (a.hasRestrictedData) triggers.push("Handles restricted data");
  if (a.hasErpWriteAccess) triggers.push("Writes to ERP systems");
  if (a.touchesHrSystem) triggers.push("Touches HR/payroll systems");
  if (a.trainsCustomAiModel) triggers.push("Trains a custom AI/ML model");
  if (a.companyWideRollout) triggers.push("Company-wide rollout scope");
  if (triggers.length > 0) {
    return {
      tier: "3",
      rationale: `Enterprise-scale build: ${triggers.join("; ")}.`,
      triggers,
    };
  }

  // Q2 — anything outside M365
  if (a.touchesNonM365) {
    return {
      tier: "2",
      rationale: "Integrates with systems or tools outside the M365 tenant.",
      triggers: ["External system or tool"],
    };
  }

  // Q3 — premium platform features
  if (a.usesPremiumPlatformFeatures) {
    return {
      tier: "1C",
      rationale:
        "Uses premium M365 platform features (Power Apps, premium connectors, " +
        "Dataverse, Power Pages, AI Builder, SPFx, etc.).",
      triggers: ["Premium platform feature"],
    };
  }

  // Default: standard M365 automation
  return {
    tier: "1B",
    rationale: "Standard M365 automation using included connectors only.",
    triggers: [],
  };
}
