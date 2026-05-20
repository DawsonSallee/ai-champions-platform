import { describe, expect, it } from "vitest";
import {
  canTransition,
  legalNext,
} from "../../apps/web/src/domains/governance/state-machine";

describe("project status machine", () => {
  it("Tier 1A skips approval gates entirely", () => {
    expect(canTransition("NewIdea", "InProgress", "1A")).toBe(true);
    expect(canTransition("NewIdea", "ITApprovalPending", "1A")).toBe(false);
  });

  it("Tier 1B builds first then AI-team reviews", () => {
    expect(canTransition("NewIdea", "IntakeSubmitted", "1B")).toBe(true);
    expect(canTransition("IntakeSubmitted", "InProgress", "1B")).toBe(true);
    expect(canTransition("InProgress", "AITeamReview", "1B")).toBe(true);
    expect(canTransition("AITeamReview", "Completed", "1B")).toBe(true);
    // 1B never enters ITApprovalPending
    expect(canTransition("IntakeSubmitted", "ITApprovalPending", "1B")).toBe(
      false,
    );
  });

  it("Tier 2 requires IT approval before build", () => {
    expect(canTransition("IntakeSubmitted", "ITApprovalPending", "2")).toBe(true);
    expect(canTransition("ITApprovalPending", "ITApproved", "2")).toBe(true);
    expect(canTransition("ITApproved", "InProgress", "2")).toBe(true);
    // Cannot skip approval
    expect(canTransition("IntakeSubmitted", "InProgress", "2")).toBe(false);
  });

  it("Tier 3 can be rejected at the approval gate", () => {
    expect(canTransition("ITApprovalPending", "Rejected", "3")).toBe(true);
  });

  it("AITeamReview bounces back to InProgress when changes are requested", () => {
    expect(canTransition("AITeamReview", "InProgress", "2")).toBe(true);
  });

  it("legalNext lists all valid moves for the current tier", () => {
    const next = legalNext("ITApprovalPending", "1C");
    expect(next).toContain("ITApproved");
    expect(next).toContain("Rejected");
  });
});
