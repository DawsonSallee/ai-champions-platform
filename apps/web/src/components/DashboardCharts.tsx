"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BRAND = "#4f46e5";
const BRAND_LIGHT = "#6366f1";

export function RealizedTrendChart({
  data,
}: {
  data: { month: string; cumulative: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="brandFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND_LIGHT} stopOpacity={0.35} />
            <stop offset="100%" stopColor={BRAND_LIGHT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="month"
          axisLine={false}
          tickLine={false}
          fontSize={11}
          stroke="#9ca3af"
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          fontSize={11}
          stroke="#9ca3af"
          tickFormatter={(v) =>
            v >= 1_000_000
              ? `$${(v / 1_000_000).toFixed(1)}M`
              : v >= 1_000
                ? `$${(v / 1_000).toFixed(0)}K`
                : `$${v}`
          }
          width={50}
        />
        <Tooltip
          contentStyle={{
            border: "1px solid #e4e7eb",
            borderRadius: 6,
            fontSize: 12,
          }}
          formatter={(v: number) =>
            v.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            })
          }
        />
        <Area
          type="monotone"
          dataKey="cumulative"
          stroke={BRAND}
          strokeWidth={2}
          fill="url(#brandFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RealizedByBuChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
        <XAxis
          type="number"
          axisLine={false}
          tickLine={false}
          fontSize={11}
          stroke="#9ca3af"
          tickFormatter={(v) =>
            v >= 1_000 ? `$${(v / 1_000).toFixed(0)}K` : `$${v}`
          }
        />
        <YAxis
          dataKey="name"
          type="category"
          axisLine={false}
          tickLine={false}
          fontSize={11}
          stroke="#374151"
          width={110}
        />
        <Tooltip
          cursor={{ fill: "#f3f4f6" }}
          contentStyle={{
            border: "1px solid #e4e7eb",
            borderRadius: 6,
            fontSize: 12,
          }}
          formatter={(v: number) =>
            v.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            })
          }
        />
        <Bar dataKey="value" fill={BRAND_LIGHT} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const STATUS_PALETTE: Record<string, string> = {
  Completed: "#16a34a",
  InProgress: "#0ea5e9",
  AITeamReview: "#8b5cf6",
  ITApprovalPending: "#f59e0b",
  ITApproved: "#10b981",
  IntakeSubmitted: "#3b82f6",
  UnderReview: "#6366f1",
  NewIdea: "#9ca3af",
  Rejected: "#ef4444",
  Decommissioned: "#78716c",
};

export function StatusDonut({
  data,
}: {
  data: { status: string; count: number; label: string }[];
}) {
  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width="60%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={1}
          >
            {data.map((d) => (
              <Cell key={d.status} fill={STATUS_PALETTE[d.status] ?? "#9ca3af"} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              border: "1px solid #e4e7eb",
              borderRadius: 6,
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 space-y-1.5 text-xs">
        {data.map((d) => (
          <li key={d.status} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: STATUS_PALETTE[d.status] ?? "#9ca3af" }}
            />
            <span className="text-gray-700">{d.label}</span>
            <span className="ml-auto font-medium text-gray-900">{d.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TIER_PALETTE: Record<string, string> = {
  "1A": "#a3a3a3",
  "1B": "#10b981",
  "1C": "#0ea5e9",
  "2": "#f59e0b",
  "3": "#f43f5e",
};

export function TierBarChart({
  data,
}: {
  data: { tier: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="tier"
          axisLine={false}
          tickLine={false}
          fontSize={11}
          stroke="#374151"
          tickFormatter={(t) => `Tier ${t}`}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          fontSize={11}
          stroke="#9ca3af"
          allowDecimals={false}
          width={28}
        />
        <Tooltip
          cursor={{ fill: "#f3f4f6" }}
          contentStyle={{
            border: "1px solid #e4e7eb",
            borderRadius: 6,
            fontSize: 12,
          }}
          formatter={(v: number) => `${v} project${v === 1 ? "" : "s"}`}
          labelFormatter={(t) => `Tier ${t}`}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.tier} fill={TIER_PALETTE[d.tier] ?? "#9ca3af"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
