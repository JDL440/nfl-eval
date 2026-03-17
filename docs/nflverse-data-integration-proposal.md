# Proposal: nflverse Data Integration

> **Status:** Research / Planning
> **Author:** Lead (Lead Orchestrator & GM Analyst)
> **Requested by:** Joe Robinson
> **Date:** 2025-07-25

---

## Executive Summary

nflverse is an open-data ecosystem for NFL analysis that provides play-by-play data, player stats, precomputed advanced metrics, roster snapshots, draft data, and more — all free, file-based, and updated on a nightly cadence. Integrating nflverse data into our article-analysis pipeline would give every agent access to structured analytical data that currently requires manual web scraping from OTC, Spotrac, ESPN, and other sources. This proposal scopes the research needed to evaluate that integration.

---

## Problem Statement

Today, our 47-agent pipeline relies on live web fetches for analytical data:

- **OTC** for salary cap figures
- **Spotrac** for free agent tracking and contracts
- **ESPN** for rosters, depth charts, and transactions
- **NFL.com** for UFA/RFA/ERFA tags

These sources work, but they have real limitations:

| Limitation | Impact |
|-----------|--------|
| No historical play-by-play data | Can't back claims with on-field evidence ("Witherspoon allowed X catches") |
| No precomputed advanced metrics (EPA, CPOE, WP) | Articles lack the analytical depth of top-tier outlets |
| Web scraping is fragile (PFR already blocks us) | One source change can break a data skill |
| No reproducibility | Two agents querying the same source at different times may get different data |
| No structured efficiency/scheme data | Offense and Defense agents argue from reputation, not from play-level evidence |

**Bottom line:** Our articles are cap-and-contract strong but analytically thin. nflverse data could close that gap.

---

## Why This Matters

### For Article Quality
- **Data-grounded arguments:** Panel agents could cite actual EPA per dropback, CPOE, or yards after catch stats instead of qualitative assessments
- **Historical context:** Play-by-play since 1999 enables "how does this compare to..." narratives that readers love
- **Efficiency narratives:** Scheme breakdowns become possible with play type, personnel grouping, and situation data
- **Draft coverage depth:** Combine measurements and draft pick value models enhance CollegeScout's evaluations

### For the Platform Vision
- **Reproducibility:** File-based data means every agent sees the same numbers, every time
- **Automation-ready:** Nightly-updated files fit the Phase 2 automated pipeline (cron → refresh → article triggers)
- **Competitive moat:** Integrating structured analytical data makes our content harder to replicate than scraping the same public websites everyone else uses

---

## What nflverse Provides

### Data Domains

| Domain | Coverage | Key Fields | Priority for Us |
|--------|----------|-----------|----------------|
| **Play-by-play** | 1999–present | Down, distance, yard line, play type, personnel, EPA, WP, CP, CPOE, XYAC | 🔴 HIGH |
| **Player stats** (weekly + seasonal) | Current + historical | Passing, rushing, receiving stats with advanced metrics | 🔴 HIGH |
| **Rosters / participation** | Seasonal + weekly | Player-team mapping, positions, status | 🟡 MEDIUM |
| **Team schedules + results** | Current + historical | Scores, standings context, home/away | 🟡 MEDIUM |
| **Draft picks + combine** | Historical | Pick number, pick value, combine measurements | 🟡 MEDIUM |
| **Draft pick values** | Calculated | Trade value charts | 🟢 LOW (nice-to-have) |
| **Player ID mappings** | Cross-source | Links across ESPN, PFR, PFF, GSIS IDs | 🟢 LOW (useful for data joins) |
| **Team branding assets** | Static | Colors, logos, abbreviations | 🟢 LOW |

### Access Paths

| Method | Language | Package/Repo | Notes |
|--------|----------|-------------|-------|
| **Direct file access** | Any | `nflverse/nflverse-data` GitHub releases | Parquet and CSV files, no API key needed |
| **Python** | Python | `nfl_data_py` | Wrapper around the release files, caches locally |
| **R** | R | `nflreadr` / `nflfastR` | The original ecosystem — richest documentation |

### What nflverse Is NOT

- ❌ Not a live event-driven API (no real-time game data)
- ❌ Not raw Next Gen Stats tracking data (no player movement coordinates)
- ❌ Not real-time betting odds
- ❌ Not a live injury feed
- ❌ Data freshness is nightly at best — not suitable for breaking-news workflows

---

## Proposed First Phase

### Phase 1A: Proof of Concept (1–2 sessions)

**Goal:** Validate that nflverse data is accessible, useful, and integratable without disrupting the existing pipeline.

1. **Install `nfl_data_py`** in the repo environment
2. **Pull one season of play-by-play data** (2024 or 2025) and validate schema, size, and quality
3. **Pull weekly player stats** for the current season
4. **Build a minimal data access helper** (a Python module in `content/` or a new `data/` directory) that:
   - Downloads and caches nflverse parquet/CSV files locally
   - Exposes simple query functions: `get_player_stats(player, season)`, `get_team_efficiency(team, season)`, `get_play_by_play(team, week)`
5. **Test with one article idea:** Take an existing article topic (e.g., a player extension analysis) and show what nflverse data would add to the discussion prompt

**Success criteria:**
- Data loads in <30 seconds for a full season
- At least 3 article types benefit from the data (extension analysis, draft preview, team offseason review)
- No disruption to existing OTC/Spotrac/ESPN data skills

### Phase 1B: Agent Integration (2–3 sessions)

**Goal:** Wire nflverse data into the panel discussion workflow.

1. **Create a `nflverse-data` skill** (`.squad/skills/nflverse-data/SKILL.md`) documenting:
   - Available data domains and their schemas
   - How to query via the helper module
   - Which article types benefit from which data domains
2. **Update discussion prompt templates** to include nflverse data anchors when relevant
3. **Pilot with Analytics agent:** Analytics is the natural first consumer — give it EPA, CPOE, and efficiency data for panel contributions
4. **Pilot with CollegeScout:** Draft combine and pick value data for prospect evaluations

### Phase 1C: Automation & Refresh (future)

**Goal:** Automate data freshness so agents always have current data.

1. **Nightly GitHub Action** that refreshes cached nflverse files
2. **Data versioning** — track which data vintage each article was produced against
3. **Staleness alerts** — flag when cached data is >48 hours old during the season

---

## Workflow Implications

### Data Storage & Caching
- nflverse files are parquet/CSV, typically 50–200MB per season for play-by-play
- Recommend a `data/nflverse/` directory at repo root with `.gitignore` entries (don't commit raw data files)
- Cache locally, refresh on schedule
- Consider DuckDB or SQLite for local querying of parquet files

### Article-Type Mapping

| Article Type | nflverse Data That Helps | Current Gap Filled |
|-------------|-------------------------|-------------------|
| Player extension analysis | Career EPA, snap counts, efficiency trends | "Is he actually good?" with numbers |
| Team offseason review | Team offensive/defensive EPA rankings, personnel tendencies | Scheme identity with evidence |
| Draft prospect evaluation | Combine measurements, draft pick value models | Quantitative prospect comps |
| Free agent target board | Player efficiency stats, usage rates | Separating "name" from "production" |
| Rivalry / divisional preview | Head-to-head play-by-play, historical trends | Deep rivalry context |
| Scheme breakdown | Personnel groupings, play type distributions, situation data | Actual X's and O's evidence |

### Reproducibility
- All nflverse data is versioned by release date
- Pin data to a specific release for each article → any agent can reproduce the same analysis
- This aligns with the Phase 2 automation vision: deterministic inputs → deterministic articles

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Data staleness during season** | 🟡 Medium | Nightly refresh Action; staleness flag in data helper |
| **Storage bloat** | 🟢 Low | `.gitignore` raw files; cache only current + prior season |
| **Python dependency in a Node/JS repo** | 🟡 Medium | Evaluate whether a direct-file approach (fetch parquet, query with DuckDB-WASM) avoids Python dependency |
| **Maintenance burden** | 🟡 Medium | nflverse is community-maintained; pin to stable releases, don't depend on bleeding edge |
| **Missing domains** (no live odds, no NGS tracking, no injury feed) | 🟡 Medium | Accept scope: nflverse is for post-game analysis, not breaking news. Keep OTC/Spotrac for real-time cap data |
| **Agent context bloat** | 🟡 Medium | Data helper should return summaries/aggregates, not raw play-by-play dumps |
| **Learning curve** | 🟢 Low | nflverse has excellent documentation; `nfl_data_py` is well-documented |

---

## Research Questions for the GitHub Issue

These are the questions we need to answer before committing to implementation:

1. **Access method:** Should we use `nfl_data_py` (Python), direct file downloads (language-agnostic), or both?
2. **Storage strategy:** Local cache in `data/nflverse/`, DuckDB, SQLite, or in-memory?
3. **Which data domains first?** Play-by-play + player stats seem highest-value — confirm with a pilot.
4. **Agent integration model:** Do agents query data directly, or does a data-service agent pre-compute summaries?
5. **Refresh cadence:** Nightly during season, weekly during offseason?
6. **Impact on article cost:** Does adding nflverse data increase token usage significantly (context bloat)?
7. **Compatibility with existing data skills:** Can nflverse supplement OTC/Spotrac, or does it create conflicting numbers?

---

## Recommendation

**Proceed with Phase 1A as a research spike.** The potential upside — analytically richer articles backed by real on-field data — is significant and directly addresses the platform's biggest quality gap. The risk is low: nflverse is free, well-documented, and we can evaluate it without changing any existing pipeline code.

Assign the GitHub issue to Lead with `squad:analytics` as a secondary label, since Analytics is the primary beneficiary of this data.

---

## References

- [nflverse GitHub organization](https://github.com/nflverse)
- [nflverse-data releases](https://github.com/nflverse/nflverse-data/releases)
- [`nfl_data_py` Python package](https://github.com/nflverse/nfl_data_py)
- [`nflfastR` (R)](https://github.com/nflverse/nflfastR)
- [`nflreadr` (R)](https://github.com/nflverse/nflreadr)
- Project VISION: `VISION.md`
- Article Lifecycle: `.squad/skills/article-lifecycle/SKILL.md`
