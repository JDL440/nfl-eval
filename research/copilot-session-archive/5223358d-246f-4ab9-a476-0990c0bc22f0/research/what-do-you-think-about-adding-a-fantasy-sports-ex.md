# Adding a Fantasy Sports Expert Agent to the NFL Lab

> **Research date:** 2026-03-20
> **Query:** What about adding a fantasy sports expert? What are the missing pieces and how to make this compelling and unique?

---

## Executive Summary

Adding a **Fantasy** specialist agent to the NFL Lab is not just feasible — it's one of the highest-leverage additions possible. The data infrastructure is already 80% there: nflverse's `player_stats` dataset already contains `fantasy_points`, `fantasy_points_ppr`, and the raw columns to compute half-PPR scoring[^1][^2]. The platform's core competitive advantage — multi-agent disagreement as the product — maps perfectly onto fantasy football's central tension: **what the football analysts value vs. what fantasy managers should care about**. The missing pieces are (1) a Fantasy agent charter, (2) a fantasy-specific query script/MCP tool, (3) a new fantasy-oriented skill, and (4) a set of article templates designed for fantasy content. This report details each gap, proposes the agent design, and explains how to make it genuinely unique in a crowded fantasy content landscape.

---

## Part 1: Why This Fits Perfectly

### The Platform Already Has Everything Fantasy Needs

The existing agent architecture has a gap that fantasy fills naturally. Consider the current specialist lineup:

| Agent | Evaluates From Perspective Of | Fantasy Relevance |
|-------|-------------------------------|-------------------|
| Cap | Team salary cap | Indirect — contract size ≠ fantasy value |
| Analytics | EPA/efficiency | High — EPA correlates with fantasy output |
| Offense | Scheme fit | High — scheme determines usage |
| Injury | Durability | Critical — availability is the #1 fantasy stat |
| Draft | Prospect evaluation | High — rookie fantasy value is huge |
| PlayerRep | Player's contract leverage | Indirect — landing spot affects fantasy value |
| CollegeScout | College production/athleticism | Medium — prospect profiles |
| Team Agents (32) | Team-specific context | High — they know depth charts, snap shares |

**The gap:** Nobody evaluates from the **fantasy manager's perspective**. When the panel discusses Bijan Robinson, Cap cares about contract, Offense cares about scheme fit, ATL cares about their roster — but nobody says *"Robinson is the RB1 in half-PPR because Stefanski targets backs 5-7 times per game."*[^3] That perspective is currently showing up as incidental asides in articles, not as a first-class analysis lane.

### The Multi-Agent Disagreement Format Is Made for Fantasy

The NFL Lab's signature is expert disagreement. Fantasy amplifies this:

- **Cap says:** "Paying Witherspoon $31M is efficient cap management."
- **Fantasy says:** "Witherspoon's extension has zero fantasy impact. But that $31M could prevent re-signing a WR2 who'd boost DK's target share."

This creates an entirely new dimension of tension in every article. The Cap expert and Fantasy expert will naturally conflict because they optimize for different things — Cap optimizes for team success, Fantasy optimizes for individual statistical output. That conflict IS content.

### Fantasy Is the Largest NFL Content Audience

Fantasy football participation in the US is estimated at 60+ million players annually. The NFL Lab's current audience is sophisticated football fans — the type who read OTC analysis. Adding a fantasy lens converts that analytical depth into something the largest segment of NFL consumers actively seeks.

---

## Part 2: What's Already Built (The 80%)

### Data Infrastructure — Mostly There

The nflverse `player_stats` dataset already contains key fantasy columns[^1][^2]:

| Column | Description | Status |
|--------|-------------|--------|
| `fantasy_points` | Standard scoring (non-PPR) | ✅ Available in `player_stats` |
| `fantasy_points_ppr` | Full PPR scoring | ✅ Available in `player_stats` |
| `fantasy_points_half_ppr` | Half-PPR scoring | ✅ Available in `player_stats` (nflverse 2024+) |
| `target_share` | % of team passing targets | ✅ Already in `query_player_epa.py`[^4] |
| `air_yards_share` | % of team air yards | ✅ Already in `query_player_epa.py`[^4] |
| `racr` | Receiver Air Conversion Ratio | ✅ Already in `query_player_epa.py`[^4] |
| `carries` / `rushing_yards` / etc. | Usage stats | ✅ All available |
| Snap counts | Playing time % | ✅ `query_snap_usage.py`[^5] |
| Next Gen Stats (receiving) | Separation, cushion, YAC | ✅ `ngs_receiving` dataset in nflverse[^6] |
| FTN Charting | Routes, formations, personnel | ✅ `ftn_charting` dataset (2022+)[^7] |

**What's NOT yet queried for fantasy:**
- `fantasy_points`, `fantasy_points_ppr`, `fantasy_points_half_ppr` — available in the parquet but not surfaced by any existing query script
- Weekly fantasy point distribution (consistency vs. boom/bust)
- Red zone targets / carries (available in PBP data but no query script)
- Personnel grouping snap counts (FTN data exists but no fantasy-focused query)
- Opportunity share (touches / team total touches)
- Weighted Opportunity Rating (WOPR = target share weight + air yards share weight)

### Existing Query Scripts — Small Extensions Needed

The current `query_player_epa.py` already pulls most of the raw data a fantasy expert needs[^4]. The aggregation at lines 86–106 sums counting stats and averages rate stats — but it doesn't include `fantasy_points` or `fantasy_points_ppr` in those aggregations. Adding them is trivial (2-3 lines of code).

The `query_positional_comparison.py` script's `POSITION_METRICS` dict doesn't include any fantasy scoring metrics[^8]:
```python
POSITION_METRICS = {
    "QB": ["passing_epa", "passing_yards", "passing_tds", ...],
    "RB": ["rushing_epa", "rushing_yards", "rushing_tds", ...],
    "WR": ["receiving_epa", "receiving_yards", "receiving_tds", ...],
    "TE": ["receiving_epa", "receiving_yards", "receiving_tds", ...],
}
```

Adding `fantasy_points_ppr` and `fantasy_points_half_ppr` to each position's metrics list unlocks fantasy positional rankings immediately.

---

## Part 3: The Missing Pieces

### Missing Piece #1: The Fantasy Agent Charter

A new charter at `.squad/agents/fantasy/charter.md` following the existing pattern[^9][^10][^11].

**Proposed Identity:**

```markdown
# Fantasy — Fantasy Football Expert

> The other lens. Every move has two values — what it means for the team, 
> and what it means for your fantasy roster.

## Identity

- **Name:** Fantasy
- **Role:** Fantasy Football Expert  
- **Persona:** The fantasy analyst who actually watches film — not just 
  a points-per-game merchant. Thinks in opportunity share, target trees, 
  and weekly floor/ceiling ranges. Speaks to both season-long and dynasty 
  managers.
- **Model:** auto

## Responsibilities

- Evaluate every player move, signing, trade, and draft pick through the 
  fantasy lens: how does this change a player's weekly production profile?
- Provide positional rankings (QB/RB/WR/TE/K/DST) grounded in the 
  platform's data, not generic consensus
- Analyze opportunity share shifts: when a team signs a WR2, how does 
  that affect the WR1's target share?
- Dynasty vs. redraft framing: a 32-year-old signing is irrelevant to 
  dynasty leagues but critical for redraft
- Boom/bust profiling: weekly fantasy point variance, not just season totals
- Identify "league-winners" — undervalued players whose situation 
  changed but whose ADP hasn't caught up
- Red zone opportunity analysis: who gets the TDs?
- Coaching scheme → fantasy impact mapping: Shanahan RBs, McVay WRs, 
  Kingsbury slot receivers
```

**Key Design Principle:** Fantasy is NOT a replacement for Analytics. Analytics provides EPA and efficiency metrics as football evaluation tools. Fantasy translates every piece of analysis — from any agent — into "what does this mean for your fantasy team?" The distinction:

| Question | Analytics Answers | Fantasy Answers |
|----------|-------------------|-----------------|
| Is Player X good? | "X ranks 8th in EPA/play" | "X is a high-floor WR2 with WR1 upside in half-PPR" |
| Should Team Y sign Player Z? | "Z adds 0.05 EPA/play to the offense" | "Z signing pushes Player A from 28% target share to 22% — that's a positional downgrade" |
| Is this trade good? | "Team gains 1.2 WAR net" | "Waddle in Denver = WR1 ceiling with Bo Nix. But Miami's RB room just became the #1 waiver target" |

### Missing Piece #2: A Fantasy-Specific Query Script

**New file:** `content/data/query_fantasy_stats.py`

This script should surface data that no existing script does:

```
Usage:
  python content/data/query_fantasy_stats.py --player "Bijan Robinson" --season 2025
  python content/data/query_fantasy_stats.py --position RB --season 2025 --top 20 --scoring half_ppr
  python content/data/query_fantasy_stats.py --team ATL --season 2025
  python content/data/query_fantasy_stats.py --player "Bijan Robinson" --season 2025 --weekly
```

**Key outputs no existing script provides:**

1. **Fantasy point totals** (standard, half-PPR, full PPR) — The `player_stats` dataset has these columns but `query_player_epa.py` doesn't aggregate them[^4]
2. **Weekly consistency metrics** — Standard deviation, floor (25th percentile), ceiling (75th percentile), boom rate (% of weeks above positional average)
3. **Opportunity share** — Touches as a % of team total (requires team-level aggregation)
4. **Target tree** — Team's target distribution showing who gets the volume
5. **Red zone usage** — Available from PBP data (`yardline_100 <= 20`), not yet queried by any script
6. **Positional fantasy rankings** — Across all scoring formats

**Implementation approach:** Follow the same pattern as `query_player_epa.py`[^4] — use `load_cached_or_fetch()` from `_shared.py`[^12], aggregate stats with Polars, output markdown tables or JSON.

### Missing Piece #3: MCP Tool Registration

Register the new script as an MCP tool in `.github/extensions/nflverse-query/tool.mjs`[^13] and `mcp/server.mjs`[^14]:

```javascript
// In tool.mjs — add tool definition
export const queryFantasyStatsTool = {
    name: "query_fantasy_stats",
    description: "Fantasy football stats: points (STD/half-PPR/PPR), weekly consistency, opportunity share, target distribution, red zone usage, and positional rankings",
    inputSchema: { /* player, position, team, season, scoring, weekly, top */ }
};

// In server.mjs — register handler
server.tool("query_fantasy_stats", queryFantasyStatsTool.inputSchema, 
    async (args) => normalizeToolResult(await handleQueryFantasyStats(args)));
```

### Missing Piece #4: Fantasy-Specific Skill Document

**New file:** `.squad/skills/fantasy-analysis/SKILL.md`

This skill teaches agents how to incorporate fantasy analysis into the article pipeline:

**Key sections:**
1. **Scoring Systems** — Standard, half-PPR, PPR, superflex, dynasty, best-ball (defines terminology)
2. **Fantasy Evaluation Framework** — Opportunity → Efficiency → Situation → Matchup (the hierarchy)
3. **Data Anchor Templates** — Pre-built query commands for generating fantasy data tables in discussion prompts
4. **Integration Protocol** — When Fantasy joins a panel, what it provides that other agents don't
5. **Article Types** — Fantasy-specific article formats (rankings, waiver wire, trade value charts, etc.)

### Missing Piece #5: Routing Table Update

Add Fantasy to the routing table in `.squad/routing.md`[^15]:

```markdown
| Fantasy rankings, waiver wire, start/sit, dynasty, redraft | Fantasy | "Who should I start at RB?", fantasy impact of trades, dynasty rankings |
```

And in the multi-agent evaluation routing:

```markdown
| "What does this signing mean for fantasy?" | Lead + Fantasy + relevant team agent + Offense/Defense |
| "Rank the top 20 RBs for 2026" | Lead + Fantasy + Analytics + Offense |
| "Dynasty vs. redraft evaluation of Player X" | Fantasy + CollegeScout + Injury |
```

### Missing Piece #6: Team.md Update

Add Fantasy to the Specialists table in `.squad/team.md`[^16]:

```markdown
| Fantasy | Fantasy Football Expert | .squad/agents/fantasy/charter.md | Active |
```

---

## Part 4: How to Make This Genuinely Unique

The fantasy content landscape is brutally crowded. FantasyPros, ESPN, Yahoo, The Athletic, Underdog — thousands of voices. Here's what would make the NFL Lab's fantasy content genuinely different:

### 1. The Panel Disagrees — Fantasy Edition

**Nobody else does multi-expert debate for fantasy.** When the NFL Lab evaluates a player's fantasy value, it's not one analyst's opinion. It's:

- **Fantasy** says: "Robinson is the RB1 because volume is king and Stefanski gives his RBs 25 touches."
- **Offense** says: "Actually, Stefanski's 2026 install adds more 11-personnel than Cleveland ever ran. Robinson's target share drops."
- **Cap** says: "ATL's cap crunch means they can't afford a backup. Robinson's workload goes UP, not down."
- **Injury** says: "Robinson's 2025 workload was 92nd percentile. Historical comps at that usage show a 35% injury-risk spike in Year 4."

That's four different experts arriving at different fantasy conclusions from the same player. **That IS the article.** No fantasy site produces this level of multi-perspective analysis because they don't have the agent infrastructure.

### 2. Real NFL Scouting Applied to Fantasy

Most fantasy content is "points-per-game + opportunity share." The NFL Lab can go deeper because it already has:

- **Scheme analysis from Offense/Defense** — "The new OC runs 12-personnel 40% of the time. That means fewer 3-WR sets, which crushes WR3 value but boosts TE1."[^17]
- **Contract analysis from Cap** — "This prove-it deal means the player is motivated. Historical comps for players on 1-year deals show a 15% production bump."[^18]
- **Injury modeling from Injury** — "This RB's Achilles recovery has a 78% return-to-form rate at 12 months. But that means a 22% chance your first-round pick returns zero value."[^19]
- **CBA knowledge from PlayerRep** — "The franchise tag means this WR stays in the same offense. That's a stability premium that consensus ADP doesn't price in."[^20]

**No fantasy site combines front-office depth with fantasy-specific output.** FantasyPros gives you rankings. The Athletic gives you analysis. The NFL Lab gives you a front-office simulation that outputs fantasy advice.

### 3. Data-Driven, Not Gut-Driven

The platform's nflverse integration means every claim has a query behind it:

```markdown
### Why Bijan Robinson Is the RB1

_Source: `query_fantasy_stats --player "Bijan Robinson" --season 2025 --scoring half_ppr`_

| Metric | Value | Rank |
|--------|------:|-----:|
| Half-PPR Points | 312.4 | #2 |
| Opportunity Share | 31.2% | #1 |
| Red Zone Carries | 48 | #3 |
| Boom Rate (>20 pts) | 41.2% | #5 |
| Weekly Floor (25th %ile) | 12.8 | #1 |

_Source: `query_snap_counts --player "Bijan Robinson" --season 2025`_

| Snap Type | Count | % |
|-----------|------:|--:|
| Offensive | 892 | 82.1% |
| Routes Run | 412 | 46.2% of off. snaps |
```

Every fantasy take backed by reproducible data queries. That's a trust differentiator.

### 4. Dynasty + Redraft Dual Lens

Most content is either dynasty or redraft. The Fantasy agent should always provide both:

> **Redraft (2026):** Robinson is the RB1. Volume + scheme + health = top-5 lock.
>
> **Dynasty:** Robinson is RB3. He turns 25 in Week 8, and the aging curve for RBs shows a 30% production decline by age 27. Breece Hall (23) and Bijan's own backup (22) have more runway.

This dual-lens approach serves a wider audience with every article.

### 5. The "What This Means for Your Fantasy Team" Sidebar

Every existing article type gets richer with a fantasy sidebar:

| Existing Article Type | Fantasy Sidebar Content |
|----------------------|------------------------|
| Trade evaluation (e.g., Waddle trade) | "Winners and losers for fantasy — Waddle's new target tree, Miami's backfield vacuum" |
| Offseason team evaluation | "Fantasy stock risers/fallers for every player on this roster" |
| Draft prospect evaluation | "Rookie dynasty rankings — where to draft them in startup and rookie drafts" |
| Contract extension analysis | "What Witherspoon's extension means for Seattle's ability to re-sign DK — and DK's target share" |

This means fantasy content doesn't require entirely new articles — it enhances the existing pipeline's output.

---

## Part 5: Fantasy Article Types for the Editorial Calendar

### New Article Formats

| Format | Frequency | Panel Composition | Example Title |
|--------|-----------|-------------------|---------------|
| **Positional Rankings** | Monthly (offseason), weekly (in-season) | Fantasy + Analytics + Offense | "Our Panel's Top 25 Half-PPR RBs for 2026 — And the 5 We Can't Stop Arguing About" |
| **Offseason Fantasy Impact** | Per-transaction | Fantasy + relevant team + Cap | "Waddle to Denver: Our Fantasy Expert Says Buy Low, Our Scheme Expert Says Pump the Brakes" |
| **Draft Fantasy Preview** | Draft week | Fantasy + CollegeScout + Draft | "The 5 Rookies Our Expert Panel Is Targeting in 2026 Dynasty Startups" |
| **Weekly Start/Sit** | Weekly (in-season) | Fantasy + Analytics + matchup team | "Start/Sit Week 4: Our Panel Disagrees on 7 Lineups This Week" |
| **Waiver Wire** | Weekly (in-season) | Fantasy + Injury + team agents | "The Waiver Wire Expert Panel: 5 Adds, 3 Drops, 1 Trap" |
| **Dynasty Trade Values** | Monthly | Fantasy + Cap + Injury | "Updated Dynasty Trade Chart: 10 Players Whose Value Just Moved" |

### Integration with Existing Calendar

The editorial calendar in `content/article-ideas.md` is currently all football analysis[^21]. Fantasy-themed articles can interleave without disrupting the existing cadence:

- **Tuesday (in-season):** Football recap article + **Fantasy sidebar** (stock risers/fallers)
- **Wednesday (in-season):** **Fantasy-specific article** (waiver wire, start/sit preview)
- **Thursday (in-season):** Football preview article + **Fantasy sidebar** (matchup analysis)

This increases publishing frequency from 2×/week to 3×/week during the season without requiring more football analysis articles.

---

## Part 6: Implementation Roadmap

### Phase 1: Foundation (1 session)

| Step | What | Files |
|------|------|-------|
| 1 | Create Fantasy agent charter | `.squad/agents/fantasy/charter.md` |
| 2 | Create Fantasy agent history | `.squad/agents/fantasy/history.md`, `history-archive.md` |
| 3 | Update team.md | `.squad/team.md` |
| 4 | Update routing.md | `.squad/routing.md` |

### Phase 2: Data Layer (1 session)

| Step | What | Files |
|------|------|-------|
| 5 | Create `query_fantasy_stats.py` | `content/data/query_fantasy_stats.py` |
| 6 | Add `fantasy_points*` to `query_player_epa.py` aggregation | `content/data/query_player_epa.py` (lines 86-106) |
| 7 | Add `fantasy_points_ppr` to `POSITION_METRICS` | `content/data/query_positional_comparison.py` (lines 30-35) |
| 8 | Register MCP tool | `.github/extensions/nflverse-query/tool.mjs`, `mcp/server.mjs` |

### Phase 3: Skill & Templates (1 session)

| Step | What | Files |
|------|------|-------|
| 9 | Create fantasy analysis skill | `.squad/skills/fantasy-analysis/SKILL.md` |
| 10 | Add fantasy article templates to substack-article skill | `.squad/skills/substack-article/SKILL.md` (append) |
| 11 | Add fantasy sidebar template | (within skill doc) |

### Phase 4: Validation (1 session)

| Step | What |
|------|------|
| 12 | Run Fantasy on an existing article (e.g., the Waddle trade) as a retroactive panel member |
| 13 | Produce a standalone fantasy rankings article through the full pipeline |
| 14 | Verify MCP tool works end-to-end |

---

## Part 7: Risks and Considerations

### Audience Alignment

The NFL Lab's current voice is "OverTheCap meets The Ringer" — sophisticated football analysis[^22]. Fantasy content risks feeling like a different publication if the voice shifts too casual. **Mitigation:** Fantasy should match the Lab's voice — data-backed, opinionated, not "hot take" content. Think "The Athletic's fantasy section" not "fantasy waiver wire bro."

### Increased Panel Size / Token Cost

Adding Fantasy to panels increases agent count by 1 per article. At `claude-opus-4.6` with 1,500 max output tokens per panel agent[^23], that's ~$0.15-0.30 per article for the Fantasy panel contribution. Negligible.

### Competition with Established Fantasy Brands

FantasyPros, ESPN, Underdog have massive data advantages (proprietary projections, ECR aggregation, DFS optimizer data). The NFL Lab can't compete on projection modeling. **The moat is the multi-agent debate format + NFL front-office depth.** Nobody else produces fantasy analysis that sounds like it came from an actual front office.

### Content Overlap with Analytics

Fantasy and Analytics could produce redundant analysis if boundaries aren't clear. **Boundary rule:** Analytics provides football efficiency metrics (EPA, DVOA, success rate). Fantasy translates all analysis into fantasy-scoring terms. Analytics never says "start" or "sit." Fantasy never says "positive EPA."

---

## Confidence Assessment

| Claim | Confidence | Basis |
|-------|------------|-------|
| nflverse `player_stats` has fantasy point columns | **High** | Confirmed via nflverse documentation and web search[^1][^2] |
| Existing query scripts can be extended with 2-3 lines | **High** | Verified `query_player_epa.py` source code — aggregation at lines 86-106 just needs new column names[^4] |
| Multi-agent fantasy debate is unique in the market | **High** | No known fantasy content platform uses adversarial multi-agent analysis |
| Fantasy would increase audience reach | **High** | Fantasy football is the largest segment of NFL content consumption |
| Implementation requires ~4 sessions | **Medium** | Based on pattern from similar agent additions (CollegeScout, PlayerRep had similar scope) |
| Fantasy sidebar could increase publishing to 3×/week | **Medium** | Depends on editorial capacity and whether sidebar format is compelling |
| Token cost increase is negligible | **High** | One additional panel agent at 1,500 tokens is ~$0.15-0.30 per article[^23] |

---

## Footnotes

[^1]: nflverse `player_stats` dataset catalog — `.squad/skills/nflverse-data/SKILL.md:30` — lists "114 cols: EPA, CPOE, yards, TDs, fantasy pts"
[^2]: nflverse documentation confirms `fantasy_points`, `fantasy_points_ppr`, and `fantasy_points_half_ppr` columns in `player_stats` — [nflreadr.nflverse.com](https://nflreadr.nflverse.com/), [nflfastr.com](https://nflfastr.com/reference/calculate_stats.html)
[^3]: `content/articles/atl-2026-offseason/offense-position.md:17` — Offense agent incidentally mentions "top-3 fantasy RB" while discussing scheme, demonstrating the gap where fantasy analysis appears as an aside rather than a primary lens
[^4]: `content/data/query_player_epa.py:86-106` — aggregation code sums counting stats and EPA columns but does not include `fantasy_points` or `fantasy_points_ppr`
[^5]: `content/data/query_snap_usage.py` — snap count query script, already registered as MCP tool
[^6]: `.squad/skills/nflverse-data/SKILL.md:33-34` — `ngs_receiving` dataset available 2016+ with separation, cushion, YAC data
[^7]: `.squad/skills/nflverse-data/SKILL.md:36` — `ftn_charting` dataset available 2022+ with routes, formations, blocking concepts (CC-BY-SA-4.0)
[^8]: `content/data/query_positional_comparison.py:30-35` — `POSITION_METRICS` dict doesn't include any fantasy scoring columns
[^9]: `.squad/agents/analytics/charter.md` — Analytics agent charter (pattern for specialist agent structure)
[^10]: `.squad/agents/offense/charter.md` — Offense agent charter (pattern for scheme-focused agent)
[^11]: `.squad/agents/playerrep/charter.md` — PlayerRep charter (pattern for "alternative lens" agent)
[^12]: `content/data/_shared.py:22-63` — `load_cached_or_fetch()` shared utility for auto-fetching nflverse data
[^13]: `.github/extensions/nflverse-query/tool.mjs:1-44` — MCP tool extension with `runPythonQuery()` helper
[^14]: `mcp/server.mjs:26-36` — MCP server registration of nflverse query tools
[^15]: `.squad/routing.md:6-24` — work routing table for agent assignment
[^16]: `.squad/team.md:15-29` — specialist agent roster
[^17]: `.squad/agents/offense/charter.md:25-44` — Offense agent's personnel grouping and scheme analysis knowledge
[^18]: `.squad/agents/cap/charter.md:1-27` — Cap agent's contract analysis capabilities
[^19]: `.squad/agents/injury/charter.md` — Injury agent's recovery timeline analysis
[^20]: `.squad/agents/playerrep/charter.md:42-46` — PlayerRep's franchise tag and CBA expertise
[^21]: `content/article-ideas.md:36-97` — editorial calendar organized by NFL calendar, all football analysis
[^22]: `.squad/agents/writer/charter.md:9` — Writer persona: "Bill Simmons + Zach Lowe + Football Outsiders + The Ringer"
[^23]: `.squad/config/models.json:15-16` — `panel_agent` max output tokens = 1,500; model = `claude-opus-4.6`
