---
name: Dashboard Artifact Visibility Audit
domain: dashboard-observability
confidence: high
tools: [view, rg, vitest]
---

# Dashboard Artifact Visibility Audit

## When to use

- An article page is "missing" revisions, intermediate artifacts, or thinking/debug traces.
- Pipeline tests or seeded article folders prove artifacts exist, but the dashboard does not expose them.
- You need to determine whether the bug is persistence, routing, or artifact discovery/UI.

## Pattern

1. Start with **tests and seeded article folders**, not the UI:
   - look for numbered review artifacts (`editor-review-2.md`, `editor-review-3.md`)
   - look for intermediate panel outputs (`panel-*.md`)
   - look for debug sidecars (`*.thinking.md`)
2. Check whether pipeline logic already treats those files as real state:
   - artifact scanner / lifecycle tests
   - write helpers such as `writeAgentResult()`
3. Then inspect the dashboard seam:
   - which artifact names are hard-coded into the tab/navigation layer
   - which names/routes are actually allowed by the server
4. Separate three questions:
   - **persisted?**
   - **routable?**
   - **discoverable in UI?**
5. Check for a **data-source split**:
   - older dashboard widgets may read summary tables like `editor_reviews`
   - newer runtime flows may write richer history to `artifacts`, `article_conversations`, or `revision_summaries`
   - if those differ, the missing UI is a read-path mismatch, not a persistence failure
6. If files are persisted and routable but not discoverable, prefer a **presentation-layer fix** over schema churn.

## NFL Lab example

- `tests/e2e/full-lifecycle.test.ts` and `tests/pipeline/artifact-scanner.test.ts` prove numbered `editor-review-*.md` files are valid pipeline history.
- `src/pipeline/actions.ts` persists thinking as `{artifact}.thinking.md`.
- `src/dashboard/server.ts` can serve panel artifacts and thinking sidecars.
- `src/dashboard/views/article.ts` still hard-codes the tab bar to the canonical six artifacts, which hides numbered reviews and panel/debug artifacts.
- `runEditor()` persists actual iteration text into `editor-review.md`, `article_conversations`, and `revision_summaries`, while the article page still renders `Editor Reviews` from `editor_reviews`, so missing revision history can be a store-selection bug.

## Heuristic

If the server route can render an artifact by name but the article page never lists that artifact, the bug is usually **artifact discovery / navigation**, not persistence.
