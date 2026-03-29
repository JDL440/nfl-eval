# Advanced Data Analysis: nflverse Integration — Implementation Plan

> **Status:** Implementation plan approved — build-ready
> **Date:** 2026-03-19 (research) → 2026-03-19 (plan update by Lead)
> **Scope:** Tier 0 + selective Tier 1 near-term build; Tiers 2–5 deferred
> **Decision:** Lead approved Tier 0–1 on 2026-03-19 (see `.squad/decisions/inbox/lead-nflverse-detailed-plan.md`)

---

## Executive Summary

The NFL Lab pipeline currently relies on **web-scraped narrative data** (ESPN, OTC, Spotrac) interpreted by an Analytics agent that speaks in metrics but has no programmatic access to actual play-by-play or statistical datasets. The [nflverse ecosystem](https://github.com/nflverse/nflverse-data)[^1] — specifically the Python library **nflreadpy**[^2] — provides free, structured, CC-BY-4.0-licensed parquet data covering 372-column play-by-play (back to 1999), player/team stats, Next Gen Stats, snap counts, FTN charting, combine data, injuries, contracts, draft picks, depth charts, and more. All updated nightly during the season and available within **15 minutes** of game end for raw PBP[^3].

This report proposes a **tiered capability ladder** — from quick wins (install nflreadpy, build a data skill) all the way to same-day gameday review articles — and recommends whether the work folds into the existing Analytics agent, splits into a new "DataScience" expert, or requires a small team.

---

## Architecture Overview: Current vs. Proposed

### Current Data Flow (narrative-only)

```
┌──────────────┐    web_fetch     ┌──────────────┐    LLM context    ┌──────────────┐
│  OTC/Spotrac │───────────────▶│  Agent prompt │───────────────▶│  Article text │
│  ESPN/NFL    │    (HTML→MD)     │  (Analytics)  │    (narrative)    │  (draft.md)  │
└──────────────┘                  └──────────────┘                   └──────────────┘
      ⬆ Problems:
      • No structured stats — agents cite EPA/DVOA from memory or paywalled articles
      • PFR blocked (403) — Analytics charter lists it but can't use it[^4]
      • No historical comparison — can't compute "top-5 since 2020" live
      • No play-by-play — can't answer "how did X perform on 3rd down vs. zone?"
```

### Proposed Data Flow (structured data + narrative)

```
┌──────────────────────────────────────────────────┐
│                 nflverse-data (GitHub Releases)    │
│  pbp · player_stats · team_stats · ngs · snap     │
│  combine · contracts · draft_picks · ftn_charting  │
│  injuries · depth_charts · rosters · schedules     │
└──────────────────┬───────────────────────────────┘
                   │  nflreadpy (Python/Polars)
                   ▼
┌──────────────────────────────────────────────────┐
│           content/data/ (local parquet cache)      │
│  Cached on first fetch per season, refreshed       │
│  nightly during regular season                     │
└──────────────────┬───────────────────────────────┘
                   │
          ┌────────┴────────┐
          ▼                 ▼
┌──────────────┐   ┌──────────────┐
│  query_nfl   │   │  nflverse    │
│  (Python CLI │   │  extension   │
│   scripts)   │   │  (MCP tool)  │
└──────┬───────┘   └──────┬───────┘
       │                   │
       ▼                   ▼
┌──────────────────────────────────────────────────┐
│  Agent prompts get TABLES of real stats            │
│  EPA/play by team, snap counts, NGS separation,   │
│  contract comps, combine measurables, etc.         │
└──────────────────────────────────────────────────┘
```

---

## The nflverse Data Catalog

Every one of these datasets is freely downloadable as parquet via nflreadpy[^2]. Key datasets ranked by value to the NFL Lab:

| Dataset | nflreadpy Function | Seasons | Update Freq (in-season) | Key Columns | Value to NFL Lab |
|---------|-------------------|---------|------------------------|-------------|-----------------|
| **Play-by-play** | `load_pbp()` | 1999–present | Nightly + 15min post-game (raw) | 372 cols: EPA, WPA, CPOE, cp, air_yards, success, personnel, etc. | 🔴 **Critical** — backbone of all analytics |
| **Player stats** | `load_player_stats()` | 1999–present | Nightly | 114 cols: completions, yards, TDs, EPA, CPOE, fantasy pts | 🔴 **Critical** — player comparison engine |
| **Team stats** | `load_team_stats()` | 1999–present | Nightly | Offensive/defensive EPA, success rate, turnovers | 🔴 **Critical** — team efficiency rankings |
| **Next Gen Stats** | `load_nextgen_stats()` | 2016–present | Nightly | Completion prob, separation, speed, time to throw | 🟡 **High** — tracking-based advanced metrics |
| **Snap counts** | `load_snap_counts()` | 2012–present | 4×/day (PFR) | Off/def/ST snaps + pct by player | 🟡 **High** — usage/workload analysis |
| **FTN Charting** | `load_ftn_charting()` | 2022–present | 4×/day | Play-level charting (routes, formations, concepts) | 🟡 **High** — scheme analysis data |
| **Draft picks** | `load_draft_picks()` | 1980–present | Yearly | Round, pick, player, team, AV (career) | 🟢 Medium — draft value models |
| **Combine** | `load_combine()` | 2000–present | Yearly | 40, 3-cone, vertical, broad, bench by prospect | 🟢 Medium — prospect evaluation |
| **Contracts** | `load_contracts()` | Historical | Periodic | Years, value, GTD, APY from OTC | 🟢 Medium — overlaps existing OTC skill |
| **Injuries** | `load_injuries()` | 2009–2024 | Daily (but source died post-2024)[^5] | Player, report_status, practice_status | 🟡 High when available |
| **Rosters** | `load_rosters()` | 1920–present | Daily | Full roster + position, age, draft info | 🟢 Medium — overlaps ESPN/NFL.com |
| **Depth charts** | `load_depth_charts()` | 2001–present | Daily | Position depth by week/timestamp | 🟢 Medium — overlaps ESPN depth |
| **Participation** | `load_participation()` | 2016–present | Post-season only (FTN) | Which players were on the field per play | 🟡 High for scheme analysis |
| **ESPN QBR** | `load_espn_qbr()` | 2006–present | Seasonal | Total QBR, EPA-based | 🟢 Medium |
| **PFR Advanced** | `load_pfr_advstats()` | 2018–present | Daily | Passing/rushing/receiving/defense advanced stats | 🟡 High — PFR data without 403 blocks! |
| **Schedules** | `load_schedules()` | 1999–present | As needed | Game results, spreads, over/unders | 🟢 Medium |

---

## Capability Tiers: Quick Wins → Gameday Review

### Tier 0: Foundation (Quick Win — 1-2 sessions) 🟢 APPROVED — BUILD NOW

**What:** Install nflreadpy, build a `content/data/` cache layer, create a `nflverse-data` SKILL.

| Task | Effort | Impact |
|------|--------|--------|
| `pip install nflreadpy` (or add to a requirements.txt) | 5 min | Enables all downstream work |
| Create `content/data/fetch_nflverse.py` — a CLI script that downloads + caches parquet files locally | 1 hour | Agents can `python content/data/fetch_nflverse.py --dataset pbp --seasons 2025` |
| Create `.squad/skills/nflverse-data/SKILL.md` — documents all available datasets, access patterns, column semantics | 1 hour | Every agent knows what data exists and how to query it |
| Update Analytics charter to reference nflverse as primary structured data source (replacing PFR which is blocked) | 15 min | Analytics stops citing data it can't actually access |

**Why this is a quick win:** Zero infrastructure. nflreadpy downloads parquet files from GitHub Releases into memory (Polars DataFrames) or local cache. No database, no API keys, no accounts. The data is CC-BY-4.0 licensed[^6].

**Code sketch for the fetch script:**

```python
#!/usr/bin/env python3
"""content/data/fetch_nflverse.py — Cache nflverse data locally as parquet."""
import nflreadpy as nfl
import sys, pathlib

CACHE = pathlib.Path(__file__).parent / "cache"
CACHE.mkdir(exist_ok=True)

LOADERS = {
    "pbp": lambda s: nfl.load_pbp(s),
    "player_stats": lambda s: nfl.load_player_stats(s),
    "team_stats": lambda s: nfl.load_team_stats(s),
    "ngs_passing": lambda s: nfl.load_nextgen_stats(s, "passing"),
    "ngs_receiving": lambda s: nfl.load_nextgen_stats(s, "receiving"),
    "ngs_rushing": lambda s: nfl.load_nextgen_stats(s, "rushing"),
    "snap_counts": lambda s: nfl.load_snap_counts(s),
    "ftn_charting": lambda s: nfl.load_ftn_charting(s),
    "contracts": lambda _: nfl.load_contracts(),
    "draft_picks": lambda _: nfl.load_draft_picks(),
    "combine": lambda _: nfl.load_combine(),
    "rosters": lambda s: nfl.load_rosters(s),
    "players": lambda _: nfl.load_players(),
}

def fetch(dataset, seasons):
    df = LOADERS[dataset](seasons)
    path = CACHE / f"{dataset}.parquet"
    df.write_parquet(path)
    print(f"✅ {dataset}: {len(df)} rows → {path}")

if __name__ == "__main__":
    dataset = sys.argv[1] if len(sys.argv) > 1 else "player_stats"
    seasons = int(sys.argv[2]) if len(sys.argv) > 2 else 2025
    fetch(dataset, seasons)
```

---

### Tier 1: Query Scripts (Quick Win — 2-3 sessions) 🟢 APPROVED — BUILD NOW (selective)

**What:** Build focused Python query scripts that agents invoke via `powershell` to get real statistical tables. **Phase A builds 3 scripts; Phase B builds the remaining 4.**

| Script | What It Returns | Which Agents Use It |
|--------|----------------|---------------------|
| `query_player_epa.py --player "Jaxon Smith-Njigba" --season 2025` | EPA/play, success rate, CPOE, targets, yards, TDs — formatted as a markdown table | Analytics, Writer, Team agents |
| `query_team_efficiency.py --team SEA --season 2025` | Offensive + defensive EPA/play, success rate, turnover margin, red zone %, 3rd down % | Analytics, Lead, Team agents |
| `query_positional_comparison.py --position WR --metric receiving_epa --season 2025 --top 20` | League-wide positional rankings with real numbers | Analytics, Cap (for contract value), Draft |
| `query_snap_usage.py --team SEA --season 2025` | Snap counts and percentages by player, sortable by position | Offense, Defense, Team agents |
| `query_draft_value.py --round 1 --position EDGE --since 2015` | Historical hit rates, AV by pick, bust rates | Draft, CollegeScout |
| `query_ngs_passing.py --player "Drake Maye" --season 2025` | Time to throw, air yards, completion probability, aggressiveness | Analytics, Offense |
| `query_combine_comps.py --player "prospect name" --position WR` | Athletic measurable comparisons to NFL players | Draft, CollegeScout |

**Impact:** This tier alone eliminates the Analytics agent's biggest weakness — it currently cites EPA and DVOA from training data or paywalled sources[^4]. With these scripts, any agent can run a command and get a real table of current stats embedded in their position statement.

**Integration pattern — agents call these from their prompts:**

```
# In a panel agent prompt:
Run this command to get real stats before writing your position:
python content/data/query_player_epa.py --player "Jaxon Smith-Njigba" --season 2025

Include the actual numbers from the output in your analysis.
```

---

### Tier 2: Analytics Agent Upgrade (Medium — 3-5 sessions) ⏳ DEFERRED

**What:** Enhance the existing Analytics agent to become a data-first analyst with structured query capabilities. No new agent needed yet.

**Entry trigger:** Phase B complete AND Analytics is frequently bottlenecked by missing queries.

| Change | Detail |
|--------|--------|
| **Charter update** | Add nflverse as primary data source (replace PFR). Add query script invocation to standard workflow. |
| **New knowledge area: Play-by-play analysis** | EPA splits (passing/rushing), success rate by down/distance, red zone efficiency, garbage time filtering |
| **New knowledge area: Tracking data** | NGS separation, completion probability over expected, time to throw, rush speed |
| **New knowledge area: FTN charting** | Formation tendencies, route concepts, blocking schemes — data the Offense/Defense agents would kill for |
| **New analytical framework: Historical comps** | Query 5+ seasons of PBP data to find statistical player comparisons ("Player X's age-25 season looks like Player Y's age-25 season") |
| **Data anchor generation** | Analytics auto-generates data anchor tables for discussion prompts using real queries, not hand-typed numbers from web scraping |

**Why fold into Analytics (not a new agent):** The Analytics charter already owns EPA, DVOA, success rate, PFF grades, QBR, WPA, positional value, and contract value modeling[^4]. What it lacks is **access**, not **scope**. Adding nflverse gives it the data it was always supposed to have.

---

### Tier 3: Copilot Extension — `nflverse-query` Tool (Medium-High — 5-8 sessions) ⏳ DEFERRED

**What:** Build a Copilot CLI extension (like the existing `generate_article_images` and `publish_to_substack` tools) that any agent can call as a native tool, returning formatted markdown tables.

**Entry trigger:** Tier 1 scripts are stable AND article production reaches 2+/week.

```
┌───────────────────────────────────────────────────────┐
│  .github/extensions/nflverse-query/extension.mjs       │
│                                                        │
│  Tools exposed:                                        │
│  • query_player_stats(player, season, metrics[])       │
│  • query_team_efficiency(team, season)                 │
│  • query_positional_rankings(position, metric, top_n)  │
│  • query_play_by_play(filters{}, aggregation{})        │
│  • query_ngs(player, stat_type, season)                │
│  • query_historical_comps(player, seasons_back)        │
│  • query_snap_counts(team, season, position_group)     │
│  • query_draft_history(position, rounds[], since_year) │
│  • query_combine_profile(player)                       │
│  • refresh_cache(datasets[])                           │
└───────────────────────────────────────────────────────┘
```

**Why an extension matters:** Currently agents must be told to run shell commands, and the output goes through the agent's context window as raw text. A native Copilot extension:
- Returns **structured** results that the squad coordinator can route
- Can be called by **any agent** without special prompt engineering
- Handles caching, error handling, and formatting in one place
- Mirrors the existing pattern (gemini-imagegen, substack-publisher, table-image-renderer)[^7]

**Implementation:** The extension would shell out to Python scripts under the hood (Node can't easily read parquet), or use a lightweight HTTP server that the extension queries. The existing `pipeline-telemetry.mjs` already demonstrates the shell-out pattern[^8].

---

### Tier 4: New Agent — DataScience (High — dedicated build) ⏳ DEFERRED

**What:** A new specialist agent focused on **computational analysis** that Analytics requests rather than performs.

**Entry trigger:** Analytics needs custom Python beyond pre-built query scripts (aging curves, multi-table statistical models, visualizations).

**When to split:** When the work exceeds what a single charter can cover — specifically, when you need an agent that:
- Writes and runs Python code (not just calls pre-built queries)
- Builds custom statistical models (aging curves, contract surplus value, win probability models)
- Produces data visualizations and charts for articles
- Runs multi-table joins across datasets (PBP + participation + snap counts + NGS)

| Agent | Focus | Boundary |
|-------|-------|----------|
| **Analytics** (existing) | Interprets stats, provides analytical context, challenges narratives with data. Calls pre-built queries. | Does NOT write code. Speaks to what numbers mean. |
| **DataScience** (new) | Writes Python, builds models, runs computations, produces tables/charts. Answers "compute this for me." | Does NOT interpret or narrate. Produces data products for other agents. |

**DataScience charter sketch:**

```markdown
# DataScience — Computational Analysis Expert

> The lab. Turns questions into code, code into tables, tables into answers.

## Identity
- **Name:** DataScience
- **Role:** Computational NFL Data Analyst
- **Persona:** DataScience Basher — quiet, precise, lets the numbers do the talking
- **Model:** gpt-5.3-codex (agentic_code family — writes and runs Python)

## Responsibilities
- Write and execute Python/Polars queries against nflverse data
- Build statistical models: aging curves, contract surplus, player comps
- Generate publication-ready data tables and visualizations
- Answer computational questions from Analytics and other agents
- Maintain data cache freshness

## Knowledge Areas
- nflreadpy API (all load_* functions, data dictionaries)
- Polars DataFrame operations (filter, group_by, join, window)
- Statistical methods (regression, percentile ranking, z-scores, aging curves)
- Data visualization (matplotlib/seaborn for static charts)
- EPA/WPA/CPOE computation from raw PBP
```

**Why a codex model:** DataScience's job is to write and run Python code. The `agentic_code` task family in models.json already defines the right model tier for this[^9]. Analytics stays on `claude-opus-4.6` (deep reasoning) because its job is interpretation.

---

### Tier 5: Gameday Review Pipeline (Advanced — dedicated build) ⏳ DEFERRED

**What:** Same-day article production after NFL games, using live-updating nflverse data.

**Entry trigger:** Regular season begins AND Tiers 0-2 are production-proven.

**The data update timeline makes this possible:**

```
Game ends (1:00 PM ET Sunday)
    │
    ├── +15 min: Raw PBP available via nflfastR[^3]
    ├── +3-5 hrs: Cleaned PBP + player/team stats updated (nightly pipeline)
    ├── +overnight: Next Gen Stats, snap counts, PFR advanced stats
    ├── +Wed-Thu: Stat corrections applied — cleanest data of the week
    │
    ▼
Article production windows:
    ├── FAST (Sunday PM): Raw PBP available, basic EPA/WPA possible
    ├── SAME-DAY (Sunday night): Cleaned stats, full player/team analysis
    ├── NEXT-DAY (Monday AM): NGS, snap counts, full picture
    └── DEEP (Thursday): Stat-corrected data, most accurate analysis
```

**Gameday review article pipeline:**

```
┌────────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  Game ends  │───▶│ DataScience │───▶│  Analytics    │───▶│  Writer     │
│  (trigger)  │    │ fetches PBP │    │ interprets    │    │ drafts      │
│             │    │ runs queries│    │ tells story   │    │ game review │
└────────────┘    └─────────────┘    └──────────────┘    └─────────────┘
                        │                   │
                        ▼                   ▼
                  ┌─────────────┐    ┌─────────────┐
                  │  EPA splits  │    │  Key plays   │
                  │  Win prob    │    │  Player      │
                  │  chart       │    │  grades      │
                  │  Snap usage  │    │  Context     │
                  └─────────────┘    └─────────────┘
```

**What a gameday review article contains:**

1. **Game narrative** — key moments identified by WPA (Win Probability Added) spikes
2. **QB evaluation** — EPA/play, CPOE, time to throw (NGS), pressure rate
3. **Offensive efficiency** — EPA by play type, success rate by down, red zone conversion
4. **Defensive grades** — EPA allowed, pressure rate, coverage stats
5. **Key matchup data** — snap counts revealing scheme adjustments
6. **What it means** — Analytics interprets in context of season trends

**Trigger mechanism:** GitHub Action or cron that:
1. Detects game completion (nflverse schedule data shows final scores)
2. Waits 15 min for raw PBP
3. Runs DataScience to fetch + query
4. Spawns Analytics + Team agent for interpretation
5. Spawns Writer for article
6. Spawns Editor for review
7. Publishes as draft for Joe to review

**Team-specific gameday hooks:**
- Each team agent gets a pre-built "gameday template" with their specific matchup context
- The 32-team architecture already supports this — just needs data + trigger

---

## Implementation Recommendation

### Strategic summary

**Build Tier 0 + selective Tier 1 now.** The Analytics agent's biggest gap is data access, not analytical scope. nflreadpy closes that gap with zero infrastructure overhead. Everything else (extension, new agent, gameday pipeline) is deferred until Phase 1 publishing goals are met — the platform bottleneck today is audience validation, not data sophistication.

### What to build and when

| Tier | Effort | Dependencies | Timing | Status |
|------|--------|-------------|---------|--------|
| **Tier 0: Foundation** | 1-2 sessions | None | **NOW — build first** | 🟢 Approved |
| **Tier 1: Query Scripts** (selective) | 1-2 sessions | Tier 0 | **NOW — build alongside Tier 0** | 🟢 Approved (3 scripts) |
| **Tier 1: Query Scripts** (full set) | 1-2 more sessions | Tier 0 | **After first article uses data** | 🟡 Approved on demand |
| **Tier 2: Analytics Upgrade** | 3-5 sessions | Tier 1 | **Defer — next charter revision** | ⏳ Deferred |
| **Tier 3: Extension** | 5-8 sessions | Tier 1 | **Defer — pre-season** | ⏳ Deferred |
| **Tier 4: DataScience agent** | Dedicated build | Tiers 0-2 | **Defer — training camp** | ⏳ Deferred |
| **Tier 5: Gameday review** | Dedicated build | Tiers 0-4 | **Defer — regular season** | ⏳ Deferred |

### Agent decision: enhance, don't split

**For Tiers 0-2: No new agent. Enhance Analytics.**

The current Analytics charter[^4] already covers EPA, DVOA, WPA, success rate, PFF grades, positional value, contract value, draft pick value, and team efficiency. It just lacks data access. nflreadpy gives it what it needs.

**For Tiers 3-4: Add DataScience only when justified.**

Split only when pre-built query scripts can't serve the analytical demands — when agents need custom Python computations (aging curves, multi-table joins, statistical models). No evidence this will happen during Phase 1.

**For Tier 5: No additional agents needed.**

Gameday review reuses the existing pipeline with a new trigger mechanism.

---

## 🔨 Phased Implementation Roadmap

### Phase A: Foundation + First Query Scripts (Tier 0 + selective Tier 1)

> **Target:** 2-3 sessions · **Gate:** First article uses a real nflverse data table in a published draft

This is the near-term build. Everything below is a concrete work breakdown.

#### Phase A, Step 1 — Python environment & nflreadpy (30 min)

| Deliverable | Location | Notes |
|-------------|----------|-------|
| `requirements.txt` | repo root | `nflreadpy>=0.2.0` + `polars>=1.0` (nflreadpy dependency). No other new deps. |
| `.gitignore` update | repo root | Add `content/data/cache/` — parquet files are 10-50 MB each, must not enter git |
| Verify install | terminal | `pip install -r requirements.txt && python -c "import nflreadpy; print(nflreadpy.__version__)"` |

**Why `requirements.txt` at root:** The repo currently has no Python dependency manifest. `package.json` manages Node. Python scripts exist in `content/` (8 files: `article_board.py`, `pipeline_state.py`, `model_policy.py`, etc.) but had no pinned dependencies. A root `requirements.txt` is the simplest convention that matches the existing flat repo layout.

**Validation checkpoint:** `pip install -r requirements.txt` succeeds. `python -c "import nflreadpy"` returns no error.

#### Phase A, Step 2 — Data cache script (1 hour)

| Deliverable | Location | Notes |
|-------------|----------|-------|
| `content/data/fetch_nflverse.py` | `content/data/` (new dir) | CLI script: `python content/data/fetch_nflverse.py --dataset pbp --seasons 2025` |
| `content/data/cache/` | git-ignored | Local parquet storage, populated by fetch script |

**Script behavior:**
1. Accept `--dataset` and `--seasons` (or `--all-seasons` for historical).
2. Download via nflreadpy into Polars DataFrame.
3. Write to `content/data/cache/{dataset}_{season}.parquet`.
4. Print row count and file size.
5. Support `--refresh` flag to re-download even if cached file exists.
6. Support `--list` to show available datasets.

**Validation checkpoint:** Run `python content/data/fetch_nflverse.py --dataset player_stats --seasons 2025` → produces `content/data/cache/player_stats_2025.parquet` with >500 rows. Run again without `--refresh` → uses cached file (prints "cached" message).

#### Phase A, Step 3 — First three query scripts (2-3 hours)

Build the three highest-impact scripts identified in Lead's platform-fit review:

| Script | File | Usage | Output |
|--------|------|-------|--------|
| **Player EPA** | `content/data/query_player_epa.py` | `--player "Jaxon Smith-Njigba" --season 2025` | Markdown table: EPA/play, success rate, CPOE, targets, yards, TDs, rank among position |
| **Team efficiency** | `content/data/query_team_efficiency.py` | `--team SEA --season 2025` | Markdown table: off/def EPA/play, success rate, turnover margin, red zone %, 3rd down % |
| **Positional comparison** | `content/data/query_positional_comparison.py` | `--position WR --metric receiving_epa --season 2025 --top 20` | Markdown table: top-N players at position by chosen metric |

**All scripts must:**
- Read from `content/data/cache/` (auto-fetch if cache miss).
- Return **pre-aggregated markdown tables**, not raw DataFrames. This controls token cost when tables are injected into agent prompts (1,500-token panel budget per article-discussion SKILL).
- Include column headers and right-aligned numbers.
- Accept `--format json` for programmatic consumers (future extension use).
- Exit 0 on success, non-zero on error with a clear message.

**Validation checkpoint:** Each script runs end-to-end and produces a readable markdown table. Test: pipe output to a `.md` file and confirm it renders in VS Code preview.

#### Phase A, Step 4 — SKILL document (30 min)

| Deliverable | Location | Notes |
|-------------|----------|-------|
| `.squad/skills/nflverse-data/SKILL.md` | `.squad/skills/nflverse-data/` (new) | Documents: available datasets, column semantics, query script usage, cache management, licensing |

**SKILL.md must include:**
- A copy of the Data Catalog table (from the Tier 0 section above) — so every agent knows what exists.
- Usage examples for each query script with expected output shape.
- Cache management: how to refresh, where files live, approximate sizes.
- Licensing note: CC-BY-4.0 for most data, CC-BY-SA-4.0 for FTN charting.
- Known gaps: injury data unavailable for 2025+ via nflverse (use ESPN web_fetch), PBP data for current season updates nightly only during regular season.

#### Phase A, Step 5 — Analytics charter patch (15 min)

| Deliverable | Location | Notes |
|-------------|----------|-------|
| Analytics charter update | `.squad/agents/analytics/charter.md` | Replace PFR (blocked) with nflverse as primary structured data source. Add nflverse-data SKILL reference. |

**Specific changes:**
- Data Sources table: PFR row changes from "🔴 Blocked (403)" to "✅ Available via nflverse `load_pfr_advstats()`".
- Add nflverse row: "✅ Local parquet cache — see `.squad/skills/nflverse-data/SKILL.md`".
- Knowledge Areas: add "nflverse play-by-play (372-col EPA/WPA/CPOE dataset)" and "nflverse Next Gen Stats (separation, completion probability, time to throw)".
- Remove or caveat the "use cached/known data only" PFR note since the data is now programmatically available.

**Validation checkpoint:** Read updated charter — no references to PFR being blocked as the sole data path for advanced stats.

#### Phase A, Step 6 — Integration smoke test (30 min)

**Run a real article-pipeline data anchor test:**
1. Pick an in-progress or upcoming article (e.g., a JSN extension article or draft evaluation).
2. Run each query script to produce data tables relevant to that article's discussion prompt.
3. Verify the output would fit within the Data Anchors section of a Level 2 discussion prompt (article-discussion SKILL).
4. Confirm token count of combined tables stays under ~400 tokens (rough half of the 1,500-token panel budget, leaving room for narrative).

**If tables are too large:** Add `--limit` or `--columns` flags to the query scripts to trim output.

**Success criteria for Phase A:**
- ✅ `requirements.txt` exists and installs cleanly
- ✅ `content/data/cache/` is gitignored
- ✅ `fetch_nflverse.py` caches at least 3 datasets (player_stats, team_stats, pbp)
- ✅ 3 query scripts produce markdown tables from cached data
- ✅ `.squad/skills/nflverse-data/SKILL.md` exists
- ✅ Analytics charter references nflverse
- ✅ At least one article discussion prompt has been produced using real nflverse data

---

### Phase B: Full Query Library + First Article Impact (Tier 1 complete)

> **Target:** 2-3 sessions after Phase A · **Gate:** Published article contains verifiable nflverse-sourced stats

#### Deliverables

| Script | File | Priority |
|--------|------|----------|
| `query_snap_usage.py` | `content/data/query_snap_usage.py` | High — supports Offense/Defense agents |
| `query_draft_value.py` | `content/data/query_draft_value.py` | High — Draft + CollegeScout agents |
| `query_ngs_passing.py` | `content/data/query_ngs_passing.py` | Medium — deepens QB evaluation |
| `query_combine_comps.py` | `content/data/query_combine_comps.py` | Medium — draft article support |

#### Integration work
- Update discussion prompt templates in `article-discussion SKILL` to include a "run these commands for data" instruction block.
- Test on a real article: produce an article where at least 2 data tables come from nflverse queries (not hand-typed web scrapes).
- Measure: did the Writer cite more specific numbers? Did the Editor flag fewer "vague stat" issues?

#### Validation checkpoint
- A published article on Substack contains at least one stat that traces back to a nflverse query script.
- Analytics agent position statements in panel discussions use data from script output (not from training data).

---

### Phase C and beyond: Deferred work (Tiers 2–5)

> **Timing:** These phases are approved in concept but deferred until Phase 1 publishing goals (5-8 articles, audience metrics) are met. Each phase has a clear entry trigger.

#### Tier 2 — Analytics Agent Upgrade (3-5 sessions)

**Entry trigger:** Phase B complete AND Analytics agent is frequently bottlenecked by lack of pre-built queries (i.e., panelists request data the scripts don't cover).

- Full charter rewrite incorporating nflverse as primary data source
- New knowledge areas: play-by-play analysis, tracking data, FTN charting
- Historical comp framework: query 5+ seasons to find statistical player comparisons
- Auto-generated data anchors for discussion prompts (replaces manual assembly)

#### Tier 3 — Copilot Extension (5-8 sessions)

**Entry trigger:** Tier 1 query scripts are stable AND article production reaches 2+/week (making shell-out calls in every panel spawn too cumbersome).

- `.github/extensions/nflverse-query/extension.mjs` exposing 8-10 tools
- Follows the existing extension pattern (`pipeline-telemetry.mjs` shell-out model)
- Any agent calls the tool natively without prompt engineering

#### Tier 4 — DataScience Agent (dedicated build)

**Entry trigger:** Analytics agent needs custom Python beyond pre-built queries (aging curves, multi-table statistical models, visualizations).

- New agent: `DataScience` — writes and runs Python, builds models, produces data products
- Separate from Analytics (which interprets; DataScience computes)
- Uses `agentic_code` task family from `models.json`

#### Tier 5 — Gameday Review Pipeline (dedicated build)

**Entry trigger:** Regular season begins AND Tiers 0-2 are production-proven.

- Triggered by game completion (GitHub Action or cron)
- Uses DataScience → Analytics → Writer → Editor pipeline
- 15-min raw PBP availability enables same-day analysis
- 32 team agents already have team-specific knowledge for gameday hooks

### Recommended team structure (full vision)

```
┌─────────────────────────────────────────────────────────────┐
│  Data Analysis Team (within existing squad)                  │
│                                                              │
│  Analytics (existing, upgraded in Tier 2)                    │
│    • Interprets stats, challenges narratives                 │
│    • Calls pre-built queries or DataScience                  │
│    • Provides analytical context to all other agents         │
│                                                              │
│  DataScience (new, Tier 4 — DEFERRED)                        │
│    • Writes Python, runs computations                        │
│    • Builds models (aging curves, comps, surplus value)      │
│    • Produces tables and charts                              │
│    • Maintains data cache                                    │
│                                                              │
│  Shared infrastructure:                                      │
│    • content/data/ — parquet cache + query scripts           │
│    • .squad/skills/nflverse-data/SKILL.md — data dictionary  │
│    • .github/extensions/nflverse-query/ (Tier 3 — DEFERRED)  │
└─────────────────────────────────────────────────────────────┘
```

---

## Validation & Risk Management

### Validation checkpoints (Phase A)

| Checkpoint | Timing | Method | Pass Criteria |
|-----------|--------|--------|---------------|
| Python env | Step 1 | `pip install && python -c "import nflreadpy"` | Clean install, no errors |
| Cache fetch | Step 2 | Run fetch script for 3 datasets | `.parquet` files created with >100 rows each |
| Query output | Step 3 | Run 3 query scripts with real args | Markdown tables render correctly; numbers are plausible |
| Token budget | Step 6 | Count tokens in combined data anchors | <400 tokens per article's data anchor section |
| Article integration | Step 6 | Produce a discussion prompt with real data | Panel agents receive tables, cite specific numbers |

### Risk register (near-term build)

| Risk | Severity | Mitigation | Owner |
|------|----------|------------|-------|
| **nflreadpy API changes or breakage** | 🟢 Low | Pin version in `requirements.txt`. nflreadpy is MIT-licensed and stable. | Backend |
| **Parquet cache bloat in repo** | 🟡 Medium | `.gitignore` entry for `content/data/cache/`. Developer must run fetch script locally. | Backend |
| **Two-runtime overhead (Python + Node)** | 🟡 Medium | Isolate Python to `content/data/`. Document in SKILL.md. No changes to Node pipeline. | Backend |
| **Offseason data is static** | 🟡 Medium | Real near-term value is historical comparisons (2020-2025 seasons), not live data. Communicate this expectation. | Lead |
| **Token cost of data tables in panel prompts** | 🟡 Medium | Query scripts output pre-aggregated markdown tables. Add `--limit` and `--columns` flags. Budget: <400 tokens per data anchor section. | Backend |
| **Agent doesn't use the data** | 🟢 Low | Update Analytics charter + discussion prompt templates. Add "run this command" instructions to panel prompts. | Lead |
| **Distraction from publishing goals** | 🟡 Medium | Phase A is capped at 2-3 sessions. Must not delay next article. If it blocks article production, stop and reassess. | Lead |

### Open questions

1. **Python version requirement:** What Python version does Joe's environment run? nflreadpy requires Python ≥3.9. Need to verify before first session.
2. **Cache warm-up scope:** Should Phase A cache all seasons 2020-2025, or just 2025? All seasons is ~300 MB but enables historical comps immediately.
3. **FTN charting license:** CC-BY-SA-4.0 (copyleft) — does the SA clause affect how we use FTN data in articles? Likely fine for analysis (not redistribution of raw data), but worth a 5-min check.
4. **Stale cache during season:** During regular season, should fetch script auto-refresh if cache is >24 hours old? Or always require explicit `--refresh`? Defer this decision until pre-season.
5. **DVOA / Football Outsiders data:** Not available via nflverse. The Analytics charter lists DVOA as a knowledge area — it remains a "cite from public articles" source. Should the charter explicitly note this gap?

### Dependencies and sequencing

```
requirements.txt ──▶ fetch_nflverse.py ──▶ query_player_epa.py ──┐
                                       ├▶ query_team_efficiency.py ──├▶ SKILL.md ──▶ Analytics charter patch ──▶ Smoke test
                                       └▶ query_positional_comparison.py ─┘
```

All Phase A deliverables are sequentially dependent: you can't query without the cache, can't cache without nflreadpy, and shouldn't document the SKILL until the scripts are working. The charter patch and smoke test come last because they depend on knowing the exact script signatures.

---

## What This Unlocks: Article Quality Improvements

| Current State | With nflverse |
|--------------|---------------|
| "JSN had a breakout season with strong EPA numbers" (vague, from training data) | "JSN ranked 8th in receiving EPA/target (0.31) among WRs with 100+ targets, behind only Ja'Marr Chase (0.42) and CeeDee Lamb (0.38)" (real, queryable) |
| "The Seahawks defense improved in 2025" (narrative) | "SEA's defensive EPA/play improved from -0.02 (20th) to -0.09 (11th), driven by a 14% reduction in explosive play rate" (data) |
| "Witherspoon grades well per PFF" (paywalled, uncitable) | "Witherspoon allowed a 72.1 passer rating in coverage per PFR advanced stats, ranking 18th among CBs with 300+ coverage snaps" (nflverse PFR data — free!) |
| "Draft pick 15 has historically produced..." (generic) | "Since 2015, pick 15 has produced 2.8 AV/season on average; EDGE picks at 11-20 hit rate is 45% (starter-level by Year 3)" (computed from draft_picks data) |
| No gameday content | "Sunday Recap: Maye's 0.34 EPA/play led the Patriots past the Jets — here's what the numbers say about his Year 2 leap" |

---

## Data Licensing & Access Notes

- **nflverse data:** CC-BY-4.0 (all datasets except FTN charting which is CC-BY-SA-4.0)[^6]
- **nflreadpy:** MIT license[^2]
- **No API keys required:** Data hosted as GitHub Releases, downloaded via HTTP
- **No scraping:** This is structured data published by the nflverse project — not screen-scraping ESPN/PFR
- **PFR advanced stats available:** `load_pfr_advstats()` provides PFR data that's blocked when you try to web_fetch pfr.com directly[^4]
- **Cache-friendly:** Parquet files are ~10-50MB per season; full cache for 2020-2025 is ~300MB

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| **nflverse data freshness during gameday** | 🟡 Medium | Raw PBP available in 15min; cleaned data nightly. For Sunday articles, use raw PBP + stat corrections Thursday. |
| **Injury data gap (2025+)** | 🟡 Medium | nflverse injury source died post-2024[^5]. Continue using ESPN injury reports via web_fetch for current data. |
| **Polars dependency** | 🟢 Low | nflreadpy uses Polars (not pandas). Polars is fast and mature. Agents don't need to know — query scripts abstract it. |
| **Token cost of data tables** | 🟡 Medium | Large PBP tables eat context. Query scripts must return focused, pre-aggregated markdown tables — not raw DataFrames. |
| **Over-reliance on EPA** | 🟢 Low | EPA is the core metric but has known limitations (variance, small sample). Analytics charter already flags sample size issues[^4]. |
| **Data cache staleness** | 🟢 Low | Add a `last_updated` check to fetch scripts. During offseason, data barely changes. During season, nightly refresh suffices. |

---

## Confidence Assessment

| Claim | Confidence | Basis |
|-------|-----------|-------|
| nflreadpy can serve as primary structured data source | ✅ High | Verified API docs, GitHub releases, data schedule page[^1][^2][^3] |
| Tiers 0-1 require no infrastructure changes | ✅ High | nflreadpy installs via pip, downloads parquet from GitHub — verified from docs |
| Analytics charter should absorb Tiers 0-2 | ✅ High | Charter already covers EPA, DVOA, WPA, positional value, contract value[^4] — just needs data access |
| DataScience should be a separate agent (Tier 4) | 🟡 Medium | Based on skill boundary analysis — code-writing vs. interpretation are different agent modalities |
| Gameday review is feasible same-day | 🟡 Medium | nflverse data schedule confirms 15-min raw PBP availability[^3]; untested in this pipeline |
| FTN charting data will be useful for scheme analysis | 🟡 Medium | Available since 2022, CC-BY-SA-4.0 license — but not yet integrated so quality for article use is unverified |
| Existing extension pattern (shell-out to Python) works for Tier 3 | ✅ High | `pipeline-telemetry.mjs` already shells to Python[^8]; same pattern applies |

---

## Footnotes

[^1]: [nflverse/nflverse-data](https://github.com/nflverse/nflverse-data) — Central data repository. 339 stars, automated GitHub Actions pipelines.

[^2]: [nflreadpy](https://nflreadpy.nflverse.com) — Python port of nflreadr. Uses Polars DataFrames. `pip install nflreadpy`. MIT licensed.

[^3]: nflverse data schedule — https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html. PBP available within 15 minutes post-game via `nflfastR::build_nflfastR_pbp()`. Cleaned data updates nightly. Stat corrections applied Wednesday; Thursday data is cleanest.

[^4]: `.squad/agents/analytics/charter.md` — Analytics charter lists PFR as a data source but notes "🔴 Blocked (403) — use cached/known data only." EPA, DVOA, WPA, success rate are all described as knowledge areas but have no programmatic data access.

[^5]: nflverse injury data — Source died after the 2024 season. "At the moment, there is no 2025 data and there is no ETA yet." Continue using ESPN web_fetch for current injury data.

[^6]: nflreadpy license page — "The majority of all nflverse data available is broadly licensed as CC-BY 4.0, and the FTN data is CC-BY-SA 4.0."

[^7]: Existing Copilot extensions at `.github/extensions/`: `gemini-imagegen`, `substack-publisher`, `table-image-renderer`, `pipeline-telemetry.mjs`.

[^8]: `.github/extensions/pipeline-telemetry.mjs` — Shells into `content/pipeline_state.py record-usage-event` to record telemetry. Same shell-out pattern works for nflverse queries.

[^9]: `.squad/config/models.json:86-103` — `agentic_code` task family with precedence list starting at `gpt-5.3-codex`. Designed for agents that write and execute code.
