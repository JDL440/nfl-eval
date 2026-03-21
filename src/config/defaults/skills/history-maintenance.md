---
name: "history-maintenance"
description: "How to maintain memory.db health — decay, pruning, touch/boost, and the Memory Browser dashboard"
domain: "knowledge-management"
confidence: "high"
source: "v2-rewrite"
tools: ["AgentMemory"]
---

# History Maintenance — Skill

## Purpose

Agent knowledge in `memory.db` accumulates over time. Without maintenance, old entries
crowd out fresh knowledge, relevance scores go stale, and the store grows unbounded.
This skill defines the three maintenance operations — **decay**, **prune**, and
**touch** — plus the dashboard Memory Browser for manual management.

## Why This Exists

At spawn, each agent receives its **top 10 entries by relevance_score**. If old entries
retain high scores indefinitely, they'll block newer, more relevant knowledge from
appearing in the agent's `## Relevant Context`. Maintenance ensures the most useful
knowledge always surfaces.

---

## Maintenance Operations

### 1. Decay — Gradual Relevance Reduction

```typescript
memory.decay(agentName: string, factor?: number): number
```

**What it does:** Multiplies every entry's `relevance_score` by `factor` for the
specified agent. Returns the count of affected rows.

**Default factor:** `0.95` (5% reduction per cycle)

**Example:**
```typescript
// After article publish, decay cap agent's memories
const affected = memory.decay('cap', 0.95);
// Entry with score 1.0 → 0.95 → 0.9025 → 0.857... over successive cycles
```

**When to run:**
- After every article publish for all participating agents
- During scheduled maintenance windows
- When an agent's recall results feel stale or irrelevant

**Effect over time:**

| Cycles | Score (starting 1.0) |
|--------|---------------------|
| 1 | 0.950 |
| 5 | 0.774 |
| 10 | 0.599 |
| 20 | 0.358 |
| 30 | 0.215 |

Entries that aren't reinforced via `touch()` naturally fade, making room for
fresh knowledge.

---

### 2. Prune — Delete Expired and Low-Relevance Entries

```typescript
memory.prune(options?: PruneOptions): number
```

**What it does:** Permanently deletes entries that have expired (`expires_at` in the
past) or fallen below the minimum relevance threshold. Returns count deleted.

**Default options:**
```typescript
{
  maxAge: 90,          // days — entries older than 90 days AND below minRelevance
  minRelevance: 0.1,   // floor — anything below this is noise
}
```

**Example:**
```typescript
// Standard prune — remove expired + low-relevance entries
const deleted = memory.prune({ maxAge: 90, minRelevance: 0.1 });
console.log(`Pruned ${deleted} stale entries`);

// Aggressive prune for a bloated store
const deleted = memory.prune({ maxAge: 60, minRelevance: 0.2 });
```

**When to run:**
- Weekly scheduled maintenance (recommended: Monday morning)
- When memory.db exceeds target size
- Before major research sessions to clear stale context

**What gets pruned:**
- Entries where `expires_at < now()` (regardless of relevance)
- Entries where `created_at` is older than `maxAge` days AND `relevance_score < minRelevance`
- Entries that have decayed below the floor are natural prune candidates

---

### 3. Touch — Boost Frequently-Used Entries

```typescript
memory.touch(id: number, boost?: number): void
```

**What it does:** Increments the entry's `access_count` and adds `boost` to its
`relevance_score`. Score is **capped at 2.0** to prevent runaway inflation.

**Default boost:** `0.1`

**Example:**
```typescript
// Agent used a cap fact in its analysis — boost it
memory.touch(entryId, 0.1);
// Score: 0.8 → 0.9

// Critical fact referenced multiple times — larger boost
memory.touch(entryId, 0.2);
// Score: 0.9 → 1.1 (above initial 1.0 — this is the "earned" range)
```

**When to use:**
- When an agent explicitly references a memory entry in its output
- When a recalled entry proves useful during analysis
- To "pin" important entries that should resist decay

**Score ranges after touch:**

| Range | Meaning |
|-------|---------|
| 0.0–0.3 | Decayed, near prune threshold |
| 0.3–0.7 | Normal, aging naturally |
| 0.7–1.0 | Fresh or recently boosted |
| 1.0–1.5 | Frequently accessed, high value |
| 1.5–2.0 | Critical knowledge, heavily used (cap at 2.0) |

---

## Maintenance Schedule

### After Every Article Publish

For all agents that participated in the article:

```typescript
for (const agentName of panelAgents) {
  memory.decay(agentName, 0.95);
}
```

### Weekly Maintenance (Recommended: Monday)

```typescript
// Global prune — all agents
const pruned = memory.prune({ maxAge: 90, minRelevance: 0.1 });

// Check store health
const stats = memory.stats();
for (const agent of stats) {
  console.log(`${agent.agentName}: ${agent.count} entries, avg relevance ${agent.avgRelevance.toFixed(2)}`);
}
```

### On Demand

Use the **Dashboard Memory Browser** at `/memory` for manual management.

---

## Dashboard Memory Browser

The Memory Browser at `/memory` provides a visual interface for managing memory.db:

- **Browse:** View all entries filtered by agent, category, or relevance range
- **Search:** Full-text search across all memory content
- **Touch/Boost:** Click to boost an entry's relevance score
- **Delete:** Remove individual entries that are incorrect or outdated
- **Stats:** Per-agent entry counts and average relevance scores
- **Category badges:** Color-coded tags for learning, decision, preference, domain_knowledge, error_pattern

Use the browser for:
- Spot-checking what agents "know" before a research session
- Manually removing incorrect entries that haven't decayed yet
- Verifying that maintenance is keeping the store healthy

---

## Health Targets

| Metric | Healthy | Warning | Action |
|--------|---------|---------|--------|
| Total entries per agent | < 200 | 200–500 | Run aggressive prune |
| Avg relevance per agent | 0.4–0.8 | < 0.3 | Entries are too decayed — add fresh knowledge |
| Avg relevance per agent | 0.4–0.8 | > 0.9 | Decay isn't running — check schedule |
| Expired entries | 0 | > 10 | Prune hasn't run recently |

---

## Anti-Patterns

- **DO NOT skip decay after article publish** — Scores will inflate and old knowledge will crowd out new
- **DO NOT set minRelevance too high when pruning** — 0.2+ will delete entries that are still useful after a few decay cycles
- **DO NOT touch entries indiscriminately** — Only boost entries that were actually used, not everything recalled
- **DO NOT manually edit memory.db with raw SQL** — Use the AgentMemory API or Dashboard Browser to maintain consistency

## Related Skills

- [knowledge-recording](knowledge-recording.md) — How to store new knowledge entries
- [knowledge-propagation](knowledge-propagation.md) — How knowledge flows between agents
