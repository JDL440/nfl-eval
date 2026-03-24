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

- 2026-03-25T17:03:10Z — **TLDR Retry Revision Fix Complete**: Fixed `writeDraft()` self-heal retry to append failed draft under `## Failed Draft To Revise` section before retry, allowing Writer to revise the output it just produced instead of restarting. Aligned Editor/Publisher charters: REVISE cases should preserve draft when analysis is sound. Updated all related skills for consistent TLDR validation language. Added regression test coverage. All 147 tests pass; build clean. Merged two inbox decisions (code implementation + scope) into unified decisions.md entry.
- 2026-03-23T05:39:03Z — **Tweet publishing 500 fixed**: Code agent reproduced and fixed dashboard tweet publish 500 using TwitterService startup injection pattern (same as Substack Notes/Publish). Root cause: missing service wiring in `startServer()`. Added `createTwitterServiceFromEnv()` factory + dependency injection + focused tests. All validations pass. Pattern is now the standard for optional dashboard services.
- 2026-03-25T10:30:00Z — **Publish payload decisions merged to decisions.md**: Three inbox items consolidated documenting HTML→ProseMirror regression analysis, fix implementation (refactored enrichment to operate on document nodes), and validation evidence (45 passing tests). Payload structure ready for staging/commit. Dashboard Substack wiring completed in prior pass. Active investigation: Note and Tweet publishing 500s.
- 2026-03-25 — Dashboard Substack config triage: confirmed the missing `SubstackService` wiring in `startServer()` is the root cause, and that the route tests are not exercising the real startup path.
- 2026-03-25 — Issue #118 promotion rule fix (Lead-implemented revision): repeated `process_improvement` findings must promote to issue-ready independent of author or priority. Added explicit repetition check to `promoteIssueCandidates()` with focused regression test. Validation passed (147/147 tests, build passing).
- 2026-03-24 — Issue #117 digest CLI approved: keep the data seam read-only, group by role + finding_type, and dedupe normalized findings in TypeScript.
- 2026-03-24 — Issue #107 validation refresh: canonical contract enforcement still passes, and the one-source TLDR/image policy remains the source of truth.
- 2026-03-23 — Publish warning investigation: the Stage 7 warning copy is intentional when no draft exists; the recovery path is create draft, then publish.

## Learnings

- 2026-03-23 — Issue #118 promotion layer: keep retrospective digest promotion read-only, emit disjoint process-improvement vs learning-update candidate arrays, and attach review evidence (`articleCount`, priorities, recency, sample articles, force-approval count) for manual follow-up.
- 2026-03-25 — Optional dashboard services should resolve through a shared app-seam helper. `src/dashboard/server.ts` now uses `resolveDashboardDependencies()` so env-configured Substack publishing works even when callers only invoke `createApp(...)`.
- 2026-03-25 — Preserve explicit dependency precedence over env fallback. This keeps `tests/dashboard/publish.test.ts` and any alternate runtime bootstrap deterministic while still fixing production startup wiring.
- 2026-03-23 — Publish-page UX should preflight optional Substack availability on the initial GET render, not only after a failing POST. `src/dashboard/views/publish.ts` now shows the actionable config hint inline and disables publish/draft controls (including Publish All) when `src/dashboard/server.ts` has no `substackService`.
- 2026-03-23 — Tweet publishing had the same startup seam gap as Substack: `startServer()` built `SubstackService` but never instantiated/passed `TwitterService`, so `/api/articles/:id/tweet` returned the runtime “not configured” 500 despite valid X credentials in env. The surgical fix lives in `src/dashboard/server.ts` via `createTwitterServiceFromEnv()` plus startup injection, with focused coverage in `tests/dashboard/publish.test.ts`.
- 2026-03-25 — Writer revision handoff is assembled in `src/pipeline/actions.ts` inside `writeDraft()`: shared cross-role context comes only from `buildRevisionSummaryContext()` while the latest full `editor-review.md` and previous `draft.md` are injected into `articleContext`. The exact merged writer prompt is runtime-only in `src/agents/runner.ts`; SQLite persists the pieces (`artifacts`, `article_conversations`, `revision_summaries`) but not a canonical per-iteration prompt snapshot.
- 2026-03-25 — `writeDraft()` self-heal retries must revise the just-failed draft, not rerun from the pre-draft context alone. The reliable seam is `src/pipeline/actions.ts`: keep the summary-only handoff, append the failed `draft.md` body under a dedicated revision heading for the retry, and keep prompt guidance aligned across `src/config/defaults/charters/nfl/{editor,publisher}.md` plus `src/config/defaults/skills/{editor-review,publisher}.md` so TLDR fixes are framed as revisions that preserve working analysis. Regression coverage now lives in `tests/pipeline/actions.test.ts`.
- 2026-03-25 — Issue #115 runtime was already satisfied by the existing manual/read-only retrospective digest seam: `src/cli.ts` provides `retrospective-digest` / `retro-digest`, `src/db/repository.ts` reads joined structured retrospective rows, and `src/pipeline/actions.ts` persists findings. The remaining gap was operator guidance, now documented in `README.md` with run commands and the manual review loop.
