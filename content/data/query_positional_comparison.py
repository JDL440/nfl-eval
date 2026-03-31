#!/usr/bin/env python3
"""
content/data/query_positional_comparison.py — Positional rankings league-wide.

Usage:
    python content/data/query_positional_comparison.py --position WR --metric receiving_epa --season 2025 --top 20
    python content/data/query_positional_comparison.py --position QB --metric passing_epa --season 2025 --top 10
    python content/data/query_positional_comparison.py --position RB --metric rushing_yards --season 2025 --format json
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

CACHE_DIR = Path(__file__).parent / "cache"

# Position -> available metrics mapping
POSITION_METRICS = {
    "QB": ["passing_epa", "passing_yards", "passing_tds", "completions", "attempts", "passing_cpoe", "fantasy_points", "fantasy_points_ppr"],
    "RB": ["rushing_epa", "rushing_yards", "rushing_tds", "carries", "receiving_yards", "receptions", "targets", "fantasy_points", "fantasy_points_ppr"],
    "WR": ["receiving_epa", "receiving_yards", "receiving_tds", "receptions", "targets", "target_share", "air_yards_share", "racr", "fantasy_points", "fantasy_points_ppr"],
    "TE": ["receiving_epa", "receiving_yards", "receiving_tds", "receptions", "targets", "target_share", "air_yards_share", "fantasy_points", "fantasy_points_ppr"],
}


def load_player_stats(seasons: list[int]) -> pl.DataFrame:
    """Load player stats from cache or fetch."""
    season_str = "_".join(map(str, sorted(seasons)))
    cache_file = CACHE_DIR / f"player_stats_{season_str}.parquet"
    
    if not cache_file.exists():
        print(f"❌ Cache miss: {cache_file.name}", file=sys.stderr)
        print(f"Run: python content/data/fetch_nflverse.py --dataset player_stats --seasons {','.join(map(str, seasons))}", file=sys.stderr)
        sys.exit(1)
    
    return pl.read_parquet(cache_file)


def query_positional_comparison(position: str, metric: str, season: int, top_n: int = 20, output_format: str = "markdown"):
    """Query positional rankings by metric."""
    position = position.upper()
    
    if position not in POSITION_METRICS:
        print(f"❌ Unsupported position: {position}", file=sys.stderr)
        print(f"Available positions: {', '.join(POSITION_METRICS.keys())}", file=sys.stderr)
        sys.exit(1)
    
    if metric not in POSITION_METRICS[position]:
        print(f"❌ Metric '{metric}' not available for {position}", file=sys.stderr)
        print(f"Available metrics for {position}: {', '.join(POSITION_METRICS[position])}", file=sys.stderr)
        sys.exit(1)
    
    df = load_cached_or_fetch("player_stats", [season])
    
    # Filter to position and regular season only
    position_df = df.filter(
        (pl.col("position") == position) &
        (pl.col("season_type") == "REG")
    )
    
    if metric not in position_df.columns:
        print(f"❌ Metric column '{metric}' not found in dataset", file=sys.stderr)
        sys.exit(1)
    
    # Aggregate by player across all weeks
    agg_exprs = [
        pl.col("player_display_name").first().alias("player"),
        pl.col("team").first().alias("team"),
    ]
    
    # Sum counting stats
    count_cols = ["attempts", "completions", "passing_yards", "passing_tds", "carries", 
                  "rushing_yards", "rushing_tds", "targets", "receptions", "receiving_yards", "receiving_tds",
                  "fantasy_points", "fantasy_points_ppr", "fantasy_points_half_ppr"]
    for col in count_cols:
        if col in position_df.columns:
            agg_exprs.append(pl.col(col).sum().alias(col))
    
    # Sum EPA metrics
    epa_cols = ["passing_epa", "rushing_epa", "receiving_epa"]
    for col in epa_cols:
        if col in position_df.columns:
            agg_exprs.append(pl.col(col).sum().alias(col))
    
    # Mean rate stats
    rate_cols = ["passing_cpoe", "racr", "target_share", "air_yards_share"]
    for col in rate_cols:
        if col in position_df.columns:
            agg_exprs.append(pl.col(col).mean().alias(col))
    
    # Group by player_id to get season totals
    aggregated = position_df.group_by("player_id").agg(agg_exprs)
    
    # Filter out null/zero values for the metric, then sort descending
    ranked_df = aggregated.filter(
        pl.col(metric).is_not_null() & (pl.col(metric) != 0)
    ).sort(metric, descending=True).head(top_n)
    
    if len(ranked_df) == 0:
        print(f"❌ No data found for {position} with metric {metric}", file=sys.stderr)
        sys.exit(1)
    
    # Build results
    results = []
    for idx, row in enumerate(ranked_df.iter_rows(named=True), start=1):
        result = {
            "rank": idx,
            "player": row["player"],
            "team": row.get("team", "N/A"),
            metric: row[metric],
        }
        
        # Add contextual stats based on position
        if position == "QB":
            result["attempts"] = row.get("attempts", 0)
            result["passing_yards"] = row.get("passing_yards", 0)
            result["passing_tds"] = row.get("passing_tds", 0)
        elif position == "RB":
            if "rushing" in metric:
                result["carries"] = row.get("carries", 0)
                result["rushing_yards"] = row.get("rushing_yards", 0)
            result["receptions"] = row.get("receptions", 0)
        elif position in ["WR", "TE"]:
            result["targets"] = row.get("targets", 0)
            result["receptions"] = row.get("receptions", 0)
            result["receiving_yards"] = row.get("receiving_yards", 0)
        
        results.append(result)
    
    if output_format == "json":
        print(json.dumps(results, indent=2))
    else:
        # Markdown table
        print(f"\n### Top {len(results)} {position}s by {metric.replace('_', ' ').title()} — {season}\n")
        
        # Determine columns based on position
        if position == "QB":
            print("| Rank | Player | Team | Attempts | Pass Yds | Pass TDs | EPA |")
            print("|-----:|--------|------|----------:|---------:|---------:|-----:|")
            for r in results:
                metric_val = r.get(metric)
                display_val = f"{metric_val:.3f}" if isinstance(metric_val, float) else f"{metric_val:,}"
                print(f"| {r['rank']} | {r['player']} | {r['team']} | {r.get('attempts', 0):,} | {r.get('passing_yards', 0):,} | {r.get('passing_tds', 0)} | {display_val} |")
        elif position == "RB":
            print("| Rank | Player | Team | Carries | Rush Yds | Rec | Rec Yds | Metric Value |")
            print("|-----:|--------|------|--------:|---------:|----:|--------:|-------------:|")
            for r in results:
                metric_val = r.get(metric)
                display_val = f"{metric_val:.3f}" if isinstance(metric_val, float) else f"{metric_val:,}"
                print(f"| {r['rank']} | {r['player']} | {r['team']} | {r.get('carries', 0):,} | {r.get('rushing_yards', 0):,} | {r.get('receptions', 0)} | {r.get('receiving_yards', 0):,} | {display_val} |")
        elif position in ["WR", "TE"]:
            print("| Rank | Player | Team | Targets | Rec | Rec Yds | Metric Value |")
            print("|-----:|--------|------|--------:|----:|--------:|-------------:|")
            for r in results:
                metric_val = r.get(metric)
                display_val = f"{metric_val:.3f}" if isinstance(metric_val, float) else f"{metric_val:,}"
                print(f"| {r['rank']} | {r['player']} | {r['team']} | {r.get('targets', 0)} | {r.get('receptions', 0)} | {r.get('receiving_yards', 0):,} | {display_val} |")
        
        print()


def main():
    parser = argparse.ArgumentParser(description="Query positional rankings league-wide")
    parser.add_argument("--position", required=True, help="Position (QB, RB, WR, TE)")
    parser.add_argument("--metric", required=True, help="Metric to rank by (e.g., receiving_epa, passing_yards)")
    parser.add_argument("--season", type=int, required=True, help="Season year (e.g., 2025)")
    parser.add_argument("--top", type=int, default=20, help="Number of players to return (default: 20)")
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown", help="Output format")
    
    args = parser.parse_args()
    query_positional_comparison(args.position, args.metric, args.season, args.top, args.format)


if __name__ == "__main__":
    main()
