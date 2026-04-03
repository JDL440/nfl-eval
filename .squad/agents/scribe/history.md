# History — Scribe

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval

## Learnings

- Team initialized 2025-07-18
- Decision inbox pattern: agents write to `.squad/decisions/inbox/{agent}-{slug}.md`, Scribe merges to `decisions.md`
- Orchestration logs go to `.squad/orchestration-log/{timestamp}-{agent}.md`
- Session logs go to `.squad/log/{timestamp}-{topic}.md`
- Issue #85 coordination: merge inbox decisions into `decisions.md`, then record brief orchestration/session logs and update affected agent histories when the new decision materially changes planning context

### 2026-03-22T18-23-26Z: Issue #85 session record
- Merged the issue #85 decision inbox, archived older decisions, and wrote the orchestration/session logs for the current pass.
- Cross-agent history was updated for Research, Code, Lead, and Data to preserve the static-asset scope boundary.
### 2026-03-23T01:23:06Z: Issue #110 scribe pass
- Wrote orchestration logs and the session log for the issue #110 triage pass.
- Merged the new decision inbox items, deduplicated the article-trace notes against the established #109 decision, and removed the inbox files.
- No archive rollover or history summarization was needed.
### 2026-03-23T02:07:00Z: Code dev.ps1 scribe pass
- Merged the dev.ps1 decision from inbox into `decisions.md` at the top (most recent).
- Wrote orchestration log (`.squad/orchestration-log/2026-03-23T02-07-00Z-code.md`) and session log (`.squad/log/2026-03-23T02-07-00Z-code.md`).
- Updated Code agent history with expanded dev.ps1 learning.
- No inbox files remained to clean (Code had already created the inbox file in the commit).
### 2026-03-24T03:00:00Z: Publish-overhaul branch inspection and isolation strategy
- **Reviewed publish-overhaul history:** Investigated all related branches (fix/82-publish-endpoint, fix/issue-111-publish-ui) and merged work.
- **Consolidated decisions:** All Code/UX/Publisher findings are locked in `decisions.md`; no inbox files remain.
- **Assessed pending changes:** 13 commits ahead on main; ~2006 insertions (TLDR contract, draft-first UI, richer preview, conversation context, schema updates).
- **Validated test coverage:** Baseline validation passed (Validation agent); all regression tests passing.
- **Branching strategy:** Single cohesive merge recommended. All changes are tightly coupled (schema → engine → UI). Created session log with three merge scenarios (direct, feature branch, atomic commits) and risk assessment.
- **No conflicts:** main integrates prior shipped fixes; worktrees (issue-108, issue-109) remain independent.
- **Ready for Lead review:** Core changes in engine.ts, actions.ts, schema.sql validated. All decisions locked. Low risk to merge.

### 2026-03-23T15-13-57Z: Slug-history Scribe pass
- Wrote the Research orchestration and session logs for the Packers slug-history investigation.
- Merged the lead board cleanup inbox decision, deduplicated the identical inbox copies, and removed the inbox files.
- Archived older decision entries out of `decisions.md` and left the recent board context in place.

### 2026-03-26T12-00-00Z: Issue #123 Scribe pass (Unblock from #120)
- **Blocker resolution:** Issue #120 (structured blocker seam) complete and merged; Issue #123 now actionable.
- **Merged decision:** Moved Issue #123 Lead triage decision from inbox to top of `decisions.md` as Code-actionable slice.
- **Inbox cleanup:** Removed `lead-issue-123-triage.md` after merge.
- **Scope locked:** Repeated blocker detection (consecutive editor summaries) → `lead-review.md` artifact → `needs_lead_review` status at Stage 6 (no new stage).
- **Routing:** Code owns implementation; affects `src/pipeline/actions.ts` + tests, no DevOps changes.

### 2026-03-26T12-05-00Z: Issue #123 closeout
- **Closeout:** Issue #123 is implemented and Lead-approved; exact consecutive blocker signatures now escalate to `lead-review.md`, the article stays at Stage 6 with `needs_lead_review`, and non-repeat cases keep the existing path.

### 2026-03-27T06-46-06Z: Warner Preflight Hardening Scribe pass
- **Decision merged:** Lead's Warner Last-Name Heuristic Boundary Review moved from inbox to `decisions.md`.
- **Inbox cleanup:** Deleted `lead-warner-heuristic-review.md` after merge.
- **Scope locked:** Recommendation is to add "Lose" to BANNED_FIRST_TOKENS (action-verb blocklist). Do NOT extend last-name heuristics. Bridges until writer-support.md canonical-names allowlist.
- **Orchestration logs:** Created for Lead and Code agents (reviewer + implementer).
- **Session log:** Brief session summary documenting the handoff.
- **Agent history updates:** Lead and Code histories updated with session learnings.
- **Routing:** Code owns implementation; affects `src/pipeline/writer-preflight.ts` + tests.
- **Ready for implementation:** Small, focused change. No new architecture required. Complements existing Sentence-Starter Name Consistency Policy.

### 2026-03-28T10-32-00Z: Provider Label & Persistence Decision Inbox
- **Directive captured:** Two related provider issues logged to decision inbox:
  1. **Label ambiguity:** Dashboard "GitHub Copilot Pro+" label maps to GitHub Models API provider; confuses it with "GitHub Copilot CLI" which is a separate provider with different routing.
  2. **Persistence bug (FIXED):** Provider selection from idea-generation stage (Stage 1) was not being propagated to subsequent stages (generatePrompt, composePanel, runDiscussion, writeDraft, runEditor, runPublisherPass). Root cause: `runAgent()` calls omitted provider parameter despite signature supporting it. Fix retrieved provider from Stage 1 via `usage_events` and passed it through all downstream stages.
- **Inbox file:** `scribe-provider-label-and-persistence.md` — documents both issues, root causes, validation points, and architectural considerations.
- **Scope:** Issue 1 (labeling) is a naming/UX review task; Issue 2 (persistence) is already fixed in code.
- **Seams affected:** `src/dashboard/views/new-idea.ts` (labels), `src/dashboard/server.ts` (Stage 1 capture), `src/pipeline/actions.ts` (Stages 2-7 propagation), `src/types.ts` (provider enum and documentation).

### 2026-03-29T00-00-00Z: DevOps Gitignore Policy — Agent Histories
- **Directive:** DevOps requested gitignore policy for `.squad/**/history.md` files (agent working memory).
- **Implementation:** Added `.squad/**/history.md` pattern to `.gitignore`; removed 11 tracked history files from git index via `git rm --cached`; all files preserved locally.
- **Scope:** 9 agent history files + 2 usage-history logs. No product code touched.
- **Decision logged:** `devops-gitignore-history.md` in decision inbox.
- **Orchestration & session logs:** Created both to document the directive and handoff to Lead/Coordinator for commit and merge to main.






## Cross-Agent Context Updates (2026-03-28T18:32:29Z)

### From Orchestration (Scribe)
**Env template cleanup:** Canonical template guidance is now consolidated on `.env.sample`; `.env.example` was removed from the active decision stream, older decisions were archived, and affected history files were compacted.




## Cross-Agent Context Updates (2026-03-28T19:13:50Z)

### From Orchestration (Scribe)
**LM Studio boundary audit:** Consolidated the four LM Studio inbox decisions into one deduplicated decision. LM Studio stays chat/text-json only on this branch; Copilot CLI remains the guarded tool/MCP/web-search path until a provider-agnostic allowlist seam exists.

## Cross-Agent Context Updates (2026-03-28T19:21:32Z)

### From Orchestration (Scribe)
**Session logger pass:** Wrote the DevOps orchestration and session logs, archived the two older 2025 decision sections, and left the current inbox empty.
### 2026-03-29T18:40:33Z: Dashboard test-fix logging pass
- Wrote orchestration and session logs for the Code dashboard regression-test update.
- No decision inbox files were present, so there was nothing to merge or deduplicate.
- Condensed Code history to a Core Context summary and compacted the active decisions log into current March 2026 guidance.
### 2026-03-29T18:42:29Z: Dashboard surface deprecation audit handoff
- Recorded the new dashboard surface deprecation audit learnings in Code history and kept the active March 2026 decision summary compact.
- The audit reinforces the simplified nav, the memory-status copy, and `POST /api/agents/refresh-all` as the surviving admin maintenance seam.

## Cross-Agent Context Updates (2026-03-29T20-08-26Z)

### From Orchestration (Scribe)
**Mobile restyle session:** Merged the mobile-first dashboard modernization, the mobile-restyle directive, and the Copilot CLI artifact-harvest decision into decisions.md; wrote orchestration logs for UX and Code and the session log for this pass.

### 2026-03-29T20:08:26Z: Mobile restyle Scribe pass
- Merged the mobile-first dashboard modernization, the mobile-restyle directive, and the Copilot CLI artifact-harvest decision into decisions.md.
- Wrote orchestration logs for UX and Code plus the session log for the mobile restyle pass.
- Updated UX and Code histories with the mobile-shell restyle handoff context.
### 2026-04-03T07:24:14Z: tuesday-seahawks-prompt Scribe pass
- Logged orchestration and session artifacts for this .squad maintenance pass.
- No inbox decisions were present; archived the old UX review findings from active decisions.
- Updated UX history to reflect the archival.

## Cross-Agent Context Updates (2026-04-03T07:24:06Z)

### From Orchestration (Scribe)
**Tuesday Seahawks prompt session:** Wrote orchestration and session logs, found no decision inbox files to merge, and captured the guardrail to avoid repeating the recent Seahawks angle buckets.
