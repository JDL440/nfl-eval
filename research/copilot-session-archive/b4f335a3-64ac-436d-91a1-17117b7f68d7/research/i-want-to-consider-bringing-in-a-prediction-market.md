# Prediction Market Integration for NFL Lab

> Research Report — 2026-03-19

## Executive Summary

Prediction markets (Polymarket, Kalshi) are a high-value, low-integration-cost data source that would give NFL Lab a genuinely differentiated editorial angle — "what does real money think?" Polymarket offers a free, no-auth public API with NFL markets (futures, game outcomes, player props), while Kalshi is CFTC-regulated with similar coverage. Both expose market-implied probabilities that can be directly compared against NFL Lab's EPA-based models and Vegas consensus lines.

**Recommendation:** Extend the existing Analytics agent rather than creating a new specialist. Add a single MCP tool (`query_prediction_markets`) backed by a Python query script that aggregates data from Polymarket's Gamma API (free, no auth) and optionally Kalshi's public endpoints. Create a companion skill document. This follows the exact pattern of the 10 existing nflverse query tools and requires ~4 new files, ~3 file edits.

---

## Table of Contents

1. [Why Prediction Markets Matter for NFL Lab](#1-why-prediction-markets-matter-for-nfl-lab)
2. [Platform Comparison: Polymarket vs. Kalshi](#2-platform-comparison-polymarket-vs-kalshi)
3. [API Architecture & Access](#3-api-architecture--access)
4. [NFL Market Coverage](#4-nfl-market-coverage)
5. [Integration Architecture](#5-integration-architecture)
6. [New Agent vs. Extended Agent — Decision](#6-new-agent-vs-extended-agent--decision)
7. [Implementation Plan](#7-implementation-plan)
8. [Aggregator APIs — Alternatives](#8-aggregator-apis--alternatives)
9. [Editorial Use Cases](#9-editorial-use-cases)
10. [Risk Assessment](#10-risk-assessment)
11. [Confidence Assessment](#11-confidence-assessment)
12. [Footnotes](#footnotes)

---

## 1. Why Prediction Markets Matter for NFL Lab

### The Unique Editorial Angle

NFL Lab's current data stack (nflverse EPA, PFR, NGS, FTN charting) is **backward-looking** — it tells you what happened. Prediction markets are **forward-looking** — they tell you what real money believes will happen. This creates three editorial opportunities:

1. **"The Market Says..."** — Every article about a team's outlook can include market-implied win totals and playoff odds as a credibility anchor. When NFL Lab's panel says the Seahawks will win 10 games and the market says 8.5, that tension is content[^1].

2. **Contrarian Signal Detection** — When EPA models rank a team highly but prediction markets are skeptical (or vice versa), that's a publishable insight. The divergence itself is the story.

3. **Real-Time Narrative Validation** — After a big trade or injury, prediction markets reprice within minutes. Checking "did the market actually move?" validates whether a news event matters or is noise.

### Market Credibility

Prediction markets have a demonstrated track record of accuracy — prices aggregate diverse information from thousands of participants who have real money at stake. Polymarket processed over $3.5 billion in trading volume in 2024[^2], and Kalshi is the only CFTC-regulated prediction market exchange in the US[^3]. These aren't toy markets — they represent genuine price discovery.

---

## 2. Platform Comparison: Polymarket vs. Kalshi

| Dimension | Polymarket | Kalshi |
|-----------|-----------|--------|
| **Regulation** | Unregulated (Polygon blockchain, non-US focused) | CFTC-regulated (US exchange) |
| **NFL Coverage** | Game outcomes, Super Bowl winner, division winners, some player props | Full spectrum: moneylines, spreads, totals, player props (passing, rushing, receiving, defensive), win totals, division winners, TD props[^4] |
| **API Auth** | **None required** for public market data (Gamma API) | API key required for trading; public endpoints for market discovery |
| **Data Format** | REST JSON + WebSocket for live scores | REST JSON + WebSocket |
| **Price Format** | 0–1 probability (e.g., 0.65 = 65% implied probability) | 1–99 cents (e.g., 60¢ = 60% probability)[^5] |
| **Python SDK** | `polymarket-gamma` (PyPI)[^6] | `kalshi-py`[^7] |
| **Rate Limits** | Generous (no documented hard limits on public endpoints) | Standard API rate limits with JWT auth |
| **Liquidity** | High on major NFL events, moderate on props | Growing rapidly — record NFL week 5 volumes in 2025[^8] |
| **Legal Access** | Restricted in US (officially), but API is public | Fully legal in most US states |
| **Update Speed** | Sub-minute on active markets | Sub-minute with live trading |

### Recommendation

**Start with Polymarket's Gamma API** — it's free, requires no authentication, has good NFL coverage for the markets that matter most editorially (futures, win totals, game outcomes), and has a clean Python SDK. Add Kalshi as a second source later if deeper player prop coverage is needed.

---

## 3. API Architecture & Access

### Polymarket Gamma API

**Base URL:** `https://gamma-api.polymarket.com`[^9]

No authentication required. Key endpoints:

```
GET /sports                          → Discover NFL tag_id
GET /tags                            → All category tags
GET /events?tag_id={nfl}&active=true → All active NFL events
GET /markets?tag_id={nfl}            → All NFL markets with prices
GET /markets/{slug}                  → Single market detail
```

**Response structure:**
```json
{
  "id": "12345",
  "question": "Will the Seahawks win Super Bowl LX?",
  "slug": "will-seahawks-win-super-bowl-lx",
  "outcomes": ["Yes", "No"],
  "outcomePrices": ["0.04", "0.96"],
  "volume": "1234567.89",
  "liquidity": "56789.12",
  "endDate": "2026-02-09T00:00:00Z",
  "active": true,
  "closed": false
}
```

**Key fields for NFL Lab:**
- `outcomePrices[0]` → implied probability (e.g., 0.04 = 4% chance Seahawks win SB)
- `volume` → total dollars traded (liquidity signal)
- `endDate` → resolution date
- `question` → human-readable market title

**Live scores (WebSocket):**[^10]
```
wss://sports-api.polymarket.com/ws
→ { "leagueAbbreviation": "nfl", "homeTeam": "SEA", "score": "21-17", "period": "Q4" }
```

### Kalshi API

**Base URL:** `https://api.elections.kalshi.com/trade-api/v2`[^11]

Public market discovery doesn't require auth. Trading does.

```
GET /markets?ticker=KXNFLGAME-*      → NFL game markets
GET /markets/{ticker}                  → Single market detail  
GET /events/{event_ticker}?with_nested_markets=true → Full event with all markets
```

**Ticker pattern for NFL:** `KXNFLGAME-25AUG16ARIDEN-ARI` (season + date + teams)[^12]

---

## 4. NFL Market Coverage

### What's Available for Editorial Use

| Market Type | Polymarket | Kalshi | Editorial Value |
|-------------|-----------|--------|-----------------|
| **Super Bowl Winner** | ✅ (futures) | ✅ | 🔴 **Critical** — "Market says Chiefs at 18%, Eagles at 12%" anchors every season preview |
| **Division Winners** | ✅ | ✅ | 🔴 **Critical** — playoff race context for every team article |
| **Win Totals** | ✅ (some) | ✅ (granular: exact, over/under, range) | 🔴 **Critical** — "Market projects 9.5 wins, our model says 11" |
| **Game Outcomes** | ✅ (moneyline) | ✅ (moneyline, spread, total) | 🟡 **High** — weekly game previews |
| **Player Props** | ⚠️ Limited | ✅ (passing, rushing, receiving, defensive, TD) | 🟡 **High** — "Market implies 4200 passing yards" for QB articles |
| **Playoff Odds** | ✅ (implicit from futures) | ✅ | 🔴 **Critical** — required for any forward-looking team analysis |
| **MVP / Awards** | ✅ | ✅ | 🟢 Medium — seasonal context |
| **Draft Position** | ⚠️ Occasional | ⚠️ Occasional | 🟢 Medium — draft order speculation |

### What's NOT Available

- Real-time in-game EPA correlation (prediction markets move on score, not play-by-play EPA)
- Historical multi-season prediction market data (these markets are relatively new for NFL)
- Contract/cap value pricing (no market for "is Player X worth $20M/yr")

---

## 5. Integration Architecture

### How It Fits the Existing Stack

The NFL Lab data pipeline follows a consistent pattern[^13]:

```
Agent calls MCP tool
  → mcp/server.mjs routes to handler
    → handler shells out to Python script in content/data/
      → script fetches data (API or cache)
      → returns JSON on stdout
    → handler formats as markdown
  → returns to agent as structured text
```

Prediction market data slots in identically:

```
┌──────────────────┐     ┌─────────────────┐     ┌──────────────────────────┐
│  Analytics Agent │     │  mcp/server.mjs │     │ content/data/            │
│  (or any agent)  │────▶│  registerTool() │────▶│ query_prediction_       │
│                  │     │  prediction_mkts│     │ markets.py               │
└──────────────────┘     └─────────────────┘     │  ├─ fetch from Polymarket│
                                                  │  ├─ (opt) fetch Kalshi  │
                                                  │  ├─ cache locally       │
                                                  │  └─ output JSON/markdown│
                                                  └──────────────────────────┘
```

### New Files

| File | Purpose |
|------|---------|
| `content/data/query_prediction_markets.py` | Python query script — fetches from Polymarket Gamma API, caches responses, outputs JSON/markdown |
| `content/data/fetch_prediction_markets.py` | Optional: scheduled cache refresh script |
| `.github/extensions/prediction-market-query/tool.mjs` | MCP tool definition + handler |
| `.squad/skills/prediction-market-data/SKILL.md` | Skill document for agent routing |

### Modified Files

| File | Change |
|------|--------|
| `mcp/server.mjs` | Import + `registerTool()` for new tool (~10 lines)[^14] |
| `.squad/agents/analytics/charter.md` | Add prediction markets to Data Sources table + Integration Points (~5 lines)[^15] |
| `content/data/_shared.py` | Optional: add API fetch helper alongside `load_cached_or_fetch()` |

---

## 6. New Agent vs. Extended Agent — Decision

### Option A: New "Prediction Markets Specialist" Agent

**Pros:**
- Clean separation of concerns
- Could develop deep expertise in market microstructure, arbitrage signals
- Could serve Cap/Draft agents directly with market-informed valuations

**Cons:**
- Adds a 48th agent to an already large squad (47 agents)
- Prediction market queries are simple data lookups, not complex reasoning
- Would need coordination overhead (routing rules, spawning, charter)
- Most editorial use is "what does the market say?" — not deep market analysis
- Overkill for the actual usage pattern

### Option B: Extend Analytics Agent (Recommended)

**Pros:**
- Analytics already owns "statistical context for every evaluation"[^16]
- Natural fit: prediction markets are another statistical signal alongside EPA, DVOA, etc.
- No new routing rules needed — Analytics already serves every other agent
- Simple: one new MCP tool, one new skill, one charter update
- Any agent can call the MCP tool directly anyway — Analytics just gets the domain context

**Cons:**
- Analytics charter grows slightly larger (but it already covers 10 data sources)
- If prediction market analysis becomes deeply sophisticated (e.g., building contrarian models, tracking market-maker behavior), a specialist would eventually make sense

### Decision

**Extend Analytics.** Start with a single `query_prediction_markets` MCP tool. If usage grows and the analysis sophistication justifies it, spin off a specialist later. This follows the established pattern — PFR defense was added to Analytics the same way[^17].

---

## 7. Implementation Plan

### Phase 1: Core Data Pipeline (Day 1)

**Step 1:** Create Python query script

```python
# content/data/query_prediction_markets.py
#!/usr/bin/env python3
"""
Query prediction market odds for NFL teams, players, and events.
Sources: Polymarket Gamma API (primary), Kalshi (future).

Usage:
    python content/data/query_prediction_markets.py --team SEA --market-type futures --season 2025
    python content/data/query_prediction_markets.py --search "Super Bowl" --format json
    python content/data/query_prediction_markets.py --team SEA --market-type win_total
"""

import argparse
import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

GAMMA_API = "https://gamma-api.polymarket.com"
CACHE_DIR = Path(__file__).parent / "cache"
CACHE_TTL_MINUTES = 30  # Markets update frequently; short TTL

def fetch_polymarket_nfl(search_term=None, tag_id=None):
    """Fetch NFL markets from Polymarket Gamma API."""
    params = "active=true&closed=false&limit=100"
    if tag_id:
        params += f"&tag_id={tag_id}"
    
    url = f"{GAMMA_API}/events?{params}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=30) as resp:
        events = json.loads(resp.read())
    
    # Filter for NFL-related events
    nfl_events = []
    for event in events:
        title = (event.get("title") or event.get("question") or "").lower()
        tags = [t.get("label", "").lower() for t in event.get("tags", [])]
        if "nfl" in title or "nfl" in tags or any(team_kw in title for team_kw in NFL_TEAM_KEYWORDS):
            nfl_events.append(event)
    
    return nfl_events

def format_market_table(markets, title):
    """Format markets as markdown table for agent consumption."""
    # ... format implied probabilities, volume, etc.
    pass

# ... (full implementation with team matching, market type filtering, caching)
```

**Step 2:** Create MCP tool extension

```javascript
// .github/extensions/prediction-market-query/tool.mjs
export const queryPredictionMarketsTool = {
    name: "query_prediction_markets",
    description: "Query prediction market odds (Polymarket/Kalshi) for NFL teams, events, and players. Returns market-implied probabilities.",
    parameters: {
        type: "object",
        properties: {
            team: { type: "string", description: "3-letter team abbrev (e.g., SEA) or full name" },
            market_type: { type: "string", description: "futures, win_total, game, player_prop, division, playoff" },
            search: { type: "string", description: "Free-text search across all NFL markets" },
            season: { type: "integer", description: "Season year (default: current)" },
        },
    },
};
```

**Step 3:** Register in MCP server

```javascript
// mcp/server.mjs — add import + registerTool() call
import {
    queryPredictionMarketsTool,
    handleQueryPredictionMarkets,
} from "../.github/extensions/prediction-market-query/tool.mjs";

server.registerTool(queryPredictionMarketsTool.name, {
    description: queryPredictionMarketsTool.description,
    inputSchema: {
        team: z.string().optional().describe("Team abbreviation or name"),
        market_type: z.string().optional().describe("futures, win_total, game, player_prop, division, playoff"),
        search: z.string().optional().describe("Free-text search"),
        season: z.number().int().optional().describe("Season year"),
    },
}, async (args) => runWithNormalization(handleQueryPredictionMarkets, args));
```

### Phase 2: Skill + Charter Update (Day 1)

**Step 4:** Create skill document

```markdown
# .squad/skills/prediction-market-data/SKILL.md
---
name: "prediction-market-data"
description: "NFL prediction market odds from Polymarket and Kalshi"
domain: "analytics"
confidence: "medium"
source: "Polymarket Gamma API (free, no auth) + Kalshi public endpoints"
---

## Purpose
Provides market-implied probabilities for NFL teams, players, and events.
Forward-looking data that complements nflverse's backward-looking stats.

## Data Sources
| Source | Coverage | Auth | Update |
|--------|----------|------|--------|
| Polymarket Gamma API | Futures, win totals, game outcomes, some props | None | Real-time |
| Kalshi | Full spectrum: moneylines, spreads, totals, all props | API key | Real-time |

## MCP Tools
| Tool | Returns |
|------|---------|
| `query_prediction_markets` | Market-implied probabilities, volume, and price for NFL events |

## Usage Patterns
- **Team outlook articles:** `--team SEA --market-type win_total` → win total odds
- **Futures context:** `--market-type futures` → Super Bowl/conference/division odds
- **Game previews:** `--team SEA --market-type game` → upcoming game odds
- **Contrarian signals:** Compare `query_team_efficiency` EPA rank vs market-implied strength

## Interpretation Guide
- Price 0.65 = 65% market-implied probability
- Volume > $100K = highly liquid, trustworthy signal
- Volume < $10K = thin market, use cautiously
- Compare to Vegas consensus for divergence analysis
```

**Step 5:** Update Analytics charter — add to Data Sources table:

```markdown
| **Prediction Markets** | Market-implied probabilities: win totals, futures, game odds, player props | ✅ **MCP tool** — see `.squad/skills/prediction-market-data/SKILL.md` |
```

### Phase 3: Validation & Editorial Patterns (Day 2)

- Test tool with real Polymarket NFL data
- Create example data anchor for a team article
- Document editorial patterns in the skill document

---

## 8. Aggregator APIs — Alternatives

If you want unified access to both Polymarket AND Kalshi (plus traditional sportsbooks) through a single endpoint, several aggregator APIs exist:

| Service | Free Tier | Polymarket | Kalshi | Sportsbooks | Best For |
|---------|-----------|-----------|--------|-------------|----------|
| **Propheseer**[^18] | ✅ Free API key | ✅ | ✅ | ❌ | Simplest unified prediction market API |
| **Parsec**[^19] | ✅ 10K req/mo | ✅ | ✅ | ❌ | Generous free tier, cross-exchange matching |
| **OddsPapi**[^20] | Free trial | ✅ | ✅ | ✅ 300+ books | Best for prediction market + sportsbook comparison |
| **pmxt** (open source)[^21] | ✅ Fully free | ✅ | ✅ | ❌ | Self-hosted, no dependency on paid API |
| **PredictionData.io**[^22] | Free credits | ✅ | ✅ | ✅ 200+ sports | Most comprehensive NFL coverage |

**Recommendation for NFL Lab:** Start with **direct Polymarket Gamma API** (zero cost, zero auth, simple REST). If you want Kalshi too, add **Propheseer or pmxt** as a unified layer later. The aggregator APIs add cost and dependency without much benefit when Polymarket's free API covers the editorial use cases.

---

## 9. Editorial Use Cases

### Use Case 1: Data Anchors in Discussion Prompts

When Analytics generates data anchors for Stage 2 discussion prompts[^23], prediction market data becomes a powerful context layer:

```markdown
## Data Anchors

### Team Production (EPA-based)
_Source: `query_team_efficiency --team SEA --season 2025`_
| Metric | Value | Rank |
|--------|------:|-----:|
| Off EPA/play | 0.082 | 8th |
| Def EPA/play | -0.071 | 5th |

### Market Outlook
_Source: `query_prediction_markets --team SEA --market-type win_total`_
| Market | Implied Prob | Volume |
|--------|-------------|--------|
| Win Total O/U 9.5 | Over 62% | $234K |
| Make Playoffs | 58% | $167K |
| Win NFC West | 31% | $89K |

> **Tension:** EPA ranks suggest a top-10 offense and top-5 defense, but the
> market only projects 9.5 wins. The panel should explore: what risk does the
> market see that the numbers don't?
```

### Use Case 2: Contrarian Signal Articles

"The market disagrees with the numbers" is a proven content format:
- **"Why Does the Market Hate the [Team]?"** — High EPA, low market odds
- **"The Market's Favorite Sleeper Team"** — Low profile, high market confidence
- **"Prediction Markets Moved After [Trade/Signing] — Here's What That Means"**

### Use Case 3: Player Evaluation Context

For player articles, market data adds a valuation layer:
- QB article: "Polymarket implies a 65% chance the Eagles make the playoffs — and Jalen Hurts' rushing EPA is a big reason why"
- Free agent article: "The market says the Titans are a 5-win team. Does paying $18M/yr for [player] change that?"

### Use Case 4: Weekly Game Previews

Market-implied probabilities are more accessible than raw EPA for casual readers:
- "The market gives the Seahawks a 58% chance in this one — here's why our panel agrees (or doesn't)"

---

## 10. Risk Assessment

### Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Polymarket API changes or goes down | Medium | Cache aggressively (30-min TTL); add Kalshi as fallback |
| NFL markets thin/illiquid during offseason | Medium | Display volume alongside probability; flag low-liquidity markets |
| Rate limiting on Gamma API | Low | No documented hard limits; cache reduces calls |
| Polymarket restricts US access further | Medium | API is separate from trading; Kalshi covers US |
| Data freshness — markets move fast | Low | Short cache TTL (30 min); agents can force-refresh |

### Editorial Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Presenting market odds as "truth" | Medium | Always frame as "the market implies" not "the market says X will happen" |
| Gambling promotion concerns | Medium | Frame as analytical data source, not betting advice; no links to place bets |
| Market manipulation on thin markets | Low | Only cite markets with >$50K volume |
| Stale prices in published articles | Medium | Include timestamp and "as of" date in all market citations |

### Legal Considerations

- Polymarket is **not licensed for US trading** but its **API data is publicly accessible** and using market prices for editorial analysis is protected speech
- Kalshi is **CFTC-regulated** and fully legal in most US states
- Using prediction market data for editorial analysis (not trading advice) has no legal restrictions
- NFL Lab should include standard disclaimers: "Market data for analytical purposes only. Not investment or gambling advice."

---

## 11. Confidence Assessment

| Claim | Confidence | Basis |
|-------|-----------|-------|
| Polymarket Gamma API is free, no-auth, and has NFL markets | **High** | Official documentation, tested by numerous developers[^9] |
| Kalshi has comprehensive NFL market coverage (props, spreads, totals) | **High** | Multiple news sources confirm 2025 expansion[^4] |
| Integration follows the existing nflverse query tool pattern exactly | **High** | Verified by inspecting all 10 existing tools in `.github/extensions/nflverse-query/tool.mjs`[^13] |
| Extending Analytics agent is better than a new specialist | **Medium-High** | Based on charter analysis[^16] and squad routing patterns; could be revisited if prediction market usage grows substantially |
| Aggregator APIs have viable free tiers | **Medium** | Claims from their marketing pages; actual limits may vary |
| Editorial value is high for team/futures articles | **High** | Standard practice in sports analytics media (538, The Athletic, etc.) |
| Player prop market coverage on Polymarket is limited | **Medium** | Based on current API exploration; Polymarket may expand NFL props |

### What I'm Less Sure About

- **Exact Polymarket NFL tag_id** — needs to be discovered via `/sports` or `/tags` endpoint at runtime (it may change)
- **Kalshi's free tier limits** — their public API documentation is less clear than Polymarket's about unauthenticated access
- **Historical data availability** — prediction market data for NFL is relatively new; multi-season backtesting may not be possible
- **Whether `polymarket-gamma` PyPI package is maintained** — it's relatively new; may need to use raw `urllib` instead

---

## Footnotes

[^1]: Market-implied probability vs. model-based projections is a standard editorial framework in sports analytics (FiveThirtyEight, The Athletic, etc.)

[^2]: Polymarket 2024 trading volume: widely reported in financial media (Bloomberg, CoinDesk)

[^3]: Kalshi CFTC regulation: [Kalshi API Guide](https://dev.to/zuplo/kalshi-api-the-complete-developers-guide-1fo4)

[^4]: Kalshi NFL market expansion 2025: [GamingToday](https://www.gamingtoday.com/news/kalshi-nfl-player-props/), [SigmaPlay](https://sigma.world/news/kalshi-win-totals-market-expanding-sports-footprint/), [SCCG Management](https://sccgmanagement.com/sccg-news/2025/8/19/kalshi-expands-football-betting-with-spreads-totals-and-touchdown-props/)

[^5]: Kalshi price format: [Odds-API.io](https://docs.odds-api.io/guides/prediction-markets)

[^6]: `polymarket-gamma` Python SDK: [PyPI](https://pypi.org/project/polymarket-gamma/)

[^7]: `kalshi-py` Python SDK: [kalshi-py docs](https://apty.github.io/kalshi-py/api/market/)

[^8]: Kalshi record NFL volumes: [PredictionNews](https://predictionnews.com/news/kalshi-expands-player-props-pauses-parlays-after-record-nfl-week-5/)

[^9]: Polymarket Gamma API docs: [docs.polymarket.com](https://docs.polymarket.com/market-data/fetching-markets)

[^10]: Polymarket Sports WebSocket: [docs.polymarket.com/websocket/sports](https://docs.polymarket.com/market-data/websocket/sports)

[^11]: Kalshi API: [docs.kalshi.com](https://docs.kalshi.com/typescript-sdk/api/MarketsApi)

[^12]: Kalshi NFL ticker pattern: [Dome API](https://docs.domeapi.io/api-reference/endpoint/get-matching-markets-sports)

[^13]: NFL Lab data pipeline pattern: `.github/extensions/nflverse-query/tool.mjs:1-60` — `runPythonQuery()` shells out to Python with `--format json`, parses stdout

[^14]: MCP server tool registration: `mcp/server.mjs:1-37` — import pattern + `server.registerTool()` for each tool

[^15]: Analytics charter data sources table: `.squad/agents/analytics/charter.md:87-98`

[^16]: Analytics agent responsibilities: `.squad/agents/analytics/charter.md:13-27` — "Own advanced NFL analytics... Provide statistical context for every evaluation"

[^17]: PFR defense was added to Analytics as an extension: `.squad/agents/analytics/charter.md:25` — `query_pfr_defense.py` added as a new query tool following the same pattern

[^18]: Propheseer unified API: [propheseer.com](https://propheseer.com/)

[^19]: Parsec API: [parsecapi.com](https://www.parsecapi.com/)

[^20]: OddsPapi: [oddspapi.io](https://oddspapi.io/blog/polymarket-api-kalshi-api-vs-sportsbooks-the-developers-guide/)

[^21]: pmxt open-source SDK: [github.com/pmxt-dev/pmxt](https://github.com/pmxt-dev/pmxt)

[^22]: PredictionData.io: [predictiondata.io](https://www.predictiondata.io/)

[^23]: Data anchor generation workflow: `.squad/agents/analytics/charter.md:154-193`
