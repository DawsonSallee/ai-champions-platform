"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { computeRoi, realizedAcrossVersions } from "@/domains/roi/engine";
import {
  reviseVersionAction,
  saveRoiAction,
  setReviewDateAction,
} from "@/domains/roi/actions";
import { formatDate } from "@/lib/dates";
import { formatNumber, formatPct, formatUsd } from "@/lib/money";

type Role = { roleCode: string; displayName: string };

type StepDraft = {
  name: string;
  roleCode: string;
  freqPerYear: number;
  baselineHours: number;
  newHours: number;
  qualityIncreaseHours: number;
};

export type VersionRow = {
  id: string;
  versionLabel: string;
  periodStart: string;
  supersededAt: string | null;
  nextReviewDate: string | null;
  annualSavedUsd: number;
  annualSavedHours: number;
  qualityValueUsd: number;
  steps: StepDraft[];
};

const EMPTY_STEP: StepDraft = {
  name: "",
  roleCode: "",
  freqPerYear: 0,
  baselineHours: 0,
  newHours: 0,
  qualityIncreaseHours: 0,
};

export function RoiEditor({
  projectId,
  implementationDate,
  roles,
  /** roleCode → rate per version's periodStart (keyed by versionId). */
  rateLookupByVersion,
  /** roleCode → rate as of today (used when creating a new version). */
  rateLookupForNew,
  versions,
}: {
  projectId: string;
  implementationDate: string | null;
  roles: Role[];
  rateLookupByVersion: Record<string, Record<string, number>>;
  rateLookupForNew: Record<string, number>;
  versions: VersionRow[];
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const sortedVersions = [...versions].sort((a, b) =>
    a.periodStart.localeCompare(b.periodStart),
  );
  const active = sortedVersions.find((v) => v.supersededAt === null);
  const [editingId, setEditingId] = useState<string | null>(active?.id ?? null);
  const editing = sortedVersions.find((v) => v.id === editingId) ?? null;

  const realized = useMemo(
    () =>
      realizedAcrossVersions({
        versions: sortedVersions.map((v) => ({
          periodStart: new Date(v.periodStart),
          supersededAt: v.supersededAt ? new Date(v.supersededAt) : null,
          annualSavedUsd: v.annualSavedUsd,
        })),
        asOfDate: new Date(),
      }),
    [sortedVersions],
  );

  const dueForReview =
    !!active?.nextReviewDate &&
    new Date(active.nextReviewDate).getTime() <= Date.now();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Realized $ to date" value={formatUsd(realized)} accent />
        <Kpi
          label="Currently annualizing"
          value={active ? formatUsd(active.annualSavedUsd) : "—"}
        />
        <Kpi
          label="Currently annual hours"
          value={active ? formatNumber(active.annualSavedHours) : "—"}
        />
        <Kpi label="Versions" value={String(sortedVersions.length)} />
      </div>

      {dueForReview && active && (
        <ReviewDueBanner projectId={projectId} activeVersion={active} />
      )}

      <Timeline
        versions={sortedVersions}
        today={today}
        editingId={editingId}
        onEdit={setEditingId}
      />

      {editing ? (
        <VersionEditor
          key={editing.id}
          projectId={projectId}
          version={editing}
          isActive={editing.supersededAt === null}
          roles={roles}
          rateLookup={rateLookupByVersion[editing.id] ?? {}}
          today={today}
          onSaved={() => router.refresh()}
        />
      ) : null}

      {!active && (
        <FirstVersionForm
          projectId={projectId}
          implementationDate={implementationDate}
          roles={roles}
          rateLookup={rateLookupForNew}
          onSaved={() => router.refresh()}
        />
      )}

      {active && (
        <NewVersionForm
          projectId={projectId}
          previousVersion={active}
          roles={roles}
          rateLookup={rateLookupForNew}
          today={today}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────
function Timeline({
  versions,
  today,
  editingId,
  onEdit,
}: {
  versions: VersionRow[];
  today: string;
  editingId: string | null;
  onEdit: (id: string) => void;
}) {
  if (versions.length === 0) return null;
  return (
    <div className="v3-card v3-card-pad">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>ROI versions</h3>
        <span className="v3-muted" style={{ fontSize: 12 }}>
          Click Edit on any version — including prior ones — to revise it.
        </span>
      </div>
      <ol className="space-y-2">
        {versions.map((v) => {
          const isActive = v.supersededAt === null;
          const isEditing = v.id === editingId;
          const end = v.supersededAt ?? today;
          const dueForReview =
            isActive &&
            v.nextReviewDate &&
            new Date(v.nextReviewDate).getTime() <= Date.now();
          return (
            <li
              key={v.id}
              className={`flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                isEditing
                  ? "border-brand bg-brand-subtle"
                  : isActive
                    ? dueForReview
                      ? "border-amber-300 bg-amber-50"
                      : "border-emerald-300 bg-emerald-50"
                    : "border-surface-border bg-surface-subtle"
              }`}
            >
              <span
                className={`pill ${
                  isActive
                    ? dueForReview
                      ? "bg-amber-200 text-amber-900"
                      : "bg-emerald-200 text-emerald-900"
                    : "bg-neutral-200 text-neutral-700"
                }`}
              >
                {v.versionLabel}
              </span>
              <div className="text-sm">
                <span className="font-medium">{formatDate(v.periodStart)}</span>
                <span className="mx-2 text-ink-soft">→</span>
                <span className={isActive ? "font-medium" : ""}>
                  {isActive ? "now" : formatDate(v.supersededAt)}
                </span>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
                <span>
                  <span className="text-ink-subtle">Annualized: </span>
                  <span className="font-medium">
                    {formatUsd(v.annualSavedUsd)}
                  </span>
                </span>
                {isActive ? (
                  <span className="text-xs text-ink-subtle">
                    {v.nextReviewDate
                      ? `Next review ${formatDate(v.nextReviewDate)}`
                      : "No review date"}
                  </span>
                ) : (
                  <span className="text-xs text-ink-subtle">
                    Spanned {daysSpan(v.periodStart, end)} days
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onEdit(v.id)}
                  disabled={isEditing}
                  className="v3-btn-ghost v3-btn-sm disabled:opacity-50"
                >
                  {isEditing ? "Editing" : "Edit"}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function daysSpan(a: string, b: string) {
  return Math.max(
    0,
    Math.round(
      (new Date(b).getTime() - new Date(a).getTime()) / (24 * 60 * 60 * 1000),
    ),
  );
}

function ReviewDueBanner({
  projectId,
  activeVersion,
}: {
  projectId: string;
  activeVersion: VersionRow;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pushOutOneYear() {
    setError(null);
    const next = new Date(activeVersion.nextReviewDate ?? new Date());
    next.setUTCFullYear(next.getUTCFullYear() + 1);
    start(async () => {
      const res = await setReviewDateAction({
        projectId,
        nextReviewDate: next.toISOString().slice(0, 10),
      });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-amber-900">Review due</div>
          <p className="mt-1 text-sm text-amber-800">
            {activeVersion.versionLabel} was scheduled for review on{" "}
            <span className="font-medium">
              {formatDate(activeVersion.nextReviewDate)}
            </span>
            . Revise the active version, create a new one, or push the review
            out a year.
          </p>
        </div>
        <button onClick={pushOutOneYear} disabled={pending} className="v3-btn-outline">
          {pending ? "Saving…" : "Push out 1 year"}
        </button>
      </div>
      {error && <div className="mt-2 text-sm text-rose-700">{error}</div>}
    </div>
  );
}

// ─── Version editor (active or prior) ─────────────────────────────────────
function VersionEditor({
  projectId,
  version,
  isActive,
  roles,
  rateLookup,
  today,
  onSaved,
}: {
  projectId: string;
  version: VersionRow;
  isActive: boolean;
  roles: Role[];
  rateLookup: Record<string, number>;
  today: string;
  onSaved: () => void;
}) {
  const [steps, setSteps] = useState<StepDraft[]>(version.steps);
  const [reviewDate, setReviewDate] = useState<string>(
    version.nextReviewDate ?? "",
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const preview = useMemo(
    () =>
      computeRoi(
        steps.map((s) => ({
          baselineHours: Number(s.baselineHours) || 0,
          newHours: Number(s.newHours) || 0,
          qualityIncreaseHours: Number(s.qualityIncreaseHours) || 0,
          freqPerYear: Number(s.freqPerYear) || 0,
          hourlyRate: rateLookup[s.roleCode] ?? 0,
        })),
      ),
    [steps, rateLookup],
  );

  function save() {
    setError(null);
    setSuccess(null);
    start(async () => {
      const res = await reviseVersionAction({
        versionId: version.id,
        projectId,
        steps,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (isActive && reviewDate !== (version.nextReviewDate ?? "")) {
        await setReviewDateAction({
          projectId,
          nextReviewDate: reviewDate || null,
        });
      }
      setSuccess("Saved.");
      onSaved();
    });
  }

  return (
    <section className="v3-card v3-card-pad space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            Editing {version.versionLabel}
            {isActive ? " (active)" : " (prior — historical record)"}
          </h3>
          <p className="text-xs text-ink-subtle">
            In effect from {formatDate(version.periodStart)}
            {version.supersededAt
              ? ` to ${formatDate(version.supersededAt)}`
              : " — currently active"}
            . Rates resolve as of this version's period start, not today.
          </p>
        </div>
        <button onClick={save} disabled={pending} className="v3-btn-primary">
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Readonly label="Period start" value={formatDate(version.periodStart)} />
        <Readonly
          label="Period end"
          value={isActive ? "Currently active" : formatDate(version.supersededAt)}
        />
        {isActive ? (
          <label className="block">
            <div className="v3-label-uc mb-1">Next review date</div>
            <input
              type="date"
              className="v3-input"
              value={reviewDate}
              min={today}
              onChange={(e) => setReviewDate(e.target.value)}
            />
          </label>
        ) : (
          <Readonly label="Next review date" value="—" />
        )}
      </div>

      <StepsGrid
        steps={steps}
        setSteps={setSteps}
        roles={roles}
        rateLookup={rateLookup}
        preview={preview}
      />
      <KpiStrip totals={preview.totals} />
      {error && (
        <div className="rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">
          {success}
        </div>
      )}
    </section>
  );
}

function FirstVersionForm({
  projectId,
  implementationDate,
  roles,
  rateLookup,
  onSaved,
}: {
  projectId: string;
  implementationDate: string | null;
  roles: Role[];
  rateLookup: Record<string, number>;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [periodStart, setPeriodStart] = useState(implementationDate ?? today);
  const [reviewDate, setReviewDate] = useState(() => {
    const d = new Date(implementationDate ?? today);
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [steps, setSteps] = useState<StepDraft[]>([
    { ...EMPTY_STEP, roleCode: roles[0]?.roleCode ?? "" },
  ]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(
    () =>
      computeRoi(
        steps.map((s) => ({
          baselineHours: Number(s.baselineHours) || 0,
          newHours: Number(s.newHours) || 0,
          qualityIncreaseHours: Number(s.qualityIncreaseHours) || 0,
          freqPerYear: Number(s.freqPerYear) || 0,
          hourlyRate: rateLookup[s.roleCode] ?? 0,
        })),
      ),
    [steps, rateLookup],
  );

  function save() {
    setError(null);
    start(async () => {
      const res = await saveRoiAction({
        projectId,
        versionLabel: "V1",
        periodStart,
        nextReviewDate: reviewDate || null,
        steps,
      });
      if (!res.ok) setError(res.error);
      else onSaved();
    });
  }

  return (
    <section className="v3-card v3-card-pad space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            Create first ROI version (V1)
          </h3>
          <p className="text-xs text-ink-subtle">
            Hourly rates resolve as of the period start.
          </p>
        </div>
        <button onClick={save} disabled={pending} className="v3-btn-primary">
          {pending ? "Saving…" : "Save V1"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="block">
          <div className="v3-label-uc mb-1">Period start</div>
          <input
            type="date"
            className="v3-input"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
          />
        </label>
        <label className="block">
          <div className="v3-label-uc mb-1">Next review date</div>
          <input
            type="date"
            className="v3-input"
            value={reviewDate}
            onChange={(e) => setReviewDate(e.target.value)}
          />
        </label>
        <div />
      </div>

      <StepsGrid
        steps={steps}
        setSteps={setSteps}
        roles={roles}
        rateLookup={rateLookup}
        preview={preview}
      />
      <KpiStrip totals={preview.totals} />
      {error && (
        <div className="rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
          {error}
        </div>
      )}
    </section>
  );
}

function NewVersionForm({
  projectId,
  previousVersion,
  roles,
  rateLookup,
  today,
  onSaved,
}: {
  projectId: string;
  previousVersion: VersionRow;
  roles: Role[];
  rateLookup: Record<string, number>;
  today: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState(today);
  const [reviewDate, setReviewDate] = useState(() => {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [steps, setSteps] = useState<StepDraft[]>(previousVersion.steps);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const nextLabel = useMemo(
    () =>
      `V${parseInt(previousVersion.versionLabel.replace(/\D/g, "") || "1", 10) + 1}`,
    [previousVersion.versionLabel],
  );

  const preview = useMemo(
    () =>
      computeRoi(
        steps.map((s) => ({
          baselineHours: Number(s.baselineHours) || 0,
          newHours: Number(s.newHours) || 0,
          qualityIncreaseHours: Number(s.qualityIncreaseHours) || 0,
          freqPerYear: Number(s.freqPerYear) || 0,
          hourlyRate: rateLookup[s.roleCode] ?? 0,
        })),
      ),
    [steps, rateLookup],
  );

  function save() {
    setError(null);
    start(async () => {
      const res = await saveRoiAction({
        projectId,
        versionLabel: nextLabel,
        periodStart,
        nextReviewDate: reviewDate || null,
        steps,
      });
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        onSaved();
      }
    });
  }

  if (!open) {
    return (
      <div
        className="p-4 text-center"
        style={{
          border: "1px dashed var(--hairline-strong)",
          borderRadius: 10,
          background: "var(--bg-sunken)",
        }}
      >
        <button
          onClick={() => setOpen(true)}
          className="link"
          style={{ fontSize: 13, fontWeight: 500 }}
        >
          + Create new version ({nextLabel})
        </button>
        <p className="v3-muted mt-1" style={{ fontSize: 11.5 }}>
          The current version's period ends on the new version's start date.
        </p>
      </div>
    );
  }

  return (
    <section className="v3-card v3-card-pad space-y-4" style={{ borderColor: "var(--a)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Create {nextLabel}</h3>
          <p className="text-xs text-ink-subtle">
            Steps default from {previousVersion.versionLabel}. Hourly rates
            resolve as of the new period start.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setOpen(false)} className="v3-btn-outline">
            Cancel
          </button>
          <button onClick={save} disabled={pending} className="v3-btn-primary">
            {pending ? "Saving…" : `Save ${nextLabel}`}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="block">
          <div className="v3-label-uc mb-1">
            Period start (closes {previousVersion.versionLabel})
          </div>
          <input
            type="date"
            className="v3-input"
            value={periodStart}
            min={previousVersion.periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
          />
        </label>
        <label className="block">
          <div className="v3-label-uc mb-1">Next review date</div>
          <input
            type="date"
            className="v3-input"
            value={reviewDate}
            onChange={(e) => setReviewDate(e.target.value)}
          />
        </label>
        <div />
      </div>

      <StepsGrid
        steps={steps}
        setSteps={setSteps}
        roles={roles}
        rateLookup={rateLookup}
        preview={preview}
      />
      <KpiStrip totals={preview.totals} />
      {error && (
        <div className="rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
          {error}
        </div>
      )}
    </section>
  );
}

function StepsGrid({
  steps,
  setSteps,
  roles,
  rateLookup,
  preview,
}: {
  steps: StepDraft[];
  setSteps: (s: StepDraft[]) => void;
  roles: Role[];
  rateLookup: Record<string, number>;
  preview: ReturnType<typeof computeRoi>;
}) {
  function update(i: number, patch: Partial<StepDraft>) {
    const next = [...steps];
    next[i] = { ...next[i], ...patch };
    setSteps(next);
  }
  function add() {
    setSteps([
      ...steps,
      { ...EMPTY_STEP, roleCode: roles[0]?.roleCode ?? "" },
    ]);
  }
  function remove(i: number) {
    setSteps(steps.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div className="v3-card overflow-x-auto">
        <table className="v3-data-table">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th className="min-w-[200px]">Step</th>
              <th className="min-w-[180px]">Role</th>
              <th className="r">Freq/yr</th>
              <th className="r">Baseline hrs</th>
              <th className="r">New hrs</th>
              <th className="r">Quality hrs</th>
              <th className="r">Rate</th>
              <th className="r">$ saved</th>
              <th className="r">Eff.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s, i) => {
              const r = preview.steps[i];
              return (
                <tr key={i}>
                  <td className="v3-muted-2">{i + 1}</td>
                  <td>
                    <input
                      className="v3-input"
                      value={s.name}
                      onChange={(e) => update(i, { name: e.target.value })}
                      placeholder="e.g. Extract invoice fields"
                    />
                  </td>
                  <td>
                    <select
                      className="v3-input"
                      value={s.roleCode}
                      onChange={(e) => update(i, { roleCode: e.target.value })}
                    >
                      <option value="">— role —</option>
                      {roles.map((r) => (
                        <option key={r.roleCode} value={r.roleCode}>
                          {r.displayName}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      className="v3-input text-right"
                      value={s.freqPerYear}
                      onChange={(e) =>
                        update(i, { freqPerYear: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      className="v3-input text-right"
                      value={s.baselineHours}
                      onChange={(e) =>
                        update(i, { baselineHours: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      className="v3-input text-right"
                      value={s.newHours}
                      onChange={(e) =>
                        update(i, { newHours: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      className="v3-input text-right"
                      value={s.qualityIncreaseHours}
                      onChange={(e) =>
                        update(i, {
                          qualityIncreaseHours: Number(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td className="r v3-muted">
                    {rateLookup[s.roleCode]
                      ? formatUsd(rateLookup[s.roleCode])
                      : "—"}
                  </td>
                  <td className="r" style={{ fontWeight: 600 }}>
                    {formatUsd(r.annualSavedUsd)}
                  </td>
                  <td className="r">
                    {formatPct(r.efficiencyGainPct)}
                  </td>
                  <td className="r">
                    <button
                      onClick={() => remove(i)}
                      className="text-xs text-rose-600 hover:underline"
                    >
                      remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-right">
        <button onClick={add} className="v3-btn-outline">
          + Add step
        </button>
      </div>
    </div>
  );
}

function KpiStrip({
  totals,
}: {
  totals: {
    annualSavedUsd: number;
    annualSavedHours: number;
    annualQualityUsd: number;
    annualQualityHours: number;
  };
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Kpi label="Annual $ saved" value={formatUsd(totals.annualSavedUsd)} />
      <Kpi
        label="Annual hours saved"
        value={formatNumber(totals.annualSavedHours)}
      />
      <Kpi label="Quality $ / yr" value={formatUsd(totals.annualQualityUsd)} />
      <Kpi
        label="Quality hours"
        value={formatNumber(totals.annualQualityHours)}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="v3-kpi">
      <div className="v3-kpi-label">{label}</div>
      <div
        className="v3-kpi-value"
        style={accent ? { color: "var(--a)" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function Readonly({ label, value }: { label: string; value: string }) {
  return (
    <div className="block">
      <div className="v3-label-uc mb-1">{label}</div>
      <div className="v3-input flex items-center v3-muted">{value}</div>
    </div>
  );
}
