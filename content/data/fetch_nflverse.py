#!/usr/bin/env python3
"""
content/data/fetch_nflverse.py — Cache nflverse datasets locally.

Usage:
    python content/data/fetch_nflverse.py --list
    python content/data/fetch_nflverse.py --dataset player_stats --seasons 2025
    python content/data/fetch_nflverse.py --dataset pbp --seasons 2024,2025
    python content/data/fetch_nflverse.py --dataset contracts
    python content/data/fetch_nflverse.py --refresh --dataset team_stats --seasons 2025
"""

import argparse
import sys
from pathlib import Path

try:
    import nflreadpy as nfl
    import polars as pl
except ImportError as e:
    print(f"❌ Error: {e}")
    print("Install dependencies with: pip install -r requirements.txt")
    sys.exit(1)

CACHE_DIR = Path(__file__).parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)

# Dataset catalog: name -> (loader_fn, needs_seasons, description)
DATASETS = {
    "pbp": (lambda s: nfl.load_pbp(s), True, "Play-by-play (372 cols: EPA, WPA, CPOE) — 1999-present"),
    "player_stats": (lambda s: nfl.load_player_stats(s), True, "Player stats (114 cols) — 1999-present"),
    "team_stats": (lambda s: nfl.load_team_stats(s), True, "Team offensive/defensive efficiency — 1999-present"),
    "ngs_passing": (lambda s: nfl.load_nextgen_stats(s, "passing"), True, "Next Gen Stats: passing (time to throw, air yards) — 2016-present"),
    "ngs_receiving": (lambda s: nfl.load_nextgen_stats(s, "receiving"), True, "Next Gen Stats: receiving (separation, cushion) — 2016-present"),
    "ngs_rushing": (lambda s: nfl.load_nextgen_stats(s, "rushing"), True, "Next Gen Stats: rushing (speed, efficiency) — 2016-present"),
    "snap_counts": (lambda s: nfl.load_snap_counts(s), True, "Snap counts by player — 2012-present"),
    "ftn_charting": (lambda s: nfl.load_ftn_charting(s), True, "FTN play charting (routes, formations) — 2022-present"),
    "contracts": (lambda _: nfl.load_contracts(), False, "Contract data (OTC source) — historical"),
    "draft_picks": (lambda _: nfl.load_draft_picks(), False, "Draft picks with AV — 1980-present"),
    "combine": (lambda _: nfl.load_combine(), False, "Combine measurables — 2000-present"),
    "rosters": (lambda s: nfl.load_rosters(s), True, "Weekly rosters — 1920-present"),
    "players": (lambda _: nfl.load_players(), False, "Player biographical data"),
    "pfr_passing": (lambda s: nfl.load_pfr_advstats(s, "pass"), True, "PFR advanced passing stats — 2018-present"),
    "pfr_rushing": (lambda s: nfl.load_pfr_advstats(s, "rush"), True, "PFR advanced rushing stats — 2018-present"),
    "pfr_receiving": (lambda s: nfl.load_pfr_advstats(s, "rec"), True, "PFR advanced receiving stats — 2018-present"),
    "pfr_defense": (lambda s: nfl.load_pfr_advstats(s, "def"), True, "PFR advanced defense stats — 2018-present"),
    "schedules": (lambda s: nfl.load_schedules(s), True, "Game schedules and results — 1999-present"),
}


def list_datasets():
    """Print all available datasets."""
    print("\nAvailable nflverse datasets:\n")
    for name, (_, needs_seasons, desc) in DATASETS.items():
        season_marker = "[needs seasons] " if needs_seasons else "[no seasons]   "
        print(f"  {season_marker} {name:<18} {desc}")
    print("\n[needs seasons] = requires --seasons  |  [no seasons] = no seasons arg needed\n")


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
        df = pl.read_parquet(cache_file)
        print(f"   {len(df):,} rows - {cache_file.stat().st_size / 1024 / 1024:.1f} MB")
        return

    # Fetch from nflverse
    print(f"Fetching {dataset} {' '.join(map(str, seasons)) if seasons else ''}...")
    try:
        if needs_seasons:
            df = loader(seasons)
        else:
            df = loader(None)
    except Exception as e:
        print(f"ERROR: Fetch failed for {dataset}: {e}", file=sys.stderr)
        sys.exit(1)

    # Write to cache
    df.write_parquet(cache_file)
    size_mb = cache_file.stat().st_size / 1024 / 1024
    print(f"OK: {dataset} - {len(df):,} rows -> {cache_file.name} ({size_mb:.1f} MB)")


def main():
    parser = argparse.ArgumentParser(
        description="Cache nflverse datasets locally",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python content/data/fetch_nflverse.py --list
  python content/data/fetch_nflverse.py --dataset player_stats --seasons 2025
  python content/data/fetch_nflverse.py --dataset pbp --seasons 2024,2025
  python content/data/fetch_nflverse.py --dataset contracts
  python content/data/fetch_nflverse.py --refresh --dataset team_stats --seasons 2025
        """,
    )
    parser.add_argument("--list", action="store_true", help="List all available datasets")
    parser.add_argument("--dataset", help="Dataset name to fetch")
    parser.add_argument("--seasons", help="Comma-separated season years (e.g., 2024,2025)")
    parser.add_argument("--refresh", action="store_true", help="Re-download even if cached")

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
            print("Use comma-separated years: --seasons 2024,2025", file=sys.stderr)
            sys.exit(1)

    fetch_dataset(args.dataset, seasons, args.refresh)


if __name__ == "__main__":
    main()
