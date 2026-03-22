# History — Code

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, Hono, HTMX, SQLite, Vitest
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `src/` (core), `src/dashboard/` (Hono routes), `src/pipeline/` (article pipeline), `src/llm/` (LLM gateway), `src/mcp/` (MCP tools), `tests/` (vitest), `vitest.config.ts`

## Learnings

- Team initialized 2025-07-18
- Issue #92 writer revisions should receive the full latest `editor-review.md` artifact in `articleContext` while keeping `conversationContext` limited to the compact revision handoff. That preserves anti-role-bleed for writer/editor/publisher without hiding exact editor instructions from the writer.
- 47 article pipeline agents live in `src/config/defaults/charters/nfl/` — these are SEPARATE from Squad agents
- Dashboard runs on port 3456 (Hono + HTMX)
- **Issue #92 hybrid context follow-up:** `src/pipeline/actions.ts` should pass only `buildRevisionSummaryContext()` as shared `conversationContext` to Writer/Publisher and combine that summary with `buildEditorPreviousReviews()` for Editor. Writer revisions still need the full current `editor-review.md` artifact as an explicit handoff, even when per-article upstream overrides strip generic includes. Keep `buildConversationContext()` available for debug/full-history use, but not as the default runtime prompt surface for writer/editor/publisher role handoffs.
- **Issue #92 regression seam:** `tests/pipeline/actions.test.ts` can catch prompt-context bleed by asserting stubbed artifact output contains `## Shared Revision Handoff` while excluding sentinel raw thread strings from writer/editor/publisher turns. `tests/pipeline/conversation.test.ts` is the right home for compact-summary formatter coverage.
- **Token usage system (issue #81):** Usage events are recorded in `usage_events` table (schema.sql:96-120) via `recordAgentUsage()` in actions.ts:77-96. The dashboard renders via `renderUsagePanel()` in article.ts:960-1064. Cost tracking is broken: `cost_usd_estimate` is never calculated (no pricing module exists). Copilot CLI provider returns `usage: undefined` (copilot-cli.ts:195). Dashboard has no per-provider breakdown despite multi-provider support. All 7 providers store tokens consistently except copilot-cli.
- **Issue #81 fix (PR #86):** Added `src/llm/pricing.ts` with hardcoded per-model pricing table — easy to update when prices change. Integrated `estimateCost()` into `recordAgentUsage()`. Copilot CLI now estimates tokens at ~4 chars/token. Dashboard shows By Provider breakdown. 1284 tests passing.
- **Issue #84 investigation (staleness detection):** Two layers exist today: (1) MCP query cache with per-dataset TTLs (30min–24hr) in `src/cache/` and `mcp-cache.mjs`, (2) scheduler roster artifact age check (7-day threshold) in `scheduler.ts:125-129`. Key gaps: no parquet freshness tracking, no article-level data provenance, no cross-dataset staleness checks beyond roster, `invalidatePrefix` is a stub. Recommended 4-phase approach: parquet freshness metadata → article data provenance → pre-publish freshness gate → fix invalidatePrefix. Labeled `go:yes`.
- **Issue #82 investigation (publish broken):** The "Publish to Substack" button on the article detail page at stage 7 (`article.ts:530`) POSTs to `/htmx/articles/:id/advance` — the generic advance handler that only bumps the DB stage. It should POST to `/api/articles/:id/publish` (`server.ts:1373`) which actually calls the Substack API via `substackService.publishDraft()`. Defense-in-depth gap: the `requireSubstackUrl` guard exists (`engine.ts:216`) but is not used in the `TRANSITION_MAP` for stage 7→8 (`engine.ts:270`). The `publish` action in `actions.ts:782` is intentionally a no-op ("handled externally"). Fix scope: small (~30 lines). Labeled `go:yes`.
- **Issue #76 investigation (mass document update service):** 43 articles in `content/articles/`, artifact-scanner (`artifact-scanner.ts`) already scans all dirs and infers stages — strong foundation for inventory (Phase 1). `ArtifactStore` (artifact-store.ts) has individual CRUD but no bulk ops. `SubstackService` (substack.ts) can create/update/publish drafts and `getDraft()` returns metadata only (not body). Critical blocker for Phase 4: Substack API has no read/update for published articles — extension.mjs explicitly blocks Stage 8 updates. Migration module (`migrate.ts`) provides good patterns for batch ops (dry-run, report struct, idempotent). Recommended phased approach: inventory CLI → local batch updates → draft sync → defer published merge. ~900 lines for Phases 1–3. Labeled `go:yes`.
- **Issue #83 implementation (fact-checking pipeline):** PR #89 merged. Three new modules: `claim-extractor.ts` (regex-based extraction of stat/contract/draft/performance claims), `fact-check-context.ts` (pre-computes nflverse lookup data before LLM fact-check — Option A), `validators.ts` (deterministic stat validation with 10% tolerance + draft round/pick/year validation — Option C). Wired into writeDraft (Stage 4→5), runEditor (Stage 5→6), and runPublisherPass (Stage 6→7) in actions.ts. Key regex insight: NAME_PAT must be case-SENSITIVE to avoid matching pronouns/common words; `[^.]` sentence boundaries fail at decimal points — use `(?:[^.]|\\.[\\d])` instead. 29 new tests, 1315 total passing.
- **Issue #85 coordination (structured domain knowledge POC):** Research's phase 1–3 recommendation standardizes reusable knowledge under `src/config/defaults/` with canonical glossaries/team sheets plus per-article `team-sheet.md` artifacts. The implementation seam stays on existing defaults/bootstrap and article-artifact patterns, with tests focused on bootstrap, actions, and validation coverage.
- **Issue #85 planning follow-up:** The repo now has static POC assets in `src/config/defaults/glossaries/*.yaml` and `content/data/team-sheets/{BUF,KC,SEA}.md`, with validation in `tests/config/domain-knowledge-content.test.ts` and `tests/config/domain-knowledge.test.ts`. Current runtime still only injects charters, skills, memory, and `roster-context.md` (`src/agents/runner.ts`, `src/pipeline/context-config.ts`, `src/pipeline/actions.ts`), so `docs/knowledge-system.md` must clearly separate phases 1–3 asset delivery from deferred runtime loading/refresh work.
- **Issue #85 phases 1-3 implementation:** Added four proof-of-concept glossary seeds under `src/config/defaults/glossaries/` and three proof-of-concept team sheets under `content/data/team-sheets/` for `SEA`, `KC`, and `BUF`. The glossary files use a shared YAML seed schema (`schema_version`, `id`, `glossary`, `description`, `entry_fields`, `refresh_guidance`, `entries`), while the team sheets use frontmatter plus a fixed markdown layout (`Durable snapshot`, `Identity anchors`, `Offense`, `Defense`, `Roster-building and cap framing`, `Source guidance`). Validation lives in `tests/config/domain-knowledge-content.test.ts` and `tests/config/domain-knowledge.test.ts`, and docs were updated in `docs/knowledge-system.md` and `README.md`.
- **Issue #93 article usage gap:** Copilot CLI estimated usage already survives provider → `AgentRunner.tokensUsed` → `recordAgentUsage()`; the missing article-page data came from `Repository.getUsageEvents()` defaulting to the latest 100 rows. Article detail and live-sidebar usage panels aggregate directly from `repo.getUsageEvents(articleId)`, so older `copilot-cli` rows vanished once later panel/editor events exceeded that cap. Fix seam: `src/db/repository.ts` returns full article usage history by default and keeps an explicit `limit` argument for callers that truly want truncation. Coverage lives in `tests/agents/runner.test.ts`, `tests/pipeline/actions.test.ts`, `tests/db/repository.test.ts`, and `tests/dashboard/server.test.ts`.

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
- **Issue #103 editor-review cap:** `src/pipeline/conversation.ts` now exposes `MAX_EDITOR_PREVIOUS_REVIEWS = 10`; editor self-history is bounded newest-first both when queried (`getArticleConversation(..., { newestFirst: true, limit })`) and when formatted (`buildEditorPreviousReviews()`). `src/pipeline/actions.ts` applies that capped query during editor runtime prompt assembly, and `writeDraft` now uses `newestFirst: true` for its recent-editor dedupe check. Focused regression coverage lives in `tests/pipeline/conversation.test.ts` and validated with `npm run v2:test -- tests/pipeline/conversation.test.ts tests/pipeline/actions.test.ts` plus `npm run v2:build`.

- **Issue #103 final check:** No extra worktree edits were needed beyond the existing branch commit. Keep the `src/pipeline/actions.ts` runtime query cap plus `newestFirst: true` — the formatter cap alone is not enough because runtime prompt assembly must fetch the newest bounded editor reviews, and `writeDraft` dedupe must compare against the latest editor turn rather than the oldest limited row.
