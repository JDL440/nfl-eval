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

- 2026-03-24T23:35:00Z — **Writer ↔ Editor First-Pass Alignment Review**: Smallest high-value implementation seam is the existing Stage 5 runtime path, not a new stage. `src/pipeline/actions.ts` already owns Writer prompt assembly, self-heal, and send-back flow; `src/pipeline/engine.ts` already owns deterministic draft guards. Recommended shape: add a concise shared editor-style preflight skill for Writer runtime, then extend the existing Stage 5 validator with a narrow blocker inspector for high-signal deterministic misses (at minimum TLDR contract, `Next from the panel`, and obvious placeholder/TODO leakage). Keep `writer-factcheck.md` advisory-only and bounded; do not turn the lint path into open-ended fact-checking. Key validation slice for this area: `tests/pipeline/actions.test.ts`, `tests/pipeline/engine.test.ts`, `tests/pipeline/writer-factcheck.test.ts`, plus `npm run v2:build`.
- 2026-03-26T16:00:00Z — **Generate Idea Selector Architecture Review**: Reviewed dashboard idea form's expert agent selector implementation. Current approach (hardcoded PROD and TEAMS filters in `src/dashboard/server.ts` lines 852-858) is **functionally correct** but has **duplication and maintenance risks**. Finding: TEAMS set duplicates TEAM_ABBRS already defined in `src/dashboard/views/agents.ts` (including a 'wsh' vs 'was' inconsistency for Washington). Recommendation: Import `classifyCharter` and `TEAM_ABBRS` from agents.ts instead of redefining, fix the 'was' abbreviation, and consider data-driven approach for production agent classification in future. PROD set (lead, writer, editor, scribe, coordinator, panel-moderator, publisher) is acceptable for now if documented. Experts correctly filtered to show: analytics, cap, collegescout, defense, draft, injury, media, offense, playerrep, specialteams. Approval: **CONDITIONAL on hygiene fixes** (duplication elimination, 'was' correction).
- 2026-03-23T21:53:55Z — **Issue #102 Auth Review Batch Complete**: High-signal code review of auth implementation found no significant issues. Minor note: image route regex assumes flat `/images/:slug/:file` paths and may treat nested published image paths as protected by default. All contract points validated, test coverage adequate, TypeScript build passing, ready for merge pending operator docs. See `.squad/orchestration-log/20260323T215355Z-lead.md` and session log `.squad/log/20260323T215355Z-issue-102-auth-review-rundown.md`.
- 2026-03-24T04:46:45Z — **Issue #102 Auth Architecture Complete**: Local dashboard auth hardening approved and implementation-ready. Minimal design confirmed: config-driven `off|local` mode, env-backed username/password, SQLite-backed opaque sessions, centralized Hono middleware protecting dashboard HTML/HTMX/API/SSE/unpublished images with narrow public carve-outs for static assets, login/logout, and published images. Code agent has completed implementation with all tests passing and TypeScript build fixed. Ready for merge pending operator docs confirmation. See `.squad/orchestration-log/2026-03-24T04-46-45Z-lead.md` and `.squad/decisions.md` (Lead Decision — Issue #102).
- 2026-03-26T03:26:23Z — **Issue #123 Review & Approval**: Code implementation for repeated-blocker escalation reviewed and approved. All contract points verified: exact consecutive Editor `REVISE` comparison only, repeated case escalates at Stage 6 without new stage, normal loop bypass narrow, read paths expose state/artifact where appropriate, artifact lifecycle bounded. Focused tests passed. Build passed. Implementation ready for merge. Out of scope: Issue #124 remains blocked pending Research phase for fallback policy work. See `.squad/orchestration-log/2026-03-24T03-26-23Z-Lead.md`.
- 2026-03-23T21:43:49-07:00 — **Issue #102 Auth Review**: Minimal approved shape is single-operator local login (`off|local`) with env-backed username/password, SQLite-backed `dashboard_sessions`, and one server middleware protecting dashboard HTML, HTMX, JSON API, SSE, and unpublished `/images/*` while leaving `/static/*`, `/login`, `/logout`, and published images public. Focused auth tests are present and passing (`tests/dashboard/server.test.ts`, `tests/dashboard/config.test.ts`, `tests/dashboard/publish.test.ts`, `tests/e2e/live-server.test.ts`), but current branch is not merge-ready until the TypeScript build failure in `src/config/index.ts` (`AppConfigOverrides` vs `Partial<AppConfig>`) is fixed and operator-facing auth docs are confirmed.
- 2026-03-25T03:22:59Z — **Dashboard Mobile System Audit**: Reviewed the dashboard view set as one mobile system (`src/dashboard/views/{layout,home,article,preview,publish,runs,agents,memory,config,new-idea,login}.ts` plus `src/dashboard/public/styles.css`). Main finding: the current implementation has a responsive grid fallback, but no shared mobile shell contract. The header/nav in `layout.ts` stays desktop-first, dense data surfaces remain table-first (`runs.ts`, `memory.ts`, `config.ts`, plus artifact tables in article/publish flows), and the article/publish pages layer many ad-hoc action rows and absolute-positioned controls that do not degrade consistently on small screens. The dedicated preview “mobile” mode is also only a frame-width simulation (`preview.ts` + preview classes in `styles.css`), not a true whole-page mobile state. Test readout: current dashboard tests cover route/render content and config states, but not responsive/mobile behavior (`tests/dashboard/server.test.ts`, `new-idea.test.ts`, `publish.test.ts`, `runs.test.ts`, `wave2.test.ts`). Lead decision: route this as a system rework, not a page-by-page CSS patch; UX should define one mobile shell + data-density contract first, then Code should implement shared responsive primitives and roll them across article/publish before secondary pages.

## Generate Idea Selector — Hygiene Review (2026-03-24T05:37:47Z)

**Status:** Conditional Approval  

- 2026-03-24T22:10:02Z — **V3 Stage 1 Dashboard Audit — UX Slice Complete**: UX reviewed Stage 1 dashboard/mobile slice for legacy path consolidation. Findings: `/htmx/recent-ideas` path (Stage-1-only) still exists alongside `/htmx/continue-articles`; `renderRecentIdeas()` delegates to `renderContinueArticles()` showing functional duplication. No breaking issues identified. All paths examined. Session log: `.squad/log/2026-03-24T22-10-02Z-dashboard-audit.md`. Orchestration: `.squad/orchestration-log/2026-03-24T22-10-02Z-ux.md`.
**Focus:** Duplication + abbreviation fix

**Finding:** Server filters expert agents by hardcoding TEAMS set, duplicating TEAM_ABBRS from agents.ts. Abbreviation inconsistency: 'wsh' vs 'was' (Washington).

**Required fixes:**
1. Import TEAM_ABBRS from agents.ts
2. Fix abbreviation (wsh → was)
3. Document PROD set

**Verdict:** Approve with hygiene cleanup before merge.

