# History — Lead

## Core Context

### Issue Decisions (Locked & Approved)

**Issue #85 — Structured Domain Knowledge:** Intentionally limited to static assets (glossaries YAML under `src/config/defaults/glossaries/`, team sheets under `content/data/team-sheets/`). Runtime integration + refresh deferred to #91. No changes to `src/agents/runner.ts`, `src/pipeline/actions.ts`, or package.json.

**Issue #102 — Dashboard Auth Hardening:** Single-operator local login via Hono middleware, opaque session cookies, SQLite persistence, config-driven enable/disable. Deferred OAuth/RBAC. Recommended routing: Code (middleware, handlers, schema), UX (login page), DevOps (secure defaults, env docs), Lead review gate.

**Issue #107 — Article Structure Contract:** Locked to `src/config/defaults/skills/substack-article.md` as canonical source. Writer, Editor, Publisher docs reference it; no competing normative skeletons. Pre-Editor gate narrow: draft exists, meets length floor, satisfies TLDR contract. Broader readiness checks downstream.

**Issue #110 — Article Timing Totals:** UI aggregation over existing `stage_runs` timestamps. Confirmed: no persistence problem, no schema change needed. Routed as UX follow-up after #109 lands.

**Issue #115/#114/#116/#117/#118 — Retrospective Follow-up Chain:** 
- v1 approach: manual CLI digest (not scheduled job/workflow)
- Source of truth: structured retrospective tables + article metadata
- #116: Research digest heuristics/spec
- #117: Code CLI/query surface (read-only, single joined repository query, dedupe normalized findings, cap manual-review sections)
- #118: Code candidate-promotion layer (blocks on #117 scaffold only)
- Baseline runtime already on mainline; #114 reclassified as reconcile/verify, unblocked #117

### Team & Project Context
- **Team:** Initialized 2025-07-18 (Lead, Code, Data, Publisher, Research, DevOps, UX)
- **Owner:** Joe Robinson (PO/Tech Lead, final decision authority)
- **Platform:** NFL Lab (nfl-eval); TypeScript, Node.js, Hono, HTMX, SQLite
- **Key paths:** `src/config/defaults/charters/nfl/` (47 pipeline agents), `src/dashboard/` (Hono UI), `src/pipeline/`, tests/vitest

### Architecture Notes
- Dashboard (port 3456): Hono + HTMX + SSE, currently no auth middleware
- Article pipeline: 47 agents separate from Squad agents
- Conversation history per article with revision summaries; long turns truncated for prompt context
- Repository: article pipeline, agents, usage tracking, retrospectives, drafts; no auth/session tables yet
- Config: `src/config/index.ts` loads `.env` and `~/.nfl-lab/config/.env` for runtime + provider/service vars

## Recent Learnings


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
