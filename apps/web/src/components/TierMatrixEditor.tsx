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
          <h3 className="v3-label-uc">Required reviewers by tier</h3>
          <span className="v3-muted" style={{ fontSize: 12 }}>
            Click a cell to toggle. SLA in business days.
          </span>
        </div>
        <div
          className="overflow-x-auto"
          style={{ border: "1px solid var(--hairline)", borderRadius: 10 }}
        >
          <table className="v3-data-table">
            <thead>
              <tr>
                <th>Reviewer role</th>
                {TIER_ORDER.map((t) => (
                  <th key={t} style={{ textAlign: "center" }}>
                    Tier {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reviewerRoles.map((rr) => (
                <tr key={rr.code}>
                  <td style={{ fontWeight: 500 }}>{rr.displayName}</td>
                  {TIER_ORDER.map((t) => {
                    const row = grid.get(`${t}::${rr.code}`);
                    return (
                      <td key={t} style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => toggle(t, rr.code)}
                          disabled={pending}
                          className="mx-auto block h-6 w-6 rounded-full"
                          style={
                            row
                              ? {
                                  border: "1px solid var(--a)",
                                  background: "var(--a)",
                                  color: "var(--a-fg)",
                                }
                              : {
                                  border: "1px solid var(--hairline-strong)",
                                  background: "var(--surface)",
                                  color: "transparent",
                                }
                          }
                          title={row ? "Required — click to remove" : "Click to require"}
                        >
                          ✓
                        </button>
                        {row && (
                          <div className="v3-muted mt-1 flex items-center justify-center gap-1" style={{ fontSize: 10 }}>
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
                              className="mono w-10 text-center"
                              style={{
                                border: "1px solid var(--hairline-strong)",
                                borderRadius: 4,
                                background: "var(--surface)",
                                padding: "1px 2px",
                                fontSize: 11,
                              }}
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
        <h3 className="v3-label-uc mb-2">People in reviewer roles</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {reviewerRoles.map((rr) => {
            const list = byRole.get(rr.code) ?? [];
            return (
              <div key={rr.code} className="v3-card" style={{ padding: 12 }}>
                <div className="mb-2 flex items-baseline justify-between">
                  <div style={{ fontWeight: 500, fontSize: 13.5 }}>{rr.displayName}</div>
                  <span className="v3-muted" style={{ fontSize: 12 }}>
                    {list.length} {list.length === 1 ? "person" : "people"}
                  </span>
                </div>
                {list.length === 0 ? (
                  <div className="v3-muted" style={{ fontSize: 12 }}>No holders yet.</div>
                ) : (
                  <ul className="space-y-1.5" style={{ fontSize: 13 }}>
                    {list.map((h, i) => (
                      <li key={i} className="flex items-center justify-between">
                        <span>{h.userName}</span>
                        <a
                          href={`mailto:${h.userEmail}`}
                          className="v3-muted"
                          style={{ fontSize: 12 }}
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
        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          style={{
            border: "1px dashed var(--hairline-strong)",
            borderRadius: 10,
            background: "var(--bg-sunken)",
            padding: 12,
          }}
        >
          <span className="v3-muted" style={{ fontSize: 12, fontWeight: 500 }}>Assign:</span>
          <input
            type="email"
            className="v3-input max-w-[16rem]"
            placeholder="user@example.com"
            value={newHolder.email}
            onChange={(e) =>
              setNewHolder({ ...newHolder, email: e.target.value })
            }
          />
          <span className="v3-muted" style={{ fontSize: 12 }}>to</span>
          <select
            className="v3-sort-select max-w-[14rem]"
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
            className="v3-btn-primary"
          >
            Add
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
