#!/usr/bin/env python3
"""
content/data/query_draft_value.py — Draft pick value and historical hit rates.

Usage:
    python content/data/query_draft_value.py --pick-range 1-10 --since 2015
    python content/data/query_draft_value.py --position WR --round 1 --since 2010
    python content/data/query_draft_value.py --player "Jaxon Smith-Njigba" --format json
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


def query_pick_range_value(pick_start: int, pick_end: int, since_year: int, output_format: str):
    """Query historical value (AV) for picks in a range."""
    df = load_cached_or_fetch("draft_picks", None)
    
    range_df = df.filter(
        (pl.col("pick") >= pick_start) &
        (pl.col("pick") <= pick_end) &
        (pl.col("season") >= since_year)
    )
    
    if len(range_df) == 0:
        print(f"Error: No draft picks in range {pick_start}-{pick_end} since {since_year}", file=sys.stderr)
        sys.exit(1)
    
    # Calculate stats by pick number (use w_av = weighted AV, since car_av is stored as bool)
    stats = range_df.group_by("pick").agg([
        pl.col("w_av").mean().alias("avg_av"),
        pl.col("w_av").median().alias("median_av"),
        pl.col("w_av").max().alias("max_av"),
        pl.len().alias("n_picks"),
    ]).sort("pick")
    
    results = []
    for row in stats.iter_rows(named=True):
        results.append({
            "pick": row["pick"],
            "avg_av": round(row["avg_av"], 1) if row["avg_av"] is not None else 0.0,
            "median_av": round(row["median_av"], 1) if row["median_av"] is not None else 0.0,
            "max_av": row["max_av"] if row["max_av"] is not None else 0,
            "n_picks": row["n_picks"],
        })
    
    if output_format == "json":
        print(json.dumps(results, indent=2))
    else:
        print(f"\n### Draft Pick Value — Picks {pick_start}-{pick_end} (Since {since_year})\n")
        print("| Pick | Avg AV | Median AV | Max AV | Picks (n) |")
        print("|-----:|-------:|----------:|-------:|----------:|")
        for r in results:
            print(f"| {r['pick']} | {r['avg_av']:.1f} | {r['median_av']:.1f} | {r['max_av']} | {r['n_picks']} |")
        print()
        print("*AV = Approximate Value (Pro Football Reference career value metric)*\n")


def query_position_hit_rate(position: str, round_num: int | None, since_year: int, output_format: str):
    """Query hit rate for a position by round."""
    df = load_cached_or_fetch("draft_picks", None)
    
    position_df = df.filter(
        (pl.col("position") == position.upper()) &
        (pl.col("season") >= since_year)
    )
    
    if round_num:
        position_df = position_df.filter(pl.col("round") == round_num)
    
    if len(position_df) == 0:
        print(f"Error: No {position} picks since {since_year}", file=sys.stderr)
        sys.exit(1)
    
    # Define "hit" thresholds by AV (simplified for demo)
    # Starter-level = AV >= 30, Solid = AV >= 50, Elite = AV >= 80
    stats = position_df.group_by("round").agg([
        pl.len().alias("n_picks"),
        pl.col("w_av").mean().alias("avg_av"),
        pl.col("w_av").median().alias("median_av"),
        (pl.col("w_av") >= 30).sum().alias("starter_plus"),
        (pl.col("w_av") >= 50).sum().alias("solid_plus"),
        (pl.col("w_av") >= 80).sum().alias("elite"),
    ]).sort("round")
    
    results = []
    for row in stats.iter_rows(named=True):
        n = row["n_picks"]
        results.append({
            "round": row["round"],
            "n_picks": n,
            "avg_av": round(row["avg_av"], 1) if row["avg_av"] is not None else 0.0,
            "median_av": round(row["median_av"], 1) if row["median_av"] is not None else 0.0,
            "starter_rate": round(100 * row["starter_plus"] / n, 1) if n > 0 else 0.0,
            "solid_rate": round(100 * row["solid_plus"] / n, 1) if n > 0 else 0.0,
            "elite_rate": round(100 * row["elite"] / n, 1) if n > 0 else 0.0,
        })
    
    if output_format == "json":
        print(json.dumps(results, indent=2))
    else:
        round_label = f" Round {round_num}" if round_num else " (All Rounds)"
        print(f"\n### {position} Draft Hit Rates{round_label} (Since {since_year})\n")
        print("| Round | Picks (n) | Avg AV | Median AV | Starter+ % | Solid+ % | Elite % |")
        print("|------:|----------:|-------:|----------:|-----------:|---------:|--------:|")
        for r in results:
            print(f"| {r['round']} | {r['n_picks']} | {r['avg_av']:.1f} | {r['median_av']:.1f} | {r['starter_rate']:.1f}% | {r['solid_rate']:.1f}% | {r['elite_rate']:.1f}% |")
        print()
        print("*Starter+ = AV >= 30, Solid+ = AV >= 50, Elite = AV >= 80*\n")


def query_player_draft_context(player_name: str, output_format: str):
    """Query draft context for a specific player."""
    df = load_cached_or_fetch("draft_picks", None)
    
    player_df = df.filter(
        pl.col("pfr_player_name").str.to_lowercase() == player_name.lower()
    )
    
    if len(player_df) == 0:
        partial_matches = df.filter(
            pl.col("pfr_player_name").str.to_lowercase().str.contains(player_name.lower(), literal=True)
        )
        if len(partial_matches) == 0:
            print(f"Error: Player not found in draft data: {player_name}", file=sys.stderr)
            sys.exit(1)
        
        if len(partial_matches) > 1:
            print(f"Error: Ambiguous player name: {player_name}", file=sys.stderr)
            print("Matching players:", file=sys.stderr)
            for row in partial_matches.select(["pfr_player_name", "season", "team", "round", "pick"]).head(10).iter_rows(named=True):
                print(f"  - {row['pfr_player_name']} ({row['season']}, {row['team']}, R{row['round']} #{row['pick']})", file=sys.stderr)
            print("Use a more specific full name.", file=sys.stderr)
            sys.exit(1)
        
        player_df = partial_matches
    
    result = {
        "player": player_df["pfr_player_name"][0],
        "season": player_df["season"][0],
        "team": player_df["team"][0],
        "round": player_df["round"][0],
        "pick": player_df["pick"][0],
        "position": player_df["position"][0],
        "av": player_df["w_av"][0] if player_df["w_av"][0] is not None else 0,
    }
    
    if output_format == "json":
        print(json.dumps(result, indent=2))
    else:
        print(f"\n### {result['player']} — Draft Profile\n")
        print(f"**Drafted:** {result['season']} by {result['team']}")
        print(f"**Pick:** Round {result['round']}, Pick #{result['pick']} ({result['position']})")
        print(f"**Career AV:** {result['av']}\n")


def main():
    parser = argparse.ArgumentParser(description="Query draft pick value and hit rates")
    parser.add_argument("--pick-range", help="Pick range (e.g., '1-10', '15-32')")
    parser.add_argument("--position", help="Position (e.g., WR, QB)")
    parser.add_argument("--round", type=int, help="Draft round (1-7)")
    parser.add_argument("--player", help="Player name for draft profile lookup")
    parser.add_argument("--since", type=int, default=2010, help="Since year (default: 2010)")
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown", help="Output format")
    
    args = parser.parse_args()
    
    if args.player:
        query_player_draft_context(args.player, args.format)
    elif args.pick_range:
        pick_start, pick_end = map(int, args.pick_range.split("-"))
        query_pick_range_value(pick_start, pick_end, args.since, args.format)
    elif args.position:
        query_position_hit_rate(args.position, args.round, args.since, args.format)
    else:
        print("Error: Must specify --player, --pick-range, or --position", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
