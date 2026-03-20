---
name: "spotrac-data"
description: "How to fetch and extract salary cap and free agent data from Spotrac.com using web_fetch"
domain: "nfl-data-acquisition"
confidence: "low"
source: "observed — probed live URLs 2026-03-12"
tools:
  - name: "web_fetch"
    description: "Fetches web pages and returns markdown/HTML content"
    when: "Fetching any Spotrac URL to extract cap, contract, or free agent data"
---

## Context

Spotrac is a primary NFL financial data source, complementary to OverTheCap. Its key advantage: the **free agent tracker works with web_fetch** (unlike OTC's JS-only version). Spotrac also provides excellent individual contract pages with detailed guarantee notes and incentive breakdowns. Use Spotrac as the go-to for free agency data and OTC for team cap snapshots.

## Patterns

### 1. Team Cap Table

**URL:** `https://www.spotrac.com/nfl/{team-slug}/cap`

**Team slugs:** Lowercase hyphenated: `arizona-cardinals`, `buffalo-bills`, `dallas-cowboys`, etc. (same pattern as OTC)

**Returns:** Full cap allocation table including:
- Total Cap Allocations (with league rank)
- Top 51 Cap Space (with league rank)
- Reserve Lists amount
- Dead Cap total (with league rank)
- Per-player rows: Position, Age, Cap Hit, Cap Hit % of League Cap, Dead Cap, Base P5 Salary, Signing Bonus Proration, Per Game Bonus, Roster Bonus, Option Bonus, Workout Bonus, Restructure Proration, Incentives

**Key data to extract:**
- `Total Cap Allocations` and `Top 51 Cap Space` — headline numbers
- League rank for each metric (e.g., "$38,448,790 / 10th")
- Cap Hit % of League Cap per player — quick way to see who's eating cap
- Dead Cap column — cut/trade analysis
- Player links contain `/nfl/player/_/id/{spotrac-id}/{slug}` — save for contract lookups

**Example fetch:**
```
web_fetch("https://www.spotrac.com/nfl/arizona-cardinals/cap", max_length=12000)
```
**Example extracted data:**
- Total Cap Allocations: $284,555,673 / 24th
- Top 51 Cap Space: $38,448,790 / 10th
- Dead Cap: $25,251,854 / 15th
- Top hit: Kyler Murray QB $52,660,677 (17.48% of cap)

### 2. Free Agent Tracker (KEY ADVANTAGE over OTC)

**URL:** `https://www.spotrac.com/nfl/free-agents`

**Filter variants:**
- Signed only: `https://www.spotrac.com/nfl/free-agents/signed/_/year/2026`
- Available only: `https://www.spotrac.com/nfl/free-agents/available/_/year/2026`

**Returns:** Full table of free agent signings/availability:
- From Team → To Team (with team logos)
- Player name (with link to contract page)
- Position
- Years, Total Value, AAV, Total Guaranteed, Guaranteed at Signing
- Potential Out (e.g., "2 yr / $38,000,000")

**Key data to extract:**
- Top signings by position — market-setting deals
- Team-specific moves (search for team abbreviations in from/to columns)
- Guarantee structures — what % is guaranteed at signing vs total
- Potential outs — real contract length vs nominal length

**Example fetch:**
```
web_fetch("https://www.spotrac.com/nfl/free-agents", max_length=12000)
```
**Example extracted data (2026 FA signings):**
- Jaelan Phillips: PHI→CAR, 4yr/$120M, $30M AAV, $80M total GTD
- Trey Hendrickson: CIN→BAL, 4yr/$112M, $28M AAV, $60M total GTD
- Tyler Linderbaum: BAL→LV, 3yr/$81M, $27M AAV, $81M total GTD, $60M at signing

### 3. Individual Player Contract

**URL:** `https://www.spotrac.com/nfl/player/_/id/{spotrac-id}/{player-slug}`

**How to find IDs:** Extract from team cap page or free agent tracker links. Example: Kyler Murray = `/nfl/player/_/id/29036/kyler-murray`.

**Returns:** Extremely detailed contract page:
- Header: Age, Experience, Country, College, Draft info, Agent
- Current cap hit and cash earnings
- Career earnings total
- Contract summary: Years, Total Value, Average Salary, Signing Bonus, GTD at Sign, Total GTD, Free Agent year
- Year-by-year tables showing:
  - Cap Hit view (cap hit, cap %, dead cap per year)
  - Salary breakdown view (base, signing proration, roster bonus, option proration, workout bonus)
  - Cash flow view (cash per year, cumulative, remaining)
- Potential out years with dead cap implications
- Contract Notes — detailed guarantee trigger language, bonus schedules, escalators

**Key data to extract:**
- Contract summary line (e.g., "5 yr(s) / $230,500,000")
- GTD at Sign vs Total GTD — reveals true commitment
- Potential Out year and dead cap — when can team escape?
- Year-by-year cap hits for future planning
- Contract Notes section — guarantee triggers with specific dates
- Escalator/incentive details

**Example fetch:**
```
web_fetch("https://www.spotrac.com/nfl/player/_/id/29036/kyler-murray", max_length=8000)
```
**Example extracted data:**
- Contract: 5yr/$230,500,000 (Rookie Extension, signed 2022)
- Average Salary: $46,100,000
- GTD at Sign: $103,300,000 / Total GTD: $159,797,000
- 2026 Cap Hit: $52,660,677 / Dead Cap: $54,718,177
- Potential Out: 2028, 6yr, $176.7M earned, $0 dead cap
- Free Agent: 2029 / UFA

## Examples

### Full free agency research workflow
```
# Step 1: See all signed free agents
web_fetch("https://www.spotrac.com/nfl/free-agents", max_length=15000)
# Identify major signings, market-setting deals

# Step 2: Check available FAs still unsigned
web_fetch("https://www.spotrac.com/nfl/free-agents/available/_/year/2026", max_length=10000)
# Identify remaining targets for teams with cap space

# Step 3: Deep-dive a specific signing
web_fetch("https://www.spotrac.com/nfl/player/_/id/72398/jaelan-phillips", max_length=8000)
# Get full contract breakdown for analysis
```

### Comparing OTC and Spotrac for same team
Both sources track cap data but may show slightly different numbers due to timing of updates or methodology. When numbers differ by >$1M, note both figures and flag the discrepancy. Spotrac's league rankings (e.g., "10th in cap space") are a useful quick reference that OTC doesn't provide inline.

## Anti-Patterns

- **DO NOT rely solely on default `max_length`** — Free agent lists and team cap tables are large. Use `max_length=10000-15000` to avoid truncation of important mid-tier players.
- **DO NOT assume Spotrac and OTC numbers match exactly** — They may differ by small amounts due to methodology or update timing. Record both when precision matters.
- **Pagination:** Free agent list may be truncated. Use `start_index` parameter on web_fetch to get additional pages if the response indicates truncation.
- **Spotrac season filter URLs** use `_/year/2026` format — don't try query string parameters like `?year=2026`.
- **Player pages are long** — The contract details, earnings, injuries, transactions, stats, and market value tabs all render. Focus on the `#contracts` section for cap analysis. Consider using `max_length=6000-8000` to get the contract data without wading through stats.
