#!/usr/bin/env python3
"""
content/data/query_ngs_passing.py — Next Gen Stats passing metrics.

Usage:
    python content/data/query_ngs_passing.py --player "Drake Maye" --season 2024
    python content/data/query_ngs_passing.py --top 10 --metric avg_time_to_throw --season 2024
    python content/data/query_ngs_passing.py --player "C.J. Stroud" --season 2024 --format json
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _shared import load_cached_or_fetch

try:
    import polars as pl
except ImportError:
    print("Error: polars not installed", file=sys.stderr)
    print("Install with: pip install -r requirements.txt", file=sys.stderr)
    sys.exit(1)


def query_player_ngs_passing(player_name: str, season: int, output_format: str):
    """Query NGS passing metrics for a player."""
    df = load_cached_or_fetch("ngs_passing", [season])
    
    player_df = df.filter(
        (pl.col("player_display_name").str.to_lowercase() == player_name.lower()) |
        (pl.col("player_short_name").str.to_lowercase() == player_name.lower())
    )
    
    if len(player_df) == 0:
        partial_matches = df.filter(
            pl.col("player_display_name").str.to_lowercase().str.contains(player_name.lower(), literal=True)
        )
        if len(partial_matches) == 0:
            print(f"Error: Player not found: {player_name}", file=sys.stderr)
            sys.exit(1)

        matched_players = partial_matches.select(["player_display_name", "team_abbr"]).unique()

        if len(matched_players) > 1:
            print(f"Error: Ambiguous player name: {player_name}", file=sys.stderr)
            print("Matching players:", file=sys.stderr)
            for row in matched_players.iter_rows(named=True):
                print(f"  - {row['player_display_name']} ({row['team_abbr']})", file=sys.stderr)
            print("Use a more specific full name.", file=sys.stderr)
            sys.exit(1)

        player_df = df.filter(pl.col("player_display_name") == matched_players["player_display_name"][0])
    
    # Aggregate across weeks
    agg = player_df.select([
        pl.col("player_display_name").first().alias("player"),
        pl.col("team_abbr").first().alias("team"),
        pl.col("attempts").sum().alias("attempts"),
        pl.col("pass_yards").sum().alias("pass_yards"),
        pl.col("pass_touchdowns").sum().alias("pass_tds"),
        pl.col("interceptions").sum().alias("interceptions"),
        pl.col("avg_time_to_throw").mean().alias("avg_time_to_throw"),
        pl.col("avg_completed_air_yards").mean().alias("avg_completed_air_yards"),
        pl.col("avg_intended_air_yards").mean().alias("avg_intended_air_yards"),
        pl.col("avg_air_yards_differential").mean().alias("avg_air_yards_differential"),
        pl.col("aggressiveness").mean().alias("aggressiveness"),
        pl.col("max_completed_air_distance").max().alias("max_completed_air_distance"),
        pl.col("avg_air_yards_to_sticks").mean().alias("avg_air_yards_to_sticks"),
    ])
    
    result = {
        "player": agg["player"][0],
        "team": agg["team"][0],
        "season": season,
        "attempts": agg["attempts"][0],
        "pass_yards": agg["pass_yards"][0],
        "pass_tds": agg["pass_tds"][0],
        "interceptions": agg["interceptions"][0],
        "avg_time_to_throw": round(agg["avg_time_to_throw"][0], 2) if agg["avg_time_to_throw"][0] is not None else None,
        "avg_completed_air_yards": round(agg["avg_completed_air_yards"][0], 1) if agg["avg_completed_air_yards"][0] is not None else None,
        "avg_intended_air_yards": round(agg["avg_intended_air_yards"][0], 1) if agg["avg_intended_air_yards"][0] is not None else None,
        "avg_air_yards_differential": round(agg["avg_air_yards_differential"][0], 1) if agg["avg_air_yards_differential"][0] is not None else None,
        "aggressiveness": round(agg["aggressiveness"][0], 1) if agg["aggressiveness"][0] is not None else None,
        "max_completed_air_distance": agg["max_completed_air_distance"][0],
        "avg_air_yards_to_sticks": round(agg["avg_air_yards_to_sticks"][0], 1) if agg["avg_air_yards_to_sticks"][0] is not None else None,
    }
    
    if output_format == "json":
        print(json.dumps(result, indent=2))
    else:
        print(f"\n### {result['player']} — {season} Next Gen Stats (Passing)\n")
        print(f"**Team:** {result['team']}\n")
        print("| Metric | Value |")
        print("|--------|------:|")
        print(f"| Attempts | {result['attempts']:,} |")
        print(f"| Pass Yards | {result['pass_yards']:,} |")
        print(f"| Pass TDs | {result['pass_tds']} |")
        print(f"| Interceptions | {result['interceptions']} |")
        print(f"| Avg Time to Throw | {result['avg_time_to_throw']:.2f}s |" if result['avg_time_to_throw'] is not None else "| Avg Time to Throw | N/A |")
        print(f"| Avg Completed Air Yards | {result['avg_completed_air_yards']:.1f} |" if result['avg_completed_air_yards'] is not None else "| Avg Completed Air Yards | N/A |")
        print(f"| Avg Intended Air Yards | {result['avg_intended_air_yards']:.1f} |" if result['avg_intended_air_yards'] is not None else "| Avg Intended Air Yards | N/A |")
        print(f"| Air Yards Differential | {result['avg_air_yards_differential']:+.1f} |" if result['avg_air_yards_differential'] is not None else "| Air Yards Differential | N/A |")
        print(f"| Aggressiveness % | {result['aggressiveness']:.1f}% |" if result['aggressiveness'] is not None else "| Aggressiveness % | N/A |")
        print(f"| Max Completed Air Distance | {result['max_completed_air_distance']:.1f} |" if result['max_completed_air_distance'] is not None else "| Max Completed Air Distance | N/A |")
        print(f"| Avg Air Yards to Sticks | {result['avg_air_yards_to_sticks']:+.1f} |" if result['avg_air_yards_to_sticks'] is not None else "| Avg Air Yards to Sticks | N/A |")
        print()
        print("*Aggressiveness = % of passes 20+ air yards downfield*\n")


def query_top_ngs_passing(top: int, metric: str, season: int, output_format: str):
    """Query top QBs by NGS passing metric."""
    df = load_cached_or_fetch("ngs_passing", [season])
    
    valid_metrics = [
        "avg_time_to_throw", "avg_completed_air_yards", "avg_intended_air_yards",
        "avg_air_yards_differential", "aggressiveness", "max_completed_air_distance",
        "avg_air_yards_to_sticks", "attempts", "pass_yards", "pass_touchdowns"
    ]
    
    if metric not in valid_metrics:
        print(f"Error: Invalid metric: {metric}", file=sys.stderr)
        print(f"Valid metrics: {', '.join(valid_metrics)}", file=sys.stderr)
        sys.exit(1)
    
    # Aggregate by player
    agg = df.group_by("player_display_name").agg([
        pl.col("team_abbr").first().alias("team"),
        pl.col("attempts").sum().alias("attempts"),
        pl.col("pass_yards").sum().alias("pass_yards"),
        pl.col("pass_touchdowns").sum().alias("pass_touchdowns"),
        pl.col("avg_time_to_throw").mean().alias("avg_time_to_throw"),
        pl.col("avg_completed_air_yards").mean().alias("avg_completed_air_yards"),
        pl.col("avg_intended_air_yards").mean().alias("avg_intended_air_yards"),
        pl.col("avg_air_yards_differential").mean().alias("avg_air_yards_differential"),
        pl.col("aggressiveness").mean().alias("aggressiveness"),
        pl.col("max_completed_air_distance").max().alias("max_completed_air_distance"),
        pl.col("avg_air_yards_to_sticks").mean().alias("avg_air_yards_to_sticks"),
    ])
    
    # Filter to qualified QBs (100+ attempts)
    qualified = agg.filter(pl.col("attempts") >= 100)
    
    # Sort by metric
    descending = metric not in ["avg_time_to_throw"]  # TTT lower is better
    ranked = qualified.sort(metric, descending=descending).head(top)
    
    results = []
    for row in ranked.iter_rows(named=True):
        results.append({
            "player": row["player_display_name"],
            "team": row["team"],
            "attempts": row["attempts"],
            "metric_value": round(row[metric], 2) if row[metric] is not None else None,
        })
    
    if output_format == "json":
        print(json.dumps(results, indent=2))
    else:
        metric_display = metric.replace("_", " ").title()
        print(f"\n### Top {len(results)} QBs by {metric_display} — {season}\n")
        print(f"*(Minimum 100 attempts)*\n")
        print("| Rank | Player | Team | Attempts | Metric Value |")
        print("|-----:|--------|------|----------:|-------------:|")
        for i, r in enumerate(results, 1):
            val = f"{r['metric_value']:.2f}" if r['metric_value'] is not None else "N/A"
            print(f"| {i} | {r['player']} | {r['team']} | {r['attempts']:,} | {val} |")
        print()


def main():
    parser = argparse.ArgumentParser(description="Query Next Gen Stats passing metrics")
    parser.add_argument("--player", help="Player name")
    parser.add_argument("--top", type=int, help="Show top N QBs by metric")
    parser.add_argument("--metric", help="NGS metric to rank by (e.g., avg_time_to_throw, aggressiveness)")
    parser.add_argument("--season", type=int, required=True, help="Season year (NGS data available 2016+)")
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown", help="Output format")
    
    args = parser.parse_args()
    
    if args.player:
        query_player_ngs_passing(args.player, args.season, args.format)
    elif args.top and args.metric:
        query_top_ngs_passing(args.top, args.metric, args.season, args.format)
    else:
        print("Error: Must specify --player or (--top and --metric)", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
