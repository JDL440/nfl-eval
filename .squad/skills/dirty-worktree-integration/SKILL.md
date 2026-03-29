# Dirty Worktree Integration

## When to use

Use this skill when:
- A feature worktree needs to be brought back to `main`
- The root checkout already has uncommitted work
- The feature worktree also has local modifications or artifacts
- You need a safe testing path without losing unrelated operator changes

## Pattern

### 1. Measure both divergence and dirtiness
Capture:
- root branch name
- commits unique to `main`
- commits unique to the feature worktree
- dirty files in both locations
- overlap between root dirty files and feature changes

### 2. Separate committed work from worktree-only edits
Treat committed feature SHAs and uncommitted worktree edits differently. A feature branch is not ready for reintegration until the intended delta is anchored to a clean commit SHA.

### 3. Strip out artifacts and session noise
Do not use files like local databases, ephemeral logs, history-only churn, or scratch skills as the integration payload unless they are explicitly part of the requested change.

### 4. Never cherry-pick into a dirty root checkout
If the root checkout is dirty and overlaps files touched by the incoming branch, use a clean integration branch or clean worktree to test the cherry-pick first.

### 5. Report exact next action
If the source worktree is still dirty, stop with a concrete handoff:
1. create the clean feature commit
2. rerun overlap check against that SHA
3. integrate from the clean SHA into a clean branch/worktree

### 6. Re-check the clean SHA against current main
Having a clean commit SHA is necessary but not sufficient. Before recommending a cherry-pick, verify:
- whether the SHA touches files already dirty in root
- whether the patch still applies to current `main`

If both checks fail, the job changes from “cherry-pick” to “forward-port in a clean branch/worktree.”

## Validation

Recommended checks:
1. `git status --short` in root and source worktree
2. `git rev-list --left-right --count main...<feature>`
3. `git diff --name-status HEAD <feature-sha>`
4. overlap between root dirty files and incoming files
5. conflict estimate before any real cherry-pick

## Related files

- `.squad/agents/devops/history.md`
- `.squad/decisions/inbox/devops-main-integration.md`
- `src/dashboard/server.ts`
- `tests/dashboard/server.test.ts`
