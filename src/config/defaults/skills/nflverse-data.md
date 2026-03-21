---
name: "nflverse-data"
description: "Access structured NFL analytics data via nflverse datasets"
domain: "analytics"
confidence: "high"
source: "nflverse/nflverse-data (CC-BY-4.0) + nflreadpy library"
---

# nflverse Data — Skill

> **Confidence:** high — battle-tested OSS ecosystem, CC-BY-4.0 licensed
> **Created:** 2026-03-19 (Phase A)
> **Data source:** https://github.com/nflverse/nflverse-data

## Purpose

Provides programmatic access to 372-column play-by-play data, player/team stats, Next Gen Stats, snap counts, combine data, contracts, draft picks, and more — all freely available as parquet files via the nflreadpy Python library.

This skill eliminates Analytics' primary data-access gap (PFR blocked, ESPN requires scraping) by providing a local cache layer for structured NFL analytics data.

---

## Dataset Catalog

All datasets are available via `python content/data/fetch_nflverse.py --dataset <name> --seasons <year(s)>`.

| Dataset | Update Frequency | Seasons | Key Metrics | Value to NFL Lab |
|---------|------------------|---------|-------------|------------------|
| **pbp** | Nightly + 15min post-game | 1999–present | 372 cols: EPA, WPA, CPOE, success, air_yards, personnel | 🔴 **Critical** — backbone of all analytics |
| **player_stats** | Nightly | 1999–present | 114 cols: EPA, CPOE, yards, TDs, fantasy pts | 🔴 **Critical** — player comparison engine |
| **team_stats** | Nightly | 1999–present | Off/def EPA, success rate, turnovers, red zone % | 🔴 **Critical** — team efficiency rankings |
| **ngs_passing** | Nightly | 2016–present | Time to throw, air yards, completion probability | 🟡 **High** — QB advanced metrics |
| **ngs_receiving** | Nightly | 2016–present | Separation, cushion, yards after catch | 🟡 **High** — WR/TE tracking data |
| **ngs_rushing** | Nightly | 2016–present | Speed, efficiency, rush yards over expected | 🟡 **High** — RB tracking data |
| **snap_counts** | 4×/day (PFR) | 2012–present | Off/def/ST snaps + pct by player | 🟡 **High** — usage/workload analysis |
| **ftn_charting** | 4×/day | 2022–present | Routes, formations, blocking concepts | 🟡 **High** — scheme analysis (CC-BY-SA-4.0) |
| **draft_picks** | Yearly | 1980–present | Round, pick, player, team, AV (career value) | 🟢 Medium — draft value models |
| **combine** | Yearly | 2000–present | 40, 3-cone, vertical, broad, bench | 🟢 Medium — prospect evaluation |
| **contracts** | Periodic | Historical | Years, APY, GTD from OTC | 🟢 Medium — overlaps OTC skill |
| **rosters** | Daily | 1920–present | Position, age, draft info | 🟢 Medium — overlaps ESPN |
| **players** | As needed | All-time | Biographical data (name, position, college) | 🟢 Medium |
| **pfr_passing** | Daily | 2018–present | PFR advanced passing stats — NO 403 BLOCKS | 🟡 **High** |
| **pfr_rushing** | Daily | 2018–present | PFR advanced rushing stats | 🟡 **High** |
| **pfr_receiving** | Daily | 2018–present | PFR advanced receiving stats | 🟡 **High** |
| **pfr_defense** | Daily | 2018–present | PFR advanced defense stats | 🟡 **High** |
| **schedules** | As needed | 1999–present | Game results, spreads, over/unders | 🟢 Medium |

---

## Cache Management

### Cache location
- **Path:** `content/data/cache/`
- **Ignored by git:** Yes (`.gitignore` entry added)
- **File naming:** `{dataset}_{season(s)}.parquet` (e.g., `player_stats_2025.parquet`)
- **Typical size:** 10–50 MB per dataset per season

### Fetch workflow
```bash
# List available datasets
python content/data/fetch_nflverse.py --list

# Cache a single season
python content/data/fetch_nflverse.py --dataset player_stats --seasons 2025

# Cache multiple seasons
python content/data/fetch_nflverse.py --dataset pbp --seasons 2024,2025

# Cache non-seasonal data (contracts, draft picks, combine)
python content/data/fetch_nflverse.py --dataset contracts

# Force refresh (re-download even if cached)
python content/data/fetch_nflverse.py --refresh --dataset player_stats --seasons 2025
```

### Recommended cache warm-up (first-time setup)
```bash
# Core analytics datasets for 2025 offseason work
python content/data/fetch_nflverse.py --dataset player_stats --seasons 2025
python content/data/fetch_nflverse.py --dataset team_stats --seasons 2025
python content/data/fetch_nflverse.py --dataset pbp --seasons 2025

# Historical context (2020–2025 for comps)
python content/data/fetch_nflverse.py --dataset player_stats --seasons 2020,2021,2022,2023,2024,2025

# Non-seasonal data
python content/data/fetch_nflverse.py --dataset contracts
python content/data/fetch_nflverse.py --dataset draft_picks
python content/data/fetch_nflverse.py --dataset combine
```

**Estimated total size for full warm-up:** ~300 MB

---

## Query Scripts (Phase A + Phase B + Phase C)

Nine query scripts are production-ready. All output **pre-aggregated markdown tables** to control token cost when injected into agent prompts. All scripts also support `--format json` for MCP tool consumers.

### MCP Tools (Tier 3 — preferred access method)

All query scripts are exposed as native MCP tools via `.github/extensions/nflverse-query/tool.mjs`, registered in `mcp/server.mjs`. Any agent can call these tools directly without shell-out or prompt engineering.

| MCP Tool | Wraps Script | Description |
|----------|-------------|-------------|
| `query_player_stats` | `query_player_epa.py` | Offensive player EPA + efficiency + positional rank |
| `query_team_efficiency` | `query_team_efficiency.py` | Team off/def EPA, success rate, situational stats |
| `query_positional_rankings` | `query_positional_comparison.py` | League-wide top-N by position and metric |
| `query_snap_counts` | `query_snap_usage.py` | Snap counts (team or player level) |
| `query_draft_history` | `query_draft_value.py` | Draft pick value, hit rates, player history |
| `query_ngs_passing` | `query_ngs_passing.py` | QB Next Gen Stats (2016+) |
| `query_combine_profile` | `query_combine_comps.py` | Combine measurables and leaderboards |
| `query_pfr_defense` | `query_pfr_defense.py` | PFR defensive stats (tackles, coverage, pass rush) |
| `query_historical_comps` | `query_historical_comps.py` | Multi-season statistical player comparisons |
| `refresh_nflverse_cache` | `fetch_nflverse.py` | Download or refresh local parquet cache |

### CLI Scripts

**Usage:**
```bash
python content/data/query_player_epa.py --player "Jaxon Smith-Njigba" --season 2025
python content/data/query_player_epa.py --player "Drake Maye" --season 2025 --format json
```

**Output (markdown mode):**
```markdown
### Jaxon Smith-Njigba — 2024 Season (Rank #11 among WRs)

**Position:** WR | **Team:** SEA

| Metric | Value |
|--------|------:|
| Targets | 137 |
| Receptions | 100 |
| Receiving Yards | 1,130 |
| Receiving TDs | 6 |
| Receiving EPA | 48.444 |
| RACR | 1.501 |
| Target Share | 0.238 |
| Air Yards Share | 0.293 |
```

**Position-specific metrics:**
- **QB:** Passing EPA, CPOE, Dakota, completions, attempts, yards, TDs, INTs + rank among QBs
- **RB:** Rushing EPA, carries, yards, TDs + receiving stats + rank among RBs
- **WR/TE:** Receiving EPA, targets, receptions, yards, TDs, RACR, target share, air yards share + rank among position

---

### 2. Team Efficiency — `query_team_efficiency.py`

**Usage:**
```bash
python content/data/query_team_efficiency.py --team SEA --season 2024
python content/data/query_team_efficiency.py --team KC --season 2024 --format json
```

**Output (markdown mode):**
```markdown
### SEA — 2024 Team Efficiency

#### Offensive Efficiency

| Metric | Value |
|--------|------:|
| EPA/Play (Offense) | -0.012 |
| Success Rate (Offense) | 47.5% |
| Pass EPA/Play | 0.014 |
| Rush EPA/Play | -0.054 |
| Total Yards | 6,006 |
| Third Down % | 36.7% |
| Red Zone TD % | 43.5% |

#### Defensive Efficiency

| Metric | Value |
|--------|------:|
| EPA/Play Allowed | -0.010 |
| Success Rate Allowed | 46.5% |
| Sacks | 44 |
| Interceptions | 13 |

#### Turnover Differential

| Metric | Value |
|--------|------:|
| Turnovers Lost | 19 |
| Turnovers Gained | 18 |
| **Net Turnovers** | **-1** |
```

**Data sources:**
- Basic stats (yards, sacks, turnovers) from `team_stats` dataset
- EPA and success rates from `pbp` dataset
- Situational metrics (3rd down, red zone) derived from `pbp` play-level data

**Note:** Defensive EPA/play is EPA allowed (higher = worse for defense). Success rate allowed is opponent success rate when this team is on defense.

---

### 3. Positional Comparison — `query_positional_comparison.py`

**Usage:**
```bash
python content/data/query_positional_comparison.py --position WR --metric receiving_epa --season 2025 --top 20
python content/data/query_positional_comparison.py --position QB --metric passing_epa --season 2025 --top 10
python content/data/query_positional_comparison.py --position RB --metric rushing_yards --season 2025 --format json
```

**Output (markdown mode for WRs):**
```markdown
### Top 20 WRs by Receiving EPA — 2025

| Rank | Player | Team | Targets | Rec | Rec Yds | Metric Value |
|-----:|--------|------|--------:|----:|--------:|-------------:|
| 1 | Player A | BUF | 145 | 98 | 1,567 | 67.890 |
| 2 | Player B | KC | 132 | 89 | 1,432 | 61.234 |
...
```

**Available positions:** QB, RB, WR, TE

**Common metrics:**
- **QB:** `passing_epa`, `passing_yards`, `passing_tds`, `cpoe`, `dakota`
- **RB:** `rushing_epa`, `rushing_yards`, `rushing_tds`, `receiving_yards`
- **WR/TE:** `receiving_epa`, `receiving_yards`, `receiving_tds`, `target_share`, `air_yards_share`, `racr`

---

### 4. Snap Counts & Usage — `query_snap_usage.py`

**Usage:**
```bash
python content/data/query_snap_usage.py --team SEA --season 2024 --position-group offense --top 10
python content/data/query_snap_usage.py --player "Jaxon Smith-Njigba" --season 2024
python content/data/query_snap_usage.py --team KC --season 2024 --format json
```

**Output (team mode):**
```markdown
### SEA Snap Counts — 2024 (offense group) (Top 10)

| Player | Position | OFF Snaps | OFF % | DEF Snaps | DEF % | ST Snaps | ST % |
|--------|----------|----------:|------:|----------:|------:|---------:|-----:|
| Laken Tomlinson | G | 1,097 | 99.7 | 0 | 0.0 | 60 | 12.9 |
| Charles Cross | T | 1,097 | 99.7 | 0 | 0.0 | 70 | 15.1 |
| Geno Smith | QB | 1,075 | 97.5 | 0 | 0.0 | 0 | 0.0 |
| Jaxon Smith-Njigba | WR | 948 | 86.4 | 0 | 0.0 | 0 | 0.0 |
...
```

**Use cases:**
- Workload analysis: who's playing vs. who's on the roster?
- Scheme reveals: 3-WR vs. 11 personnel usage
- Injury impact: snap-count drops after return from injury
- Special teams contributors

**Available position groups:** `offense`, `defense`, `special`

---

### 5. Draft Pick Value & Hit Rates — `query_draft_value.py`

**Usage:**
```bash
python content/data/query_draft_value.py --pick-range 1-10 --since 2015
python content/data/query_draft_value.py --position WR --round 1 --since 2010
python content/data/query_draft_value.py --player "Jaxon Smith-Njigba" --format json
```

**Output (position hit rate mode):**
```markdown
### WR Draft Hit Rates Round 1 (Since 2015)

| Round | Picks (n) | Avg AV | Median AV | Starter+ % | Solid+ % | Elite % |
|------:|----------:|-------:|----------:|-----------:|---------:|--------:|
| 1 | 49 | 24.0 | 18.0 | 36.7% | 10.2% | 0.0% |

*Starter+ = AV >= 30, Solid+ = AV >= 50, Elite = AV >= 80*
```

**Use cases:**
- Draft capital value modeling
- Trade-up/trade-down analysis
- Positional hit rates: which positions are safest?
- Historical context for prospect evaluation

**Note:** AV = Approximate Value (Pro Football Reference's weighted career value metric). Higher is better.

---

### 6. Next Gen Stats (Passing) — `query_ngs_passing.py`

**Usage:**
```bash
python content/data/query_ngs_passing.py --player "Drake Maye" --season 2024
python content/data/query_ngs_passing.py --top 10 --metric avg_time_to_throw --season 2024
```

**Output (player mode):**
```markdown
### Drake Maye — 2024 Next Gen Stats (Passing)

**Team:** NE

| Metric | Value |
|--------|------:|
| Attempts | 661 |
| Pass Yards | 4,507 |
| Pass TDs | 30 |
| Interceptions | 20 |
| Avg Time to Throw | 2.74s |
| Avg Completed Air Yards | 4.9 |
| Avg Intended Air Yards | 7.4 |
| Air Yards Differential | -2.5 |
| Aggressiveness % | 14.8% |
| Max Completed Air Distance | 51.7 |
| Avg Air Yards to Sticks | -1.4 |

*Aggressiveness = % of passes 20+ air yards downfield*
```

**Use cases:**
- QB evaluation beyond box score
- Play-style profiling: quick-game vs. vertical
- Pressure response: time to throw under duress
- Tracking-based separation and completion probability

**Available metrics for top-N queries:**
- `avg_time_to_throw` — pocket patience
- `avg_completed_air_yards` / `avg_intended_air_yards` — vertical aggression
- `aggressiveness` — deep-ball rate
- `max_completed_air_distance` — arm strength ceiling

**Note:** NGS data available 2016–present only.

---

### 7. Combine Measurables & Comps — `query_combine_comps.py`

**Usage:**
```bash
python content/data/query_combine_comps.py --player "Jaxon Smith-Njigba"
python content/data/query_combine_comps.py --position WR --metric forty --top 20
python content/data/query_combine_comps.py --player "Drake Maye" --format json
```

**Output (player mode):**
```markdown
### Jaxon Smith-Njigba — 2023 NFL Combine

**Position:** WR

| Metric | Value |
|--------|------:|
| Height | 6'1" |
| Weight | 196 lbs |
| 40-Yard Dash | N/A |
| Vertical Jump | 35.0 in |
| Bench Press | N/A |
| Broad Jump | 125 in |
| 3-Cone Drill | 6.57s |
| 20-Yard Shuttle | 3.93s |
```

**Use cases:**
- Prospect evaluation: baseline athleticism
- Historical comps: find players with similar measurables
- Draft analysis: positional norms and outliers
- Injury risk modeling (future): size/speed profiles

**Available metrics for top-N queries:**
- `forty` — 40-yard dash (lower is better)
- `vertical` / `broad_jump` — explosiveness
- `bench` — upper-body strength (225 lbs reps)
- `cone` / `shuttle` — agility and change-of-direction (lower is better)

**Note:** Combine data available 2000–present. Not all players attend the combine; some work out at pro days (not captured).

---

### 8. PFR Defensive Stats — `query_pfr_defense.py`

**Usage:**
```bash
python content/data/query_pfr_defense.py --player "Boye Mafe" --season 2025
python content/data/query_pfr_defense.py --team SEA --season 2025 --top 15
python content/data/query_pfr_defense.py --position CB --season 2025 --top 20
python content/data/query_pfr_defense.py --player "Nehemiah Pritchett" --season 2025 --format json
```

**Three query modes:**
- **Player mode:** Full stat sheet (tackles, coverage, pass rush, turnovers) + position rank
- **Team mode:** All defenders on a team sorted by tackles — key columns in a compact table
- **Positional comparison:** League-wide ranking by position (CB/S by passer rating allowed; LB/DE/DT by tackles)

**Output columns:**
- Tackles (combined, missed, missed tackle %)
- Coverage: targets, completions allowed, completion %, yards allowed, yards/target, passer rating allowed, aDOT, YAC
- Pass rush: blitzes, hurries, QB hits, sacks, pressures
- Turnovers: INTs, TDs allowed

**Position aliases:** DB (→CB+S), EDGE (→DE+OLB), DL (→DE+DT+NT)

**Minimum thresholds:** ≥20 targets for coverage rankings, ≥50 tackles for tackle rankings

**Note:** PFR defense data available 2018–present. Position data is joined from nflverse rosters using `depth_chart_position` for granular positions (CB, SS, DE, DT, ILB, OLB).

---

### 9. Historical Player Comps — `query_historical_comps.py`

**Usage:**
```bash
python content/data/query_historical_comps.py --player "Jaxon Smith-Njigba" --season 2025
python content/data/query_historical_comps.py --player "Drake Maye" --season 2025 --seasons-back 5 --top 10
python content/data/query_historical_comps.py --player "Bijan Robinson" --season 2025 --format json
```

**How it works:**
1. Loads `player_stats` for the target season + N prior seasons (default: 5)
2. Filters to same position with minimum volume thresholds
3. Z-score normalizes position-specific metrics across all player-seasons
4. Computes Euclidean distance from target to every other player-season
5. Returns top-N closest matches with a similarity percentage

**Position-specific metrics:**
- **QB:** completions, attempts, yards, TDs, INTs, EPA, CPOE, Dakota (min 200 attempts)
- **RB:** carries, rush yards, rush TDs, rush EPA, targets, receptions, rec yards (min 100 carries)
- **WR:** targets, receptions, rec yards, rec TDs, rec EPA, RACR, target share, air yards share (min 50 targets)
- **TE:** Same as WR (min 30 targets)

**Output (markdown mode):**
```markdown
### Historical Comps for Jaxon Smith-Njigba (2025 WR, SEA)

Comparing against 245 WR seasons (2020–2025, min 50 targets)

| Rank | Player | Season | Team | Similarity | Key Stats |
|-----:|--------|-------:|------|-----------:|-----------|
| 1 | CeeDee Lamb | 2022 | DAL | 87% | 107 rec, 1,359 yds, 9 TD |
| 2 | Amon-Ra St. Brown | 2023 | DET | 82% | 119 rec, 1,515 yds, 10 TD |
...
```

**Use cases:**
- "Who had a statistically similar age-25 season?" for projection modeling
- Historical context for contract valuation
- Draft prospect comparison to NFL player archetypes

---

## Integration with Article Pipeline

### Data anchors for discussion prompts

When writing a discussion prompt (Stage 2), Analytics or Lead can generate real data tables:

```markdown
## Data Anchors

### WR Market Comps — 2025 Receiving EPA Leaders

[Run: python content/data/query_positional_comparison.py --position WR --metric receiving_epa --season 2025 --top 10]

| Rank | Player | Team | Targets | Rec | Rec Yds | EPA |
|-----:|--------|------|--------:|----:|--------:|----:|
| 1 | ... | ... | ... | ... | ... | ... |
...
```

### Panel agent instructions

Panel prompts can include direct CLI instructions:

```markdown
## Your Task

Before writing your position, run this command to get current stats:

    python content/data/query_player_epa.py --player "Jaxon Smith-Njigba" --season 2025

Include the actual numbers from the output in your analysis.
```

---

## Licensing & Attribution

- **Most datasets:** CC-BY-4.0 (attribution required, commercial use OK, no copyleft)
- **FTN Charting:** CC-BY-SA-4.0 (attribution + share-alike — derivative works must use same license)
- **nflreadpy library:** MIT License (permissive, no restrictions)

**Attribution template for published articles:**
> Data via [nflverse](https://github.com/nflverse/nflverse-data) (CC-BY-4.0)

**FTN charting attribution (when used):**
> Formation and route data via FTN Charting (CC-BY-SA-4.0)

---

## Known Gaps & Constraints

1. **Injury data outdated:** `load_injuries()` only covers 2009–2024. Source died post-2024. Use ESPN web_fetch for current injuries.
2. **Offseason data is static:** PBP and player stats update nightly during regular season only. Offseason articles rely on prior-season data + historical comps.
3. **Token budget for data anchors:** Target <400 tokens per article's combined data anchor tables (roughly half of the 1,500-token panel budget per the article-discussion SKILL). Use `--top N` flag in positional comparison to control output size.
4. **No real-time gameday data (yet):** Gameday review pipeline (Tier 5) is deferred. Phase A focuses on offseason analysis and historical comps.
5. **Auto-fetch on cache miss:** Query scripts automatically fetch missing datasets. First run may take 30-60 seconds to download and cache parquet files (especially `pbp` which is ~30 MB for a single season).

---

## Validation Checkpoints

| Checkpoint | Method | Pass Criteria |
|-----------|--------|---------------|
| **Environment setup** | `pip install -r requirements.txt && python -c "import nflreadpy"` | Clean install, no errors |
| **Cache fetch** | Run fetch script for 3 datasets | `.parquet` files created with >100 rows each |
| **Query output** | Run 3 query scripts with real args | Markdown tables render correctly; numbers are plausible |
| **Token budget** | Count tokens in combined data anchors | <400 tokens per article's data anchor section |
| **Article integration** | Produce a discussion prompt with real data | Panel agents receive tables, cite specific numbers in positions |

---

## Future Phases (Deferred)

- **Phase B complete ✅ (2026-03-19):** 4 additional query scripts added (snap usage, draft value, NGS passing, combine comps). Seven total scripts production-ready.
- **Phase C complete ✅ (2026-03-19):** Tier 2 (Analytics charter rewrite with PBP/tracking/FTN/defense/historical comps) + Tier 3 (10 MCP tools in `nflverse-query` extension). Nine total scripts, all exposed as native tools.
- **Tier 4:** DataScience agent — writes Python for custom models (aging curves, statistical comps, visualizations)
- **Tier 5:** Gameday review pipeline — same-day article production after NFL games

See the nflverse data documentation for the full integration roadmap.
