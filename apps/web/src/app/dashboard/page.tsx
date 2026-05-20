import Link from "next/link";
import {
  getChampionLeaderboard,
  getKpis,
  getMonthlyRealizedSeries,
  getProjectTitlesByIds,
  getRealizedByBusinessUnit,
  getRecentActivity,
  getStatusDistribution,
  getTierDistribution,
} from "@/domains/dashboards/service";
import { DbDownBanner } from "@/components/DbDownBanner";
import { safe } from "@/lib/safe-query";
import { formatNumber, formatUsd } from "@/lib/money";
import { actionLabel, statusLabel } from "@/lib/display";
import {
  RealizedByBuChart,
  RealizedTrendChart,
  StatusDonut,
  TierBarChart,
} from "@/components/DashboardCharts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [
    kpis,
    monthly,
    realizedByBu,
    statusMix,
    tierMix,
    leaderboard,
    activity,
  ] = await Promise.all([
    safe(() => getKpis()),
    safe(() => getMonthlyRealizedSeries()),
    safe(() => getRealizedByBusinessUnit()),
    safe(() => getStatusDistribution()),
    safe(() => getTierDistribution()),
    safe(() => getChampionLeaderboard()),
    safe(() => getRecentActivity()),
  ]);

  const projectTitles = activity.ok
    ? await safe(() =>
        getProjectTitlesByIds(
          activity.value
            .filter((a) => a.entityType === "project")
            .map((a) => a.entityId),
        ),
      )
    : { ok: false as const, error: "" };

  const dbError =
    !kpis.ok
      ? kpis.error
      : !monthly.ok
        ? monthly.error
        : !leaderboard.ok
          ? leaderboard.error
          : null;

  const kpiVal = kpis.ok
    ? kpis.value
    : {
        totalRealizedUsd: 0,
        totalAnnualSavingsUsd: 0,
        totalHoursSaved: 0,
        completedProjects: 0,
        activeProjects: 0,
        pendingApprovals: 0,
        overdueApprovals: 0,
      };

  const statusData =
    statusMix.ok
      ? statusMix.value.map((s) => ({
          status: s.status,
          label: statusLabel(s.status),
          count: s.count,
        }))
      : [];

  const tierData = tierMix.ok
    ? tierMix.value
        .filter((t) => t.tier !== null)
        .map((t) => ({ tier: t.tier as string, count: t.count }))
        .sort((a, b) => a.tier.localeCompare(b.tier))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      </div>

      {dbError && <DbDownBanner message={dbError} />}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Realized $" value={formatUsd(kpiVal.totalRealizedUsd)} accent />
        <Kpi label="Annualized $" value={formatUsd(kpiVal.totalAnnualSavingsUsd)} />
        <Kpi label="Hours / year" value={formatNumber(kpiVal.totalHoursSaved)} />
        <Kpi label="Active" value={String(kpiVal.activeProjects)} />
        <Kpi label="Completed" value={String(kpiVal.completedProjects)} />
        <Kpi
          label="Pending reviews"
          value={`${kpiVal.pendingApprovals}${
            kpiVal.overdueApprovals > 0
              ? ` · ${kpiVal.overdueApprovals} overdue`
              : ""
          }`}
          warn={kpiVal.overdueApprovals > 0}
        />
      </div>

      {/* Row 1 — trend + status mix */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Realized value — trailing 18 months" subtitle="Cumulative" className="lg:col-span-2">
          {monthly.ok ? (
            <RealizedTrendChart data={monthly.value} />
          ) : (
            <Empty message="No history yet." />
          )}
        </Card>
        <Card title="Project status" subtitle="All active + closed projects">
          {statusData.length > 0 ? (
            <StatusDonut data={statusData} />
          ) : (
            <Empty message="No projects yet." />
          )}
        </Card>
      </div>

      {/* Row 2 — BU + tier mix */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Realized value by business unit" className="lg:col-span-2">
          {realizedByBu.ok && realizedByBu.value.length > 0 ? (
            <RealizedByBuChart data={realizedByBu.value} />
          ) : (
            <Empty message="No realized value yet." />
          )}
        </Card>
        <Card title="Projects by tier">
          {tierData.length > 0 ? (
            <TierBarChart data={tierData} />
          ) : (
            <Empty message="No projects yet." />
          )}
        </Card>
      </div>

      {/* Row 3 — leaderboard + activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card title="Champion leaderboard" className="lg:col-span-3">
          {leaderboard.ok && leaderboard.value.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="py-2 w-8">#</th>
                  <th className="py-2">Champion</th>
                  <th className="py-2 text-right">Projects</th>
                  <th className="py-2 text-right">Completed</th>
                  <th className="py-2 text-right">Annualized $</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.value.map((row, i) => (
                  <tr
                    key={row.userId}
                    className="border-t border-surface-border"
                  >
                    <td className="py-2 text-gray-400">{i + 1}</td>
                    <td className="py-2">
                      <div className="font-medium">{row.displayName}</div>
                      <div className="text-xs text-gray-500">{row.email}</div>
                    </td>
                    <td className="py-2 text-right">{row.projectCount}</td>
                    <td className="py-2 text-right">{row.completed}</td>
                    <td className="py-2 text-right font-medium">
                      {formatUsd(row.totalSavings)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty message="No champions yet." />
          )}
        </Card>

        <Card title="Recent activity" className="lg:col-span-2">
          {activity.ok && activity.value.length > 0 ? (
            <ul className="space-y-3 text-sm">
              {activity.value.map((a) => {
                const title =
                  projectTitles.ok && a.entityType === "project"
                    ? projectTitles.value.get(a.entityId)
                    : null;
                return (
                  <li key={a.id} className="flex items-start gap-3">
                    <ActionDot action={a.action} />
                    <div className="flex-1">
                      <div className="text-gray-900">
                        <span className="font-medium">
                          {a.actorName ?? "System"}
                        </span>{" "}
                        <span className="text-gray-600">
                          {actionLabel(a.action).toLowerCase()}
                        </span>{" "}
                        <span className="text-gray-600">
                          {a.entityType === "project" ? "project" : a.entityType}
                        </span>
                        {title ? (
                          <>
                            {" "}
                            <Link
                              href={`/projects/${a.entityId}`}
                              className="font-medium text-brand hover:underline"
                            >
                              {title}
                            </Link>
                          </>
                        ) : null}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatRelative(a.occurredAt)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty message="No recent activity." />
          )}
        </Card>
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-5 ${className}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {subtitle && (
          <span className="text-xs text-gray-500">{subtitle}</span>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Kpi({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div
        className={`mt-1 text-xl font-semibold tabular-nums ${
          warn ? "text-amber-700" : accent ? "text-brand" : "text-gray-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <div className="py-8 text-center text-sm text-gray-500">{message}</div>;
}

function ActionDot({ action }: { action: string }) {
  const color =
    action === "create"
      ? "bg-emerald-500"
      : action === "transition"
        ? "bg-sky-500"
        : action === "delete"
          ? "bg-red-500"
          : action === "restore"
            ? "bg-amber-500"
            : "bg-gray-400";
  return (
    <span
      className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${color}`}
    />
  );
}

function formatRelative(d: Date) {
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
