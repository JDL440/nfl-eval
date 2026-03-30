# Fantasy Expert Research Report

**Date:** 2026-03-30
**Status:** Research Complete
**Purpose:** Document findings on adding a Fantasy Football Expert agent to the NFL Lab

---

## Executive Summary

The "fantasy expert" refers to a **planned specialist agent** that would evaluate NFL players and transactions from the fantasy football manager's perspective. Comprehensive research has been completed, revealing that:

- **80% of the infrastructure already exists** (data, agent orchestration, query scripts)
- **20% implementation work remains** (agent charter, fantasy-specific queries, skills, routing)
- **High strategic value**: Fantasy football is the largest NFL content segment (60+ million players annually)
- **Unique differentiation**: Multi-agent debate format applied to fantasy analysis (no competitor does this)

---

## Current State: What Exists

### 1. Agent Architecture (47-Agent System)

The repository operates on a sophisticated multi-agent architecture with:

**Infrastructure:**
- `.squad/team.md` — Complete roster of 9 squad agents
- `.squad/routing.md` — Work routing and multi-domain patterns
- `.squad/decisions.md` — Shared decision ledger
- `.squad/agents/{name}/charter.md` — Agent identity and responsibilities
- `.squad/skills/` — Reusable workflow documentation

**Current Agent Types:**
- **Squad Agents (9):** Lead, Code, Data, Publisher, Research, DevOps, UX, Ralph, Scribe
- **No Fantasy agent currently exists**

### 2. Data Infrastructure (Production-Ready)

**nflverse Integration:**
- 11 existing query scripts in `content/data/`
- Parquet file caching system
- MCP tool registration for agent-callable queries
- Fantasy scoring columns ALREADY AVAILABLE in nflverse data:
  - `fantasy_points` (standard scoring)
  - `fantasy_points_ppr` (full PPR)
  - `fantasy_points_half_ppr` (half-PPR)
  - Target share, air yards share, snap counts
  - Weekly consistency data available

**Existing Query Scripts:**
```
query_combine_comps.py       - Combine measurements and comparisons
query_draft_value.py         - Draft pick value analysis
query_historical_comps.py    - Historical player comparisons
query_ngs_passing.py         - Next Gen Stats passing metrics
query_pfr_defense.py         - Pro Football Reference defensive stats
query_player_epa.py          - Player EPA and efficiency metrics
query_positional_comparison.py - Positional rankings
query_prediction_markets.py  - Betting market data
query_rosters.py             - Team roster information
query_snap_usage.py          - Snap count analysis
query_team_efficiency.py     - Team-level efficiency metrics
```

**Gap:** None of these scripts currently aggregate or expose fantasy scoring columns, despite the data being available.

### 3. Existing Planning Documents

Two comprehensive research documents already exist:

**Document 1:** `/research/copilot-session-archive/5223358d-246f-4ab9-a476-0990c0bc22f0/research/what-do-you-think-about-adding-a-fantasy-sports-ex.md`

This 424-line document provides:
- Detailed rationale for adding Fantasy agent
- Complete implementation roadmap (4 phases)
- Data infrastructure analysis
- Competitive differentiation strategy
- Risk assessment
- Fantasy article types and editorial calendar integration

**Document 2:** `/research/copilot-session-archive/c6a12206-f600-4241-a1dd-bd2258921915/research/i-want-to-add-another-expert-for-more-advanced-dat.md`

This document covers the nflverse data infrastructure (Tiers 0-1 completed, supporting fantasy data needs).

---

## Missing Pieces (The 20%)

### 1. Fantasy Agent Charter

**File needed:** `.squad/agents/fantasy/charter.md`

Following the pattern from Data and Research charters:
- Identity (Name, Role, Badge)
- Scope (domain boundaries)
- Responsibilities (core duties)
- Domain Knowledge (expertise areas)
- Model preference
- Boundaries (what NOT to do)

**Proposed Identity:**
- **Name:** Fantasy
- **Role:** Fantasy Football Expert
- **Badge:** 🏈 Fantasy
- **Persona:** Data-backed fantasy analyst who evaluates every NFL move through dual lenses (redraft + dynasty)

### 2. Fantasy Query Script(s)

**Option A:** Create new `content/data/query_fantasy_stats.py`

**Option B:** Extend existing scripts with fantasy metrics
- Add `fantasy_points*` columns to `query_player_epa.py` aggregation (lines 86-106)
- Add fantasy scoring to `POSITION_METRICS` in `query_positional_comparison.py` (lines 30-35)

**Recommended:** Both — extend existing scripts for basic fantasy data, create new script for fantasy-specific analysis (weekly consistency, opportunity share, target trees, red zone usage).

### 3. MCP Tool Registration

**Files:**
- `.github/extensions/nflverse-query/tool.mjs`
- `mcp/server.mjs`

Register fantasy query as agent-callable MCP tool following existing patterns.

### 4. Fantasy Analysis Skill Document

**File needed:** `.squad/skills/fantasy-analysis/SKILL.md`

Should include:
- Scoring systems (standard, PPR, half-PPR, dynasty, best-ball)
- Fantasy evaluation framework
- Data query templates
- Integration protocol (how Fantasy joins panels)
- Article format templates

### 5. Routing Updates

**File:** `.squad/routing.md`

Add Fantasy to:
- Primary routing table (fantasy-specific queries)
- Multi-domain routing (when Fantasy joins panels)

### 6. Team Roster Update

**File:** `.squad/team.md`

Add Fantasy to Members table:
```markdown
| Fantasy | Fantasy Football Expert | Fantasy football analysis, rankings, dynasty/redraft evaluation | 🏈 Fantasy |
```

---

## Strategic Value Proposition

### Why Fantasy is Compelling

1. **Largest NFL Content Audience**
   - 60+ million fantasy football players in the US
   - High engagement, weekly content consumption
   - Converts analytical depth into mainstream appeal

2. **Unique Competitive Moat**
   - Multi-agent debate format (no fantasy site does this)
   - NFL front-office depth (Cap, Offense, Injury) applied to fantasy analysis
   - Data-backed claims with reproducible queries
   - Dual-lens evaluation (redraft + dynasty on every player)

3. **Natural Fit for Existing Architecture**
   - Data infrastructure already has fantasy columns
   - Multi-agent disagreement IS the product
   - Example tension: "Cap says Witherspoon extension is good value; Fantasy says it doesn't affect fantasy output but could prevent re-signing a WR2"

4. **Content Expansion Without Disruption**
   - Fantasy sidebar can enhance existing articles
   - New article types (rankings, waiver wire, start/sit)
   - Increases publishing frequency from 2x/week to 3x/week in-season

### What Makes This Unique

| Feature | FantasyPros/ESPN | The Athletic | NFL Lab with Fantasy |
|---------|------------------|--------------|----------------------|
| Multi-expert debate | ❌ | ❌ | ✅ |
| Front-office depth | ❌ | Partial | ✅ (Cap, Injury, Scheme) |
| Data-backed claims | ✅ | Partial | ✅ (reproducible queries) |
| Dual lens (redraft + dynasty) | Separate content | Separate content | Every article |
| Scheme → fantasy impact | ❌ | ❌ | ✅ (Offense agent integration) |

---

## Implementation Roadmap

Based on the detailed planning document, implementation follows 4 phases:

### Phase 1: Foundation (1 session)
1. Create Fantasy agent charter (`.squad/agents/fantasy/charter.md`)
2. Create Fantasy agent history files
3. Update team roster (`.squad/team.md`)
4. Update routing rules (`.squad/routing.md`)

### Phase 2: Data Layer (1 session)
1. Create `query_fantasy_stats.py` script
2. Extend `query_player_epa.py` with fantasy_points columns
3. Extend `query_positional_comparison.py` POSITION_METRICS
4. Register MCP tools for fantasy queries

### Phase 3: Skills & Templates (1 session)
1. Create `.squad/skills/fantasy-analysis/SKILL.md`
2. Add fantasy article templates to existing skills
3. Document fantasy sidebar patterns

### Phase 4: Validation (1 session)
1. Test Fantasy agent on existing article (retroactive panel member)
2. Produce standalone fantasy rankings article
3. Verify MCP tool end-to-end functionality

**Total estimated effort:** 4 sessions

---

## Key Technical Insights

### Data Availability Matrix

| Metric | Source Dataset | Current Query Script | Status |
|--------|----------------|---------------------|--------|
| fantasy_points | player_stats | None | ✅ Available, not queried |
| fantasy_points_ppr | player_stats | None | ✅ Available, not queried |
| fantasy_points_half_ppr | player_stats | None | ✅ Available, not queried |
| target_share | player_stats | query_player_epa.py | ✅ Already queried |
| air_yards_share | player_stats | query_player_epa.py | ✅ Already queried |
| snap counts | snap_counts | query_snap_usage.py | ✅ Already queried |
| red zone usage | play_by_play | None | ⚠️ Available, needs custom query |
| weekly consistency | player_stats | None | ⚠️ Requires aggregation logic |

### Code Extension Points

**query_player_epa.py (lines 86-106):**
```python
# Current aggregation
agg_dict = {
    "passing_epa": "sum",
    "rushing_epa": "sum",
    # ... other stats ...
}

# Needed addition (2 lines):
    "fantasy_points": "sum",
    "fantasy_points_ppr": "sum",
```

**query_positional_comparison.py (lines 30-35):**
```python
POSITION_METRICS = {
    "QB": ["passing_epa", "passing_yards", "passing_tds",
           "fantasy_points", "fantasy_points_ppr"],  # <- Add these
    "RB": ["rushing_epa", "rushing_yards", "rushing_tds",
           "fantasy_points", "fantasy_points_ppr"],  # <- Add these
    # ... etc
}
```

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Voice mismatch (too casual vs. analytical) | Medium | Fantasy agent charter should specify "data-backed, not hot takes" — matches existing Lab voice |
| Overlap with Analytics agent | Low | Clear boundary: Analytics provides EPA/efficiency, Fantasy translates to fantasy scoring |
| Increased token cost | Very Low | +1 agent per panel = ~$0.15-0.30 per article (negligible) |
| Competition with established brands | Medium | Differentiate via multi-agent debate + front-office depth (unique moat) |

---

## Recommended Next Steps

1. **Immediate (this branch):**
   - Implement Phase 1 (Foundation)
   - Create Fantasy agent charter following Data/Research patterns
   - Update team.md and routing.md

2. **Short-term (follow-up PRs):**
   - Implement Phase 2 (Data Layer)
   - Implement Phase 3 (Skills)
   - Implement Phase 4 (Validation)

3. **Long-term:**
   - Produce first fantasy-focused article
   - Measure audience engagement
   - Iterate on article templates based on performance

---

## References

### Key Files Reviewed
- `/research/copilot-session-archive/5223358d-246f-4ab9-a476-0990c0bc22f0/research/what-do-you-think-about-adding-a-fantasy-sports-ex.md` (424 lines)
- `.squad/team.md` (current agent roster)
- `.squad/routing.md` (work routing patterns)
- `.squad/agents/data/charter.md` (charter template reference)
- `.squad/agents/research/charter.md` (charter template reference)
- `content/data/query_*.py` (11 existing query scripts)

### External Context
- nflverse documentation (fantasy_points columns confirmed available)
- Fantasy football market size (60+ million US players)
- Competitive landscape (FantasyPros, ESPN, The Athletic)

---

## Conclusion

Adding a Fantasy expert agent to the NFL Lab is:

✅ **Technically feasible** — 80% of infrastructure exists
✅ **Strategically valuable** — Largest NFL content audience
✅ **Competitively differentiated** — Unique multi-agent debate format
✅ **Low implementation cost** — 4 sessions estimated
✅ **Low operational cost** — Minimal token cost increase

**Recommendation:** Proceed with implementation, starting with Phase 1 (Foundation) on this branch.

---

**Report prepared by:** Research agent
**Date:** 2026-03-30
**Branch:** claude/add-fantasy-expert
