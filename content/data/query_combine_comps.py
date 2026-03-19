#!/usr/bin/env python3
"""
content/data/query_combine_comps.py — Combine measurables and historical comps.

Usage:
    python content/data/query_combine_comps.py --player "Jaxon Smith-Njigba"
    python content/data/query_combine_comps.py --position WR --top 20 --metric forty
    python content/data/query_combine_comps.py --player "Drake Maye" --format json
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


def query_player_combine(player_name: str, output_format: str):
    """Query combine measurables for a player."""
    df = load_cached_or_fetch("combine", None)
    
    player_df = df.filter(
        pl.col("player_name").str.to_lowercase() == player_name.lower()
    )
    
    if len(player_df) == 0:
        partial_matches = df.filter(
            pl.col("player_name").str.to_lowercase().str.contains(player_name.lower(), literal=True)
        )
        if len(partial_matches) == 0:
            print(f"Error: Player not found in combine data: {player_name}", file=sys.stderr)
            sys.exit(1)

        matched_players = partial_matches.select(["player_name", "season", "pos"]).unique()

        if len(matched_players) > 1:
            print(f"Error: Ambiguous player name: {player_name}", file=sys.stderr)
            print("Matching players:", file=sys.stderr)
            for row in matched_players.head(10).iter_rows(named=True):
                print(f"  - {row['player_name']} ({row['season']}, {row['pos']})", file=sys.stderr)
            print("Use a more specific full name.", file=sys.stderr)
            sys.exit(1)

        player_df = df.filter(
            (pl.col("player_name") == matched_players["player_name"][0]) &
            (pl.col("season") == matched_players["season"][0])
        )
    
    row = player_df.row(0, named=True)
    result = {
        "player": row["player_name"],
        "season": row["season"],
        "position": row["pos"],  # combine uses 'pos' not 'position'
        "height": row["ht"] if row["ht"] is not None else None,  # already formatted as "6-1"
        "weight": row["wt"] if row["wt"] is not None else None,
        "forty": round(row["forty"], 2) if row["forty"] is not None else None,
        "vertical": round(row["vertical"], 1) if row["vertical"] is not None else None,
        "bench": row["bench"] if row["bench"] is not None else None,
        "broad_jump": row["broad_jump"] if row["broad_jump"] is not None else None,
        "cone": round(row["cone"], 2) if row["cone"] is not None else None,
        "shuttle": round(row["shuttle"], 2) if row["shuttle"] is not None else None,
    }
    
    if output_format == "json":
        print(json.dumps(result, indent=2))
    else:
        print(f"\n### {result['player']} — {result['season']} NFL Combine\n")
        print(f"**Position:** {result['position']}\n")
        print("| Metric | Value |")
        print("|--------|------:|")
        print(f"| Height | {result['height']} |" if result['height'] is not None else "| Height | N/A |")
        print(f"| Weight | {result['weight']:.0f} lbs |" if result['weight'] is not None else "| Weight | N/A |")
        print(f"| 40-Yard Dash | {result['forty']:.2f}s |" if result['forty'] is not None else "| 40-Yard Dash | N/A |")
        print(f"| Vertical Jump | {result['vertical']:.1f} in |" if result['vertical'] is not None else "| Vertical Jump | N/A |")
        print(f"| Bench Press | {result['bench']} reps |" if result['bench'] is not None else "| Bench Press | N/A |")
        print(f"| Broad Jump | {result['broad_jump']} in |" if result['broad_jump'] is not None else "| Broad Jump | N/A |")
        print(f"| 3-Cone Drill | {result['cone']:.2f}s |" if result['cone'] is not None else "| 3-Cone Drill | N/A |")
        print(f"| 20-Yard Shuttle | {result['shuttle']:.2f}s |" if result['shuttle'] is not None else "| 20-Yard Shuttle | N/A |")
        print()


def query_position_combine_leaders(position: str, metric: str, top: int, output_format: str):
    """Query top performers at a position for a combine metric."""
    df = load_cached_or_fetch("combine", None)
    
    valid_metrics = ["forty", "vertical", "bench", "broad_jump", "cone", "shuttle", "ht", "wt"]
    
    if metric not in valid_metrics:
        print(f"Error: Invalid metric: {metric}", file=sys.stderr)
        print(f"Valid metrics: {', '.join(valid_metrics)}", file=sys.stderr)
        sys.exit(1)
    
    position_df = df.filter(
        (pl.col("pos") == position.upper()) &  # combine uses 'pos' not 'position'
        (pl.col(metric).is_not_null())
    )
    
    if len(position_df) == 0:
        print(f"Error: No combine data for {position} with {metric}", file=sys.stderr)
        sys.exit(1)
    
    # Lower is better for timed drills (forty, cone, shuttle)
    descending = metric not in ["forty", "cone", "shuttle"]
    ranked = position_df.sort(metric, descending=descending).head(top)
    
    results = []
    for row in ranked.iter_rows(named=True):
        results.append({
            "player": row["player_name"],
            "season": row["season"],
            "position": row["pos"],  # combine uses 'pos'
            "metric_value": round(row[metric], 2) if isinstance(row[metric], float) else row[metric],
        })
    
    if output_format == "json":
        print(json.dumps(results, indent=2))
    else:
        metric_display = metric.replace("_", " ").title()
        print(f"\n### Top {len(results)} {position}s by {metric_display} (All-Time Combine)\n")
        print("| Rank | Player | Year | Value |")
        print("|-----:|--------|-----:|------:|")
        for i, r in enumerate(results, 1):
            val = f"{r['metric_value']:.2f}" if isinstance(r['metric_value'], float) else r['metric_value']
            print(f"| {i} | {r['player']} | {r['season']} | {val} |")
        print()


def main():
    parser = argparse.ArgumentParser(description="Query combine measurables and comps")
    parser.add_argument("--player", help="Player name")
    parser.add_argument("--position", help="Position (e.g., WR, QB)")
    parser.add_argument("--metric", help="Combine metric (forty, vertical, bench, broad_jump, cone, shuttle)")
    parser.add_argument("--top", type=int, default=20, help="Number of top performers to show (default: 20)")
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown", help="Output format")
    
    args = parser.parse_args()
    
    if args.player:
        query_player_combine(args.player, args.format)
    elif args.position and args.metric:
        query_position_combine_leaders(args.position, args.metric, args.top, args.format)
    else:
        print("Error: Must specify --player or (--position and --metric)", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
