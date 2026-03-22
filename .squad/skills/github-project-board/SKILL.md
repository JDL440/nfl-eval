---
name: GitHub Project Board Management
domain: workflow
confidence: high
tools: [gh]
---

# GitHub Project Board — Status Workflow

## Board Statuses

| Status | When to Use | Who Moves Here |
|--------|-------------|---------------|
| **Todo** | New work ready to start | User creates issue, or Ralph triages |
| **In Progress** | Agent is actively working on it | Agent, BEFORE starting work |
| **Pending User** | Needs human decision or input | Agent, with explanatory comment |
| **Blocked** | Cannot proceed (dependency, access, etc.) | Agent, with blocker details |
| **For Review** | PR created and ready for review | Agent, after pushing PR |
| **Done** | Work completed and merged | Agent, after PR merge or issue resolution |

## CRITICAL: Always Update the Board

Before starting work on an issue:
```bash
# Move to "In Progress"
gh project item-edit --project-id PVT_kwHOADzUCs4BScCq --id ITEM_ID --field-id PVTSSF_lAHOADzUCs4BScCqzg_-OBk --single-select-option-id d4a8378c
```

After completing work:
```bash
# Move to "Done"
gh project item-edit --project-id PVT_kwHOADzUCs4BScCq --id ITEM_ID --field-id PVTSSF_lAHOADzUCs4BScCqzg_-OBk --single-select-option-id d094e37d
```

When blocked or needing user input:
```bash
# Move to "Blocked"
gh project item-edit --project-id PVT_kwHOADzUCs4BScCq --id ITEM_ID --field-id PVTSSF_lAHOADzUCs4BScCqzg_-OBk --single-select-option-id e435344d

# Move to "Pending User"
gh project item-edit --project-id PVT_kwHOADzUCs4BScCq --id ITEM_ID --field-id PVTSSF_lAHOADzUCs4BScCqzg_-OBk --single-select-option-id b138f68b
```

## Project IDs (JDL440/nfl-eval)

| Resource | ID |
|----------|-----|
| **Project** | `PVT_kwHOADzUCs4BScCq` (number: 1) |
| **Status field** | `PVTSSF_lAHOADzUCs4BScCqzg_-OBk` |
| Todo | `56d4a149` |
| In Progress | `d4a8378c` |
| Pending User | `b138f68b` |
| Blocked | `e435344d` |
| For Review | `b2dbea29` |
| Done | `d094e37d` |

## Example Commands

```bash
# Move issue item to "In Progress"
gh project item-edit --project-id PVT_kwHOADzUCs4BScCq --id ITEM_ID --field-id PVTSSF_lAHOADzUCs4BScCqzg_-OBk --single-select-option-id d4a8378c

# Move to "Done"
gh project item-edit --project-id PVT_kwHOADzUCs4BScCq --id ITEM_ID --field-id PVTSSF_lAHOADzUCs4BScCqzg_-OBk --single-select-option-id d094e37d

# Add issue to project (returns ITEM_ID)
gh project item-add 1 --owner JDL440 --url https://github.com/JDL440/nfl-eval/issues/NUMBER --format json
```

## Discovering Item IDs

```bash
# List items in the project
gh project item-list 1 --owner JDL440 --format json

# Or get a specific issue's project item
gh project field-list 1 --owner JDL440 --format json
```

## Rules

1. **ALWAYS** move to "In Progress" BEFORE spawning an agent for an issue
2. **ALWAYS** move to "Done" after PR is merged
3. **ALWAYS** add a comment when moving to "Pending User" or "Blocked" explaining what's needed
4. **ALWAYS** tag @JDL440 in comments when moving to "Pending User"
5. Archive "Done" issues after 7 days (Ralph handles this automatically)

## Ralph Monitoring Patterns

### Board drift reconciliation

If an issue is already closed or its linked PR is already merged, do not leave the project item in `Todo` or `In Progress`.

1. Verify the issue state and linked PR state.
2. Move the project item to `Done` immediately.
3. Remove stale blocker labels like `pending-user` if the work is actually complete.

### Competing PR fan-out for one issue

If one issue has multiple open PRs at the same time:

1. Post a `TLDR:` issue comment that names the candidate PRs and the reason the queue is ambiguous.
2. Move the issue to `Pending User` rather than `For Review`.
3. Keep it there until one PR is selected as the canonical path and the redundant PRs are closed.

### Owner follow-up after review started

If an issue or linked PR is already in `For Review` and the owner asks a new blocking question:

1. Treat that as active work again, not passive review wait.
2. Post a `TLDR:` comment noting the question and the board correction.
3. Move the project item back to `In Progress` until the author responds or updates the PR.

### Overlapping auto-triage on new issues

If a newly opened squad issue picks up conflicting `squad:*` labels from overlapping automation passes or never makes it onto the project board:

1. Treat the workflow that matched the issue domain as authoritative, and remove the stray `squad:*` label(s).
2. Add the issue to the project immediately and set its first board status explicitly (usually `Todo` unless work already started).
3. Post a `TLDR:` issue comment describing the cleanup and naming the resulting board status.

### Investigation completed, implementation slice not chosen

If an issue has research/investigation comments but no active PR and no narrowed first implementation slice:

1. Do not leave it in `In Progress`.
2. Post a `TLDR:` comment that the issue now needs a scope choice from the owner.
3. Add/keep `pending-user` and move the project item to `Pending User`.

### Reviewed and verified PRs

If a PR has already been reviewed and verified:

1. Treat it as merge-ready work during the sweep; do not wait for an extra nudge.
2. Merge it, then move the linked issue/project item to `Done` if the work is actually complete.
3. If the review or merge reveals additional work, create or confirm a follow-up GitHub issue so the queue stays explicit.

### Canonical PR chosen from a competing cluster

If several PRs exist for one issue and a clear winner is now merge-ready:

1. Merge the canonical PR.
2. Close the redundant or superseded PRs immediately with a short `TLDR:` explanation.
3. Convert any non-blocking review notes from the winning PR into tracked follow-up issues instead of leaving them buried in PR comments.
4. Re-check issue and PR state before each action because another sweep or user action may already have merged or closed one of them.

## Labels

| Label | Purpose |
|-------|---------|
| `squad` | General squad work — triggers triage |
| `squad:lead` | Routed to Lead |
| `squad:code` | Routed to Code |
| `squad:data` | Routed to Data |
| `squad:publisher` | Routed to Publisher |
| `squad:research` | Routed to Research |
| `squad:devops` | Routed to DevOps |
| `squad:ux` | Routed to UX |
| `squad:copilot` | Routed to @copilot coding agent |
| `priority:p0` | Critical — drop everything |
| `priority:p1` | High — next up |
| `priority:p2` | Normal — backlog |
| `pending-user` | Waiting for human input |
| `article` | Article pipeline work |
