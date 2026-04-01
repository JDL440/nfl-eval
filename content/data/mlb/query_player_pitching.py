#!/usr/bin/env python3
"""
content/data/mlb/query_player_pitching.py — Player pitching stats.

Usage:
    python content/data/mlb/query_player_pitching.py --player "Corbin Burnes" --season 2024
    python content/data/mlb/query_player_pitching.py --player "Emmanuel Clase" --season 2024 --format json
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


def query_player_pitching(player_name: str, season: int, output_format: str = "markdown"):
    """Query pitching stats for a player."""
    df = load_cached_or_fetch("pitching_stats", [season])

    # Filter to the requested season
    if "Season" in df.columns:
        season_df = df[df["Season"] == season].copy()
    else:
        season_df = df.copy()

    # Prefer exact case-insensitive match, then fall back to partial
    name_col = "Name"
    if name_col not in season_df.columns:
        print("❌ Column 'Name' not found in pitching_stats", file=sys.stderr)
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

    # Determine role (starter vs reliever) for ranking context
    ip = _safe_round(p.get("IP"), 1)
    gs = _safe_int(p.get("GS"))
    g = _safe_int(p.get("G"))
    role = "SP" if gs > 0 and gs >= g * 0.5 else "RP"

    # Compute rank by WAR among same role
    war_col = "WAR"
    position_rank = None
    if war_col in season_df.columns:
        # Classify all pitchers as SP or RP
        if "GS" in season_df.columns and "G" in season_df.columns:
            role_mask = (
                (season_df["GS"].fillna(0) > 0)
                & (season_df["GS"].fillna(0) >= season_df["G"].fillna(1) * 0.5)
            )
            if role == "SP":
                peers = season_df[role_mask]
            else:
                peers = season_df[~role_mask]
        else:
            peers = season_df

        ranked = peers.sort_values(war_col, ascending=False).reset_index(drop=True)
        rank_matches = ranked[ranked[name_col] == player_display]
        if not rank_matches.empty:
            position_rank = rank_matches.index[0] + 1

    result = {
        "player": player_display,
        "season": season,
        "team": team if pd.notna(team) else "N/A",
        "role": role,
        "W": _safe_int(p.get("W")),
        "L": _safe_int(p.get("L")),
        "ERA": _safe_round(p.get("ERA"), 2),
        "FIP": _safe_round(p.get("FIP"), 2),
        "xFIP": _safe_round(p.get("xFIP"), 2),
        "WHIP": _safe_round(p.get("WHIP"), 2),
        "K/9": _safe_round(p.get("K/9"), 2),
        "BB/9": _safe_round(p.get("BB/9"), 2),
        "IP": ip,
        "SO": _safe_int(p.get("SO")),
        "WAR": _safe_round(p.get("WAR"), 1),
        "K%": _safe_round(p.get("K%"), 1),
        "BB%": _safe_round(p.get("BB%"), 1),
        "HR/9": _safe_round(p.get("HR/9"), 2),
        "BABIP": _safe_round(p.get("BABIP")),
        "LOB%": _safe_round(p.get("LOB%"), 1),
        "role_rank": position_rank,
    }

    if output_format == "json":
        print(json.dumps(result, indent=2))
    else:
        rank_display = (
            f" (Rank #{result['role_rank']} by WAR among {result['role']}s)"
            if result.get("role_rank")
            else ""
        )
        print(f"\n### {result['player']} — {season} Pitching{rank_display}\n")
        print(f"**Team:** {result['team']} | **Role:** {result['role']}\n")
        print("| Metric | Value |")
        print("|--------|------:|")
        for key, value in result.items():
            if key in ("player", "season", "team", "role", "role_rank"):
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
    parser = argparse.ArgumentParser(description="Query MLB player pitching stats")
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
    query_player_pitching(args.player, args.season, args.format)


if __name__ == "__main__":
    main()
