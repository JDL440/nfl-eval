# History — Lead

## Core Context

### Issue Decisions (Locked & Approved)

- **Issue #85**: structured domain knowledge stays in static assets and docs/testing; runtime integration remains deferred.
- **Issue #102**: dashboard auth direction is single-operator local login with Hono middleware, opaque sessions, and SQLite persistence.
- **Issue #107**: `substack-article.md` is the canonical contract; Writer/Editor/Publisher and guards all reference it.
- **Issue #108**: keep retrospective landing to the smallest coherent runtime slice only; dashboard/CLI/reporting stay deferred.
- **Issue #115/#116/#117/#118**: manual CLI digest first, with #117 unblocked and #118 dependent on the digest scaffold.
- **Publish-overhaul**: keep the work isolated from unrelated mainline changes; draft-first publish is the shared product direction.

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

## Learnings

- 2026-03-25 — Dashboard publish missing-config review: approve HTMX operator guidance only when draft/publish actions swap an inline recovery fragment with exact env vars and `/config` verification, but reject “scoped” fixes that bundle unrelated publish-flow changes. Relevant files: `src/dashboard/server.ts`, `src/dashboard/views/publish.ts`, `tests/dashboard/publish.test.ts`, `tests/dashboard/server.test.ts`. Follow-up concern: keep a direct startup wiring regression around `createSubstackServiceFromEnv()` / dashboard DI so route-level config copy does not mask service-initialization regressions.
- 2026-03-25 — Retrospective digest promotion rule: treat `process_improvement` findings as issue-ready when they are lead-authored or repeated across 2+ articles, independent of the higher-threshold churn/repeated-issue heuristic. Relevant files: `src/cli.ts`, `tests/cli.test.ts`, `.squad/decisions.md`, `.squad/skills/manual-retro-digest-first/SKILL.md`.
- 2026-03-25 — Issue #118 review confirmed the current CLI keeps the retrospective digest lane manual/read-only: `handleRetrospectiveDigest()` only calls `repo.listRetrospectiveDigestFindings(limit)`, builds the digest in memory, and prints JSON/markdown, while `Repository.listRetrospectiveDigestFindings()` is a bounded SELECT over `article_retrospectives` + `article_retrospective_findings` with no backlog/knowledge mutations. Focused evidence came from `src/cli.ts`, `src/db/repository.ts`, and `tests/cli.test.ts` (`prints a bounded markdown digest for manual review`, `supports json output through the command dispatcher`, `promotes repeated non-lead process improvements to issue-ready candidates`).
- 2026-03-25 — TLDR follow-up: keep the repair path revision-first, but restate the structural obligation in every layer that can hand the draft back. Writer charter should say the pipeline blocks missing TLDR and Writer must verify it on every handoff; editor guidance should treat missing/incomplete TLDR as a mandatory `## 🔴 ERRORS` + `REVISE` case; revision prompts should explicitly preserve or restore the canonical four-bullet TLDR block so send-backs do not depend on Editor repeating the reminder.

### 2026-03-23T15-13-57Z: Board cleanup triage update
- Lead board cleanup inbox was merged into `decisions.md`; the duplicate inbox copy was deduplicated before deletion.
- Decision context now reflects `#115` as the next Research priority after `#117/#118` completion.

### 2026-03-23T17-14-24Z: TLDR follow-up orchestration
- Merged the deduplicated TLDR follow-up decision note into .squad/decisions.md and cleared the inbox.
- Recorded orchestration and session logs for the Lead handoff.
