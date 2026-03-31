---
name: Creating a New Agent Specialist
domain: Architecture, Agents, Pipeline
confidence: 0.95
description: End-to-end checklist for adding a new expert agent to the NFL Lab platform — covers both pipeline (dashboard) and squad (Copilot CLI) registration.
tags: [agents, charters, pipeline, squad, MCP, routing, onboarding]
---

# Creating a New Agent Specialist

## Problem

Adding a new specialist agent touches multiple systems that live in different directories with different discovery mechanisms. Missing any step results in the agent being invisible in one surface (dashboard, CLI, panel discussions, or tool access). The Fantasy agent implementation revealed that the two agent registries (pipeline vs. squad) are completely independent.

## Two Agent Systems

| System | Purpose | Discovery Location | Used By |
|--------|---------|-------------------|---------|
| **Pipeline agents** | Article production (panel discussions, writing, editing) | `<dataDir>/agents/charters/nfl/*.md` (seeded from `src/config/defaults/charters/nfl/`) | Dashboard new-idea page, `runner.listAgents()`, pipeline stages |
| **Squad agents** | Copilot CLI orchestration (session work, code tasks) | `.squad/agents/<name>/charter.md` | Squad agent router, Copilot CLI sessions |

**Both must be created** for a fully integrated agent. They serve different audiences and have different charter formats.

## Checklist

### Phase 1: Pipeline Agent (Dashboard Visibility)

#### 1a. Create pipeline charter seed file

**File:** `src/config/defaults/charters/nfl/<agent-name>.md`

This is the seed file that gets copied to `<dataDir>/agents/charters/nfl/` on fresh installs. Follow the existing charter format:

```markdown
# <Name> — <Full Role Title>

> One-line persona tagline.

## Identity

- **Name:** <Name>
- **Role:** <Full Role Title>
- **Persona:** <2-3 sentence personality and approach>
- **Model:** auto

## Responsibilities
- <Core duty 1>
- <Core duty 2>
- **Generate data anchors** using `<relevant_tool>` for panel discussions

## Knowledge Areas
### <Domain 1>
- <Key concept with brief explanation>

## Data Sources
| Source | What It Provides | Access |
|--------|-----------------|--------|

## Query Tools & Scripts
### MCP Tools
| Tool | Use Case |
|------|----------|

## Data Anchor Generation
### Workflow
1. Identify subject from article prompt
2. Run relevant queries
3. Embed in ## Data Anchors section (~400 token budget)

## Integration Points
- **<Other agent>:** <How they interact>

## Boundaries
- <What this agent does NOT do>
```

**Reference examples:** `analytics.md` (data-heavy), `offense.md` (scheme-focused), `cap.md` (domain-specific).

#### 1b. Deploy to local data directory

Copy the charter so it appears immediately without re-seeding:

```powershell
Copy-Item "src/config/defaults/charters/nfl/<agent>.md" "$HOME/.nfl-lab/agents/charters/nfl/<agent>.md"
```

#### 1c. Verify dashboard visibility

- Restart the dashboard (`npm run v2:dev` or restart the server)
- Navigate to `/ideas/new`
- Confirm the agent appears in the **Pin Expert Agents** grid
- The agent name must NOT match any entry in the PROD set (`lead`, `writer`, `editor`, `scribe`, `coordinator`, `panel-moderator`, `publisher`) or the TEAMS set (32 NFL abbreviations) — see `src/dashboard/server.ts` lines 1020-1027

### Phase 2: Squad Agent (CLI Visibility)

#### 2a. Create squad charter

**File:** `.squad/agents/<agent-name>/charter.md`

Squad charters are shorter and follow the Copilot CLI agent pattern:

```markdown
# Charter — <Name>

## Identity
- **Name:** <Name>
- **Role:** <Role>
- **Badge:** <Emoji> <Name>

## Scope
<What this agent covers, 2-3 sentences>

## Responsibilities
- <Duty 1>

## Domain Knowledge
- <Key expertise areas>

## Model
- **Preferred:** auto
- **Why:** <Rationale>

## Boundaries
- Does NOT <thing> (routes to <other agent>)
```

#### 2b. Create history file

**File:** `.squad/agents/<agent-name>/history.md`

```markdown
# History — <Name>

Session log for the <Name> agent.

## Created
- **Date:** <YYYY-MM-DD>
- **By:** <who/what created it>
- **Context:** <Brief creation context>
```

Note: History files are gitignored (`.gitignore` pattern: `.squad/**/history.md`).

#### 2c. Update team roster

**File:** `.squad/team.md`

Add a row to the Members table:

```markdown
| <Name> | <Role> | <Scope description> | <Badge> |
```

#### 2d. Update routing rules

**File:** `.squad/routing.md`

Add entries to:
- **Primary Routing** table — keywords that route work to this agent
- **Multi-Domain Routing** table — patterns where this agent collaborates
- **Review Routing** table — artifact types this agent reviews

### Phase 3: Data Layer (if agent needs custom queries)

#### 3a. Create Python query script (optional)

**File:** `content/data/query_<domain>.py`

Follow the existing pattern:
- Use `from _shared import load_cached_or_fetch` for auto-caching
- Accept `--format json` for MCP tool compatibility
- Support `argparse` CLI with `--player`, `--season`, `--position`, etc.
- Include `if __name__ == "__main__": main()` entry point

#### 3b. Extend existing query scripts (optional)

If the new domain adds columns to existing datasets (e.g., fantasy_points already existed in player_stats but wasn't queried):
- `content/data/query_player_epa.py` — add to aggregation expressions and position output blocks
- `content/data/query_positional_comparison.py` — add to `POSITION_METRICS` dict and `count_cols`

#### 3c. Register MCP tool

**File:** `.github/extensions/nflverse-query/tool.mjs`

Add:
1. Tool definition object (`export const queryXxxTool = { name, description, parameters }`)
2. Handler function (`export async function handleQueryXxx(args) { ... }`)
3. Use `cachedQuery()` wrapper with appropriate TTL from `mcp-cache.mjs`

**File:** `mcp/tool-registry.mjs`

Add:
1. Import the tool + handler from `tool.mjs`
2. Add tool name to `SAFE_READ_ONLY_TOOL_NAMES` array (if read-only)
3. Add metadata entry to `BASE_TOOL_METADATA` object
4. Add `buildToolEntry()` call to `BASE_LOCAL_TOOL_ENTRIES` array

### Phase 4: Skill Document

#### 4a. Create analysis skill

**File:** `.squad/skills/<domain>-analysis/SKILL.md`

```yaml
---
name: <Domain> Analysis Framework
domain: <Domain>, Data, Content
confidence: 0.85
description: <What this skill covers>
tags: [<relevant>, <tags>]
---
```

Include:
- Problem statement
- Domain-specific reference data (scoring systems, terminology, etc.)
- Evaluation framework / methodology
- Data query templates with example tool calls
- Panel integration protocol (how this agent joins discussions)
- Article format templates
- Boundaries

### Phase 5: Validation

1. **Run tests:** `npm run v2:test` — ensure no regressions
2. **Dashboard check:** Verify agent appears in Pin Expert Agents on `/ideas/new`
3. **MCP tool check (if applicable):** Verify tool appears in tool catalog
4. **Commit all changes** with descriptive message

## File Inventory (Complete Agent)

| File | Purpose | Required? |
|------|---------|-----------|
| `src/config/defaults/charters/nfl/<agent>.md` | Pipeline charter (seed) | ✅ Yes — dashboard visibility |
| `<dataDir>/agents/charters/nfl/<agent>.md` | Pipeline charter (deployed) | ✅ Yes — copy of seed for immediate use |
| `.squad/agents/<agent>/charter.md` | Squad charter | ✅ Yes — CLI visibility |
| `.squad/agents/<agent>/history.md` | Squad history (gitignored) | ✅ Yes — session tracking |
| `.squad/team.md` | Team roster entry | ✅ Yes — team membership |
| `.squad/routing.md` | Routing rules | ✅ Yes — work routing |
| `content/data/query_<domain>.py` | Custom query script | ⚠️ If agent needs data queries |
| `.github/extensions/nflverse-query/tool.mjs` | MCP tool definition | ⚠️ If new query script created |
| `mcp/tool-registry.mjs` | MCP tool registration | ⚠️ If new query script created |
| `.squad/skills/<domain>-analysis/SKILL.md` | Domain skill document | ⚠️ Recommended for complex domains |

## Common Pitfalls

1. **Agent only in `.squad/` but not in pipeline charters** — won't appear on dashboard new-idea page
2. **Agent only in pipeline charters but not in `.squad/`** — won't be routed work in CLI sessions
3. **Agent name matches PROD or TEAMS filter** — filtered out of the Pin Expert Agents grid
4. **Forgot to copy charter to data dir** — seed file only deploys on fresh `v2:init`, not on restart
5. **MCP tool registered but not in `SAFE_READ_ONLY_TOOL_NAMES`** — tool blocked at runtime for agents
6. **Python script missing `--format json`** — MCP handler gets unparseable markdown output
