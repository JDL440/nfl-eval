#!/usr/bin/env python3
"""
content/data/query_fantasy_stats.py — Fantasy football scoring and opportunity analysis.

Provides fantasy-specific aggregations: weekly consistency, opportunity share,
scoring breakdowns, and positional rankings across scoring formats.

Usage:
    python content/data/query_fantasy_stats.py --player "Amon-Ra St. Brown" --season 2025
    python content/data/query_fantasy_stats.py --position WR --season 2025 --top 20
    python content/data/query_fantasy_stats.py --player "Saquon Barkley" --season 2025 --format json
    python content/data/query_fantasy_stats.py --position RB --season 2025 --scoring ppr --top 10
"""

import argparse
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _shared import load_cached_or_fetch

try:
    import polars as pl
except ImportError:
    print("❌ Error: polars not installed", file=sys.stderr)
    print("Install with: pip install -r requirements.txt", file=sys.stderr)
    sys.exit(1)


SCORING_COL = {
    "standard": "fantasy_points",
    "ppr": "fantasy_points_ppr",
    "half_ppr": "fantasy_points_half_ppr",
}

SKILL_POSITIONS = ["QB", "RB", "WR", "TE"]


def _safe_round(val, ndigits=1):
    """Round a value, returning None for null/NaN."""
    if val is None:
        return None
    try:
        if math.isnan(val) or math.isinf(val):
            return None
    except TypeError:
        pass
    return round(val, ndigits)


def _weekly_stats(player_df: pl.DataFrame, scoring: str) -> dict:
    """Compute weekly consistency metrics for a player."""
    col = SCORING_COL[scoring]
    if col not in player_df.columns:
        return {}

    weekly = player_df.filter(pl.col(col).is_not_null()).sort("week")
    if len(weekly) == 0:
        return {}

    pts = weekly[col].to_list()
    games = len(pts)
    total = sum(pts)
    avg = total / games if games else 0
    std_dev = (sum((p - avg) ** 2 for p in pts) / games) ** 0.5 if games > 1 else 0

    # Floor games (e.g., PPR: ≥10 pts is "startable floor")
    floor_threshold = 10.0 if scoring == "ppr" else 8.0
    ceiling_threshold = 20.0 if scoring == "ppr" else 16.0
    floor_games = sum(1 for p in pts if p >= floor_threshold)
    ceiling_games = sum(1 for p in pts if p >= ceiling_threshold)
    bust_games = sum(1 for p in pts if p < (floor_threshold / 2))

    return {
        "games": games,
        "total_points": _safe_round(total, 1),
        "ppg": _safe_round(avg, 1),
        "std_dev": _safe_round(std_dev, 2),
        "floor_games": floor_games,
        "ceiling_games": ceiling_games,
        "bust_games": bust_games,
        "floor_rate": _safe_round(floor_games / games * 100, 1) if games else None,
        "ceiling_rate": _safe_round(ceiling_games / games * 100, 1) if games else None,
        "best_week": _safe_round(max(pts), 1),
        "worst_week": _safe_round(min(pts), 1),
    }


def _opportunity_metrics(player_df: pl.DataFrame, position: str) -> dict:
    """Compute opportunity share and usage metrics."""
    metrics = {}

    # Targets / receptions (WR, TE, RB)
    if "targets" in player_df.columns:
        metrics["total_targets"] = int(player_df["targets"].sum())
    if "receptions" in player_df.columns:
        metrics["total_receptions"] = int(player_df["receptions"].sum())
    if "target_share" in player_df.columns:
        metrics["avg_target_share"] = _safe_round(player_df["target_share"].mean(), 3)
    if "air_yards_share" in player_df.columns:
        metrics["avg_air_yards_share"] = _safe_round(player_df["air_yards_share"].mean(), 3)

    # Rush attempts (RB, QB)
    if position in ["RB", "QB"] and "carries" in player_df.columns:
        metrics["total_carries"] = int(player_df["carries"].sum())

    # Snap-weighted if available
    if "rushing_yards" in player_df.columns:
        metrics["total_rushing_yards"] = int(player_df["rushing_yards"].sum())
    if "receiving_yards" in player_df.columns:
        metrics["total_receiving_yards"] = int(player_df["receiving_yards"].sum())

    return metrics


def query_player_fantasy(player_name: str, season: int, scoring: str = "ppr", output_format: str = "markdown"):
    """Query fantasy stats for an individual player."""
    df = load_cached_or_fetch("player_stats", [season])
    season_df = df.filter(pl.col("season_type") == "REG")

    # Player lookup — exact then partial
    player_df = season_df.filter(
        pl.col("player_display_name").str.to_lowercase() == player_name.lower()
    )
    if len(player_df) == 0:
        partial = season_df.filter(
            pl.col("player_display_name").str.to_lowercase().str.contains(
                player_name.lower().replace("(", r"\(").replace(")", r"\)"), literal=False
            )
        )
        matched = partial.select("player_id", "player_display_name").unique()
        if len(matched) == 0:
            print(f"❌ Player not found: {player_name}", file=sys.stderr)
            sys.exit(1)
        if len(matched) > 1:
            names = matched["player_display_name"].to_list()
            print(f"❌ Ambiguous: {names}. Use a more specific full name.", file=sys.stderr)
            sys.exit(1)
        player_id = matched["player_id"][0]
        player_df = season_df.filter(pl.col("player_id") == player_id)

    meta = player_df.select(
        pl.col("player_display_name").first().alias("name"),
        pl.col("position").first().alias("position"),
        pl.col("team").first().alias("team"),
    ).row(0, named=True)

    weekly = _weekly_stats(player_df, scoring)
    opportunity = _opportunity_metrics(player_df, meta["position"])

    # Positional rank
    col = SCORING_COL[scoring]
    pos_rank = None
    if col in season_df.columns:
        pos_all = season_df.filter(pl.col("position") == meta["position"])
        pos_totals = pos_all.group_by("player_id").agg([
            pl.col("player_display_name").first().alias("name"),
            pl.col(col).sum().alias("total"),
        ]).filter(pl.col("total").is_not_null() & (pl.col("total") > 0)).sort("total", descending=True).with_row_index("rank", offset=1)

        player_row = pos_totals.filter(pl.col("name").str.to_lowercase() == meta["name"].lower())
        if len(player_row) > 0:
            pos_rank = int(player_row["rank"][0])

    result = {
        "player": meta["name"],
        "position": meta["position"],
        "team": meta["team"] or "N/A",
        "season": season,
        "scoring_format": scoring,
        "position_rank": pos_rank,
        **weekly,
        **opportunity,
    }

    if output_format == "json":
        print(json.dumps(result, indent=2))
    else:
        rank_str = f" (#{pos_rank} {meta['position']})" if pos_rank else ""
        print(f"\n### 🏈 {meta['name']} — {season} Fantasy Profile{rank_str}\n")
        print(f"**Position:** {meta['position']} | **Team:** {meta['team'] or 'N/A'} | **Scoring:** {scoring.upper()}\n")

        if weekly:
            print("#### Scoring Summary\n")
            print("| Metric | Value |")
            print("|--------|------:|")
            print(f"| Games | {weekly['games']} |")
            print(f"| Total Points | {weekly['total_points']} |")
            print(f"| PPG | {weekly['ppg']} |")
            print(f"| Std Dev | {weekly['std_dev']} |")
            print(f"| Best Week | {weekly['best_week']} |")
            print(f"| Worst Week | {weekly['worst_week']} |")
            print(f"| Floor Games (≥threshold) | {weekly['floor_games']} ({weekly['floor_rate']}%) |")
            print(f"| Ceiling Games (≥20+) | {weekly['ceiling_games']} ({weekly['ceiling_rate']}%) |")
            print(f"| Bust Games | {weekly['bust_games']} |")
            print()

        if opportunity:
            print("#### Opportunity Metrics\n")
            print("| Metric | Value |")
            print("|--------|------:|")
            for k, v in opportunity.items():
                label = k.replace("_", " ").replace("avg ", "Avg ").title()
                if v is None:
                    print(f"| {label} | N/A |")
                elif isinstance(v, float):
                    print(f"| {label} | {v} |")
                else:
                    print(f"| {label} | {v:,} |")
            print()


def query_position_fantasy(position: str, season: int, scoring: str = "ppr", top_n: int = 20, output_format: str = "markdown"):
    """Fantasy positional rankings with consistency metrics."""
    position = position.upper()
    if position not in SKILL_POSITIONS:
        print(f"❌ Unsupported position: {position}. Use: {', '.join(SKILL_POSITIONS)}", file=sys.stderr)
        sys.exit(1)

    df = load_cached_or_fetch("player_stats", [season])
    season_df = df.filter(
        (pl.col("position") == position) &
        (pl.col("season_type") == "REG")
    )

    col = SCORING_COL[scoring]
    if col not in season_df.columns:
        print(f"❌ Scoring column '{col}' not found in dataset", file=sys.stderr)
        sys.exit(1)

    # Per-player weekly data for consistency metrics
    player_ids = season_df.select("player_id").unique()["player_id"].to_list()

    results = []
    for pid in player_ids:
        p_df = season_df.filter(pl.col("player_id") == pid)
        if len(p_df) == 0:
            continue

        name = p_df["player_display_name"][0]
        team = p_df["team"][0] or "N/A"
        weekly = _weekly_stats(p_df, scoring)

        if not weekly or weekly.get("total_points", 0) <= 0:
            continue

        results.append({
            "player": name,
            "team": team,
            "games": weekly["games"],
            "total_points": weekly["total_points"],
            "ppg": weekly["ppg"],
            "std_dev": weekly["std_dev"],
            "floor_rate": weekly["floor_rate"],
            "ceiling_rate": weekly["ceiling_rate"],
            "best_week": weekly["best_week"],
            "worst_week": weekly["worst_week"],
        })

    results.sort(key=lambda r: r["total_points"] or 0, reverse=True)
    results = results[:top_n]

    # Add rank
    for i, r in enumerate(results, 1):
        r["rank"] = i

    if output_format == "json":
        print(json.dumps(results, indent=2))
    else:
        print(f"\n### 🏈 {position} Fantasy Rankings — {season} ({scoring.upper()})\n")
        print(f"| Rank | Player | Team | GP | Total | PPG | StdDev | Floor% | Ceil% | Best | Worst |")
        print(f"|-----:|--------|------|---:|------:|----:|-------:|-------:|------:|-----:|------:|")
        for r in results:
            print(f"| {r['rank']} | {r['player']} | {r['team']} | {r['games']} | {r['total_points']} | {r['ppg']} | {r['std_dev']} | {r['floor_rate']}% | {r['ceiling_rate']}% | {r['best_week']} | {r['worst_week']} |")
        print()


def main():
    parser = argparse.ArgumentParser(description="Fantasy football scoring and opportunity analysis")
    parser.add_argument("--player", help="Player name (exact or partial match)")
    parser.add_argument("--position", help="Position for rankings (QB, RB, WR, TE)")
    parser.add_argument("--season", type=int, required=True, help="Season year (e.g., 2025)")
    parser.add_argument("--scoring", choices=["standard", "ppr", "half_ppr"], default="ppr", help="Scoring format (default: ppr)")
    parser.add_argument("--top", type=int, default=20, help="Number of players for positional rankings")
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown", help="Output format")

    args = parser.parse_args()

    if not args.player and not args.position:
        parser.error("Provide --player for individual analysis or --position for rankings")

    if args.player:
        query_player_fantasy(args.player, args.season, args.scoring, args.format)
    else:
        query_position_fantasy(args.position, args.season, args.scoring, args.top, args.format)


if __name__ == "__main__":
    main()
