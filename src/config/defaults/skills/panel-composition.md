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

## Panel Size Guidance by Shape / Form

| Panel Shape / Form | Min | Max | Rationale |
|--------------------|-----|-----|-----------|
| `news_reaction` or brief explainer | 2 | **2** | Fast, reader-friendly, low-overhead analysis |
| `auto` + standard/feature | 3 | **4** | Balanced coverage; features stay broader without forcing a max-size panel |
| `contract_eval` / `draft_eval` / `scheme_breakdown` | 3 | **4** | Specialist-heavy, but usually still focused |
| `trade_eval` / `cohort_rank` / `market_map` | 4 | **5** | Multi-perspective or cross-team shapes need wider representation |
| `auto` + deep | 4 | **5** | Deep technical analysis can justify the fullest panel |

**Do not exceed these limits.** Treat article form as an editorial goal and panel shape / explicit constraints as the orchestration driver.

## Selection Rules

1. **Include the relevant team agent** for the primary team unless panel shape or explicit constraints say a cross-team / cohort frame is better.
2. **Always include at least one specialist** — pure team-agent panels produce fan-level analysis.
3. **Panel size must respect the panel-shape / constraint limits above.**
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
