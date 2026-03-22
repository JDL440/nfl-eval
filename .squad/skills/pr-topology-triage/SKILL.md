---
name: PR Topology Triage
domain: workflow
confidence: high
tools: [github-mcp-server-*, git]
---

# PR Topology Triage

## When to Use

- One issue has multiple open PRs at the same time.
- You need to tell whether a PR is clean, stacked, duplicated, or superseded.
- GitHub shows a surprising diff because work was rebased, squashed, or retargeted.

## Workflow

1. Read each PR's base branch, head branch, mergeable state, and available checks.
2. Compare every head branch against the repo default branch with `git merge-base`, `git rev-list --left-right --count`, and `git cherry`.
3. Inspect local worktrees with `git worktree list --porcelain` and `git branch -vv` to confirm whether each branch has a dedicated worktree or is a reused/stale branch.
4. Flag same-head / different-base PRs immediately; they are usually retargeting artifacts or stacked duplicates, not separate merge paths.
5. Check for merged-through-other-history duplicates: if a branch still contains commits from an already-merged PR because the earlier work landed via squash/rebase, the new PR should be rebased or replaced.

## Heuristics

- **Clean to merge:** base is `main`, mergeable is clean, ancestry is direct, and the branch has its own worktree.
- **Retarget/rebase:** base is not `main`, or the branch points to `main` but still carries duplicate ancestry from a previously merged stack.
- **Close as superseded:** a broader or cleaner PR on `main` already contains the same fix path.

## Caveat

Squash merges can make old commits look unique even when the code is already in `main`. In that case, trust the combination of base-branch metadata, ancestry checks, and file overlap rather than commit SHAs alone.
