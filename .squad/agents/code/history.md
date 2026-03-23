# History — Code

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, Hono, HTMX, SQLite, Vitest
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `src/` (core), `src/dashboard/` (Hono routes), `src/pipeline/` (article pipeline), `src/llm/` (LLM gateway), `src/mcp/` (MCP tools), `tests/` (vitest), `vitest.config.ts`

## Core Context

- Dashboard runs on port 3456 and the article detail seam already hydrates stage runs through `repo.getStageRuns(id)`.
- Article timing totals can be derived from `stage_runs.started_at` and `stage_runs.completed_at` without a schema change; per-state/retry timing is a separate persistence problem.
- Issue #93: article usage panels need the full usage history by default, because a 100-row cap hid older Copilot CLI events once later events accumulated.
- Issue #92: writer/publisher should receive the compact shared revision handoff, while editor gets the shared summary plus previous reviews to avoid prompt bleed.
- Issue #88: conversation history is stored per article with revision summaries; long turns are truncated for prompt context.
- Issue #85: structured domain knowledge is a static asset pass for phases 1-3, with runtime injection and refresh automation deferred to issue #91.
- Issue #83: claim extraction, fact-check context, and deterministic validators are wired into writeDraft, runEditor, and runPublisherPass.
- Issue #82: the stage 7 publish button should call the publish endpoint instead of the generic advance handler.
- Issue #81: usage events track tokens consistently; cost estimation uses the pricing table, and Copilot CLI token usage is estimated at roughly 4 chars/token.
- 47 article pipeline agents live in `src/config/defaults/charters/nfl/` and are separate from Squad agents.

## Recent Learnings

- 2026-03-24 — **Issue #107 completion**: Canonical article TLDR contract now lives in `src/config/defaults/skills/substack-article.md` with YAML frontmatter for Windows CRLF compatibility. Stage 5→6 enforcement via `inspectDraftStructure()` in `src/pipeline/engine.ts`. Writer self-healing in `src/pipeline/actions.ts` with synthetic send-back for malformed drafts. All charters/skills reference single contract. Test coverage complete (145/145). Build issue in `src/dashboard/views/publish.ts:157` is pre-existing dashboard bug unrelated to Issue #107 implementation.
- 2026-03-23 — **Dev launcher (v2)**: Recreated `dev.ps1` to invoke `npm run v2:serve` per README.md and package.json. The current v2 startup already handles `.env` loading and `initDataDir()` during serve. PowerShell wrapper is thin: UTF-8 encoding, command visibility, port override. Commit 696ddbe81868af2569ce4eace6b082292e85388a.
- 2026-03-23 — PR #113 cleanup: Stage 7 manual publish readiness belongs in the dashboard action panel and should key off `substack_draft_url`; the regression stays anchored in `tests/dashboard/server.test.ts`.
- 2026-03-23 — Issue #110 triage: article timing totals are a dashboard aggregation over existing `stage_runs`; per-state or retry-aware timing remains a separate persistence question.
- 2026-03-23 — Spawn-manifest follow-up: the article detail page already has hydrated stage-run data and per-run elapsed-time rendering, so no schema change is needed for the base total-time view.

## Learnings

- 2026-03-25 — Dashboard Substack publish 500 triage: the `"Substack publishing is not configured for this environment."` error on `/api/articles/:id/draft` and `/api/articles/:id/publish` is triggered by `!substackService` in `src/dashboard/server.ts`, and normal startup currently guarantees that state because `createApp()` accepts `substackService` but `startServer()` never constructs or passes one. For local draft/article publishing, env is loaded from repo-root `.env` or `~/.nfl-lab/config/.env`; the real required vars are `SUBSTACK_TOKEN` + `SUBSTACK_PUBLICATION_URL`, while `SUBSTACK_STAGE_URL` and `NOTES_ENDPOINT_PATH` are only for stage-target/Notes paths.
- 2026-03-24 — Issue #117 manual digest: keep the retrospective CLI read-only and source it from a single joined repository query over `article_retrospectives` + `article_retrospective_findings` + article metadata, then do role+finding_type grouping plus normalized-text dedupe in TypeScript so markdown and JSON outputs share one bounded report builder. Focused validation passed with `npm run v2:test -- tests\cli.test.ts tests\db\repository.test.ts` and `npm run v2:build`.
- 2026-03-24 — Issue #107 follow-up: keep `src/config/defaults/skills/substack-article.md` as the only TLDR/order contract, and make Writer/Editor/Publisher docs point to that file instead of `~/.nfl-lab` aliases or duplicated checklist wording. `tests/pipeline/actions.test.ts` needs an explicit fact-check fixture before draft fixtures whenever `writeDraft()` uses `RecordingProvider`, because the lead preflight consumes the first canned response before the writer draft call.
- 2026-03-24 — Issue #108 port triage: committed `main` (HEAD `991c66b`) still lacks retrospective automation, but the current checkout already has a local WIP port across `src/pipeline/actions.ts`, `src/db/repository.ts`, `src/db/schema.sql`, `src/types.ts`, `tests/pipeline/actions.test.ts`, and `tests/db/repository.test.ts`. The safe slice is backend-only: keep the post-Stage-7 artifact + structured persistence seam, but do **not** copy the worktree branch's older `buildConversationContext`/draft-repair code or its `usage_events` ordering changes (`ORDER BY created_at DESC` without `id DESC`), because current checkout has newer handoff/validation behavior and deterministic usage-history guarantees.
- 2026-03-23 — Publish warning investigation: the Stage 7 article-detail warning `Create a Substack draft in the publish workspace before publishing` is intentional. It appears when `article.current_stage === 7` and `article.substack_draft_url` is null; the expected recovery path is `GET /articles/:id/publish` → `POST /api/articles/:id/draft` → `repo.setDraftUrl(...)`.
- 2026-03-23 — Dashboard auth research: `src/dashboard/server.ts` exposes the Hono dashboard directly from `createApp()` with SSE registration plus `/static/*`, then all HTML/API/HTMX routes without any auth middleware, login route, cookie handling, or session store. Config comes from `src/config/index.ts` (`loadDotEnv()`, `loadConfig()`) and currently covers NFL_* runtime plus provider/service env vars only. Repository/schema (`src/db/repository.ts`, `src/db/schema.sql`) have no auth/session tables or methods. Existing tests (`tests/dashboard/server.test.ts`, `tests/dashboard/publish.test.ts`, `tests/e2e/live-server.test.ts`, `tests/dashboard/config.test.ts`) hit routes directly with no login setup, so the clean long-term seam is Hono middleware + login/logout routes + opaque SQLite-backed sessions, while keeping auth disabled by default in tests/dev unless explicitly enabled.
- 2026-03-23 — Issue #109: article detail now hydrates revision loops from `getArticleConversation()` + `getRevisionHistory()` via `buildRevisionHistoryEntries()` in `src/pipeline/conversation.ts`, then renders them in `src/dashboard/views/article.ts` instead of treating legacy `editor_reviews` as the main history surface.
- 2026-03-23 — Issue #109: markdown artifact tabs should advertise companion `*.thinking.md` sidecars directly on the main tab, and `renderArtifactContent()` should prefer the persisted sidecar trace while stripping inline `<think>` blocks from the artifact body as a fallback-only path.
- 2026-03-23 — Issue #107: the canonical article TLDR contract now lives in `src/config/defaults/skills/substack-article.md` with YAML frontmatter so `AgentRunner.loadSkill()` actually injects it on Windows CRLF files; `src/agents/runner.ts` now normalizes CRLF before parsing skill frontmatter.
- 2026-03-23 — Issue #107: Stage 5→6 draft gating now uses `inspectDraftStructure()` in `src/pipeline/engine.ts` to require a near-top `> **📋 TLDR**` block with four bullets in addition to the existing minimum-word-count guard.
- 2026-03-23 — Issue #107: `src/pipeline/actions.ts` now self-heals malformed writer drafts once, then sends Stage 5 drafts back to Writer with a synthetic `editor-review.md` REVISE note while preserving the previous `draft.md` so revision prompts can repair structure instead of rewriting blind.
- 2026-03-23 — Issue #107: `src/config/defaults/skills/substack-article.md` is the canonical article skeleton contract. Stage 5→6 enforcement lives in `src/pipeline/engine.ts` via `inspectDraftStructure()` / `requireDraft()`, while `src/pipeline/actions.ts` self-heals malformed writer output and auto-advance regresses malformed drafts back to Stage 4 with a synthetic send-back review. Regression coverage lives in `tests/pipeline/engine.test.ts`, `tests/pipeline/actions.test.ts`, and `tests/llm/provider-mock.test.ts`.
- 2026-03-24 — Publish-flow investigation: `src/dashboard/views/publish.ts` splits HTMX targets between `#publish-actions` and `#publish-result`, so the draft response swaps a different container than the follow-up publish button expects. Also, preview routes strip thinking before `markdownToProseMirror()`, but `POST /api/articles/:id/draft` currently converts raw `draft.md`, creating avoidable preview-vs-draft divergence.
- 2026-03-24 — **Publish-overhaul team session**: Coordinated investigation across Code, UX, Publisher, Validation, and Coordinator agents. Key findings: HTMX target mismatch, draft serialization divergence, terminology ambiguity ("publish workspace"), missing two-step explicit workflow. Decisions submitted to `.squad/decisions.md`: draft-first model (Publisher), explicit two-step UX (UX), canonical TLDR enforcement (Code). Coordinator implemented: shared richer preview path (`/api/articles/:id/publish-preview`), idempotent draft save/update, publish-now sync logic, cleaned Stage 7 copy, improved alerts. All regressions passing (`npm run v2:build`). Team ready for merge.

- 2026-03-23T02-30-59Z — **Ralph Round 2 session**: Completed Issue #107 implementation (canonical TLDR contract enforcement). Tests passing (145/145). Build blocked by pre-existing TypeScript error in src/server.ts (unrelated to this work). Orchestration log written; session log and decision inbox merged. Agent staged for Lead review of guardrail specification compliance.
- 2026-03-24 — Issue #107 cleanup: the remaining surgical gaps were policy drift and missing negative-path coverage. Keep `src/config/defaults/skills/substack-article.md` as the sole image/TLDR contract, and pin writer-repair failure plus editor-REVISE regressions in `tests/pipeline/actions.test.ts`, `tests/pipeline/engine.test.ts`, and `tests/llm/provider-mock.test.ts`.
- 2026-03-24 — Issue #108 retrospective port: main now persists post-revision retrospectives via `article_retrospectives` / `article_retrospective_findings`, synthesizes `revision-retrospective-rN.md` from `revision_summaries`, and auto-generates that artifact when `autoAdvanceArticle()` reaches Stage 7. Focused validation: `npm run v2:build` passed; new retrospective tests in `tests/db/repository.test.ts` and `tests/pipeline/actions.test.ts` passed, while three older `tests/pipeline/actions.test.ts` failures remain pre-existing in the current branch.
- 2026-03-24 — Issue #107 validation refresh: the canonical TLDR contract path remains `src/config/defaults/skills/substack-article.md`, with enforcement split between `inspectDraftStructure()` in `src/pipeline/engine.ts` and writer/auto-advance repair logic in `src/pipeline/actions.ts`. Focused regression coverage passed in `tests/pipeline/engine.test.ts`, `tests/pipeline/actions.test.ts`, and `tests/llm/provider-mock.test.ts`, and `npm run v2:build` currently succeeds on this tree.

### 2026-03-24T02:38:09Z: Ralph Round 3 — Retrospective Port Work (code-retro-port)

**Session:** Code agent completed retrospective port workspace work; base runtime slice ported to working tree, broader reconcile/review still needed before #114 merge.

**Scope Completed:**
- Ported structured retrospective persistence tables (`article_retrospectives`, `article_retrospective_findings`)
- Ported repository read/write APIs for retrospective tables
- Ported artifact generation and persistence logic for `revision-retrospective-rN.md`
- Added focused repository and pipeline-action tests
- Idempotency contract documented for `(article_id, completion_stage, revision_count)` upserts

**Scope Deferred (explicitly out of Phase 1):**
- Dashboard surfacing
- CLI digest/reporting
- Scheduled jobs / workflow automation
- Backfilling old articles
- Manual stage advancement retrospective triggers

**Risk Mitigation Notes:**
- Current mainline only guarantees automation through `autoAdvanceArticle()`
- Manual stage advancement paths may not emit retrospectives without additional hooks
- Heuristic narrowly scoped for `editor-review.md` text parsing force-approval detection

**Decision Status:** "Lead Decision — Retrospective Port Boundary" merged to `.squad/decisions.md`.

**Next:** Broader reconcile/review needed before mainline integration; Code to validate #114 merge readiness.

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
