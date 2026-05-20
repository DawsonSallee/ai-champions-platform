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
        <section className="card p-5 space-y-3">
          <h2 className="section-title">Project</h2>
          <div>
            <label className="label">Title</label>
            <input
              className="input mt-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Invoice intake bot for Accounts Payable"
            />
          </div>
          <div>
            <label className="label">Business unit</label>
            <select
              className="input mt-1"
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
            <label className="label">Problem statement</label>
            <textarea
              className="input mt-1"
              rows={3}
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="What manual pain are we removing, for whom, how often?"
            />
          </div>
        </section>

        {Q_GROUPS.map((group) => (
          <section key={group.title} className="card p-5">
            <h2 className="section-title mb-3">{group.title}</h2>
            <div className="space-y-2">
              {group.items.map((it) => (
                <label
                  key={it.key}
                  className="flex items-start gap-3 rounded p-2 hover:bg-surface-subtle"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={a[it.key]}
                    onChange={(e) =>
                      setA((prev) => ({ ...prev, [it.key]: e.target.checked }))
                    }
                  />
                  <span className="text-sm">
                    <span className="font-medium">{it.label}</span>
                    {"help" in it && it.help ? (
                      <span className="block text-gray-500">{it.help}</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>

      <aside className="lg:col-span-1">
        <div className="card p-5 sticky top-6 space-y-4">
          <div>
            <div className="label">Assigned tier</div>
            <div className="mt-2 flex items-center gap-3">
              <TierBadge tier={decision.tier} className="text-base px-3 py-1" />
            </div>
          </div>
          <div>
            <div className="label">Why</div>
            <p className="mt-1 text-sm text-gray-700">{decision.rationale}</p>
          </div>
          {decision.triggers.length > 0 && (
            <div>
              <div className="label">Triggers</div>
              <ul className="mt-1 list-disc pl-5 text-sm text-gray-700">
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
          <div className="border-t border-surface-border pt-4">
            <button
              type="button"
              onClick={onSubmit}
              className="btn-primary w-full justify-center"
              disabled={!title.trim() || !buCode || pending}
            >
              {pending ? "Submitting…" : "Submit intake"}
            </button>
            <p className="mt-2 text-xs text-gray-500">
              Submission opens the approval gate for Tier 1C / 2 / 3, or routes
              straight to build for Tier 1A / 1B.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
