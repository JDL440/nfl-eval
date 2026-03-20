---
name: "overthecap-data"
description: "How to fetch and extract salary cap data from OverTheCap.com using web_fetch"
domain: "nfl-data-acquisition"
confidence: "low"
source: "observed — probed live URLs 2026-03-12"
tools:
  - name: "web_fetch"
    description: "Fetches web pages and returns markdown/HTML content"
    when: "Fetching any OverTheCap URL to extract cap, contract, or positional market data"
---

## Context

OverTheCap (OTC) is a primary source for NFL salary cap data. Agents use it to get team cap tables, individual player contracts, positional market comparisons, and league-wide cap space rankings. This skill teaches agents which URLs return usable data via `web_fetch` and how to extract the key numbers.

OTC renders most tabular data server-side (good for us), but some pages (notably free agency listings) load data via JavaScript and return only empty table headers.

## Patterns

### 1. Team Salary Cap Table (PRIMARY — best OTC endpoint)

**URL:** `https://overthecap.com/salary-cap/{team-slug}`

**Team slugs:** Use lowercase hyphenated full names:
`arizona-cardinals`, `atlanta-falcons`, `baltimore-ravens`, `buffalo-bills`, `carolina-panthers`, `chicago-bears`, `cincinnati-bengals`, `cleveland-browns`, `dallas-cowboys`, `denver-broncos`, `detroit-lions`, `green-bay-packers`, `houston-texans`, `indianapolis-colts`, `jacksonville-jaguars`, `kansas-city-chiefs`, `las-vegas-raiders`, `los-angeles-chargers`, `los-angeles-rams`, `miami-dolphins`, `minnesota-vikings`, `new-england-patriots`, `new-orleans-saints`, `new-york-giants`, `new-york-jets`, `philadelphia-eagles`, `pittsburgh-steelers`, `san-francisco-49ers`, `seattle-seahawks`, `tampa-bay-buccaneers`, `tennessee-titans`, `washington-commanders`

**Returns:** Full active roster salary table including:
- Player name (with link containing player slug/ID)
- Base Salary, Prorated Bonus, Roster Bonus, Workout Bonus, Other Bonus
- Guaranteed Salary, Cap Number, Dead Money & Cap Savings
- Summary totals: Total Cap Liabilities, Top 51, Team Cap Space
- Offense/Defense/Special Teams spending breakdown
- Top Executive name and title

**Key data to extract:**
- `Total Cap Liabilities` and `Team Cap Space` — headline numbers
- Top 10 cap hits — identifies cap-heavy players
- Dead Money column — reveals cut candidates (high dead = hard to cut)
- Player links contain `/player/{slug}/{id}/` — save these for contract lookups

**Example fetch:**
```
web_fetch("https://overthecap.com/salary-cap/arizona-cardinals", max_length=12000)
```
**Example extracted data:**
- Total Cap Liabilities: $285,984,342
- Top 51: $249,908,196
- Team Cap Space: $41,678,185
- Top cap hit: Kyler Murray $52,660,677
- Top Executive: Monti Ossenfort, General Manager (since 2023)

### 2. Player Contract Details

**URL:** `https://overthecap.com/player/{player-slug}/{player-id}`

**How to find player IDs:** Extract from team salary cap page links. Example: `/player/kyler-murray/7792/` → slug=`kyler-murray`, id=`7792`. Patrick Mahomes is `/player/patrick-mahomes/5594/`.

**Returns:** Year-by-year contract breakdown including:
- Age, Free Agency year, Accrued Seasons
- Each year: Base Salary, Prorated Signing Bonus, Roster Bonus, Workout Bonus, Guaranteed Salary, Cap Number, Cap %, Dead Money
- Contract notes with guarantee triggers and dates
- 2026 Salary Cap Charge and Cash Payout
- Contract Value and APY
- Cash to Cap Ratio

**Key data to extract:**
- Current year cap hit and dead money (cut analysis)
- Guarantee trigger dates (e.g., "March 15: $10.4M 2026 roster bonus is guaranteed")
- Potential out years (when team can escape contract)
- APY ranking at position

### 3. League-Wide Cap Space Rankings

**URL:** `https://overthecap.com/salary-cap-space`

**Returns:** All 32 teams ranked by cap space for current + future years:
- Cap Space (raw)
- Effective Cap Space (after projected roster moves)
- Number of players under contract
- Active Cap Spending
- Dead Money

**Key data to extract:**
- Team's rank and cap space for trade/FA analysis
- Effective vs raw cap space delta (reveals roster construction tightness)
- Dead money leaders (teams in "cap hell")
- Future year projections (2027, 2028)

### 4. Positional Contract Market

**URL:** `https://overthecap.com/position/{position-name}`

**Position names:** `quarterback`, `running-back`, `wide-receiver`, `tight-end`, `left-tackle`, `left-guard`, `center`, `right-guard`, `right-tackle`, `interior-defensive-line`, `edge-rusher`, `linebacker`, `safety`, `cornerback`, `kicker`, `punter`, `long-snapper`

**Returns:** All contracts at position sorted by APY:
- Player, Team, Age, Total Value, Avg/Year, Total Guaranteed, Fully Guaranteed, Free Agency year

**Key data to extract:**
- Market rate for position (top 5 APY = premium, 6-15 = solid starter, etc.)
- Guarantee percentages (market standard for negotiations)
- Comparable contracts for valuation analysis

## Examples

### Researching a team's cap situation
```
# Step 1: Get team cap table
web_fetch("https://overthecap.com/salary-cap/buffalo-bills", max_length=12000)
# Extract: Cap Space, top cap hits, dead money totals

# Step 2: Identify specific player contracts of interest
web_fetch("https://overthecap.com/player/josh-allen/6892")
# Extract: Year-by-year breakdown, out years, guarantee triggers

# Step 3: Compare to league
web_fetch("https://overthecap.com/salary-cap-space")
# Extract: Bills' rank in cap space, effective cap space
```

### Evaluating a contract in market context
```
# Get QB market
web_fetch("https://overthecap.com/position/quarterback")
# Compare player's APY to positional rankings
```

## Anti-Patterns

- **DO NOT use `/free-agency`** — Data loads via JavaScript; web_fetch returns only empty table headers with preloader GIFs. Use Spotrac free agent tracker instead.
- **DO NOT use `/cap-tracker`** — Returns 404.
- **DO NOT guess player IDs** — The ID `4650` for Mahomes returns wrong player (Mike Johnson). Always extract IDs from team salary pages first.
- **DO NOT use `/contracts/{team-slug}`** — Returns league-wide contract list, not team-filtered. Data may load via JS. Use `/salary-cap/{team-slug}` for team data.
- **Set `max_length=10000-15000`** for team salary pages — full rosters are 60-70 players and default 5000 chars truncates heavily.
- **Year tabs** on team pages (`#y2026`, `#y2027`) are JavaScript-driven — you always get the default year. To see future year projections, use `/salary-cap-space` which shows multi-year data server-side.
