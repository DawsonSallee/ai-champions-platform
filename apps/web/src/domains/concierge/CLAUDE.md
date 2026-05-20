# concierge — CLAUDE.md

In-app chat assistant. Answers program questions with citations to the
FAQ snippets in `faq.ts`.

## Current implementation

Deterministic keyword scoring across a curated `FAQ` array. No model
call — fast, free, and easy to test. Snippets are the source of truth;
the FAQ is one TS file you can edit and ship.

## When to replace with a real LLM

If you want fuller answers ("explain Tier 2 in two sentences") or want
to ground on the full governance docs, swap `answerQuestion` for a
retrieval call (Azure OpenAI + a vector store). Keep the same
`{ citations, text }` shape so the UI doesn't change.

## Invariants

- Every answer must cite the snippet(s) it drew from. No uncited claims.
- The chat sidebar is rendered on every page — it must be cheap.
- Don't have it perform actions (creating projects, approving things);
  it's read-only knowledge surface only.
