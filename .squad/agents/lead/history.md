# History — Lead

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, Hono, HTMX, SQLite, Vitest
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `src/` (core), `src/config/defaults/charters/nfl/` (47 pipeline agents), `src/dashboard/` (Hono UI), `src/pipeline/` (article pipeline), `tests/` (vitest)

## Core Context

- Team initialized 2025-07-18 with functional role names (Lead, Code, Data, Publisher, Research, DevOps, UX)
- @copilot is enabled with auto-assignment for well-scoped issues
- Joe Robinson is the human Product Owner / Tech Lead with final decision authority
- Issue #85 is intentionally limited to static knowledge assets and validation; runtime integration and refresh automation moved to #91
- Issue #88 established shared article conversation history; the safer next step is a hybrid summary/handoff model rather than raw transcript sharing
- Issue #92 confirmed the same hybrid context approach for charter isolation risk
- Issue #93 article usage panels need full per-article usage history; the regression came from the repository read cap, not missing persistence
- Persisted `*.thinking.md` artifacts are the canonical article debug source
- The v2 platform already shipped #72 and #73, so backlog triage should verify code before assuming an issue is still open

### 2026-03-22T19:20:00Z: Issue #93 token usage seam

- The article usage gap was caused by the repository read seam (`Repository.getUsageEvents()` defaulting article reads to the newest 100 rows), not by provider token creation or dashboard chart rendering.
- Future usage investigations should verify repository defaults first so early provider events are not clipped out of article-level history views.

### 2026-03-22T18:35:21Z: Thinking/debug visibility regression

- Investigated the missing collapsible agent-thinking/debug section on article detail pages.
- Confirmed the main artifact view should read companion `*.thinking.md` files first; inline `<think>` / `<reasoning>` extraction is only a legacy fallback.
- Relevant files: `src/dashboard/views/article.ts`, `src/dashboard/server.ts`, `src/pipeline/actions.ts`, `src/pipeline/context-config.ts`, `src/agents/runner.ts`.
- Restoration guidance for Code: preserve the collapsible debug UI and treat the persisted thinking artifact as the canonical trace.

### 2026-03-22T19:14:56Z: Issue #93 blocked / not reproducible follow-up
- Re-reviewed the issue after the rejected debug-visibility diff and concluded the wrong bug had been targeted.
- Enforced reassignment away from the prior hydration diagnosis because the current codebase did not reproduce a Copilot-CLI-specific defect.
- No issue-specific code changes landed.

## Learnings

- Issue #103 is a bounded follow-up to the #92 / PR #97 hybrid handoff design: only `buildEditorPreviousReviews()` should gain a cap, and the runtime shared handoff must stay newest-first and summary-only.
- Preserve the existing adv-stage/context-config behavior from #92 / PR #97; the follow-up should not reintroduce raw shared transcript injection or change stage routing.
- Useful review anchors for this issue are `src/pipeline/conversation.ts` and `tests/pipeline/conversation.test.ts`, with `src/pipeline/actions.ts` only needing verification that the current editor-review artifact still flows through unchanged.
- Issue #103 validated the safer prompt-history pattern for editor self-review: when limiting conversation history, query newest-first before applying the cap, then keep the formatter bounded and deterministic as a second guard.

### 2026-03-22T20:05:00Z: Issue #93 PR topology review

- For issue-board triage, combine GitHub PR metadata with local `git worktree list`, `git branch -vv`, `git merge-base`, and `git cherry` before treating competing PRs as independent options.
- Direct, clean branches for this batch were backed by dedicated local worktrees: `C:\github\nfl-eval-issue92` (`code/issue-92-hybrid-context`), `C:\github\nfl-eval\worktrees\issue93-token-usage` (`code/issue-93-token-usage`), `C:\github\nfl-eval\.worktrees\issue93-clean` (`code/issue-93-article-usage-fix`), and `C:\github\nfl-eval\.worktrees\issue93` (`code/issue-93-article-page-usage`).
- The repo root worktree `C:\github\nfl-eval` is on the reused branch `ux/issue-93-copilot-usage`, which is ahead of `origin/ux/issue-93-copilot-usage` by local maintenance commits and shares the same remote head across PRs #98 and #100.
- Same-head multi-base PRs are a strong warning sign: #100 was explicitly stacked on `code/issue-85-structured-knowledge`, while #98 pointed the same head at `main`, dragging duplicate #85 ancestry because #85 merged to `main` through different commit history.
- Practical Lead heuristic: when one issue has several open PRs, prefer a single canonical PR that is `main`-based, mergeable clean, and backed by a dedicated worktree; retarget or close reused/stale head branches and narrower superseded alternatives.

### 2026-03-22T21:46:04Z: Issue #93 PR topology decision

- The canonical PR choice for #93 should be recorded in the decisions inbox before board movement so future triage has a durable explanation for why stacked and reused branches were not treated as merge-ready.
- When a reused branch still carries merged-through-other-history commits, the right triage action is retarget/rebase or close, not merge-by-default.

### 2026-03-22T22:00:00Z: TLDR Enforcement Investigation

- **Architecture:** `src/pipeline/engine.ts` is the strongest enforcement point for structural constraints (`requireDraft` guard).
- **Pattern:** Prefer deterministic code guards over LLM prompt instructions for non-negotiable format requirements (like TLDR blocks).
- **Files:** `src/config/defaults/skills/substack-article.md` is the canonical source for article structure, but `writer.md` needs to explicitly reference key constraints to ensure compliance.
- **Testing:** `tests/pipeline/engine.test.ts` is the place to verify pipeline transition logic.
### 2026-03-22T22-07-35Z: Issue #104 review sync
- Approved the `issue-104-usage-history` patch and recorded the review in `.squad/decisions.md`.
- The residual risk remains the SQLite autoincrement `id` tie-breaker for same-second rows, which is acceptable for the current single-writer pattern.

### 2026-03-22T22-09-11Z: Issue #103 review follow-through
- Approved the cap-only follow-up for editor previous reviews and kept the scope bounded to the newest-first path.
- Lead context now reflects that the runtime prompt-assembly fetch cap belongs with the bounded review history change.
