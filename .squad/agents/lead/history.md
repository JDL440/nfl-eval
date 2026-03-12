# Lead — Lead / GM Analyst History

## Core Context
- **Project:** NFL Roster Evaluation — 2026 Offseason
- **User:** Joe Robinson
- **Data Sources:** overthecap.com, spotrac.com, ESPN/NFL.com, PFR, PFF, The Athletic, mock draft sites
- **Rumor Mode:** Dual-track (⚠️ RUMOR inline + separate track)

## Learnings

### Data Source Viability (Observed 2026-03-12)

**What Works with web_fetch:**

| Source | URL Pattern | Quality | Notes |
|--------|-------------|---------|-------|
| OTC Team Cap | `/salary-cap/{team-slug}` | ✅ Excellent | Full roster salary table, server-rendered, all 32 teams |
| OTC Player Contract | `/player/{slug}/{id}` | ✅ Excellent | Year-by-year breakdown, guarantee triggers, out years |
| OTC Cap Space Rankings | `/salary-cap-space` | ✅ Excellent | All 32 teams, multi-year, effective cap space |
| OTC Position Market | `/position/{position}` | ✅ Excellent | All contracts at position sorted by APY |
| Spotrac Team Cap | `/nfl/{team-slug}/cap` | ✅ Excellent | Similar to OTC, includes league rank per metric |
| Spotrac Free Agents | `/nfl/free-agents` | ✅ Excellent | Signed + available FAs, contract terms, teams |
| Spotrac Player Contract | `/nfl/player/_/id/{id}/{slug}` | ✅ Excellent | Most detailed: incentives, escalators, notes |
| ESPN Roster | `/nfl/team/roster/_/name/{abbr}/{slug}` | ✅ Good | Position, age, height, weight, experience, college |
| ESPN Depth Chart | `/nfl/team/depth/_/name/{abbr}/{slug}` | ✅ Excellent | Full depth chart by formation, injury flags |
| ESPN Transactions | `/nfl/team/transactions/_/name/{abbr}/{slug}` | ✅ Excellent | Chronological with full details |
| ESPN Schedule | `/nfl/team/schedule/_/name/{abbr}/{slug}` | ✅ Good | Game results, leaders |
| NFL.com Roster | `/teams/{team-slug}/roster` | ✅ Good | Key advantage: UFA/RFA/ERFA status flags |

**What Does NOT Work:**

| Source | URL Pattern | Issue |
|--------|-------------|-------|
| Pro Football Reference | Any PFR URL | 🔴 HTTP 403 — blocks all automated access |
| OTC Free Agency | `/free-agency` | 🔴 JS-only, returns empty table headers + preloader GIFs |
| OTC Cap Tracker | `/cap-tracker` | 🔴 404 Not Found |
| OTC Contracts by Team | `/contracts/{team-slug}` | ⚠️ Returns league-wide data, not team-filtered |

**Key Discoveries:**
- OTC player IDs must be extracted from team salary pages — guessing IDs returns wrong players
- Spotrac is the ONLY working source for free agent tracking via web_fetch
- ESPN depth chart reveals scheme (formation names: "3WR 1TE", "Base 4-3 D")
- ESPN transactions page is the best single page for offseason move tracking
- NFL.com roster status flags (ACT/UFA/RFA) are unique — no other source provides this in fetchable form
- `max_length` must be 8000-15000 for roster/cap pages; default 5000 truncates heavily
- 2026 salary cap is $301,200,000

### Skills Created (2026-03-12)
- `.squad/skills/overthecap-data/SKILL.md` — OTC URL patterns, extraction guidance
- `.squad/skills/spotrac-data/SKILL.md` — Spotrac URL patterns, free agent tracking
- `.squad/skills/nfl-roster-research/SKILL.md` — ESPN/NFL.com roster, depth, transactions
- `.squad/skills/knowledge-recording/SKILL.md` — Standard format for agent history.md files

### Agents Created (2026-03-12)
- **Media** (`.squad/agents/media/`) — NFL Media & Rumors Specialist. Intel desk: monitors news feeds, tracks rumors with confidence levels (🟢/🟡/🔴), manages rumor lifecycle (⚠️ RUMOR → ✅ CONFIRMED / ❌ DEBUNKED), pushes confirmed intel to team agents. Includes reporter reliability tiers (Tier 1–4) and rumor dashboard format. Created per Joe Robinson's request.
- **Analytics** (`.squad/agents/analytics/`) — NFL Advanced Analytics Expert. The team's numbers engine: EPA, DVOA, PFF grades, QBR, win probability, success rate, AV. Provides statistical context for player evaluation, player comparison models, positional value analysis, contract value modeling, draft pick value analytics, team efficiency rankings, and opponent-adjusted metrics. Challenges narrative-driven evaluations with data. Integrates with Cap (contract value), Draft (prospect modeling), Offense/Defense (scheme context), and team agents (team-specific analytics). Created per Joe Robinson's request.
- **CollegeScout** (`.squad/agents/collegescout/`) — College Player Scouting Expert. The team's college-to-pro projection specialist: deep prospect evaluation (film patterns, technique, athleticism, football IQ), measurables analysis with positional thresholds, college production in context (conference, system, usage), historical prospect comps, scheme fit projection (with Offense/Defense), medical red flags (with Injury), character/intangibles tracking, small school/FCS discovery, all-star game evaluation, and transfer portal tracking. Position-specific criteria for QB, WR, OL, EDGE, CB, S, LB, DL, RB, TE. Provides scouting intelligence that Draft and team agents use — does NOT make pick recommendations. Created per Joe Robinson's request.
- **PlayerRep** (`.squad/agents/playerrep/`) — Player Advocate & CBA Expert. The other side of the negotiation table: advocates from the player's perspective in trade, signing, and contract evaluations. Deep CBA expertise (accrued seasons, FA types, franchise/transition tags, comp pick formula, rookie wage scale, 5th-year option, guaranteed money structures, void years). Player destination preference analysis (state income tax impact, market size, winning culture, scheme fit/role clarity, coaching reputation, lifestyle, family proximity). Contract negotiation dynamics (extension vs. FA timing, leverage points, comparable contracts, guaranteed money as #1 priority). Career trajectory modeling (optimal extension windows by position, age curves, 2nd vs. 3rd contract dynamics). Player movement patterns (ring-chasing, return-home narratives, prove-it deals). Serves as counterpoint to team agents — PlayerRep + Cap together give full negotiation picture. Does NOT evaluate talent or scheme fit — defers to team agents, Offense, Defense. Created per Joe Robinson's request.
