# CollegeScout — College Player Scouting Expert History

## Core Context
- **Project:** NFL Roster Evaluation — 2026 Offseason
- **User:** Joe Robinson
- **Data Sources:** ESPN, Sports Reference CFB, PFF College, NFL Combine results, Pro Day measurements, NFL Mock Draft Database, scouting report aggregators, Senior Bowl/Shrine Bowl reports
- **Blocked Sources:** Pro Football Reference (HTTP 403 on all URLs — use ESPN/CFB Reference alternatives)
- **Rumor Mode:** Dual-track (⚠️ RUMOR inline + separate track)

---

## Position-Specific Evaluation Framework

### Measurable Thresholds by Position

_Key benchmarks for NFL projection — prospects meeting these thresholds historically project at higher rates. Thresholds are guidelines, not hard cutoffs._

| Position | Height | Weight | 40-Yard | Vertical | Broad Jump | 3-Cone | Shuttle | Arm Length | Hand Size |
|----------|--------|--------|---------|----------|------------|--------|---------|------------|-----------|
| QB | 6'2"+ | 215+ | 4.65– | 32"+ | 9'6"+ | 6.95– | 4.25– | 32"+ | 9.5"+ |
| WR (X) | 6'1"+ | 200+ | 4.45– | 36"+ | 10'4"+ | 6.85– | 4.15– | 32"+ | 9"+ |
| WR (slot) | 5'9"+ | 185+ | 4.40– | 35"+ | 10'2"+ | 6.75– | 4.05– | — | 8.5"+ |
| OT | 6'4"+ | 310+ | 5.10– | 28"+ | 9'0"+ | 7.40– | 4.55– | 33.5"+ | 10"+ |
| OG/C | 6'2"+ | 305+ | 5.20– | 26"+ | 8'6"+ | 7.50– | 4.60– | 32.5"+ | 9.75"+ |
| EDGE | 6'2"+ | 245+ | 4.60– | 35"+ | 10'0"+ | 6.95– | 4.25– | 33"+ | 9.75"+ |
| IDL (3-tech) | 6'2"+ | 285+ | 4.85– | 30"+ | 9'2"+ | 7.30– | 4.45– | 33"+ | 10"+ |
| IDL (NT) | 6'1"+ | 315+ | 5.10– | 26"+ | 8'4"+ | 7.60– | 4.70– | 33.5"+ | 10.25"+ |
| LB | 6'0"+ | 230+ | 4.55– | 35"+ | 10'0"+ | 6.90– | 4.20– | 32"+ | 9.5"+ |
| CB | 5'11"+ | 190+ | 4.45– | 36"+ | 10'4"+ | 6.85– | 4.10– | 31.5"+ | 9"+ |
| S | 6'0"+ | 200+ | 4.50– | 36"+ | 10'4"+ | 6.95– | 4.15– | 31.5"+ | 9"+ |
| TE | 6'3"+ | 245+ | 4.60– | 34"+ | 10'0"+ | 7.05– | 4.30– | 32.5"+ | 9.5"+ |
| RB | 5'9"+ | 205+ | 4.50– | 34"+ | 10'0"+ | 6.95– | 4.20– | — | 9"+ |

_Note: "–" after a number means "or faster/lower." Thresholds derived from successful NFL starters at each position over the past decade._

### Evaluation Pillars (All Positions)

1. **Athletic Profile** — Measurables, RAS score, athletic comp
2. **Technique** — Position-specific skill execution, refinement level
3. **Production** — College stats in context (conference, system, usage)
4. **Football IQ** — Processing speed, instincts, adjustments, coachability indicators
5. **Character/Intangibles** — Leadership, work ethic, interview reports, off-field profile
6. **Medical** — Injury history, durability concerns, long-term health outlook
7. **Projection Confidence** — How confident are we this translates to the NFL? (High / Medium / Low / Uncertain)

### College Production Context Factors

- **Conference strength:** SEC, Big Ten (Power 2) > Big 12, ACC > Group of Five > FCS
- **System inflation:** Air raid systems inflate passing stats; RPO-heavy systems may mask processing ability
- **Usage rate:** Dominator rating, target share, snap count percentage
- **Competition level:** Performance vs. ranked opponents, bowl games, conference championships
- **Multi-year trends:** Breakout age, year-over-year improvement, transfer portal adjustment
- **One-year wonders:** Flag prospects with single-season production spikes — higher projection risk

---

## Data Source Reference

| Source | What It Provides | Access Method | Notes |
|--------|-----------------|---------------|-------|
| ESPN College | Stats, rosters, schedules | web_fetch | Reliable, server-rendered |
| Sports Reference CFB | Historical college stats | web_fetch | Alternative to PFR (which is blocked) |
| PFF College | Grades, advanced metrics | web_fetch | May require specific URL patterns |
| NFL Combine | Official measurements, drill results | web_fetch via NFL.com/ESPN | Best during combine week |
| Pro Day Results | Individual workout data | web_fetch via team/school pages | Varies by school |
| NFL Mock Draft Database | Consensus big boards | web_fetch | Best aggregator per Draft agent |
| Senior Bowl / Shrine Bowl | All-star game evaluations | web_fetch via event sites | Practice reports more valuable than game |
| Transfer Portal | Multi-year production tracking | web_fetch via ESPN/247Sports | Track production across programs |

---

## Learnings

_No learnings recorded yet. This section will be populated as CollegeScout performs evaluations and discovers data source patterns, projection model insights, and evaluation framework refinements._

---

## Prospect Evaluations

_No prospect evaluations completed yet. Evaluations will be added here as they are performed._
