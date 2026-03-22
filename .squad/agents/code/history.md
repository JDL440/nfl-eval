# History — Code

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, Hono, HTMX, SQLite, Vitest
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `src/` (core), `src/dashboard/` (Hono routes), `src/pipeline/` (article pipeline), `src/llm/` (LLM gateway), `src/mcp/` (MCP tools), `tests/` (vitest), `vitest.config.ts`

## Learnings

- Team initialized 2025-07-18
- 47 article pipeline agents live in `src/config/defaults/charters/nfl/` — these are SEPARATE from Squad agents
- Dashboard runs on port 3456 (Hono + HTMX)
- **Token usage system (issue #81):** Usage events are recorded in `usage_events` table (schema.sql:96-120) via `recordAgentUsage()` in actions.ts:77-96. The dashboard renders via `renderUsagePanel()` in article.ts:960-1064. Cost tracking is broken: `cost_usd_estimate` is never calculated (no pricing module exists). Copilot CLI provider returns `usage: undefined` (copilot-cli.ts:195). Dashboard has no per-provider breakdown despite multi-provider support. All 7 providers store tokens consistently except copilot-cli.
- **Issue #81 fix (PR #86):** Added `src/llm/pricing.ts` with hardcoded per-model pricing table — easy to update when prices change. Integrated `estimateCost()` into `recordAgentUsage()`. Copilot CLI now estimates tokens at ~4 chars/token. Dashboard shows By Provider breakdown. 1284 tests passing.
- **Issue #84 investigation (staleness detection):** Two layers exist today: (1) MCP query cache with per-dataset TTLs (30min–24hr) in `src/cache/` and `mcp-cache.mjs`, (2) scheduler roster artifact age check (7-day threshold) in `scheduler.ts:125-129`. Key gaps: no parquet freshness tracking, no article-level data provenance, no cross-dataset staleness checks beyond roster, `invalidatePrefix` is a stub. Recommended 4-phase approach: parquet freshness metadata → article data provenance → pre-publish freshness gate → fix invalidatePrefix. Labeled `go:yes`.
- **Issue #82 investigation (publish broken):** The "Publish to Substack" button on the article detail page at stage 7 (`article.ts:530`) POSTs to `/htmx/articles/:id/advance` — the generic advance handler that only bumps the DB stage. It should POST to `/api/articles/:id/publish` (`server.ts:1373`) which actually calls the Substack API via `substackService.publishDraft()`. Defense-in-depth gap: the `requireSubstackUrl` guard exists (`engine.ts:216`) but is not used in the `TRANSITION_MAP` for stage 7→8 (`engine.ts:270`). The `publish` action in `actions.ts:782` is intentionally a no-op ("handled externally"). Fix scope: small (~30 lines). Labeled `go:yes`.
