import {
  pgTable,
  text,
  timestamp,
  uuid,
  date,
  numeric,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { users } from "./users";

/**
 * Catalog of role codes used in ROI calculations.
 */
export const rolesCatalog = pgTable("roles_catalog", {
  roleCode: text("role_code").primaryKey(),
  displayName: text("display_name").notNull(),
  active: text("active").notNull().default("true"),
});

/**
 * Date-aware hourly rates. The ROI engine looks up the rate effective on
 * the calculation's `periodStart`. Equivalent to the Excel XLOOKUP behavior.
 */
export const costRateHistory = pgTable(
  "cost_rate_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roleCode: text("role_code")
      .notNull()
      .references(() => rolesCatalog.roleCode, { onDelete: "cascade" }),
    beginDate: date("begin_date").notNull(),
    hourlyRate: numeric("hourly_rate", { precision: 12, scale: 4 }).notNull(),
  },
  (t) => ({
    roleBeginIdx: index("cost_rate_role_begin_idx").on(t.roleCode, t.beginDate),
  }),
);

/**
 * Each row is one *version* of a project's ROI projection — a snapshot
 * that covers a specific time window.
 *
 *   periodStart        — when this version's projection starts applying
 *                         (drives rate lookup against cost_rate_history)
 *   nextReviewDate     — when the champion should revisit the projection
 *   supersededAt       — set to the next version's periodStart when a new
 *                         version is created; null = currently active
 *
 * Realized savings for a project = Σ over versions of
 *   (days in [periodStart, supersededAt ?? today] / 365) × annual savings
 */
export const roiCalculations = pgTable("roi_calculations", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  versionLabel: text("version_label").notNull(),

  periodStart: date("period_start").notNull(),
  nextReviewDate: date("next_review_date"),
  supersededAt: date("superseded_at"),

  // Cached totals — computed from steps on save.
  computedAnnualSavingsUsd: numeric("computed_annual_savings_usd", {
    precision: 14,
    scale: 2,
  }),
  computedQualityValueUsd: numeric("computed_quality_value_usd", {
    precision: 14,
    scale: 2,
  }),
  computedAnnualSavingsHours: numeric("computed_annual_savings_hours", {
    precision: 12,
    scale: 2,
  }),
  computedQualityHours: numeric("computed_quality_hours", {
    precision: 12,
    scale: 2,
  }),

  signedOffByUserId: uuid("signed_off_by_user_id").references(() => users.id),
  signedOffAt: timestamp("signed_off_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const roiSteps = pgTable("roi_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  roiCalculationId: uuid("roi_calculation_id")
    .notNull()
    .references(() => roiCalculations.id, { onDelete: "cascade" }),
  stepOrder: integer("step_order").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  roleCode: text("role_code")
    .notNull()
    .references(() => rolesCatalog.roleCode),
  freqPerYear: numeric("freq_per_year", { precision: 10, scale: 2 }).notNull(),
  baselineHours: numeric("baseline_hours", {
    precision: 10,
    scale: 4,
  }).notNull(),
  newHours: numeric("new_hours", { precision: 10, scale: 4 })
    .notNull()
    .default("0"),
  qualityIncreaseHours: numeric("quality_increase_hours", {
    precision: 10,
    scale: 4,
  })
    .notNull()
    .default("0"),
});
