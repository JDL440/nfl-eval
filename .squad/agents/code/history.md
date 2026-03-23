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
