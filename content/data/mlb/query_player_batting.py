#!/usr/bin/env python3
"""
content/data/mlb/query_player_batting.py — Player batting stats.

Usage:
    python content/data/mlb/query_player_batting.py --player "Juan Soto" --season 2024
    python content/data/mlb/query_player_batting.py --player "Shohei Ohtani" --season 2024 --format json
"""

import argparse
import json
import sys
from pathlib import Path

# Import shared auto-fetch helper
sys.path.insert(0, str(Path(__file__).parent))
from _shared import load_cached_or_fetch

try:
    import pandas as pd
except ImportError:
    print("❌ Error: pandas not installed")
    print("Install with: pip install -r requirements.txt")
    sys.exit(1)


def _safe_round(value, decimals=3):
    """Round a value if it's a number, return None otherwise."""
    if pd.isna(value):
        return None
    try:
        return round(float(value), decimals)
    except (TypeError, ValueError):
        return None


def _safe_int(value):
    """Convert to int if it's a number, return 0 otherwise."""
    if pd.isna(value):
        return 0
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def query_player_batting(player_name: str, season: int, output_format: str = "markdown"):
    """Query batting stats for a player."""
    df = load_cached_or_fetch("batting_stats", [season])

    # Filter to the requested season
    if "Season" in df.columns:
        season_df = df[df["Season"] == season].copy()
    else:
        season_df = df.copy()

    # Prefer exact case-insensitive match, then fall back to partial
    name_col = "Name"
    if name_col not in season_df.columns:
        print("❌ Column 'Name' not found in batting_stats", file=sys.stderr)
        sys.exit(1)

    exact_mask = season_df[name_col].str.lower() == player_name.lower()
    player_df = season_df[exact_mask]

    if player_df.empty:
        partial_mask = season_df[name_col].str.lower().str.contains(
            player_name.lower(), na=False
        )
        partial_matches = season_df[partial_mask]

        if partial_matches.empty:
            print(f"❌ Player not found: {player_name}", file=sys.stderr)
            sys.exit(1)

        unique_players = partial_matches.drop_duplicates(subset=[name_col])
        if len(unique_players) > 1:
            print(f"❌ Ambiguous player name: {player_name}", file=sys.stderr)
            print("Matching players:", file=sys.stderr)
            for _, row in unique_players.iterrows():
                team = row.get("Team", "N/A")
                print(f"  - {row[name_col]} ({team})", file=sys.stderr)
            print("Use a more specific full name.", file=sys.stderr)
            sys.exit(1)

        player_df = partial_matches

    if player_df.empty:
        print(f"❌ Player not found: {player_name}", file=sys.stderr)
        sys.exit(1)

    # Use first matching row
    p = player_df.iloc[0]
    player_display = p[name_col]
    team = p.get("Team", "N/A")

    # Determine position for ranking
    # pybaseball batting_stats may not always have a "Pos" column;
    # fall back gracefully.
    position = None
    for pos_col in ("Pos", "Position"):
        if pos_col in p.index and pd.notna(p[pos_col]):
            position = str(p[pos_col])
            break

    # Compute position rank by WAR
    war_col = "WAR"
    position_rank = None
    if war_col in season_df.columns:
        if position:
            pos_peers = season_df
            for pos_col in ("Pos", "Position"):
                if pos_col in season_df.columns:
                    pos_peers = season_df[season_df[pos_col].astype(str).str.contains(
                        position.split("/")[0], case=False, na=False
                    )]
                    break
        else:
            pos_peers = season_df

        ranked = pos_peers.sort_values(war_col, ascending=False).reset_index(drop=True)
        rank_matches = ranked[ranked[name_col] == player_display]
        if not rank_matches.empty:
            position_rank = rank_matches.index[0] + 1

    result = {
        "player": player_display,
        "season": season,
        "team": team if pd.notna(team) else "N/A",
        "position": position or "N/A",
        "PA": _safe_int(p.get("PA")),
        "AVG": _safe_round(p.get("AVG")),
        "OBP": _safe_round(p.get("OBP")),
        "SLG": _safe_round(p.get("SLG")),
        "OPS": _safe_round(p.get("OPS")),
        "wRC+": _safe_int(p.get("wRC+")),
        "HR": _safe_int(p.get("HR")),
        "RBI": _safe_int(p.get("RBI")),
        "BB%": _safe_round(p.get("BB%"), 1),
        "K%": _safe_round(p.get("K%"), 1),
        "WAR": _safe_round(p.get("WAR"), 1),
        "ISO": _safe_round(p.get("ISO")),
        "BABIP": _safe_round(p.get("BABIP")),
        "position_rank": position_rank,
    }

    if output_format == "json":
        print(json.dumps(result, indent=2))
    else:
        rank_display = (
            f" (Rank #{result['position_rank']} by WAR at {result['position']})"
            if result.get("position_rank")
            else ""
        )
        print(f"\n### {result['player']} — {season} Batting{rank_display}\n")
        print(f"**Team:** {result['team']} | **Position:** {result['position']}\n")
        print("| Metric | Value |")
        print("|--------|------:|")
        for key, value in result.items():
            if key in ("player", "season", "team", "position", "position_rank"):
                continue
            display_key = key
            if value is None:
                print(f"| {display_key} | N/A |")
            elif isinstance(value, float):
                print(f"| {display_key} | {value} |")
            else:
                print(f"| {display_key} | {value:,} |")
        print()


def main():
    parser = argparse.ArgumentParser(description="Query MLB player batting stats")
    parser.add_argument("--player", required=True, help="Player name (partial match OK)")
    parser.add_argument(
        "--season", type=int, required=True, help="Season year (e.g., 2024)"
    )
    parser.add_argument(
        "--format",
        choices=["markdown", "json"],
        default="markdown",
        help="Output format",
    )

    args = parser.parse_args()
    query_player_batting(args.player, args.season, args.format)


if __name__ == "__main__":
    main()
