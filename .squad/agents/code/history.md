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
