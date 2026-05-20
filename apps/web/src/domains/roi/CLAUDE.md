# roi — CLAUDE.md

Pure ROI math. No DB calls, no async I/O.

## Why pure

The legacy Excel calculator is the source of truth that finance trusts.
If we want to retire it, the new math has to be auditable and provably
identical. Pure functions + a dense test suite get us that.

## Public surface

- `computeStep(input)` — one Layer-3 row
- `computeRoi(steps)` — every row + totals
- `resolveRate(history, asOf)` — date-aware rate lookup (XLOOKUP equivalent)
- `appendLedger(prior, year, amount)` — JSON ledger append
- `realizedSavingsToDate({ implementationDate, asOfDate, ledger })` —
  replaces the Power BI DAX measure
- `round2(n)` — utility

## Invariants

- `efficiencyGainPct` is `null` when `baselineHours === 0`. Never `Infinity`.
- `realizedSavingsToDate` returns `0` before `implementationDate`.
- `realizedSavingsToDate` caps at `asOfDate` — never reports value for days
  that haven't happened. (Matches the documented DAX `TODAY()` cutoff.)
- Days-in-year is `365`. Leap years are not material at the scales we report.

## When changing

If the math changes, fixture tests in `tests/roi-math/engine.test.ts` must
be updated **and** the historical ROI calculations table should be
migrated (or marked stale) — never silently re-interpreted.
