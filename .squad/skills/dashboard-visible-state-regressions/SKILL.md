---
name: Dashboard Visible-State Regressions
domain: dashboard-tests
confidence: high
tools: [view, rg, vitest]
---

# Dashboard Visible-State Regressions

## When to Use

- A dashboard cleanup removes, moves, or conditionally hides UI sections and regression tests still expect the old shape.
- You need to keep a fix narrowly scoped to tests unless the rendered view is genuinely wrong.
- Full-page HTML assertions are failing because they reference text that now appears only inside HTMX fragments or edit states.

## Pattern

1. Inspect the current rendered view first.
   - Check `src\dashboard\views\*.ts` for the initial full-page HTML.
   - Separate always-visible content from HTMX-only or conditional content.
2. Assert visible operator state on full pages.
   - Prefer headings, badges, buttons, stable IDs, and route links that appear on the initial render.
   - Do not assert edit-form copy that only appears after an HTMX swap.
3. Treat removed surfaces as intentional unless the product direction changed.
   - Remove outdated expectations for retired routes/sections.
   - Keep absence assertions when they protect against accidental reintroduction.
4. Preserve conditional maintenance seams in tests.
   - If a maintenance action depends on injected services, assert the section shell and result target regardless.
   - Only assert the action button when the test setup enables the required dependencies.

## Current seam map

- `src\dashboard\views\config.ts` conditionally renders the refresh-all form but always renders the maintenance section and `#knowledge-refresh-result`.
- `src\dashboard\views\article.ts` renders metadata badges and the edit button on the default article page; `Edit Article Metadata` belongs to the HTMX edit form, not the initial full-page HTML.
- `tests\dashboard\config.test.ts` and `tests\dashboard\server.test.ts` are the focused regression seams for this cleanup.

## Recommendation

For this repo, prefer test updates that follow the current operator-visible shell after approved dashboard cleanup. Only reopen production code when the test proves the live rendering contract no longer matches the approved view.

## Concrete example

- On `/config`, assert `Services &amp; Maintenance`, `Knowledge refresh`, the empty-state copy when runner/memory are absent, and `id="knowledge-refresh-result"`.
- On `/articles/:id`, assert `id="article-meta"`, the metadata badges, and the edit-button affordance (`title="Edit metadata"` and `hx-get="/htmx/articles/:id/edit-meta"`), while not expecting `Edit Article Metadata` in the full-page response.
