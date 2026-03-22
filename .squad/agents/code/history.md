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
- **Issue #76 investigation (mass document update service):** 43 articles in `content/articles/`, artifact-scanner (`artifact-scanner.ts`) already scans all dirs and infers stages — strong foundation for inventory (Phase 1). `ArtifactStore` (artifact-store.ts) has individual CRUD but no bulk ops. `SubstackService` (substack.ts) can create/update/publish drafts and `getDraft()` returns metadata only (not body). Critical blocker for Phase 4: Substack API has no read/update for published articles — extension.mjs explicitly blocks Stage 8 updates. Migration module (`migrate.ts`) provides good patterns for batch ops (dry-run, report struct, idempotent). Recommended phased approach: inventory CLI → local batch updates → draft sync → defer published merge. ~900 lines for Phases 1–3. Labeled `go:yes`.
- **Issue #83 implementation (fact-checking pipeline):** PR #89 merged. Three new modules: `claim-extractor.ts` (regex-based extraction of stat/contract/draft/performance claims), `fact-check-context.ts` (pre-computes nflverse lookup data before LLM fact-check — Option A), `validators.ts` (deterministic stat validation with 10% tolerance + draft round/pick/year validation — Option C). Wired into writeDraft (Stage 4→5), runEditor (Stage 5→6), and runPublisherPass (Stage 6→7) in actions.ts. Key regex insight: NAME_PAT must be case-SENSITIVE to avoid matching pronouns/common words; `[^.]` sentence boundaries fail at decimal points — use `(?:[^.]|\\.[\\d])` instead. 29 new tests, 1315 total passing.

### 2026-03-22: Issue #88 Investigation Outcome

**Related work:** Lead created issue #88 (Pipeline Conversation Context) proposing 4-phase architecture for persistent per-article conversation history. Affects all agent prompts (runner.ts) and pipeline actions (actions.ts). Pending architectural review before Code assignment.


