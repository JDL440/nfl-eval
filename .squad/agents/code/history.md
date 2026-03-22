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
- **Issue #85 coordination (structured domain knowledge POC):** Research's phase 1–3 recommendation standardizes reusable knowledge under `src/config/defaults/` with canonical glossaries/team sheets plus per-article `team-sheet.md` artifacts. The implementation seam stays on existing defaults/bootstrap and article-artifact patterns, with tests focused on bootstrap, actions, and validation coverage.
- **Issue #85 planning follow-up:** The repo now has static POC assets in `src/config/defaults/glossaries/*.yaml` and `content/data/team-sheets/{BUF,KC,SEA}.md`, with validation in `tests/config/domain-knowledge-content.test.ts` and `tests/config/domain-knowledge.test.ts`. Current runtime still only injects charters, skills, memory, and `roster-context.md` (`src/agents/runner.ts`, `src/pipeline/context-config.ts`, `src/pipeline/actions.ts`), so `docs/knowledge-system.md` must clearly separate phases 1–3 asset delivery from deferred runtime loading/refresh work.
- **Issue #85 phases 1-3 implementation:** Added four proof-of-concept glossary seeds under `src/config/defaults/glossaries/` and three proof-of-concept team sheets under `content/data/team-sheets/` for `SEA`, `KC`, and `BUF`. The glossary files use a shared YAML seed schema (`schema_version`, `id`, `glossary`, `description`, `entry_fields`, `refresh_guidance`, `entries`), while the team sheets use frontmatter plus a fixed markdown layout (`Durable snapshot`, `Identity anchors`, `Offense`, `Defense`, `Roster-building and cap framing`, `Source guidance`). Validation lives in `tests/config/domain-knowledge-content.test.ts` and `tests/config/domain-knowledge.test.ts`, and docs were updated in `docs/knowledge-system.md` and `README.md`.

### 2026-03-22: Issue #88 Investigation Outcome

**Related work:** Lead created issue #88 (Pipeline Conversation Context) proposing 4-phase architecture for persistent per-article conversation history. Affects all agent prompts (runner.ts) and pipeline actions (actions.ts). Pending architectural review before Code assignment.

### 2025-07-20: Issue #88 Implementation (Phases 1-3) — PR #90 merged

**What:** Implemented per-article shared conversation context and revision history tracking.

**Key design decision:** All agents share ONE conversation thread per article (not per-agent). Each turn is tagged with agent name and pipeline stage. Context is injected as formatted markdown text in the user message (compatible with all LLM providers — no multi-turn message format needed).

**New files:**
- `src/pipeline/conversation.ts` — addConversationTurn, getArticleConversation, addRevisionSummary, getRevisionHistory, getRevisionCount, buildConversationContext, buildEditorPreviousReviews
- `tests/pipeline/conversation.test.ts` — 21 tests

**Schema additions (schema.sql):**
- `article_conversations` table — per-article conversation thread
- `revision_summaries` table — iteration tracking with outcomes and key issues

**Modified files:**
- `src/agents/runner.ts` — Added `conversationContext?: string` to AgentRunParams, injected before user message
- `src/db/repository.ts` — Added `getDb()` accessor for conversation module
- `src/pipeline/actions.ts` — Wired conversation recording/loading into writeDraft, runEditor, runPublisherPass

**Technical notes:**
- Token count estimation uses ~4 chars/token (same as copilot-cli provider)
- Long conversation turns are truncated to 2000 chars in context; editor reviews to 1500 chars
- Editor REVISE verdicts auto-create revision summary entries
- Writer deduplicates editor feedback recording (checks last editor turn content)
- 1336 total tests passing (21 new)

### 2026-03-22T18-23-26Z: Issue #85 decision sync
- Decision inbox merge completed for the static knowledge-asset pass, and older decision history moved to the archive file.
- The planning record now emphasizes the proof-of-concept content layer plus validation/docs, not runner or pipeline integration.
- Continue treating runtime injection and refresh automation as deferred follow-up work.

### 2026-03-22T19-10-00Z: Issue #85 structure validation completion
- Standardized the glossary seeds on a shared YAML shape with explicit `id`, `glossary`, freshness metadata, and entry-level source refs.
- Standardized the proof-of-concept team sheets on YAML frontmatter plus fixed markdown headings (`Durable snapshot`, `Identity anchors`, `Roster-building and cap framing`, `Source guidance`).
- Vitest coverage now parses the glossary YAML directly and validates team-sheet frontmatter/body structure without touching runtime prompt assembly.

### 2026-03-22: Debug visibility restore

**What:** Restored the collapsible artifact thinking/debug section on article artifact views by loading companion `*.thinking.md` artifacts when the main `*.md` artifact is rendered.

**Why:** The historical inline `<think>` collapse UI survived, but Issue #88-era pipeline changes persist thinking separately via `writeAgentResult()` in `src/pipeline/actions.ts`, so normal artifact views stopped showing the debug section unless you clicked the dedicated 💭 tab.

**Key implementation choice:** Treat persisted `*.thinking.md` files as the authoritative debug source for the main artifact view, fall back to inline token extraction only for legacy artifacts, and avoid conversation logs because they store cleaned assistant outputs rather than full thinking traces.

**Validation:** `npm run v2:build` passed, and targeted Vitest coverage passed for `tests/dashboard/wave2.test.ts`, `tests/dashboard/server.test.ts`, `tests/dashboard/extract-thinking.test.ts`, and `tests/pipeline/write-agent-result.test.ts`.

### 2026-03-22: Issue #93 Copilot CLI token-usage trace

- I could not reproduce a runtime rendering bug on current `main`: the article detail page and HTMX live sidebar already render `usage_events` rows for `copilot-cli` the same way they do for other providers.
- The real gap was regression coverage across the full chain: provider `usage` → `AgentRunner.tokensUsed` → `recordAgentUsage()` persistence → article-page/live-sidebar rendering.
- Added focused tests in `tests/agents/runner.test.ts`, `tests/pipeline/actions.test.ts`, and `tests/dashboard/server.test.ts` to lock down the Copilot CLI path and confirm `copilot-cli` appears in the provider breakdown when usage rows exist.
