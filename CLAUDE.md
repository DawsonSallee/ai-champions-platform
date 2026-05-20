# CLAUDE.md — repo map for future agent sessions

Read this first when working on this repo.

## Architecture at a glance

```
Next.js 15 App Router (TypeScript, server components by default)
  ├── apps/web/src/app/        — routes (file-per-page)
  ├── apps/web/src/components/ — UI primitives (server-friendly when possible)
  ├── apps/web/src/domains/    — business logic, partitioned per domain
  ├── apps/web/src/db/         — Drizzle schema, migrations, client, seed
  └── apps/web/src/lib/        — auth, audit, dates, money, export, utils
infra/                         — Bicep IaC
tests/roi-math/                — Vitest parity tests for the ROI engine
```

## The domain layout (every domain has the same 3 files)

```
domains/<name>/
  schema.ts    — Zod input/output types (the only thing UI imports)
  service.ts   — server-only, takes a DB connection, returns data
  actions.ts   — Next server actions (where present), wire UI → service
```

Current domains:

| Domain        | Purpose                                                              |
| :------------ | :------------------------------------------------------------------- |
| `projects`    | CRUD, status transitions (guarded by the state machine)              |
| `intake`      | Tier self-assignment wizard (deterministic decision tree)            |
| `governance`  | Approval workflow engine, tier review matrix, IT assessments         |
| `roi`         | Pure ROI math engine + helpers (no DB calls)                         |
| `dashboards`  | Aggregations for KPIs and the leaderboard                            |

## Hard rules

1. **Never bypass `audited()`.** Every mutation that changes a persisted
   business object goes through `lib/audit.ts`. The append-only audit log
   is the safety net for vibe-coded maintenance.
2. **Never write to `auditEvents` directly** from a service. Go through
   `recordAudit()` or `audited()`.
3. **Never hardcode rates.** Hourly rates always come from
   `cost_rate_history`, resolved by date.
4. **Never widen a status transition without updating
   `domains/governance/state-machine.ts` and a test.**
5. **Never trust client input.** Zod schemas in `domains/*/schema.ts` are
   the only thing UI imports; services re-validate at the boundary.
6. **Never `git push --force` to main.** Treat published migrations as
   immutable — add a new migration instead.
7. **Never enable `DEV_AUTH_BYPASS` in any non-dev environment.**

## Data flow for a typical mutation

```
UI (server action) ──► domain/service.ts (validates + does work)
                          │
                          ▼
                       audited(...) wraps a Drizzle transaction
                          │
                          ▼
            (1) write business row(s)   (2) write audit_events row
```

## Tests

`npm test` runs Vitest. The ROI engine is fully unit-tested — any change
to the math should add or update a test in `tests/roi-math/`.

## Adding a new domain

1. Create `apps/web/src/domains/<name>/{schema,service,actions}.ts`.
2. Add a `CLAUDE.md` to that folder explaining intent + invariants.
3. Add Zod validators in `schema.ts`; never accept raw shapes.
4. Use `audited()` for every mutation.
5. Add unit tests if any pure logic is non-trivial.
