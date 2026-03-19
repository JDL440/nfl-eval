#!/usr/bin/env python3
"""
content/data/query_pfr_defense.py — PFR defensive player stats.

Usage:
    python content/data/query_pfr_defense.py --player "Nehemiah Pritchett" --season 2025
    python content/data/query_pfr_defense.py --team SEA --season 2025 --top 15
    python content/data/query_pfr_defense.py --position CB --season 2025 --top 20
    python content/data/query_pfr_defense.py --player "Boye Mafe" --season 2025 --format json
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
    print("❌ Error: polars not installed", file=sys.stderr)
    print("Install with: pip install -r requirements.txt", file=sys.stderr)
    sys.exit(1)


# Position alias mapping for --position mode
POSITION_ALIASES = {
    "DB": ["CB", "S", "FS", "SS", "DB"],
    "EDGE": ["DE", "OLB", "EDGE"],
    "DL": ["DE", "DT", "NT", "DL"],
    "CB": ["CB"],
    "S": ["S", "FS", "SS"],
    "LB": ["LB", "ILB", "OLB", "MLB"],
    "DE": ["DE"],
    "DT": ["DT", "NT"],
}

# Coverage-oriented positions (rank by passer rating allowed)
COVERAGE_POSITIONS = {"CB", "S", "DB", "FS", "SS"}

# Columns summed across games to produce season totals
SUM_COLS = [
    "def_tackles_combined", "def_missed_tackles",
    "def_targets", "def_completions_allowed", "def_yards_allowed",
    "def_air_yards_completed", "def_yards_after_catch",
    "def_times_blitzed", "def_times_hurried", "def_times_hitqb",
    "def_sacks", "def_pressures", "def_ints",
    "def_receiving_td_allowed",
]

# Metric labels for player markdown output (in display order)
METRIC_LABELS = [
    ("def_tackles_combined", "Tackles (Combined)"),
    ("def_missed_tackles", "Missed Tackles"),
    ("def_missed_tackle_pct", "Missed Tackle %"),
    ("def_targets", "Targets"),
    ("def_completions_allowed", "Completions Allowed"),
    ("def_completion_pct", "Completion %"),
    ("def_yards_allowed", "Yards Allowed"),
    ("def_yards_allowed_per_cmp", "Yards/Completion"),
    ("def_yards_allowed_per_tgt", "Yards/Target"),
    ("def_passer_rating_allowed", "Passer Rating Allowed"),
    ("def_adot", "aDOT (Avg Depth of Target)"),
    ("def_air_yards_completed", "Air Yards Completed"),
    ("def_yards_after_catch", "YAC (Yards After Catch)"),
    ("def_times_blitzed", "Blitzes"),
    ("def_times_hurried", "Hurries"),
    ("def_times_hitqb", "QB Hits"),
    ("def_sacks", "Sacks"),
    ("def_pressures", "Pressures"),
    ("def_ints", "Interceptions"),
    ("def_receiving_td_allowed", "Receiving TDs Allowed"),
]

# Columns that are rate/float stats (display with 1 decimal)
RATE_COLS = {
    "def_missed_tackle_pct", "def_completion_pct",
    "def_yards_allowed_per_cmp", "def_yards_allowed_per_tgt",
    "def_passer_rating_allowed", "def_adot", "def_sacks", "def_pressures",
}


def _format_val(val) -> str:
    """Format a value for markdown display."""
    if val is None:
        return "-"
    if isinstance(val, float):
        return f"{val:.1f}"
    return f"{val:,}" if isinstance(val, int) else str(val)


def _build_season_totals(df: pl.DataFrame) -> pl.DataFrame:
    """
    Aggregate per-game PFR defense rows into season totals per player.

    Sums counting stats, then recomputes rate stats from the totals.
    Returns one row per (pfr_player_id, team).
    """
    # Filter to regular season
    if "game_type" in df.columns:
        df = df.filter(pl.col("game_type") == "REG")

    agg_exprs = [
        pl.col("pfr_player_name").first().alias("pfr_player_name"),
        pl.col("team").first().alias("team"),
        pl.len().alias("games"),
    ]
    for col in SUM_COLS:
        if col in df.columns:
            agg_exprs.append(pl.col(col).fill_null(0).sum().alias(col))

    # Weighted-average columns (weight by targets for coverage, by tackles for tackle %)
    if "def_adot" in df.columns and "def_targets" in df.columns:
        agg_exprs.append(
            (pl.col("def_adot").fill_null(0) * pl.col("def_targets").fill_null(0))
            .sum().alias("_adot_numerator")
        )
    if "def_passer_rating_allowed" in df.columns and "def_targets" in df.columns:
        agg_exprs.append(
            (pl.col("def_passer_rating_allowed").fill_null(0) * pl.col("def_targets").fill_null(0))
            .sum().alias("_pr_numerator")
        )

    group_cols = ["pfr_player_id"]
    totals = df.group_by(group_cols).agg(agg_exprs)

    # Recompute rate stats from totals
    derive = []
    if "def_targets" in totals.columns and "def_completions_allowed" in totals.columns:
        derive.append(
            pl.when(pl.col("def_targets") > 0)
            .then((pl.col("def_completions_allowed") / pl.col("def_targets") * 100).round(1))
            .otherwise(None)
            .alias("def_completion_pct")
        )
    if "def_targets" in totals.columns and "def_yards_allowed" in totals.columns:
        derive.append(
            pl.when(pl.col("def_targets") > 0)
            .then((pl.col("def_yards_allowed") / pl.col("def_targets")).round(1))
            .otherwise(None)
            .alias("def_yards_allowed_per_tgt")
        )
    if "def_completions_allowed" in totals.columns and "def_yards_allowed" in totals.columns:
        derive.append(
            pl.when(pl.col("def_completions_allowed") > 0)
            .then((pl.col("def_yards_allowed") / pl.col("def_completions_allowed")).round(1))
            .otherwise(None)
            .alias("def_yards_allowed_per_cmp")
        )
    if "def_tackles_combined" in totals.columns and "def_missed_tackles" in totals.columns:
        derive.append(
            pl.when((pl.col("def_tackles_combined") + pl.col("def_missed_tackles")) > 0)
            .then(
                (pl.col("def_missed_tackles") /
                 (pl.col("def_tackles_combined") + pl.col("def_missed_tackles")) * 100).round(1)
            )
            .otherwise(None)
            .alias("def_missed_tackle_pct")
        )
    if "_adot_numerator" in totals.columns and "def_targets" in totals.columns:
        derive.append(
            pl.when(pl.col("def_targets") > 0)
            .then((pl.col("_adot_numerator") / pl.col("def_targets")).round(1))
            .otherwise(None)
            .alias("def_adot")
        )
    if "_pr_numerator" in totals.columns and "def_targets" in totals.columns:
        derive.append(
            pl.when(pl.col("def_targets") > 0)
            .then((pl.col("_pr_numerator") / pl.col("def_targets")).round(1))
            .otherwise(None)
            .alias("def_passer_rating_allowed")
        )

    if derive:
        totals = totals.with_columns(derive)

    # Drop helper columns
    drop = [c for c in totals.columns if c.startswith("_")]
    if drop:
        totals = totals.drop(drop)

    return totals


def _join_positions(totals: pl.DataFrame, season: int) -> pl.DataFrame:
    """Join roster positions onto aggregated totals using pfr_player_id.

    Uses depth_chart_position (CB, SS, DE, DT, …) when available for
    granular defensive positions; falls back to the broad position column.
    """
    try:
        rosters = load_cached_or_fetch("rosters", [season])
    except SystemExit:
        return totals.with_columns(pl.lit(None).cast(pl.Utf8).alias("position"))

    if "pfr_id" not in rosters.columns:
        return totals.with_columns(pl.lit(None).cast(pl.Utf8).alias("position"))

    # Prefer depth_chart_position for granular CB/S/DE/DT; fall back to position
    pos_col = "depth_chart_position" if "depth_chart_position" in rosters.columns else "position"
    pos_map = (
        rosters.filter(pl.col("pfr_id").is_not_null() & pl.col(pos_col).is_not_null())
        .select(["pfr_id", pos_col])
        .unique(subset=["pfr_id"])
        .rename({"pfr_id": "pfr_player_id", pos_col: "position"})
    )

    return totals.join(pos_map, on="pfr_player_id", how="left")


def _find_player(df: pl.DataFrame, player_name: str) -> pl.DataFrame:
    """
    Find a player by name: exact case-insensitive match, then partial.
    Rejects ambiguous partial matches. Returns filtered DataFrame.
    """
    player_df = df.filter(
        pl.col("pfr_player_name").str.to_lowercase() == player_name.lower()
    )
    if len(player_df) == 0:
        partial_matches = df.filter(
            pl.col("pfr_player_name").str.to_lowercase().str.contains(
                player_name.lower(), literal=True
            )
        )
        if len(partial_matches) == 0:
            print(f"❌ Player not found: {player_name}", file=sys.stderr)
            sys.exit(1)

        select_cols = [c for c in ["pfr_player_id", "pfr_player_name", "position", "team"]
                       if c in partial_matches.columns]
        matched_players = partial_matches.select(select_cols).unique(
            subset=["pfr_player_id"]
        ).sort("pfr_player_name")

        if len(matched_players) > 1:
            print(f"❌ Ambiguous player name: {player_name}", file=sys.stderr)
            print("Matching players:", file=sys.stderr)
            for row in matched_players.iter_rows(named=True):
                pos = row.get("position", "?") or "?"
                team = row.get("team", "?") or "?"
                print(
                    f"  - {row['pfr_player_name']} ({pos}, {team})",
                    file=sys.stderr,
                )
            print("Use a more specific full name.", file=sys.stderr)
            sys.exit(1)

        # Single partial match
        matched_id = matched_players["pfr_player_id"][0]
        player_df = df.filter(pl.col("pfr_player_id") == matched_id)

    if len(player_df) == 0:
        print(f"❌ Player not found: {player_name}", file=sys.stderr)
        sys.exit(1)

    return player_df


def _safe_row_val(row: dict, col: str):
    """Extract value from an aggregated row, handling None."""
    val = row.get(col)
    if val is None:
        return None
    if col in RATE_COLS:
        return round(float(val), 1)
    if isinstance(val, float):
        return round(val, 1) if not val.is_integer() else int(val)
    return int(val) if isinstance(val, (int, float)) else val


def query_player_defense(player_name: str, season: int, output_format: str = "markdown"):
    """Query all PFR defensive stats for a single player."""
    df = load_cached_or_fetch("pfr_defense", [season])

    if len(df) == 0:
        print(f"❌ No PFR defense data for {season}", file=sys.stderr)
        sys.exit(1)

    totals = _build_season_totals(df)
    totals = _join_positions(totals, season)

    player_df = _find_player(totals, player_name)
    row = player_df.row(0, named=True)

    player_display = row.get("pfr_player_name", player_name)
    position = row.get("position") or "?"
    team = row.get("team") or "N/A"
    player_id = row.get("pfr_player_id")

    # --- Calculate position rank by tackles ---
    position_rank = None
    if position != "?" and "def_tackles_combined" in totals.columns and "position" in totals.columns:
        pos_peers = totals.filter(
            (pl.col("position") == position) &
            pl.col("def_tackles_combined").is_not_null()
        ).sort("def_tackles_combined", descending=True).with_row_index("rank", offset=1)

        if player_id is not None:
            rank_row = pos_peers.filter(pl.col("pfr_player_id") == player_id)
            if len(rank_row) > 0:
                position_rank = int(rank_row["rank"][0])

    # --- Coverage rank for DBs (passer rating allowed, lower is better, ≥20 targets) ---
    coverage_rank = None
    if position in COVERAGE_POSITIONS and "def_passer_rating_allowed" in totals.columns:
        tgt_val = row.get("def_targets")
        if tgt_val is not None and tgt_val >= 20:
            cov_peers = totals.filter(
                (pl.col("position") == position) &
                pl.col("def_targets").is_not_null() &
                (pl.col("def_targets") >= 20) &
                pl.col("def_passer_rating_allowed").is_not_null()
            ).sort("def_passer_rating_allowed", descending=False).with_row_index("rank", offset=1)

            if player_id is not None:
                rank_row = cov_peers.filter(pl.col("pfr_player_id") == player_id)
                if len(rank_row) > 0:
                    coverage_rank = int(rank_row["rank"][0])

    # --- Build result dict ---
    result = {
        "player": player_display,
        "position": position,
        "season": season,
        "team": team,
    }
    for col, _ in METRIC_LABELS:
        if col in totals.columns:
            result[col] = _safe_row_val(row, col)
    result["position_rank_tackles"] = position_rank
    result["coverage_rank"] = coverage_rank

    # --- Output ---
    if output_format == "json":
        print(json.dumps(result, indent=2))
    else:
        rank_str = f" (Rank #{position_rank} among {position}s)" if position_rank else ""
        print(f"\n### {player_display} — {season} PFR Defense Stats{rank_str}\n")
        print(f"**Position:** {position} | **Team:** {team}\n")
        print("| Metric | Value |")
        print("|--------|------:|")
        for col, label in METRIC_LABELS:
            if col not in totals.columns:
                continue
            val = result.get(col)
            print(f"| {label} | {_format_val(val)} |")

        if coverage_rank is not None:
            print(f"\n_Coverage rank among {position}s (≥20 targets, by passer rating allowed): **#{coverage_rank}**_")
        print()


def query_team_defense(team: str, season: int, top: int = 20, output_format: str = "markdown"):
    """Query all defensive players on a team, sorted by total tackles."""
    df = load_cached_or_fetch("pfr_defense", [season])

    if len(df) == 0:
        print(f"❌ No PFR defense data for {season}", file=sys.stderr)
        sys.exit(1)

    totals = _build_season_totals(df)
    totals = _join_positions(totals, season)

    team_upper = team.upper()
    team_df = totals.filter(pl.col("team").str.to_uppercase() == team_upper)

    if len(team_df) == 0:
        print(f"❌ No defensive data for team {team_upper} in {season}", file=sys.stderr)
        sys.exit(1)

    sort_col = "def_tackles_combined" if "def_tackles_combined" in team_df.columns else team_df.columns[0]
    team_df = team_df.sort(sort_col, descending=True, nulls_last=True).head(top)

    results = []
    for row in team_df.iter_rows(named=True):
        results.append({
            "player": row.get("pfr_player_name", "?"),
            "position": row.get("position") or "?",
            "tackles": _safe_row_val(row, "def_tackles_combined"),
            "missed_tackles": _safe_row_val(row, "def_missed_tackles"),
            "sacks": _safe_row_val(row, "def_sacks"),
            "pressures": _safe_row_val(row, "def_pressures"),
            "targets": _safe_row_val(row, "def_targets"),
            "completion_pct": _safe_row_val(row, "def_completion_pct"),
            "passer_rating_allowed": _safe_row_val(row, "def_passer_rating_allowed"),
            "ints": _safe_row_val(row, "def_ints"),
        })

    if output_format == "json":
        print(json.dumps(results, indent=2))
    else:
        print(f"\n### {team_upper} Defensive Stats — {season} (Top {len(results)})\n")
        print("| Player | Pos | Tkl | MTkl | Sack | Pres | Tgt | Cmp% | PR Allowed | INT |")
        print("|--------|-----|----:|-----:|-----:|-----:|----:|-----:|-----------:|----:|")
        for r in results:
            print(
                f"| {r['player']} | {r['position']}"
                f" | {_format_val(r['tackles'])} | {_format_val(r['missed_tackles'])}"
                f" | {_format_val(r['sacks'])} | {_format_val(r['pressures'])}"
                f" | {_format_val(r['targets'])} | {_format_val(r['completion_pct'])}"
                f" | {_format_val(r['passer_rating_allowed'])} | {_format_val(r['ints'])} |"
            )
        print()


def query_position_defense(position: str, season: int, top: int = 20, output_format: str = "markdown"):
    """League-wide ranking by defensive position."""
    df = load_cached_or_fetch("pfr_defense", [season])

    if len(df) == 0:
        print(f"❌ No PFR defense data for {season}", file=sys.stderr)
        sys.exit(1)

    totals = _build_season_totals(df)
    totals = _join_positions(totals, season)

    pos_upper = position.upper()
    if pos_upper not in POSITION_ALIASES:
        print(f"❌ Unsupported position: {pos_upper}", file=sys.stderr)
        print(f"Available positions: {', '.join(POSITION_ALIASES.keys())}", file=sys.stderr)
        sys.exit(1)

    target_positions = POSITION_ALIASES[pos_upper]

    if "position" not in totals.columns:
        print("❌ Position data unavailable (roster lookup failed)", file=sys.stderr)
        sys.exit(1)

    pos_df = totals.filter(
        pl.col("position").is_not_null() & pl.col("position").is_in(target_positions)
    )

    if len(pos_df) == 0:
        print(f"❌ No players found at position {pos_upper} in {season}", file=sys.stderr)
        sys.exit(1)

    # Determine sort strategy based on position group
    is_coverage = pos_upper in COVERAGE_POSITIONS or pos_upper == "DB"
    if is_coverage:
        if "def_targets" in pos_df.columns and "def_passer_rating_allowed" in pos_df.columns:
            pos_df = pos_df.filter(
                pl.col("def_targets").is_not_null() &
                (pl.col("def_targets") >= 20) &
                pl.col("def_passer_rating_allowed").is_not_null()
            )
            sort_col = "def_passer_rating_allowed"
            sort_desc = False  # lower is better
        else:
            sort_col = "def_tackles_combined"
            sort_desc = True
    else:
        sort_col = "def_tackles_combined" if "def_tackles_combined" in pos_df.columns else pos_df.columns[0]
        sort_desc = True
        if "def_tackles_combined" in pos_df.columns:
            pos_df = pos_df.filter(
                pl.col("def_tackles_combined").is_not_null() &
                (pl.col("def_tackles_combined") >= 50)
            )

    if len(pos_df) == 0:
        print(f"❌ No players meet minimum thresholds for {pos_upper} in {season}", file=sys.stderr)
        sys.exit(1)

    ranked = pos_df.sort(sort_col, descending=sort_desc, nulls_last=True).head(top)

    results = []
    for idx, row in enumerate(ranked.iter_rows(named=True), start=1):
        results.append({
            "rank": idx,
            "player": row.get("pfr_player_name", "?"),
            "team": row.get("team", "?"),
            "position": row.get("position") or "?",
            "tackles": _safe_row_val(row, "def_tackles_combined"),
            "missed_tackles": _safe_row_val(row, "def_missed_tackles"),
            "sacks": _safe_row_val(row, "def_sacks"),
            "pressures": _safe_row_val(row, "def_pressures"),
            "targets": _safe_row_val(row, "def_targets"),
            "completion_pct": _safe_row_val(row, "def_completion_pct"),
            "passer_rating_allowed": _safe_row_val(row, "def_passer_rating_allowed"),
            "ints": _safe_row_val(row, "def_ints"),
        })

    if output_format == "json":
        print(json.dumps(results, indent=2))
    else:
        sort_label = "Passer Rating Allowed" if is_coverage else "Tackles"
        threshold = "≥20 targets" if is_coverage else "≥50 tackles"
        print(f"\n### Top {len(results)} {pos_upper}s by {sort_label} — {season} ({threshold})\n")
        print("| Rank | Player | Team | Pos | Tkl | MTkl | Sack | Pres | Tgt | Cmp% | PR Allowed | INT |")
        print("|-----:|--------|------|-----|----:|-----:|-----:|-----:|----:|-----:|-----------:|----:|")
        for r in results:
            print(
                f"| {r['rank']} | {r['player']} | {r['team']} | {r['position']}"
                f" | {_format_val(r['tackles'])} | {_format_val(r['missed_tackles'])}"
                f" | {_format_val(r['sacks'])} | {_format_val(r['pressures'])}"
                f" | {_format_val(r['targets'])} | {_format_val(r['completion_pct'])}"
                f" | {_format_val(r['passer_rating_allowed'])} | {_format_val(r['ints'])} |"
            )
        print()


def main():
    parser = argparse.ArgumentParser(description="Query PFR defensive player stats")
    parser.add_argument("--player", help="Player name")
    parser.add_argument("--team", help="Team abbreviation (e.g., SEA)")
    parser.add_argument("--position", help="Position for league-wide comparison (CB, S, LB, DE, DT)")
    parser.add_argument("--season", type=int, required=True, help="Season year")
    parser.add_argument("--top", type=int, default=20, help="Number of results (default: 20)")
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown", help="Output format")

    args = parser.parse_args()

    if args.player:
        query_player_defense(args.player, args.season, args.format)
    elif args.team:
        query_team_defense(args.team, args.season, args.top, args.format)
    elif args.position:
        query_position_defense(args.position, args.season, args.top, args.format)
    else:
        print("❌ Must specify --player, --team, or --position", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
