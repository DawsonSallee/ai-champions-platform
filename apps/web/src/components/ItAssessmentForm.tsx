"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitItAssessmentAction } from "@/domains/governance/actions";

type Initial = Partial<{
  dataClassification: "Public" | "Internal" | "Confidential" | "Restricted";
  dataFlowFrom: string;
  dataFlowTo: string;
  recordsPerDay: number;
  toolingType: string;
  hostingLocation: string;
  authMethod: string;
  llmSource: string;
  llmTrainingRisk: boolean;
  businessImpact: "Low" | "Medium" | "High";
  manualWorkaround: string;
}>;

export function ItAssessmentForm({
  projectId,
  initial,
}: {
  projectId: string;
  initial: Initial;
}) {
  const router = useRouter();
  const [state, setState] = useState<Initial>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function update<K extends keyof Initial>(k: K, v: Initial[K]) {
    setState((p) => ({ ...p, [k]: v }));
  }

  function submit() {
    setError(null);
    setOk(false);
    startTransition(async () => {
      const res = await submitItAssessmentAction({
        projectId,
        ...state,
        recordsPerDay:
          state.recordsPerDay === undefined ? undefined : Number(state.recordsPerDay),
      });
      if (!res.ok) setError(res.error);
      else {
        setOk(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="v3-card v3-card-pad space-y-5 text-sm">
      <Group label="Data classification">
        <Pills
          value={state.dataClassification}
          options={["Public", "Internal", "Confidential", "Restricted"]}
          onChange={(v) => update("dataClassification", v as Initial["dataClassification"])}
        />
      </Group>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Data flow — from">
          <input
            className="v3-input"
            value={state.dataFlowFrom ?? ""}
            onChange={(e) => update("dataFlowFrom", e.target.value)}
          />
        </Field>
        <Field label="Data flow — to">
          <input
            className="v3-input"
            value={state.dataFlowTo ?? ""}
            onChange={(e) => update("dataFlowTo", e.target.value)}
          />
        </Field>
        <Field label="Records per day">
          <input
            type="number"
            className="v3-input"
            value={state.recordsPerDay ?? ""}
            onChange={(e) =>
              update("recordsPerDay", e.target.value === "" ? undefined : Number(e.target.value))
            }
          />
        </Field>
        <Field label="Tooling type">
          <input
            className="v3-input"
            value={state.toolingType ?? ""}
            onChange={(e) => update("toolingType", e.target.value)}
          />
        </Field>
        <Field label="Hosting location">
          <input
            className="v3-input"
            value={state.hostingLocation ?? ""}
            onChange={(e) => update("hostingLocation", e.target.value)}
          />
        </Field>
        <Field label="Auth method">
          <input
            className="v3-input"
            value={state.authMethod ?? ""}
            onChange={(e) => update("authMethod", e.target.value)}
          />
        </Field>
        <Field label="LLM source">
          <input
            className="v3-input"
            placeholder="Azure OpenAI / OpenAI / Anthropic / Internal / none"
            value={state.llmSource ?? ""}
            onChange={(e) => update("llmSource", e.target.value)}
          />
        </Field>
        <Group label="Enercon data used to train public model?">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.llmTrainingRisk ?? false}
              onChange={(e) => update("llmTrainingRisk", e.target.checked)}
            />
            <span>Yes (this is a red flag — IT will scrutinize)</span>
          </label>
        </Group>
      </div>
      <Group label="Business impact if the tool fails">
        <Pills
          value={state.businessImpact}
          options={["Low", "Medium", "High"]}
          onChange={(v) => update("businessImpact", v as Initial["businessImpact"])}
        />
      </Group>
      <Field label="Manual workaround">
        <textarea
          rows={3}
          className="input"
          value={state.manualWorkaround ?? ""}
          onChange={(e) => update("manualWorkaround", e.target.value)}
        />
      </Field>
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-red-700">
          {error}
        </div>
      )}
      {ok && (
        <div className="rounded border border-green-200 bg-green-50 p-2 text-green-700">
          Saved.
        </div>
      )}
      <button onClick={submit} disabled={pending} className="v3-btn-primary">
        {pending ? "Saving…" : "Save assessment"}
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="v3-label-uc mb-1">{label}</div>
      {children}
    </label>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="v3-label-uc mb-2">{label}</div>
      {children}
    </div>
  );
}

function Pills({
  value,
  options,
  onChange,
}: {
  value: string | undefined;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`v3-chip${value === o ? " active" : ""}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
