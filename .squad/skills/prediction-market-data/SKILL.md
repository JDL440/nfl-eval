---
name: prediction-market-data
description: Polymarket prediction market odds for NFL teams and events
domain: analytics
confidence: high
---

# Prediction Market Data (Polymarket)

## Overview

NFL prediction markets provide forward-looking, crowd-sourced probability estimates for team and player outcomes. Polymarket's Gamma API is free and requires no authentication.

## What's Available

| Market Type | Examples | Coverage |
|------------|---------|----------|
| Super Bowl futures | "Will the Eagles win Super Bowl LX?" | Full NFL; updated continuously |
| Division winners | "Will the Seahawks win the NFC West?" | All 8 divisions |
| Win totals | "Seahawks O/U 9.5 wins" | Most teams during season |
| Playoff odds | "Will the Bills make the playoffs?" | Available during season |
| Game outcomes | "Week 5: SEA vs SF" | Available near game day |
| MVP | "Patrick Mahomes MVP?" | Top QB/candidates |
| Player props | Passing/rushing/receiving yardage props | Limited availability |

## MCP Tool

### `query_prediction_markets`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `team` | string | No | Team abbreviation (SEA, KC) or name |
| `market_type` | string | No | `futures`, `super_bowl`, `conference`, `division`, `win_total`, `playoff`, `mvp`, `game`, `player_prop` |
| `search` | string | No | Free-text search across market titles |

If no parameters given, defaults to NFL futures (most editorially useful).

### Example Calls

```
query_prediction_markets(team="SEA")
→ All Seahawks markets: Super Bowl odds, division, win total, games

query_prediction_markets(market_type="super_bowl")
→ All Super Bowl winner markets

query_prediction_markets(search="MVP")
→ MVP betting markets
```

### CLI Usage

```bash
python content/data/query_prediction_markets.py --team SEA
python content/data/query_prediction_markets.py --futures --format json
python content/data/query_prediction_markets.py --search "Super Bowl" --format markdown
```

## Cache Strategy

- **TTL**: 30 minutes (markets update continuously)
- **Location**: `content/data/cache/polymarket_*.json`
- **Bypass**: `--no-cache` flag on CLI

## Editorial Usage Patterns

### When to Use Prediction Markets

1. **Forward-looking context** — "The market gives Seattle a 12% chance at the Super Bowl, third-highest in the NFC"
2. **Contrarian takes** — Highlight where analytical conclusions diverge from market consensus
3. **Win-total framing** — "Vegas/Polymarket has Buffalo at 11.5 wins; here's why the under makes sense"
4. **Trade evaluation** — Use playoff odds to assess how a trade changes a team's outlook
5. **Narrative context** — "Despite the 3-game losing streak, their Super Bowl odds have barely moved"

### When NOT to Rely on Markets

- **Small/illiquid markets** — Low volume (<$10K) means prices are unreliable
- **Player props** — Coverage is spotty; nflverse stats are much richer for player analysis
- **Historical** — Markets only have current/forward prices, not retrospective data

### Interpretation Guide

| Market Probability | Interpretation |
|-------------------|----------------|
| >50% | Market favorite |
| 20-50% | Serious contender |
| 5-20% | Dark horse / plausible |
| <5% | Long shot |

**Volume matters**: A 15% probability at $2M volume is much more meaningful than 15% at $5K volume. Always note volume when citing prediction market odds.
