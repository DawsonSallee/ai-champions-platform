"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  assignReviewerRoleAction,
  deleteTierMatrixRowAction,
  upsertTierMatrixRowAction,
} from "@/domains/governance/actions";

type Tier = "1A" | "1B" | "1C" | "2" | "3";

type Row = {
  tier: Tier;
  roleCode: string;
  roleName: string;
  required: boolean;
  sla: number;
};

const TIER_ORDER: Tier[] = ["1A", "1B", "1C", "2", "3"];

export function TierMatrixEditor({
  rows,
  reviewerRoles,
  holders,
}: {
  rows: Row[];
  reviewerRoles: { code: string; displayName: string }[];
  holders: { roleCode: string; roleName: string; userName: string; userEmail: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Build a [tier][roleCode] → Row lookup so we can render an editable grid.
  const grid = new Map<string, Row>();
  for (const r of rows) grid.set(`${r.tier}::${r.roleCode}`, r);

  function toggle(tier: Tier, roleCode: string) {
    const existing = grid.get(`${tier}::${roleCode}`);
    startTransition(async () => {
      if (existing) {
        await deleteTierMatrixRowAction({ tier, reviewerRoleCode: roleCode });
      } else {
        await upsertTierMatrixRowAction({
          tier,
          reviewerRoleCode: roleCode,
          required: true,
          slaBusinessDays: tier === "1B" ? 2 : tier === "1C" ? 3 : 5,
        });
      }
      router.refresh();
    });
  }

  function setSla(tier: Tier, roleCode: string, sla: number) {
    const existing = grid.get(`${tier}::${roleCode}`);
    if (!existing) return;
    startTransition(async () => {
      const res = await upsertTierMatrixRowAction({
        tier,
        reviewerRoleCode: roleCode,
        required: existing.required,
        slaBusinessDays: sla,
      });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  const [newHolder, setNewHolder] = useState({
    email: "",
    roleCode: reviewerRoles[0]?.code ?? "",
  });
  function assign() {
    setError(null);
    startTransition(async () => {
      const res = await assignReviewerRoleAction({
        email: newHolder.email,
        reviewerRoleCode: newHolder.roleCode,
      });
      if (!res.ok) setError(res.error);
      else {
        setNewHolder({ ...newHolder, email: "" });
        router.refresh();
      }
    });
  }

  // Group holders by reviewer role for tidy display.
  const byRole = new Map<string, typeof holders>();
  for (const h of holders) {
    if (!byRole.has(h.roleCode)) byRole.set(h.roleCode, []);
    byRole.get(h.roleCode)!.push(h);
  }

  return (
    <div className="space-y-8">
      {/* Matrix grid */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Required reviewers by tier
          </h3>
          <span className="text-xs text-gray-500">
            Click a cell to toggle. SLA in business days.
          </span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-surface-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-3 py-2">Reviewer role</th>
                {TIER_ORDER.map((t) => (
                  <th key={t} className="px-3 py-2 text-center">
                    Tier {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reviewerRoles.map((rr) => (
                <tr key={rr.code} className="border-t border-surface-border">
                  <td className="px-3 py-2 font-medium">{rr.displayName}</td>
                  {TIER_ORDER.map((t) => {
                    const row = grid.get(`${t}::${rr.code}`);
                    return (
                      <td key={t} className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggle(t, rr.code)}
                          disabled={pending}
                          className={`mx-auto block h-6 w-6 rounded-full border ${
                            row
                              ? "border-brand bg-brand text-brand-fg"
                              : "border-surface-border bg-surface text-transparent hover:border-gray-400"
                          }`}
                          title={row ? "Required — click to remove" : "Click to require"}
                        >
                          ✓
                        </button>
                        {row && (
                          <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-gray-500">
                            <input
                              type="number"
                              min={1}
                              max={30}
                              defaultValue={row.sla}
                              onBlur={(e) => {
                                const v = Number(e.target.value);
                                if (v !== row.sla && v >= 1)
                                  setSla(t, rr.code, v);
                              }}
                              className="w-10 rounded border border-surface-border bg-white px-1 py-0.5 text-center text-[11px]"
                              aria-label={`SLA days for ${rr.displayName} on Tier ${t}`}
                            />
                            <span>d</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Holders */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          People in reviewer roles
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {reviewerRoles.map((rr) => {
            const list = byRole.get(rr.code) ?? [];
            return (
              <div
                key={rr.code}
                className="rounded-lg border border-surface-border bg-surface p-3"
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <div className="font-medium text-sm">{rr.displayName}</div>
                  <span className="text-xs text-gray-500">
                    {list.length} {list.length === 1 ? "person" : "people"}
                  </span>
                </div>
                {list.length === 0 ? (
                  <div className="text-xs text-gray-500">No holders yet.</div>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {list.map((h, i) => (
                      <li key={i} className="flex items-center justify-between">
                        <span>{h.userName}</span>
                        <a
                          href={`mailto:${h.userEmail}`}
                          className="text-xs text-gray-500 hover:underline"
                        >
                          {h.userEmail}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-surface-border bg-surface-subtle p-3">
          <span className="text-xs font-medium text-gray-600">Assign:</span>
          <input
            type="email"
            className="input max-w-[16rem]"
            placeholder="user@example.com"
            value={newHolder.email}
            onChange={(e) =>
              setNewHolder({ ...newHolder, email: e.target.value })
            }
          />
          <span className="text-xs text-gray-600">to</span>
          <select
            className="input max-w-[14rem]"
            value={newHolder.roleCode}
            onChange={(e) =>
              setNewHolder({ ...newHolder, roleCode: e.target.value })
            }
          >
            {reviewerRoles.map((r) => (
              <option key={r.code} value={r.code}>
                {r.displayName}
              </option>
            ))}
          </select>
          <button
            onClick={assign}
            disabled={pending || !newHolder.email}
            className="btn-primary"
          >
            Add
          </button>
        </div>
      </div>

      {error && (
        <div className="card border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
