/**
 * Rich demo seed for local development.
 *
 * Idempotent on `intake_ticket_id` (every demo project carries one
 * starting with "DEMO-"). Re-running cleans the demo set and rebuilds
 * it. Reference data (business units, roles, reviewer matrix) is
 * preserved across runs via onConflictDoNothing.
 *
 *   npm run db:seed
 */
import { db } from "../client";
import {
  appRoles,
  approvals,
  approvalComments,
  artifacts,
  auditEvents,
  businessUnits,
  clientContracts,
  costRateHistory,
  itAssessments,
  nudgeLog,
  projects,
  projectStatusHistory,
  reviewerRoles,
  rolesCatalog,
  roiCalculations,
  roiSteps,
  solutionLinks,
  tierReviewMatrix,
  uatLogEntries,
  userReviewerRoles,
  userRoles,
  users,
} from "../schema";
import { sql, eq, like } from "drizzle-orm";
import { computeRoi } from "../../domains/roi/engine";

type Tier = "1A" | "1B" | "1C" | "2" | "3";
type Status =
  | "NewIdea"
  | "IntakeSubmitted"
  | "UnderReview"
  | "ITApprovalPending"
  | "ITApproved"
  | "InProgress"
  | "AITeamReview"
  | "Completed"
  | "Rejected"
  | "Decommissioned";

async function main() {
  console.log("Seeding…");

  // ─── Reference: app roles ───────────────────────────────────────────────
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

  // ─── Reference: reviewer roles ──────────────────────────────────────────
  await db
    .insert(reviewerRoles)
    .values([
      { code: "security", displayName: "Security review" },
      { code: "dev_governance", displayName: "Development governance" },
      { code: "licensing", displayName: "Licensing review" },
      { code: "ai_team", displayName: "AI team review" },
    ])
    .onConflictDoNothing();

  // ─── Reference: tier review matrix ──────────────────────────────────────
  await db
    .insert(tierReviewMatrix)
    .values([
      // IT Approval gate (pre-build) — varies by tier
      { tier: "1C", reviewerRoleCode: "security", required: true, slaBusinessDays: 3 },
      { tier: "1C", reviewerRoleCode: "dev_governance", required: true, slaBusinessDays: 3 },
      { tier: "2", reviewerRoleCode: "security", required: true, slaBusinessDays: 5 },
      { tier: "2", reviewerRoleCode: "licensing", required: true, slaBusinessDays: 5 },
      { tier: "3", reviewerRoleCode: "security", required: true, slaBusinessDays: 5 },
      { tier: "3", reviewerRoleCode: "dev_governance", required: true, slaBusinessDays: 5 },
      { tier: "3", reviewerRoleCode: "licensing", required: true, slaBusinessDays: 5 },
      // AI Team Review gate (post-build) — required for every tier except 1A
      { tier: "1B", reviewerRoleCode: "ai_team", required: true, slaBusinessDays: 2 },
      { tier: "1C", reviewerRoleCode: "ai_team", required: true, slaBusinessDays: 2 },
      { tier: "2", reviewerRoleCode: "ai_team", required: true, slaBusinessDays: 2 },
      { tier: "3", reviewerRoleCode: "ai_team", required: true, slaBusinessDays: 2 },
    ])
    .onConflictDoNothing();

  // ─── Reference: business units ──────────────────────────────────────────
  await db
    .insert(businessUnits)
    .values([
      { code: "Engineering", displayName: "Engineering" },
      { code: "Finance", displayName: "Finance" },
      { code: "HR", displayName: "Human Resources" },
      { code: "Operations", displayName: "Operations" },
      { code: "Sales", displayName: "Sales & Marketing" },
      { code: "IT", displayName: "Information Technology" },
      { code: "Corp", displayName: "Corporate Services" },
    ])
    .onConflictDoNothing();

  const bus = await db.select().from(businessUnits);
  const findBu = (c: string) => bus.find((b) => b.code === c)!.id;

  // ─── Reference: client contracts ────────────────────────────────────────
  await db
    .insert(clientContracts)
    .values([
      {
        clientName: "Northwind Utilities",
        aiPermitted: true,
        restrictionsMd:
          "AI usage permitted for internal productivity. No client data may be sent to public model endpoints (OpenAI public, etc.). Azure OpenAI in private deployment is acceptable.",
        contractUrl: "https://example.test/contracts/northwind.pdf",
      },
      {
        clientName: "Contoso Energy",
        aiPermitted: false,
        restrictionsMd:
          "Contract prohibits AI processing of any client deliverables. Manual review required for any tool touching Contoso project files.",
        contractUrl: "https://example.test/contracts/contoso.pdf",
      },
      {
        clientName: "Fabrikam Power",
        aiPermitted: true,
        restrictionsMd:
          "AI permitted with watermarking on all generated artifacts. Document AI usage in quarterly summary.",
        contractUrl: "https://example.test/contracts/fabrikam.pdf",
      },
    ])
    .onConflictDoNothing();

  // ─── Users + role assignments ───────────────────────────────────────────
  const usersSeed: Array<{
    email: string;
    displayName: string;
    buCode: string;
    appRoles: string[];
    reviewerRoles?: string[];
  }> = [
    // Champions across business units
    { email: "ada.lovelace@example.test", displayName: "Ada Lovelace", buCode: "Engineering", appRoles: ["Champion"] },
    { email: "linus.torvalds@example.test", displayName: "Linus Torvalds", buCode: "IT", appRoles: ["Champion"] },
    { email: "grace.hopper@example.test", displayName: "Grace Hopper", buCode: "Finance", appRoles: ["Champion"] },
    { email: "margaret.hamilton@example.test", displayName: "Margaret Hamilton", buCode: "Operations", appRoles: ["Champion"] },
    { email: "katherine.johnson@example.test", displayName: "Katherine Johnson", buCode: "HR", appRoles: ["Champion"] },
    { email: "john.backus@example.test", displayName: "John Backus", buCode: "Sales", appRoles: ["Champion"] },
    { email: "alan.kay@example.test", displayName: "Alan Kay", buCode: "Engineering", appRoles: ["Champion"] },
    { email: "donald.knuth@example.test", displayName: "Donald Knuth", buCode: "IT", appRoles: ["Champion", "ITSupport"] },

    // Process owners (business stakeholders)
    { email: "niklaus.wirth@example.test", displayName: "Niklaus Wirth", buCode: "Finance", appRoles: ["Champion"] },
    { email: "barbara.liskov.bu@example.test", displayName: "Barbara Liskov", buCode: "HR", appRoles: ["Champion"] },

    // Reviewers (IT side)
    {
      email: "alan.turing@example.test",
      displayName: "Alan Turing",
      buCode: "Corp",
      appRoles: ["ITSecurity"],
      reviewerRoles: ["security"],
    },
    {
      email: "edsger.dijkstra@example.test",
      displayName: "Edsger Dijkstra",
      buCode: "Corp",
      appRoles: ["DevGovernance"],
      reviewerRoles: ["dev_governance"],
    },
    {
      email: "barbara.liskov@example.test",
      displayName: "Barbara Liskov (Licensing)",
      buCode: "Corp",
      appRoles: ["Licensing"],
      reviewerRoles: ["licensing"],
    },

    // AI team / Admin
    {
      email: "tim.berners-lee@example.test",
      displayName: "Tim Berners-Lee",
      buCode: "Corp",
      appRoles: ["AITeam", "Admin"],
      reviewerRoles: ["ai_team"],
    },
    { email: "team@example.test", displayName: "AI Team Lead", buCode: "Corp", appRoles: ["AITeam", "Admin"], reviewerRoles: ["ai_team"] },
  ];

  await db
    .insert(users)
    .values(
      usersSeed.map((u) => ({
        email: u.email,
        displayName: u.displayName,
        businessUnitId: findBu(u.buCode),
        active: true,
      })),
    )
    .onConflictDoNothing();

  const allUsers = await db.select().from(users);
  const userByEmail = new Map(allUsers.map((u) => [u.email, u]));

  for (const u of usersSeed) {
    const dbUser = userByEmail.get(u.email);
    if (!dbUser) continue;
    for (const r of u.appRoles) {
      await db.insert(userRoles).values({ userId: dbUser.id, roleCode: r }).onConflictDoNothing();
    }
    for (const r of u.reviewerRoles ?? []) {
      await db
        .insert(userReviewerRoles)
        .values({ userId: dbUser.id, reviewerRoleCode: r })
        .onConflictDoNothing();
    }
  }

  // ─── Reference: roles catalog + multi-year cost rates ───────────────────
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

  // Four years of historical rates so the date-aware lookup is exercised.
  const rateEpochs: Record<string, Array<[string, string]>> = {
    ANALYST_JUNIOR: [["2023-01-01", "42.00"], ["2024-01-01", "45.00"], ["2025-01-01", "48.00"], ["2026-01-01", "50.00"]],
    ANALYST_SENIOR: [["2023-01-01", "65.00"], ["2024-01-01", "70.00"], ["2025-01-01", "75.00"], ["2026-01-01", "78.00"]],
    ENGINEER: [["2023-01-01", "78.00"], ["2024-01-01", "85.00"], ["2025-01-01", "90.00"], ["2026-01-01", "95.00"]],
    ENGINEER_SENIOR: [["2023-01-01", "105.00"], ["2024-01-01", "115.00"], ["2025-01-01", "125.00"], ["2026-01-01", "135.00"]],
    PROJECT_MANAGER: [["2023-01-01", "85.00"], ["2024-01-01", "92.00"], ["2025-01-01", "97.00"], ["2026-01-01", "100.00"]],
    MANAGER: [["2023-01-01", "120.00"], ["2024-01-01", "130.00"], ["2025-01-01", "140.00"], ["2026-01-01", "150.00"]],
    EXECUTIVE: [["2023-01-01", "200.00"], ["2024-01-01", "215.00"], ["2025-01-01", "230.00"], ["2026-01-01", "245.00"]],
    TECHNICIAN: [["2023-01-01", "38.00"], ["2024-01-01", "42.00"], ["2025-01-01", "45.00"], ["2026-01-01", "48.00"]],
  };
  for (const [role, rates] of Object.entries(rateEpochs)) {
    for (const [beginDate, rate] of rates) {
      await db
        .insert(costRateHistory)
        .values({ roleCode: role, beginDate, hourlyRate: rate })
        .onConflictDoNothing();
    }
  }

  // ─── Clean the prior demo project set (idempotency) ─────────────────────
  await db.execute(sql`delete from projects where intake_ticket_id like 'DEMO-%'`);
  // Clean orphaned audit events from prior demo runs (entity_id refers to projects that no longer exist).
  await db.execute(
    sql`delete from audit_events where entity_type = 'project' and entity_id::uuid not in (select id from projects)`,
  );

  // ─── Project definitions ────────────────────────────────────────────────
  const u = (email: string) => userByEmail.get(email)!.id;

  type StepDef = {
    name: string;
    role: string;
    freq: number;
    base: number;
    neu: number;
    q: number;
  };
  type ProjectDef = {
    ticket: string;
    title: string;
    problem: string;
    summary: string;
    bu: string;
    tier: Tier;
    status: Status;
    champion: string;
    processOwner?: string;
    implementationDate?: string;
    /** Drives multi-version ROI history if more than one. */
    steps?: StepDef[];
    // Snapshot prior years too — produces a multi-version ROI history.
    historicalReviewDates?: string[];
    itAssessment?: Partial<typeof itAssessments.$inferInsert>;
    approvals?: Array<{
      role: "security" | "dev_governance" | "licensing" | "ai_team";
      reviewerEmail: string;
      status?: "Pending" | "Approved" | "ChangesRequested" | "Rejected";
      slaOffsetBizDays?: number;
      comment?: string;
    }>;
    uat?: Array<{
      id: string;
      phase: "InternalQA" | "BusinessUAT";
      scenario: string;
      expected: string;
      actual?: string;
      result: "Pass" | "Fail" | "Blocked";
    }>;
    links?: Array<{
      type: "github_repo" | "low_code_portal" | "bi_dashboard" | "blob_file" | "other";
      url: string;
      label: string;
    }>;
    artifacts?: Array<{ type: "PDD" | "TSS" | "UAT" | "Showcase" | "UsageGuide" | "Misc"; label: string }>;
    statusTrail?: Array<{ from: Status | null; to: Status; daysAgo: number; note?: string }>;
    nudgesSent?: number;
    howToAccess?: string;
  };

  const projDefs: ProjectDef[] = [
    // ──── TIER 1A ────────────────────────────────────────────────────────
    {
      ticket: "DEMO-1A-001",
      title: "Sales Copilot summaries",
      problem:
        "Sales team uses standard Microsoft Copilot to summarize call notes into the CRM. No customization, no automation.",
      summary:
        "Sales reps use Copilot in Word/Outlook to draft account summaries — pure self-service productivity.",
      bu: "Sales",
      tier: "1A",
      status: "Completed",
      champion: "john.backus@example.test",
      implementationDate: "2026-01-15",
      howToAccess: "Built-in to Copilot for M365. Contact IT for a license.",
    },

    // ──── TIER 1B ────────────────────────────────────────────────────────
    {
      ticket: "DEMO-1B-001",
      title: "Engineering weekly status digest",
      problem:
        "Engineering managers spend 4 hours per week manually consolidating project status from individual emails into a digest. The bot now pulls Teams channel messages, summarizes per project, and emails a single digest every Friday.",
      summary:
        "Automated weekly digest replacing manual consolidation of engineering status updates.",
      bu: "Engineering",
      tier: "1B",
      status: "Completed",
      champion: "ada.lovelace@example.test",
      processOwner: "alan.kay@example.test",
      implementationDate: "2025-08-01",
      steps: [
        { name: "Pull Teams messages", role: "ENGINEER", freq: 52, base: 1.0, neu: 0.05, q: 0.1 },
        { name: "Aggregate per project", role: "ENGINEER", freq: 52, base: 2.5, neu: 0.1, q: 0.3 },
        { name: "Draft narrative", role: "ANALYST_SENIOR", freq: 52, base: 0.5, neu: 0.1, q: 0.05 },
      ],
      historicalReviewDates: ["2026-02-01"],
      approvals: [
        { role: "ai_team", reviewerEmail: "tim.berners-lee@example.test", status: "Approved", comment: "Clean implementation. Approved." },
      ],
      uat: [
        { id: "UAT-001", phase: "InternalQA", scenario: "Ideal path: 5 active projects with weekly updates", expected: "Digest sent with all 5", actual: "Digest sent with all 5", result: "Pass" },
        { id: "UAT-002", phase: "InternalQA", scenario: "Empty week — no updates in any channel", expected: "Skip send, log to audit", actual: "Skipped and logged", result: "Pass" },
        { id: "UAT-003", phase: "BusinessUAT", scenario: "Verify summaries match what manager would write", expected: "Manager confirms accuracy ≥90%", actual: "Manager confirmed 94% accuracy on 20 samples", result: "Pass" },
      ],
      links: [
        { type: "low_code_portal", url: "https://make.powerautomate.com/flows/abc-123", label: "Power Automate flow" },
        { type: "bi_dashboard", url: "https://app.powerbi.com/groups/me/reports/eng-digest", label: "Digest stats dashboard" },
      ],
      artifacts: [
        { type: "PDD", label: "Process Design Document v2" },
        { type: "UAT", label: "UAT log" },
        { type: "Showcase", label: "Solution showcase" },
        { type: "UsageGuide", label: "End-user usage guide" },
      ],
      statusTrail: [
        { from: null, to: "NewIdea", daysAgo: 220 },
        { from: "NewIdea", to: "IntakeSubmitted", daysAgo: 215 },
        { from: "IntakeSubmitted", to: "InProgress", daysAgo: 210 },
        { from: "InProgress", to: "AITeamReview", daysAgo: 195 },
        { from: "AITeamReview", to: "Completed", daysAgo: 190, note: "Live as of August 1." },
      ],
    },
    {
      ticket: "DEMO-1B-002",
      title: "Meeting notes generator (Copilot Studio)",
      problem:
        "Customer-facing teams want auto-generated meeting recaps from Teams transcripts emailed to attendees within 5 minutes of meeting end.",
      summary: "Copilot Studio bot turns Teams transcripts into recap emails.",
      bu: "Sales",
      tier: "1B",
      status: "Completed",
      champion: "john.backus@example.test",
      processOwner: "katherine.johnson@example.test",
      implementationDate: "2025-11-15",
      steps: [
        { name: "Detect meeting end", role: "ENGINEER", freq: 600, base: 0.05, neu: 0, q: 0 },
        { name: "Generate recap", role: "ANALYST_SENIOR", freq: 600, base: 0.4, neu: 0.02, q: 0.05 },
        { name: "Email attendees", role: "ANALYST_JUNIOR", freq: 600, base: 0.1, neu: 0, q: 0.02 },
      ],
      historicalReviewDates: ["2026-03-15"],
      approvals: [
        { role: "ai_team", reviewerEmail: "tim.berners-lee@example.test", status: "Approved" },
      ],
      links: [
        { type: "low_code_portal", url: "https://copilotstudio.microsoft.com/bot/recap-bot", label: "Copilot Studio bot" },
      ],
      artifacts: [{ type: "Showcase", label: "Solution showcase" }],
    },
    {
      ticket: "DEMO-1B-003",
      title: "Forms-to-Teams routing for facility requests",
      problem:
        "Facility issues come in via Microsoft Forms and sit in a SharePoint list. Ops team only checks it sporadically. Power Automate now pings the on-call channel with severity-tagged cards.",
      summary: "Form submissions auto-routed to Teams with severity-coloured cards.",
      bu: "Operations",
      tier: "1B",
      status: "InProgress",
      champion: "margaret.hamilton@example.test",
      processOwner: "donald.knuth@example.test",
      steps: [
        { name: "Read form submission", role: "TECHNICIAN", freq: 250, base: 0.25, neu: 0.05, q: 0.05 },
        { name: "Classify severity", role: "ANALYST_JUNIOR", freq: 250, base: 0.15, neu: 0.02, q: 0.05 },
      ],
      links: [{ type: "low_code_portal", url: "https://make.powerautomate.com/flows/facility-route", label: "Power Automate flow" }],
      statusTrail: [
        { from: null, to: "NewIdea", daysAgo: 35 },
        { from: "NewIdea", to: "IntakeSubmitted", daysAgo: 32 },
        { from: "IntakeSubmitted", to: "InProgress", daysAgo: 28 },
      ],
      nudgesSent: 3,
    },
    {
      ticket: "DEMO-1B-004",
      title: "Office Scripts: invoice register cleanup",
      problem:
        "Monthly invoice register from the legacy ERP arrives as a messy Excel. Office Scripts (TypeScript) now normalizes columns, fills blanks, and emits a clean Excel sheet for AP.",
      summary: "TypeScript-based Excel automation, no external connectors.",
      bu: "Finance",
      tier: "1B",
      status: "AITeamReview",
      champion: "grace.hopper@example.test",
      processOwner: "niklaus.wirth@example.test",
      steps: [
        { name: "Normalize columns", role: "ANALYST_SENIOR", freq: 12, base: 1.0, neu: 0.05, q: 0.1 },
        { name: "Fill missing values", role: "ANALYST_SENIOR", freq: 12, base: 1.5, neu: 0.1, q: 0.15 },
        { name: "Emit clean sheet", role: "ANALYST_JUNIOR", freq: 12, base: 0.5, neu: 0.05, q: 0.05 },
      ],
      approvals: [
        { role: "ai_team", reviewerEmail: "team@example.test", status: "Pending", slaOffsetBizDays: 1 },
      ],
      statusTrail: [
        { from: null, to: "NewIdea", daysAgo: 60 },
        { from: "NewIdea", to: "IntakeSubmitted", daysAgo: 55 },
        { from: "IntakeSubmitted", to: "InProgress", daysAgo: 50 },
        { from: "InProgress", to: "AITeamReview", daysAgo: 3, note: "Build complete; awaiting AI team review." },
      ],
      nudgesSent: 1,
    },

    // ──── TIER 1C ────────────────────────────────────────────────────────
    {
      ticket: "DEMO-1C-001",
      title: "Power BI refresh-failure auto-diagnoser",
      problem:
        "Power BI scheduled refreshes fail weekly. An analyst spends ~2 hours diagnosing and fixing. A Power App + Power Automate flow now reads the refresh log, classifies the failure, and proposes (or auto-applies) a fix.",
      summary:
        "Power App diagnoses Power BI refresh failures and auto-applies known fixes.",
      bu: "IT",
      tier: "1C",
      status: "Completed",
      champion: "donald.knuth@example.test",
      processOwner: "linus.torvalds@example.test",
      implementationDate: "2025-09-01",
      itAssessment: {
        dataClassification: "Internal",
        dataFlowFrom: "Power BI service",
        dataFlowTo: "Power BI service",
        hostingLocation: "Power Platform tenant",
        authMethod: "Entra ID service principal",
        llmSource: "none",
        llmTrainingRisk: false,
        businessImpact: "Medium",
        manualWorkaround: "Analyst manually re-runs failed dataset refreshes from the workspace.",
      },
      steps: [
        { name: "Pull refresh log", role: "ANALYST_SENIOR", freq: 52, base: 0.5, neu: 0.05, q: 0.05 },
        { name: "Classify failure", role: "ANALYST_SENIOR", freq: 52, base: 1.0, neu: 0.1, q: 0.2 },
        { name: "Apply known fix", role: "ENGINEER", freq: 35, base: 1.5, neu: 0.05, q: 0.3 },
      ],
      historicalReviewDates: ["2026-03-01"],
      approvals: [
        { role: "security", reviewerEmail: "alan.turing@example.test", status: "Approved", comment: "Service principal scope reviewed. OK." },
        { role: "dev_governance", reviewerEmail: "edsger.dijkstra@example.test", status: "Approved", comment: "Power App standards met." },
      ],
      uat: [
        { id: "UAT-001", phase: "InternalQA", scenario: "Refresh fails on credentials — auto-rotate from KV", expected: "Refresh re-runs successfully", actual: "Refresh re-runs successfully", result: "Pass" },
        { id: "UAT-002", phase: "InternalQA", scenario: "Unknown failure pattern — escalate to analyst", expected: "Email sent to analyst with diagnostic", actual: "Email sent", result: "Pass" },
      ],
      links: [
        { type: "low_code_portal", url: "https://make.powerapps.com/apps/bi-refresh-app", label: "Power App" },
        { type: "low_code_portal", url: "https://make.powerautomate.com/flows/bi-diagnoser", label: "Diagnoser flow" },
      ],
      artifacts: [
        { type: "PDD", label: "PDD v1" },
        { type: "TSS", label: "Technical solution spec" },
        { type: "Showcase", label: "Solution showcase" },
      ],
    },
    {
      ticket: "DEMO-1C-002",
      title: "AI Builder invoice classification",
      problem:
        "AP team manually classifies ~200 invoices/week into 12 GL categories. AI Builder form-processing model + Power Automate now pre-classifies; analyst confirms in 30 seconds.",
      summary: "AI Builder pre-classifies invoices; analyst confirms.",
      bu: "Finance",
      tier: "1C",
      status: "ITApprovalPending",
      champion: "grace.hopper@example.test",
      processOwner: "niklaus.wirth@example.test",
      itAssessment: {
        dataClassification: "Confidential",
        dataFlowFrom: "AP shared mailbox",
        dataFlowTo: "AI Builder + SharePoint list",
        hostingLocation: "Power Platform tenant",
        authMethod: "Entra ID service principal",
        llmSource: "AI Builder (Microsoft-hosted)",
        llmTrainingRisk: false,
        businessImpact: "Medium",
        manualWorkaround: "AP team continues to classify manually if AI Builder is down.",
      },
      approvals: [
        { role: "security", reviewerEmail: "alan.turing@example.test", status: "Approved", comment: "AI Builder data residency confirmed in-region." },
        { role: "dev_governance", reviewerEmail: "edsger.dijkstra@example.test", status: "Pending", slaOffsetBizDays: 1 },
      ],
      statusTrail: [
        { from: null, to: "NewIdea", daysAgo: 14 },
        { from: "NewIdea", to: "IntakeSubmitted", daysAgo: 10 },
        { from: "IntakeSubmitted", to: "ITApprovalPending", daysAgo: 9 },
      ],
      nudgesSent: 1,
    },
    {
      ticket: "DEMO-1C-003",
      title: "Power App for engineering change requests",
      problem:
        "Engineering change requests fly around as email PDFs with no audit trail. A Power App now captures them with workflow approvals tracked in Dataverse.",
      summary: "Power App + Dataverse replacing email-based change requests.",
      bu: "Engineering",
      tier: "1C",
      status: "InProgress",
      champion: "ada.lovelace@example.test",
      processOwner: "alan.kay@example.test",
      itAssessment: {
        dataClassification: "Internal",
        dataFlowFrom: "Engineering managers",
        dataFlowTo: "Dataverse",
        hostingLocation: "Power Platform tenant",
        authMethod: "Entra ID",
        llmSource: "none",
        llmTrainingRisk: false,
        businessImpact: "Low",
        manualWorkaround: "Continue with email-based ECR.",
      },
      steps: [
        { name: "Submit ECR via app", role: "ENGINEER", freq: 300, base: 0.5, neu: 0.1, q: 0.05 },
        { name: "Manager approval", role: "MANAGER", freq: 300, base: 0.25, neu: 0.05, q: 0.05 },
      ],
      approvals: [
        { role: "security", reviewerEmail: "alan.turing@example.test", status: "Approved" },
        { role: "dev_governance", reviewerEmail: "edsger.dijkstra@example.test", status: "Approved", comment: "Dataverse model reviewed." },
      ],
      links: [{ type: "low_code_portal", url: "https://make.powerapps.com/apps/ecr-app", label: "Power App" }],
      statusTrail: [
        { from: null, to: "NewIdea", daysAgo: 45 },
        { from: "NewIdea", to: "IntakeSubmitted", daysAgo: 42 },
        { from: "IntakeSubmitted", to: "ITApprovalPending", daysAgo: 41 },
        { from: "ITApprovalPending", to: "ITApproved", daysAgo: 35 },
        { from: "ITApproved", to: "InProgress", daysAgo: 34 },
      ],
      nudgesSent: 4,
    },

    // ──── TIER 2 ─────────────────────────────────────────────────────────
    {
      ticket: "DEMO-2-001",
      title: "Invoice intake bot (Python + Azure OpenAI)",
      problem:
        "AP team manually keys 200+ invoices/week from supplier emails into the ERP. Python bot extracts fields via Azure OpenAI and posts via the ERP REST API. Edge cases route back to AP for review.",
      summary: "Python + Azure OpenAI extracts invoice fields; ERP REST posts.",
      bu: "Finance",
      tier: "2",
      status: "InProgress",
      champion: "grace.hopper@example.test",
      processOwner: "niklaus.wirth@example.test",
      itAssessment: {
        dataClassification: "Confidential",
        dataFlowFrom: "AP shared mailbox",
        dataFlowTo: "ERP REST API",
        recordsPerDay: 40,
        toolingType: "Custom Python service",
        hostingLocation: "Azure Container Apps",
        authMethod: "Managed identity → Key Vault",
        llmSource: "Azure OpenAI (private deployment)",
        llmTrainingRisk: false,
        businessImpact: "High",
        manualWorkaround: "AP team keys invoices manually (the current state).",
      },
      steps: [
        { name: "Watch shared mailbox", role: "ENGINEER", freq: 10000, base: 0.05, neu: 0, q: 0.02 },
        { name: "Extract fields via LLM", role: "ENGINEER_SENIOR", freq: 10000, base: 0.25, neu: 0.02, q: 0.1 },
        { name: "Validate & post to ERP", role: "ANALYST_SENIOR", freq: 10000, base: 0.15, neu: 0.01, q: 0.05 },
        { name: "Edge-case review", role: "ANALYST_SENIOR", freq: 500, base: 0.4, neu: 0.2, q: 0.1 },
      ],
      approvals: [
        { role: "security", reviewerEmail: "alan.turing@example.test", status: "Approved", comment: "Private Azure OpenAI deployment. Key Vault access scoped to MI." },
        { role: "licensing", reviewerEmail: "barbara.liskov@example.test", status: "Approved", comment: "Token budget approved at ~$120/mo." },
      ],
      uat: [
        { id: "UAT-001", phase: "InternalQA", scenario: "Standard PDF invoice with all fields", expected: "Posted to ERP", actual: "Posted", result: "Pass" },
        { id: "UAT-002", phase: "InternalQA", scenario: "Invoice missing invoice number", expected: "Route to edge-case queue", actual: "Routed", result: "Pass" },
        { id: "UAT-003", phase: "InternalQA", scenario: "Invoice >$10k", expected: "Flag for manager approval", actual: "Flagged", result: "Pass" },
        { id: "UAT-004", phase: "BusinessUAT", scenario: "AP team runs 50 real invoices through it", expected: "≥95% straight-through", actual: "97% straight-through", result: "Pass" },
      ],
      links: [
        { type: "github_repo", url: "https://github.com/example/invoice-intake-bot", label: "Source repository" },
        { type: "bi_dashboard", url: "https://app.powerbi.com/reports/invoice-intake-stats", label: "Throughput dashboard" },
      ],
      artifacts: [
        { type: "PDD", label: "PDD v2" },
        { type: "TSS", label: "TSS" },
        { type: "UAT", label: "UAT log" },
      ],
      statusTrail: [
        { from: null, to: "NewIdea", daysAgo: 90 },
        { from: "NewIdea", to: "IntakeSubmitted", daysAgo: 85 },
        { from: "IntakeSubmitted", to: "ITApprovalPending", daysAgo: 84 },
        { from: "ITApprovalPending", to: "ITApproved", daysAgo: 77 },
        { from: "ITApproved", to: "InProgress", daysAgo: 76 },
      ],
      nudgesSent: 8,
    },
    {
      ticket: "DEMO-2-002",
      title: "Engineering drawing OCR (Azure Form Recognizer)",
      problem:
        "Legacy engineering drawings (PDF/TIFF) need title-block fields extracted into the asset management system. Azure Form Recognizer + a small Python orchestrator now does this in minutes per drawing instead of hours.",
      summary: "Form Recognizer reads drawing title blocks; metadata pushed to asset system.",
      bu: "Engineering",
      tier: "2",
      status: "Completed",
      champion: "ada.lovelace@example.test",
      processOwner: "alan.kay@example.test",
      implementationDate: "2025-05-01",
      itAssessment: {
        dataClassification: "Internal",
        dataFlowFrom: "Drawing repository (network share)",
        dataFlowTo: "Asset management system",
        recordsPerDay: 200,
        toolingType: "Python orchestrator + Azure Form Recognizer",
        hostingLocation: "Azure Container Apps",
        authMethod: "Managed identity",
        llmSource: "Azure Form Recognizer (pre-trained, no LLM)",
        llmTrainingRisk: false,
        businessImpact: "Medium",
        manualWorkaround: "Engineering admin re-keys title blocks manually (3 FTE).",
      },
      steps: [
        { name: "Detect new drawings", role: "TECHNICIAN", freq: 50000, base: 0.05, neu: 0, q: 0.01 },
        { name: "OCR title block", role: "ENGINEER", freq: 50000, base: 0.5, neu: 0.02, q: 0.1 },
        { name: "Validate against existing", role: "ENGINEER", freq: 50000, base: 0.15, neu: 0.05, q: 0.05 },
      ],
      // Two-year history demonstrates the ledger string + leaderboard.
      historicalReviewDates: ["2025-05-01", "2026-05-01"],
      approvals: [
        { role: "security", reviewerEmail: "alan.turing@example.test", status: "Approved" },
        { role: "licensing", reviewerEmail: "barbara.liskov@example.test", status: "Approved" },
      ],
      uat: [
        { id: "UAT-001", phase: "InternalQA", scenario: "Modern CAD drawing PDF", expected: "Title block parsed", actual: "Parsed (98% confidence)", result: "Pass" },
        { id: "UAT-002", phase: "InternalQA", scenario: "Scanned legacy drawing (low contrast)", expected: "Either parsed or routed to admin", actual: "Routed to admin queue", result: "Pass" },
      ],
      links: [
        { type: "github_repo", url: "https://github.com/example/drawing-ocr", label: "Source repository" },
      ],
      artifacts: [
        { type: "Showcase", label: "Solution showcase" },
        { type: "UsageGuide", label: "Engineering admin guide" },
      ],
    },
    {
      ticket: "DEMO-2-003",
      title: "n8n workflow for vendor onboarding",
      problem:
        "Vendor onboarding spans 6 systems and 14 manual steps. n8n now orchestrates the data flow end-to-end with human-in-the-loop checkpoints.",
      summary: "n8n external-tool orchestration of vendor onboarding.",
      bu: "Operations",
      tier: "2",
      status: "ITApprovalPending",
      champion: "margaret.hamilton@example.test",
      processOwner: "donald.knuth@example.test",
      itAssessment: {
        dataClassification: "Confidential",
        dataFlowFrom: "ERP, vendor portal, SharePoint",
        dataFlowTo: "ERP, vendor portal, finance system",
        recordsPerDay: 5,
        toolingType: "n8n self-hosted",
        hostingLocation: "On-premise VM",
        authMethod: "Vault-stored API keys",
        llmSource: "none",
        llmTrainingRisk: false,
        businessImpact: "High",
        manualWorkaround: "Continue 14-step manual process.",
      },
      approvals: [
        { role: "security", reviewerEmail: "alan.turing@example.test", status: "Pending", slaOffsetBizDays: -2, comment: "Need clarification on credential storage." },
        { role: "licensing", reviewerEmail: "barbara.liskov@example.test", status: "Pending", slaOffsetBizDays: -1 },
      ],
      statusTrail: [
        { from: null, to: "NewIdea", daysAgo: 21 },
        { from: "NewIdea", to: "IntakeSubmitted", daysAgo: 18 },
        { from: "IntakeSubmitted", to: "ITApprovalPending", daysAgo: 17 },
      ],
      nudgesSent: 2,
    },
    {
      ticket: "DEMO-2-004",
      title: "PowerShell deployment automation",
      problem:
        "Application deployments to internal servers were a 90-minute manual ritual. PowerShell automation reduces this to a 10-minute parameterized run, with audit logs.",
      summary: "PowerShell-driven deployments with audit + rollback.",
      bu: "IT",
      tier: "2",
      status: "Completed",
      champion: "linus.torvalds@example.test",
      processOwner: "donald.knuth@example.test",
      implementationDate: "2025-10-01",
      itAssessment: {
        dataClassification: "Internal",
        dataFlowFrom: "Source code repository",
        dataFlowTo: "Application servers",
        recordsPerDay: 8,
        toolingType: "PowerShell + GitLab Runner",
        hostingLocation: "On-premise build agent",
        authMethod: "Service account in domain",
        llmSource: "none",
        llmTrainingRisk: false,
        businessImpact: "High",
        manualWorkaround: "Manual deployment runbook (90 min).",
      },
      steps: [
        { name: "Pull artifact", role: "ENGINEER", freq: 2000, base: 0.25, neu: 0.05, q: 0.05 },
        { name: "Deploy + smoke test", role: "ENGINEER_SENIOR", freq: 2000, base: 1.0, neu: 0.1, q: 0.2 },
        { name: "Verify + announce", role: "ANALYST_SENIOR", freq: 2000, base: 0.25, neu: 0.05, q: 0.05 },
      ],
      historicalReviewDates: ["2026-04-01"],
      approvals: [
        { role: "security", reviewerEmail: "alan.turing@example.test", status: "Approved", comment: "Service account permissions scoped." },
        { role: "licensing", reviewerEmail: "barbara.liskov@example.test", status: "Approved" },
      ],
      links: [{ type: "github_repo", url: "https://github.com/example/deploy-automation", label: "Source repository" }],
      artifacts: [
        { type: "TSS", label: "TSS" },
        { type: "Showcase", label: "Showcase" },
      ],
    },
    {
      ticket: "DEMO-2-005",
      title: "Browser automation for legacy ERP reporting",
      problem:
        "Proposed Selenium scraping of the legacy ERP for daily reports — ERP team objected: read-only API exists. Rejected at security review in favor of using the supported API.",
      summary: "Rejected — supported ERP API is the right path, not browser scraping.",
      bu: "Finance",
      tier: "2",
      status: "Rejected",
      champion: "grace.hopper@example.test",
      processOwner: "niklaus.wirth@example.test",
      itAssessment: {
        dataClassification: "Confidential",
        dataFlowFrom: "Legacy ERP (screen scrape)",
        dataFlowTo: "SharePoint",
        recordsPerDay: 1,
        toolingType: "Selenium Python",
        hostingLocation: "On-premise",
        authMethod: "Stored user credentials",
        llmSource: "none",
        llmTrainingRisk: false,
        businessImpact: "Low",
        manualWorkaround: "Continue manual export.",
      },
      approvals: [
        { role: "security", reviewerEmail: "alan.turing@example.test", status: "Rejected", comment: "Stored user creds + scraping = brittle and high-risk. The ERP has a read-only REST API — use that instead. Resubmit with API approach." },
        { role: "licensing", reviewerEmail: "barbara.liskov@example.test", status: "Pending" },
      ],
      statusTrail: [
        { from: null, to: "NewIdea", daysAgo: 50 },
        { from: "NewIdea", to: "IntakeSubmitted", daysAgo: 46 },
        { from: "IntakeSubmitted", to: "ITApprovalPending", daysAgo: 45 },
        { from: "ITApprovalPending", to: "Rejected", daysAgo: 40, note: "Security flagged credential storage + brittleness." },
      ],
    },

    // ──── TIER 3 ─────────────────────────────────────────────────────────
    {
      ticket: "DEMO-3-001",
      title: "HR onboarding orchestrator",
      problem:
        "New-hire onboarding spans Workday, ADP, AD, M365 licensing, equipment ordering, and the badging system — currently 15+ manual steps per hire. Tier 3 orchestrator coordinates all of them with HR-system writes and full audit.",
      summary: "Enterprise orchestrator for new-hire onboarding across HR, payroll, IT.",
      bu: "HR",
      tier: "3",
      status: "ITApprovalPending",
      champion: "katherine.johnson@example.test",
      processOwner: "barbara.liskov.bu@example.test",
      itAssessment: {
        dataClassification: "Restricted",
        dataFlowFrom: "Workday (HR system)",
        dataFlowTo: "ADP, AD, M365, equipment vendor, badging",
        recordsPerDay: 8,
        toolingType: "Azure Functions + Logic Apps",
        hostingLocation: "Azure (private endpoints)",
        authMethod: "Managed identity + Key Vault",
        llmSource: "Azure OpenAI (private) for free-text matching",
        llmTrainingRisk: false,
        businessImpact: "High",
        manualWorkaround: "Continue 15-step HR onboarding checklist.",
      },
      approvals: [
        { role: "security", reviewerEmail: "alan.turing@example.test", status: "Approved", comment: "Private endpoints + KV. Acceptable." },
        { role: "dev_governance", reviewerEmail: "edsger.dijkstra@example.test", status: "ChangesRequested", comment: "Need rollback runbook for partial-failure scenarios (e.g. AD created but ADP failed)." },
        { role: "licensing", reviewerEmail: "barbara.liskov@example.test", status: "Pending", slaOffsetBizDays: -3 },
      ],
      statusTrail: [
        { from: null, to: "NewIdea", daysAgo: 28 },
        { from: "NewIdea", to: "IntakeSubmitted", daysAgo: 25 },
        { from: "IntakeSubmitted", to: "ITApprovalPending", daysAgo: 24 },
      ],
      nudgesSent: 3,
    },
    {
      ticket: "DEMO-3-002",
      title: "SAP procurement write-back",
      problem:
        "Procurement requests are entered into a Power App, but final SAP creation is still manual. Adds write-back to SAP via certified SAP integration with full audit + rollback.",
      summary: "Tier 3 write-back to SAP for procurement requests.",
      bu: "Operations",
      tier: "3",
      status: "ITApproved",
      champion: "margaret.hamilton@example.test",
      processOwner: "donald.knuth@example.test",
      itAssessment: {
        dataClassification: "Confidential",
        dataFlowFrom: "Power App procurement front-end",
        dataFlowTo: "SAP",
        recordsPerDay: 30,
        toolingType: "Azure Functions + SAP RFC connector",
        hostingLocation: "Azure",
        authMethod: "Managed identity + Key Vault for SAP service account",
        llmSource: "none",
        llmTrainingRisk: false,
        businessImpact: "High",
        manualWorkaround: "Procurement team manually re-enters in SAP.",
      },
      approvals: [
        { role: "security", reviewerEmail: "alan.turing@example.test", status: "Approved" },
        { role: "dev_governance", reviewerEmail: "edsger.dijkstra@example.test", status: "Approved" },
        { role: "licensing", reviewerEmail: "barbara.liskov@example.test", status: "Approved" },
      ],
      statusTrail: [
        { from: null, to: "NewIdea", daysAgo: 70 },
        { from: "NewIdea", to: "IntakeSubmitted", daysAgo: 66 },
        { from: "IntakeSubmitted", to: "ITApprovalPending", daysAgo: 65 },
        { from: "ITApprovalPending", to: "ITApproved", daysAgo: 50, note: "All three reviewers approved." },
      ],
      nudgesSent: 2,
    },
    {
      ticket: "DEMO-3-003",
      title: "Compliance document classifier (custom-trained)",
      problem:
        "Compliance team reviews thousands of regulatory documents per quarter. A custom-trained classification model surfaces top-priority items and applies retention labels automatically.",
      summary: "Custom-trained classifier prioritizes compliance documents.",
      bu: "Corp",
      tier: "3",
      status: "InProgress",
      champion: "ada.lovelace@example.test",
      processOwner: "alan.kay@example.test",
      itAssessment: {
        dataClassification: "Restricted",
        dataFlowFrom: "Compliance document library",
        dataFlowTo: "SharePoint with retention labels",
        recordsPerDay: 500,
        toolingType: "Azure ML custom-trained model + Functions",
        hostingLocation: "Azure ML workspace",
        authMethod: "Managed identity",
        llmSource: "Azure ML (Enercon-trained, not shared)",
        llmTrainingRisk: false,
        businessImpact: "High",
        manualWorkaround: "Compliance team prioritizes manually (current state).",
      },
      steps: [
        { name: "Watch document library", role: "ENGINEER", freq: 100000, base: 0.02, neu: 0, q: 0.01 },
        { name: "Classify document", role: "ENGINEER_SENIOR", freq: 100000, base: 0.1, neu: 0.01, q: 0.05 },
        { name: "Compliance officer review", role: "MANAGER", freq: 100000, base: 0.15, neu: 0.05, q: 0.03 },
      ],
      approvals: [
        { role: "security", reviewerEmail: "alan.turing@example.test", status: "Approved" },
        { role: "dev_governance", reviewerEmail: "edsger.dijkstra@example.test", status: "Approved", comment: "Custom model retrain process documented." },
        { role: "licensing", reviewerEmail: "barbara.liskov@example.test", status: "Approved" },
      ],
      links: [
        { type: "github_repo", url: "https://github.com/example/compliance-classifier", label: "Source repository" },
        { type: "other", url: "https://ml.azure.com/workspaces/compliance/models/classifier", label: "Azure ML workspace" },
      ],
      statusTrail: [
        { from: null, to: "NewIdea", daysAgo: 120 },
        { from: "NewIdea", to: "IntakeSubmitted", daysAgo: 115 },
        { from: "IntakeSubmitted", to: "ITApprovalPending", daysAgo: 114 },
        { from: "ITApprovalPending", to: "ITApproved", daysAgo: 105 },
        { from: "ITApproved", to: "InProgress", daysAgo: 104 },
      ],
      nudgesSent: 12,
    },
    {
      ticket: "DEMO-3-004",
      title: "Enterprise ticketing replacement (flagship)",
      problem:
        "Aging internal ticketing system replaced with a custom platform across all business units. Reduced average ticket resolution from 4.2 to 1.6 days; freed three FTEs.",
      summary: "Company-wide replacement of legacy ticketing — flagship Tier 3 win.",
      bu: "IT",
      tier: "3",
      status: "Completed",
      champion: "linus.torvalds@example.test",
      processOwner: "donald.knuth@example.test",
      implementationDate: "2024-11-01",
      itAssessment: {
        dataClassification: "Internal",
        dataFlowFrom: "All business units",
        dataFlowTo: "New ticketing platform",
        recordsPerDay: 400,
        toolingType: "Custom Next.js + Postgres + Azure Functions",
        hostingLocation: "Azure (private endpoints)",
        authMethod: "Entra ID SSO",
        llmSource: "Azure OpenAI (routing assistant)",
        llmTrainingRisk: false,
        businessImpact: "High",
        manualWorkaround: "Legacy system held as cold standby for 90 days post-cutover.",
      },
      steps: [
        { name: "Submit ticket", role: "ANALYST_JUNIOR", freq: 80000, base: 0.15, neu: 0.05, q: 0.05 },
        { name: "AI-assisted routing", role: "TECHNICIAN", freq: 80000, base: 0.5, neu: 0.05, q: 0.2 },
        { name: "Resolve ticket", role: "ENGINEER", freq: 80000, base: 0.75, neu: 0.4, q: 0.1 },
        { name: "Close + survey", role: "ANALYST_JUNIOR", freq: 80000, base: 0.1, neu: 0.02, q: 0.05 },
      ],
      // Two years of history → meaningful YoY trend.
      historicalReviewDates: ["2025-05-01", "2026-05-01"],
      approvals: [
        { role: "security", reviewerEmail: "alan.turing@example.test", status: "Approved", comment: "Private endpoints across the board. Entra-SSO confirmed." },
        { role: "dev_governance", reviewerEmail: "edsger.dijkstra@example.test", status: "Approved", comment: "Reviewed monorepo + CI. Standards exceeded." },
        { role: "licensing", reviewerEmail: "barbara.liskov@example.test", status: "Approved", comment: "Azure OpenAI token budget locked at $400/mo." },
      ],
      uat: [
        { id: "UAT-001", phase: "InternalQA", scenario: "Submit + AI-route a routine IT ticket", expected: "Routed within 30 sec", actual: "Routed in 12 sec", result: "Pass" },
        { id: "UAT-002", phase: "InternalQA", scenario: "Submit + AI-route a finance ticket", expected: "Routed to Finance queue", actual: "Routed correctly", result: "Pass" },
        { id: "UAT-003", phase: "InternalQA", scenario: "Ambiguous ticket", expected: "Flag for human triage", actual: "Flagged", result: "Pass" },
        { id: "UAT-004", phase: "BusinessUAT", scenario: "Heads-of-units pilot for 2 weeks", expected: "≥80% satisfaction", actual: "91% satisfaction across 4 BUs", result: "Pass" },
      ],
      links: [
        { type: "github_repo", url: "https://github.com/example/enterprise-ticketing", label: "Source monorepo" },
        { type: "bi_dashboard", url: "https://app.powerbi.com/reports/ticketing-stats", label: "Resolution-time dashboard" },
      ],
      artifacts: [
        { type: "PDD", label: "PDD v3" },
        { type: "TSS", label: "TSS v2" },
        { type: "UAT", label: "Full UAT log" },
        { type: "Showcase", label: "Solution showcase" },
        { type: "UsageGuide", label: "Champion guide" },
      ],
      howToAccess: "Direct link: https://tickets.example.test — SSO with corporate account.",
    },
  ];

  // ─── Apply project definitions ──────────────────────────────────────────
  const rates: Record<string, number[]> = {};
  // For each role, build a year→rate map. Use the latest-applicable rate for each project's review date.
  // (Mirrors the engine's resolveRate against cost_rate_history.)
  for (const [role, epochs] of Object.entries(rateEpochs)) {
    rates[role] = epochs.map(([_d, r]) => Number(r));
  }
  function rateAt(role: string, asOf: string): number {
    const epochs = rateEpochs[role];
    let best = 0;
    for (const [beginDate, rate] of epochs) {
      if (beginDate <= asOf) best = Number(rate);
    }
    return best;
  }

  for (const p of projDefs) {
    const [proj] = await db
      .insert(projects)
      .values({
        intakeTicketId: p.ticket,
        title: p.title,
        problemStatement: p.problem,
        businessUnitId: findBu(p.bu),
        championUserId: u(p.champion),
        processOwnerUserId: p.processOwner ? u(p.processOwner) : null,
        complexityTier: p.tier,
        status: p.status,
        implementationDate: p.implementationDate ?? null,
        summaryPitch: p.summary,
        howToAccess: p.howToAccess ?? null,
      })
      .returning();

    // Status history — including a final "now" entry if it differs.
    if (p.statusTrail) {
      for (const t of p.statusTrail) {
        await db.insert(projectStatusHistory).values({
          projectId: proj.id,
          fromStatus: t.from ?? null,
          toStatus: t.to,
          changedByUserId: u(p.champion),
          changedAt: daysAgo(t.daysAgo),
          note: t.note,
        });
      }
    }

    // IT assessment
    if (p.itAssessment) {
      await db.insert(itAssessments).values({
        projectId: proj.id,
        ...p.itAssessment,
        submittedAt: daysAgo(p.statusTrail?.[1]?.daysAgo ?? 10),
        submittedByUserId: u(p.champion),
      });
    }

    // Approvals + comments
    if (p.approvals) {
      for (const a of p.approvals) {
        const slaDue = a.slaOffsetBizDays === undefined ? null : addBizDays(new Date(), a.slaOffsetBizDays);
        const [approval] = await db
          .insert(approvals)
          .values({
            projectId: proj.id,
            reviewerRoleCode: a.role,
            reviewerUserId: u(a.reviewerEmail),
            status: a.status ?? "Pending",
            slaDueAt: slaDue,
            decidedAt:
              a.status && a.status !== "Pending"
                ? daysAgo(Math.max(1, Math.floor((p.statusTrail?.[3]?.daysAgo ?? 5))))
                : null,
          })
          .returning();
        if (a.comment) {
          await db.insert(approvalComments).values({
            approvalId: approval.id,
            authorUserId: u(a.reviewerEmail),
            body: a.comment,
          });
        }
      }
    }

    // Auto-open the AI Team Review approval when the project has reached
    // (or passed) AITeamReview. Skipped if the seeded p.approvals already
    // included one. Tier 1A is the only tier without an AI Team gate.
    const hasAiTeamSeeded = p.approvals?.some((a) => a.role === "ai_team");
    const reachedAiTeamGate = ["AITeamReview", "Completed", "Decommissioned"].includes(p.status);
    if (!hasAiTeamSeeded && reachedAiTeamGate && p.tier !== "1A") {
      await db.insert(approvals).values({
        projectId: proj.id,
        reviewerRoleCode: "ai_team",
        reviewerUserId: u("tim.berners-lee@example.test"),
        status: p.status === "AITeamReview" ? "Pending" : "Approved",
        slaDueAt: p.status === "AITeamReview" ? addBizDays(new Date(), 2) : null,
        decidedAt:
          p.status === "AITeamReview"
            ? null
            : daysAgo(Math.max(1, p.statusTrail?.find((t) => t.to === "Completed")?.daysAgo ?? 30)),
      });
    }

    // ROI snapshots — one per historicalReviewDate; the latest carries the cached totals.
    if (p.steps && p.steps.length > 0) {
      const dates =
        p.historicalReviewDates ??
        [p.implementationDate ?? new Date().toISOString().slice(0, 10)];

      // Each entry in `dates` becomes one version with periodStart = that date.
      // For all but the last, supersededAt = the next date.
      // nextReviewDate on the active (last) version = one year from periodStart.
      for (let v = 0; v < dates.length; v++) {
        const periodStart = dates[v];
        const isLast = v === dates.length - 1;
        const supersededAt = isLast ? null : dates[v + 1];
        const nextReviewDate = isLast ? oneYearAfter(periodStart) : null;
        const versionLabel = `V${v + 1}`;
        const computed = computeRoi(
          p.steps.map((s) => ({
            baselineHours: s.base,
            newHours: s.neu,
            qualityIncreaseHours: s.q,
            freqPerYear: s.freq,
            hourlyRate: rateAt(s.role, periodStart),
          })),
        );

        const [calc] = await db
          .insert(roiCalculations)
          .values({
            projectId: proj.id,
            versionLabel,
            periodStart,
            supersededAt,
            nextReviewDate,
            computedAnnualSavingsUsd: computed.totals.annualSavedUsd.toFixed(2),
            computedAnnualSavingsHours: computed.totals.annualSavedHours.toFixed(2),
            computedQualityValueUsd: computed.totals.annualQualityUsd.toFixed(2),
            computedQualityHours: computed.totals.annualQualityHours.toFixed(2),
            signedOffByUserId: p.processOwner ? u(p.processOwner) : null,
            signedOffAt: daysAgo(180 - v * 30),
          })
          .returning();

        for (let i = 0; i < p.steps.length; i++) {
          const s = p.steps[i];
          await db.insert(roiSteps).values({
            roiCalculationId: calc.id,
            stepOrder: i + 1,
            name: s.name,
            roleCode: s.role,
            freqPerYear: s.freq.toString(),
            baselineHours: s.base.toString(),
            newHours: s.neu.toString(),
            qualityIncreaseHours: s.q.toString(),
          });
        }
      }
    }

    // UAT entries
    if (p.uat) {
      for (const e of p.uat) {
        await db.insert(uatLogEntries).values({
          projectId: proj.id,
          testCaseId: e.id,
          phase: e.phase,
          scenario: e.scenario,
          expected: e.expected,
          actual: e.actual,
          result: e.result,
          testedByUserId: u(p.champion),
          testedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        });
      }
    }

    // Solution links
    if (p.links) {
      for (const l of p.links) {
        await db.insert(solutionLinks).values({
          projectId: proj.id,
          linkType: l.type,
          url: l.url,
          label: l.label,
        });
      }
    }

    // Artifacts (recorded against fake URLs — UI just lists them with download links).
    if (p.artifacts) {
      for (const a of p.artifacts) {
        await db.insert(artifacts).values({
          projectId: proj.id,
          type: a.type,
          blobUrl: `https://example.test/artifacts/${proj.id}/${a.type}.pdf`,
          version: 1,
          uploadedByUserId: u(p.champion),
        });
      }
    }

    // Nudge log entries (so the weekly nudge has historical evidence on the audit log).
    if (p.nudgesSent && p.nudgesSent > 0) {
      for (let i = 0; i < p.nudgesSent; i++) {
        await db.insert(nudgeLog).values({
          projectId: proj.id,
          recipients: [p.champion],
          bodyHtml: `<p>Weekly nudge ${i + 1} for ${p.title}.</p>`,
          sentAt: daysAgo((p.nudgesSent - i) * 7),
        });
      }
    }

    // Synthetic audit trail (a few representative events).
    const champUserId = u(p.champion);
    await db.insert(auditEvents).values({
      actorUserId: champUserId,
      entityType: "project",
      entityId: proj.id,
      action: "create",
      afterJson: { title: p.title, tier: p.tier },
      occurredAt: daysAgo(p.statusTrail?.[0]?.daysAgo ?? 30),
    });
    if (p.statusTrail) {
      for (const t of p.statusTrail.slice(1)) {
        await db.insert(auditEvents).values({
          actorUserId: champUserId,
          entityType: "project",
          entityId: proj.id,
          action: "transition",
          beforeJson: { status: t.from },
          afterJson: { status: t.to },
          occurredAt: daysAgo(t.daysAgo),
        });
      }
    }
  }

  // ─── A couple of soft-deleted projects so /admin/trash isn't empty ──────
  await db.execute(sql`delete from projects where intake_ticket_id like 'DEMO-TRASH-%'`);
  const [trashed] = await db
    .insert(projects)
    .values({
      intakeTicketId: "DEMO-TRASH-001",
      title: "Abandoned — Power BI dataset cleanup",
      problemStatement:
        "Original scope outgrown; replaced by the Power BI auto-diagnoser project. Soft-deleted.",
      businessUnitId: findBu("IT"),
      championUserId: u("donald.knuth@example.test"),
      complexityTier: "1B",
      status: "Decommissioned",
      deletedAt: daysAgo(15),
    })
    .returning();
  await db.insert(auditEvents).values({
    actorUserId: u("team@example.test"),
    entityType: "project",
    entityId: trashed.id,
    action: "delete",
    occurredAt: daysAgo(15),
  });

  // Counts for visibility
  const counts = {
    projects: (await db.select().from(projects)).length,
    approvals: (await db.select().from(approvals)).length,
    roi: (await db.select().from(roiCalculations)).length,
    uat: (await db.select().from(uatLogEntries)).length,
    artifacts: (await db.select().from(artifacts)).length,
    audit: (await db.select().from(auditEvents)).length,
  };
  console.log("Seed counts:", counts);
  console.log("Done.");
  process.exit(0);
}

function oneYearAfter(yyyyMmDd: string): string {
  const d = new Date(yyyyMmDd);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function addBizDays(start: Date, n: number): Date {
  const d = new Date(start);
  let added = 0;
  const direction = n >= 0 ? 1 : -1;
  while (added !== n) {
    d.setUTCDate(d.getUTCDate() + direction);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) added += direction;
  }
  return d;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
