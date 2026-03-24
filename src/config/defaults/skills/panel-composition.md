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

| Depth Level | Min | Default | Max | Rationale |
|-------------|-----|---------|-----|-----------|
| 1 — Casual Fan | 2 | **2** | **2** | Narrative-first; 2 agents produce enough tension without cap-nerd detail |
| 2 — The Beat | 3 | **3** | **4** | Default to 3; only expand when the article truly needs a fourth lane |
| 3 — Deep Dive | 4 | **4** | **5** | Default to 4; fifth seat is optional for unusually broad topics |

**Default to the middle lane, not the ceiling.** A Level 2 article should usually run with 3 panelists, not 4. A Level 3 article should usually run with 4 panelists, not 5.

## Selection Rules

1. **Always include the relevant team agent** for the primary team — they ground the discussion in roster and competitive reality.
2. **Always include at least one specialist** — pure team-agent panels produce fan-level analysis.
3. **Panel size must respect the depth level limits above.**
4. **Each panelist must have a distinct analytical lane** — overlap between Cap and PlayerRep is fine (negotiation counterpoints); overlap between two team agents is usually wasteful.
5. **Only select agents from the Available Agents roster** — never invent agent names.

## Panel Composition Matrix

| Article Type | Default Recipe | Expand Only If Needed |
|-------------|----------------|------------------------|
| Contract extension / FA signing | Team Agent + Cap + PlayerRep | Add Analytics or Offense/Defense for Deep Dive |
| Draft pick evaluation | Team Agent + Draft + CollegeScout | Add Analytics or Offense/Defense for Deep Dive |
| Trade evaluation | Team Agent + Cap + PlayerRep | Add second Team Agent or Analytics when both sides matter |
| Coaching/scheme analysis | Team Agent + Offense/Defense + Analytics | Add opposite side of the ball for Deep Dive |
| Roster construction strategy | Team Agent + Cap + Analytics | Add Offense/Defense for Deep Dive |
| Position market analysis | Team Agent + Cap + Analytics | Add PlayerRep or Offense/Defense when leverage or usage matters |

## Deterministic Bias

- Prefer the default recipes above when they satisfy the article.
- Only ask Lead to improvise a wider panel when the prompt clearly needs a non-standard lane.
- Pinned agents still win: include required agents first, then fill remaining seats with the smallest coherent recipe.

## Output Format

Return a markdown list of selected panelists with their role and focus lane:

```markdown
## Panel

- **SEA** — Seahawks team context: roster gaps, competitive window, cap position
- **Cap** — Salary cap analysis: market comps, contract structure, cap impact
- **PlayerRep** — Player valuation: production metrics, market leverage, deal timing
```

Each entry must reference a real agent name from the provided roster.
