#!/usr/bin/env python3
"""
content/data/query_player_epa.py — Player EPA and efficiency metrics.

Usage:
    python content/data/query_player_epa.py --player "Jaxon Smith-Njigba" --season 2025
    python content/data/query_player_epa.py --player "Drake Maye" --season 2025 --format json
"""

import argparse
import json
import sys
from pathlib import Path

# Import shared auto-fetch helper
sys.path.insert(0, str(Path(__file__).parent))
from _shared import load_cached_or_fetch

try:
    import polars as pl
except ImportError:
    print("❌ Error: polars not installed")
    print("Install with: pip install -r requirements.txt")
    sys.exit(1)


def query_player_epa(player_name: str, season: int, output_format: str = "markdown"):
    """Query EPA and efficiency metrics for a player."""
    df = load_cached_or_fetch("player_stats", [season])

    season_df = df.filter(pl.col("season_type") == "REG")

    # Prefer an exact case-insensitive match. Fall back to a literal partial match,
    # but refuse ambiguous requests rather than accidentally merging players.
    player_df = season_df.filter(
        pl.col("player_display_name").str.to_lowercase() == player_name.lower()
    )
    if len(player_df) == 0:
        partial_matches = season_df.filter(
            pl.col("player_display_name").str.to_lowercase().str.contains(
                player_name.lower(), literal=True
            )
        )
        if len(partial_matches) == 0:
            print(f"❌ Player not found: {player_name}", file=sys.stderr)
            sys.exit(1)

        matched_players = partial_matches.select(
            ["player_id", "player_display_name", "position", "team"]
        ).unique(subset=["player_id"]).sort("player_display_name")

        if len(matched_players) > 1:
            print(f"❌ Ambiguous player name: {player_name}", file=sys.stderr)
            print("Matching players:", file=sys.stderr)
            for row in matched_players.iter_rows(named=True):
                print(
                    f"  - {row['player_display_name']} ({row['position']}, {row['team']})",
                    file=sys.stderr,
                )
            print("Use a more specific full name.", file=sys.stderr)
            sys.exit(1)

        player_id = matched_players["player_id"][0]
        player_df = season_df.filter(pl.col("player_id") == player_id)

    if len(player_df) == 0:
        print(f"❌ Player not found: {player_name}", file=sys.stderr)
        sys.exit(1)

    # Get player metadata from first row after disambiguation.
    player_meta = player_df.select(
        [
            pl.col("player_id").first().alias("player_id"),
            pl.col("position").first().alias("position"),
            pl.col("player_display_name").first().alias("player_display_name"),
            pl.col("team").first().alias("team"),
        ]
    ).row(0, named=True)
    player_id = player_meta["player_id"]
    position = player_meta["position"]
    player_display = player_meta["player_display_name"]
    team = player_meta["team"] if player_meta["team"] is not None else "N/A"
    
    # Aggregate stats across all weeks
    agg_exprs = []
    
    # Common counting stats
    count_cols = ["completions", "attempts", "passing_yards", "passing_tds", "passing_interceptions",
                  "carries", "rushing_yards", "rushing_tds", "targets", "receptions", 
                  "receiving_yards", "receiving_tds"]
    for col in count_cols:
        if col in player_df.columns:
            agg_exprs.append(pl.col(col).sum().alias(col))
    
    # EPA metrics (sum them)
    epa_cols = ["passing_epa", "rushing_epa", "receiving_epa"]
    for col in epa_cols:
        if col in player_df.columns:
            agg_exprs.append(pl.col(col).sum().alias(col))
    
    # Rate stats (mean them)
    rate_cols = ["cpoe", "dakota", "racr", "target_share", "air_yards_share"]
    for col in rate_cols:
        if col in player_df.columns:
            agg_exprs.append(pl.col(col).mean().alias(col))
    
    player = player_df.select(agg_exprs)
    
    # Calculate position rank for primary metric
    position_rank = None
    primary_metric = None
    
    if position == "QB" and "passing_epa" in player_df.columns:
        primary_metric = "passing_epa"
    elif position == "RB" and "rushing_epa" in player_df.columns:
        primary_metric = "rushing_epa"
    elif position in ["WR", "TE"] and "receiving_epa" in player_df.columns:
        primary_metric = "receiving_epa"
    
    if primary_metric:
        # Get all players at this position and rank by primary metric
        position_all = df.filter(
            (pl.col("position") == position) &
            (pl.col("season_type") == "REG")
        )
        
        # Aggregate by player
        position_agg = position_all.group_by("player_id").agg([
            pl.col("player_display_name").first().alias("player"),
            pl.col(primary_metric).sum().alias(primary_metric),
        ])
        
        # Rank descending by primary metric
        ranked = position_agg.filter(
            pl.col(primary_metric).is_not_null() & (pl.col(primary_metric) != 0)
        ).sort(primary_metric, descending=True).with_row_index("rank", offset=1)
        
        # Find our player's rank
        player_rank_row = ranked.filter(pl.col("player_id") == player_id)
        if len(player_rank_row) > 0:
            position_rank = player_rank_row["rank"][0]
    
    # Build output based on position
    if position == "QB":
        result = {
            "player": player_display,
            "position": position,
            "season": season,
            "team": team,
            "completions": player["completions"][0] if "completions" in player.columns else 0,
            "attempts": player["attempts"][0] if "attempts" in player.columns else 0,
            "passing_yards": player["passing_yards"][0] if "passing_yards" in player.columns else 0,
            "passing_tds": player["passing_tds"][0] if "passing_tds" in player.columns else 0,
            "interceptions": player["passing_interceptions"][0] if "passing_interceptions" in player.columns else 0,
            "passing_epa": round(player["passing_epa"][0], 3) if "passing_epa" in player.columns else None,
            "cpoe": round(player["cpoe"][0], 3) if "cpoe" in player.columns else None,
            "dakota": round(player["dakota"][0], 3) if "dakota" in player.columns else None,
            "position_rank": position_rank,
        }
    elif position == "RB":
        result = {
            "player": player_display,
            "position": position,
            "season": season,
            "team": team,
            "carries": player["carries"][0] if "carries" in player.columns else 0,
            "rushing_yards": player["rushing_yards"][0] if "rushing_yards" in player.columns else 0,
            "rushing_tds": player["rushing_tds"][0] if "rushing_tds" in player.columns else 0,
            "rushing_epa": round(player["rushing_epa"][0], 3) if "rushing_epa" in player.columns else None,
            "targets": player["targets"][0] if "targets" in player.columns else 0,
            "receptions": player["receptions"][0] if "receptions" in player.columns else 0,
            "receiving_yards": player["receiving_yards"][0] if "receiving_yards" in player.columns else 0,
            "receiving_tds": player["receiving_tds"][0] if "receiving_tds" in player.columns else 0,
            "position_rank": position_rank,
        }
    elif position in ["WR", "TE"]:
        result = {
            "player": player_display,
            "position": position,
            "season": season,
            "team": team,
            "targets": player["targets"][0] if "targets" in player.columns else 0,
            "receptions": player["receptions"][0] if "receptions" in player.columns else 0,
            "receiving_yards": player["receiving_yards"][0] if "receiving_yards" in player.columns else 0,
            "receiving_tds": player["receiving_tds"][0] if "receiving_tds" in player.columns else 0,
            "receiving_epa": round(player["receiving_epa"][0], 3) if "receiving_epa" in player.columns else None,
            "racr": round(player["racr"][0], 3) if "racr" in player.columns else None,
            "target_share": round(player["target_share"][0], 3) if "target_share" in player.columns else None,
            "air_yards_share": round(player["air_yards_share"][0], 3) if "air_yards_share" in player.columns else None,
            "position_rank": position_rank,
        }
    else:
        result = {
            "player": player_display,
            "position": position,
            "season": season,
            "team": team,
            "message": "Limited metrics available for this position",
            "position_rank": None,
        }
    
    if output_format == "json":
        print(json.dumps(result, indent=2))
    else:
        # Markdown table
        rank_display = f" (Rank #{result['position_rank']} among {result['position']}s)" if result.get('position_rank') else ""
        print(f"\n### {result['player']} — {season} Season{rank_display}\n")
        print(f"**Position:** {result['position']} | **Team:** {result.get('team', 'N/A')}\n")
        print("| Metric | Value |")
        print("|--------|------:|")
        for key, value in result.items():
            if key not in ["player", "position", "season", "team", "message", "position_rank"]:
                display_key = key.replace("_", " ").title()
                if value is None:
                    print(f"| {display_key} | N/A |")
                elif isinstance(value, float):
                    print(f"| {display_key} | {value:.3f} |")
                else:
                    print(f"| {display_key} | {value:,} |")
        if "message" in result:
            print(f"\n_{result['message']}_")
        print()


def main():
    parser = argparse.ArgumentParser(description="Query player EPA and efficiency metrics")
    parser.add_argument("--player", required=True, help="Player name (partial match OK)")
    parser.add_argument("--season", type=int, required=True, help="Season year (e.g., 2025)")
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown", help="Output format")
    
    args = parser.parse_args()
    query_player_epa(args.player, args.season, args.format)


if __name__ == "__main__":
    main()
