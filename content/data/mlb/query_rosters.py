#!/usr/bin/env python3
"""
content/data/mlb/query_rosters.py — Build MLB team rosters from Statcast data.

Uses batting_stats and pitching_stats to construct an active-player roster
showing position players and pitchers with key stats.

Usage:
    python content/data/mlb/query_rosters.py --team NYY --season 2024
    python content/data/mlb/query_rosters.py --team LAD --season 2024 --format json
    python content/data/mlb/query_rosters.py --player "Aaron Judge" --season 2024
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _shared import load_cached_or_fetch, resolve_team_abbr

try:
    import pandas as pd
except ImportError:
    print("❌ Error: pandas not installed", file=sys.stderr)
    print("Install with: pip install -r requirements.txt", file=sys.stderr)
    sys.exit(1)


def _safe_round(value, decimals=3):
    if pd.isna(value):
        return None
    try:
        return round(float(value), decimals)
    except (TypeError, ValueError):
        return None


def _safe_int(value):
    if pd.isna(value):
        return 0
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _find_team_col(df: pd.DataFrame) -> str | None:
    for candidate in ("Team", "teamIDfg", "Tm"):
        if candidate in df.columns:
            return candidate
    return None


def query_team_roster(team: str, season: int, output_format: str):
    """Build a roster for a team by combining batting and pitching stats."""
    team = resolve_team_abbr(team)

    batting = load_cached_or_fetch("batting_stats", [season])
    pitching = load_cached_or_fetch("pitching_stats", [season])

    # Filter to season
    if "Season" in batting.columns:
        batting = batting[batting["Season"] == season].copy()
    if "Season" in pitching.columns:
        pitching = pitching[pitching["Season"] == season].copy()

    # Find team column
    bat_team_col = _find_team_col(batting)
    pit_team_col = _find_team_col(pitching)

    if not bat_team_col and not pit_team_col:
        print("❌ Could not find team column in stats data", file=sys.stderr)
        sys.exit(1)

    # Filter to team
    batters = pd.DataFrame()
    pitchers = pd.DataFrame()

    if bat_team_col:
        batters = batting[batting[bat_team_col].astype(str).str.upper() == team.upper()].copy()
    if pit_team_col:
        pitchers = pitching[pitching[pit_team_col].astype(str).str.upper() == team.upper()].copy()

    if batters.empty and pitchers.empty:
        print(f"❌ No roster data for {team.upper()} in {season}", file=sys.stderr)
        # Show available teams
        if bat_team_col:
            available = sorted(batting[bat_team_col].dropna().unique())
            if available:
                print(f"Available teams: {', '.join(str(t) for t in available)}", file=sys.stderr)
        sys.exit(1)

    roster = []

    # Position players from batting stats
    for _, row in batters.iterrows():
        name = row.get("Name", "Unknown")
        position = None
        for pos_col in ("Pos", "Position"):
            if pos_col in row.index and pd.notna(row[pos_col]):
                position = str(row[pos_col])
                break
        roster.append({
            "player": name,
            "position": position or "POS",
            "type": "batter",
            "key_stat_label": "AVG",
            "key_stat": _safe_round(row.get("AVG")),
            "WAR": _safe_round(row.get("WAR"), 1),
            "PA": _safe_int(row.get("PA")),
        })

    # Track batter names to avoid duplicating two-way players
    batter_names = {r["player"].lower() for r in roster}

    # Pitchers from pitching stats
    for _, row in pitchers.iterrows():
        name = row.get("Name", "Unknown")
        if name.lower() in batter_names:
            continue  # skip two-way duplicates
        gs = _safe_int(row.get("GS"))
        g = _safe_int(row.get("G"))
        role = "SP" if gs > 0 and gs >= g * 0.5 else "RP"
        roster.append({
            "player": name,
            "position": role,
            "type": "pitcher",
            "key_stat_label": "ERA",
            "key_stat": _safe_round(row.get("ERA"), 2),
            "WAR": _safe_round(row.get("WAR"), 1),
            "IP": _safe_round(row.get("IP"), 1),
        })

    # Sort: batters by WAR desc, then pitchers by WAR desc
    batters_list = sorted(
        [r for r in roster if r["type"] == "batter"],
        key=lambda x: x.get("WAR") or 0, reverse=True,
    )
    pitchers_list = sorted(
        [r for r in roster if r["type"] == "pitcher"],
        key=lambda x: x.get("WAR") or 0, reverse=True,
    )
    roster = batters_list + pitchers_list

    if output_format == "json":
        output = {
            "team": team.upper(),
            "season": season,
            "total_players": len(roster),
            "batters": len(batters_list),
            "pitchers": len(pitchers_list),
            "roster": roster,
        }
        print(json.dumps(output, indent=2, default=str))
    else:
        print(f"\n## {team.upper()} Roster — {season} Season")
        print(f"{'=' * 60}")

        print(f"\n### Position Players ({len(batters_list)})\n")
        print(f"  {'Name':<25} {'Pos':<6} {'AVG':<8} {'WAR':<6} {'PA':<6}")
        print(f"  {'-'*25} {'-'*5} {'-'*7} {'-'*5} {'-'*5}")
        for r in batters_list:
            avg = f"{r['key_stat']:.3f}" if r["key_stat"] is not None else "N/A"
            war = f"{r['WAR']:.1f}" if r["WAR"] is not None else "N/A"
            pa = str(r.get("PA", ""))
            print(f"  {r['player']:<25} {r['position']:<6} {avg:<8} {war:<6} {pa:<6}")

        print(f"\n### Pitchers ({len(pitchers_list)})\n")
        print(f"  {'Name':<25} {'Role':<6} {'ERA':<8} {'WAR':<6} {'IP':<6}")
        print(f"  {'-'*25} {'-'*5} {'-'*7} {'-'*5} {'-'*5}")
        for r in pitchers_list:
            era = f"{r['key_stat']:.2f}" if r["key_stat"] is not None else "N/A"
            war = f"{r['WAR']:.1f}" if r["WAR"] is not None else "N/A"
            ip = f"{r.get('IP', 0):.1f}" if r.get("IP") else "N/A"
            print(f"  {r['player']:<25} {r['position']:<6} {era:<8} {war:<6} {ip:<6}")

        print(f"\n  Total: {len(roster)} players ({len(batters_list)} batters, {len(pitchers_list)} pitchers)")


def query_player_roster(player: str, season: int, output_format: str):
    """Find which team(s) a player is on across batting/pitching stats."""
    batting = load_cached_or_fetch("batting_stats", [season])
    pitching = load_cached_or_fetch("pitching_stats", [season])

    if "Season" in batting.columns:
        batting = batting[batting["Season"] == season].copy()
    if "Season" in pitching.columns:
        pitching = pitching[pitching["Season"] == season].copy()

    results = []

    # Search batting stats
    if "Name" in batting.columns:
        mask = batting["Name"].str.lower().str.contains(player.lower(), na=False)
        for _, row in batting[mask].iterrows():
            bat_team_col = _find_team_col(batting)
            team_val = row.get(bat_team_col, "N/A") if bat_team_col else "N/A"
            position = None
            for pos_col in ("Pos", "Position"):
                if pos_col in row.index and pd.notna(row[pos_col]):
                    position = str(row[pos_col])
                    break
            results.append({
                "player": row["Name"],
                "team": str(team_val) if pd.notna(team_val) else "N/A",
                "type": "batter",
                "position": position or "POS",
                "AVG": _safe_round(row.get("AVG")),
                "WAR": _safe_round(row.get("WAR"), 1),
                "season": season,
            })

    # Search pitching stats
    if "Name" in pitching.columns:
        mask = pitching["Name"].str.lower().str.contains(player.lower(), na=False)
        for _, row in pitching[mask].iterrows():
            pit_team_col = _find_team_col(pitching)
            team_val = row.get(pit_team_col, "N/A") if pit_team_col else "N/A"
            results.append({
                "player": row["Name"],
                "team": str(team_val) if pd.notna(team_val) else "N/A",
                "type": "pitcher",
                "position": "P",
                "ERA": _safe_round(row.get("ERA"), 2),
                "WAR": _safe_round(row.get("WAR"), 1),
                "season": season,
            })

    if not results:
        if output_format == "json":
            print(json.dumps({"player": player, "season": season, "found": False, "entries": []}))
        else:
            print(f"No roster entries for '{player}' in {season}")
        return

    if output_format == "json":
        print(json.dumps({"player": player, "season": season, "found": True, "entries": results}, indent=2, default=str))
    else:
        print(f"\nRoster entries for '{player}' — {season} Season")
        print(f"{'=' * 60}")
        for r in results:
            stat_str = f"AVG {r.get('AVG', 'N/A')}" if r["type"] == "batter" else f"ERA {r.get('ERA', 'N/A')}"
            war_str = f"WAR {r.get('WAR', 'N/A')}"
            print(f"  {r['player']:<25} {r['team']:<5} {r['position']:<4} {stat_str:<12} {war_str}")


def main():
    parser = argparse.ArgumentParser(description="Query MLB rosters from Statcast batting/pitching data")
    parser.add_argument("--team", type=str, help="Team abbreviation (e.g., NYY, LAD)")
    parser.add_argument("--player", type=str, help="Player name (partial match)")
    parser.add_argument("--season", type=int, required=True, help="Season year (e.g., 2024)")
    parser.add_argument("--format", type=str, default="text", choices=["text", "json"],
                        help="Output format")
    args = parser.parse_args()

    if not args.team and not args.player:
        parser.error("Either --team or --player is required")

    if args.player:
        query_player_roster(args.player, args.season, args.format)
    else:
        query_team_roster(args.team, args.season, args.format)


if __name__ == "__main__":
    main()
