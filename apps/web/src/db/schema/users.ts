import {
  pgTable,
  text,
  boolean,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const businessUnits = pgTable("business_units", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entraOid: text("entra_oid").unique(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    businessUnitId: uuid("business_unit_id").references(() => businessUnits.id),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
  }),
);

export const appRoles = pgTable("app_roles", {
  code: text("code").primaryKey(),
  displayName: text("display_name").notNull(),
  description: text("description"),
});

export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  roleCode: text("role_code")
    .notNull()
    .references(() => appRoles.code, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
