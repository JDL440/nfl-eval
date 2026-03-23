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
- Closed reconcile-only issues should shed active-state and routing labels (`go:*`, `squad:*`) once the execution chain moves on, to keep backlog signals accurate.

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

### 2026-03-24T02:38:09Z: Ralph Round 3 Orchestration

**Agents Completed:**
- lead-issue-107 (review): Code fix rejection → publisher revision approval
- publisher-issue-107-revision (background): Image-policy deduplication completed
- lead-retro-learning (background): Manual digest v1 approved, issue chain #116-#118 created
- code-retro-port (background): Base retrospective runtime ported, review pending
- research-116 (background): Newly launched for #116 execution

**Decision Inbox Merge:** All decision files merged to `.squad/decisions.md` with deduplication:
- "Publish-Overhaul Isolation Strategy" (Lead isolation/cherry-pick plan)
- "retrospective follow-up should start as a manual digest" (manual CLI v1 approved)
- "Retrospective Port Boundary" (base runtime Phase 1 slice approved)
- "Issue #107 Revision: Publisher Skill Deduplication" (completed)

**Next Steps:** Lead to execute publish-overhaul feature branch isolation; Code to prepare #114 merge; Research to await #114 completion and begin #116 digest design.

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

### 2026-03-23: Issue #115 retrospective follow-up path locked
- Locked v1 follow-up for retrospectives to a **manual CLI digest** rather than a scheduled job or workflow-owned path.
- Confirmed the source of truth should be structured retrospective tables (`article_retrospectives` + `article_retrospective_findings`, with article metadata) instead of scraping `revision-retrospective-rN.md`.
- Split the work into child issues: **#116** (Research digest heuristics/spec), **#117** (Code CLI/query surface), and **#118** (Code candidate-promotion layer), with implementation explicitly downstream of **#114** landing the base retrospective runtime in mainline.

### 2026-03-23: Retrospective issue-chain reconciliation
- Verified the retrospective automation seam is already on mainline (`src/pipeline/actions.ts`, `src/db/schema.sql`, `src/db/repository.ts`) with focused passing coverage in `tests/pipeline/actions.test.ts` and `tests/db/repository.test.ts`.
- Re-scoped and closed **#114** as a reconcile/verification issue rather than keeping it alive as a fresh port task.
- Unblocked **#117** completely (`go:yes`) and removed **#114** as a dependency for **#118**, which now stays blocked only on **#116** for the digest heuristic/spec.

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

### 2026-03-24: Retrospective worktree port triage
- Compared `worktrees/issue-108-retrospectives` against mainline at the actual runtime seams: `src/pipeline/actions.ts`, `src/db/repository.ts`, `src/db/schema.sql`, `src/types.ts`, `tests/pipeline/actions.test.ts`, and `tests/db/repository.test.ts`.
- Mainline already contains the retrospective artifact + persistence slice: `recordPostRevisionRetrospectiveIfEligible()` runs after Stage 7 in `src/pipeline/actions.ts`, SQLite tables live in `src/db/schema.sql`, and repository read/write seams plus focused tests already exist in `src/db/repository.ts`, `tests/db/repository.test.ts`, and `tests/pipeline/actions.test.ts`.
- The issue-108 worktree is older than current prompt-handoff and writer-structure guard changes. Its surrounding diffs would regress current behavior by dropping `inspectDraftStructure`/`MIN_DRAFT_WORDS` repair flow in `src/pipeline/actions.ts` and weakening deterministic usage-history ordering/index expectations in `src/db/repository.ts` + `tests/db/repository.test.ts`.
- Lead guidance: treat the minimal coherent port slice as **no code port now** unless a later review identifies a missing retrospective-only delta outside the already-landed mainline seams.

- 2026-03-23T02-30-59Z — **Ralph Round 2 session**: Processed Issues #114 and #115 routing from user. GitHub issues created and routed to Code/Lead for mainline retrospective automation shipping and learning extraction. Inbox decisions merged covering TLDR contract (Code), publish flow overhaul (Publisher/UX), and create-draft validation (Code). Session logged; orchestration updates recorded.

### 2026-03-24: Retrospective automation port boundary review
- Approved the smallest coherent mainline port as **base post-revision retrospective runtime only**: generate the `revision-retrospective-rN.md` artifact after revisioned articles reach Stage 7, persist the structured rows in `article_retrospectives` / `article_retrospective_findings`, and cover it with repository + pipeline action tests.
- Main target files in current checkout are `src/pipeline/actions.ts`, `src/db/repository.ts`, `src/db/schema.sql`, `src/types.ts`, `tests/pipeline/actions.test.ts`, and `tests/db/repository.test.ts`; current mainline already has the needed revision-summary seams in `src/pipeline/conversation.ts`.
- Keep this slice out of dashboard/CLI/reporting for now. `tests/e2e/full-lifecycle.test.ts` still models manual stage advancement, so retrospective generation should hook off `autoAdvanceArticle()` completion at Stage 7 rather than trying to fire on every direct 6→7 transition in the first pass.

### 2026-03-24: Retrospective worktree vs mainline drift check
- Compared `worktrees/issue-108-retrospectives` against current mainline and confirmed the approved minimal slice is already present in mainline: Stage-7 `revision-retrospective-rN.md` generation plus structured persistence/query seams and focused tests.
- The safe file set for this slice remains `src/pipeline/actions.ts`, `src/db/schema.sql`, `src/db/repository.ts`, `src/types.ts`, `tests/pipeline/actions.test.ts`, and `tests/db/repository.test.ts`; `src/pipeline/conversation.ts` is a dependency seam, not a new port target.
- Do **not** cherry-pick the whole worktree `actions.ts` or `repository.ts` into mainline: those files have unrelated drift around prompt handoff, draft validation, and usage-event ordering that would risk regressing newer mainline behavior.

### 2026-03-24: Publish-overhaul isolation analysis — working-tree separation strategy

**By:** Lead (🏗️) — Architecture & routing inspection

**Request:** Backend asked for safe publish-overhaul branch isolation strategy: identify whether changes live in working tree or committed history, and provide step-by-step plan to extract only publish changes into a new branch without touching unrelated local-main work.

**Findings:**

1. **Publish-overhaul code changes:** Live **exclusively in working tree** (not yet committed), across 7 dashboard files and 2 test files (~435 net insertions):
   - `src/dashboard/public/styles.css` (+22)
   - `src/dashboard/server.ts` (+209 lines net, HTMX target unification)
   - `src/dashboard/views/publish.ts` (154 lines net, richer preview, draft-first workflow)
   - `src/dashboard/views/article.ts` (+112, status clarity)
   - `src/dashboard/views/preview.ts` (+38, shared rendering)
   - `tests/dashboard/publish.test.ts` (+66 test cases)
   - `tests/dashboard/server.test.ts` (+52 test cases)

2. **Publish-overhaul decision framework:** Committed in `991c66b` ("chore: squad orchestration & decision merge — publish overhaul session") on 2026-03-22. Contains decision record in `.squad/decisions.md` but **zero code changes**.

3. **Local main commits ahead of origin/main:** 13 total, none touching the dashboard publish codebase since origin/main. These are mostly orchestration/decision merges, retrospective automation, auth research, and scribe logs.

4. **Non-publish working-tree changes:** 27 files (retrospective automation, TLDR contract enforcement, squad metadata, config/charter updates). These should **stay on main** and not ship with publish-overhaul.

**Safest isolation strategy:** Create new branch from `origin/main` (not HEAD), stash the 27 non-publish files, commit the 7 dashboard files, push as PR, then restore stash on main. This ensures zero contamination from local-main history and preserves all working tree for later segregation.

**Decision written to:** `.squad/decisions/inbox/lead-publish-isolation.md` — includes full step-by-step execution plan with stash/checkout commands, risk assessment, and verification checklist.

### 2026-03-24T03:25:00Z: Issue #107 Orchestration & Approval

**By:** Lead (🏗️) — Final review and sign-off

**Review Status:** ✅ APPROVED — All core functionality validated. Non-blocking tech-debt observations noted for future cleanup.

**Approved Artifacts:**
- Canonical TLDR contract in `src/config/defaults/skills/substack-article.md`
- Stage 5→6 enforcement via `inspectDraftStructure()` in `src/pipeline/engine.ts`
- Writer self-healing + synthetic send-back in `src/pipeline/actions.ts`
- Charter/skill updates with canonical contract references
- Test coverage: 145/145 regression tests passing
- Mock provider alignment complete

**Caveats (Non-Blocking):**
- Diagnostic/logging cleanup opportunity in Stage 5→6 guard paths (future tech debt)
- Redundant `clearArtifactsAfterStage()` call in auto-advance flow (noted for consolidation review)

**Handoff:** Code approved for merge. Issue #107 ready for integration to origin/main.

**Related Logs:**
- Orchestration: `.squad/orchestration-log/2026-03-24T03-25-00Z-lead.md`
- Session: `.squad/log/2026-03-24T03-25-00Z-issue-107-tldr-contract.md`
- Decision: `.squad/decisions.md` — "Code Decision — Issue #107 TLDR Contract Enforcement"

### 2026-03-23T02:40:22Z: Retrospective Worktree Final Port Review

**By:** Lead (🏗️) — Architecture comparison against mainline

**Analysis:** Compared `worktrees/issue-108-retrospectives` runtime slice (actions.ts, repository.ts, schema, tests) against current mainline to determine smallest coherent port boundary.

**Findings:** Mainline already contains necessary retrospective infrastructure:
- `recordPostRevisionRetrospectiveIfEligible()` in `src/pipeline/actions.ts` (Stage 7 artifact generation)
- SQLite schema tables in `src/db/schema.sql`
- Repository read/write seams in `src/db/repository.ts`
- Focused test coverage in `tests/pipeline/actions.test.ts` and `tests/db/repository.test.ts`

**Recommendation:** **Port nothing now**. Worktree contains unrelated drift:
- `actions.ts` has ordering/execution changes that would regress draft validation repair flow
- `repository.ts` has index/determinism changes that would weaken usage-history ordering

**Decision:** Treat the minimal coherent port as **zero code changes**. The retrospective runtime is already on mainline and ready for v1 CLI digest work. Mark issue-108 worktree complete and close without merge.

**Related Logs:**
- Orchestration: `.squad/orchestration-log/2026-03-23T02-40-22Z-lead.md`
- Session: `.squad/log/2026-03-23T02-40-22Z-retrospective-port-analysis.md`

### 2026-03-24T02-40-39Z: Scribe Orchestration — Issue #107 Completion and Inbox Merge

**By:** Scribe (📋) — Session log consolidation

**Tasks Completed:**
- Wrote orchestration log: `.squad/orchestration-log/2026-03-24T02-40-39Z-code.md` — Code agent Issue #107 completion
- Wrote orchestration log: `.squad/orchestration-log/2026-03-24T02-40-39Z-lead.md` — Lead agent ready for guardrail review
- Wrote session log: `.squad/log/2026-03-24T02-40-39Z-issue-107.md` — Summary of TLDR contract enforcement completion
- Merged decision inbox into `.squad/decisions.md` — Deduplicated code-issue-107 (already present as primary decision record)
- Updated agent history files with cross-team outcomes

**Status:** Issue #107 orchestration complete. All logs written. Decisions merged. Ready for validation pass.

**Related Documents:**
- `.squad/decisions.md` — Consolidated with decision inbox (no new entries, dedup only)
- Code agent history updated with orchestration milestone
- Lead agent history updated with orchestration completion

### 2026-03-24: Retrospective digest issue-chain reconciliation
- Confirmed **#114** stays closed as reconcile/verification only; its retitled scope already matches mainline reality and should not re-enter the execution chain.
- Closed **#116** as completed research after accepting the implementation-ready heuristic/spec: group by `role + finding_type`, normalize/hash finding text for deduping, and promote by repeated evidence thresholds.
- Kept **#117** as the active implementation slice and re-blocked **#118** only on **#117**'s digest scaffold rather than on closed research or stale runtime-port assumptions.
- Recorded the team-level execution-order decision in `.squad/decisions/inbox/lead-retro-chain.md` and updated `.squad/skills/manual-retro-digest-first/SKILL.md` with the reusable scaffold-before-promotion pattern.

### 2026-03-23T04:09:08Z: Scribe Cross-Agent Update — Retrospective Digest Execution Order Locked

**Decision logged:** "Lead Decision — Retrospective Digest Execution Order" (merged to decisions.md).

**Execution chain clarified:**
1. **#114** — Closed as verification-only; no new runtime port work.
2. **#116** — Ready to close after research/spec completion.
3. **#117** → **#118** (active execution order) — Digest scaffold (#117) must land before promotion logic (#118).

**Why this matters for the team:**
- Removes stale port dependency from backlog signals.
- #115 (parent) should drop `go:needs-research` state.
- Clear architectural sequencing: establish digest surface first, then layer promotion onto that surface.

**Decision status:** Locked and recorded. All affected agents have context updated.
