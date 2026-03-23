# History — Code

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, Hono, HTMX, SQLite, Vitest
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `src/` (core), `src/dashboard/` (Hono routes), `src/pipeline/` (article pipeline), `src/llm/` (LLM gateway), `src/mcp/` (MCP tools), `tests/` (vitest), `vitest.config.ts`

## Core Context

### Issue #107 — Canonical TLDR Contract Enforcement
- Single source of truth: `src/config/defaults/skills/substack-article.md` with YAML frontmatter
- Stage 5→6 enforcement: `inspectDraftStructure()` in `src/pipeline/engine.ts` requires near-top `> **📋 TLDR**` block with four bullets
- Writer self-healing: `src/pipeline/actions.ts` retries once, then synthetic `editor-review.md` REVISE send-back if malformed
- All charters/skills reference canonical contract; no duplicated structure rules
- Windows CRLF compatibility: `AgentRunner.loadSkill()` normalizes CRLF before parsing frontmatter
- Regression coverage: 145/145 tests passing in engine, actions, and mock provider

### Issue #108 — Post-Stage-7 Retrospective Persistence
- Structured persistence: `article_retrospectives` + `article_retrospective_findings` tables
- Artifact generation: auto-synthesizes `revision-retrospective-rN.md` from revision_summaries on Stage 7 advance
- Read/write APIs in repository; idempotency contract: `(article_id, completion_stage, revision_count)`
- Heuristic parsing: force-approval detection from `editor-review.md` text
- Scope deferred: Dashboard surfacing, CLI digest, workflow automation, backfilling, manual-advance hooks

### Issue #109 — Article Detail Revision History Rendering
- Hydrates revision loops from `getArticleConversation()` + `getRevisionHistory()` via `buildRevisionHistoryEntries()`
- Renders in `src/dashboard/views/article.ts`; no longer treats legacy `editor_reviews` as main surface
- Markdown artifact tabs: advertise `*.thinking.md` sidecars; prefer persisted sidecar over inline `<think>` blocks

### Issue #110 — Article Timing Totals
- Dashboard aggregation over existing `stage_runs.started_at` and `stage_runs.completed_at`
- No schema change needed; per-state/retry timing remains separate persistence question
- Article detail already hydrated via `repo.getStageRuns(id)` and renders per-run elapsed time

### Dashboard & Pipeline Architecture
- Port 3456: Hono + HTMX + SSE (no auth middleware currently; login routes deferred)
- Configuration: `src/config/index.ts` loads `.env` and `~/.nfl-lab/config/.env`
- Article pipeline: 47 agents in `src/config/defaults/charters/nfl/`; separate from Squad agents
- Usage tracking: consistent token estimation (4 chars/token); cost estimation from pricing table
- Stage 7 publish: calls dedicated endpoint instead of generic advance handler; requires `substack_draft_url`

### Issue #117 — Retrospective Digest CLI (Approved)
- Keep digest read-only; source from single joined repository query over `article_retrospectives`, `article_retrospective_findings`, article metadata
- Role + finding_type grouping (12 natural categories); normalize finding text for deduping
- Evidence collection: article count, priority distribution, recency per group
- Promotion thresholds: Process improvement (Lead-authored OR 2+ articles), Learning update (high-priority recent OR 3+ articles)
- Output: bounded human-readable markdown + optional JSON; no auto-issue creation (v1 safe)
- Focused validation passed: `npm run v2:test -- tests\cli.test.ts tests\db\repository.test.ts` and `npm run v2:build`

### Dashboard Publish/Substack Config Flow (Recent)
- HTMX 500 responses don't swap publish panel; for HTMX publish actions, return HTML fragment from `renderPublishWorkflow()` with recovery guidance
- For non-HTMX callers, keep JSON 500 responses
- Required env vars: `SUBSTACK_TOKEN` + `SUBSTACK_PUBLICATION_URL` (stage/notes vars only for those paths)
- Startup wiring gap: `createApp()` expects optional `substackService` but `startServer()` never constructs or passes it
- Recommendation: treat integrations as startup-wired optional services, not route-level env lookups
- Route tests pass because they inject mocks directly; add startup-path coverage to catch future wiring gaps

### Development & Testing Patterns
- Dev launcher: `npm run v2:serve` handles `.env` loading and `initDataDir()`; wrapper in `dev.ps1` for port override
- Build: `npm run v2:build` (passes currently)
- Tests: `npm run v2:test` for focused runs; Vitest for article pipeline, dashboard, LLM, and repository suites
- Build issue in `src/dashboard/views/publish.ts:157` is pre-existing, unrelated to recent work
- Stage 7 manual publish readiness keys off `substack_draft_url`; regression in `tests/dashboard/server.test.ts`
- Auth should stay disabled by default in tests/dev unless explicitly enabled

## Recent Learnings

- 2026-03-23T04:12:59Z — **UX Dashboard Publish Review findings integrated**: UX submitted read-only findings on dashboard publish/draft HTMX config error handling. HTMX 500 responses don't swap the publish panel. Recommendation: for HTMX publish-panel actions with missing `substackService`, return HTML fragment from `renderPublishWorkflow()` with setup guidance. Keep non-HTMX callers on JSON 500. Startup wiring consensus: treat publishing integrations as startup-wired optional services. See decisions.md for full Substack runtime wiring decision chain.


### 2026-03-24T02-40-39Z: Scribe Orchestration Log — Issue #107 Completion

**Session:** Scribe processed Issue #107 completion orchestration.

**Tasks Completed:**
- Wrote orchestration log: `.squad/orchestration-log/2026-03-24T02-40-39Z-code.md` — Code agent completion record
- Wrote orchestration log: `.squad/orchestration-log/2026-03-24T02-40-39Z-lead.md` — Lead agent ready-for-review record
- Wrote session log: `.squad/log/2026-03-24T02-40-39Z-issue-107.md` — Comprehensive session summary
- Merged decision inbox into `.squad/decisions.md` and deduplicated (code-issue-107 matched primary record)
- Updated agent history with cross-team outcomes

**Status:** Issue #107 orchestration complete. Code and Lead deliverables logged. Ready for validation pass.

### 2026-03-23T04:09:08Z: Scribe Cross-Agent Update — TLDR Contract Canonicalization

**Decision logged:** "Code Decision — Issue #107 TLDR Contract Canonicalization" (already in decisions.md as primary record).

**Canonical source:** `src/config/defaults/skills/substack-article.md` — single source of truth for article top-of-article order, including required `> **📋 TLDR**` block and four-bullet minimum.

**Why this matters for Code:**
- Runtime enforcement already present in `src/pipeline/engine.ts` via `inspectDraftStructure()`.
- Prompt docs, tests, and agent charters should all reference the same rule to prevent drift.
- Writer repair prompts, Editor expectations, Publisher verification, and test fixtures stay aligned.

**Follow-through commitments:**
- Writer, Editor, and Publisher charters all point to `src/config/defaults/skills/substack-article.md`.
- Publisher verification focuses on checking the canonical contract rather than redefining it.
- Regression coverage for Stage 5→6 TLDR guards and writer prompt composition maintained.
