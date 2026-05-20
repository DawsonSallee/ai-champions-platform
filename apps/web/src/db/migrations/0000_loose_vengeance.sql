CREATE TYPE "public"."approval_status" AS ENUM('Pending', 'Approved', 'ChangesRequested', 'Rejected');--> statement-breakpoint
CREATE TYPE "public"."artifact_type" AS ENUM('PDD', 'TSS', 'UAT', 'Showcase', 'UsageGuide', 'Misc');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'restore', 'transition');--> statement-breakpoint
CREATE TYPE "public"."business_impact" AS ENUM('Low', 'Medium', 'High');--> statement-breakpoint
CREATE TYPE "public"."complexity_tier" AS ENUM('1A', '1B', '1C', '2', '3');--> statement-breakpoint
CREATE TYPE "public"."data_classification" AS ENUM('Public', 'Internal', 'Confidential', 'Restricted');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('NewIdea', 'IntakeSubmitted', 'UnderReview', 'ITApprovalPending', 'ITApproved', 'InProgress', 'AITeamReview', 'Completed', 'Rejected', 'Decommissioned');--> statement-breakpoint
CREATE TYPE "public"."solution_link_type" AS ENUM('github_repo', 'low_code_portal', 'bi_dashboard', 'blob_file', 'other');--> statement-breakpoint
CREATE TYPE "public"."uat_phase" AS ENUM('InternalQA', 'BusinessUAT');--> statement-breakpoint
CREATE TYPE "public"."uat_result" AS ENUM('Pass', 'Fail', 'Blocked');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_roles" (
	"code" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "business_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_units_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"user_id" uuid NOT NULL,
	"role_code" text NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entra_oid" text,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"business_unit_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_entra_oid_unique" UNIQUE("entra_oid")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"from_status" "project_status",
	"to_status" "project_status" NOT NULL,
	"changed_by_user_id" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intake_ticket_id" text,
	"title" text NOT NULL,
	"problem_statement" text,
	"business_unit_id" uuid NOT NULL,
	"champion_user_id" uuid,
	"process_owner_user_id" uuid,
	"complexity_tier" "complexity_tier",
	"status" "project_status" DEFAULT 'NewIdea' NOT NULL,
	"implementation_date" date,
	"summary_pitch" text,
	"app_icon_blob_url" text,
	"how_to_access" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approval_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"approval_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"reviewer_user_id" uuid,
	"reviewer_role_code" text NOT NULL,
	"status" "approval_status" DEFAULT 'Pending' NOT NULL,
	"sla_due_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_name" text NOT NULL,
	"ai_permitted" boolean DEFAULT false NOT NULL,
	"restrictions_md" text,
	"contract_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_contracts_client_name_unique" UNIQUE("client_name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "it_assessments" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"data_classification" "data_classification",
	"data_flow_from" text,
	"data_flow_to" text,
	"records_per_day" integer,
	"tooling_type" text,
	"hosting_location" text,
	"auth_method" text,
	"llm_source" text,
	"llm_training_risk" boolean,
	"vendor_certs_json" jsonb,
	"business_impact" "business_impact",
	"manual_workaround" text,
	"raw_json" jsonb,
	"submitted_at" timestamp with time zone,
	"submitted_by_user_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviewer_roles" (
	"code" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tier_review_matrix" (
	"tier" "complexity_tier" NOT NULL,
	"reviewer_role_code" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"sla_business_days" integer DEFAULT 3 NOT NULL,
	CONSTRAINT "tier_review_matrix_tier_reviewer_role_code_pk" PRIMARY KEY("tier","reviewer_role_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_reviewer_roles" (
	"user_id" uuid NOT NULL,
	"reviewer_role_code" text NOT NULL,
	CONSTRAINT "user_reviewer_roles_user_id_reviewer_role_code_pk" PRIMARY KEY("user_id","reviewer_role_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cost_rate_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_code" text NOT NULL,
	"begin_date" date NOT NULL,
	"hourly_rate" numeric(12, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roi_calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version_label" text NOT NULL,
	"period_start" date NOT NULL,
	"next_review_date" date,
	"superseded_at" date,
	"computed_annual_savings_usd" numeric(14, 2),
	"computed_quality_value_usd" numeric(14, 2),
	"computed_annual_savings_hours" numeric(12, 2),
	"computed_quality_hours" numeric(12, 2),
	"signed_off_by_user_id" uuid,
	"signed_off_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roi_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roi_calculation_id" uuid NOT NULL,
	"step_order" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"role_code" text NOT NULL,
	"freq_per_year" numeric(10, 2) NOT NULL,
	"baseline_hours" numeric(10, 4) NOT NULL,
	"new_hours" numeric(10, 4) DEFAULT '0' NOT NULL,
	"quality_increase_hours" numeric(10, 4) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles_catalog" (
	"role_code" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"active" text DEFAULT 'true' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "artifact_type" NOT NULL,
	"blob_url" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"uploaded_by_user_id" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nudge_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recipients" text[] NOT NULL,
	"body_html" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "solution_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"link_type" "solution_link_type" NOT NULL,
	"url" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uat_log_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"test_case_id" text NOT NULL,
	"phase" "uat_phase" NOT NULL,
	"scenario" text NOT NULL,
	"data_used" text,
	"expected" text NOT NULL,
	"actual" text,
	"result" "uat_result",
	"tested_by_user_id" uuid,
	"tested_at" date
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" "audit_action" NOT NULL,
	"before_json" jsonb,
	"after_json" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_code_app_roles_code_fk" FOREIGN KEY ("role_code") REFERENCES "public"."app_roles"("code") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_status_history" ADD CONSTRAINT "project_status_history_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_status_history" ADD CONSTRAINT "project_status_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_units"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_champion_user_id_users_id_fk" FOREIGN KEY ("champion_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_process_owner_user_id_users_id_fk" FOREIGN KEY ("process_owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approval_comments" ADD CONSTRAINT "approval_comments_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approval_comments" ADD CONSTRAINT "approval_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approvals" ADD CONSTRAINT "approvals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approvals" ADD CONSTRAINT "approvals_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approvals" ADD CONSTRAINT "approvals_reviewer_role_code_reviewer_roles_code_fk" FOREIGN KEY ("reviewer_role_code") REFERENCES "public"."reviewer_roles"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "it_assessments" ADD CONSTRAINT "it_assessments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "it_assessments" ADD CONSTRAINT "it_assessments_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tier_review_matrix" ADD CONSTRAINT "tier_review_matrix_reviewer_role_code_reviewer_roles_code_fk" FOREIGN KEY ("reviewer_role_code") REFERENCES "public"."reviewer_roles"("code") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_reviewer_roles" ADD CONSTRAINT "user_reviewer_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_reviewer_roles" ADD CONSTRAINT "user_reviewer_roles_reviewer_role_code_reviewer_roles_code_fk" FOREIGN KEY ("reviewer_role_code") REFERENCES "public"."reviewer_roles"("code") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cost_rate_history" ADD CONSTRAINT "cost_rate_history_role_code_roles_catalog_role_code_fk" FOREIGN KEY ("role_code") REFERENCES "public"."roles_catalog"("role_code") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roi_calculations" ADD CONSTRAINT "roi_calculations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roi_calculations" ADD CONSTRAINT "roi_calculations_signed_off_by_user_id_users_id_fk" FOREIGN KEY ("signed_off_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roi_steps" ADD CONSTRAINT "roi_steps_roi_calculation_id_roi_calculations_id_fk" FOREIGN KEY ("roi_calculation_id") REFERENCES "public"."roi_calculations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roi_steps" ADD CONSTRAINT "roi_steps_role_code_roles_catalog_role_code_fk" FOREIGN KEY ("role_code") REFERENCES "public"."roles_catalog"("role_code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nudge_log" ADD CONSTRAINT "nudge_log_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "solution_links" ADD CONSTRAINT "solution_links_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "uat_log_entries" ADD CONSTRAINT "uat_log_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "uat_log_entries" ADD CONSTRAINT "uat_log_entries_tested_by_user_id_users_id_fk" FOREIGN KEY ("tested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_tier_idx" ON "projects" USING btree ("complexity_tier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_champion_idx" ON "projects" USING btree ("champion_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_rate_role_begin_idx" ON "cost_rate_history" USING btree ("role_code","begin_date");