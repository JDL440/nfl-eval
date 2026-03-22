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

### 2026-03-22T20:05:00Z: Issue #93 PR topology review

- For issue-board triage, combine GitHub PR metadata with local `git worktree list`, `git branch -vv`, `git merge-base`, and `git cherry` before treating competing PRs as independent options.
- Direct, clean branches for this batch were backed by dedicated local worktrees: `C:\github\nfl-eval-issue92` (`code/issue-92-hybrid-context`), `C:\github\nfl-eval\worktrees\issue93-token-usage` (`code/issue-93-token-usage`), `C:\github\nfl-eval\.worktrees\issue93-clean` (`code/issue-93-article-usage-fix`), and `C:\github\nfl-eval\.worktrees\issue93` (`code/issue-93-article-page-usage`).
- The repo root worktree `C:\github\nfl-eval` is on the reused branch `ux/issue-93-copilot-usage`, which is ahead of `origin/ux/issue-93-copilot-usage` by local maintenance commits and shares the same remote head across PRs #98 and #100.
- Same-head multi-base PRs are a strong warning sign: #100 was explicitly stacked on `code/issue-85-structured-knowledge`, while #98 pointed the same head at `main`, dragging duplicate #85 ancestry because #85 merged to `main` through different commit history.
- Practical Lead heuristic: when one issue has several open PRs, prefer a single canonical PR that is `main`-based, mergeable clean, and backed by a dedicated worktree; retarget or close reused/stale head branches and narrower superseded alternatives.

### 2026-03-22T21:46:04Z: Issue #93 PR topology decision

- The canonical PR choice for #93 should be recorded in the decisions inbox before board movement so future triage has a durable explanation for why stacked and reused branches were not treated as merge-ready.
- When a reused branch still carries merged-through-other-history commits, the right triage action is retarget/rebase or close, not merge-by-default.
