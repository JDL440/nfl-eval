---
name: "knowledge-recording"
description: "How agents record structured knowledge to memory.db — the store API, categories, freshness conventions, and best practices"
domain: "knowledge-management"
confidence: "high"
source: "v2-rewrite"
tools: ["AgentMemory"]
---

# Knowledge Recording — Skill

## Purpose

Every agent produces knowledge during its work: research findings, cap numbers, roster
changes, analytical insights. In v2, all knowledge is recorded to **memory.db** via
the `AgentMemory.store()` API — replacing the v1 pattern of writing to per-agent
`history.md` files.

This skill defines how to structure, tag, and timestamp knowledge so it is maximally
useful when recalled by any agent in future sessions.

## The Store API

```typescript
memory.store({
  agentName: string,          // who produced this knowledge
  category: MemoryCategory,   // one of 5 categories (see below)
  content: string,            // the knowledge itself — structured text
  relevanceScore?: number,    // 0.0–2.0, default 1.0
  expiresAt?: string,         // ISO date — null means no expiry
});
```

Returns the inserted row ID. All entries are automatically timestamped (`created_at`).

## Memory Categories

Choose the right category — it determines how entries are filtered and ranked at recall:

| Category | When to Use | Example |
|----------|------------|---------|
| `learning` | Facts/insights extracted from research or analysis | "✅ SEA run rate in red zone: 72% (2025 reg season, nflverse)" |
| `decision` | Past decisions, recommendations, and their outcomes | "Recommended 3-year extension for Witherspoon — Editor approved" |
| `preference` | Style, tone, formatting preferences discovered through feedback | "Editor prefers EPA tables as rendered images, not raw markdown" |
| `domain_knowledge` | Verified subject matter expertise, reference facts | "✅ Trey McBride extension: 4yr/$56M, $34M GTD (OTC, 2025-03-15)" |
| `error_pattern` | Common mistakes to avoid in future work | "OTC and Spotrac cap numbers differ by Top 51 — always cite which source" |

## Data Freshness Conventions

Every stored content string MUST include freshness metadata. Use these markers:

| Level | Tag | Meaning | Example |
|-------|-----|---------|---------|
| High | `✅` | Official source, verified, current | "✅ Cap space: $41.7M (OTC, 2025-03-12)" |
| Medium | `📊` | Derived or calculated, likely accurate | "📊 Team needs CB2 based on depth chart analysis" |
| Low | `❓` | Inferred, possibly outdated | "❓ Scheme may shift under new OC (no official confirmation)" |
| Rumor | `⚠️ RUMOR` | Unverified report | "⚠️ RUMOR: Team exploring trade for WR1 (beat reporter, 2025-03-10)" |

### Timestamp Format

Always include source and date in the content string:

```
✅ Total Cap Space: $41,678,185 (OTC, 2025-03-12)
📊 Effective Cap Space: ~$30.2M after Top 51 adjustment (calculated, 2025-03-12)
⚠️ RUMOR: Interest in signing veteran CB (beat reporter, 2025-03-08)
```

When multiple sources disagree, record both:

```
✅ Cap Space: $41.7M (OTC) / $38.4M (Spotrac Top 51) — fetched 2025-03-12
   Note: OTC = raw cap space; Spotrac = Top 51 adjusted
```

### Rumor Lifecycle

Track rumor status in the content string:

- 🔵 **Active** — recent, has supporting signals
- ⚪ **Stale** — no updates in 48+ hours
- ✅ **Resolved** — confirmed or denied
- 🔴 **Dead** — proven false

Update rumor entries by storing a new memory with the updated status (old entry
will naturally decay in relevance).

## Best Practices

### 1. Timestamped Content

Every entry's `content` should be self-contained with its own date and source:

```typescript
memory.store({
  agentName: 'sea',
  category: 'domain_knowledge',
  content: '✅ Seahawks 2025 draft picks: R1P5, R2P37, R3P69, R4P108, R5P155, R7P230 (OTC, 2025-03-15)',
  relevanceScore: 0.9,
});
```

### 2. Confidence via Relevance Score

Map confidence to `relevanceScore`:

| Confidence | Score | When |
|-----------|-------|------|
| Verified fact | 0.8–1.0 | Official source, cross-checked |
| Calculated/derived | 0.5–0.7 | Your analysis, reasonable inference |
| Speculative | 0.3–0.4 | Rumor, unverified, single source |
| Correction | 0.9–1.0 | Corrects a prior error (high so it outranks the wrong entry) |

### 3. Cross-References

When knowledge relates to another agent's domain, include the agent name:

```typescript
memory.store({
  agentName: 'cap',
  category: 'domain_knowledge',
  content: '📌 [cross-ref: sea] Seahawks restructuring DK Metcalf — creates $12M space (OTC, 2025-03-15)',
  relevanceScore: 0.85,
});
```

The `[cross-ref: sea]` tag helps with `recallGlobal({ search: 'sea' })` queries.

### 4. Expiration for Time-Sensitive Data

Set `expiresAt` for data that will go stale:

```typescript
// Pre-draft projections expire after the draft
memory.store({
  agentName: 'draft',
  category: 'domain_knowledge',
  content: '📊 Mock consensus: SEA takes EDGE at R1P5 (aggregated 2025-04-20)',
  expiresAt: '2025-04-30',  // expires after draft
});
```

### 5. Structured Content for Complex Data

For multi-field data (cap tables, roster snapshots), use a compact structured format:

```typescript
memory.store({
  agentName: 'sea',
  category: 'domain_knowledge',
  content: [
    '✅ SEA Cap Situation (OTC, 2025-03-12):',
    '  Total Cap: $41.7M | Effective: $30.2M | Dead: $23.3M',
    '  Top hits: Wilson $35M, Metcalf $28M, Adams $17M',
    '  Restructure candidates: Metcalf (convert $18M base → bonus)',
  ].join('\n'),
  relevanceScore: 0.9,
});
```

## Anti-Patterns

- **DO NOT store without freshness markers** — Content without ✅/📊/❓/⚠️ and dates has unknown reliability
- **DO NOT store raw web_fetch output** — Parse, summarize, and structure before storing
- **DO NOT duplicate existing entries** — Use `recallGlobal({ search: '...' })` to check first
- **DO NOT skip the confidence tag** — Every stored fact needs a freshness marker
- **DO NOT store ephemeral status** — "Starting research now" is not knowledge
- **DO NOT use relevanceScore > 1.0 at store time** — Scores above 1.0 are reserved for `touch()` boosts on frequently-accessed entries

## Examples

### New team agent first research session

```typescript
// 1. Fetch and store cap data
memory.store({
  agentName: 'ari',
  category: 'domain_knowledge',
  content: '✅ ARI Cap Space: $41.7M (OTC, 2025-03-12) | Dead: $23.3M | Top hit: Murray $52.7M',
  relevanceScore: 0.9,
});

// 2. Store a team need derived from analysis
memory.store({
  agentName: 'ari',
  category: 'learning',
  content: '📊 ARI top need: CB2 — only 2 CBs under contract for 2025, thin depth after Johnson departure',
  relevanceScore: 0.7,
});

// 3. Flag a rumor
memory.store({
  agentName: 'ari',
  category: 'domain_knowledge',
  content: '⚠️ RUMOR: ARI exploring trade for elite pass rusher (Schefter, 2025-03-10) — 🔵 Active',
  relevanceScore: 0.4,
  expiresAt: '2025-03-20',  // stale if not confirmed in 10 days
});
```

## Related Skills

- [knowledge-propagation](knowledge-propagation.md) — How knowledge flows between agents via memory.db
- [history-maintenance](history-maintenance.md) — Decay, pruning, and relevance management
