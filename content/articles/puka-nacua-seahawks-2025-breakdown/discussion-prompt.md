# Discussion Prompt: Puka Nacua Put 300 Yards on Seattle in 2025. Was That a Coverage Failure or a Structural Problem?

**Depth Level:** 2 — The Beat

## The Core Question

**Puka Nacua's biggest opponent split of the 2025 season came against an otherwise elite Seattle defense. Did the Seahawks actually have a Puka problem, or did the Rams simply lean into a structural answer Seattle was willing to live with?**

## Key Tensions

- **Elite defense, bad matchup:** Seattle allowed **-0.121 EPA/play** with a **42.5% defensive success rate**, **47 sacks**, and **18 interceptions** in 2025. And yet Puka still went for **24 targets, 19 catches, 300 yards, 2 TD, 17.457 EPA** across two games. If the defense was truly elite, why did this specific receiver become its biggest opponent split?

- **One explosion vs a real trend:** The split is lopsided. Week 11 was productive but manageable: **7 catches, 75 yards** in a Rams 21-19 win. Week 16 was the detonation: **12 catches, 225 yards, 2 TD** in a Seahawks 38-37 win. Did one track meet distort the whole conclusion, or did Week 16 simply reveal what was already building?

- **Puka problem or McVay problem:** Puka was the NFL's No. 1 WR in receiving EPA (**115.700**) and led the Rams with **166 targets, 129 catches, 1,715 yards, 10 TD**. Against Seattle he accounted for **31.2% of Rams pass targets** and **51.1% of Rams receiving yards**. Was Seattle losing to an elite individual, or to the route, motion, and leverage structure McVay builds around him?

- **Acceptable tradeoff or future warning:** Seattle still won the Week 16 shootout and finished the year as an elite defense. That opens the roster-construction question: is this the kind of stress point you accept because the system works against everyone else, or is it the exact kind of divisional mismatch that should shape Seattle's coverage priorities going forward?

## Data Anchors

### Puka Nacua — 2025 Season

| Metric | Value |
|--------|------:|
| Targets | 166 |
| Receptions | 129 |
| Receiving Yards | 1,715 |
| Receiving TDs | 10 |
| Receiving EPA | 115.700 |
| Target Share | 30.1% |
| Air Yards Share | 33.7% |
| WR EPA Rank | 1st |

_Source: `query_player_epa.py --player "Puka Nacua" --season 2025`, `query_positional_comparison.py --position WR --metric receiving_epa --season 2025 --top 10`_

### Puka Nacua vs Seattle — 2025 Regular Season

| Metric | Value |
|--------|------:|
| Targets | 24 |
| Receptions | 19 |
| Receiving Yards | 300 |
| Receiving TDs | 2 |
| First Downs | 10 |
| Receiving EPA | 17.457 |
| Air Yards | 230 |
| YAC | 148 |
| Success Rate | 66.7% |

### Game Split

| Week | Result | Targets | Rec | Yards | TD | EPA | YAC |
|-----:|--------|--------:|----:|------:|---:|----:|----:|
| 11 | Rams 21, Seahawks 19 | 8 | 7 | 75 | 0 | 0.147 | 24 |
| 16 | Seahawks 38, Rams 37 | 16 | 12 | 225 | 2 | 17.310 | 124 |

_Source: nflverse play-by-play cache (`pbp_2025.parquet`) filtered for Rams-Seahawks regular-season games and `receiver_player_name='P.Nacua'`._

### Share of Rams Passing Output vs Seattle

| Metric | Share |
|--------|------:|
| Team Targets | 77 |
| Puka Target Share | 31.2% |
| Team Pass Yards | 587 |
| Puka Yard Share | 51.1% |

_Source: nflverse play-by-play cache (`pbp_2025.parquet`) filtered for Rams-Seahawks regular-season games._

### How Seattle and LA Played Overall in 2025

#### SEA — Team Efficiency

| Metric | Value |
|--------|------:|
| Defensive EPA/Play Allowed | -0.121 |
| Success Rate Allowed | 42.5% |
| Sacks | 47 |
| Interceptions | 18 |

#### LA — Team Efficiency

| Metric | Value |
|--------|------:|
| Offensive EPA/Play | 0.138 |
| Offensive Success Rate | 53.6% |
| Pass EPA/Play | 0.252 |
| Total Yards | 6,859 |

_Source: `query_team_efficiency.py --team SEA --season 2025`, `query_team_efficiency.py --team LA --season 2025`_

### Opponent Context

Against no other defense did Puka post more total receiving yards than he did against Seattle in 2025. His top opponent splits by yardage:

| Opponent | Targets | Rec | Yards | TD | EPA |
|----------|--------:|----:|------:|---:|----:|
| SEA | 24 | 19 | 300 | 2 | 17.457 |
| ARI | 22 | 17 | 243 | 3 | 20.677 |
| DET | 11 | 9 | 181 | 0 | 15.827 |
| IND | 15 | 13 | 170 | 1 | 13.547 |

_Source: nflverse play-by-play cache (`pbp_2025.parquet`) grouped by `defteam` for `receiver_player_name='P.Nacua'`._

## The Paths

### Path 1: Seattle Had a Real Puka Problem
The Week 16 explosion was not random. It revealed a receiver/profile issue Seattle never fully solved: Puka's blend of motion usage, in-breaking routes, tackle-breaking YAC, and volume share stressed Seattle's rules in a way the rest of the defense's efficiency could not hide.

### Path 2: The Split Was Real, But It Was a Structural Tradeoff
Seattle was willing to concede some underneath/intermediate volume to preserve the rest of the structure, keep explosives down elsewhere, and survive the matchup overall. The defense stayed elite because those tradeoffs worked against almost everyone else, even if Puka got his numbers.

### Path 3: This Was Mostly One Game Driving the Story
Week 16 did the heavy lifting. The article risks over-reading a two-game split where one shootout accounts for most of the yardage, EPA, and touchdowns. Puka is elite, but Seattle's broader defensive profile suggests the takeaway should be restraint, not alarm.

## Panel Instructions

### SEA — Seattle Seahawks Team Analyst
**Your lane:** Seattle's defensive context and the roster/identity implication.

Answer these questions:
1. From Seattle's side, what did the defense appear willing to concede to the Rams, and how much of Puka's production looks like acceptable tradeoff versus genuine failure?
2. Did the Week 16 eruption expose a real coverage stress point Seattle needs to solve, or just the reality of facing a top-tier divisional receiver twice a year?
3. What does this matchup say about Seattle's coverage personnel priorities going forward?

**Do:** Write from Seattle's point of view and make the stakes concrete for Seahawks fans.
**Don't:** Rebuild the route-design explanation from scratch. That's Offense's job.

### LAR — Los Angeles Rams Team Analyst
**Your lane:** How the Rams featured Puka and why Seattle was the defense that gave him his biggest split.

Answer these questions:
1. What did the Rams keep returning to against Seattle from Week 11 to Week 16?
2. Was this primarily about Puka's individual dominance, or about McVay repeatedly creating the same leverage picture against Seattle's structure?
3. Why did the Week 16 game spike so much harder than Week 11?

**Do:** Treat this as a Rams offensive problem solved, not just a Seattle defensive failure.
**Don't:** Duplicate Analytics' benchmark tables.

### Analytics — Data & Statistical Analyst
**Your lane:** Quantify how extreme this split actually was and what the data cannot prove.

Answer these questions:
1. How much of the Seahawks split is signal versus one outlier game?
2. How unusual is 300 yards / 17.457 EPA across two games relative to Puka's overall 2025 profile and Seattle's overall defensive profile?
3. What specific numbers keep the article honest if the prose starts to overstate the certainty?

**Do:** Use direct numbers, benchmarks, and caveats.
**Don't:** Drift into scheme interpretation.

### Offense — Offensive Scheme Expert
**Your lane:** The design answer. Explain what about Puka's role in McVay's offense is hard on this defense.

Answer these questions:
1. What route families, alignments, or motion stress points best explain why Puka can function as a volume chain-mover and explosive producer at the same time?
2. Why might Seattle's structure be particularly vulnerable to that style of receiver usage?
3. Does this look like a "Puka is unguardable" problem or a "this offensive architecture creates impossible leverage" problem?

**Do:** Make the scheme readable and specific.
**Don't:** Turn it into a generic Rams offense explainer.
