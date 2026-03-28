---
name: Dashboard Metadata Overrides
domain: dashboard-ux
confidence: high
tools: [view, rg, server.ts, vitest]
---

# Dashboard Metadata Overrides

## When to use

- A new per-article operator setting should live near title/subtitle/depth rather than on a new page.
- The dashboard already has HTMX-based inline metadata editing and the request is to keep changes focused.
- You need a safe default like `Auto` while still allowing an explicit article-level override.

## Pattern

Extend the existing `#article-meta` display/edit pair instead of creating new navigation:

1. Add a compact read-state badge in `renderArticleMetaDisplay()`
2. Add the new control to `renderArticleMetaEditForm()`
3. Keep `Auto` as a null/empty stored value
4. Thread the field through the existing HTMX + JSON metadata update routes
5. Add focused tests for:
   - the edit form control
   - HTMX save behavior
   - page-level read-state copy

## Implementation guidance

### 1. Reuse the inline metadata seam

- File: `src/dashboard/views/article.ts`
- Keep the edit trigger on the existing pencil button
- Prefer a `<select>` for bounded operator choices
- Put the new control alongside depth/team fields so the form still feels like one metadata edit

### 2. Make Auto the friendly default

- Render `Auto (recommended)` as the empty option
- Persist the empty option as `null`, not a literal string like `"auto"`
- In read view, translate null back to `Provider: Auto`

### 3. Keep route glue minimal

- File: `src/dashboard/server.ts`
- Add the field to `/htmx/articles/:id/edit-meta` and `/api/articles/:id`
- Avoid introducing a dedicated provider route if the existing metadata update routes already fit

### 4. Use a durable storage contract

- Put the nullable field on the article record (`llm_provider`)
- Add a lightweight schema backfill for existing databases
- Keep the field generic so later backend routing work can consume it directly

### 5. Fix config-page wording during multi-provider rollout

- File: `src/dashboard/views/config.ts`
- Do not label one provider as globally “active” once the runtime can register several
- Prefer summary terms like `Provider Mode`, `Registered Providers`, and `Default Routing Model`
- If possible, list provider IDs/names so operators can match the metadata selector to runtime reality

## Key files

- `src/dashboard/views/article.ts`
- `src/dashboard/views/config.ts`
- `src/dashboard/server.ts`
- `src/db/schema.sql`
- `src/db/repository.ts`
- `tests/dashboard/config.test.ts`
- `tests/dashboard/metadata-edit.test.ts`
- `tests/dashboard/server.test.ts`

## Validation

- `npm run v2:test -- tests/dashboard/config.test.ts tests/dashboard/metadata-edit.test.ts tests/dashboard/server.test.ts`
- `npm run v2:build`
