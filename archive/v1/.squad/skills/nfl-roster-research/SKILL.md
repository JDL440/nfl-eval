---
name: "nfl-roster-research"
description: "How to fetch roster, depth chart, transaction, and schedule data from ESPN, NFL.com, and PFR"
domain: "nfl-data-acquisition"
confidence: "low"
source: "observed — probed live URLs 2026-03-12"
tools:
  - name: "web_fetch"
    description: "Fetches web pages and returns markdown/HTML content"
    when: "Fetching ESPN, NFL.com, or other public NFL data sources for roster and team info"
---

## Context

Beyond salary cap data (OTC/Spotrac), agents need roster composition, depth charts, transaction history, and game results. ESPN and NFL.com are the primary fetchable sources. Pro Football Reference (PFR) blocks web_fetch with 403 errors — do NOT attempt it. For transaction news and trade/contract context, see the `pro-football-rumors` skill (ProFootballRumors.com).

## Patterns

### 1. ESPN Team Roster

**URL:** `https://www.espn.com/nfl/team/roster/_/name/{abbr}/{team-slug}`

**Team abbreviations:** `ari`, `atl`, `bal`, `buf`, `car`, `chi`, `cin`, `cle`, `dal`, `den`, `det`, `gb`, `hou`, `ind`, `jax`, `kc`, `lac`, `lar`, `lv`, `mia`, `min`, `ne`, `no`, `nyg`, `nyj`, `phi`, `pit`, `sea`, `sf`, `tb`, `ten`, `wsh`

**Team slugs for ESPN:** `arizona-cardinals`, `atlanta-falcons`, etc. (same as OTC)

**Returns:** Full roster split by unit (Offense, Defense, Special Teams):
- Player name with ESPN player page link
- Jersey number, Position, Age, Height, Weight, Experience, College

**Key data to extract:**
- Roster composition by position group
- Player ages and experience levels (roster age profile)
- College pipeline patterns
- Jersey numbers for identification

**Example fetch:**
```
web_fetch("https://www.espn.com/nfl/team/roster/_/name/buf/buffalo-bills", max_length=10000)
```

### 2. ESPN Depth Chart (HIGH VALUE)

**URL:** `https://www.espn.com/nfl/team/depth/_/name/{abbr}/{team-slug}`

**Returns:** Full depth chart organized by formation:
- Offensive formation (e.g., "3WR 1TE"): QB, RB, WR, WR, WR, TE, LT, LG, C, RG, RT
- Defensive formation (e.g., "Base 4-3 D"): LDE, LDT, RDT, RDE, WLB, MLB, SLB, LCB, SS, FS, RCB, NB
- Special Teams: PK, P, H, PR, KR
- Up to 4 deep at each position (Starter, 2nd, 3rd, 4th)
- Injury designations marked with "Q" (questionable), "O" (out), etc.

**Key data to extract:**
- Starters at every position — the "starting 22"
- Depth quality — are there viable backups?
- Scheme indicators (formation names reveal defensive/offensive alignment)
- Injury flags on depth chart players
- Competition battles (when 2nd string is close to starter)

**Example fetch:**
```
web_fetch("https://www.espn.com/nfl/team/depth/_/name/ari/arizona-cardinals", max_length=8000)
```
**Example extracted data (ARI offense):**
- QB: Jacoby Brissett (starter), Gardner Minshew (2nd), Kedon Slovis (3rd)
- RB: James Conner (Q), Tyler Allgeier (2nd), Trey Benson (Q) (3rd)
- WR1: Marvin Harrison Jr. (Q)
- TE: Trey McBride, Tip Reiman (Q) (2nd)
- Scheme: 3WR 1TE (offense), Base 4-3 D (defense)

### 3. ESPN Transactions (HIGH VALUE for offseason tracking)

**URL:** `https://www.espn.com/nfl/team/transactions/_/name/{abbr}/{team-slug}`

**Returns:** Chronological list of team transactions:
- Date and full transaction description
- Signings, releases, trades, IR placements, coaching hires/fires
- Grouped by month

**Key data to extract:**
- Free agency signings with contract terms mentioned
- Releases (cap implications)
- Coaching changes (scheme shifts)
- IR placements (returning players)
- Draft picks traded

**Example fetch:**
```
web_fetch("https://www.espn.com/nfl/team/transactions/_/name/ari/arizona-cardinals", max_length=5000)
```
**Example extracted data:**
- March 12: Signed Tyler Allgeier (2yr), multiple 1yr deals
- March 11: Released Kyler Murray. Signed Roy Lopez (2yr), Isaac Seumalo (3yr)
- Feb 1: Hired Mike LaFleur as HC (5yr contract)
- Jan 5: Fired Jonathan Gannon

### 4. ESPN Schedule/Results

**URL:** `https://www.espn.com/nfl/team/schedule/_/name/{abbr}/{team-slug}`

**Returns:** Full season schedule with:
- Week, Date, Opponent (home/away indicated by @ or vs)
- Result with score and link to game page
- Win-Loss record progression
- Game leaders: Hi Pass, Hi Rush, Hi Rec with yardage

**Key data to extract:**
- Win-loss record and trajectory
- Home vs away performance
- Key player performance trends (who showed up in stats leaders)
- Division record and opponents

### 5. NFL.com Roster

**URL:** `https://www.nfl.com/teams/{team-slug}/roster`

**Returns:** Alphabetical roster with:
- Player photo, Name, Number, Position, Status (ACT/UFA/RFA/ERFA), Height, Weight, Experience, College

**Status codes are valuable:**
- `ACT` = Active roster
- `UFA` = Unrestricted Free Agent (not under contract)
- `RFA` = Restricted Free Agent
- `ERFA` = Exclusive Rights Free Agent

**Key data to extract:**
- UFA/RFA/ERFA tags — identifies which players are free agents
- Status filtering helps identify roster holes
- NFL.com often has the most up-to-date status flags

**Example fetch:**
```
web_fetch("https://www.nfl.com/teams/arizona-cardinals/roster", max_length=8000)
```

### 6. ESPN Player Pages

**URL:** `https://www.espn.com/nfl/player/_/id/{espn-id}/{player-slug}`

ESPN player IDs can be extracted from roster/depth chart pages. Useful for individual player stats, bio, and news.

## Examples

### Full team research workflow
```
# Step 1: Current roster composition
web_fetch("https://www.espn.com/nfl/team/roster/_/name/buf/buffalo-bills", max_length=10000)

# Step 2: Depth chart and scheme
web_fetch("https://www.espn.com/nfl/team/depth/_/name/buf/buffalo-bills", max_length=8000)

# Step 3: Recent transactions (what changed this offseason)
web_fetch("https://www.espn.com/nfl/team/transactions/_/name/buf/buffalo-bills", max_length=5000)

# Step 4: Last season results
web_fetch("https://www.espn.com/nfl/team/schedule/_/name/buf/buffalo-bills", max_length=8000)

# Step 5: Free agent status check
web_fetch("https://www.nfl.com/teams/buffalo-bills/roster", max_length=8000)
```

### Identifying team needs
Combine depth chart (thin positions) + transactions (who left) + roster status (UFAs not re-signed) to map team needs.

## Anti-Patterns

- **DO NOT fetch Pro Football Reference (PFR)** — All URLs return HTTP 403 (Forbidden). This includes player pages (`/players/M/MahoPa00.htm`), team pages (`/teams/crd/2025_roster.htm`), and all other PFR paths. PFR aggressively blocks automated fetching.
- **DO NOT use PFR as a data source** — Despite being referenced in agent charters, it is not accessible via web_fetch. Use ESPN schedule/results for game data and OTC/Spotrac for contract history instead.
- **ESPN depth charts may be stale** during the offseason — they often reflect the last regular-season depth chart, not projected starters.
- **NFL.com roster data is alphabetical** not by position group — you'll need to scan/filter mentally or parse for specific positions.
- **ESPN transaction pages show current year** — there's no easy URL pattern to go back to prior year transactions.
- **Set `max_length` appropriately:** Roster pages need 8000-10000. Depth charts fit in 6000-8000. Transactions are compact at 3000-5000.
