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

- 2026-03-23 — **Dev launcher (v2)**: Recreated `dev.ps1` to invoke `npm run v2:serve` per README.md and package.json. The current v2 startup already handles `.env` loading and `initDataDir()` during serve. PowerShell wrapper is thin: UTF-8 encoding, command visibility, port override. Commit 696ddbe81868af2569ce4eace6b082292e85388a.
- 2026-03-23 — PR #113 cleanup: Stage 7 manual publish readiness belongs in the dashboard action panel and should key off `substack_draft_url`; the regression stays anchored in `tests/dashboard/server.test.ts`.
- 2026-03-23 — Issue #110 triage: article timing totals are a dashboard aggregation over existing `stage_runs`; per-state or retry-aware timing remains a separate persistence question.
- 2026-03-23 — Spawn-manifest follow-up: the article detail page already has hydrated stage-run data and per-run elapsed-time rendering, so no schema change is needed for the base total-time view.

## Learnings

- 2026-03-23 — Publish warning investigation: the Stage 7 article-detail warning `Create a Substack draft in the publish workspace before publishing` is intentional. It appears when `article.current_stage === 7` and `article.substack_draft_url` is null; the expected recovery path is `GET /articles/:id/publish` → `POST /api/articles/:id/draft` → `repo.setDraftUrl(...)`.
- 2026-03-23 — Dashboard auth research: `src/dashboard/server.ts` exposes the Hono dashboard directly from `createApp()` with SSE registration plus `/static/*`, then all HTML/API/HTMX routes without any auth middleware, login route, cookie handling, or session store. Config comes from `src/config/index.ts` (`loadDotEnv()`, `loadConfig()`) and currently covers NFL_* runtime plus provider/service env vars only. Repository/schema (`src/db/repository.ts`, `src/db/schema.sql`) have no auth/session tables or methods. Existing tests (`tests/dashboard/server.test.ts`, `tests/dashboard/publish.test.ts`, `tests/e2e/live-server.test.ts`, `tests/dashboard/config.test.ts`) hit routes directly with no login setup, so the clean long-term seam is Hono middleware + login/logout routes + opaque SQLite-backed sessions, while keeping auth disabled by default in tests/dev unless explicitly enabled.
- 2026-03-23 — Issue #109: article detail now hydrates revision loops from `getArticleConversation()` + `getRevisionHistory()` via `buildRevisionHistoryEntries()` in `src/pipeline/conversation.ts`, then renders them in `src/dashboard/views/article.ts` instead of treating legacy `editor_reviews` as the main history surface.
- 2026-03-23 — Issue #109: markdown artifact tabs should advertise companion `*.thinking.md` sidecars directly on the main tab, and `renderArtifactContent()` should prefer the persisted sidecar trace while stripping inline `<think>` blocks from the artifact body as a fallback-only path.
