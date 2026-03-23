---
name: Worktree Progress Commit Isolation
domain: git-hygiene
confidence: high
tools: [view, rg, git, vitest]
---

# Worktree Progress Commit Isolation

## When to Use

- Local `main` or feature branch is dirty, but only one subset of changes should be committed.
- Scoped work shares files with unrelated in-progress edits.
- You need a real checkpoint commit without stashing or disturbing the active checkout.

## Workflow

1. Inspect `git status --short --branch` and changed-file diffs before touching anything.
2. Create a fresh worktree branch from the current `HEAD` when you must preserve the local base chain.
3. Copy only clearly in-scope files into the worktree.
4. For mixed files, reapply just the required hunks in the worktree instead of copying the full dirty file.
5. Validate inside the worktree with the smallest meaningful build/test slice.
6. Commit from the worktree branch only after `git diff --name-only` matches the intended scope.

## Why

This keeps the original checkout non-destructive while still producing a clean progress commit. It is safer than committing directly on a dirty branch and less disruptive than stashing a large mixed working tree.

## Applied Here

- Original checkout: dirty `main`
- Isolated branch/worktree: `devops/publish-progress-commit`
- Full-file carry for publish-only files, selective patching for mixed files like `src/dashboard/views/article.ts` and `tests/dashboard/server.test.ts`
- Validation: `npm run v2:build` and `npx vitest run tests/dashboard/publish.test.ts tests/dashboard/server.test.ts`
