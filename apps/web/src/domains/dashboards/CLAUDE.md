# dashboards — CLAUDE.md

Server-side aggregations that replace the Power BI board.

## Public surface

- `getKpis(asOf?)` — realized $ to date, annualized $, hours saved,
  active / completed counts. Calls into `roi.realizedSavingsToDate` for
  each project.
- `getChampionLeaderboard(limit?)` — champion ranking by annualized
  savings. Joined on the SharePoint-equivalent `users.displayName` so
  there are no "Ghost Rows".
- `getTierDistribution()` — project count per tier.

## Why server-side aggregation

Everything is fast enough at the program's scale (low-hundreds of
projects). When this grows, the right answer is a materialized view +
nightly refresh, not BI. Postgres can do this — keep it in SQL.

## Invariants

- `getKpis` only counts the latest ROI calculation per project.
- Soft-deleted rows are excluded everywhere.
- "Active" = not `Completed`, `Rejected`, `Decommissioned`, `NewIdea`.
