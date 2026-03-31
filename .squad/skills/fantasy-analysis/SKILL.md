---
name: Fantasy Football Analysis Framework
domain: Fantasy, Data, Content
confidence: 0.85
description: Scoring systems, evaluation methodology, data queries, and article templates for fantasy football content.
tags: [fantasy, scoring, rankings, dynasty, redraft, PPR, waiver-wire, start-sit]
---

# Fantasy Football Analysis Framework

## Problem

The NFL Lab platform produces analytical content from a front-office perspective (EPA, cap, scheme), but the largest NFL content audience — 60+ million fantasy football players — needs that analysis translated through a fantasy scoring lens. Without a structured framework, fantasy analysis risks being either too casual (hot takes) or too detached from the analytical rigor that defines NFL Lab.

## Solution

A repeatable framework for producing fantasy football content that leverages existing front-office analytics while adding fantasy-specific metrics, dual-lens evaluation (redraft + dynasty), and audience-appropriate formatting.

---

## Scoring Systems Reference

### Standard Scoring
| Category | Points |
|----------|--------|
| Passing TD | 4 |
| Passing Yard | 0.04 (1 per 25) |
| Interception | -2 |
| Rushing/Receiving TD | 6 |
| Rushing/Receiving Yard | 0.1 (1 per 10) |
| Fumble Lost | -2 |

### PPR (Points Per Reception)
Same as standard, plus **1 point per reception**.

### Half-PPR
Same as standard, plus **0.5 points per reception**.

### Dynasty Superflex
PPR scoring with **a second flex spot that allows QBs**, dramatically increasing QB value.

### Best-Ball
PPR scoring, but lineups are auto-optimized — rewards ceiling over floor.

### DFS (Daily Fantasy)
Platform-specific (DraftKings, FanDuel) with salary constraints. Prioritize stacking and leverage.

---

## Evaluation Framework

### Dual-Lens Protocol

Every player evaluation must include both lenses:

1. **Redraft Lens** — This season only. What is the expected fantasy output for the remaining schedule?
   - Weekly PPG projection
   - Floor / ceiling range
   - Strength of remaining schedule
   - Injury risk assessment

2. **Dynasty Lens** — Multi-year asset valuation.
   - Age and career trajectory (age curves by position)
   - Contractual situation (years remaining, cap hit)
   - Opportunity trajectory (coaching staff, depth chart)
   - Rookie pick equivalence (e.g., "worth a mid-1st")

### Key Metrics

| Metric | Source | Fantasy Relevance |
|--------|--------|-------------------|
| Fantasy Points (std/PPR/half) | `query_fantasy_stats` | Direct scoring output |
| PPG + Std Dev | `query_fantasy_stats` | Consistency evaluation |
| Floor/Ceiling rate | `query_fantasy_stats` | Risk profile |
| Target Share | `query_player_stats` | Opportunity proxy (WR/TE) |
| Air Yards Share | `query_player_stats` | Target quality proxy |
| Snap Count % | `query_snap_counts` | Usage stability |
| Red Zone Targets/Carries | play-by-play (future) | TD upside proxy |
| Rushing Attempts Inside 5 | play-by-play (future) | Goal-line usage |
| EPA per Play | `query_player_stats` | Efficiency (context for scoring) |

### Positional Scarcity Tiers

Fantasy value is relative to replacement level. Use these tier benchmarks:

| Position | Elite (Top 3) | Strong (4-8) | Starter (9-12) | Streamable (13-20) |
|----------|---------------|---------------|-----------------|---------------------|
| QB | 22+ PPG | 19-22 PPG | 16-19 PPG | < 16 PPG |
| RB | 18+ PPG | 14-18 PPG | 11-14 PPG | < 11 PPG |
| WR | 18+ PPG | 14-18 PPG | 11-14 PPG | < 11 PPG |
| TE | 14+ PPG | 10-14 PPG | 7-10 PPG | < 7 PPG |

*(PPR scoring. Adjust thresholds down ~2 PPG for standard.)*

---

## Data Query Templates

### Individual Player Fantasy Profile
```
Tool: query_fantasy_stats
Args: { player: "Amon-Ra St. Brown", season: 2025, scoring: "ppr" }
Returns: PPG, consistency metrics, floor/ceiling rates, opportunity data
```

### Positional Rankings
```
Tool: query_fantasy_stats
Args: { position: "WR", season: 2025, scoring: "ppr", top: 20 }
Returns: Ranked list with total points, PPG, std dev, floor%, ceiling%
```

### Supporting Context (EPA + Efficiency)
```
Tool: query_player_stats
Args: { player: "Amon-Ra St. Brown", season: 2025 }
Returns: EPA, target share, air yards share, receiving stats
```

### Usage Stability Check
```
Tool: query_snap_counts
Args: { player: "Amon-Ra St. Brown", season: 2025 }
Returns: Snap percentages, trend over recent weeks
```

---

## Panel Integration Protocol

When Fantasy participates in a multi-agent article panel:

1. **Read the article prompt** — Identify which players/transactions are being discussed
2. **Run fantasy queries** — Use `query_fantasy_stats` + `query_player_stats` for each key player
3. **Apply dual lens** — State both redraft and dynasty impact
4. **Quantify claims** — "This makes Player X a borderline WR1 in PPR (projected 15.2 PPG → 17.1 PPG)"
5. **Identify disagreements** — Flag where fantasy value diverges from front-office value
   - Example: "Cap says this is a good signing for the team, but Fantasy sees no fantasy upside — the new contract doesn't change targets or usage"

### Cross-Agent Tension Points

| Front-Office View | Fantasy Translation |
|--------------------|--------------------|
| Team improved their OL | RB floor rises; passing volume may shift |
| WR signed big extension | Dynasty hold — locked in. Redraft neutral (production was already priced in) |
| QB traded to new team | Reset all WR/TE projections for both teams |
| Draft pick used on RB | Incumbent RB loses dynasty value; immediate redraft impact depends on camp |
| Coordinator change | Evaluate scheme fit for fantasy archetypes |

---

## Article Format Templates

### Fantasy Rankings Article
```markdown
# {Position} Fantasy Rankings — Week {N} ({Scoring Format})

*{1-2 sentence overview of major changes this week}*

## Tier 1: Elite
| Rank | Player | Team | PPG | Matchup | Verdict |
...

## Tier 2: Strong Starters
...

## Tier 3: Flex Plays
...

## Risers 📈
- **Player A** — {reason, data point}

## Fallers 📉
- **Player B** — {reason, data point}

## Deep Sleeper 💤
- **Player C** — {speculative case with data support}
```

### Waiver Wire / Start-Sit
```markdown
# Week {N} Fantasy Decisions

## Must-Start ✅
...

## Must-Sit ❌
...

## Waiver Wire Pickups
| Player | Position | % Rostered | Why |
...

## Trade Targets
| Buy Low | Sell High | Reason |
...
```

### Transaction Impact (Panel Sidebar)
```markdown
## 🏈 Fantasy Impact

**Redraft:** {1-2 sentence immediate impact}
**Dynasty:** {1-2 sentence long-term impact}
**Winners:** {comma-separated player names with brief reason}
**Losers:** {comma-separated player names with brief reason}
```

---

## Boundaries

- **Data-backed claims only** — Every ranking or projection must reference a metric
- **No gambling/betting advice** — Fantasy analysis only, not sports betting
- **Disclose uncertainty** — Use hedging language ("if target share holds", "assuming health")
- **Credit the pipeline** — Reference front-office context when translating to fantasy
- **Scoring format matters** — Always specify which scoring format applies (PPR is default, note when standard or half-PPR)
