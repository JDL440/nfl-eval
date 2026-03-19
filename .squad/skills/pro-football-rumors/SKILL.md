---
name: "pro-football-rumors"
description: "How to fetch NFL transaction news, contract details, and roster-move context from ProFootballRumors.com using web_fetch"
domain: "nfl-data-acquisition"
confidence: "low"
source: "observed — probed live URLs 2026-03-19"
tools:
  - name: "web_fetch"
    description: "Fetches web pages and returns markdown/HTML content"
    when: "Fetching ProFootballRumors.com for transaction news, contract intel, trade rumors, or free agency context"
---

## Context

Pro Football Rumors (PFR) is a high-volume NFL news aggregator focused on transactions: free agent signings, trades, contract extensions, franchise tags, coaching hires, and roster moves. Content is written by staff reporters who synthesize primary sources (beat reporters, NFL Network, ESPN insiders) with contract figures and historical context.

PFR is **not paywalled**, has **no CAPTCHA**, and returns **clean markdown** via web_fetch. Articles include bolded player names linked to Pro Football Reference, dollar figures for contracts, and inline source attribution. This makes it ideal for gathering narrative context around roster moves that complements the structured data from OTC/Spotrac.

**Use PFR for:** Current transaction news, trade rumors, contract negotiation context, free agency tracker, coaching carousel updates.
**Use OTC/Spotrac for:** Precise cap numbers, year-by-year contract breakdowns, positional market data.

## Patterns

### 1. Team News Search (PRIMARY — most useful endpoint)

**URL:** `https://www.profootballrumors.com/?s={team name}`

Use the full team name or city as the search term. Spaces in the URL work (the site handles encoding).

**Returns:** List of recent articles mentioning the team, each with:
- Article headline (linked)
- URL path
- Excerpt with matching terms bolded
- Context: contract values, transaction details, source attribution

**Key data to extract:**
- Recent signings, releases, trades involving the team
- Contract dollar amounts mentioned in excerpts
- Franchise tag and extension negotiation status
- Coaching and front office changes
- Other teams' interest in the team's free agents

**Example fetches:**
```
web_fetch("https://www.profootballrumors.com/?s=Seattle Seahawks", max_length=8000)
web_fetch("https://www.profootballrumors.com/?s=Buffalo Bills", max_length=8000)
```

**Example extracted data (Seahawks search):**
- "Eagles To Add CB Riq Woolen" — one-year deal worth up to $15MM
- "Bears To Sign LB Devin Bush" — spent one season in Seattle, $3.5MM deal

### 2. Player News Search (HIGH VALUE for article research)

**URL:** `https://www.profootballrumors.com/?s={player name}`

Use the player's full name. Works well for first+last combinations.

**Returns:** All articles mentioning the player — trade rumors, contract talks, free agency updates, injury context.

**Key data to extract:**
- Contract demands and team offers
- Trade interest from other teams
- Historical contract comparables cited in articles
- Agent information and negotiation dynamics

**Example fetches:**
```
web_fetch("https://www.profootballrumors.com/?s=Geno Smith", max_length=8000)
web_fetch("https://www.profootballrumors.com/?s=George Pickens", max_length=8000)
```

**Example extracted data (Geno Smith search):**
- Raiders reunion with Pete Carroll, new contract expected
- High ankle sprain in Week 17, missed finale
- Raiders trade not expected to eliminate first-round QB interest

### 3. Topic Search (trades, extensions, draft, free agency)

**URL:** `https://www.profootballrumors.com/?s={topic keyword}`

Use single broad keywords for topic searches. Multi-word searches work but single keywords cast a wider net.

**Effective keywords:** `trade`, `extension`, `franchise tag`, `released`, `retired`, `coaching`, `draft`, `quarterback`

**Example fetches:**
```
web_fetch("https://www.profootballrumors.com/?s=trade", max_length=8000)
web_fetch("https://www.profootballrumors.com/?s=extension", max_length=8000)
```

### 4. Individual Article Deep-Dive

**URL:** Full article URL from search results (e.g., `https://www.profootballrumors.com/2026/03/{article-slug}`)

**Returns:** Full article text in clean markdown:
- Player names **bolded** and linked to PFR player pages
- Contract figures with specific dollar amounts
- Source attribution (reporter name, outlet, link)
- Related article links for further context
- Historical comparisons (past contracts, similar situations)

**Key data to extract:**
- Exact contract terms: years, total value, AAV, guarantees
- Negotiation context: franchise tag deadlines, team/player leverage
- Source quality: beat reporters vs. national vs. speculation
- Historical comps cited by reporters

**Example fetch:**
```
web_fetch("https://www.profootballrumors.com/2026/03/no-progress-in-cowboys-talks-with-george-pickens-brandon-aubrey", max_length=5000)
```

**Example extracted data:**
- Pickens: franchise tagged at $27.3MM, July 15 deadline for extension
- Comparable: Tee Higgins 4yr/$115MM after playing on tag in 2024
- CeeDee Lamb: 4yr/$136MM, $100MM GTD, $34MM AAV (ceiling comp)
- Aubrey: $5.76MM RFA tender, asking $10MM/yr, team offering ~$7MM
- Butker comp: 4yr/$25.6MM, $6.4MM AAV (current kicker ceiling)

### 5. Homepage (Latest Headlines)

**URL:** `https://www.profootballrumors.com/`

**Returns:** 5-10 most recent articles with full text of the lead story and headlines for the rest.

**When to use:** Quick scan of the day's biggest NFL transaction news before diving into team-specific searches.

```
web_fetch("https://www.profootballrumors.com/", max_length=5000)
```

## Examples

### Researching a player for an article
```
# Step 1: Search for the player on PFR
web_fetch("https://www.profootballrumors.com/?s=DK Metcalf", max_length=8000)
# Extract: Recent contract news, trade rumors, team interest

# Step 2: Deep-dive the most relevant article
web_fetch("https://www.profootballrumors.com/2026/03/{article-from-step-1}", max_length=5000)
# Extract: Exact contract figures, source quotes, historical comps

# Step 3: Cross-reference with OTC/Spotrac for precise numbers
web_fetch("https://overthecap.com/player/dk-metcalf/9077")
web_fetch("https://www.spotrac.com/nfl/player/_/id/31888/dk-metcalf")
```

### Building offseason context for a team article
```
# Step 1: Scan team's recent transaction news
web_fetch("https://www.profootballrumors.com/?s=Seattle Seahawks", max_length=10000)
# Extract: Who left, who arrived, what's the narrative

# Step 2: Check today's headlines for breaking news
web_fetch("https://www.profootballrumors.com/", max_length=5000)

# Step 3: Search for specific players of interest
web_fetch("https://www.profootballrumors.com/?s=Devon Witherspoon", max_length=5000)
```

### Gathering contract comparables
```
# Researching the WR market for a Seahawks WR extension article
web_fetch("https://www.profootballrumors.com/?s=receiver extension", max_length=8000)
# PFR articles frequently cite comparable contracts inline
```

## Anti-Patterns

- **DO NOT use `/tag/{team-slug}` or `/nfl-teams/{team-slug}`** — These pages exist but show only ancient content (2017 and older). Always use the search endpoint (`?s=`) for current team news.
- **DO NOT use `/category/` URLs** — Return 404. There are no working category pages.
- **DO NOT use `/nfl-free-agent-tracker` or `/nfl-free-agent-predictions`** — Return 404. Use Spotrac's free agent tracker for structured FA data.
- **DO NOT use `+` for spaces in search** — Use literal spaces or `%20`. The `+` character returns "no results."
- **DO NOT over-fetch** — PFR has a `Crawl-delay: 1` in robots.txt. Space multiple fetches by at least 1 second. In practice, 2-3 fetches per research session is typical and sufficient.
- **DO NOT treat PFR as a primary stats source** — It's a news/context source. For stats, use nflverse MCP tools. For cap numbers, use OTC/Spotrac. PFR excels at the narrative layer: who's negotiating what, which teams are interested, what reporters are hearing.
- **Search results are excerpts** — The search page shows article snippets, not full articles. If you need complete contract details or full context, follow the article link for a deep-dive fetch.
- **Respect attribution** — PFR articles cite their sources (beat reporters, national reporters). When using this context in articles, attribute to the original source (e.g., "per Aaron Wilson of KPRC2"), not to Pro Football Rumors itself.
