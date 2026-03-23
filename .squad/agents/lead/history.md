# History — Lead

## Core Context

**Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform. Stack: TypeScript, Node.js, Hono, HTMX, SQLite. Owner: Joe Robinson. Key paths: `src/` (core), `src/config/defaults/charters/nfl/` (47 pipeline agents), `src/dashboard/` (Hono UI), `src/pipeline/` (article pipeline), `tests/` (vitest).

**Team & Authority:** Initialized 2025-07-18. Joe Robinson is PO/Tech Lead with final decision authority.

**2025-07-19 Triage:** Issues #73 (nflverse), #72 (Substack Notes) already shipped. Issues #81, #76, #70 routed to UX/Code. Key finding: v2 platform more capable than backlog reflects.

**2026-03-22 Work:** Issue #88 created (persistent conversation context, 4-phase). Issue #85 scoped to static assets only (Phases 1–3); runtime integration + refresh deferred to #91. Issue #110 routed as UX follow-up. Issue #102 auth direction locked (single-operator local login, Hono middleware).

## Learnings

- Team initialized 2025-07-18 with functional role names (Lead, Code, Data, Publisher, Research, DevOps, UX)
- @copilot enabled with auto-assignment for well-scoped issues
- Joe Robinson is the human Product Owner / Tech Lead with final decision authority

### 2026-03-22: Issue #85 — Structured Domain Knowledge Scope Lock

- Issue #85 is intentionally limited to static proof-of-concept assets plus docs/tests: glossary YAML files under `src/config/defaults/glossaries/` and initial team sheets under `content/data/team-sheets/`.
- Keep #85 out of runtime code paths: no `src/agents/runner.ts`, `src/pipeline/actions.ts`, or refresh automation changes unless strictly needed for lightweight references or validation.
- Treat `tests/config/` as the likely home for structure-validation tests.
- The repo currently has no YAML dependency in `package.json`, so glossary structure should stay simple.
- Deferred Phases 4-5 tracked in GitHub issue `#91` (runtime glossary/team-sheet injection plus refresh automation).

### 2026-03-22: Issue #85 Scope Split — Runtime Integration and Refresh Deferred

**By:** Lead (🏗️)

**Pattern:** When a multi-phase architecture issue is intentionally narrowed, keep active issue tightly scoped to approved phases, create separate backlog issue for deferred phases.

**Phases deferred to #91:**
- **Phase 4:** Load glossaries in `src/agents/runner.ts`, generate/inject `team-identity.md` from `src/pipeline/actions.ts`
- **Phase 5:** Add `scripts/refresh-domain-knowledge.ts` plus scheduled workflow automation

### 2026-03-22T18-23-26Z: Issue #85 decision sync
- Scribe completed the decision inbox merge, archived old decision history, and logged the session/orchestration notes.
- The active #85 record now stays centered on static KB assets and their validation surface.
- Deferred runtime integration remains outside the current scope boundary.

### 2026-03-23: Issue #110 triage — stage-run total timing
- Confirmed the request is a UI aggregation pass over existing `stage_runs` timestamps, not a persistence problem.
- The next implementation owner should be UX once #109 lands, because the change belongs in the article detail timing presentation rather than new backend storage.
- Keep the scope limited to a clear article-level total, with any per-state breakdown treated as optional follow-up if it stays cheap.
### 2026-03-23T01:23:06Z: Issue #110 routing follow-up
- Routed #110 as a UX dashboard follow-up after #109, with no new schema work required.
- Kept the timing-total work aligned with the existing article-detail implementation seam.

### 2026-03-23T02:17:46Z: Issue #102 auth direction locked

**By:** Lead (🏗️)

Research completed comprehensive analysis of issue #102 (dashboard auth hardening). Decision submitted to `.squad/decisions.md`:

**Direction:** Single-operator local login with Hono middleware, opaque session cookies, SQLite persistence, and config-driven enable/disable.

**Why:** Current dashboard has no auth seam. Recommendation aligns with owner's preference ("simple local login for now"), fits Hono + SQLite architecture, and defers OAuth/RBAC to future.

**Deferred for Code:** Implementation tracked as Issue #102 follow-up after decision lock.

### 2026-03-23: Issue #102 triage refresh — current auth seam and routing

- The current checked-in dashboard app layer is effectively open: `src/dashboard/server.ts` registers SSE (`/events`), static assets, generated images, HTML pages, HTMX fragments, and JSON API routes directly from `createApp()` with no auth middleware, login/logout routes, cookie parsing, or session checks. If a temporary shared-password gate exists, it is outside the current `src/` runtime or no longer present in this branch.
- The minimum repo-consistent long-term direction remains a **single-operator local login**: Hono middleware, explicit login/logout routes, opaque `httpOnly` cookie, and a small SQLite `dashboard_sessions` persistence seam in `src/db/schema.sql` + `src/db/repository.ts`.
- Keep the first pass config-driven in `src/config/index.ts` with a small surface such as auth mode (`off|local`), admin username, password hash, and session secret. Avoid OAuth, RBAC, or broader user management until the editorial workstation product shape changes.
- Protect all dashboard surfaces consistently, including `src/dashboard/sse.ts` (`/events`) and `src/dashboard/server.ts` image serving at `/images/:slug/:file`; these currently expose live dashboard state and unpublished assets if left outside the auth gate.
- Existing tests prove current open-access assumptions: `tests/dashboard/server.test.ts`, `tests/dashboard/publish.test.ts`, `tests/dashboard/config.test.ts`, and `tests/e2e/live-server.test.ts` construct `createApp(repo, config)` and hit routes directly. Auth should therefore stay off by default in tests/dev unless explicitly enabled, with focused auth regression coverage added separately.
- Recommended routing for implementation: **Code** owns middleware, login/logout handlers, config wiring, schema/repository changes, and auth tests; **UX** owns login page/form states and copy; **DevOps** owns deployment/env-secret documentation and cookie/security defaults review; **Lead** reviews architecture and confirms scope stays local-login only.

### 2026-03-23T02:21:16Z: Issue #102 decision locked + Scribe orchestration

- **Decision record:** Merged Lead recommendation + Research proposal into unified Issue #102 decision in `.squad/decisions.md`
- **Status:** RECOMMENDED and ready for team routing (Code/UX/DevOps with Lead review)
- **Orchestration logs:** Created `.squad/orchestration-log/2026-03-23T02-21-16-lead.md` and `.squad/log/2026-03-23T02-21-16Z-issue-102-auth-triage.md`
- **Decisions inbox:** Processed and merged; inbox cleared
- **Next:** Implementation ownership transitions to Code (middleware, config, schema), UX (login page/form), DevOps (secure defaults, env docs), with Lead confirmation gate

### 2026-03-23T02:21:03Z: Scribe session — decisions inbox merge and orchestration log

- Orchestration log written for Code agent (2026-03-23T02-21-03Z)
- Session log documenting Issue #102 auth research outcomes written
- Research + Lead decision inbox merged into `.squad/decisions.md`, deduplicating findings
- Merged inbox files deleted

### 2026-03-23: Issue #107 guardrail decision
- Locked article-structure authority to `src/config/defaults/skills/substack-article.md`; Writer, Editor, and Publisher docs should reference it instead of carrying competing normative skeletons.
- Kept the minimum pre-Editor runtime gate narrow: draft exists, meets length floor, and satisfies the top-of-article TLDR contract; broader publish-readiness checks stay downstream.
- Code review for #107 should verify shared runtime validation, targeted writer repair/send-back behavior, and regressions proving TLDR-less drafts cannot advance to Editor while compliant drafts and mocks still pass.

### 2026-03-24: Publish-overhaul team coordination and decision lock

**Team session outcomes:** Coordinated five-agent publish-flow investigation (Code, UX, Publisher, Validation, Coordinator). 

**Root causes identified:**
- HTMX target split between `#publish-actions` (draft response) and `#publish-result` (publish action) breaks user perception of draft creation success
- Preview divergence: draft conversion omits thinking-strip while preview routes include it
- Terminology ambiguity: "publish workspace" used once, not reinforced
- Workflow unclear: draft/publish controls scattered across detail page and publish page

**Decisions submitted to `.squad/decisions.md`:**
1. Code: TLDR structure contract enforcement (Issue #107) — already implemented
2. Publisher: Draft-first model (create/update idempotent, publish-now syncs latest)
3. UX: Two-step explicit workflow with richer preview reuse
4. Validation: Baseline pass; focused regression tests for draft lifecycle

**Coordinator implementation complete:**
- Shared richer publish preview path via `/api/articles/:id/publish-preview`
- Idempotent draft save/update with state return
- Publish-now syncs latest content before publishing
- Stage 7 copy clarified (removed "workspace" ambiguity)
- Alert styling + error guidance improved
- All regressions passing (`npm run v2:build`)

**Status:** Ready for merge. No blockers.
