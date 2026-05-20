# AI Champions Platform

Custom full-stack replacement for the SharePoint + Excel + Power BI +
ITSM-routing stack that powers the AI Champions Program today.

**Stack:** Next.js 15 (App Router, TS) · Drizzle ORM · PostgreSQL ·
Tailwind · Microsoft Entra ID via NextAuth · Azure Blob (or local FS) ·
Microsoft Graph send-as (or SMTP / log) · @react-pdf/renderer · Bicep IaC

**Architecture:** see [`Custom_Platform_Plan.md`](../Custom_Platform_Plan.md)
**For coding agents:** see [`CLAUDE.md`](./CLAUDE.md)

---

## What's in the box

```
17 routes built:
  Pages       /  /dashboard  /backlog  /intake  /projects/[id]
              /governance  /app-store  /admin  /admin/audit
              /admin/trash  /sign-in
  APIs        /api/auth  /api/export/projects.{csv,xlsx}
              /api/files/[..key]  /api/showcase/[id].pdf
```

### Features wired end-to-end
- **Intake wizard** — deterministic tier assignment, opens approval gate.
- **Backlog** — sortable, filterable, CSV + XLSX export.
- **Project detail** — Overview / ROI / IT Governance / Approvals / UAT /
  Artifacts / Solution Storage / Showcase.
- **ROI calculator** — interactive grid, date-aware rate lookup,
  versioned snapshots, live totals preview.
- **Approvals workflow** — DB-driven tier matrix, reviewer inbox, SLA
  timers, in-app approve / changes / reject decisions.
- **IT Governance assessment** — form replacing the legacy .docx.
- **UAT log** — replaces the legacy .xlsx.
- **Artifact upload** — local FS or Azure Blob.
- **Showcase PDF** — generated from live data via `@react-pdf/renderer`.
- **AI App Store** — auto-publishes when status = Completed.
- **Dashboards** — realized $ to date, leaderboard, tier mix.
- **Audit log** — append-only, every mutation captured.
- **Trash / restore** — soft-delete safety net.
- **Admin** — tier matrix editor + reviewer-role holder assignment.
- **AI Concierge** — chat sidebar, citations from the program FAQ.

### Scheduled jobs (scripts/)
- `job:nudge` — weekly Champion Nudge email.
- `job:sla-check` — daily SLA breach reminder.
- `import:sharepoint` — one-time legacy importer.

### Tests
`npm test` — 32 unit tests across ROI engine, tier wizard, state
machine, concierge search, business-day arithmetic.

---

## Quick start

### Option A — zero install (embedded PGlite)

No Docker, no Postgres install. Database runs in-process and persists
to `.pgdata/` under the repo. Best for laptops and demos.

```sh
npm install
npm run dev:embedded
# → http://localhost:3000  (migrated, seeded, signed in as dev)
```

To wipe the embedded DB and start fresh, delete the `.pgdata/` folder.

### Option B — real Postgres (Docker, Neon, or Azure)

Use this when you want the production driver, persistent infra, or
multi-process access.

```sh
npm install
cp .env.example .env             # leave DEV_AUTH_BYPASS=true for local

docker compose up -d             # Postgres on :5432  (or set DATABASE_URL to Neon / Azure)
npm run db:migrate
npm run db:seed

npm run dev
# → http://localhost:3000
```

Without any DB the pages still render — a yellow banner explains how to
start one. The intake wizard's tier logic runs entirely client-side.

## Scripts

| Command                  | Purpose                                                       |
| :----------------------- | :------------------------------------------------------------ |
| `npm run dev`            | Dev server                                                    |
| `npm run build`          | Production build                                              |
| `npm run typecheck`      | `tsc --noEmit` across the app                                 |
| `npm run lint`           | Next/ESLint                                                   |
| `npm test`               | Vitest unit tests                                             |
| `npm run check`          | typecheck + lint + tests                                      |
| `npm run db:generate`    | Generate a new SQL migration from schema changes              |
| `npm run db:migrate`     | Apply migrations                                              |
| `npm run db:seed`        | Idempotently seed demo data                                   |
| `npm run db:studio`      | Drizzle Studio (browse the DB)                                |
| `npm run job:nudge`      | Run the weekly Champion Nudge                                 |
| `npm run job:sla-check`  | Run the daily SLA breach checker                              |
| `npm run import:sharepoint` | One-time legacy SharePoint importer                        |

## Backends — pluggable

| Concern        | Env var            | Options                |
| :------------- | :----------------- | :--------------------- |
| File storage   | `STORAGE_BACKEND`  | `local` (dev), `azure` |
| Email          | `EMAIL_BACKEND`    | `log`, `smtp`, `graph` |
| Auth           | `DEV_AUTH_BYPASS`  | `true` (dev), unset (Entra ID via NextAuth) |

Switch backends without touching domain code.

## Where to look

| Concern                  | Path                                                        |
| :----------------------- | :---------------------------------------------------------- |
| Database schema          | `apps/web/src/db/schema/`                                   |
| Business logic           | `apps/web/src/domains/`                                     |
| Server actions           | `apps/web/src/domains/*/actions.ts`                         |
| Pages / routes           | `apps/web/src/app/`                                         |
| Shared utilities         | `apps/web/src/lib/`                                         |
| Bicep IaC                | `infra/main.bicep`                                          |
| Scheduled jobs           | `scripts/`                                                  |
| ROI math parity tests    | `tests/roi-math/`                                           |

## Deployment

See [`infra/README.md`](./infra/README.md). Two Bicep postures: cheap
public-with-Entra (MVP, ~$40–80/mo) and private-endpoint VPN-only
(production, ~$150–400/mo).
