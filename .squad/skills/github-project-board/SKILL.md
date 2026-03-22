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
gh project item-edit --project-id PROJECT_ID --id ITEM_ID --field-id STATUS_FIELD_ID --single-select-option-id IN_PROGRESS_ID
```

After completing work:
```bash
# Move to "Done"
gh project item-edit --project-id PROJECT_ID --id ITEM_ID --field-id STATUS_FIELD_ID --single-select-option-id DONE_ID
```

When blocked or needing user input:
```bash
# Move to "Blocked" or "Pending User"
gh project item-edit --project-id PROJECT_ID --id ITEM_ID --field-id STATUS_FIELD_ID --single-select-option-id BLOCKED_ID
```

## Discovering Project & Field IDs

```bash
# List projects for the repo
gh project list --owner JDL440 --format json

# Get project fields (find the Status field ID and option IDs)
gh project field-list PROJECT_NUMBER --owner JDL440 --format json
```

## Rules

1. **ALWAYS** move to "In Progress" BEFORE spawning an agent for an issue
2. **ALWAYS** move to "Done" after PR is merged
3. **ALWAYS** add a comment when moving to "Pending User" or "Blocked" explaining what's needed
4. **ALWAYS** tag @JDL440 in comments when moving to "Pending User"
5. Archive "Done" issues after 7 days (Ralph handles this automatically)

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
