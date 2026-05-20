import { pgEnum } from "drizzle-orm/pg-core";

export const complexityTierEnum = pgEnum("complexity_tier", [
  "1A",
  "1B",
  "1C",
  "2",
  "3",
]);

export const projectStatusEnum = pgEnum("project_status", [
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
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "Pending",
  "Approved",
  "ChangesRequested",
  "Rejected",
]);

export const dataClassificationEnum = pgEnum("data_classification", [
  "Public",
  "Internal",
  "Confidential",
  "Restricted",
]);

export const businessImpactEnum = pgEnum("business_impact", [
  "Low",
  "Medium",
  "High",
]);

export const artifactTypeEnum = pgEnum("artifact_type", [
  "PDD",
  "TSS",
  "UAT",
  "Showcase",
  "UsageGuide",
  "Misc",
]);

export const solutionLinkTypeEnum = pgEnum("solution_link_type", [
  "github_repo",
  "low_code_portal",
  "bi_dashboard",
  "blob_file",
  "other",
]);

export const uatPhaseEnum = pgEnum("uat_phase", ["InternalQA", "BusinessUAT"]);

export const uatResultEnum = pgEnum("uat_result", ["Pass", "Fail", "Blocked"]);

export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "restore",
  "transition",
]);
