# governance — CLAUDE.md

Approval workflow engine + project status state machine.

## Two pieces

- `state-machine.ts` — pure `canTransition(from, to, tier)`. The single
  authority on whether a status change is legal. The UI consults it,
  services consult it, the SLA reaper consults it.
- `service.ts` — opens approvals when a project enters
  `ITApprovalPending`, records decisions, and advances the project
  status when all required approvals are in.

## How the matrix works

`tier_review_matrix` is **data, not code**. Admins can change which
reviewer roles are required at which tier (and their SLA in business
days) via the admin UI. The engine reads this at runtime — there is no
hardcoded "for tier X, ask Y".

`user_reviewer_roles` maps users → reviewer roles. The engine resolves
(project, reviewer_role) → active user(s). If a role has no holder yet,
a placeholder approval is opened so admins can see the gap.

## Invariants

- `openApprovalGate` is idempotent for any open approvals on the same
  (project, role) pair.
- A project moves to `ITApproved` only when **every** approval for it is
  decided AND none is `Rejected`.
- One `Rejected` approval flips the project to `Rejected` once all
  others are decided.

## When changing

- Adding a new reviewer role: insert into `reviewer_roles`, add matrix
  rows via the admin UI, assign holders. No code change required.
- Adding a new status: update `enums.ts` AND `state-machine.ts` AND add
  state-machine tests. Reject the PR if any of the three are missing.
