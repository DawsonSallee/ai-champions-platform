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
      <header className="v3-page-header" style={{ marginBottom: 0 }}>
        <h1 className="v3-headline">Dashboard</h1>
      </header>

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
            <table className="v3-data-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>#</th>
                  <th>Champion</th>
                  <th className="r">Projects</th>
                  <th className="r">Completed</th>
                  <th className="r">Annualized $</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.value.map((row, i) => (
                  <tr key={row.userId}>
                    <td className="v3-muted-2">{i + 1}</td>
                    <td>
                      <div className="v3-row-title">{row.displayName}</div>
                      <div className="v3-row-sub">{row.email}</div>
                    </td>
                    <td className="r">{row.projectCount}</td>
                    <td className="r">{row.completed}</td>
                    <td className="r" style={{ fontWeight: 600 }}>
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
                      <div style={{ color: "var(--ink)" }}>
                        <span style={{ fontWeight: 500 }}>
                          {a.actorName ?? "System"}
                        </span>{" "}
                        <span className="v3-muted">
                          {actionLabel(a.action).toLowerCase()}
                        </span>{" "}
                        <span className="v3-muted">
                          {a.entityType === "project" ? "project" : a.entityType}
                        </span>
                        {title ? (
                          <>
                            {" "}
                            <Link href={`/projects/${a.entityId}`} className="link">
                              {title}
                            </Link>
                          </>
                        ) : null}
                      </div>
                      <div className="v3-muted" style={{ fontSize: 11.5 }}>
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
    <section className={`v3-card v3-card-pad ${className}`}>
      <div className="v3-section-header">
        <h2>{title}</h2>
        {subtitle && <span className="count">{subtitle}</span>}
      </div>
      <div>{children}</div>
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
    <div className="v3-kpi">
      <div className="v3-kpi-label">{label}</div>
      <div
        className="v3-kpi-value"
        style={
          warn
            ? { color: "#b45309" }
            : accent
              ? { color: "var(--a)" }
              : undefined
        }
      >
        {value}
      </div>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div
      className="v3-muted"
      style={{ padding: "32px 0", textAlign: "center", fontSize: 13 }}
    >
      {message}
    </div>
  );
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
