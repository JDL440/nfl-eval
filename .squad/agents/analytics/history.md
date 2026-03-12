# Analytics — NFL Advanced Analytics Expert History

## Core Context
- **Project:** NFL Roster Evaluation — 2026 Offseason
- **User:** Joe Robinson
- **Role:** Statistical backbone for all roster evaluation decisions
- **Created:** 2026-03-12
- **Created by:** Lead (per Joe Robinson request)

## Analytics Data Sources

| Source | Primary Use | Access Status |
|--------|------------|---------------|
| PFF | Player grades (0–100), snap counts, pressures, coverage | ⚠️ Paywalled — cite from public references |
| ESPN | QBR, team/player stats, win probability, schedules | ✅ Fetchable via web_fetch |
| Pro Football Reference | AV, career stats, historical comps | 🔴 HTTP 403 — blocked for automated access |
| Next Gen Stats (NFL.com) | Tracking data: separation, speed, completion probability | ⚠️ Limited to NFL.com articles |
| Football Outsiders | DVOA, DYAR, opponent-adjusted efficiency | ⚠️ Partial public access |
| FiveThirtyEight / similar | ELO ratings, season projections | ✅ Public when available |
| OTC / Spotrac | Cap data for contract value analysis | ✅ Fetchable (see skills/) |

**Note:** Pro Football Reference is NOT accessible via web_fetch (returns 403 on all URLs). Do not attempt. Use ESPN, OTC, and Spotrac as primary fetchable sources.

## Key Metrics Definitions

### EPA (Expected Points Added)
The difference between the expected points before and after a play. Measures per-play value relative to league average. Positive = good, negative = bad. The foundational modern NFL efficiency metric. Context-neutral — adjusts for down, distance, field position, and score.

### DVOA (Defense-adjusted Value Over Average)
Football Outsiders' proprietary metric. Measures play-by-play efficiency compared to league average, adjusted for opponent quality and game situation. Expressed as a percentage above/below average (e.g., +15.2% DVOA = 15.2% better than average). Available for offense, defense, and special teams.

### PFF Grades (Pro Football Focus)
Play-by-play grading on a -2 to +2 scale per play, aggregated to a 0–100 season grade. Graded by human analysts watching every snap. Position-specific: pass blocking, run blocking, pass rush, coverage, receiving, rushing. Subjective by nature — grades reflect PFF's evaluation framework. Elite = 90+, above average = 70–79, average = 60–69, below average = <60.

### AV (Approximate Value)
Pro Football Reference's single-number metric for career/season value. Designed to compare players across positions and eras. Heavily weighted toward starters and statistical production. Useful for historical comparisons and career arc modeling. Not a per-play metric — rewards playing time and volume.

### QBR (ESPN's Total Quarterback Rating)
ESPN's proprietary QB metric on a 0–100 scale. Built on EPA framework with adjustments for: division of credit (QB vs. receiver vs. OL contribution), clutch weighting (late/close game situations), sack and fumble responsibility, rushing value. More context-sensitive than traditional passer rating. Elite = 75+, average = 50, poor = <40.

### Success Rate
Binary per-play metric: did the offense gain "enough" yards?
- 1st down: 40%+ of yards to go = success
- 2nd down: 60%+ of yards to go = success
- 3rd/4th down: 100% of yards to go = success
More stable than EPA across small samples. Useful for evaluating consistency vs. explosiveness.

### Win Probability Added (WPA)
How much a single play changed the team's probability of winning. High-variance metric — heavily influenced by game context (score, time, field position). Best used for narrative ("clutch") analysis, not player evaluation. QBs accumulate the most WPA by position.

## Learnings

*No learnings recorded yet. This section will be populated as Analytics performs research and discovers data patterns, source reliability insights, and analytical findings.*
