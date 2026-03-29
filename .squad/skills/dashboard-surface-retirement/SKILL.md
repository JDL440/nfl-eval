---
name: Dashboard Surface Retirement
domain: dashboard-ux
confidence: high
tools: [rg, view, vitest]
---

# Dashboard Surface Retirement

## When to Use

- A dashboard area has been product-removed, but backend maintenance endpoints or storage still need to remain.
- The codebase still carries view modules, CSS blocks, and tests for the deleted UI.
- Trace or admin functionality already has a better surviving surface (for example, dedicated trace pages or `/config`).

## Pattern

1. **Delete the surface, not just the nav link.**
   - Remove route handlers, view modules, and dead CSS for the retired page.
   - Delete obsolete tests rather than keeping placeholder 200s.

2. **Move surviving maintenance actions onto the canonical admin surface.**
   - In this repo, `/config` is the right place for operator-facing status and buttons.
   - Keep the endpoint contract stable (`POST /api/agents/refresh-all`) while moving its UI trigger.

3. **Prefer trace-first replacements over run-detail shells.**
   - If article traces already live on `/articles/:id/traces` and `/traces/:id`, update links there instead of preserving `/runs/:id`.

4. **Rewrite tests around operator-visible outcomes.**
   - Full-page article tests should assert the presence of the Trace button and the absence of removed panels.
   - Settings tests should assert maintenance availability/absence based on runtime dependencies, not old page names.

## Current Example

- `src/dashboard/views/article.ts`
- `src/dashboard/views/config.ts`
- `src/dashboard/server.ts`
- `tests/dashboard/server.test.ts`
- `tests/dashboard/config.test.ts`
- `tests/dashboard/wave2.test.ts`
