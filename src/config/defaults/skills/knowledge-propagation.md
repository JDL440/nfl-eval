---
name: "knowledge-propagation"
description: "How agents share knowledge across the squad via memory.db — the store/recall pattern for cross-agent context"
domain: "knowledge-management"
confidence: "high"
source: "v2-rewrite"
tools: ["AgentMemory"]
---

# Knowledge Propagation — Skill

> **MANDATORY READ:** All agents must read this before starting work.

## Purpose

Agents discover information that other agents need: cap implications for the cap
specialist, roster moves for team agents, scheme changes for the offense analyst.
In v2, all cross-agent knowledge flows through **memory.db** — a shared SQLite store
that every agent reads from and writes to via the `AgentMemory` API.

No more file-based inboxes. No more drop files. One shared memory store, queryable
by any agent at spawn time.

## How It Works

### Storage: `memory.db`

All agent knowledge lives in `~/.nfl-lab/agents/memory.db`. The `AgentMemory` class
provides the API:

```typescript
import { AgentMemory } from '../agents/memory';
const memory = new AgentMemory(config.memoryDbPath);
```

### Sharing Knowledge: `store()`

When you discover something another agent (or your future self) needs to know, store it:

```typescript
memory.store({
  agentName: 'cap',           // who produced this knowledge
  category: 'domain_knowledge',
  content: '📌 Cowboys restructuring Dak Prescott contract — frees $18M cap space (OTC, 2025-03-15)',
  relevanceScore: 0.9,        // how important (0.0–2.0, default 1.0)
  expiresAt: '2025-09-01',    // optional TTL — null = no expiry
});
```

### Receiving Knowledge: Memory Injection

At spawn, each agent automatically receives relevant context. The runner calls:

```typescript
const memories = memory.recall(agentName, { limit: 10 });
```

The **top 10 entries by relevance_score** (descending, then by recency) are injected
into the agent's system prompt as:

```markdown
## Relevant Context
- [domain_knowledge] Cowboys restructuring Dak contract — frees $18M cap space
- [learning] EPA per play is key metric for efficiency analysis
- [preference] Prefer active voice in article drafts
```

This means every agent sees the most relevant knowledge from across the squad —
without needing to read other agents' files.

## Memory Categories

Use the right category so recall filtering works correctly:

| Category | When to Use | Example |
|----------|------------|---------|
| `learning` | Facts/insights extracted from analysis | "Seahawks run-heavy in red zone (72% run rate)" |
| `decision` | Past decisions and their outcomes | "Used 4-3 base defense framing for SEA article" |
| `preference` | Style, tone, formatting preferences | "Editor prefers bullet lists over prose for cap tables" |
| `domain_knowledge` | Subject matter expertise, verified facts | "Trey McBride extension: 4yr/$56M, $34M GTD" |
| `error_pattern` | Common mistakes to avoid | "OTC and Spotrac cap numbers differ — always cite source" |

## When to Store Cross-Agent Knowledge

### Always store a memory when:

1. **You learn something about another agent's domain**
   - Cap agent discovers a roster move → store with category `domain_knowledge`
   - Any agent can recall it at next spawn

2. **You find stale or incorrect information in prior context**
   - Store a correction as `learning` with high relevance (0.9+)
   - The corrected fact will outrank the stale one in future recall

3. **A decision has downstream implications**
   - Store as `decision` so future agents see the ripple effects

4. **You notice a recurring mistake**
   - Store as `error_pattern` so all agents learn from it

### Do NOT store:

- Raw web_fetch output (parse and summarize first)
- Duplicate information already in memory (check with `recallGlobal` first)
- Ephemeral status updates ("I'm starting research now")

## Cross-Agent Recall

Any agent can query the full memory store for another agent's knowledge:

```typescript
// Get cap agent's domain knowledge
const capKnowledge = memory.recall('cap', {
  category: 'domain_knowledge',
  limit: 5,
});

// Search across ALL agents for a topic
const tradeRumors = memory.recallGlobal({
  search: 'trade rumor',
  limit: 10,
});
```

## Why This Matters

The memory.db pattern replaces v1's file-based knowledge inbox:

| v1 Pattern | v2 Pattern |
|-----------|-----------|
| `.squad/knowledge/inbox/{agent}-{slug}.md` | `memory.store({ ... })` |
| `.squad/agents/{name}/history.md` | `memory.recall(agentName)` |
| Scribe processes inbox manually | Automatic injection at spawn |
| Knowledge siloed in files | Shared, queryable, ranked by relevance |

Knowledge is no longer siloed. Every agent benefits from every other agent's
discoveries — automatically, ranked by relevance, with zero manual routing.
