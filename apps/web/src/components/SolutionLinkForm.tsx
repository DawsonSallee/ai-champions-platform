"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSolutionLinkAction } from "@/domains/artifacts/actions";

const LINK_TYPES = [
  { v: "github_repo", l: "GitHub repository" },
  { v: "low_code_portal", l: "Low-code portal (Power Automate / Apps / Copilot)" },
  { v: "bi_dashboard", l: "BI dashboard" },
  { v: "blob_file", l: "Blob-stored file" },
  { v: "other", l: "Other" },
] as const;

export function SolutionLinkForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [state, setState] = useState({
    linkType: "github_repo" as (typeof LINK_TYPES)[number]["v"],
    url: "",
    label: "",
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await addSolutionLinkAction({
        projectId,
        linkType: state.linkType,
        url: state.url,
        label: state.label || undefined,
      });
      if (!res.ok) setError(res.error);
      else {
        setState({ ...state, url: "", label: "" });
        router.refresh();
      }
    });
  }

  return (
    <div className="card p-4 space-y-3 text-sm">
      <h3 className="section-title">Add solution link</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <select
          className="input"
          value={state.linkType}
          onChange={(e) =>
            setState({ ...state, linkType: e.target.value as typeof state.linkType })
          }
        >
          {LINK_TYPES.map((t) => (
            <option key={t.v} value={t.v}>
              {t.l}
            </option>
          ))}
        </select>
        <input
          className="input md:col-span-2"
          placeholder="https://..."
          value={state.url}
          onChange={(e) => setState({ ...state, url: e.target.value })}
        />
      </div>
      <input
        className="input"
        placeholder="Label (optional)"
        value={state.label}
        onChange={(e) => setState({ ...state, label: e.target.value })}
      />
      {error && <div className="text-red-600">{error}</div>}
      <button onClick={submit} disabled={pending || !state.url} className="btn-primary">
        {pending ? "Adding…" : "Add link"}
      </button>
    </div>
  );
}
