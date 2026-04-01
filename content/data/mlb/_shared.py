"""
content/data/mlb/_shared.py — Shared utilities for MLB Statcast query scripts.

Provides auto-fetch capability and common helpers.
"""

import subprocess
import sys
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    print("❌ Error: pandas not installed", file=sys.stderr)
    print("Install with: pip install -r requirements.txt", file=sys.stderr)
    sys.exit(1)

CACHE_DIR = Path(__file__).parent / "cache"
FETCH_SCRIPT = Path(__file__).parent / "fetch_statcast.py"

# Aliases for team abbreviations that differ between common usage and pybaseball.
TEAM_ALIASES: dict[str, str] = {
    "ANA": "LAA",   # Angels alias
    "FLA": "MIA",   # Marlins old
    "MON": "WSH",   # Expos -> Nationals
    "TBD": "TB",    # Rays old
    "CAL": "LAA",   # Angels very old
    "CWS": "CHW",   # White Sox alternate
}


def resolve_team_abbr(abbr: str) -> str:
    """Resolve common team abbreviation aliases to canonical form."""
    return TEAM_ALIASES.get(abbr.upper(), abbr.upper())


def load_cached_or_fetch(dataset: str, seasons: list[int] | None = None) -> pd.DataFrame:
    """
    Load dataset from cache, auto-fetching if cache miss.

    Args:
        dataset: Dataset name (e.g., "batting_stats", "pitching_stats")
        seasons: List of season years, or None for non-seasonal datasets

    Returns:
        pandas DataFrame with the dataset
    """
    CACHE_DIR.mkdir(exist_ok=True)

    # Build cache file path
    if seasons:
        season_str = "_".join(map(str, sorted(seasons)))
        cache_file = CACHE_DIR / f"{dataset}_{season_str}.parquet"
    else:
        cache_file = CACHE_DIR / f"{dataset}.parquet"

    # If cached, load and return
    if cache_file.exists():
        return pd.read_parquet(cache_file)

    # Cache miss — auto-fetch
    print(f"Cache miss: {cache_file.name} - auto-fetching...", file=sys.stderr)

    cmd = [sys.executable, str(FETCH_SCRIPT), "--dataset", dataset]
    if seasons:
        cmd.extend(["--seasons", ",".join(map(str, seasons))])

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(result.stdout, file=sys.stderr)
    except subprocess.CalledProcessError as e:
        print(f"ERROR: Auto-fetch failed - {e.stderr}", file=sys.stderr)
        sys.exit(1)

    # Load the newly cached data
    if not cache_file.exists():
        print(f"ERROR: Cache file not created: {cache_file}", file=sys.stderr)
        sys.exit(1)

    return pd.read_parquet(cache_file)
