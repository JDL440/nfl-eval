# SKILL: Dashboard surface deprecation audit

## When to use
Use this pattern when a dashboard subsystem is being retired, but some of its backend capabilities or observability seams must remain available.

## Pattern
- Start with the shared shell and route table: verify removed pages are gone from navigation and no direct routes/helpers still expose them.
- Identify what must survive the cleanup:
  1. one admin/status surface (here: `/config`)
  2. dedicated observability pages (here: trace pages)
  3. any maintenance-only endpoint that operators still need (here: `POST /api/agents/refresh-all`)
- Remove dead view-model fields and helper wiring that only fed the retired UI. Static leftovers are easy to miss after the visible page disappears.
- Update docs and seeded skills so they describe deprecation honestly:
  - say what storage/runtime capability still exists
  - say what is disabled in live behavior
  - do not keep advertising removed pages as active tools
- Add regression tests that assert absence as well as presence:
  - removed nav links/routes are not exposed
  - surviving maintenance endpoint is still linked and callable
  - surviving dedicated observability pages still render

## Why
Dashboard cleanups often leave behind “soft regressions” in copied docs, test fixtures, or stale props long after the main page disappears. Auditing the whole surface keeps the product story honest and prevents dead UI contracts from quietly reappearing.

## Current example
- `src/dashboard/views/layout.ts`
- `src/dashboard/views/article.ts`
- `src/dashboard/views/config.ts`
- `src/dashboard/server.ts`
- `tests/dashboard/config.test.ts`
- `tests/dashboard/server.test.ts`
- `docs/knowledge-system.md`
- `src/config/defaults/skills/history-maintenance.md`
