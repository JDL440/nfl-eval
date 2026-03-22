#!/usr/bin/env python3
"""
content/data/query_rosters.py — Query official NFL team rosters from nflverse.

Uses weekly roster snapshots (not snap counts) for definitive player-team
assignments including backups, IR players, practice squad, and recent transactions.

Usage:
    python content/data/query_rosters.py --team SEA --season 2025
    python content/data/query_rosters.py --team SEA --season 2025 --status ACT
    python content/data/query_rosters.py --player "Geno Smith" --season 2025
    python content/data/query_rosters.py --team SEA --season 2025 --format json
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

STATUS_LABELS = {
    "ACT": "Active",
    "RES": "Reserve/IR",
    "INA": "Inactive",
    "DEV": "Practice Squad",
}


def query_team_roster(team: str, season: int, status_filter: str | None, output_format: str):
    """Query official roster for a team at the latest available week."""
    df = load_cached_or_fetch("rosters", [season])

    team_df = df.filter(
        (pl.col("team") == team.upper()) &
        (pl.col("season") == season)
    )

    if len(team_df) == 0:
        print(f"No roster data for {team.upper()} in {season}", file=sys.stderr)
        sys.exit(1)

    # Use the latest week available
    latest_week = team_df["week"].max()
    roster = team_df.filter(pl.col("week") == latest_week)

    if status_filter:
        roster = roster.filter(pl.col("status") == status_filter.upper())

    # Sort by position group then name
    pos_order = ["QB", "RB", "FB", "WR", "TE", "T", "G", "C", "OL",
                 "DL", "DE", "DT", "NT", "LB", "OLB", "ILB", "MLB",
                 "CB", "DB", "S", "FS", "SS", "K", "P", "LS"]

    roster = roster.sort(["position", "full_name"])

    cols = ["full_name", "position", "depth_chart_position", "status",
            "jersey_number", "years_exp", "college"]
    available_cols = [c for c in cols if c in roster.columns]
    result = roster.select(available_cols)

    if output_format == "json":
        rows = result.to_dicts()
        for row in rows:
            row["status_label"] = STATUS_LABELS.get(row.get("status", ""), row.get("status", ""))
            row["team"] = team.upper()
            row["season"] = season
            row["roster_week"] = latest_week
        print(json.dumps(rows, indent=2, default=str))
    else:
        print(f"\n{team.upper()} Roster — {season} Season (Week {latest_week})")
        print(f"{'='*60}")
        current_pos = None
        for row in result.iter_rows(named=True):
            pos = row.get("position", "?")
            if pos != current_pos:
                current_pos = pos
                print(f"\n  {pos}")
                print(f"  {'-'*40}")
            status = row.get("status", "?")
            status_label = STATUS_LABELS.get(status, status)
            depth = row.get("depth_chart_position", "")
            jersey = row.get("jersey_number", "")
            name = row.get("full_name", "Unknown")
            exp = row.get("years_exp", "")
            exp_str = f" ({exp}yr)" if exp else ""
            print(f"    #{jersey:<3} {name:<25} {depth:<6} [{status_label}]{exp_str}")

        print(f"\n  Total: {len(result)} players")
        status_counts = roster.group_by("status").len().sort("len", descending=True)
        parts = []
        for row in status_counts.iter_rows(named=True):
            label = STATUS_LABELS.get(row["status"], row["status"])
            parts.append(f"{label}: {row['len']}")
        print(f"  ({', '.join(parts)})")


def query_player_roster(player: str, season: int, output_format: str):
    """Find which team(s) a player is on across the season."""
    df = load_cached_or_fetch("rosters", [season])

    # Case-insensitive partial match
    matches = df.filter(
        (pl.col("season") == season) &
        (pl.col("full_name").str.to_lowercase().str.contains(player.lower()))
    )

    if len(matches) == 0:
        if output_format == "json":
            print(json.dumps({"player": player, "season": season, "found": False, "teams": []}))
        else:
            print(f"No roster entries for '{player}' in {season}")
        return

    # Get latest entry per team
    latest = matches.sort("week", descending=True).group_by(["full_name", "team"]).first()
    latest = latest.sort("week", descending=True)

    cols = ["full_name", "team", "position", "depth_chart_position", "status", "jersey_number", "week"]
    available_cols = [c for c in cols if c in latest.columns]
    result = latest.select(available_cols)

    if output_format == "json":
        rows = result.to_dicts()
        for row in rows:
            row["status_label"] = STATUS_LABELS.get(row.get("status", ""), row.get("status", ""))
            row["season"] = season
        print(json.dumps(rows, indent=2, default=str))
    else:
        print(f"\nRoster history for '{player}' — {season} Season")
        print(f"{'='*60}")
        for row in result.iter_rows(named=True):
            status = STATUS_LABELS.get(row.get("status", ""), row.get("status", ""))
            print(f"  {row['full_name']:<25} {row['team']:<5} {row.get('position','?'):<4} "
                  f"[{status}] (as of week {row.get('week', '?')})")


def main():
    parser = argparse.ArgumentParser(description="Query nflverse official rosters")
    parser.add_argument("--team", type=str, help="Team abbreviation (e.g., SEA)")
    parser.add_argument("--player", type=str, help="Player name (partial match)")
    parser.add_argument("--season", type=int, required=True, help="Season year")
    parser.add_argument("--status", type=str, help="Filter by status: ACT, RES, INA, DEV")
    parser.add_argument("--format", type=str, default="text", choices=["text", "json"],
                        help="Output format")
    args = parser.parse_args()

    if not args.team and not args.player:
        parser.error("Either --team or --player is required")

    if args.player:
        query_player_roster(args.player, args.season, args.format)
    else:
        query_team_roster(args.team, args.season, args.status, args.format)


if __name__ == "__main__":
    main()
