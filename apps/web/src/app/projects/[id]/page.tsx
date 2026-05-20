import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import {
  approvals,
  artifacts,
  businessUnits,
  costRateHistory,
  itAssessments,
  projects,
  rolesCatalog,
  roiCalculations,
  roiSteps,
  solutionLinks,
  tierReviewMatrix,
  uatLogEntries,
  users,
} from "@/db/schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { safe } from "@/lib/safe-query";
import { DbDownBanner } from "@/components/DbDownBanner";
import { StatusBadge } from "@/components/StatusBadge";
import { TierBadge } from "@/components/TierBadge";
import { StatusActions } from "@/components/StatusActions";
import { ApprovalDecision } from "@/components/ApprovalDecision";
import { GatesProgress } from "@/components/GatesProgress";
import { ItAssessmentForm } from "@/components/ItAssessmentForm";
import { RoiEditor, type VersionRow } from "@/components/RoiEditor";
import { UatForm } from "@/components/UatForm";
import { SolutionLinkForm } from "@/components/SolutionLinkForm";
import { ArtifactUpload } from "@/components/ArtifactUpload";
import { formatDate } from "@/lib/dates";
import { formatNumber, formatUsd } from "@/lib/money";
import { resolveRate } from "@/domains/roi/engine";
import {
  approvalStatusLabel,
  artifactTypeLabel,
  gateForReviewerRole,
  linkTypeLabel,
  reviewerRoleLabel,
  type ApprovalGate,
} from "@/lib/display";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "roi", label: "ROI" },
  { id: "governance", label: "IT Governance" },
  { id: "approvals", label: "Approvals" },
  { id: "uat", label: "UAT" },
  { id: "artifacts", label: "Artifacts" },
  { id: "solution", label: "Solution Storage" },
  { id: "showcase", label: "Showcase" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab: Tab = (TABS.find((t) => t.id === tab)?.id ?? "overview") as Tab;

  const result = await safe(() => loadProject(id));

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <DbDownBanner message={result.error} />
        <p>
          <Link href="/backlog" className="text-brand hover:underline">
            ← back to backlog
          </Link>
        </p>
      </div>
    );
  }

  if (!result.value) notFound();

  const {
    project,
    bu,
    champion,
    processOwner,
    versions,
    rolesData,
    rateLookupByVersion,
    rateLookupForNew,
    projectApprovals,
    approvalReviewers,
    requiredReviewerRoles,
    assessment,
    projectArtifacts,
    links,
    uat,
    gateSignals,
  } = result.value;

  const activeVersion = versions.find((v) => v.supersededAt === null);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/backlog" className="text-sm text-brand hover:underline">
          ← Backlog
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {project.title}
          </h1>
          <TierBadge tier={project.complexityTier} />
          <StatusBadge status={project.status} />
        </div>
        <div className="mt-1 text-sm text-gray-500">
          {bu?.displayName ?? "—"} · Champion {champion?.displayName ?? "—"} ·
          Process owner {processOwner?.displayName ?? "—"}
        </div>

        <div className="mt-4 card p-3">
          <GatesProgress
            tier={project.complexityTier}
            status={project.status}
            signals={gateSignals}
          />
        </div>

        <div className="mt-3">
          <StatusActions
            projectId={project.id}
            status={project.status}
            tier={project.complexityTier}
          />
        </div>
      </div>

      <div className="border-b border-surface-border">
        <nav className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`/projects/${id}?tab=${t.id}`}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2",
                activeTab === t.id
                  ? "border-brand text-brand"
                  : "border-transparent text-gray-600 hover:text-gray-900",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {activeTab === "overview" && (
        <Overview project={project} activeVersion={activeVersion ?? null} />
      )}
      {activeTab === "roi" && (
        <RoiEditor
          projectId={project.id}
          implementationDate={project.implementationDate}
          roles={rolesData.map((r) => ({
            roleCode: r.roleCode,
            displayName: r.displayName,
          }))}
          rateLookupByVersion={rateLookupByVersion}
          rateLookupForNew={rateLookupForNew}
          versions={versions}
        />
      )}
      {activeTab === "governance" && (
        <ItAssessmentForm
          projectId={project.id}
          initial={
            assessment
              ? {
                  dataClassification: assessment.dataClassification ?? undefined,
                  dataFlowFrom: assessment.dataFlowFrom ?? undefined,
                  dataFlowTo: assessment.dataFlowTo ?? undefined,
                  recordsPerDay: assessment.recordsPerDay ?? undefined,
                  toolingType: assessment.toolingType ?? undefined,
                  hostingLocation: assessment.hostingLocation ?? undefined,
                  authMethod: assessment.authMethod ?? undefined,
                  llmSource: assessment.llmSource ?? undefined,
                  llmTrainingRisk: assessment.llmTrainingRisk ?? undefined,
                  businessImpact: assessment.businessImpact ?? undefined,
                  manualWorkaround: assessment.manualWorkaround ?? undefined,
                }
              : {}
          }
        />
      )}
      {activeTab === "approvals" && (
        <ApprovalsTab
          approvalsList={projectApprovals}
          reviewerNames={approvalReviewers}
          requiredReviewerRoles={requiredReviewerRoles}
        />
      )}
      {activeTab === "uat" && <UatTab projectId={project.id} entries={uat} />}
      {activeTab === "artifacts" && (
        <ArtifactsTab projectId={project.id} artifacts={projectArtifacts} />
      )}
      {activeTab === "solution" && (
        <SolutionTab projectId={project.id} links={links} />
      )}
      {activeTab === "showcase" && (
        <ShowcaseTab
          projectId={project.id}
          project={project}
          activeVersion={activeVersion ?? null}
        />
      )}
    </div>
  );
}

async function loadProject(id: string) {
  const [proj] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  if (!proj) return null;

  const [bu] = proj.businessUnitId
    ? await db
        .select()
        .from(businessUnits)
        .where(eq(businessUnits.id, proj.businessUnitId))
    : [];
  const [champion] = proj.championUserId
    ? await db.select().from(users).where(eq(users.id, proj.championUserId))
    : [];
  const [processOwner] = proj.processOwnerUserId
    ? await db.select().from(users).where(eq(users.id, proj.processOwnerUserId))
    : [];

  // All ROI versions, oldest first.
  const versionsRaw = await db
    .select()
    .from(roiCalculations)
    .where(
      and(
        eq(roiCalculations.projectId, id),
        isNull(roiCalculations.deletedAt),
      ),
    )
    .orderBy(asc(roiCalculations.periodStart));
  const versionIds = versionsRaw.map((v) => v.id);
  const allSteps =
    versionIds.length > 0
      ? await db
          .select()
          .from(roiSteps)
          .where(inArray(roiSteps.roiCalculationId, versionIds))
          .orderBy(asc(roiSteps.stepOrder))
      : [];
  const stepsByVersion = new Map<string, (typeof roiSteps.$inferSelect)[]>();
  for (const s of allSteps) {
    if (!stepsByVersion.has(s.roiCalculationId))
      stepsByVersion.set(s.roiCalculationId, []);
    stepsByVersion.get(s.roiCalculationId)!.push(s);
  }
  const versions: VersionRow[] = versionsRaw.map((v) => ({
    id: v.id,
    versionLabel: v.versionLabel,
    periodStart: v.periodStart,
    supersededAt: v.supersededAt,
    nextReviewDate: v.nextReviewDate,
    annualSavedUsd: Number(v.computedAnnualSavingsUsd ?? 0),
    annualSavedHours: Number(v.computedAnnualSavingsHours ?? 0),
    qualityValueUsd: Number(v.computedQualityValueUsd ?? 0),
    steps: (stepsByVersion.get(v.id) ?? []).map((s) => ({
      name: s.name,
      roleCode: s.roleCode,
      freqPerYear: Number(s.freqPerYear),
      baselineHours: Number(s.baselineHours),
      newHours: Number(s.newHours),
      qualityIncreaseHours: Number(s.qualityIncreaseHours),
    })),
  }));

  // Rate lookups: one per version (so editing a prior version uses the
  // rates that were in effect when that version applied) + one for "new"
  // (today, used by the create-new-version form).
  const rolesData = await db.select().from(rolesCatalog);
  const rateRows = await db.select().from(costRateHistory);
  const ratesByRole = new Map<
    string,
    { beginDate: string; hourlyRate: number }[]
  >();
  for (const r of rateRows) {
    if (!ratesByRole.has(r.roleCode)) ratesByRole.set(r.roleCode, []);
    ratesByRole
      .get(r.roleCode)!
      .push({ beginDate: r.beginDate, hourlyRate: Number(r.hourlyRate) });
  }
  function lookupAt(asOf: string) {
    const out: Record<string, number> = {};
    for (const r of rolesData) {
      const v = resolveRate(ratesByRole.get(r.roleCode) ?? [], asOf);
      if (v != null) out[r.roleCode] = v;
    }
    return out;
  }
  const rateLookupByVersion: Record<string, Record<string, number>> = {};
  for (const v of versions) {
    rateLookupByVersion[v.id] = lookupAt(v.periodStart);
  }
  const rateLookupForNew = lookupAt(new Date().toISOString().slice(0, 10));

  const projectApprovals = await db
    .select()
    .from(approvals)
    .where(eq(approvals.projectId, id))
    .orderBy(asc(approvals.createdAt));
  const reviewerIds = projectApprovals
    .map((a) => a.reviewerUserId)
    .filter((v): v is string => v != null);
  const reviewerRows =
    reviewerIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, reviewerIds))
      : [];
  const approvalReviewers = new Map<string, string>(
    reviewerRows.map((u) => [u.id, u.displayName]),
  );

  // Required reviewer roles for the project's tier (from the matrix).
  // Drives which gate cards we render — even before any approval has opened.
  const requiredReviewerRoles = proj.complexityTier
    ? (
        await db
          .select({ code: tierReviewMatrix.reviewerRoleCode })
          .from(tierReviewMatrix)
          .where(
            and(
              eq(tierReviewMatrix.tier, proj.complexityTier),
              eq(tierReviewMatrix.required, true),
            ),
          )
      ).map((r) => r.code)
    : [];

  const [assessment] = await db
    .select()
    .from(itAssessments)
    .where(eq(itAssessments.projectId, id));

  const projectArtifacts = await db
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.projectId, id), isNull(artifacts.deletedAt)));

  const links = await db
    .select()
    .from(solutionLinks)
    .where(eq(solutionLinks.projectId, id));

  const uat = await db
    .select()
    .from(uatLogEntries)
    .where(eq(uatLogEntries.projectId, id));

  const gateSignals = {
    itAssessmentSubmitted: !!assessment?.submittedAt,
    allApprovalsDecided:
      projectApprovals.length > 0 &&
      projectApprovals.every((a) => a.status !== "Pending"),
    anyApprovalRejected: projectApprovals.some((a) => a.status === "Rejected"),
    hasPdd: projectArtifacts.some((a) => a.type === "PDD"),
    hasTss: projectArtifacts.some((a) => a.type === "TSS"),
    uatSignedOff:
      uat.length > 0 &&
      uat.some((u) => u.phase === "BusinessUAT" && u.result === "Pass"),
    hasShowcase: projectArtifacts.some((a) => a.type === "Showcase"),
  };

  return {
    project: proj,
    bu,
    champion,
    processOwner,
    versions,
    rolesData,
    rateLookupByVersion,
    rateLookupForNew,
    projectApprovals,
    approvalReviewers,
    requiredReviewerRoles,
    assessment,
    projectArtifacts,
    links,
    uat,
    gateSignals,
  };
}

function Overview({
  project,
  activeVersion,
}: {
  project: typeof projects.$inferSelect;
  activeVersion: VersionRow | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="card p-5 lg:col-span-2">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">
          Problem statement
        </h2>
        <p className="whitespace-pre-wrap text-sm text-gray-800">
          {project.problemStatement ?? "—"}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <Field label="Intake ticket" value={project.intakeTicketId ?? "—"} />
          <Field
            label="Implementation date"
            value={formatDate(project.implementationDate)}
          />
          <Field
            label="Created"
            value={formatDate(project.createdAt, "long")}
          />
          <Field
            label="Last updated"
            value={formatDate(project.updatedAt, "long")}
          />
        </div>
      </div>
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          Current ROI ({activeVersion?.versionLabel ?? "—"})
        </h2>
        {activeVersion ? (
          <dl className="space-y-2 text-sm">
            <Row
              k="Annual $ saved"
              v={formatUsd(activeVersion.annualSavedUsd)}
            />
            <Row
              k="Annual hours saved"
              v={formatNumber(activeVersion.annualSavedHours)}
            />
            <Row
              k="Quality $ / year"
              v={formatUsd(activeVersion.qualityValueUsd)}
            />
            <Row
              k="In effect since"
              v={formatDate(activeVersion.periodStart)}
            />
            <Row
              k="Next review"
              v={formatDate(activeVersion.nextReviewDate)}
            />
          </dl>
        ) : (
          <p className="text-sm text-gray-500">
            No ROI calculation yet. Go to the ROI tab to create V1.
          </p>
        )}
      </div>
    </div>
  );
}

function ApprovalsTab({
  approvalsList,
  reviewerNames,
  requiredReviewerRoles,
}: {
  approvalsList: (typeof approvals.$inferSelect)[];
  reviewerNames: Map<string, string>;
  /** Reviewer-role codes required by the project's tier (from the matrix). */
  requiredReviewerRoles: string[];
}) {
  // Build the per-gate set of required reviewer roles.
  const requiredByGate = new Map<ApprovalGate, string[]>();
  for (const role of requiredReviewerRoles) {
    const g = gateForReviewerRole(role);
    if (!requiredByGate.has(g)) requiredByGate.set(g, []);
    requiredByGate.get(g)!.push(role);
  }

  if (requiredByGate.size === 0) {
    return (
      <div className="card p-8 text-center text-sm text-ink-subtle">
        No approvals required for this tier.
      </div>
    );
  }

  // Group existing approval rows by gate.
  const subsByGate = new Map<ApprovalGate, (typeof approvals.$inferSelect)[]>();
  for (const a of approvalsList) {
    const g = gateForReviewerRole(a.reviewerRoleCode);
    if (!subsByGate.has(g)) subsByGate.set(g, []);
    subsByGate.get(g)!.push(a);
  }

  const orderedGates: ApprovalGate[] = ["IT Approval", "AI Team Review"];

  return (
    <div className="space-y-4">
      {orderedGates
        .filter((g) => requiredByGate.has(g))
        .map((gate) => (
          <GateCard
            key={gate}
            gate={gate}
            requiredRoles={requiredByGate.get(gate) ?? []}
            subs={subsByGate.get(gate) ?? []}
            reviewerNames={reviewerNames}
          />
        ))}
    </div>
  );
}

function gateStatus(
  subs: (typeof approvals.$inferSelect)[],
  requiredRoles: string[],
): {
  label: string;
  tone: "pending" | "passed" | "blocked" | "changes" | "upcoming";
  overdue: boolean;
} {
  // No approvals opened yet for required roles → the gate is upcoming.
  if (subs.length === 0 && requiredRoles.length > 0)
    return { label: "Awaiting", tone: "upcoming", overdue: false };
  if (subs.some((s) => s.status === "Rejected"))
    return { label: "Blocked", tone: "blocked", overdue: false };
  if (subs.some((s) => s.status === "ChangesRequested"))
    return { label: "Changes requested", tone: "changes", overdue: false };
  if (
    subs.length >= requiredRoles.length &&
    subs.every((s) => s.status !== "Pending")
  )
    return { label: "Passed", tone: "passed", overdue: false };
  const overdue = subs.some(
    (s) =>
      s.status === "Pending" &&
      s.slaDueAt &&
      s.slaDueAt.getTime() < Date.now(),
  );
  return { label: "Pending", tone: "pending", overdue };
}

function GateCard({
  gate,
  requiredRoles,
  subs,
  reviewerNames,
}: {
  gate: ApprovalGate;
  /** Reviewer-role codes the matrix requires for this gate. */
  requiredRoles: string[];
  /** Existing approval rows for this gate. */
  subs: (typeof approvals.$inferSelect)[];
  reviewerNames: Map<string, string>;
}) {
  const status = gateStatus(subs, requiredRoles);
  const decided = subs.filter((s) => s.status !== "Pending").length;

  const toneClass = {
    pending: status.overdue
      ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200"
      : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    passed: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
    blocked: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
    changes: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    upcoming:
      "bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-200",
  }[status.tone];

  // Roles required but no approval row yet → render as placeholders.
  const rolesWithSubs = new Set(subs.map((s) => s.reviewerRoleCode));
  const placeholderRoles = requiredRoles.filter(
    (r) => !rolesWithSubs.has(r),
  );

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between border-b border-surface-divider bg-surface-subtle px-5 py-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-ink">{gate}</h3>
          <span className={`pill ${toneClass}`}>
            {status.label}
            {status.overdue ? " · Overdue" : ""}
          </span>
        </div>
        <div className="text-xs text-ink-subtle">
          {requiredRoles.length === 0
            ? `${decided} decided`
            : `${decided} of ${requiredRoles.length} reviewer${requiredRoles.length === 1 ? "" : "s"} decided`}
        </div>
      </header>
      <ul className="divide-y divide-surface-divider">
        {subs.map((a) => {
          const overdue =
            a.status === "Pending" &&
            a.slaDueAt &&
            a.slaDueAt.getTime() < Date.now();
          return (
            <li key={a.id} className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-ink-subtle">
                    {reviewerRoleLabel(a.reviewerRoleCode)}
                  </div>
                  <div className="font-medium text-ink">
                    {a.reviewerUserId ? (
                      reviewerNames.get(a.reviewerUserId) ?? "Reviewer"
                    ) : (
                      <span className="text-ink-soft">Unassigned</span>
                    )}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <span
                    className={`pill ${
                      a.status === "Approved"
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                        : a.status === "Rejected"
                          ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200"
                          : a.status === "ChangesRequested"
                            ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200"
                            : overdue
                              ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200"
                              : "bg-neutral-100 text-neutral-700 ring-1 ring-inset ring-neutral-200"
                    }`}
                  >
                    {approvalStatusLabel(a.status)}
                  </span>
                  <div className="mt-1 text-xs text-ink-subtle">
                    {a.status === "Pending"
                      ? `Due ${formatDate(a.slaDueAt)}${overdue ? " · OVERDUE" : ""}`
                      : `Decided ${formatDate(a.decidedAt)}`}
                  </div>
                </div>
              </div>
              {a.status === "Pending" && <ApprovalDecision approvalId={a.id} />}
            </li>
          );
        })}
        {placeholderRoles.map((role) => (
          <li key={`pending-${role}`} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-ink-subtle">
                  {reviewerRoleLabel(role)}
                </div>
                <div className="text-ink-soft">Not yet opened</div>
              </div>
              <div className="text-right text-xs text-ink-subtle">
                {gate === "AI Team Review"
                  ? "Opens when the build is ready for review"
                  : "Opens when the project enters IT review"}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function UatTab({
  projectId,
  entries,
}: {
  projectId: string;
  entries: (typeof uatLogEntries.$inferSelect)[];
}) {
  return (
    <div className="space-y-4">
      <UatForm projectId={projectId} />
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Phase</th>
              <th className="px-3 py-2">Scenario</th>
              <th className="px-3 py-2">Result</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-gray-500">
                  No entries yet.
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="border-t border-surface-border">
                  <td className="px-3 py-2">{e.testCaseId}</td>
                  <td className="px-3 py-2">{e.phase}</td>
                  <td className="px-3 py-2">{e.scenario}</td>
                  <td className="px-3 py-2">{e.result ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ArtifactsTab({
  projectId,
  artifacts: list,
}: {
  projectId: string;
  artifacts: (typeof artifacts.$inferSelect)[];
}) {
  return (
    <div className="space-y-4">
      <ArtifactUpload projectId={projectId} />
      {list.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">
          No artifacts uploaded yet.
        </div>
      ) : (
        <ul className="card divide-y divide-surface-border">
          {list.map((a) => (
            <li key={a.id} className="flex items-center justify-between p-4 text-sm">
              <span className="font-medium">{artifactTypeLabel(a.type)}</span>
              <a
                href={a.blobUrl}
                target="_blank"
                rel="noreferrer"
                className="text-brand hover:underline"
              >
                v{a.version} ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SolutionTab({
  projectId,
  links,
}: {
  projectId: string;
  links: (typeof solutionLinks.$inferSelect)[];
}) {
  return (
    <div className="space-y-4">
      <SolutionLinkForm projectId={projectId} />
      {links.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">
          No solution links yet.
        </div>
      ) : (
        <ul className="card divide-y divide-surface-border">
          {links.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between p-4 text-sm"
            >
              <div>
                <div className="text-gray-500 text-xs uppercase tracking-wider">
                  {linkTypeLabel(l.linkType)}
                </div>
                <div className="font-medium">{l.label ?? l.url}</div>
              </div>
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="btn"
              >
                Open ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ShowcaseTab({
  projectId,
  project,
  activeVersion,
}: {
  projectId: string;
  project: typeof projects.$inferSelect;
  activeVersion: VersionRow | null;
}) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Showcase preview</h2>
        <a href={`/api/showcase/${projectId}.pdf`} className="btn-primary">
          Download PDF
        </a>
      </div>
      <div className="rounded border border-surface-border bg-surface-subtle p-5 space-y-2">
        <h3 className="text-xl font-semibold">{project.title}</h3>
        <p className="text-sm text-gray-700">{project.problemStatement}</p>
        {activeVersion && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <div className="label">Annual $</div>
              <div className="font-semibold">
                {formatUsd(activeVersion.annualSavedUsd)}
              </div>
            </div>
            <div>
              <div className="label">Hours saved</div>
              <div className="font-semibold">
                {formatNumber(activeVersion.annualSavedHours)}
              </div>
            </div>
            <div>
              <div className="label">Quality $</div>
              <div className="font-semibold">
                {formatUsd(activeVersion.qualityValueUsd)}
              </div>
            </div>
            <div>
              <div className="label">Implemented</div>
              <div className="font-semibold">
                {formatDate(project.implementationDate)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mt-0.5 text-gray-800">{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-surface-border py-1.5 last:border-b-0">
      <dt className="text-gray-500">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
