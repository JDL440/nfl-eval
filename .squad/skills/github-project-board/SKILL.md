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
