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


