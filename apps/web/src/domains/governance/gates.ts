/**
 * Governance gates per tier.
 *
 * The framework defines progressively rigorous gates as a project moves
 * up the tier ladder. This module:
 *
 *   1. Defines the gate sequence per tier.
 *   2. Maps each gate to (a) statuses that mark it active and
 *      (b) statuses that mean it's already past.
 *   3. Returns the live state of every gate given the project's current
 *      status + a few signals (assessment submitted, all approvals
 *      decided, etc.) for richer rendering.
 *
 * The UI uses `gatesFor(tier, signals)` to render a horizontal pipeline
 * with done / active / upcoming / blocked colors.
 */
import type { ProjectStatus } from "../projects/schema";
import type { Tier } from "../projects/schema";

export type GateState = "done" | "active" | "upcoming" | "blocked";

export type Gate = {
  key: string;
  name: string;
  /** Statuses where this gate is currently "active". */
  activeStatuses: ProjectStatus[];
  /** Status that, once reached, marks this gate as done. */
  doneAt: ProjectStatus[];
};

/**
 * The current status enum is project-wide. For tiers with multiple
 * "in-build" gates (Tier 3), several gates collapse onto `InProgress`.
 * We split them visually using artifact / assessment / approval
 * signals so a champion can see what's actually next.
 */
export type GateSignals = {
  /** IT Governance & Security Assessment has been submitted. */
  itAssessmentSubmitted?: boolean;
  /** All required approvals are decided. */
  allApprovalsDecided?: boolean;
  /** Any approval was rejected → blocks downstream gates. */
  anyApprovalRejected?: boolean;
  /** Process Design Document has been uploaded. */
  hasPdd?: boolean;
  /** Technical Solution Spec has been uploaded. */
  hasTss?: boolean;
  /** UAT entries exist + at least one Business UAT pass. */
  uatSignedOff?: boolean;
  /** A Showcase artifact exists. */
  hasShowcase?: boolean;
};

const GATES_1A: Gate[] = [
  {
    key: "build",
    name: "Build",
    activeStatuses: ["NewIdea", "InProgress"],
    doneAt: ["Completed"],
  },
  {
    key: "live",
    name: "Live",
    activeStatuses: [],
    doneAt: ["Completed"],
  },
];

const GATES_1B: Gate[] = [
  {
    key: "intake",
    name: "Intake",
    activeStatuses: ["NewIdea"],
    doneAt: [
      "IntakeSubmitted",
      "InProgress",
      "AITeamReview",
      "Completed",
    ],
  },
  {
    key: "build",
    name: "Build",
    activeStatuses: ["IntakeSubmitted", "InProgress"],
    doneAt: ["AITeamReview", "Completed"],
  },
  {
    key: "ai_team_review",
    name: "AI Team Review",
    activeStatuses: ["AITeamReview"],
    doneAt: ["Completed"],
  },
  {
    key: "live",
    name: "Live",
    activeStatuses: [],
    doneAt: ["Completed"],
  },
];

const GATES_1C_2: Gate[] = [
  {
    key: "intake",
    name: "Intake",
    activeStatuses: ["NewIdea"],
    doneAt: [
      "IntakeSubmitted",
      "ITApprovalPending",
      "ITApproved",
      "InProgress",
      "AITeamReview",
      "Completed",
    ],
  },
  {
    key: "it_approval",
    name: "IT Approval",
    activeStatuses: ["IntakeSubmitted", "ITApprovalPending"],
    doneAt: ["ITApproved", "InProgress", "AITeamReview", "Completed"],
  },
  {
    key: "build",
    name: "Build",
    activeStatuses: ["ITApproved", "InProgress"],
    doneAt: ["AITeamReview", "Completed"],
  },
  {
    key: "ai_team_review",
    name: "AI Team Review",
    activeStatuses: ["AITeamReview"],
    doneAt: ["Completed"],
  },
  {
    key: "live",
    name: "Live",
    activeStatuses: [],
    doneAt: ["Completed"],
  },
];

const GATES_3: Gate[] = [
  {
    key: "initiation",
    name: "Initiation & Governance",
    activeStatuses: [
      "NewIdea",
      "IntakeSubmitted",
      "ITApprovalPending",
    ],
    doneAt: ["ITApproved", "InProgress", "AITeamReview", "Completed"],
  },
  {
    key: "design",
    name: "Solution Design",
    activeStatuses: ["ITApproved", "InProgress"],
    doneAt: ["AITeamReview", "Completed"],
  },
  {
    key: "development",
    name: "Development",
    activeStatuses: ["InProgress"],
    doneAt: ["AITeamReview", "Completed"],
  },
  {
    key: "qa",
    name: "QA & Testing",
    activeStatuses: ["AITeamReview"],
    doneAt: ["Completed"],
  },
  {
    key: "deployment",
    name: "Deployment",
    activeStatuses: ["AITeamReview"],
    doneAt: ["Completed"],
  },
  {
    key: "closure",
    name: "Value Closure",
    activeStatuses: [],
    doneAt: ["Completed"],
  },
];

export function gateDefinitions(tier: Tier | null | undefined): Gate[] {
  switch (tier) {
    case "1A":
      return GATES_1A;
    case "1B":
      return GATES_1B;
    case "1C":
    case "2":
      return GATES_1C_2;
    case "3":
      return GATES_3;
    default:
      return GATES_1B;
  }
}

/**
 * Compute the rendered state of every gate for a project.
 */
export function gatesFor(
  tier: Tier | null | undefined,
  status: ProjectStatus,
  signals: GateSignals = {},
): Array<Gate & { state: GateState; note?: string }> {
  const defs = gateDefinitions(tier);

  // Rejected / Decommissioned: every gate is "blocked" past the point
  // we got to.
  const rejected = status === "Rejected";
  const decom = status === "Decommissioned";

  return defs.map((g, i) => {
    let state: GateState;
    let note: string | undefined;

    if (g.doneAt.includes(status)) {
      state = "done";
    } else if (g.activeStatuses.includes(status)) {
      state = rejected ? "blocked" : "active";
    } else {
      // Decide upcoming vs done based on enum ordering of the project
      // status against the gate's expected entry status.
      // We treat any gate whose activeStatuses *all* precede the current
      // status as done; otherwise upcoming.
      const allPrior = g.activeStatuses.every((s) =>
        statusOrdinal(s) < statusOrdinal(status),
      );
      state = allPrior && g.activeStatuses.length > 0 ? "done" : "upcoming";
    }

    if (rejected) {
      if (state === "active") {
        state = "blocked";
        note = "Project rejected";
      } else if (state === "upcoming") {
        state = "blocked";
      }
    }
    if (decom && i === defs.length - 1) {
      note = "Decommissioned";
    }

    // Signal-based refinement for Tier 3's collapsed in-progress gates.
    if (tier === "3" && state === "active") {
      if (g.key === "initiation" && signals.itAssessmentSubmitted)
        note = "Assessment submitted";
      if (g.key === "design" && !signals.hasPdd) note = "Awaiting PDD";
      if (g.key === "development" && !signals.hasTss)
        note = "Awaiting TSS";
      if (g.key === "qa" && signals.uatSignedOff) note = "UAT complete";
    }

    return { ...g, state, note };
  });
}

const STATUS_ORDER: ProjectStatus[] = [
  "NewIdea",
  "IntakeSubmitted",
  "UnderReview",
  "ITApprovalPending",
  "ITApproved",
  "InProgress",
  "AITeamReview",
  "Completed",
  "Rejected",
  "Decommissioned",
];

function statusOrdinal(s: ProjectStatus): number {
  return STATUS_ORDER.indexOf(s);
}
