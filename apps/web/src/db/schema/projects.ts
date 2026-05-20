import {
  pgTable,
  text,
  timestamp,
  uuid,
  date,
  index,
} from "drizzle-orm/pg-core";
import { businessUnits, users } from "./users";
import { complexityTierEnum, projectStatusEnum } from "./enums";

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    intakeTicketId: text("intake_ticket_id"),
    title: text("title").notNull(),
    problemStatement: text("problem_statement"),
    businessUnitId: uuid("business_unit_id")
      .notNull()
      .references(() => businessUnits.id),
    championUserId: uuid("champion_user_id").references(() => users.id),
    processOwnerUserId: uuid("process_owner_user_id").references(() => users.id),
    complexityTier: complexityTierEnum("complexity_tier"),
    status: projectStatusEnum("status").notNull().default("NewIdea"),
    implementationDate: date("implementation_date"),
    summaryPitch: text("summary_pitch"),
    appIconBlobUrl: text("app_icon_blob_url"),
    howToAccess: text("how_to_access"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    statusIdx: index("projects_status_idx").on(t.status),
    tierIdx: index("projects_tier_idx").on(t.complexityTier),
    championIdx: index("projects_champion_idx").on(t.championUserId),
  }),
);

export const projectStatusHistory = pgTable("project_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  fromStatus: projectStatusEnum("from_status"),
  toStatus: projectStatusEnum("to_status").notNull(),
  changedByUserId: uuid("changed_by_user_id").references(() => users.id),
  changedAt: timestamp("changed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  note: text("note"),
});
