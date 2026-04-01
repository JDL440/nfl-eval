#!/usr/bin/env python3
"""
content/data/mlb/query_team_batting.py — Team batting efficiency.

Usage:
    python content/data/mlb/query_team_batting.py --team NYY --season 2024
    python content/data/mlb/query_team_batting.py --team LAD --season 2024 --format json
"""

import argparse
import json
import sys
from pathlib import Path

# Import shared auto-fetch helper
sys.path.insert(0, str(Path(__file__).parent))
from _shared import load_cached_or_fetch, resolve_team_abbr

try:
    import pandas as pd
except ImportError:
    print("❌ Error: pandas not installed")
    print("Install with: pip install -r requirements.txt")
    sys.exit(1)


def _safe_round(value, decimals=3):
    """Round a value if it's a number, return None otherwise."""
    if pd.isna(value):
        return None
    try:
        return round(float(value), decimals)
    except (TypeError, ValueError):
        return None


def _safe_int(value):
    """Convert to int if it's a number, return 0 otherwise."""
    if pd.isna(value):
        return 0
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def query_team_batting(team_abbr: str, season: int, output_format: str = "markdown"):
    """Query team batting stats."""
    team_abbr = resolve_team_abbr(team_abbr)
    df = load_cached_or_fetch("team_batting", [season])

    # Filter to the requested season
    if "Season" in df.columns:
        season_df = df[df["Season"] == season].copy()
    else:
        season_df = df.copy()

    # pybaseball team_batting uses a "Team" column; match case-insensitively
    team_col = None
    for candidate in ("Team", "teamIDfg", "Tm"):
        if candidate in season_df.columns:
            team_col = candidate
            break

    if team_col is None:
        print("❌ Could not find team column in team_batting data", file=sys.stderr)
        sys.exit(1)

    team_df = season_df[
        season_df[team_col].astype(str).str.upper() == team_abbr.upper()
    ]

    if team_df.empty:
        print(f"❌ Team not found: {team_abbr}", file=sys.stderr)
        print("Use 2-3 letter team abbreviations (e.g., NYY, LAD, BOS)", file=sys.stderr)
        # Show available teams to help
        available = sorted(season_df[team_col].dropna().unique())
        if available:
            print(f"Available teams: {', '.join(str(t) for t in available)}", file=sys.stderr)
        sys.exit(1)

    t = team_df.iloc[0]

    # Compute league ranks for context
    def _rank_col(col_name, ascending=True):
        """Rank this team among all teams for a given stat (1 = best)."""
        if col_name not in season_df.columns:
            return None
        ranked = season_df.sort_values(col_name, ascending=ascending).reset_index(drop=True)
        match = ranked[ranked[team_col].astype(str).str.upper() == team_abbr.upper()]
        if match.empty:
            return None
        return match.index[0] + 1

    result = {
        "team": team_abbr.upper(),
        "season": season,
        "AVG": _safe_round(t.get("AVG")),
        "OBP": _safe_round(t.get("OBP")),
        "SLG": _safe_round(t.get("SLG")),
        "OPS": _safe_round(t.get("OPS")),
        "HR": _safe_int(t.get("HR")),
        "R": _safe_int(t.get("R")),
        "wRC+": _safe_int(t.get("wRC+")),
        "BB%": _safe_round(t.get("BB%"), 1),
        "K%": _safe_round(t.get("K%"), 1),
        "ISO": _safe_round(t.get("ISO")),
        "BABIP": _safe_round(t.get("BABIP")),
        "wOBA": _safe_round(t.get("wOBA")),
        "WAR": _safe_round(t.get("WAR"), 1),
    }

    # Add league ranks for key stats (lower rank = better; 1 = first)
    ranks = {}
    rank_defs = {
        "AVG": False, "OBP": False, "SLG": False, "OPS": False,
        "HR": False, "R": False, "wRC+": False,
    }
    for stat, asc in rank_defs.items():
        r = _rank_col(stat, ascending=asc)
        if r is not None:
            ranks[f"{stat}_rank"] = r

    if output_format == "json":
        result["ranks"] = ranks
        print(json.dumps(result, indent=2))
    else:
        print(f"\n### {result['team']} — {season} Team Batting\n")

        num_teams = len(season_df)

        print("#### Batting Line\n")
        print("| Metric | Value | Rank |")
        print("|--------|------:|-----:|")
        for key, value in result.items():
            if key in ("team", "season"):
                continue
            rank_val = ranks.get(f"{key}_rank")
            rank_str = f"#{rank_val}/{num_teams}" if rank_val else ""
            if value is None:
                print(f"| {key} | N/A | {rank_str} |")
            elif isinstance(value, float):
                print(f"| {key} | {value} | {rank_str} |")
            else:
                print(f"| {key} | {value:,} | {rank_str} |")
        print()


def main():
    parser = argparse.ArgumentParser(description="Query MLB team batting stats")
    parser.add_argument(
        "--team", required=True, help="Team abbreviation (e.g., NYY, LAD, BOS)"
    )
    parser.add_argument(
        "--season", type=int, required=True, help="Season year (e.g., 2024)"
    )
    parser.add_argument(
        "--format",
        choices=["markdown", "json"],
        default="markdown",
        help="Output format",
    )

    args = parser.parse_args()
    query_team_batting(args.team, args.season, args.format)


if __name__ == "__main__":
    main()
