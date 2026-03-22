# History — Code

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, Hono, HTMX, SQLite, Vitest
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `src/` (core), `src/dashboard/` (Hono routes), `src/pipeline/` (article pipeline), `src/llm/` (LLM gateway), `src/mcp/` (MCP tools), `tests/` (vitest), `vitest.config.ts`

## Core Context

- Team initialized 2025-07-18; the 47 article pipeline agents in `src/config/defaults/charters/nfl/` are separate from Squad agents.
- Issue #81 added usage-event cost estimation; Copilot CLI usage remains estimated because provider usage is undefined.
- Issue #82 is the publish-stage guardrail case: the article page must call the real Substack publish endpoint, not the generic advance handler.
- Issue #83 wired fact checking into the pipeline with claim extraction, nflverse fact-check context, and deterministic validators.
- Issue #85 established the static knowledge-asset proof of concept under defaults/team-sheet artifacts, with runtime loading deferred.
- Issue #88 and #92 established per-article conversation context plus the hybrid summary/handoff model.
- Issue #93 fixed article usage-history reads by keeping full-history ordering deterministic and bounded reads explicit.
- Persisted `*.thinking.md` artifacts are the canonical article debug source.

## Learnings

- 2026-03-22 — TLDR enforcement investigation: writer instructions come from the charter plus `substack-article`, but TLDR remains prompt-only; the runtime guard should hard-fail missing structure instead of relying on prompts.
- 2026-03-22 — Issue #104 usage history follow-up: `created_at DESC, id DESC` ordering plus a matching index makes same-second history reads deterministic.
- 2026-03-22 — Debug visibility restore: the main article view should read companion `*.thinking.md` artifacts first, with inline extraction only as a fallback.
- 2026-03-22 — Issue #85 static knowledge pass: keep authored assets under `src/config/defaults/` plus team-sheet artifacts; runtime loading stays deferred.
- 2026-03-22 — Issue #93 history handling: keep the repository default bounded for callers that only need recent usage, and preserve the unbounded full-history path for UI history views.
