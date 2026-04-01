#!/usr/bin/env python3
"""
content/data/mlb/fetch_statcast.py — Cache MLB Statcast datasets locally.

Usage:
    python content/data/mlb/fetch_statcast.py --list
    python content/data/mlb/fetch_statcast.py --dataset batting_stats --seasons 2024
    python content/data/mlb/fetch_statcast.py --dataset pitching_stats --seasons 2024
    python content/data/mlb/fetch_statcast.py --dataset team_batting --seasons 2024
    python content/data/mlb/fetch_statcast.py --refresh --dataset standings --seasons 2024
"""

import argparse
import sys
from pathlib import Path

try:
    import pandas as pd
    from pybaseball import (
        batting_stats,
        pitching_stats,
        team_batting,
        team_pitching,
        standings,
    )
except ImportError as e:
    print(f"❌ Error: {e}")
    print("Install dependencies with: pip install -r requirements.txt")
    sys.exit(1)

CACHE_DIR = Path(__file__).parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)

# Dataset catalog: name -> (loader_fn, needs_seasons, description)
# pybaseball functions accept a single season year (int).
DATASETS = {
    "batting_stats": (
        lambda s: batting_stats(s, qual=0),
        True,
        "Season batting stats (AVG, OBP, SLG, wRC+, WAR) — 1871-present",
    ),
    "pitching_stats": (
        lambda s: pitching_stats(s, qual=0),
        True,
        "Season pitching stats (ERA, FIP, K/9, WAR) — 1871-present",
    ),
    "team_batting": (
        lambda s: team_batting(s),
        True,
        "Team-level batting aggregates — 1871-present",
    ),
    "team_pitching": (
        lambda s: team_pitching(s),
        True,
        "Team-level pitching aggregates — 1871-present",
    ),
    "standings": (
        lambda s: _fetch_standings(s),
        True,
        "Division standings (W, L, W-L%) — 1969-present",
    ),
}


def _fetch_standings(season: int) -> pd.DataFrame:
    """Fetch standings and flatten the list of division DataFrames."""
    division_dfs = standings(season)
    if isinstance(division_dfs, list):
        return pd.concat(division_dfs, ignore_index=True)
    return division_dfs


def _fetch_seasonal(loader, seasons: list[int]) -> pd.DataFrame:
    """Fetch a seasonal dataset across multiple years and concatenate."""
    frames = []
    for s in seasons:
        print(f"  Fetching season {s}...")
        df = loader(s)
        if isinstance(df, pd.DataFrame) and not df.empty:
            df["Season"] = s
            frames.append(df)
    if not frames:
        print("WARNING: No data returned for the requested seasons", file=sys.stderr)
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True)


def list_datasets():
    """Print all available datasets."""
    print("\nAvailable MLB Statcast datasets:\n")
    for name, (_, needs_seasons, desc) in DATASETS.items():
        season_marker = "[needs seasons] " if needs_seasons else "[no seasons]   "
        print(f"  {season_marker} {name:<18} {desc}")
    print(
        "\n[needs seasons] = requires --seasons  |  [no seasons] = no seasons arg needed\n"
    )


def fetch_dataset(dataset: str, seasons: list[int] | None, refresh: bool):
    """Fetch and cache a dataset."""
    if dataset not in DATASETS:
        print(f"ERROR: Unknown dataset: {dataset}", file=sys.stderr)
        print("Run with --list to see available datasets", file=sys.stderr)
        sys.exit(1)

    loader, needs_seasons, desc = DATASETS[dataset]

    # Build cache file path
    if needs_seasons:
        if not seasons:
            print(f"ERROR: Dataset '{dataset}' requires --seasons", file=sys.stderr)
            sys.exit(1)
        season_str = "_".join(map(str, sorted(seasons)))
        cache_file = CACHE_DIR / f"{dataset}_{season_str}.parquet"
    else:
        cache_file = CACHE_DIR / f"{dataset}.parquet"

    # Check for existing cache
    if cache_file.exists() and not refresh:
        print(f"OK: Using cached data: {cache_file.name}")
        df = pd.read_parquet(cache_file)
        print(f"   {len(df):,} rows - {cache_file.stat().st_size / 1024 / 1024:.1f} MB")
        return

    # Fetch from pybaseball
    print(f"Fetching {dataset} {' '.join(map(str, seasons)) if seasons else ''}...")
    try:
        if needs_seasons:
            df = _fetch_seasonal(loader, seasons)
        else:
            df = loader(None)
    except Exception as e:
        print(f"ERROR: Fetch failed for {dataset}: {e}", file=sys.stderr)
        sys.exit(1)

    # Write to cache
    df.to_parquet(cache_file, index=False)
    size_mb = cache_file.stat().st_size / 1024 / 1024
    print(f"OK: {dataset} - {len(df):,} rows -> {cache_file.name} ({size_mb:.1f} MB)")


def main():
    parser = argparse.ArgumentParser(
        description="Cache MLB Statcast datasets locally",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python content/data/mlb/fetch_statcast.py --list
  python content/data/mlb/fetch_statcast.py --dataset batting_stats --seasons 2024
  python content/data/mlb/fetch_statcast.py --dataset pitching_stats --seasons 2023,2024
  python content/data/mlb/fetch_statcast.py --dataset team_batting --seasons 2024
  python content/data/mlb/fetch_statcast.py --refresh --dataset standings --seasons 2024
        """,
    )
    parser.add_argument("--list", action="store_true", help="List all available datasets")
    parser.add_argument("--dataset", help="Dataset name to fetch")
    parser.add_argument(
        "--seasons", help="Comma-separated season years (e.g., 2023,2024)"
    )
    parser.add_argument(
        "--refresh", action="store_true", help="Re-download even if cached"
    )

    args = parser.parse_args()

    if args.list:
        list_datasets()
        return

    if not args.dataset:
        print("ERROR: Missing required argument: --dataset", file=sys.stderr)
        print("Run with --list to see available datasets", file=sys.stderr)
        sys.exit(1)

    seasons = None
    if args.seasons:
        try:
            seasons = [int(s.strip()) for s in args.seasons.split(",")]
        except ValueError:
            print(f"ERROR: Invalid --seasons format: {args.seasons}", file=sys.stderr)
            print("Use comma-separated years: --seasons 2023,2024", file=sys.stderr)
            sys.exit(1)

    fetch_dataset(args.dataset, seasons, args.refresh)


if __name__ == "__main__":
    main()
