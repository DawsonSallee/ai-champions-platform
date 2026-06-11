"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { TierBadge } from "@/components/TierBadge";
import { formatDate } from "@/lib/dates";
import { formatUsd } from "@/lib/money";
import { statusLabel } from "@/lib/display";
import type { ProjectStatus, Tier } from "@/domains/projects/schema";

export type BacklogRow = {
  id: string;
  title: string;
  businessUnitCode: string | null;
  complexityTier: Tier | null;
  status: ProjectStatus;
  championName: string | null;
  updatedAt: string; // ISO
  annualSavingsUsd: number | null;
};

const TIERS: Tier[] = ["1A", "1B", "1C", "2", "3"];

const STATUS_GROUPS: { label: string; values: ProjectStatus[] }[] = [
  {
    label: "Active",
    values: [
      "NewIdea",
      "IntakeSubmitted",
      "UnderReview",
      "ITApprovalPending",
      "ITApproved",
      "InProgress",
      "AITeamReview",
    ],
  },
  { label: "Completed", values: ["Completed"] },
  { label: "Rejected", values: ["Rejected"] },
  { label: "Decommissioned", values: ["Decommissioned"] },
];

export function BacklogTable({ rows }: { rows: BacklogRow[] }) {
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<Tier | null>(null);
  const [statusGroup, setStatusGroup] = useState<string | null>(null);
  const [buFilter, setBuFilter] = useState<string | null>(null);

  const allBus = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.businessUnitCode).filter(Boolean))) as string[],
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (tierFilter && r.complexityTier !== tierFilter) return false;
      if (buFilter && r.businessUnitCode !== buFilter) return false;
      if (statusGroup) {
        const group = STATUS_GROUPS.find((g) => g.label === statusGroup);
        if (group && !group.values.includes(r.status)) return false;
      }
      if (q) {
        const hay = `${r.title} ${r.championName ?? ""} ${r.businessUnitCode ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, tierFilter, statusGroup, buFilter]);

  const totalAnnual = filtered.reduce(
    (acc, r) => acc + (r.annualSavingsUsd ?? 0),
    0,
  );

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="v3-card v3-card-pad space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, champion, BU…"
            className="v3-input flex-1 min-w-[12rem]"
          />
          <select
            value={buFilter ?? ""}
            onChange={(e) => setBuFilter(e.target.value || null)}
            className="v3-sort-select w-40"
          >
            <option value="">All business units</option>
            {allBus.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="All tiers"
            active={tierFilter === null}
            onClick={() => setTierFilter(null)}
          />
          {TIERS.map((t) => (
            <FilterChip
              key={t}
              label={`Tier ${t}`}
              active={tierFilter === t}
              onClick={() => setTierFilter(tierFilter === t ? null : t)}
            />
          ))}
          <span
            style={{ width: 1, height: 22, background: "var(--hairline)", margin: "0 6px" }}
          />
          <FilterChip
            label="All statuses"
            active={statusGroup === null}
            onClick={() => setStatusGroup(null)}
          />
          {STATUS_GROUPS.map((g) => (
            <FilterChip
              key={g.label}
              label={g.label}
              active={statusGroup === g.label}
              onClick={() =>
                setStatusGroup(statusGroup === g.label ? null : g.label)
              }
            />
          ))}
        </div>
        <div className="v3-muted flex items-center justify-between" style={{ fontSize: 12 }}>
          <span>
            {filtered.length} project{filtered.length === 1 ? "" : "s"}
            {filtered.length !== rows.length ? ` of ${rows.length}` : ""}
          </span>
          <span>
            Annualized $:{" "}
            <span className="mono" style={{ fontWeight: 600, color: "var(--ink)" }}>
              {formatUsd(totalAnnual)}
            </span>
          </span>
        </div>
      </div>

      <div className="v3-card" style={{ overflow: "hidden" }}>
        <table className="v3-data-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>BU</th>
              <th>Tier</th>
              <th>Status</th>
              <th>Champion</th>
              <th className="r">Annualized $</th>
              <th className="r">Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((p) => (
                <tr key={p.id} className="row">
                  <td data-label="Project" className="cell-title">
                    <Link href={`/projects/${p.id}`} className="v3-row-title">
                      {p.title}
                    </Link>
                  </td>
                  <td data-label="BU">{p.businessUnitCode ?? "—"}</td>
                  <td data-label="Tier">
                    <TierBadge tier={p.complexityTier} />
                  </td>
                  <td data-label="Status">
                    <StatusBadge status={p.status} />
                  </td>
                  <td data-label="Champion">
                    {p.championName ?? (
                      <span className="v3-muted-2">unassigned</span>
                    )}
                  </td>
                  <td data-label="Annualized $" className="r">
                    {p.annualSavingsUsd ? formatUsd(p.annualSavingsUsd) : "—"}
                  </td>
                  <td data-label="Updated" className="r">
                    {formatDate(p.updatedAt)}
                    <span className="row-arrow">→</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <div className="v3-empty">
                    <div className="icon">∅</div>
                    <div className="msg">No projects match the current filters</div>
                    <div className="sub">Try removing a filter.</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="v3-muted-2" style={{ fontSize: 11.5, marginTop: 8 }}>
        Showing {filtered.length} of {rows.length} projects. Status meanings:{" "}
        {STATUS_GROUPS[0].values.map(statusLabel).slice(0, 3).join(", ")}, etc.
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`v3-chip${active ? " active" : ""}`}
    >
      {label}
    </button>
  );
}
