/**
 * Display-name helpers — the canonical way to label reviewer roles,
 * statuses, tiers, action verbs etc. in the UI. Never show raw enum
 * codes like "dev_governance" to a user.
 */
import type { ProjectStatus, Tier } from "@/domains/projects/schema";

/**
 * Approval gates from the framework.
 *
 *   IT Approval     — pre-build gate (Security + Dev Gov + Licensing, varies by tier)
 *   AI Team Review  — post-build gate (AI Team)
 *
 * Each reviewer-role sub-approval rolls up under one of these gates.
 */
export type ApprovalGate = "IT Approval" | "AI Team Review";

export function gateForReviewerRole(code: string): ApprovalGate {
  if (code === "ai_team") return "AI Team Review";
  return "IT Approval";
}

export function reviewerRoleLabel(code: string): string {
  switch (code) {
    case "security":
      return "Security";
    case "dev_governance":
      return "Development Governance";
    case "licensing":
      return "Licensing";
    case "ai_team":
      return "AI Team";
    default:
      return code
        .split("_")
        .map((s) => s[0]?.toUpperCase() + s.slice(1))
        .join(" ");
  }
}

export function statusLabel(s: ProjectStatus): string {
  switch (s) {
    case "NewIdea":
      return "New idea";
    case "IntakeSubmitted":
      return "Intake submitted";
    case "UnderReview":
      return "Under review";
    case "ITApprovalPending":
      return "IT approval pending";
    case "ITApproved":
      return "IT approved";
    case "InProgress":
      return "In progress";
    case "AITeamReview":
      return "AI team review";
    case "Completed":
      return "Completed";
    case "Rejected":
      return "Rejected";
    case "Decommissioned":
      return "Decommissioned";
  }
}

export function tierLabel(t: Tier | null | undefined): string {
  if (!t) return "—";
  return `Tier ${t}`;
}

export function approvalStatusLabel(s: string): string {
  switch (s) {
    case "Pending":
      return "Pending";
    case "Approved":
      return "Approved";
    case "ChangesRequested":
      return "Changes requested";
    case "Rejected":
      return "Rejected";
    default:
      return s;
  }
}

export function linkTypeLabel(t: string): string {
  switch (t) {
    case "github_repo":
      return "GitHub repository";
    case "low_code_portal":
      return "Low-code portal";
    case "bi_dashboard":
      return "BI dashboard";
    case "blob_file":
      return "File";
    case "other":
      return "Other";
    default:
      return t;
  }
}

export function artifactTypeLabel(t: string): string {
  switch (t) {
    case "PDD":
      return "Process Design Document";
    case "TSS":
      return "Technical Spec";
    case "UAT":
      return "UAT Log";
    case "Showcase":
      return "Showcase";
    case "UsageGuide":
      return "Usage Guide";
    case "Misc":
      return "Other";
    default:
      return t;
  }
}

export function actionLabel(a: string): string {
  switch (a) {
    case "create":
      return "Created";
    case "update":
      return "Updated";
    case "delete":
      return "Deleted";
    case "restore":
      return "Restored";
    case "transition":
      return "Status change";
    default:
      return a;
  }
}
