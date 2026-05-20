/**
 * Project status machine.
 *
 * Centralizes every legal status transition so we can answer
 * "is this change allowed?" in one place — UI, server actions, and the
 * SLA reaper all consult `canTransition`.
 *
 * Tier 1A bypasses approvals entirely; Tier 1B has a single AI-team
 * post-build review; Tier 1C / 2 / 3 require IT approval BEFORE build.
 */
export type ProjectStatus =
  | "NewIdea"
  | "IntakeSubmitted"
  | "UnderReview"
  | "ITApprovalPending"
  | "ITApproved"
  | "InProgress"
  | "AITeamReview"
  | "Completed"
  | "Rejected"
  | "Decommissioned";

export type Tier = "1A" | "1B" | "1C" | "2" | "3";

type Edge = { from: ProjectStatus; to: ProjectStatus; tiers?: Tier[] };

const EDGES: ReadonlyArray<Edge> = [
  // Tier 1A: direct path
  { from: "NewIdea", to: "InProgress", tiers: ["1A"] },
  { from: "InProgress", to: "Completed", tiers: ["1A"] },

  // Tier 1B: build first, then AI-team review
  { from: "NewIdea", to: "IntakeSubmitted", tiers: ["1B"] },
  { from: "IntakeSubmitted", to: "InProgress", tiers: ["1B"] },
  { from: "InProgress", to: "AITeamReview", tiers: ["1B"] },

  // Tier 1C / 2 / 3: IT approval before build
  {
    from: "NewIdea",
    to: "IntakeSubmitted",
    tiers: ["1C", "2", "3"],
  },
  {
    from: "IntakeSubmitted",
    to: "ITApprovalPending",
    tiers: ["1C", "2", "3"],
  },
  {
    from: "ITApprovalPending",
    to: "ITApproved",
    tiers: ["1C", "2", "3"],
  },
  {
    from: "ITApprovalPending",
    to: "Rejected",
    tiers: ["1C", "2", "3"],
  },
  { from: "ITApproved", to: "InProgress", tiers: ["1C", "2", "3"] },
  { from: "InProgress", to: "AITeamReview", tiers: ["1C", "2", "3"] },

  // Common closure path
  { from: "AITeamReview", to: "Completed" },
  { from: "AITeamReview", to: "InProgress" }, // bounce back for fixes
  { from: "Completed", to: "Decommissioned" },

  // Any state can be rejected by an admin / AI team
  { from: "NewIdea", to: "Rejected" },
  { from: "IntakeSubmitted", to: "Rejected" },
  { from: "UnderReview", to: "Rejected" },
  { from: "ITApprovalPending", to: "Rejected" },
];

export function canTransition(
  from: ProjectStatus,
  to: ProjectStatus,
  tier: Tier | null,
): boolean {
  return EDGES.some(
    (e) =>
      e.from === from &&
      e.to === to &&
      (!e.tiers || (tier !== null && e.tiers.includes(tier))),
  );
}

export function legalNext(from: ProjectStatus, tier: Tier | null): ProjectStatus[] {
  return EDGES.filter(
    (e) => e.from === from && (!e.tiers || (tier !== null && e.tiers.includes(tier))),
  ).map((e) => e.to);
}

/** Statuses that count an active project for the leaderboard / nudge job. */
export const ACTIVE_STATUSES: ReadonlySet<ProjectStatus> = new Set([
  "IntakeSubmitted",
  "UnderReview",
  "ITApprovalPending",
  "ITApproved",
  "InProgress",
  "AITeamReview",
]);

export const NUDGE_STATUSES: ReadonlySet<ProjectStatus> = new Set([
  "InProgress",
  "AITeamReview",
]);
