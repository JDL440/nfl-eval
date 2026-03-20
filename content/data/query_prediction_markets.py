#!/usr/bin/env python3
"""
content/data/query_prediction_markets.py — Prediction market odds for NFL.

Fetches market-implied probabilities from Polymarket's Gamma API (free, no auth).
Supports team lookups, futures, game outcomes, and free-text search.

Usage:
    python content/data/query_prediction_markets.py --team SEA
    python content/data/query_prediction_markets.py --team SEA --market-type win_total
    python content/data/query_prediction_markets.py --search "Super Bowl"
    python content/data/query_prediction_markets.py --futures
    python content/data/query_prediction_markets.py --format json --team SEA
"""

import argparse
import json
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path
from datetime import datetime, timezone

GAMMA_API = "https://gamma-api.polymarket.com"
CACHE_DIR = Path(__file__).parent / "cache"
CACHE_TTL_SECONDS = 30 * 60  # 30 minutes

# NFL team identifiers for matching Polymarket event titles
NFL_TEAMS = {
    "ARI": ["cardinals", "arizona"],
    "ATL": ["falcons", "atlanta"],
    "BAL": ["ravens", "baltimore"],
    "BUF": ["bills", "buffalo"],
    "CAR": ["panthers", "carolina"],
    "CHI": ["bears", "chicago bears"],
    "CIN": ["bengals", "cincinnati"],
    "CLE": ["browns", "cleveland"],
    "DAL": ["cowboys", "dallas"],
    "DEN": ["broncos", "denver"],
    "DET": ["lions", "detroit"],
    "GB":  ["packers", "green bay"],
    "HOU": ["texans", "houston texans"],
    "IND": ["colts", "indianapolis"],
    "JAX": ["jaguars", "jacksonville"],
    "KC":  ["chiefs", "kansas city"],
    "LAC": ["chargers", "los angeles chargers", "la chargers"],
    "LAR": ["rams", "los angeles rams", "la rams"],
    "LV":  ["raiders", "las vegas"],
    "MIA": ["dolphins", "miami"],
    "MIN": ["vikings", "minnesota"],
    "NE":  ["patriots", "new england"],
    "NO":  ["saints", "new orleans"],
    "NYG": ["giants", "new york giants", "ny giants"],
    "NYJ": ["jets", "new york jets", "ny jets"],
    "PHI": ["eagles", "philadelphia"],
    "PIT": ["steelers", "pittsburgh"],
    "SEA": ["seahawks", "seattle"],
    "SF":  ["49ers", "niners", "san francisco"],
    "TB":  ["buccaneers", "bucs", "tampa bay", "tampa"],
    "TEN": ["titans", "tennessee"],
    "WAS": ["commanders", "washington"],
}

# Keyword groups for market type classification
MARKET_TYPE_KEYWORDS = {
    "super_bowl": ["super bowl", "win the super bowl", "champion"],
    "conference": ["afc", "nfc", "conference champion", "afc champion", "nfc champion"],
    "division": ["division", "afc north", "afc south", "afc east", "afc west",
                 "nfc north", "nfc south", "nfc east", "nfc west", "win the"],
    "win_total": ["win total", "wins", "regular season wins", "over/under wins"],
    "playoff": ["playoff", "make the playoffs", "postseason"],
    "mvp": ["mvp", "most valuable"],
    "game": ["vs", "versus", "moneyline", "spread", "week "],
    "player_prop": ["passing yards", "rushing yards", "receiving yards",
                    "touchdowns", "td", "completions", "interceptions"],
    "futures": ["super bowl", "champion", "mvp", "division", "playoff",
                "win total", "conference"],
}


def _cache_path(key: str) -> Path:
    """Return cache file path for a given key."""
    safe = key.replace("/", "_").replace("?", "_").replace("&", "_")[:120]
    return CACHE_DIR / f"polymarket_{safe}.json"


def _read_cache(key: str) -> list | None:
    """Read from cache if fresh enough."""
    path = _cache_path(key)
    if not path.exists():
        return None
    age = time.time() - path.stat().st_mtime
    if age > CACHE_TTL_SECONDS:
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def _write_cache(key: str, data: list):
    """Write data to cache."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = _cache_path(key)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


NFL_TAG_ID = "450"  # Stable Polymarket tag for NFL content


def _api_get(endpoint: str, params: dict | None = None) -> list | dict:
    """Make a GET request to Polymarket Gamma API."""
    url = f"{GAMMA_API}{endpoint}"
    if params:
        url += "?" + urllib.parse.urlencode(params)

    req = urllib.request.Request(url, headers={
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; NFLLab/1.0)",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"❌ Polymarket API error: {e.code} {e.reason}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"❌ Polymarket API connection failed: {e.reason}", file=sys.stderr)
        sys.exit(1)


def fetch_nfl_markets(search: str | None = None) -> list:
    """Fetch NFL-related markets from Polymarket."""
    cache_key = f"nfl_markets_{search or 'all'}"
    cached = _read_cache(cache_key)
    if cached is not None:
        return cached

    all_markets = []
    seen_ids = set()

    # Paginate through NFL-tagged events (they include nested markets)
    for offset in range(0, 500, 100):
        events = _api_get("/events", {
            "tag_id": NFL_TAG_ID,
            "closed": "false",
            "limit": "100",
            "offset": str(offset),
        })
        if not isinstance(events, list) or len(events) == 0:
            break
        for event in events:
            for m in _extract_markets_from_event(event):
                mid = m.get("id")
                if mid and mid not in seen_ids:
                    # Skip tabloid/non-football content
                    if _is_nfl_related(m["question"]):
                        seen_ids.add(mid)
                        all_markets.append(m)

    _write_cache(cache_key, all_markets)
    return all_markets


def _extract_markets_from_event(event: dict) -> list:
    """Extract individual markets from an event object."""
    markets = []
    if "markets" in event and isinstance(event["markets"], list):
        for m in event["markets"]:
            markets.append(_normalize_market(m, event_title=event.get("title")))
    else:
        markets.append(_normalize_market(event))
    return markets


def _normalize_market(m: dict, event_title: str | None = None) -> dict:
    """Normalize a market object into a consistent format."""
    question = m.get("question") or m.get("title") or event_title or "Unknown"

    # Parse prices — outcomePrices is a list of strings like ["0.65", "0.35"]
    outcome_prices = m.get("outcomePrices") or m.get("outcome_prices") or []
    outcomes = m.get("outcomes") or []

    # Handle string-encoded JSON (some endpoints)
    if isinstance(outcome_prices, str):
        try:
            outcome_prices = json.loads(outcome_prices)
        except (json.JSONDecodeError, ValueError):
            outcome_prices = []
    if isinstance(outcomes, str):
        try:
            outcomes = json.loads(outcomes)
        except (json.JSONDecodeError, ValueError):
            outcomes = []

    # Build probabilities list
    probabilities = []
    for i, price_str in enumerate(outcome_prices):
        try:
            prob = float(price_str)
        except (ValueError, TypeError):
            prob = 0
        label = outcomes[i] if i < len(outcomes) else f"Outcome {i+1}"
        probabilities.append({"label": label, "probability": round(prob * 100, 1)})

    # Volume: try numeric field first, then string
    volume_raw = m.get("volumeNum") or m.get("volume") or "0"
    try:
        volume = float(volume_raw)
    except (ValueError, TypeError):
        volume = 0

    liquidity_raw = m.get("liquidityNum") or m.get("liquidity") or "0"
    try:
        liquidity = float(liquidity_raw)
    except (ValueError, TypeError):
        liquidity = 0

    return {
        "id": m.get("id") or m.get("condition_id") or "",
        "question": question,
        "slug": m.get("slug") or "",
        "probabilities": probabilities,
        "volume": round(volume),
        "liquidity": round(liquidity),
        "end_date": m.get("endDate") or m.get("endDateIso") or m.get("end_date_iso") or "",
        "active": m.get("active", True),
        "market_type": _classify_market(question),
    }


def _is_nfl_related(text: str) -> bool:
    """Check if text is related to actual NFL football (filter tabloid content)."""
    text_lower = text.lower()

    # Exclude known tabloid patterns
    tabloid = ["wedding", "baby", "engaged", "relationship", "arrested",
               "jail", "rap album", "cardi b", "taylor swift", "alix earle",
               "boy or girl"]
    if any(t in text_lower for t in tabloid):
        return False

    if "nfl" in text_lower or "draft" in text_lower:
        return True
    for abbrev, names in NFL_TEAMS.items():
        for name in names:
            if name in text_lower:
                return True
    for kw in ["super bowl", "touchdown", "quarterback", "rushing yards",
               "passing yards", "afc", "nfc", "playoff", "division",
               "mvp", "rookie", "coach", "week ", "start"]:
        if kw in text_lower:
            return True
    return False


def _classify_market(question: str) -> str:
    """Classify a market question into a type category."""
    q = question.lower()
    for market_type, keywords in MARKET_TYPE_KEYWORDS.items():
        for kw in keywords:
            if kw in q:
                return market_type
    return "other"


def _team_matches(question: str, team_abbrev: str) -> bool:
    """Check if a market question references a specific team."""
    q = question.lower()
    team_abbrev_upper = team_abbrev.upper()
    if team_abbrev_upper in NFL_TEAMS:
        names = NFL_TEAMS[team_abbrev_upper]
        for name in names:
            if name in q:
                return True
    # Also check the abbreviation itself
    if team_abbrev_upper.lower() in q.split():
        return True
    return False


def filter_markets(markets: list, team: str | None = None,
                   market_type: str | None = None,
                   search: str | None = None) -> list:
    """Filter markets by team, type, and/or search query."""
    results = markets

    if team:
        results = [m for m in results if _team_matches(m["question"], team)]

    if market_type:
        if market_type == "futures":
            results = [m for m in results
                       if m["market_type"] in ("super_bowl", "conference",
                                                "division", "win_total",
                                                "playoff", "mvp")]
        else:
            results = [m for m in results if m["market_type"] == market_type]

    if search:
        search_lower = search.lower()
        results = [m for m in results if search_lower in m["question"].lower()]

    # Sort by volume descending (most liquid first)
    results.sort(key=lambda m: m.get("volume", 0), reverse=True)
    return results


def format_output(markets: list, output_format: str, title: str = "NFL Prediction Markets"):
    """Format and print results."""
    if not markets:
        if output_format == "json":
            print(json.dumps({"markets": [], "count": 0, "message": "No markets found",
                              "source": "Polymarket", "fetched_at": datetime.now(timezone.utc).isoformat()}))
        else:
            print(f"\n### {title}\n\n_No markets found._\n")
        return

    fetched_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    if output_format == "json":
        print(json.dumps({
            "markets": markets,
            "count": len(markets),
            "source": "Polymarket",
            "fetched_at": fetched_at,
        }, indent=2))
    else:
        print(f"\n### {title}")
        print(f"_Source: Polymarket · {fetched_at} · {len(markets)} market(s)_\n")

        print("| Market | Implied Prob | Volume | Type |")
        print("|--------|-------------|-------:|------|")
        for m in markets[:25]:
            question = m["question"]
            if len(question) > 65:
                question = question[:62] + "…"

            # Show the "Yes" probability if binary, otherwise the top outcome
            probs = m.get("probabilities", [])
            if probs:
                # For binary markets, show the "Yes" probability
                yes_prob = next((p for p in probs if p["label"].lower() == "yes"), None)
                if yes_prob:
                    prob_str = f"{yes_prob['probability']}%"
                else:
                    # Multi-outcome: show top probability
                    top = max(probs, key=lambda p: p["probability"])
                    prob_str = f"{top['label']}: {top['probability']}%"
            else:
                prob_str = "N/A"

            vol = m.get("volume", 0)
            if vol >= 1_000_000:
                vol_str = f"${vol/1_000_000:.1f}M"
            elif vol >= 1_000:
                vol_str = f"${vol/1_000:.0f}K"
            else:
                vol_str = f"${vol}"

            mtype = m.get("market_type", "other")
            print(f"| {question} | {prob_str} | {vol_str} | {mtype} |")

        if len(markets) > 25:
            print(f"\n_Showing top 25 of {len(markets)} markets by volume._")
        print()


def main():
    parser = argparse.ArgumentParser(
        description="Query prediction market odds for NFL teams and events (Polymarket)")
    parser.add_argument("--team", help="Team abbreviation (e.g., SEA, KC) or name")
    parser.add_argument("--market-type",
                        choices=["futures", "super_bowl", "conference", "division",
                                 "win_total", "playoff", "mvp", "game", "player_prop"],
                        help="Filter by market type")
    parser.add_argument("--search", help="Free-text search across market titles")
    parser.add_argument("--futures", action="store_true",
                        help="Shortcut for --market-type futures")
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown",
                        help="Output format")
    parser.add_argument("--no-cache", action="store_true",
                        help="Bypass local cache")

    args = parser.parse_args()

    if args.futures:
        args.market_type = "futures"

    if args.no_cache:
        global CACHE_TTL_SECONDS
        CACHE_TTL_SECONDS = 0

    # Fetch all NFL markets
    markets = fetch_nfl_markets(search=args.search)

    # Apply filters
    filtered = filter_markets(markets, team=args.team, market_type=args.market_type,
                              search=args.search)

    # Build title
    parts = ["NFL"]
    if args.team:
        parts.append(args.team.upper())
    if args.market_type:
        parts.append(args.market_type.replace("_", " ").title())
    parts.append("Prediction Markets")
    title = " ".join(parts)

    format_output(filtered, args.format, title=title)


if __name__ == "__main__":
    main()
