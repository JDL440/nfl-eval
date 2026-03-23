# History — Code

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, Hono, HTMX, SQLite, Vitest
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `src/` (core), `src/dashboard/` (Hono routes), `src/pipeline/` (article pipeline), `src/llm/` (LLM gateway), `src/mcp/` (MCP tools), `tests/` (vitest), `vitest.config.ts`

## Core Context

- Issue #107 locked the canonical `substack-article` contract: one TLDR/image policy source for Writer, Editor, Publisher, and pipeline guards.
- Issue #108 added the post-Stage-7 retrospective runtime and repository persistence, with structured tables plus a synthesized `revision-retrospective-rN.md` artifact.
- Issue #109 renders revision history from the conversation/revision seams; Issue #110 keeps stage timing as a dashboard aggregation over existing timestamps.
- Dashboard architecture is Hono + HTMX + SSE on port 3456, with config loaded from `.env` and `~/.nfl-lab/config/.env`.
- The current Substack publish bug is a startup wiring gap: `createApp()` accepts `substackService`, but normal startup never constructs or forwards it, so dashboard publish routes return the generic not-configured response.
- Issue #117 keeps the retrospective digest CLI read-only, using one joined repository query plus normalized-text dedupe and bounded markdown/JSON output.

## Recent Learnings

- 2026-03-25 — Dashboard Substack config triage: confirmed the missing `SubstackService` wiring in `startServer()` is the root cause, and that the route tests are not exercising the real startup path.
- 2026-03-24 — Issue #117 digest CLI approved: keep the data seam read-only, group by role + finding_type, and dedupe normalized findings in TypeScript.
- 2026-03-24 — Issue #107 validation refresh: canonical contract enforcement still passes, and the one-source TLDR/image policy remains the source of truth.
- 2026-03-23 — Publish warning investigation: the Stage 7 warning copy is intentional when no draft exists; the recovery path is create draft, then publish.

## Learnings

- 2026-03-23 — Issue #118 promotion layer: keep retrospective digest promotion read-only, emit disjoint process-improvement vs learning-update candidate arrays, and attach review evidence (`articleCount`, priorities, recency, sample articles, force-approval count) for manual follow-up.
- 2026-03-25 — Optional dashboard services should resolve through a shared app-seam helper. `src/dashboard/server.ts` now uses `resolveDashboardDependencies()` so env-configured Substack publishing works even when callers only invoke `createApp(...)`.
- 2026-03-25 — Preserve explicit dependency precedence over env fallback. This keeps `tests/dashboard/publish.test.ts` and any alternate runtime bootstrap deterministic while still fixing production startup wiring.
