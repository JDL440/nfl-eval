#!/usr/bin/env python3
"""
content/data/query_historical_comps.py — Historical player comparison framework.

Find statistically similar players across 5+ seasons using normalized metrics.

Usage:
    python content/data/query_historical_comps.py --player "Jaxon Smith-Njigba" --season 2025 --seasons-back 5
    python content/data/query_historical_comps.py --player "Drake Maye" --season 2025 --seasons-back 5 --top 10
    python content/data/query_historical_comps.py --player "Bijan Robinson" --season 2025 --format json
"""

import argparse
import json
import math
import sys
from pathlib import Path

# Import shared auto-fetch helper
sys.path.insert(0, str(Path(__file__).parent))
from _shared import load_cached_or_fetch

try:
    import polars as pl
except ImportError:
    print("❌ Error: polars not installed", file=sys.stderr)
    print("Install with: pip install -r requirements.txt", file=sys.stderr)
    sys.exit(1)


# Position-specific comparison configs
POSITION_CONFIGS = {
    "QB": {
        "metrics": ["completions", "attempts", "passing_yards", "passing_tds",
                     "interceptions", "passing_epa", "cpoe", "dakota"],
        "min_volume_col": "attempts",
        "min_volume": 200,
        "count_cols": ["completions", "attempts", "passing_yards", "passing_tds",
                       "interceptions"],
        "sum_cols": ["passing_epa"],
        "rate_cols": ["cpoe", "dakota"],
        "key_stats": lambda r: (
            f"{_fmt_int(r.get('passing_yards'))} yds, "
            f"{_fmt_int(r.get('passing_tds'))} TD, "
            f"{_fmt_float(r.get('passing_epa'))} EPA"
        ),
    },
    "RB": {
        "metrics": ["carries", "rushing_yards", "rushing_tds", "rushing_epa",
                     "targets", "receptions", "receiving_yards"],
        "min_volume_col": "carries",
        "min_volume": 100,
        "count_cols": ["carries", "rushing_yards", "rushing_tds", "targets",
                       "receptions", "receiving_yards"],
        "sum_cols": ["rushing_epa"],
        "rate_cols": [],
        "key_stats": lambda r: (
            f"{_fmt_int(r.get('rushing_yards'))} rush yds, "
            f"{_fmt_int(r.get('rushing_tds'))} TD, "
            f"{_fmt_int(r.get('receptions'))} rec"
        ),
    },
    "WR": {
        "metrics": ["targets", "receptions", "receiving_yards", "receiving_tds",
                     "receiving_epa", "racr", "target_share", "air_yards_share"],
        "min_volume_col": "targets",
        "min_volume": 50,
        "count_cols": ["targets", "receptions", "receiving_yards", "receiving_tds"],
        "sum_cols": ["receiving_epa"],
        "rate_cols": ["racr", "target_share", "air_yards_share"],
        "key_stats": lambda r: (
            f"{_fmt_int(r.get('receptions'))} rec, "
            f"{_fmt_int(r.get('receiving_yards'))} yds, "
            f"{_fmt_int(r.get('receiving_tds'))} TD"
        ),
    },
    "TE": {
        "metrics": ["targets", "receptions", "receiving_yards", "receiving_tds",
                     "receiving_epa", "racr", "target_share", "air_yards_share"],
        "min_volume_col": "targets",
        "min_volume": 30,
        "count_cols": ["targets", "receptions", "receiving_yards", "receiving_tds"],
        "sum_cols": ["receiving_epa"],
        "rate_cols": ["racr", "target_share", "air_yards_share"],
        "key_stats": lambda r: (
            f"{_fmt_int(r.get('receptions'))} rec, "
            f"{_fmt_int(r.get('receiving_yards'))} yds, "
            f"{_fmt_int(r.get('receiving_tds'))} TD"
        ),
    },
}


def _fmt_int(v) -> str:
    """Format an integer value with comma separator, or 'N/A'."""
    if v is None:
        return "N/A"
    return f"{int(v):,}"


def _fmt_float(v) -> str:
    """Format a float value to 1 decimal, or 'N/A'."""
    if v is None:
        return "N/A"
    return f"{v:.1f}"


def _find_player(df: pl.DataFrame, player_name: str):
    """
    Locate a player via exact (case-insensitive) then partial match.

    Returns (player_id, player_display_name, position, team) or exits on
    failure / ambiguity.
    """
    exact = df.filter(
        pl.col("player_display_name").str.to_lowercase() == player_name.lower()
    )
    if len(exact) > 0:
        meta = exact.select(
            ["player_id", "player_display_name", "position", "team"]
        ).unique(subset=["player_id"])
        return meta.row(0, named=True)

    partial = df.filter(
        pl.col("player_display_name").str.to_lowercase().str.contains(
            player_name.lower(), literal=True
        )
    )
    if len(partial) == 0:
        print(f"❌ Player not found: {player_name}", file=sys.stderr)
        sys.exit(1)

    matched = partial.select(
        ["player_id", "player_display_name", "position", "team"]
    ).unique(subset=["player_id"]).sort("player_display_name")

    if len(matched) > 1:
        print(f"❌ Ambiguous player name: {player_name}", file=sys.stderr)
        print("Matching players:", file=sys.stderr)
        for row in matched.iter_rows(named=True):
            print(
                f"  - {row['player_display_name']} ({row['position']}, {row['team']})",
                file=sys.stderr,
            )
        print("Use a more specific full name.", file=sys.stderr)
        sys.exit(1)

    return matched.row(0, named=True)


def _aggregate_pool(df: pl.DataFrame, config: dict) -> pl.DataFrame:
    """
    Aggregate weekly rows into one row per player-season.

    Counting/EPA cols are summed; rate cols are averaged.
    """
    agg_exprs = [
        pl.col("player_display_name").first().alias("player_display_name"),
        pl.col("position").first().alias("position"),
        pl.col("team").first().alias("team"),
    ]

    all_count = config["count_cols"]
    all_sum = config["sum_cols"]
    all_rate = config["rate_cols"]

    for col in all_count:
        if col in df.columns:
            agg_exprs.append(pl.col(col).sum().alias(col))

    for col in all_sum:
        if col in df.columns:
            agg_exprs.append(pl.col(col).sum().alias(col))

    for col in all_rate:
        if col in df.columns:
            agg_exprs.append(pl.col(col).mean().alias(col))

    return df.group_by(["player_id", "season"]).agg(agg_exprs)


def _zscore_and_distance(
    pool: pl.DataFrame,
    target_player_id: str,
    target_season: int,
    metrics: list[str],
    count_cols: list[str],
) -> pl.DataFrame:
    """
    Z-score normalize metrics across the pool, then compute Euclidean
    distance from the target player-season to every other row.
    """
    # Keep only metrics that actually exist in the data
    available = [m for m in metrics if m in pool.columns]
    if not available:
        print("❌ No comparison metrics available in data", file=sys.stderr)
        sys.exit(1)

    # Fill nulls: 0 for counting/sum stats, leave rate stats as null
    fill_zero = [c for c in available if c in count_cols or c.endswith("_epa")]
    if fill_zero:
        pool = pool.with_columns([pl.col(c).fill_null(0) for c in fill_zero])

    # Drop rows where any rate stat is null (don't fill with 0)
    rate_available = [c for c in available if c not in fill_zero]
    for c in rate_available:
        pool = pool.filter(pl.col(c).is_not_null())

    if len(pool) == 0:
        print("❌ No player-seasons remain after filtering nulls", file=sys.stderr)
        sys.exit(1)

    # Z-score each metric
    z_cols = []
    for m in available:
        mean_val = pool[m].mean()
        std_val = pool[m].std()
        z_alias = f"z_{m}"
        if std_val is None or std_val == 0:
            pool = pool.with_columns(pl.lit(0.0).alias(z_alias))
        else:
            pool = pool.with_columns(
                ((pl.col(m) - mean_val) / std_val).alias(z_alias)
            )
        z_cols.append(z_alias)

    # Get target row
    target_mask = (pl.col("player_id") == target_player_id) & (pl.col("season") == target_season)
    target_rows = pool.filter(target_mask)
    if len(target_rows) == 0:
        print("❌ Target player-season not found in comparison pool (volume filter?)", file=sys.stderr)
        sys.exit(1)

    target_row = target_rows.row(0, named=True)

    # Compute distance for every row (excluding target)
    comps = pool.filter(~target_mask)
    if len(comps) == 0:
        print("❌ No comparable player-seasons found in pool", file=sys.stderr)
        sys.exit(1)

    dist_expr = None
    for zc in z_cols:
        sq = (pl.col(zc) - target_row[zc]) ** 2
        dist_expr = sq if dist_expr is None else dist_expr + sq

    comps = comps.with_columns(dist_expr.sqrt().alias("distance"))
    comps = comps.with_columns(
        (1.0 / (1.0 + pl.col("distance"))).alias("similarity")
    )

    return comps.sort("distance")


def query_historical_comps(
    player_name: str,
    season: int,
    seasons_back: int = 5,
    top: int = 10,
    output_format: str = "markdown",
):
    """Find historical statistical player comparisons."""
    # Build season range
    season_range = list(range(season - seasons_back, season + 1))

    # Load data for all seasons
    df = load_cached_or_fetch("player_stats", season_range)

    # Regular season only
    reg = df.filter(pl.col("season_type") == "REG")

    # Look up target player in the target season
    target_season_df = reg.filter(pl.col("season") == season)
    if len(target_season_df) == 0:
        print(f"❌ No data for season {season}", file=sys.stderr)
        sys.exit(1)

    player_meta = _find_player(target_season_df, player_name)
    player_id = player_meta["player_id"]
    player_display = player_meta["player_display_name"]
    position = player_meta["position"]
    team = player_meta["team"] if player_meta["team"] is not None else "N/A"

    # Get config for this position
    if position not in POSITION_CONFIGS:
        print(
            f"❌ Position '{position}' not supported for comparisons. "
            f"Supported: {', '.join(POSITION_CONFIGS.keys())}",
            file=sys.stderr,
        )
        sys.exit(1)

    config = POSITION_CONFIGS[position]

    # Filter pool to same position across all seasons
    pool_df = reg.filter(pl.col("position") == position)

    # Aggregate to player-season level
    pool_agg = _aggregate_pool(pool_df, config)

    # Apply minimum volume threshold
    vol_col = config["min_volume_col"]
    min_vol = config["min_volume"]
    if vol_col in pool_agg.columns:
        pool_agg = pool_agg.filter(pl.col(vol_col) >= min_vol)

    pool_size = len(pool_agg) - 1  # exclude target

    # Z-score and compute distances
    count_and_sum = config["count_cols"] + config["sum_cols"]
    results = _zscore_and_distance(
        pool_agg, player_id, season, config["metrics"], count_and_sum
    )

    # Take top N
    top_comps = results.head(top)

    first_season = min(season_range)
    last_season = max(season_range)

    if output_format == "json":
        _output_json(top_comps, player_display, position, team, season, config)
    else:
        _output_markdown(
            top_comps, player_display, position, team, season,
            pool_size, first_season, last_season, min_vol, config,
        )


def _output_markdown(
    comps: pl.DataFrame,
    player_display: str,
    position: str,
    team: str,
    season: int,
    pool_size: int,
    first_season: int,
    last_season: int,
    min_vol: int,
    config: dict,
):
    """Print markdown-formatted comp table."""
    vol_col = config["min_volume_col"].replace("_", " ")
    print(f"\n### Historical Comps for {player_display} ({season} {position}, {team})\n")
    print(
        f"Comparing against {pool_size} {position} seasons "
        f"({first_season}\u2013{last_season}, min {min_vol} {vol_col})\n"
    )
    print("| Rank | Player | Season | Team | Similarity | Key Stats |")
    print("|-----:|--------|-------:|------|-----------:|-----------|")

    for rank, row in enumerate(comps.iter_rows(named=True), start=1):
        similarity_pct = f"{row['similarity']:.0%}"
        key_stats = config["key_stats"](row)
        player_name = row["player_display_name"]
        comp_team = row["team"] if row["team"] is not None else "N/A"
        comp_season = int(row["season"])
        print(
            f"| {rank} | {player_name} | {comp_season} | {comp_team} "
            f"| {similarity_pct} | {key_stats} |"
        )
    print()


def _output_json(
    comps: pl.DataFrame,
    player_display: str,
    position: str,
    team: str,
    season: int,
    config: dict,
):
    """Print JSON-formatted comp results."""
    output = []
    for rank, row in enumerate(comps.iter_rows(named=True), start=1):
        entry = {
            "rank": rank,
            "player": row["player_display_name"],
            "season": int(row["season"]),
            "team": row["team"],
            "position": position,
            "distance": round(row["distance"], 4),
            "similarity": round(row["similarity"], 4),
        }
        # Include all comparison metrics
        for m in config["metrics"]:
            if m in row and row[m] is not None:
                val = row[m]
                entry[m] = round(val, 3) if isinstance(val, float) else int(val)
        output.append(entry)

    result = {
        "target_player": player_display,
        "target_season": season,
        "target_position": position,
        "target_team": team,
        "comps": output,
    }
    print(json.dumps(result, indent=2))


def main():
    parser = argparse.ArgumentParser(
        description="Find historical statistical player comparisons"
    )
    parser.add_argument("--player", required=True, help="Player name")
    parser.add_argument("--season", type=int, required=True, help="Target season year")
    parser.add_argument(
        "--seasons-back", type=int, default=5,
        help="Number of prior seasons to search (default: 5)",
    )
    parser.add_argument(
        "--top", type=int, default=10,
        help="Number of comps to return (default: 10)",
    )
    parser.add_argument(
        "--format", choices=["markdown", "json"], default="markdown",
        help="Output format",
    )

    args = parser.parse_args()
    query_historical_comps(
        args.player, args.season, args.seasons_back, args.top, args.format
    )


if __name__ == "__main__":
    main()
