"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignTier, type IntakeAnswers } from "@/domains/intake/wizard";
import { submitIntakeAction } from "@/domains/intake/actions";
import { TierBadge } from "@/components/TierBadge";

const DEFAULTS: IntakeAnswers = {
  customizesBehavior: true,
  hasRestrictedData: false,
  hasErpWriteAccess: false,
  touchesHrSystem: false,
  trainsCustomAiModel: false,
  companyWideRollout: false,
  touchesNonM365: false,
  usesPremiumPlatformFeatures: false,
};

const Q_GROUPS = [
  {
    title: "1. Customization",
    items: [
      {
        key: "customizesBehavior" as const,
        label: "This build customizes behavior (forms, flows, scripts, or code)",
        help: "If no, this is Tier 1A — standard M365 self-service. No intake required.",
      },
    ],
  },
  {
    title: "2. High-risk attributes (any one escalates to Tier 3)",
    items: [
      {
        key: "hasRestrictedData" as const,
        label: "Handles restricted data (PII, financials, client confidential)",
      },
      { key: "hasErpWriteAccess" as const, label: "Writes to ERP systems (SAP, Oracle, Deltek)" },
      { key: "touchesHrSystem" as const, label: "Touches HR or payroll systems" },
      { key: "trainsCustomAiModel" as const, label: "Trains, fine-tunes, or hosts a custom AI/ML model" },
      { key: "companyWideRollout" as const, label: "Intended for company-wide rollout" },
    ],
  },
  {
    title: "3. External systems",
    items: [
      {
        key: "touchesNonM365" as const,
        label:
          "Integrates with anything outside the M365 tenant (Python, external APIs, third-party SaaS)",
      },
    ],
  },
  {
    title: "4. Premium platform features",
    items: [
      {
        key: "usesPremiumPlatformFeatures" as const,
        label:
          "Uses Power Apps, premium connectors, Dataverse, Power Pages, AI Builder, custom Power BI data sources, or SPFx",
      },
    ],
  },
] as const;

export function IntakeWizard({
  businessUnits,
}: {
  businessUnits: { code: string; displayName: string }[];
}) {
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const [buCode, setBuCode] = useState(businessUnits[0]?.code ?? "");
  const [a, setA] = useState<IntakeAnswers>(DEFAULTS);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const decision = useMemo(() => assignTier(a), [a]);

  function onSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await submitIntakeAction({
        title,
        problemStatement: problem,
        businessUnitCode: buCode,
        answers: a,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/projects/${res.data.projectId}`);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="v3-card v3-card-pad space-y-3">
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Project</h2>
          <div>
            <label className="v3-label-uc">Title</label>
            <input
              className="v3-input mt-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Invoice intake bot for Accounts Payable"
            />
          </div>
          <div>
            <label className="v3-label-uc">Business unit</label>
            <select
              className="v3-sort-select mt-1"
              style={{ width: "100%" }}
              value={buCode}
              onChange={(e) => setBuCode(e.target.value)}
            >
              {businessUnits.map((bu) => (
                <option key={bu.code} value={bu.code}>
                  {bu.displayName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="v3-label-uc">Problem statement</label>
            <textarea
              className="v3-input mt-1"
              rows={3}
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="What manual pain are we removing, for whom, how often?"
            />
          </div>
        </section>

        {Q_GROUPS.map((group) => (
          <section key={group.title} className="v3-card v3-card-pad">
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
              {group.title}
            </h2>
            <div className="space-y-2">
              {group.items.map((it) => (
                <label
                  key={it.key}
                  className="flex items-start gap-3 rounded p-2"
                  style={{ cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={a[it.key]}
                    onChange={(e) =>
                      setA((prev) => ({ ...prev, [it.key]: e.target.checked }))
                    }
                  />
                  <span style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 500 }}>{it.label}</span>
                    {"help" in it && it.help ? (
                      <span className="v3-muted" style={{ display: "block" }}>
                        {it.help}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>

      <aside className="lg:col-span-1">
        <div className="v3-card v3-card-pad sticky top-6 space-y-4">
          <div>
            <div className="v3-label-uc">Assigned tier</div>
            <div className="mt-2 flex items-center gap-3">
              <TierBadge tier={decision.tier} className="text-base px-3 py-1" />
            </div>
          </div>
          <div>
            <div className="v3-label-uc">Why</div>
            <p className="mt-1" style={{ fontSize: 13, color: "var(--ink-2)" }}>
              {decision.rationale}
            </p>
          </div>
          {decision.triggers.length > 0 && (
            <div>
              <div className="v3-label-uc">Triggers</div>
              <ul
                className="mt-1 list-disc pl-5"
                style={{ fontSize: 13, color: "var(--ink-2)" }}
              >
                {decision.triggers.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 16 }}>
            <button
              type="button"
              onClick={onSubmit}
              className="v3-btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={!title.trim() || !buCode || pending}
            >
              {pending ? "Submitting…" : "Submit intake"}
            </button>
            <p className="v3-muted mt-2" style={{ fontSize: 11.5 }}>
              Submission opens the approval gate for Tier 1C / 2 / 3, or routes
              straight to build for Tier 1A / 1B.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
