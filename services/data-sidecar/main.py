"""NFL Data Sidecar — FastAPI wrapper around nflverse data queries.

Provides HTTP endpoints for the TypeScript pipeline to query NFL data
without spawning Python processes. Each endpoint mirrors an MCP tool
from the v1 system.

Start with: uvicorn services.data-sidecar.main:app --port 8100
"""

from __future__ import annotations

from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from typing import Optional

app = FastAPI(title="NFL Data Sidecar", version="2.0")


# ── Health ────────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    return {"status": "ok", "league": "nfl"}


# ── Player Stats ──────────────────────────────────────────────────────


@app.get("/api/player-stats")
async def player_stats(
    player: str,
    season: int = Query(default=2024, ge=2000, le=2099),
):
    """Query EPA and efficiency metrics for a player."""
    return JSONResponse(
        {
            "status": "stub",
            "endpoint": "player-stats",
            "params": {"player": player, "season": season},
        }
    )


# ── Team Efficiency ───────────────────────────────────────────────────


@app.get("/api/team-efficiency")
async def team_efficiency(
    team: str,
    season: int = Query(default=2024, ge=2000, le=2099),
):
    """Team offensive/defensive efficiency."""
    return JSONResponse(
        {
            "status": "stub",
            "endpoint": "team-efficiency",
            "params": {"team": team, "season": season},
        }
    )


# ── Positional Rankings ──────────────────────────────────────────────


@app.get("/api/positional-rankings")
async def positional_rankings(
    position: str,
    metric: str,
    season: int = Query(default=2024, ge=2000, le=2099),
    top: int = Query(default=20, ge=1, le=100),
):
    """League-wide positional rankings."""
    return JSONResponse(
        {
            "status": "stub",
            "endpoint": "positional-rankings",
            "params": {
                "position": position,
                "metric": metric,
                "season": season,
                "top": top,
            },
        }
    )


# ── Snap Counts ──────────────────────────────────────────────────────


@app.get("/api/snap-counts")
async def snap_counts(
    season: int = Query(default=2024, ge=2000, le=2099),
    team: Optional[str] = None,
    player: Optional[str] = None,
):
    """Snap count data — team-level or individual player lookup."""
    return JSONResponse(
        {
            "status": "stub",
            "endpoint": "snap-counts",
            "params": {"season": season, "team": team, "player": player},
        }
    )


# ── Draft History ────────────────────────────────────────────────────


@app.get("/api/draft-history")
async def draft_history(
    position: Optional[str] = None,
    pick_range: Optional[str] = None,
    player: Optional[str] = None,
):
    """Draft pick value and historical hit rates."""
    return JSONResponse(
        {
            "status": "stub",
            "endpoint": "draft-history",
            "params": {
                "position": position,
                "pick_range": pick_range,
                "player": player,
            },
        }
    )


# ── Combine ──────────────────────────────────────────────────────────


@app.get("/api/combine")
async def combine_profile(
    player: Optional[str] = None,
    position: Optional[str] = None,
    metric: Optional[str] = None,
):
    """Combine measurables — player lookup or positional leaderboard."""
    return JSONResponse(
        {
            "status": "stub",
            "endpoint": "combine",
            "params": {"player": player, "position": position, "metric": metric},
        }
    )


# ── NGS Passing ──────────────────────────────────────────────────────


@app.get("/api/ngs-passing")
async def ngs_passing(
    season: int = Query(default=2024, ge=2000, le=2099),
    player: Optional[str] = None,
    metric: Optional[str] = None,
):
    """Next Gen Stats passing data."""
    return JSONResponse(
        {
            "status": "stub",
            "endpoint": "ngs-passing",
            "params": {"season": season, "player": player, "metric": metric},
        }
    )


# ── Defense ──────────────────────────────────────────────────────────


@app.get("/api/defense")
async def defense_stats(
    season: int = Query(default=2024, ge=2000, le=2099),
    player: Optional[str] = None,
    team: Optional[str] = None,
    position: Optional[str] = None,
):
    """PFR advanced defensive stats."""
    return JSONResponse(
        {
            "status": "stub",
            "endpoint": "defense",
            "params": {
                "season": season,
                "player": player,
                "team": team,
                "position": position,
            },
        }
    )


# ── Prediction Markets ──────────────────────────────────────────────


@app.get("/api/prediction-markets")
async def prediction_markets(
    search: Optional[str] = None,
    team: Optional[str] = None,
    market_type: Optional[str] = None,
):
    """Polymarket NFL odds and market-implied probabilities."""
    return JSONResponse(
        {
            "status": "stub",
            "endpoint": "prediction-markets",
            "params": {
                "search": search,
                "team": team,
                "market_type": market_type,
            },
        }
    )
