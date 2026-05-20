# projects — CLAUDE.md

Project CRUD + status transitions, audit-wrapped.

## Key calls

- `listProjects()` — backlog / dashboard.
- `getProject(id)` — single project for detail page.
- `createProject(input, ctx)` — wraps in `audited()`.
- `updateProject(input, ctx)` — wraps in `audited()`.
- `transitionStatus(input, ctx)` — checks `canTransition()` first; throws
  on illegal transitions. Records to `project_status_history` AND the
  audit log.
- `softDeleteProject(id, ctx)` / `restoreProject(id, ctx)` — soft delete
  is the default; hard delete is admin-only and lives in a separate path.

## Invariants

- `listProjects()` excludes soft-deleted rows by default.
- Status transitions ALWAYS go through `transitionStatus` so the state
  machine + history table + audit are kept in lockstep.
- Champion / process owner are nullable on a project until assigned.
