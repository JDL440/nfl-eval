# Knowledge System

The NFL Lab platform now has two complementary knowledge tracks:

1. **Runtime knowledge** — the charter, skill, and memory system that is composed into prompts during live agent runs.
2. **Structured domain knowledge defaults** — curated glossary YAML and team identity markdown that give the repo a durable, reviewable football knowledge base.

Phases 1–3 of issue #85 deliver the structured content layer only. Runtime loading, artifact injection, source indexing, and monthly refresh automation remain deferred work.

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Agent System Prompt                       │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐            │
│  │ Charter   │  │ Skills   │  │ Memory        │            │
│  │ (identity)│  │ (how-to) │  │ (experience)  │            │
│  └──────────┘  └──────────┘  └───────────────┘            │
│                                                             │
│  Composed into system prompt per agent per run              │
└─────────────────────────────────────────────────────────────┘
```

At runtime, the Agent Runner composes a system prompt from:

1. **Charter** — who the agent is (identity, responsibilities, boundaries)
2. **Skills** — what the agent knows how to do (workflows, output formats)
3. **Memory** — what the agent has learned (past decisions, domain knowledge)

## Structured Domain Knowledge Defaults (Issue #85 Phases 1–3)

These assets are authored in-repo so Research, Code, and Data can collaborate on a shared football reference layer without mixing it into free-form agent memory.

### What Ships Now

```text
src/config/defaults/glossaries/
  ├── analytics-metrics.yaml
  ├── cap-mechanics.yaml
  ├── defense-schemes.yaml
  └── personnel-groupings.yaml

content/data/team-sheets/
  ├── BUF.md
  ├── KC.md
  └── SEA.md
```

### What Phases 1–3 Deliver

- **Phase 1 — Schema and layout**
  - A consistent YAML structure for shared glossaries
  - A consistent markdown section layout for team identity sheets
  - Validation tests that check file presence and structural integrity
- **Phase 2 — Universal glossary content**
  - Initial high-value definitions for analytics metrics, cap mechanics, defense schemes, and personnel groupings
- **Phase 3 — Team identity sheets**
  - Initial validated team sheets for SEA, KC, and BUF

### What Is Explicitly Deferred

- Loading glossaries into `runner.ts`
- Creating article artifacts from team sheets in `actions.ts`
- Building a domain knowledge index with source provenance
- Monthly or scheduled refresh automation

Those items belong to the follow-up implementation phases, not the Phase 1–3 content pass.

### Glossary YAML Format

Each glossary file follows a flat, validation-friendly YAML structure:

```yaml
schema_version: 1
id: analytics-metrics
glossary: analytics-metrics
description: Core NFL analytics terms aligned to NFL Lab usage.
entry_fields:
  required:
    - term
    - definition
    - source
    - verified_date
    - ttl_days
  optional:
    - notes
    - examples
refresh_guidance:
  - Re-verify threshold language when source material changes.
entries:
  - term: EPA per play
    definition: ...
    source:
      refs:
        - src/config/defaults/bootstrap-memory.json
    verified_date: 2026-03-22
    ttl_days: 365
```

**Why this shape works now**

- It is structured enough for deterministic validation tests.
- It keeps every term tied to freshness and source-reference fields from day one.
- It keeps the authoring contract focused on the entry-level factual fields that matter most for auditability.
- It is easy for Code or Data to extend later and parses cleanly with the repo's lightweight test-only YAML validation.

### Team Identity Sheet Markdown Format

Each initial team sheet uses frontmatter plus a stable markdown briefing layout:

```markdown
---
team: SEA
team_name: Seattle Seahawks
verified_date: 2026-03-22
ttl_days: 30
sources:
  - https://www.seahawks.com/team/front-office-roster/
volatility:
  leadership: 30
  team_identity: 120
  venue_and_division: 365
---

# Seattle Seahawks

## Durable snapshot
## Identity anchors
### Offense
### Defense
## Roster-building and cap framing
## Source guidance
```

**Why this shape works now**

- The frontmatter makes freshness, source, and volatility expectations explicit.
- The markdown body stays focused on durable identity, not volatile depth-chart detail.
- The sections are stable enough for validation while staying readable to writers and researchers.
- The proof-of-concept sheets intentionally cover only `SEA`, `KC`, and `BUF` so the repo can validate structure before any phase 4 runtime wiring.

## Layer 1: Charters

Charters define agent identity. Each charter is a markdown file with structured sections.

### Location

```
~/.nfl-lab/agents/charters/{league}/
  ├── lead.md           # Content lead / discussion moderator
  ├── writer.md         # Substack article writer
  ├── editor.md         # Fact-checker and quality gate
  ├── analytics.md      # Advanced analytics expert
  ├── cap.md            # Salary cap specialist
  ├── draft.md          # Draft evaluation expert
  ├── offense.md        # Offensive scheme analyst
  ├── defense.md        # Defensive scheme analyst
  ├── specialteams.md   # Special teams analyst
  ├── playerrep.md      # Player/FA evaluation
  ├── collegescout.md   # College prospect evaluation
  ├── injury.md         # Injury assessment
  ├── media.md          # Media / news research
  ├── publisher.md      # Publication workflow
  ├── panel-moderator.md # Panel synthesis
  ├── scribe.md         # Session documentation
  └── {team-abbr}.md    # Team-specific experts (ari, atl, ... wsh)
```

### Charter Format

```markdown
# Agent Name
> Brief description

## Identity
- Name: Display name
- Role: Functional role
- Persona: Voice and personality

## Responsibilities
- Core task 1
- Core task 2

## Knowledge Areas
- Domain expertise
- Data sources available

## Boundaries
- What this agent does NOT do
- Explicit constraints

## Integration Points
- How this agent connects to others
```

### Loading

Charters are loaded by `AgentRunner.loadCharter(agentName)` from the configured `chartersDir`. Two path patterns are checked:

1. `{chartersDir}/{agentName}.md`
2. `{chartersDir}/{agentName}/charter.md`

The charter is parsed into sections by splitting on `## ` headings. Identity, responsibilities, knowledge, and boundaries are extracted and injected into the system prompt.

## Layer 2: Skills

Skills define workflows and output formats. Each skill is a markdown file with YAML frontmatter.

### Location

```
~/.nfl-lab/agents/skills/
  ├── idea-generation.md       # How to generate article ideas
  ├── discussion-prompt.md     # How to create discussion prompts
  ├── panel-composition.md     # How to compose expert panels
  ├── article-discussion.md    # How to run panel discussions
  ├── editor-review.md         # How to review articles
  ├── publisher.md             # How to prepare for publication
  ├── substack-article.md      # Substack formatting rules
  ├── nflverse-data.md         # How to use nflverse data tools
  ├── fact-checking.md         # Fact verification workflow
  ├── image-generation.md      # Image prompt crafting
  ├── image-review.md          # Image quality review
  ├── knowledge-propagation.md # How agents share knowledge
  ├── knowledge-recording.md   # How agents store knowledge
  └── history-maintenance.md   # Memory maintenance and decay
```

### Skill Format

```markdown
---
name: "skill-name"
description: "One-line purpose"
domain: "content-production | analytics | publishing | data-fetching | knowledge-management"
confidence: "high | medium | low"
source: "manual | automated | v2-rewrite"
tools: "[tool1, tool2]"
---

# Skill Content

## Purpose
## When to Use
## Workflow
## Examples
## Boundaries
```

### Loading

Skills are loaded by `AgentRunner.loadSkill(skillName)` from the configured `skillsDir`. YAML frontmatter is parsed for metadata, and the markdown body becomes the skill content injected into the system prompt.

Skills are requested per agent run — the caller specifies which skills to load. Missing skills are silently excluded.

## Layer 3: Memory (memory.db)

Memory provides persistent, queryable experience storage via SQLite.

### Schema

```sql
CREATE TABLE agent_memory (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_name      TEXT NOT NULL,
  category        TEXT NOT NULL,
  content         TEXT NOT NULL,
  source_session  TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at      TEXT,
  relevance_score REAL NOT NULL DEFAULT 1.0,
  access_count    INTEGER NOT NULL DEFAULT 0
);
```

### Categories

| Category | Purpose | Example |
|----------|---------|---------|
| `learning` | Knowledge gained from completed work | "EPA per play is the best efficiency metric for QB evaluation" |
| `decision` | Strategic choices and reasoning | "Chose zone-coverage framing for Seahawks secondary analysis" |
| `preference` | Agent-specific tendencies | "Prefers advanced metrics over counting stats" |
| `domain_knowledge` | Reusable factual knowledge | "2025 NFL salary cap is $255.4M. Hard cap with no exceptions." |
| `error_pattern` | Mistakes to avoid | "Previously cited outdated contract — always verify with OTC" |

### How Memory Is Used

1. **Recall** — Before each agent run, the top 10 entries by `relevance_score DESC` are recalled
2. **Inject** — Recalled memories are added to the system prompt as `## Relevant Context`
3. **Auto-learn** — After each successful run, a summary of the output is stored as a `learning` entry
4. **Touch** — When an entry is useful, its relevance score is boosted (max 2.0)
5. **Decay** — Periodic multiplicative decay (default 0.95×) reduces stale entries
6. **Prune** — Entries older than 90 days or below 0.1 relevance are deleted

### Memory in the System Prompt

```
## Relevant Context
- [domain_knowledge] NFL salary cap for 2025 is $255.4M...
- [learning] EPA per play is the best efficiency metric...
- [decision] Chose analytical depth over hot-take framing...
```

### Dashboard

The Memory Browser at `/memory` provides:
- **Stats** — Entry counts and average relevance per agent
- **Filters** — By agent, category, search text
- **CRUD** — Create, edit, delete individual entries
- **Bulk operations** — Prune old/low-relevance entries, decay all entries

## Bootstrap Process

### Fresh Install

When you run `npm run v2:init`:

1. **Directory structure** created under `~/.nfl-lab/`
2. **Seed configs** copied: `models.json`, `leagues.json`
3. **Seed charters** copied from `src/config/defaults/charters/{league}/` (16 specialist charters for NFL)
4. **Seed skills** copied from `src/config/defaults/skills/` (14 workflow skills)
5. **Bootstrap memory** loaded from `src/config/defaults/bootstrap-memory.json` (28 domain_knowledge entries)

Structured domain knowledge defaults from Issue #85 are **not** seeded into the runtime data directory yet. During Phases 1–3 they remain source-controlled reference files in the repository until the deferred runtime-integration work is completed.

### What Gets Seeded

| Layer | NFL Seeds | Purpose |
|-------|-----------|---------|
| Charters | 16 specialists | Agent identities (lead, writer, editor, analytics, etc.) |
| Skills | 14 workflows | How-to guides for each pipeline stage |
| Memory | 28 entries | Essential domain knowledge (cap rules, EPA, draft value, etc.) |

Team-specific charters (32 NFL teams) are NOT seeded — they should be created per-instance based on current rosters and situations.

### Idempotent Design

- Charters are only seeded if the charter directory is empty
- Skills are copied only if they don't already exist (individual file check)
- Memory is only bootstrapped if `memory.db` doesn't exist
- Running `v2:init` multiple times is safe — it won't overwrite customizations

## Multi-League Extensibility

The knowledge system is designed for multi-league support:

### Directory Structure

```
~/.nfl-lab/
├── agents/
│   ├── charters/
│   │   ├── nfl/          # NFL agent charters
│   │   ├── mlb/          # Future: MLB agent charters
│   │   └── nba/          # Future: NBA agent charters
│   ├── skills/           # Shared across leagues
│   └── memory.db         # Shared memory (agent_name scoped)
```

### Adding a New League

1. **Create seed charters** in `src/config/defaults/charters/{league}/`
   - Minimum: lead, writer, editor, plus league-specific analysts
2. **Add league config** to `src/config/defaults/leagues.json`
   ```json
   {
     "mlb": {
       "name": "Baseball Lab",
       "panelName": "The Baseball Lab Expert Panel",
       "dataSource": "baseballsavant",
       "positions": ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"]
     }
   }
   ```
3. **Add league-specific skills** (optional) — e.g., `mlb-statcast-data.md`
4. **Add bootstrap memory** entries for the new league's domain knowledge
5. **Run init** with `NFL_LEAGUE=mlb npm run v2:init`

### Shared vs. League-Specific

| Component | Scope | Rationale |
|-----------|-------|-----------|
| Charters | Per-league | Different sports need different analysts |
| Skills | Shared | Most workflows (writing, editing, publishing) are sport-agnostic |
| Memory | Shared DB, agent-scoped | Agent names include league context |
| Pipeline stages | Shared | Idea → Discussion → Draft → Edit → Publish is universal |
| Data tools | Per-league | NFL uses nflverse; MLB would use Statcast |

## API Reference

### AgentMemory

```typescript
// Store a new memory entry
memory.store({
  agentName: string,
  category: 'learning' | 'decision' | 'preference' | 'domain_knowledge' | 'error_pattern',
  content: string,
  relevanceScore?: number,  // default 1.0, max 2.0
  expiresAt?: string,       // ISO date string
  sourceSession?: string,
});

// Recall memories for an agent
memory.recall(agentName, {
  limit?: number,           // default 20
  category?: MemoryCategory,
  minRelevance?: number,    // default 0.0
  includeExpired?: boolean, // default false
});

// Boost an entry's relevance (capped at 2.0)
memory.touch(id, boost?: number); // default 0.1

// Decay all entries for an agent
memory.decay(agentName, factor?: number); // default 0.95

// Delete old/low-relevance entries
memory.prune({
  maxAge?: number,        // days, default 90
  minRelevance?: number,  // default 0.1
});

// Get per-agent statistics
memory.stats(): { agentName: string; count: number; avgRelevance: number }[];
```

### Configuration Functions

```typescript
// Create directory structure (called on every startup)
initDataDir(dataDir: string, league?: string);

// Seed knowledge files (called only by `v2:init`)
seedKnowledge(dataDir: string, league?: string): {
  charters: number;
  skills: number;
  memory: number;
};
```
