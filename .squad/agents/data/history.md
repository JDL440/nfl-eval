# History — Data

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js (core), Python (data queries via nflverse)
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `requirements.txt` (Python deps), `mcp/` (MCP tools including nflverse), `src/services/` (data services), `content/` (pipeline output)

## Learnings

- Team initialized 2025-07-18
- nflverse is the primary NFL data source (Python ecosystem)
- 47 article pipeline agents consume data for analysis — accuracy is critical
- 2026-03-22: Issue #85 phases 1–3 now use YAML glossaries with per-entry `source`, `verified_date`, and `ttl_days`, while team sheets stay markdown with short-TTL frontmatter for volatile leadership facts.
- 2026-03-22: For durable team identity files, official club/NFL pages anchor leadership and venue facts; seasonal identity claims should defer to current nflverse efficiency or charting refreshes.
- 2026-03-23: In `POST /api/articles/:id/publish`, preserve the accepted missing-config split (HTMX gets the publish-panel HTML guidance, non-HTMX gets JSON 500), but validate article markdown before checking for a linked Substack draft so the operator sees the real prerequisite failure first.
- 2026-03-23: Focused validation commands for the publish-page fix were `npm run test -- tests/dashboard/publish.test.ts` and `npm run v2:build`.
- 2026-03-23: Critical bug fixed in `buildPublishPresentation()` (src/dashboard/server.ts:276): changed `substackBody = JSON.stringify(doc)` to `substackBody = proseMirrorToHtml(doc)` so Substack receives HTML instead of raw ProseMirror JSON. This fixes missing images/formatting in published articles. Error precedence in POST /api/articles/:id/publish was already correct (markdown check before draft URL check).
- **2026-03-25**: Roster query bug fixed — nflverse current-season roster parquet files omit the `week` column, causing week-based filters in `content/data/query_rosters.py` to fail for valid lookups (e.g., Isaiah Likely on NYG). Root cause: 2026 cached schema has no `week` field. Fix: Gate week-based latest-snapshot logic on column presence. When `week` is absent, return filtered rows as-is, dedupe by player/team without sorting on week, omit `roster_week` from JSON payload. Downstream renderer (`src/pipeline/roster-context.ts`) shows `Current snapshot` when `roster_week` is missing. Decision merged: treat missing `week` as valid current snapshot, not a schema error. Regression tests: `tests/pipeline/query-rosters.test.ts`.
- **2026-03-25**: Issue #125 slice 2 revision approved and completed. Runtime allowlist now accepts official NFL team primary domains (`seahawks.com`, `chiefs.com`, etc.) as `official_primary` sources alongside `nfl.com`. Approved-source fetch timeout is clamped to remaining wall-clock budget to prevent exceeding the 5-minute Stage 5 budget. Lead review approved both policy/runtime parity restoration and wall-clock budget enforcement with focused test coverage. Ralph routing final slice (Editor consumption) to Code. Files: `src/pipeline/writer-factcheck.ts`, `tests/pipeline/actions.test.ts`, `tests/pipeline/writer-factcheck.test.ts`. Validation: `npm run test -- tests/pipeline/actions.test.ts`, `npm run test -- tests/pipeline/writer-factcheck.test.ts`, and `npm run v2:build` passing.

### 2026-03-23T05:00:39Z: Publish Payload Path Fix Complete
- **Bug:** `buildPublishPresentation()` was sending raw ProseMirror JSON to Substack instead of rendered HTML  
- **Root cause:** Line 276: `substackBody = JSON.stringify(doc)`  
- **Fix:** Changed to `substackBody = proseMirrorToHtml(doc)` to match preview rendering  
- **Error precedence validated:** Route checks article markdown before draft URL (correct order)  
- **Testing:** All 42 publish tests pass, `npm run v2:build` succeeds  
- **Status:** Shipped on main with Publisher payload enrichment

### 2026-03-22T18-23-26Z: Issue #85 decision sync
- The merged decision set keeps the glossary schema and team-sheet frontmatter as the canonical Phase 1-3 shape.
- Older decision history is archived, so the current planning file is easier to read while still preserving provenance.
- Freshness and source metadata remain the key durability markers for future data work.
