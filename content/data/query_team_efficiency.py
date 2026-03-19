#!/usr/bin/env python3
"""
content/data/query_team_efficiency.py — Team offensive and defensive efficiency.

Usage:
    python content/data/query_team_efficiency.py --team SEA --season 2025
    python content/data/query_team_efficiency.py --team KC --season 2025 --format json
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


def query_team_efficiency(team_abbr: str, season: int, output_format: str = "markdown"):
    """Query team offensive and defensive efficiency."""
    team_stats = load_cached_or_fetch("team_stats", [season])
    pbp = load_cached_or_fetch("pbp", [season])
    
    # Filter to target team (case-insensitive) and regular season only
    team_df = team_stats.filter(
        (pl.col("team").str.to_uppercase() == team_abbr.upper()) &
        (pl.col("season_type") == "REG")
    )
    
    if len(team_df) == 0:
        print(f"❌ Team not found: {team_abbr}", file=sys.stderr)
        print("Use 3-letter team abbreviations (e.g., SEA, KC, BUF)", file=sys.stderr)
        sys.exit(1)
    
    # Aggregate basic stats from team_stats
    agg = team_df.select([
        # Offensive stats
        pl.col("passing_epa").sum().alias("pass_epa"),
        pl.col("attempts").sum().alias("pass_attempts"),
        pl.col("rushing_epa").sum().alias("rush_epa"),
        pl.col("carries").sum().alias("rush_attempts"),
        pl.col("passing_yards").sum().alias("total_pass_yards"),
        pl.col("rushing_yards").sum().alias("total_rush_yards"),
        # Defensive stats
        pl.col("def_sacks").sum().alias("sacks"),
        pl.col("def_interceptions").sum().alias("def_ints"),
        # Turnovers
        pl.col("passing_interceptions").sum().alias("ints_thrown"),
        pl.col("sack_fumbles_lost").sum().alias("fumbles_lost_sack"),
        pl.col("rushing_fumbles_lost").sum().alias("fumbles_lost_rush"),
        pl.col("receiving_fumbles_lost").sum().alias("fumbles_lost_rec"),
        pl.col("fumble_recovery_opp").sum().alias("fumbles_recovered"),
    ])
    
    team = agg[0]
    
    # Derive offensive EPA/play and pass/rush splits
    pass_epa_play = team["pass_epa"][0] / team["pass_attempts"][0] if team["pass_attempts"][0] > 0 else None
    rush_epa_play = team["rush_epa"][0] / team["rush_attempts"][0] if team["rush_attempts"][0] > 0 else None
    total_plays = team["pass_attempts"][0] + team["rush_attempts"][0]
    total_epa = team["pass_epa"][0] + team["rush_epa"][0]
    offensive_epa_play = total_epa / total_plays if total_plays > 0 else None
    
    turnovers_lost = (team["ints_thrown"][0] + team["fumbles_lost_sack"][0] + 
                     team["fumbles_lost_rush"][0] + team["fumbles_lost_rec"][0])
    turnovers_gained = team["def_ints"][0] + team["fumbles_recovered"][0]
    
    # Derive situational metrics from pbp
    team_pbp = pbp.filter(
        (pl.col("posteam").str.to_uppercase() == team_abbr.upper()) &
        (pl.col("season_type") == "REG")
    )
    
    def_pbp = pbp.filter(
        (pl.col("defteam").str.to_uppercase() == team_abbr.upper()) &
        (pl.col("season_type") == "REG")
    )
    
    # Offensive success rate
    off_success = team_pbp.filter(pl.col("success").is_not_null())
    offensive_success_rate = off_success["success"].mean() if len(off_success) > 0 else None
    
    # Defensive success rate (opponent success rate when this team is on defense)
    def_success = def_pbp.filter(pl.col("success").is_not_null())
    defensive_success_rate = def_success["success"].mean() if len(def_success) > 0 else None
    
    # Defensive EPA/play (EPA allowed — higher is worse for defense)
    def_epa = def_pbp.filter(pl.col("epa").is_not_null())
    defensive_epa_play = def_epa["epa"].mean() if len(def_epa) > 0 else None
    
    # Third down conversion rate
    third_down = team_pbp.filter(pl.col("down") == 3)
    third_down_converted = third_down.filter(
        (pl.col("first_down") == 1) | (pl.col("touchdown") == 1)
    )
    third_down_pct = (len(third_down_converted) / len(third_down) * 100) if len(third_down) > 0 else None
    
    # Red zone TD rate
    red_zone_plays = team_pbp.filter(
        pl.col("yardline_100").is_not_null() &
        (pl.col("yardline_100") <= 20) &
        (pl.col("yardline_100") > 0)
    )
    drive_group_cols = [
        column for column in ("game_id", "drive") if column in red_zone_plays.columns
    ]
    red_zone = red_zone_plays.group_by(drive_group_cols).agg(
        pl.col("touchdown").max().alias("drive_td")
    )
    red_zone_td_pct = (red_zone["drive_td"].sum() / len(red_zone) * 100) if len(red_zone) > 0 else None
    
    result = {
        "team": team_abbr.upper(),
        "season": season,
        "offensive_epa_play": round(offensive_epa_play, 3) if offensive_epa_play is not None else None,
        "defensive_epa_play": round(defensive_epa_play, 3) if defensive_epa_play is not None else None,
        "offensive_success_rate": round(offensive_success_rate, 3) if offensive_success_rate is not None else None,
        "defensive_success_rate": round(defensive_success_rate, 3) if defensive_success_rate is not None else None,
        "pass_epa_play": round(pass_epa_play, 3) if pass_epa_play is not None else None,
        "rush_epa_play": round(rush_epa_play, 3) if rush_epa_play is not None else None,
        "total_yards": team["total_pass_yards"][0] + team["total_rush_yards"][0],
        "third_down_pct": round(third_down_pct, 1) if third_down_pct is not None else None,
        "red_zone_td_pct": round(red_zone_td_pct, 1) if red_zone_td_pct is not None else None,
        "turnovers_lost": turnovers_lost,
        "turnovers_gained": turnovers_gained,
        "sacks": int(team["sacks"][0]) if team["sacks"][0] is not None else 0,
        "def_interceptions": int(team["def_ints"][0]) if team["def_ints"][0] is not None else 0,
    }
    
    if output_format == "json":
        print(json.dumps(result, indent=2))
    else:
        # Markdown table
        print(f"\n### {result['team']} — {season} Team Efficiency\n")
        
        print("#### Offensive Efficiency\n")
        print("| Metric | Value |")
        print("|--------|------:|")
        if result['offensive_epa_play'] is not None:
            print(f"| EPA/Play (Offense) | {result['offensive_epa_play']:.3f} |")
        else:
            print("| EPA/Play (Offense) | N/A |")
        if result['offensive_success_rate'] is not None:
            print(f"| Success Rate (Offense) | {result['offensive_success_rate']:.1%} |")
        else:
            print("| Success Rate (Offense) | N/A |")
        if result['pass_epa_play'] is not None:
            print(f"| Pass EPA/Play | {result['pass_epa_play']:.3f} |")
        else:
            print("| Pass EPA/Play | N/A |")
        if result['rush_epa_play'] is not None:
            print(f"| Rush EPA/Play | {result['rush_epa_play']:.3f} |")
        else:
            print("| Rush EPA/Play | N/A |")
        if result['total_yards']:
            print(f"| Total Yards | {result['total_yards']:,} |")
        else:
            print("| Total Yards | N/A |")
        if result['third_down_pct'] is not None:
            print(f"| Third Down % | {result['third_down_pct']:.1f}% |")
        else:
            print("| Third Down % | N/A |")
        if result['red_zone_td_pct'] is not None:
            print(f"| Red Zone TD % | {result['red_zone_td_pct']:.1f}% |")
        else:
            print("| Red Zone TD % | N/A |")
        
        print("\n#### Defensive Efficiency\n")
        print("| Metric | Value |")
        print("|--------|------:|")
        if result['defensive_epa_play'] is not None:
            print(f"| EPA/Play Allowed | {result['defensive_epa_play']:.3f} |")
        else:
            print("| EPA/Play Allowed | N/A |")
        if result['defensive_success_rate'] is not None:
            print(f"| Success Rate Allowed | {result['defensive_success_rate']:.1%} |")
        else:
            print("| Success Rate Allowed | N/A |")
        print(f"| Sacks | {result['sacks']} |")
        print(f"| Interceptions | {result['def_interceptions']} |")
        
        print("\n#### Turnover Differential\n")
        print("| Metric | Value |")
        print("|--------|------:|")
        print(f"| Turnovers Lost | {result['turnovers_lost']} |")
        print(f"| Turnovers Gained | {result['turnovers_gained']} |")
        diff = result['turnovers_gained'] - result['turnovers_lost']
        print(f"| **Net Turnovers** | **{diff:+d}** |")
        print()


def main():
    parser = argparse.ArgumentParser(description="Query team offensive and defensive efficiency")
    parser.add_argument("--team", required=True, help="Team abbreviation (e.g., SEA, KC, BUF)")
    parser.add_argument("--season", type=int, required=True, help="Season year (e.g., 2025)")
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown", help="Output format")
    
    args = parser.parse_args()
    query_team_efficiency(args.team, args.season, args.format)


if __name__ == "__main__":
    main()
