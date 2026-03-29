## Current Focus: Ralph Work Loop

Ralph is active. The team is executing the GitHub Issues backlog.

---

## Board State (as of 2026-03-15)

### 🔄 Agents Currently Running
| Agent | Task |
|-------|------|
| agent-0 (Danny) | Pipeline UX audit — still running |
| agent-1 (Rusty) | Expert Admin backend views + URLs |
| agent-2 (Linus) | Expert Admin HTML templates |

### 📋 Open GitHub Issues (6 — all `squad:linus` + some `squad:rusty`)
| # | Title | Assigned To |
|---|-------|-------------|
| #1 | Pipeline UX: Add Article Detail Page | Linus |
| #2 | Pipeline UX: Add Panel Composition Stage Page | Rusty + Linus |
| #3 | Pipeline UX: Add Stage Promotion Controls to Panel Discussion | Linus |
| #4 | Pipeline UX: Add Stage Promotion Controls to Article Writing | Linus |
| #5 | Pipeline UX: Add Dedicated Publisher Review Page | Linus |
| #6 | Pipeline UX: Add Published Articles Archive View | Rusty + Linus |

### 🗂️ SQL Todos (5 pending — all Expert Admin)
- expert-admin-list, expert-admin-detail, expert-admin-edit, expert-admin-ai-update, expert-admin-urls
  → Being worked by agent-1 (Rusty) + agent-2 (Linus)

---

## Ralph's Execution Plan

**Round 1** — Collect agent-1, agent-2, agent-3 results:
- agent-3 ✅ done: 6 pipeline UX issues created (#1–#6)
- agent-1 (Rusty): Expert Admin backend — collect when done → open PR → Saul reviews
- agent-2 (Linus): Expert Admin templates — collect when done → open PR → Saul reviews
- Mark 5 Expert Admin SQL todos as done once PRs are open

**Round 2** — Route GitHub Issues to agents:
- Spawn Rusty on issues #2, #6 (backend work needed)
- Spawn Linus on issues #1, #3, #4, #5 (frontend-only)
- Each agent: create branch `squad/{N}-slug`, implement, open PR

**Round 3** — Saul reviews PRs:
- Saul reads each diff, patches minor issues, or requests fixes
- Merges approved PRs via `gh pr merge --squash --delete-branch`
- Closes linked issues on merge

**Continuous** — Ralph scans after each round, routes new work, keeps going until board is clear.

---

## Notes
- No open PRs yet — agents are working from branches
- `gh` authenticated as JDL440 ✅
- Saul owns all PR review + merge — Joe does not review
