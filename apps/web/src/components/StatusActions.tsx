"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { transitionStatusAction } from "@/domains/projects/actions";
import {
  legalNext,
  type ProjectStatus,
  type Tier,
} from "@/domains/governance/state-machine";
import { statusLabel } from "@/lib/display";

export function StatusActions({
  projectId,
  status,
  tier,
}: {
  projectId: string;
  status: ProjectStatus;
  tier: Tier | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next = legalNext(status, tier);

  if (next.length === 0) return null;

  function go(to: ProjectStatus) {
    setError(null);
    startTransition(async () => {
      const res = await transitionStatusAction({ id: projectId, to });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {next.map((t) => (
        <button
          key={t}
          onClick={() => go(t)}
          disabled={pending}
          className="rounded-md border border-surface-border bg-surface px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-surface-subtle hover:text-gray-900"
        >
          → {statusLabel(t)}
        </button>
      ))}
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
