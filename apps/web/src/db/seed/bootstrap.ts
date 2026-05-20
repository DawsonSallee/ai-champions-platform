/**
 * Production bootstrap seed — reference data only.
 *
 * Run once after the first prod migration. Idempotent. NEVER creates
 * demo projects or test users.
 *
 *   npm run db:bootstrap
 *
 * What this writes:
 *   - App roles (Champion, AITeam, ITSecurity, …)
 *   - Reviewer roles (security, dev_governance, licensing, ai_team)
 *   - Tier review matrix (per the framework, editable in /admin later)
 *   - Roles catalog (for ROI calculator) + initial cost-rate history
 *   - Optional starter business units (override via env BU_LIST)
 *
 * What this does NOT write:
 *   - Users (created on Entra ID first sign-in)
 *   - Reviewer-role holders (assigned in /admin after launch)
 *   - Projects (champions create them through intake)
 *   - Client contracts (added in /admin after launch)
 */
import { db } from "../client";
import {
  appRoles,
  businessUnits,
  costRateHistory,
  reviewerRoles,
  rolesCatalog,
  tierReviewMatrix,
} from "../schema";

async function main() {
  console.log("Bootstrapping reference data…");

  await db
    .insert(appRoles)
    .values([
      { code: "Champion", displayName: "Champion" },
      { code: "AITeam", displayName: "AI Team" },
      { code: "ITSecurity", displayName: "IT Security" },
      { code: "DevGovernance", displayName: "Development Governance" },
      { code: "Licensing", displayName: "Licensing" },
      { code: "ITSupport", displayName: "IT Support" },
      { code: "Admin", displayName: "Admin" },
    ])
    .onConflictDoNothing();

  await db
    .insert(reviewerRoles)
    .values([
      { code: "security", displayName: "Security review" },
      { code: "dev_governance", displayName: "Development governance" },
      { code: "licensing", displayName: "Licensing review" },
      { code: "ai_team", displayName: "AI team review" },
    ])
    .onConflictDoNothing();

  // IT Approval gate + AI Team Review gate — see framework §4.
  await db
    .insert(tierReviewMatrix)
    .values([
      { tier: "1C", reviewerRoleCode: "security", required: true, slaBusinessDays: 3 },
      { tier: "1C", reviewerRoleCode: "dev_governance", required: true, slaBusinessDays: 3 },
      { tier: "2", reviewerRoleCode: "security", required: true, slaBusinessDays: 5 },
      { tier: "2", reviewerRoleCode: "licensing", required: true, slaBusinessDays: 5 },
      { tier: "3", reviewerRoleCode: "security", required: true, slaBusinessDays: 5 },
      { tier: "3", reviewerRoleCode: "dev_governance", required: true, slaBusinessDays: 5 },
      { tier: "3", reviewerRoleCode: "licensing", required: true, slaBusinessDays: 5 },
      { tier: "1B", reviewerRoleCode: "ai_team", required: true, slaBusinessDays: 2 },
      { tier: "1C", reviewerRoleCode: "ai_team", required: true, slaBusinessDays: 2 },
      { tier: "2", reviewerRoleCode: "ai_team", required: true, slaBusinessDays: 2 },
      { tier: "3", reviewerRoleCode: "ai_team", required: true, slaBusinessDays: 2 },
    ])
    .onConflictDoNothing();

  const buList = (process.env.BU_LIST ?? "Corporate")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  await db
    .insert(businessUnits)
    .values(buList.map((code) => ({ code, displayName: code })))
    .onConflictDoNothing();

  // Sample role catalog so the ROI calculator works on day one.
  // Customize via /admin or by editing the catalog in SQL.
  await db
    .insert(rolesCatalog)
    .values([
      { roleCode: "ANALYST_JUNIOR", displayName: "Analyst — Junior" },
      { roleCode: "ANALYST_SENIOR", displayName: "Analyst — Senior" },
      { roleCode: "ENGINEER", displayName: "Engineer" },
      { roleCode: "ENGINEER_SENIOR", displayName: "Engineer — Senior" },
      { roleCode: "PROJECT_MANAGER", displayName: "Project Manager" },
      { roleCode: "MANAGER", displayName: "Manager" },
      { roleCode: "EXECUTIVE", displayName: "Executive" },
      { roleCode: "TECHNICIAN", displayName: "Technician" },
    ])
    .onConflictDoNothing();

  // Starter rates (annual update via /admin or SQL).
  const today = new Date().toISOString().slice(0, 10);
  await db
    .insert(costRateHistory)
    .values([
      { roleCode: "ANALYST_JUNIOR", beginDate: today, hourlyRate: "50.00" },
      { roleCode: "ANALYST_SENIOR", beginDate: today, hourlyRate: "78.00" },
      { roleCode: "ENGINEER", beginDate: today, hourlyRate: "95.00" },
      { roleCode: "ENGINEER_SENIOR", beginDate: today, hourlyRate: "135.00" },
      { roleCode: "PROJECT_MANAGER", beginDate: today, hourlyRate: "100.00" },
      { roleCode: "MANAGER", beginDate: today, hourlyRate: "150.00" },
      { roleCode: "EXECUTIVE", beginDate: today, hourlyRate: "245.00" },
      { roleCode: "TECHNICIAN", beginDate: today, hourlyRate: "48.00" },
    ])
    .onConflictDoNothing();

  console.log("✅ Bootstrap complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
