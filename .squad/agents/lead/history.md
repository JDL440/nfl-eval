# History — Lead

## Core Context

### Issue Decisions (Locked & Approved)

- **Issue #85**: structured domain knowledge stays in static assets and docs/testing; runtime integration remains deferred.
- **Issue #102**: dashboard auth direction is single-operator local login with Hono middleware, opaque sessions, and SQLite persistence.
- **Issue #107**: `substack-article.md` is the canonical contract; Writer/Editor/Publisher and guards all reference it.
- **Issue #108**: keep retrospective landing to the smallest coherent runtime slice only; dashboard/CLI/reporting stay deferred.
- **Issue #115/#116/#117/#118**: manual CLI digest first, with #117 unblocked and #118 dependent on the digest scaffold.
- **Issue #119**: separate observability scope for provenance badges; not part of Writer/Editor loop issue cluster.
- **Issue #120–#125**: Writer/Editor loop improvements (blocker tracking, summary clarity, evidence routing, escalation, fallback, fact-check guardrails).
- **Publish-overhaul**: keep the work isolated from unrelated mainline changes; draft-first publish is the shared product direction.

### Archived Timeline (2026-03-23 and earlier)

**2026-03-23T15-13-57Z:** Lead board cleanup inbox merged; #115 identified as next Research priority.  
**2026-03-23T17-14-24Z:** TLDR follow-up decision merged to decisions.md; orchestration log written.  
**2026-03-23T18:18:11Z:** Issue #115 scope narrowed to operator-facing documentation; Code routed for implementation.  
**2026-03-23T04:32:51Z:** Issue #118 review approved; repeated process_improvement auto-promotion validated in CLI.
- 2026-03-23T19:30:28Z — **Issue #125 Slice 3 Complete & Ready for Review**: Code completed final planned slice. Editor can now consume writer-factcheck.md as advisory upstream context. Three-slice arc complete: Slice 1 (Policy/typed contract), Slice 2 (Runtime enforcement with approved-source parity), Slice 3 (Editor consumption + focused tests). Ready for Lead review and final approval per Ralph orchestration.

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

- 2026-03-25T17-25-00Z — **Issue #125 Slice 2 Approval (Lead decision)**: Approved Data's revised slice 2 implementation. Two prior rejection reasons now resolved: (1) Approved-source ladder parity restored—`src/pipeline/writer-factcheck.ts:95-109` classifies both `nfl.com` / `*.nfl.com` and curated official team domains as `official_primary`, matching `src/config/defaults/skills/writer-fact-check.md` and `src/config/defaults/charters/nfl/writer.md` policy docs. (2) Wall-clock budget enforcement at fetch boundary—`src/pipeline/writer-factcheck.ts:497-543` clamps approved-source fetch timeout to remaining Stage 5 budget, preventing single slow request from exceeding 5-minute verification window. Regression coverage: `tests/pipeline/actions.test.ts:1654-1682` and `tests/pipeline/writer-factcheck.test.ts:9-38` validate team-site allowlisting and fetch behavior; `tests/pipeline/actions.test.ts:1757-1806` and `tests/pipeline/writer-factcheck.test.ts:41-94` validate budget exhaustion during slow fetches. All tests pass; build clean. Routed final slice (Editor consumption + tests) to Code agent for implementation; `src/pipeline/context-config.ts:27-28` still limits `writer-factcheck.md` to Writer context and does not yet expose to `runEditor`.
- 2026-03-25 — **Issue #107 Follow-up Approved (Publisher implementation)**: Publisher completed narrow-scope deduplication of TLDR contract clarification. Removed duplicated image-policy text from `src/config/defaults/skills/publisher.md`; now references `substack-article.md` Phase 4b as canonical policy source. Retained only publisher-specific verification (syntax, filenames, existence, alt text, links). Division of responsibility: `substack-article.md` states policy, `publisher.md` verifies compliance. Decision merged to decisions.md. Orchestration log written. Ready for commit.
- 2026-03-25 — **TLDR Retry Revision Contract Finalized (Code agent implementation)**: Code agent completed the Lead-approved narrow-scope fix for TLDR retry. Updated Writer charter clarity, Editor hard guard for missing TLDR (🔴 ERROR), writeDraft revision safety. Implementation uses `## Failed Draft To Revise` section to preserve working analysis rather than forcing rewrites. Regression coverage complete (147 tests, build clean). Decision merged to decisions.md.
- 2026-03-24 — Retrospective worktree triage: mainline already contains the approved minimal runtime slice, so unrelated worktree drift should not be ported.
- 2026-03-24 — Publish-overhaul isolation strategy: branch from `origin/main`, stash unrelated work, and keep the dashboard publish commit publish-only.
- 2026-03-23 — Issue #107 approval: the TLDR contract enforcement is complete and regression coverage passed.

### 2026-03-25: Dashboard publish missing-config review
- Verified the original failure path on `POST /api/articles/:id/draft` and `POST /api/articles/:id/publish`: when `substackService` was undefined, HTMX callers received HTTP 500 before any publish-panel fragment render, so the page surfaced a raw failure instead of actionable guidance.
- Current route behavior now returns `renderPublishWorkflow()` for HTMX requests with concrete recovery steps (`SUBSTACK_PUBLICATION_URL`, `SUBSTACK_TOKEN`, restart dashboard, check `/config`) while JSON callers still receive 500 JSON errors.
- Review outcome: behavior fix is good, but the current diff is not a narrow hotfix. `src/dashboard/server.ts` and `tests/dashboard/server.test.ts` also carry broader publish-workflow, revision-history, and artifact-rendering changes, and there is still no direct regression test for `createSubstackServiceFromEnv()` / startup DI wiring.
- **Status:** REJECTED pending narrowed scope and startup DI regression test.

### 2026-03-25: Issue #118 retrospective promotion fix (Lead implementation)
- Authorized as replacement implementer because original Code author was reviewer-locked for this revision cycle.
- Fixed misclassification: repeated `process_improvement` findings were not auto-promoting to issue-ready when the author was not Lead and priority was not high.
- Root cause: the approved rule uses "lead-authored OR repeated across 2+ articles" as a promotion signal, but implementation only checked repetition for `churn_cause`/`repeated_issue` groups with high priority.
- Implementation: added explicit repeated-`process_improvement` check to `promoteIssueCandidates()` with reason string; added focused regression test for repeated writer-authored finding across 2 articles with non-high priorities.
- Validation: `npm run v2:test` (147/147), `npm run v2:build` passing, Coordinator validation approved.
- Status: ✅ COMPLETED and merged to decisions.md.

### 2026-03-23T04:32:51Z: Issue #118 review (Lead approval)
- Reviewed issue #118 correctness/scope: repeated process_improvement auto-promotion in CLI retrospective digest
- Files reviewed: src/cli.ts, tests/cli.test.ts, src/db/repository.ts
- Validation confirmed:
  - Repeated non-Lead process_improvement findings now correctly route to issue-ready promotion
  - Manual read-only retrospective digest behavior safe from regression  
  - Test coverage (147/147 passing) validates new promotion logic
- **Outcome:** ✅ APPROVED for merge

### 2026-03-23T18:18:11Z: Issue #115 retrospective learning decision (Lead closeout)
- Narrowed Issue #115 scope from new runtime seams to **operator-facing documentation**.
- Confirmed existing v1 architecture already in place: manual CLI trigger (`retrospective-digest`), structured DB layer, bounded digest output.
- Locked recommendation: keep manual trigger, structured surfaces, bounded output; do not add numbered stage or auto-created issues.
- Routed implementation to **Code** agent for documentation pass and any narrow refinements.
- Decision merged to decisions.md. Orchestration log written.

## Learnings


- 2026-03-23T19:42:50Z — Issue #120 Ralph triage: structured blocker tracking is the next actionable Writer/Editor-loop foundation and should route straight to **Code**, not Research. It is **not blocked** because the issue already specifies the contract shape: extend `revision_summaries` with structured blocker metadata while preserving `feedback_summary`, persist it from the Editor `REVISE` path, and expose it through repository/API/dashboard reads with backward-compatible tests. This foundation unblocks #121, #122, and #123, while #124 should remain blocked until blocker IDs and repeat-escalation exist.
- 2026-03-25 — Issue #124 Ralph triage: fallback/claim-mode is **not** the next implementable slice even though it is the right later escape hatch. Keep it blocked behind `#120` structured blocker tracking and `#123` repeated-blocker escalation, because fallback entry needs durable blocker IDs plus a real Lead escalation signal before article mode can switch safely. Once unblocked, Ralph should route the next exact work to **Research** to define bounded fallback policy (entry criteria, Lead approval handoff, Writer reframe contract, and disclosure/UI requirements), then hand implementation to Code/UX.
- 2026-03-25 — Issue #125 slice-3 review: approve the final Writer fact-check slice when Editor consumption is wired in three aligned places at once — default upstream context (`runEditor` includes `writer-factcheck.md`), runtime prompt/charter language both frame it as an advisory Stage 5 ledger, and focused tests verify the artifact actually reaches the Editor prompt by default. With slices 1-3 together, issue #125 now has documented guardrails, bounded runtime enforcement, durable verified/attributed/omitted outputs, and Editor-side reuse without expanding scope into open-ended research.
- 2026-03-25 — Issue #125 slice-2 revision review: approve the revised runtime slice when policy/runtime parity is restored in code **and** the remaining wall-clock budget is enforced at the fetch boundary with focused tests. In this revision, `src/pipeline/writer-factcheck.ts` now allowlists curated official team domains as `official_primary` and clamps fetch timeout to the remaining budget, while `tests/pipeline/{actions,writer-factcheck}.test.ts` cover both the team-site allowlist and slow-fetch budget exhaustion. After that approval, Ralph should route the final planned slice (Editor consumption + tests) to **Code** because `src/pipeline/context-config.ts` still keeps `writer-factcheck.md` out of `runEditor`.
- 2026-03-25 — Issue #125 slice-2 review: reject a bounded Writer fact-check runtime slice if prompt policy and runtime allowlist diverge on approved primary sources. For this issue, `src/config/defaults/skills/writer-fact-check.md` and the Research decision still approve official NFL/team pages, but `src/pipeline/writer-factcheck.ts` only treats `nfl.com` as `official_primary`, so team-site sources would be blocked despite being documented as allowed. Do not route slice 3 until slice 2 restores policy/runtime parity and adds focused coverage for the approved-source boundary.
- 2026-03-25 — Issue #125 slice-1 review: approve the first bounded implementation slice when it stays explicitly contract-only. The acceptable shape is typed policy + dedicated Writer skill + durable `writer-factcheck.md` scaffold injected only into Stage 5 Writer context, with no premature fetch helper or Editor coupling. For the next Ralph step, route to **Code** for slice 2: implement the narrow approved-source resolver/fetch path plus budget/usage enforcement and artifact population tests, while keeping raw web search blocked and Editor unchanged.
- 2026-03-24 — Issue #125 Ralph triage: this is not a Lead implementation item; the correct next owner is **Research**. The issue is **not blocked for design work** because Research can define approved sources/tools, citation + uncertainty rules, and budget guardrails now, but any runtime implementation should wait for that design output and stay coordinated with the blocker-routing foundation in the same issue cluster. GitHub issue labels/comments were updated from `squad:lead` to `squad:research` to reflect the routing.
- 2026-03-25 — Issue #115 independent closeout verification: current mainline now satisfies both runtime and operator-doc acceptance criteria. `src/cli.ts` exposes `retrospective-digest` / `retro-digest`, `src/db/repository.ts` reads bounded structured rows via `listRetrospectiveDigestFindings(limit)`, `src/db/schema.sql` defines `article_retrospectives` + `article_retrospective_findings`, `src/pipeline/actions.ts` persists retrospectives through `recordPostRevisionRetrospectiveIfEligible()`, `tests/{cli,db/repository,pipeline/actions}.test.ts` cover the seam, and `README.md` documents the operator loop. The earlier Lead closeout note in `.squad/decisions.md` is now stale specifically on the README gap; the remaining action is issue-state reconciliation/closure, not more runtime work.
- 2026-03-24 — Issue #115 closeout triage: the retrospective-learning v1 seam already exists as `tsx src/cli.ts retrospective-digest [--limit N] [--json]`, backed by `Repository.listRetrospectiveDigestFindings()` over `article_retrospectives` + `article_retrospective_findings` plus article metadata, and fed by `recordPostRevisionRetrospectiveIfEligible()` in `src/pipeline/actions.ts`. For the parent issue, the remaining gap is operator-facing run documentation rather than new research or automation, so next routing should be Code; Ralph can treat #115 as the current highest-priority actionable retrospective follow-up. Relevant files: `src/cli.ts`, `src/db/repository.ts`, `src/db/schema.sql`, `src/pipeline/actions.ts`, `README.md`.
- 2026-03-25 — **Writer/Editor loop research-to-issue planning:** The article pipeline has well-scoped quick-win improvements and forward-looking capability shifts. Root problems: (1) free-text blocker summaries prevent programmatic routing, (2) evidence-gap blockers loop Writer instead of routing to Research, (3) repeated blockers hang articles instead of escalating to Lead, (4) no graceful fallback when evidence is insufficient, (5) Writer cannot fact-check (biggest research win per user feedback). Recommended priority: (1) Structured blocker IDs + blocker summary in Writer prompt (foundation, 1-2 days each), (2) Evidence-gap routing to Research (breaks anti-pattern), (3) Repeated blocker escalation to Lead (safety net), (4) Fallback/claim-mode after failed revisions (graceful degradation), (5) Writer fact-checking with guardrails (research phase). Split is practical because it separates immediate UI/routing from capability design. Relevant files: src/pipeline/actions.ts, src/config/defaults/charters/nfl/{writer,editor}.md, src/db/{schema.sql,repository.ts}. Duplicate check: no existing issues for writer research, evidence-gap routing, or blocker escalation found; issue #119 covers separate observability scope (provenance badges). Proceed with 6-issue set excluding #119.
- 2026-03-25 — Dashboard publish missing-config review:approve HTMX operator guidance only when draft/publish actions swap an inline recovery fragment with exact env vars and `/config` verification, but reject “scoped” fixes that bundle unrelated publish-flow changes. Relevant files: `src/dashboard/server.ts`, `src/dashboard/views/publish.ts`, `tests/dashboard/publish.test.ts`, `tests/dashboard/server.test.ts`. Follow-up concern: keep a direct startup wiring regression around `createSubstackServiceFromEnv()` / dashboard DI so route-level config copy does not mask service-initialization regressions.
- 2026-03-25 — Retrospective digest promotion rule: treat `process_improvement` findings as issue-ready when they are lead-authored or repeated across 2+ articles, independent of the higher-threshold churn/repeated-issue heuristic. Relevant files: `src/cli.ts`, `tests/cli.test.ts`, `.squad/decisions.md`, `.squad/skills/manual-retro-digest-first/SKILL.md`.
- 2026-03-25 — Issue #118 review confirmed the current CLI keeps the retrospective digest lane manual/read-only: `handleRetrospectiveDigest()` only calls `repo.listRetrospectiveDigestFindings(limit)`, builds the digest in memory, and prints JSON/markdown, while `Repository.listRetrospectiveDigestFindings()` is a bounded SELECT over `article_retrospectives` + `article_retrospective_findings` with no backlog/knowledge mutations. Focused evidence came from `src/cli.ts`, `src/db/repository.ts`, and `tests/cli.test.ts` (`prints a bounded markdown digest for manual review`, `supports json output through the command dispatcher`, `promotes repeated non-lead process improvements to issue-ready candidates`).
- 2026-03-25 — TLDR follow-up: keep the repair path revision-first, but restate the structural obligation in every layer that can hand the draft back. Writer charter should say the pipeline blocks missing TLDR and Writer must verify it on every handoff; editor guidance should treat missing/incomplete TLDR as a mandatory `## 🔴 ERRORS` + `REVISE` case; revision prompts should explicitly preserve or restore the canonical four-bullet TLDR block so send-backs do not depend on Editor repeating the reminder.
- 2026-03-25 — **Issue #125 slice-3 approval (Lead verified review)**: Approved the final Editor-consumption slice. Key verification points: (1) `context-config.ts:28` routes `writer-factcheck.md` to `runEditor` via the standard `gatherContext()` path — missing artifacts are silently skipped. (2) Editor task prompt in `actions.ts:1135` and Editor charter in `editor.md` both instruct advisory-only usage: reuse the ledger to target checks, never treat it as auto-approval. (3) Two focused regression tests confirm prompt delivery and default context inclusion. (4) Minor scope carry-forward: `editor.md` also codifies the prior #107 TLDR structural-error rules; non-harmful. All 5 acceptance criteria for #125 are now satisfied across slices 1–3. Issue is ready to close after commit/merge. Relevant files: `src/pipeline/context-config.ts`, `src/pipeline/actions.ts`, `src/config/defaults/charters/nfl/editor.md`, `tests/pipeline/actions.test.ts`.


