# intake — CLAUDE.md

Deterministic tier self-assignment wizard.

## Why deterministic

If two people answer the same questions the same way, they MUST land on
the same tier. No ML, no fuzzy logic. The decision tree is in
`wizard.ts:assignTier()`.

## The decision tree (current)

```
Q1 — Customizes behavior?           No → 1A (stop)
Q4 — Any Tier-3 escalator?          Yes → 3 (stop)
Q2 — Touches non-M365?              Yes → 2 (stop)
Q3 — Premium platform features?     Yes → 1C (stop)
Default                                 → 1B
```

The order matters. Q4 is checked before Q2/Q3 because escalators
dominate — a Power Automate flow that writes to HR is Tier 3, not Tier 1C.

## When changing

Update `wizard.ts` AND `tests/roi-math/intake.test.ts` together. Add a
test for any new branch. The wizard's answers are persisted on the
project row so an auditor can verify why a tier was chosen — never
re-classify silently.
