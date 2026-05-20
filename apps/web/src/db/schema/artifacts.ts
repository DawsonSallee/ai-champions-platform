import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  date,
} from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { users } from "./users";
import {
  artifactTypeEnum,
  solutionLinkTypeEnum,
  uatPhaseEnum,
  uatResultEnum,
} from "./enums";

export const artifacts = pgTable("artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  type: artifactTypeEnum("type").notNull(),
  blobUrl: text("blob_url").notNull(),
  version: integer("version").notNull().default(1),
  uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const solutionLinks = pgTable("solution_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  linkType: solutionLinkTypeEnum("link_type").notNull(),
  url: text("url").notNull(),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const uatLogEntries = pgTable("uat_log_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  testCaseId: text("test_case_id").notNull(),
  phase: uatPhaseEnum("phase").notNull(),
  scenario: text("scenario").notNull(),
  dataUsed: text("data_used"),
  expected: text("expected").notNull(),
  actual: text("actual"),
  result: uatResultEnum("result"),
  testedByUserId: uuid("tested_by_user_id").references(() => users.id),
  testedAt: date("tested_at"),
});

export const nudgeLog = pgTable("nudge_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  recipients: text("recipients").array().notNull(),
  bodyHtml: text("body_html"),
});
