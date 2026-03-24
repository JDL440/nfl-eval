# History — Lead

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, Hono, HTMX, SQLite, Vitest
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `src/` (core), `src/dashboard/` (Hono routes), `src/pipeline/` (article pipeline), `tests/` (vitest)

## Core Context

- Issue #107 established canonical `substack-article` contract: one TLDR/image policy source for all Writer/Editor/Publisher roles and pipeline guards.
- Issue #108 integrated post-Stage-7 retrospective runtime, structured tables, and synthesized `revision-retrospective-rN.md` artifact.
- Dashboard architecture is Hono + HTMX + SSE on port 3456; config loaded from `.env` and `~/.nfl-lab/config/.env`.
- Issue #115 retrospective digest decision: keep runtime seam read-only (manual CLI trigger, structured DB layer, bounded digest output); do not add numbered stage, auto-created issues, or scheduler. Routed operator-facing documentation pass to Code agent.
- Issue #118 promotion layer: keep retrospective digest promotion read-only, emit disjoint process-improvement vs learning-update candidate arrays, attach review evidence (`articleCount`, priorities, recency, sample articles, force-approval count) for manual follow-up.
- Issue #120 creates structured blocker tracking within existing revision loop: extend `revision_summaries` with `blocker_type` + JSON `blocker_ids` while preserving backward-compatible `feedback_summary` and `key_issues`. Detection and routing handled by Code agent.
- Issue #123 decision: repeated-blocker escalation at Stage 6 for exact consecutive Editor `REVISE` comparison. No new stage or policy-driven fallback mode. Issue #124 (fallback to opinion-framed mode) remains blocked pending #120 + #123; route to Research when unblocked. Code implementation approved.
- Issue #125 three-slice writer fact-check: (A) bounded policy definition approved, (B) Stage 5 wall-clock budget enforcement approved, (C) Editor consumption approved. Writer provides bounded verification ledger; Editor maintains final authority. Full arc complete.
- Optional dashboard services (Substack, Twitter) require startup dependency injection. Tests must exercise real bootstrap path, not mock routes.
- Lead review process: verify contract points, narrow scope, non-goals untouched, focused test coverage, clean build.

## Learnings

- 2026-03-23T21:53:55Z — **Issue #102 Auth Review Batch Complete**: High-signal code review of auth implementation found no significant issues. Minor note: image route regex assumes flat `/images/:slug/:file` paths and may treat nested published image paths as protected by default. All contract points validated, test coverage adequate, TypeScript build passing, ready for merge pending operator docs. See `.squad/orchestration-log/20260323T215355Z-lead.md` and session log `.squad/log/20260323T215355Z-issue-102-auth-review-rundown.md`.
- 2026-03-24T04:46:45Z — **Issue #102 Auth Architecture Complete**: Local dashboard auth hardening approved and implementation-ready. Minimal design confirmed: config-driven `off|local` mode, env-backed username/password, SQLite-backed opaque sessions, centralized Hono middleware protecting dashboard HTML/HTMX/API/SSE/unpublished images with narrow public carve-outs for static assets, login/logout, and published images. Code agent has completed implementation with all tests passing and TypeScript build fixed. Ready for merge pending operator docs confirmation. See `.squad/orchestration-log/2026-03-24T04-46-45Z-lead.md` and `.squad/decisions.md` (Lead Decision — Issue #102).
- 2026-03-26T03:26:23Z — **Issue #123 Review & Approval**: Code implementation for repeated-blocker escalation reviewed and approved. All contract points verified: exact consecutive Editor `REVISE` comparison only, repeated case escalates at Stage 6 without new stage, normal loop bypass narrow, read paths expose state/artifact where appropriate, artifact lifecycle bounded. Focused tests passed. Build passed. Implementation ready for merge. Out of scope: Issue #124 remains blocked pending Research phase for fallback policy work. See `.squad/orchestration-log/2026-03-24T03-26-23Z-Lead.md`.
- 2026-03-23T21:43:49-07:00 — **Issue #102 Auth Review**: Minimal approved shape is single-operator local login (`off|local`) with env-backed username/password, SQLite-backed `dashboard_sessions`, and one server middleware protecting dashboard HTML, HTMX, JSON API, SSE, and unpublished `/images/*` while leaving `/static/*`, `/login`, `/logout`, and published images public. Focused auth tests are present and passing (`tests/dashboard/server.test.ts`, `tests/dashboard/config.test.ts`, `tests/dashboard/publish.test.ts`, `tests/e2e/live-server.test.ts`), but current branch is not merge-ready until the TypeScript build failure in `src/config/index.ts` (`AppConfigOverrides` vs `Partial<AppConfig>`) is fixed and operator-facing auth docs are confirmed.
