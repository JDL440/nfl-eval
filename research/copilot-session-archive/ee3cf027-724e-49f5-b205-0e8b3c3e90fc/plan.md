# NFL Lab v2 — Dashboard UX Overhaul

## Current Focus: Dashboard UX Improvements (Iteration-based)

### Problem
The v2 dashboard is a minimal MVP missing critical features from v1. The idea submission UX is clunky (manual slug/title), there's no auto-advance, the publish workflow is incomplete, and features like token usage and artifact viewing are missing or broken.

### Approach
Iterative waves, testing each before moving to the next:

### Wave 1: Artifacts to DB + Smart Idea Submission ✅ (834 → 834 tests)
- [x] Add artifacts table to schema (article_id, name, content, created_at, updated_at)
- [x] Create ArtifactStore abstraction (read/write artifacts to DB instead of filesystem)
- [x] Update PipelineEngine guards to read from ArtifactStore
- [x] Update dashboard routes to use ArtifactStore
- [x] Rewrite idea form: textarea prompt, LLM generates title/slug
- [x] Multi-team tag selector (add/remove chips)
- [x] Auto-advance toggle + backend endpoint

### Wave 2: Article Detail + Artifact Viewer ✅ (834 → 874 tests)
- [x] Rich artifact tabs with markdown rendering (markdownToHtml service)
- [x] Token usage display panel (aggregated by model + stage)
- [x] Stage runs panel (duration, status, model info)
- [x] Enhanced stage timeline with transition timestamps
- [x] Editor review cards with visual verdict badges (✅/🔄/❌)
- [x] New HTMX endpoints: /usage, /stage-runs

### Wave 2.5: Pipeline Operations ✅ (874 → 889 tests)
- [x] Remove all filesystem dual-writes (ArtifactStore is sole source of truth)
- [x] User-friendly guard messages (no more internal filenames like "idea.md does not exist")
- [x] Wire auto-advance to `executeTransition()` — invokes real LLM agents when ActionContext available
- [x] Lightweight fallback mode (guard-only advance) when no agents configured (tests, dev)
- [x] Editor REVISE verdict handling in auto-advance (regresses to Stage 4)
- [x] Stage regression: `regressStage()` in Repository, `regress()` in PipelineEngine
- [x] Regress API: `POST /api/articles/:id/regress` + `POST /htmx/articles/:id/regress`
- [x] "↩ Send Back" dropdown UI on article detail (stages 2-7) with target stage + reason
- [x] `revision` article status type
- [x] Scheduler updated with optional ActionContext for full agent execution
- [x] 15 new tests covering regression, regress API, validation

### Wave 2.75: Auto-Advance Failure Visibility ✅ (939 tests)
- [x] Red error banner on article page when auto-advance fails
- [x] Last failed stage_run shown inline in action panel
- [x] "🔄 Retry Auto-Advance" button (HTMX, stages 1-6)
- [x] New idea form passes error reason in redirect URL

### Wave 3: Publish Workflow ✅ (939 → 949 tests)
- [x] Interactive publisher checklist (HTMX toggles, persist to DB)
- [x] Inline Note composer (textarea + article card attachment)
- [x] Inline Tweet composer (textarea + live 280-char counter, t.co aware)
- [x] Unified "Publish All" flow (Publish → Note → Tweet, sequential with progress)
- [x] SSE EventBus wired (stage_changed, article_created, article_published)
- [x] SSE-powered live updates on article detail + home page (htmx sse-connect)

### Wave 4: Polish ✅ (949 tests across 33 files)
- [x] Pipeline filtering: search, stage, team, depth dropdowns with HTMX
- [x] Extended listArticles() with team, depthLevel, search filters
- [x] Dark theme toggle (CSS custom properties + localStorage + prefers-color-scheme)
- [x] Export artifacts CLI: `node dist/cli.js export <article-id> [output-dir]`

## Phase A–D Completed (see v2-worklist.md for details)
- All 17 todos done: A1-A3, B1-B5, C1/C3-C5, D1-D5
- 1134 tests passing across 43 files

## Knowledge System Hardening & Documentation ✅ (1156 tests, commit 61344ad)

### Phase K1: Prune Stale Knowledge Data
- [x] **K1a: Purge v1 migrated memory entries** — Deleted 559 stale entries (85 recent auto-learned retained)
- [x] **K1b: Update 3 stale skills** — Rewrote knowledge-propagation, knowledge-recording, history-maintenance for v2 memory.db
- [x] **K1c: Improve auto-learning quality** — Store meaningful output summaries, relevance 0.6, min 20 chars

### Phase K2: Bootstrap Knowledge for Fresh Installs
- [x] **K2a: Seed charter files** — 16 NFL specialist charters in `src/config/defaults/charters/nfl/`
- [x] **K2b: Seed skill files** — 14 skills in `src/config/defaults/skills/` (3 rewritten for v2)
- [x] **K2c: Seed bootstrap memory** — 28 domain_knowledge entries in `bootstrap-memory.json`
- [x] **K2d: Wire init to copy seeds** — Split initDataDir + seedKnowledge (safe startup vs init-only)
- [x] **K2e: Extensibility: league-parameterized init** — Both functions accept `league` parameter

### Phase K3: Knowledge System Documentation
- [x] **K3a: Write docs/knowledge-system.md** — 11KB comprehensive documentation
- [x] **K3b: Update README** — Knowledge system section + Memory page link
- [x] **K3c: Add dashboard help text** — Collapsible help on Memory browser and Agents pages

### Tests & Validation
- [x] **K4a: Test bootstrap init** — 11 new tests for initDataDir/seedKnowledge
- [x] **K4b: Run full test suite** — 1156 tests passing across 46 files

---

## Phase K5: Knowledge Refresh & Fact-Checking (from deep-dive research)

> Source: research/lets-do-a-deep-dive-on-what-these-all-are-how-they.md — Phases 3 & 4

### K5a: Wire Fact-Checking Into Pipeline
- [ ] Add `skills: ['fact-checking']` to the `writeDraft` action (stage 4→5) — skill exists but is never invoked
- [ ] Alternatively: add as a separate fact-check step between panel discussion and draft writing
- [ ] Store fact-check results as `panel-factcheck.md` artifact

### K5b: Agent Knowledge Refresh Action
- [ ] Add "Refresh Knowledge" dashboard action per agent — calls existing MCP tools:
  - Team agents → `query_team_efficiency`, `query_snap_counts`, `query_pfr_defense`
  - Cap agent → OTC/Spotrac data tools
  - Draft agent → `query_draft_history`, `query_combine_profile`
- [ ] Store refreshed data as `domain_knowledge` memory entries with source + date in content
- [ ] Add "Refresh All" bulk action on Agents page

### K5c: Staleness Detection
- [ ] Add `last_verified_at` concept to domain_knowledge entries (store date in content JSON)
- [ ] On recall, surface entries not verified in >7 days
- [ ] Dashboard shows "stale knowledge" badge on agent cards

### K5d: Memory Relevance Tuning
- [ ] Call `touch()` when memories are actually used in a prompt that produces good output
- [ ] Run `decay()` on dashboard startup (factor 0.95) to gradually deprioritize old entries
- [ ] Add decay/prune schedule or manual trigger in dashboard

## Phase K6: Structured Knowledge & Cleanup

### K6a: Structured Domain Knowledge Entries
- [ ] Replace raw text blobs with typed JSON: `{ type: 'roster'|'cap'|'coaching'|'draft', team, data, source, verifiedAt }`
- [ ] Web refresh workflow: dashboard button → MCP tool → parse → store as domain_knowledge → prune old

### K6b: Charter Versioning
- [ ] Track charter edits over time (git-based or DB changelog)
- [ ] Show edit history on agent detail page

### K6c: Archive .squad/
- [ ] Move remaining `.squad/` v1 artifacts to archive or delete
- [ ] Verify no code references .squad/ paths
