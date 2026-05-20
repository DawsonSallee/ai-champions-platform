import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  jsonb,
  primaryKey,
} from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { users } from "./users";
import {
  approvalStatusEnum,
  businessImpactEnum,
  complexityTierEnum,
  dataClassificationEnum,
} from "./enums";

/**
 * Reviewer roles are CONFIGURABLE — admins can add/edit without code changes.
 * Examples: security, dev_governance, licensing, ai_team.
 */
export const reviewerRoles = pgTable("reviewer_roles", {
  code: text("code").primaryKey(),
  displayName: text("display_name").notNull(),
  description: text("description"),
});

/**
 * Which reviewer roles are required at which tier, with SLA. DB-configurable.
 * (tier, reviewer_role_code) is the natural key.
 */
export const tierReviewMatrix = pgTable(
  "tier_review_matrix",
  {
    tier: complexityTierEnum("tier").notNull(),
    reviewerRoleCode: text("reviewer_role_code")
      .notNull()
      .references(() => reviewerRoles.code, { onDelete: "cascade" }),
    required: boolean("required").notNull().default(true),
    slaBusinessDays: integer("sla_business_days").notNull().default(3),
  },
  (t) => ({ pk: primaryKey({ columns: [t.tier, t.reviewerRoleCode] }) }),
);

/**
 * Mapping of users to reviewer roles. The approval engine resolves
 * (project, reviewer_role) → active user(s) holding that role.
 */
export const userReviewerRoles = pgTable(
  "user_reviewer_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reviewerRoleCode: text("reviewer_role_code")
      .notNull()
      .references(() => reviewerRoles.code, { onDelete: "cascade" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.reviewerRoleCode] }) }),
);

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  reviewerUserId: uuid("reviewer_user_id").references(() => users.id),
  reviewerRoleCode: text("reviewer_role_code")
    .notNull()
    .references(() => reviewerRoles.code),
  status: approvalStatusEnum("status").notNull().default("Pending"),
  slaDueAt: timestamp("sla_due_at", { withTimezone: true }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const approvalComments = pgTable("approval_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  approvalId: uuid("approval_id")
    .notNull()
    .references(() => approvals.id, { onDelete: "cascade" }),
  authorUserId: uuid("author_user_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * The structured IT Governance & Security Assessment.
 * raw_json preserves any extra freeform fields for future-proofing.
 */
export const itAssessments = pgTable("it_assessments", {
  projectId: uuid("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  dataClassification: dataClassificationEnum("data_classification"),
  dataFlowFrom: text("data_flow_from"),
  dataFlowTo: text("data_flow_to"),
  recordsPerDay: integer("records_per_day"),
  toolingType: text("tooling_type"),
  hostingLocation: text("hosting_location"),
  authMethod: text("auth_method"),
  llmSource: text("llm_source"),
  llmTrainingRisk: boolean("llm_training_risk"),
  vendorCertsJson: jsonb("vendor_certs_json"),
  businessImpact: businessImpactEnum("business_impact"),
  manualWorkaround: text("manual_workaround"),
  rawJson: jsonb("raw_json"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  submittedByUserId: uuid("submitted_by_user_id").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const clientContracts = pgTable("client_contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientName: text("client_name").notNull().unique(),
  aiPermitted: boolean("ai_permitted").notNull().default(false),
  restrictionsMd: text("restrictions_md"),
  contractUrl: text("contract_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
