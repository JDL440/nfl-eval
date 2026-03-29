# Plan: Squad Setup — Tamir-Style Workflow

## Problem Statement

The repo (`JDL440/nfl-eval`) has a mature article pipeline with 47 agent charters, but the Squad infrastructure is incomplete: no `.squad/` directory exists in the working tree, workflows reference missing files, Ralph's cron is disabled, and there's no local ralph-watch loop. The v1 Squad setup was archived and never rebuilt for v2.

**Goal:** Follow Tamir Dresher's "Organized by AI" pattern to set up a fully operational Squad with:
- Functional team roster with charters
- GitHub Issues + Project Board as the todo system
- Issue-based conversation with TLDR pattern
- Ralph outer loop (local PS1 + GitHub Actions)
- Clean separation from the existing article pipeline agents

## User Decisions

| Decision | Choice |
|----------|--------|
| Agent naming | Functional names (Lead, Code, Data, etc.) — no character universe |
| Pipeline relationship | **Separate** — Squad and article pipeline agents are independent |
| Ralph approach | **Both** — GitHub Actions for lightweight triage, local PS1 for heavy work |
| Issue template | Keep existing article-idea.yml only (no new squad-task template) |
| Project Board | **Yes** — set up with full status workflow |
| Archive cleanup | **Remove** entire `archive/v1/` directory |
| PR auto-merge | **Yes** — Squad can create and merge their own PRs |
| Ralph interval | **5 minutes** |
| Squad model defaults | GPT-5.4 for squad agents; GPT-5.4 mini for Scribe |

---

## Implementation Plan

### Phase 1: Cleanup — Remove Archive

**Todo: `remove-archive`**

Delete `archive/v1/` entirely (183 files of historical v1 Squad state). Verify nothing in the active codebase references `archive/`.

---

### Phase 2: Run Squad Init

**Todo: `run-squad-init`**
Depends on: `remove-archive`

The `squad.agent.md` coordinator has a built-in **Init Mode** that triggers when no `.squad/team.md` exists. After removing the archive, we use this flow:

1. **Start a Squad session** — run `copilot --agent squad` (or equivalent CLI invocation)
2. Squad enters Init Mode Phase 1 → Proposes a team based on the project
3. **Guide the init** with our preferences:
   - Functional names only (Lead, Code, Data, Publisher, Research, DevOps, UX, Ralph, Scribe) — no character universe
   - Tell it the stack: TypeScript/Node.js, NFL analytics, LLM orchestration, Substack publishing, GitHub Actions, MCP tools, Hono+HTMX dashboard
   - Request the specific 9-agent roster we decided on
4. Squad enters Init Mode Phase 2 → Creates `.squad/` directory structure:
   - `team.md` (with `## Members` header — required by workflows)
   - `routing.md`, `ceremonies.md`, `decisions.md`, `decisions/inbox/`
   - Agent charters in `.squad/agents/{name}/charter.md`
   - Casting state in `.squad/casting/`
   - `.gitattributes` merge drivers
   - Agent `history.md` files seeded with project context
5. Post-setup: Point it at `JDL440/nfl-eval` GitHub issues, add human members, enable @copilot

**Why use Squad init instead of manual creation:** The init flow is specifically designed to seed agent context, create proper casting state, ensure the `## Members` header format that workflows depend on, and set up merge drivers. It also gives Squad self-awareness of the project from day one.

**Expected output:** Full `.squad/` directory with team.md, routing.md, decisions.md, 9 agent charters, casting state, and seeded histories.

---

### Phase 3: Post-Init Customization

**Todo: `post-init-customize`**
Depends on: `run-squad-init`

After Squad creates the initial structure, augment/customize:

1. **Agent charters** — Ensure each charter has domain-specific knowledge for this project:
   - **Code:** TypeScript/Node.js, vitest, Hono, the pipeline engine
   - **Data:** nflverse, Python query scripts, NFL analytics domain
   - **Publisher:** Substack API, social media, Markdown→HTML rendering
   - **DevOps:** GitHub Actions, MCP server architecture, `.github/extensions/`
   - **UX:** Hono+HTMX, SSE, dashboard views
   - **Research:** NFL domain, documentation, analysis synthesis
2. **TLDR requirement** — Add to decisions.md: all issue comments must start with `**TLDR:**`
3. **PR auto-merge policy** — Add to decisions.md: Squad can create and merge their own PRs
4. **Project board skill** — Create `.squad/skills/github-project-board/SKILL.md`
5. **Separation from pipeline** — Add to decisions.md: Squad agents handle project work (issues, PRs, infra); article pipeline agents in `src/config/defaults/charters/` handle content production independently

---

### Phase 4: Update GitHub Workflows

**Todo: `update-workflows`**
Depends on: `run-squad-init`

#### 4a. `squad-heartbeat.yml` — Re-enable Ralph cron
- Uncomment the cron schedule (every 30 minutes)
- Update to read from new `.squad/team.md` (should already work with existing fallback logic)
- Ensure Ralph checks both article pipeline issues AND general squad tasks

#### 4b. `squad-triage.yml` — Verify routing
- Confirm it reads `.squad/team.md` for agent roster
- Update label routing for functional names (`squad:code`, `squad:data`, `squad:devops`, etc.)

#### 4c. `sync-squad-labels.yml` — Verify label sync
- Should auto-create labels from `.squad/team.md` roster
- Confirm label namespaces: `squad`, `squad:{agent}`, `go:*`

#### 4d. `squad-issue-assign.yml` — Verify auto-assignment
- Ensure @copilot routing works for squad-labeled issues

---

### Phase 5: GitHub Project Board Setup

**Todo: `setup-project-board`**
Depends on: `update-workflows`

Create/document the GitHub Project Board configuration:

**Status Columns:**
| Status | Description | Who Moves Here |
|--------|-------------|---------------|
| **Todo** | New work ready to start | User or Squad triage |
| **In Progress** | Actively being worked on | Agent picks it up |
| **Pending User** | Needs human decision/input | Agent, with explanatory comment |
| **Blocked** | Cannot proceed | Agent, with blocker details |
| **For Review** | PR ready for review | Agent after completing code |
| **Done** | Work completed and merged | Agent after PR merge |

**Labels:**
- `squad` — General squad work
- `squad:lead`, `squad:code`, `squad:data`, `squad:publisher`, `squad:research`, `squad:devops`, `squad:ux` — Agent-specific routing
- `priority:p0`, `priority:p1`, `priority:p2` — Priority levels
- `pending-user` — Waiting for human input
- `article` — Article pipeline work (existing)

**Skill file:** `.squad/skills/github-project-board/SKILL.md` — step-by-step instructions for agents to update board status using `gh project` CLI commands.

Note: The actual GitHub Project Board creation requires manual setup via GitHub UI or `gh project create`. We'll create the skill documentation and label configuration so the Squad knows how to use it, and provide CLI commands you can run to set it up.

---

### Phase 6: Ralph Watch Loop (Local PS1)

**Todo: `create-ralph-watch`**
Depends on: `run-squad-init`

Create `ralph-watch.ps1` at repo root, adapted from Tamir's pattern for this project:

**Features:**
- Single-instance guard (mutex + lockfile)
- 5-minute interval
- `git pull` before each round (fresh context)
- Spawn `copilot --agent squad` with detailed Ralph prompt
- Structured logging to `~/.squad/ralph-watch.log`
- Heartbeat file at `~/.squad/ralph-heartbeat.json`
- Log rotation (500 entries / 1MB)
- Ctrl+C cleanup

**Ralph Prompt:**
```
Ralph, Go!
MAXIMIZE PARALLELISM: Identify ALL actionable issues and spawn agents
for ALL of them simultaneously.

REPO: JDL440/nfl-eval
BOARD WORKFLOW: Move issues to "In Progress" before starting, "Done"
when complete, "Blocked"/"Pending User" when stuck.

TLDR RULE: Always start issue comments with TLDR: summary.
PR AUTO-MERGE: Create PRs, review, and merge when tests pass.
```

---

### Phase 7: Update `.gitattributes`

**Todo: `update-gitattributes`**
Depends on: `run-squad-init`

Squad init should create merge drivers, but verify and add any missing ones:
```
.squad/decisions.md merge=union
.squad/agents/*/history.md merge=union
```

---

### Phase 8: Verify & Test

**Todo: `verify-setup`**
Depends on: `post-init-customize`, `update-workflows`, `create-ralph-watch`, `update-gitattributes`

1. Run existing test suite (`npx vitest run`) — ensure nothing broken
2. Run `npm run v2:build` — ensure TypeScript compiles
3. Verify `.squad/team.md` is parseable by `sync-squad-labels.yml` (has `## Members` header)
4. Verify `squad-heartbeat.yml` can read new roster
5. Test `ralph-watch.ps1` with a dry run (single iteration)
6. Commit all changes

---

## Execution Flow

```
1. remove-archive          ← Delete archive/v1/
      │
2. run-squad-init          ← Interactive: copilot --agent squad (creates .squad/)
      │
      ├─── 3. post-init-customize   ← Enrich charters, add decisions, create board skill
      ├─── 4. update-workflows      ← Re-enable cron, verify label routing
      ├─── 6. create-ralph-watch    ← PowerShell outer loop
      └─── 7. update-gitattributes  ← Verify merge drivers
               │
         8. verify-setup            ← Tests, build, dry run
```

Steps 3, 4, 6, 7 can run in parallel after Squad init completes.

---

## File Summary

**Created by Squad init:**
- `.squad/team.md`, `routing.md`, `ceremonies.md`, `decisions.md`, `decisions/inbox/`
- `.squad/agents/{lead,code,data,publisher,research,devops,ux,ralph,scribe}/charter.md` + `history.md`
- `.squad/casting/` (registry.json, history.json, policy.json)
- `.gitattributes` merge drivers (verified/augmented in Phase 7)

**Created manually (post-init):**
- `.squad/skills/github-project-board/SKILL.md`
- `ralph-watch.ps1`

**Modified files:**
- `.github/workflows/squad-heartbeat.yml` (re-enable cron)
- `.github/workflows/squad-triage.yml` (verify routing labels)
- `.github/workflows/sync-squad-labels.yml` (verify label sync)
- `.squad/decisions.md` (add TLDR rule, PR auto-merge policy, pipeline separation)
- `.squad/agents/*/charter.md` (enrich with project-specific domain knowledge)

**Deleted files/directories:**
- `archive/v1/` (entire directory — 183 files)

---

## Risks & Notes

1. **Squad ↔ Pipeline separation:** The article pipeline agents (`src/config/defaults/charters/`) are completely independent. The Squad agents (`.squad/agents/`) coordinate *project work* (issues, PRs, infra). They don't interfere with each other.

2. **squad.agent.md complexity:** At 72KB, the existing coordinator is very detailed. We'll make targeted edits rather than rewriting — preserving the proven orchestration patterns (fan-out, response modes, MCP detection, etc.).

3. **Project Board:** Requires manual GitHub UI setup (or `gh project` CLI). We'll prepare all the config and skill docs, plus the CLI commands to run.

4. **Ralph auto-merge:** With PR auto-merge enabled, Ralph + Squad can fully close issues autonomously. You only intervene when issues are marked `pending-user`.

