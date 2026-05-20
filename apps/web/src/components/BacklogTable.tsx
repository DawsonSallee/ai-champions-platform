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
      <div className="card p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, champion, BU…"
            className="input flex-1 min-w-[12rem]"
          />
          <select
            value={buFilter ?? ""}
            onChange={(e) => setBuFilter(e.target.value || null)}
            className="input w-40"
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
          <span className="mx-2 h-4 w-px bg-surface-border" />
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
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {filtered.length} project{filtered.length === 1 ? "" : "s"}
            {filtered.length !== rows.length ? ` of ${rows.length}` : ""}
          </span>
          <span>
            Annualized $:{" "}
            <span className="font-medium text-gray-900">
              {formatUsd(totalAnnual)}
            </span>
          </span>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle text-left text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">BU</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Champion</th>
              <th className="px-4 py-3 text-right">Annualized $</th>
              <th className="px-4 py-3 text-right">Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-surface-border transition-colors hover:bg-surface-subtle"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${p.id}`}
                      className="font-medium text-gray-900 hover:text-brand"
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {p.businessUnitCode ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <TierBadge tier={p.complexityTier} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {p.championName ?? <span className="text-gray-400">unassigned</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {p.annualSavingsUsd ? formatUsd(p.annualSavingsUsd) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {formatDate(p.updatedAt)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  No projects match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-gray-400 mt-2">
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
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-brand text-brand-fg"
          : "bg-surface-subtle text-gray-700 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );
}
