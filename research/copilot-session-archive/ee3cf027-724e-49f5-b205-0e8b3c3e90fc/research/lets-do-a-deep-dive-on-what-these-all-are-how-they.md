# Agent Knowledge System — Deep Dive & Implementation Plan

## Executive Summary

The NFL Lab agent knowledge system has **four storage layers**: charters (identity/role), skills (reusable capabilities), memory.db (structured learnings/decisions), and legacy .squad/ files (v1 artifacts). The memory.db currently holds **644 entries** across **48 agents**, but **all 644 have zero access counts** — meaning memories are written but never meaningfully recalled. Most entries are bulk-migrated v1 history.md content (with `\r\n` Windows line endings), not purpose-built structured memories. The knowledge-propagation and knowledge-recording skills describe a .squad/knowledge/inbox pattern that **no longer exists in v2** — those skills are stale. The fact-checking skill exists but is never invoked in the pipeline. This report details every component, how it flows, what's broken, and a concrete implementation plan to fix it.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                     Agent Knowledge Sources                        │
├──────────────┬──────────────┬──────────────┬───────────────────────┤
│  Charters    │  Skills      │  Memory DB   │  .squad/ (legacy)     │
│  (identity)  │  (how-to)    │  (learnings) │  (v1 artifacts)       │
│              │              │              │                       │
│  48 files    │  24 files    │  644 rows    │  history.md x 2       │
│  Editable ✅ │  Editable ✅ │  No UI ❌    │  Stale ⚠️             │
│  Used ✅     │  Used ✅     │  Written ✅  │  Unused ❌            │
│              │              │  Read ❌     │                       │
└──────────────┴──────────────┴──────────────┴───────────────────────┘
                         │
                         ▼
              ┌────────────────────┐
              │   AgentRunner.run()│
              │                    │
              │ 1. loadCharter()   │  ← reads charter .md
              │ 2. loadSkill()     │  ← reads skill .md files
              │ 3. memory.recall() │  ← queries memory.db (top 10)
              │ 4. composeSysPrompt│  ← assembles all into prompt
              │ 5. gateway.chat()  │  ← calls LLM
              │ 6. memory.store()  │  ← always stores "Completed X"
              └────────────────────┘
```

---

## Component 1: Charters

### What They Are
Markdown files defining agent identity, responsibilities, knowledge areas, and boundaries. Parsed by `parseCharter()` into `AgentCharter` objects with structured sections[^1].

### Location
`~/.nfl-lab/agents/charters/nfl/*.md` — 48 files (32 team + 16 specialist)[^2]

### How Populated
Initially hand-authored. Can be edited via dashboard at `/agents/:name` → Edit button → htmx PUT to `/api/agents/:name`[^3].

### How Used
`AgentRunner.run()` calls `loadCharter(agentName)` which reads the file, parses it into sections (Identity, Responsibilities, Knowledge, Boundaries), and injects into the system prompt[^4].

### Current Issues
- **Knowledge section is static** — charter knowledge areas are generic descriptions ("Track salary cap situation"), not actual data. The real team knowledge lives in memory.db entries migrated from v1 history.md files.
- **No versioning** — edits overwrite the file with no history.
- **No validation** — can save malformed markdown with missing required sections.

---

## Component 2: Skills

### What They Are
Markdown files with YAML frontmatter defining reusable agent capabilities. Parsed by `parseSkillFile()` into `AgentSkill` objects[^5].

### Location
`~/.nfl-lab/agents/skills/*.md` — 24 files[^6]

### How Populated
Hand-authored. Editable via dashboard at `/agents/skills/:name`[^7].

### How Used
When `AgentRunner.run()` is called with `skills: ['fact-checking', 'nflverse-data']`, it loads each skill's content and appends to the system prompt under `## Skills`[^8].

### Current Issues
- **Several skills reference v1 patterns that no longer exist:**
  - `knowledge-propagation.md` — References `.squad/knowledge/inbox/` pattern and `history.md` files. This infrastructure doesn't exist in v2[^9].
  - `knowledge-recording.md` — Describes how to structure `history.md` files. In v2, there are no history.md files — memory.db replaced them[^10].
  - `history-maintenance.md` — Defines retention/summarization for history.md files that don't exist anymore[^11].
- **fact-checking.md exists but is never called** — No stage action invokes the fact-checking skill. `composePanel()` and `writeDraft()` don't pass `skills: ['fact-checking']`[^12].
- **Some skills are NFL-specific** but live in the generic `skills/` dir (not under `nfl/`).

---

## Component 3: Memory Database (memory.db)

### What It Is
SQLite database with single `agent_memory` table storing structured entries with categories, relevance scores, and expiration[^13].

### Schema
```sql
CREATE TABLE agent_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('learning','decision','preference','domain_knowledge','error_pattern')),
  content TEXT NOT NULL,
  source_session TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  relevance_score REAL NOT NULL DEFAULT 1.0,
  access_count INTEGER NOT NULL DEFAULT 0
);
```

### Current State (as of 2026-03-21)

| Metric | Value |
|--------|-------|
| Total entries | 644 |
| Distinct agents | 48 |
| Learning entries | 540 (84%) |
| Decision entries | 104 (16%) |
| Other categories (preference, domain_knowledge, error_pattern) | **0** |
| Entries with access_count > 0 | **0** (none ever recalled with touch) |
| Entries older than 7 days | **0** (all migrated on 2026-03-20) |
| Average content length | ~500-13,000 chars (huge variance) |

### How Populated

**Two sources:**

1. **Bulk migration from v1** — All 644 entries were created on `2026-03-20 02:51:47` (same second), meaning they were batch-imported from old `.squad/agents/*/history.md` files. Content includes raw v1 history with `\r\n` line endings, full session logs, knowledge bases, and rumor watches[^14].

2. **Auto-stored after each `runner.run()`** — Line 391 of runner.ts always stores a learning entry with content `"Completed {task summary} for {article}"` with relevance 0.8[^15]. These are low-value breadcrumbs.

### How Recalled (or not)
`AgentRunner.run()` calls `this.memory.recall(agentName, { limit: 10 })` which queries top 10 entries by `relevance_score DESC, created_at DESC`[^16]. However:
- **`touch()` is never called** — the recall operation doesn't boost accessed entries, so relevance scores never change from initial values.
- **No search/filtering** — recall gets the top 10 by score regardless of the current task context.
- **Huge entries dominate** — migrated v1 entries with 13K chars each consume massive context window space for minimal value.

### How Edited/Deleted
**No UI exists.** The `AgentMemory` class exposes:
- `store()` — add entries
- `prune()` — delete expired/low-relevance entries
- `decay()` — multiplicatively reduce relevance scores
- `touch()` — boost relevance + increment access_count

But none of these are exposed via any dashboard route or CLI command[^17].

### Current Issues
1. **Zero entries have been accessed** — `access_count = 0` for all 644 entries, meaning `touch()` has never been called.
2. **Only 2 of 5 categories used** — No `preference`, `domain_knowledge`, or `error_pattern` entries exist.
3. **Migrated content is raw v1 history** — Full session logs, markdown tables, `\r\n` line endings — not structured knowledge.
4. **Auto-stored entries are low signal** — "Completed Review the article draft" repeated for every run.
5. **No pruning has ever occurred** — 644 entries, zero pruned.
6. **No decay has ever run** — all scores are initial values (0.5-1.0).
7. **No dashboard visibility** — can't browse, search, edit, or delete entries.

---

## Component 4: Legacy .squad/ Directory

### What It Is
v1 agent history and orchestration system. Located at repo root `.squad/`[^18].

### Current Contents
```
.squad/
├── agents/bobbie/history.md      (v1 agent history)
├── agents/scribe/history.md      (v1 agent history)
├── decisions/inbox/.gitkeep      (empty inbox)
├── log/2026-03-20T194151Z-edge-cases.md
└── orchestration-log/2026-03-20T194151Z-bobbie.md
```

### How Used
**Not used by v2 at all.** The AgentRunner only reads from `~/.nfl-lab/agents/` (charters, skills, memory.db). The `.squad/` directory is a v1 artifact that should be archived or cleaned up.

### Current Issues
- Skills like `knowledge-propagation.md` still reference `.squad/knowledge/inbox/` which doesn't exist.
- `bobbie` and `scribe` history.md files are stale v1 session logs.
- Should be archived to v1-archive branch or deleted.

---

## How Knowledge Flows Through the Pipeline

```
Stage 1: Generate Idea
  └─ runner.run({ agentName: 'lead', skills: ['idea-generation'] })
     └─ Recalls top 10 lead memories → composeSystemPrompt → LLM
     └─ Auto-stores: "Completed Generate article idea for..."

Stage 2: Compose Panel
  └─ composePanel() uses runner to pick agents for the panel
     └─ Injects pinned agents as required participants
     └─ Does NOT use fact-checking skill

Stage 3: Run Discussion
  └─ runner.run() for each panelist
     └─ Each panelist recalls their own top 10 memories
     └─ Each auto-stores a learning entry after completing

Stage 4: Write Draft
  └─ runner.run({ agentName: 'writer', skills: ['substack-article'] })
     └─ Writer recalls top 10 writer memories
     └─ Does NOT invoke fact-checking

Stage 5: Editor Pass
  └─ runner.run({ agentName: 'editor', skills: ['editor-review'] })

Stage 6: Publisher Pass
  └─ runner.run({ agentName: 'publisher', skills: ['publisher'] })
```

**Key observation:** Every agent invocation stores a learning but the stored content is generic ("Completed X"). The real domain knowledge (team data, cap figures, roster info) is only in the migrated v1 entries, which have no dates, sources, or freshness tracking.

---

## What Needs Fixing

### P0: Critical
1. **Memory Browser UI** — Can't see, search, edit, or delete memory entries
2. **Prune stale/migrated data** — 644 entries of bulk-migrated v1 content with no freshness dates
3. **Stop storing useless auto-learnings** — "Completed X" entries add no value

### P1: Important
4. **Update stale skills** — `knowledge-propagation.md`, `knowledge-recording.md`, `history-maintenance.md` reference v1 patterns
5. **Wire fact-checking into pipeline** — Skill exists but is never invoked
6. **Knowledge refresh mechanism** — Process to update team agent knowledge via web data sources (MCP tools already exist for OTC, Spotrac, nflverse, PFR)
7. **Archive .squad/** — Remove or archive v1 artifacts

### P2: Enhancement
8. **Structured domain_knowledge entries** — Replace raw history dumps with typed, dated, sourced knowledge entries
9. **Memory relevance tuning** — Call `touch()` when memories are actually useful, run `decay()` periodically
10. **Charter knowledge versioning** — Track changes to charters over time

---

## Implementation Plan

### Phase 1: Memory Browser (IN PROGRESS — background agent building)
- Add `/memory` page to dashboard with search, filter, CRUD operations
- Add memory section to agent detail pages
- Expose prune/decay controls
- Add nav link

### Phase 2: Clean Up Stale Data
1. **Prune migrated v1 entries** — Run `memory.prune({ maxAge: 1, minRelevance: 0.3 })` or add a manual "Purge v1 Data" button that deletes entries from `2026-03-20 02:51:47` batch
2. **Update stale skills:**
   - `knowledge-propagation.md` → Rewrite to use memory.db pattern (store cross-agent knowledge as `domain_knowledge` category)
   - `knowledge-recording.md` → Rewrite to describe memory.db storage format with freshness timestamps in content
   - `history-maintenance.md` → Rewrite to describe memory.db pruning/decay (the `prune()` and `decay()` methods)
3. **Archive .squad/** — Move to v1-archive branch or delete
4. **Fix auto-learning quality** — In `runner.ts:391`, store a useful summary of the actual output (not just "Completed X")

### Phase 3: Knowledge Refresh Process
1. **Add "Refresh Knowledge" action** per agent — Uses existing MCP tools:
   - Team agents → `query_team_efficiency`, `query_snap_counts`, `query_pfr_defense` for current stats
   - Cap agent → OTC/Spotrac data tools for cap numbers
   - Draft agent → `query_draft_history`, `query_combine_profile`
2. **Fact-checker integration** — Add fact-checking as a skill loaded during Stage 4→5 transition:
   - After panel discussion, before writer draft
   - Invoke runner with `skills: ['fact-checking']` and panel output as context
   - Store fact-check results as artifact (`panel-factcheck.md`)
3. **Staleness detection** — Add `last_verified_at` concept to domain_knowledge entries
   - On recall, surface entries that haven't been verified in >7 days
   - Dashboard shows "stale knowledge" badge on agent cards

### Phase 4: Structured Knowledge Entries
1. **Replace raw text blobs** with structured entries:
   ```
   category: domain_knowledge
   content: JSON { type: 'roster'|'cap'|'coaching'|'draft', team: 'SEA', data: {...}, source: 'overthecap.com', verifiedAt: '2026-03-21' }
   ```
2. **Web refresh workflow:** Dashboard button → MCP tool call → parse response → store as domain_knowledge → prune old entry
3. **Periodic decay** — On dashboard startup, run `decay()` for all agents with factor 0.95

---

## Confidence Assessment

| Finding | Confidence |
|---------|------------|
| Memory entries are bulk-migrated v1 data | **High** — all 644 created at identical timestamp |
| Zero entries have been recalled with touch() | **High** — access_count=0 for all rows |
| Skills reference v1 patterns that don't exist | **High** — verified .squad/knowledge/inbox/ doesn't exist |
| Fact-checking skill is never invoked in pipeline | **High** — grep confirmed no `skills: ['fact-checking']` in actions.ts |
| .squad/ is unused by v2 | **High** — no imports reference .squad paths |
| Auto-stored learnings are low value | **High** — sampled entries show generic "Completed X" text |

---

## Footnotes

[^1]: `src/agents/runner.ts:96-141` — `parseCharter()` function
[^2]: `~/.nfl-lab/agents/charters/nfl/` — 48 .md files (verified via directory listing)
[^3]: `src/dashboard/server.ts:1776-1784` — PUT `/api/agents/:name` route
[^4]: `src/agents/runner.ts:319-349` — `run()` method: loadCharter → composeSystemPrompt
[^5]: `src/agents/runner.ts:152-187` — `parseSkillFile()` function
[^6]: `~/.nfl-lab/agents/skills/` — 24 .md files
[^7]: `src/dashboard/server.ts:1766-1774` — PUT `/api/agents/skills/:name` route
[^8]: `src/agents/runner.ts:294-299` — Skills injected into system prompt
[^9]: `~/.nfl-lab/agents/skills/knowledge-propagation.md` — References `.squad/knowledge/inbox/` pattern
[^10]: `~/.nfl-lab/agents/skills/knowledge-recording.md` — Describes `history.md` file structure
[^11]: `~/.nfl-lab/agents/skills/history-maintenance.md` — Retention policy for history.md files
[^12]: `src/pipeline/actions.ts` — No stage action passes `skills: ['fact-checking']`
[^13]: `src/agents/memory-schema.sql:1-14` — Table definition
[^14]: Memory DB query: all 644 entries have `created_at = '2026-03-20 02:51:47'`
[^15]: `src/agents/runner.ts:387-396` — Auto-store learning after every run
[^16]: `src/agents/runner.ts:346` — `this.memory.recall(agentName, { limit: 10 })`
[^17]: `src/agents/memory.ts:92-246` — Full AgentMemory class API
[^18]: `.squad/` directory at repo root
