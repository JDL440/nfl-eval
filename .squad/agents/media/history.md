# Media — NFL Media & Rumors Specialist History

## Core Context

- **Project:** NFL Roster Evaluation — 2026 Offseason
- **User:** Joe Robinson
- **Role:** Intel desk — monitors NFL news, tracks rumors, pushes confirmed intel to team agents
- **Model:** auto

## Data Sources

| Source | Status | Notes |
|--------|--------|-------|
| ESPN Transactions | ✅ Works | Per-team via `/nfl/team/transactions/_/name/{abbr}/{slug}`, `max_length` 3000–5000 |
| ESPN NFL News | ✅ Works | National page at `espn.com/nfl/` |
| NFL.com News Wire | ✅ Works | `nfl.com/news/` for official announcements |
| NFL.com Roster Status | ✅ Works | UFA/RFA/ERFA flags at `/teams/{team-slug}/roster`, `max_length` 8000 |
| Spotrac Free Agents | ✅ Works | Best FA tracker via `spotrac.com/nfl/free-agents`, `max_length` 8000+ |
| OTC Salary Cap | ✅ Works | Contract details at `/salary-cap/{team-slug}` |
| The Athletic | ⚠️ Untested | Beat reporting; may require login — test fetchability |
| Pro Football Reference | 🔴 Blocked | HTTP 403 on all URLs — do NOT attempt |
| OTC Free Agency | 🔴 JS-only | `/free-agency` returns empty — use Spotrac instead |

## Reporter Reliability Tiers

| Tier | Reliability | Key Names |
|------|-------------|-----------|
| **Tier 1** | Near-certain | Adam Schefter (ESPN), Ian Rapoport (NFL Network), Tom Pelissero (NFL Network), NFL Network insiders |
| **Tier 2** | Strong | Team beat reporters (The Athletic), Dianna Russini (The Athletic), Jeremy Fowler (ESPN) |
| **Tier 3** | Mixed | National columnists, radio hosts, social media aggregators |
| **Tier 4** | Speculative | Fan accounts, mock draft creators, opinion pieces |

## NFL News Cycle Reference

- **Jan–Feb:** Coaching carousel, combine, early FA speculation
- **Early March:** Legal tampering, franchise tags
- **Mid-March:** FA Wave 1 — highest volume signing period
- **Late March–April:** FA Wave 2, draft visits/workouts, draft rumors
- **Late April:** NFL Draft — trades, picks, UDFA signings
- **May–July:** OTAs, minicamp, holdouts, remaining FA
- **Aug–Sept:** Training camp, preseason, roster cuts (53-man)

## Learnings

_No learnings recorded yet. This section will be updated as Media gains experience with source reliability, fetch patterns, and rumor tracking workflows._
