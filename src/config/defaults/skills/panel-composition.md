---
name: panel-composition
description: Rules for selecting panel members from the agent roster
domain: orchestration
confidence: 1.0
tools: []
---

# Panel Composition — Skill

## Purpose

Defines the rules Lead follows when selecting a panel of analysts for an article discussion. The panel must be drawn from the **available agent roster** provided in the task — never invented.

## Panel Size Limits by Depth Level

| Depth Level | Min | Max | Rationale |
|-------------|-----|-----|-----------|
| 1 — Casual Fan | 2 | **2** | Narrative-first; 2 agents produce enough tension without cap-nerd detail |
| 2 — The Beat | 3 | **4** | Default; balance of depth and cost |
| 3 — Deep Dive | 4 | **5** | Full scheme/cap/draft analysis; 5 agents justified only here |

**Do not exceed these limits.** A Level 1 article with 4 agents costs the same as a Level 3 article but delivers a worse reader experience.

## Selection Rules

1. **Always include the relevant team agent** for the primary team — they ground the discussion in roster and competitive reality.
2. **Always include at least one specialist** — pure team-agent panels produce fan-level analysis.
3. **Panel size must respect the depth level limits above.**
4. **Each panelist must have a distinct analytical lane** — overlap between Cap and PlayerRep is fine (negotiation counterpoints); overlap between two team agents is usually wasteful.
5. **Only select agents from the Available Agents roster** — never invent agent names.

## Panel Composition Matrix

| Article Type | Recommended Panel |
|-------------|-------------------|
| Contract extension / FA signing | Cap + PlayerRep + Team Agent |
| Contract extension (deep-dive) | Cap + PlayerRep + Team Agent + Offense/Defense |
| Draft pick evaluation | Draft + CollegeScout + Team Agent + Offense or Defense |
| Trade evaluation | Cap + PlayerRep + Team Agent (acquiring) + Team Agent (trading) |
| Coaching/scheme analysis | Offense or Defense + Team Agent + Analytics |
| Roster construction strategy | Team Agent + Cap + Analytics |
| Position market analysis | Cap + Offense or Defense + relevant Team Agents |

## Output Format

Return a markdown list of selected panelists with their role and focus lane:

```markdown
## Panel

- **SEA** — Seahawks team context: roster gaps, competitive window, cap position
- **Cap** — Salary cap analysis: market comps, contract structure, cap impact
- **PlayerRep** — Player valuation: production metrics, market leverage, deal timing
```

Each entry must reference a real agent name from the provided roster.
