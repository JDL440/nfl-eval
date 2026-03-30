#!/usr/bin/env python3
"""
content/data/query_snap_usage.py — Snap count and usage analysis.

Usage:
    python content/data/query_snap_usage.py --team SEA --season 2024
    python content/data/query_snap_usage.py --team SEA --season 2024 --position-group offense --top 15
    python content/data/query_snap_usage.py --player "Jaxon Smith-Njigba" --season 2024 --format json
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _shared import load_cached_or_fetch, resolve_team_abbr

try:
    import polars as pl
except ImportError:
    print("Error: polars not installed", file=sys.stderr)
    print("Install with: pip install -r requirements.txt", file=sys.stderr)
    sys.exit(1)


def query_team_snap_usage(team: str, season: int, position_group: str | None, top: int, output_format: str):
    """Query snap counts for a team."""
    team = resolve_team_abbr(team)
    df = load_cached_or_fetch("snap_counts", [season])
    
    # Filter to regular season only and aggregate by player
    team_df = df.filter(
        (pl.col("team") == team.upper()) &
        (pl.col("season") == season) &
        (pl.col("game_type") == "REG")
    ).group_by(["player", "position"]).agg([
        pl.col("offense_snaps").sum().alias("offense_snaps"),
        pl.col("defense_snaps").sum().alias("defense_snaps"),
        pl.col("st_snaps").sum().alias("st_snaps"),
        pl.col("offense_pct").mean().alias("offense_pct"),
        pl.col("defense_pct").mean().alias("defense_pct"),
        pl.col("st_pct").mean().alias("st_pct"),
    ])
    
    if len(team_df) == 0:
        print(f"Error: No snap count data for {team} in {season}", file=sys.stderr)
        sys.exit(1)
    
    # Filter by position group if specified
    if position_group:
        group_map = {
            "offense": ["QB", "RB", "FB", "WR", "TE", "OL", "T", "G", "C", "OT", "OG"],
            "defense": ["DL", "DE", "DT", "NT", "LB", "ILB", "OLB", "CB", "S", "FS", "SS", "DB"],
            "special": ["K", "P", "LS"]
        }
        positions = group_map.get(position_group.lower(), [])
        if not positions:
            print(f"Error: Unknown position group: {position_group}", file=sys.stderr)
            print("Valid groups: offense, defense, special", file=sys.stderr)
            sys.exit(1)
        team_df = team_df.filter(pl.col("position").is_in(positions))
    
    team_df = team_df.with_columns(
        (
            pl.col("offense_snaps").fill_null(0) +
            pl.col("defense_snaps").fill_null(0) +
            pl.col("st_snaps").fill_null(0)
        ).alias("total_snaps")
    )

    sort_column = "total_snaps"
    if position_group == "offense":
        sort_column = "offense_snaps"
    elif position_group == "defense":
        sort_column = "defense_snaps"
    elif position_group == "special":
        sort_column = "st_snaps"

    ranked = team_df.sort(sort_column, descending=True).head(top)
    
    results = []
    for row in ranked.iter_rows(named=True):
        results.append({
            "player": row["player"],
            "position": row["position"],
            "offense_snaps": int(row["offense_snaps"]) if row["offense_snaps"] is not None else 0,
            "offense_pct": round(row["offense_pct"] * 100, 1) if row["offense_pct"] is not None else None,
            "defense_snaps": int(row["defense_snaps"]) if row["defense_snaps"] is not None else 0,
            "defense_pct": round(row["defense_pct"] * 100, 1) if row["defense_pct"] is not None else None,
            "st_snaps": int(row["st_snaps"]) if row["st_snaps"] is not None else 0,
            "st_pct": round(row["st_pct"] * 100, 1) if row["st_pct"] is not None else None,
        })
    
    if output_format == "json":
        print(json.dumps(results, indent=2))
    else:
        group_label = f" ({position_group} group)" if position_group else ""
        print(f"\n### {team} Snap Counts — {season}{group_label} (Top {len(results)})\n")
        print("| Player | Position | OFF Snaps | OFF % | DEF Snaps | DEF % | ST Snaps | ST % |")
        print("|--------|----------|----------:|------:|----------:|------:|---------:|-----:|")
        for r in results:
            off_snaps = r["offense_snaps"] if r["offense_snaps"] else 0
            off_pct = f"{r['offense_pct']:.1f}" if r["offense_pct"] is not None else "-"
            def_snaps = r["defense_snaps"] if r["defense_snaps"] else 0
            def_pct = f"{r['defense_pct']:.1f}" if r["defense_pct"] is not None else "-"
            st_snaps = r["st_snaps"] if r["st_snaps"] else 0
            st_pct = f"{r['st_pct']:.1f}" if r["st_pct"] is not None else "-"
            print(f"| {r['player']} | {r['position']} | {off_snaps:,} | {off_pct} | {def_snaps:,} | {def_pct} | {st_snaps:,} | {st_pct} |")
        print()


def query_player_snap_usage(player_name: str, season: int, output_format: str):
    """Query snap counts for a specific player."""
    df = load_cached_or_fetch("snap_counts", [season])
    
    # Filter to regular season
    df = df.filter(pl.col("game_type") == "REG")
    
    player_df = df.filter(
        pl.col("player").str.to_lowercase() == player_name.lower()
    )
    
    if len(player_df) == 0:
        partial_matches = df.filter(
            pl.col("player").str.to_lowercase().str.contains(player_name.lower(), literal=True)
        )
        if len(partial_matches) == 0:
            print(f"Error: Player not found: {player_name}", file=sys.stderr)
            sys.exit(1)

        matched_players = partial_matches.select(["player", "position", "team"]).unique()

        if len(matched_players) > 1:
            print(f"Error: Ambiguous player name: {player_name}", file=sys.stderr)
            print("Matching players:", file=sys.stderr)
            for row in matched_players.iter_rows(named=True):
                print(f"  - {row['player']} ({row['position']}, {row['team']})", file=sys.stderr)
            print("Use a more specific full name.", file=sys.stderr)
            sys.exit(1)

        player_df = df.filter(pl.col("player") == matched_players["player"][0])
    
    # Aggregate across all games
    agg = player_df.group_by("player").agg([
        pl.col("position").first().alias("position"),
        pl.col("team").first().alias("team"),
        pl.col("offense_snaps").sum().alias("offense_snaps"),
        pl.col("defense_snaps").sum().alias("defense_snaps"),
        pl.col("st_snaps").sum().alias("st_snaps"),
        pl.col("offense_pct").mean().alias("offense_pct"),
        pl.col("defense_pct").mean().alias("defense_pct"),
        pl.col("st_pct").mean().alias("st_pct"),
    ])
    
    result = {
        "player": agg["player"][0],
        "position": agg["position"][0],
        "team": agg["team"][0],
        "season": season,
        "offense_snaps": int(agg["offense_snaps"][0]) if agg["offense_snaps"][0] is not None else 0,
        "offense_pct": round(agg["offense_pct"][0] * 100, 1) if agg["offense_pct"][0] is not None else None,
        "defense_snaps": int(agg["defense_snaps"][0]) if agg["defense_snaps"][0] is not None else 0,
        "defense_pct": round(agg["defense_pct"][0] * 100, 1) if agg["defense_pct"][0] is not None else None,
        "st_snaps": int(agg["st_snaps"][0]) if agg["st_snaps"][0] is not None else 0,
        "st_pct": round(agg["st_pct"][0] * 100, 1) if agg["st_pct"][0] is not None else None,
    }
    
    if output_format == "json":
        print(json.dumps(result, indent=2))
    else:
        print(f"\n### {result['player']} — {season} Snap Counts\n")
        print(f"**Position:** {result['position']} | **Team:** {result['team']}\n")
        print("| Unit | Snaps | % |")
        print("|------|------:|------:|")
        print(f"| Offense | {result['offense_snaps']:,} | {result['offense_pct']:.1f}% |" if result['offense_pct'] is not None else f"| Offense | {result['offense_snaps']:,} | - |")
        print(f"| Defense | {result['defense_snaps']:,} | {result['defense_pct']:.1f}% |" if result['defense_pct'] is not None else f"| Defense | {result['defense_snaps']:,} | - |")
        print(f"| Special Teams | {result['st_snaps']:,} | {result['st_pct']:.1f}% |" if result['st_pct'] is not None else f"| Special Teams | {result['st_snaps']:,} | - |")
        print()


def main():
    parser = argparse.ArgumentParser(description="Query snap counts and usage")
    parser.add_argument("--team", help="Team abbreviation (e.g., SEA)")
    parser.add_argument("--player", help="Player name (for individual player lookup)")
    parser.add_argument("--season", type=int, required=True, help="Season year")
    parser.add_argument("--position-group", choices=["offense", "defense", "special"], help="Filter by position group")
    parser.add_argument("--top", type=int, default=20, help="Number of players to show (default: 20)")
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown", help="Output format")
    
    args = parser.parse_args()
    
    if args.player:
        query_player_snap_usage(args.player, args.season, args.format)
    elif args.team:
        query_team_snap_usage(args.team, args.season, args.position_group, args.top, args.format)
    else:
        print("Error: Must specify either --team or --player", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
