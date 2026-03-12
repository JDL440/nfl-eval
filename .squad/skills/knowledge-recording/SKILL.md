---
name: "knowledge-recording"
description: "How agents should structure and record research findings in their history.md files"
domain: "knowledge-management"
confidence: "low"
source: "manual — designed based on project charter requirements"
---

## Context

Every agent (32 team agents + 7 specialists) maintains a `history.md` file that serves as persistent memory. When agents research a team or topic using web_fetch skills (overthecap-data, spotrac-data, nfl-roster-research), they need a consistent way to record what they learn. This skill defines the standard format so any agent can read any other agent's history and immediately understand the data.

## Patterns

### Standard History Sections

Every team agent's history.md should organize knowledge into these sections under `## Knowledge Base`:

```markdown
## Knowledge Base

### Roster
<!-- Current roster state, key players, depth -->

### Cap Situation
<!-- Salary cap numbers, space, top hits, dead money -->

### Coaching Staff
<!-- HC, OC, DC, key position coaches, scheme tendencies -->

### Scheme Identity
<!-- Offensive/defensive alignment, tendencies, personnel groupings -->

### Draft Capital
<!-- Picks owned, picks traded away, compensatory picks -->

### Team Needs
<!-- Ranked positional needs with reasoning -->

### Rumor Watch
<!-- ⚠️ RUMOR tagged items only -->
```

Specialist agents use domain-specific sections but follow the same freshness and confidence conventions.

### Data Freshness Timestamps

Every data point or section update MUST include a freshness timestamp:

```markdown
### Cap Situation
_Last updated: 2026-03-12 via overthecap.com_

- **Total Cap Space:** $41,678,185
- **Effective Cap Space:** $30,153,792
- **Top 51 Spending:** $249,908,196
- **Dead Money:** $23,268,104
```

Format: `_Last updated: YYYY-MM-DD via {source}_`

When multiple sources provide different numbers, record both:

```markdown
- **Cap Space:** $41,678,185 (OTC) / $38,448,790 (Spotrac Top 51)
  _Note: OTC reports raw cap space; Spotrac reports Top 51 cap space. Both fetched 2026-03-12._
```

### Confidence Levels

Tag data points with confidence indicators:

| Level | Tag | Meaning | Example |
|-------|-----|---------|---------|
| High | `✅` | Official source, verified, current | Cap numbers from OTC/Spotrac |
| Medium | `📊` | Derived or calculated, likely accurate | "Team needs CB2 based on depth chart analysis" |
| Low | `❓` | Inferred, possibly outdated | "Scheme may shift under new OC" |
| Rumor | `⚠️ RUMOR` | Unverified report | "⚠️ RUMOR: Team interested in trading for Player X (source: beat reporter tweet)" |

```markdown
### Roster
_Last updated: 2026-03-12 via espn.com_

**QB Room:**
- ✅ Jacoby Brissett — Starter per depth chart, signed March 2026
- ✅ Gardner Minshew — Backup, 1yr deal
- ❓ Kedon Slovis — 3rd string, may not survive roster cuts

**WR Corps:**
- ✅ Marvin Harrison Jr. — WR1 (placed on IR Jan 2, returned)
- 📊 Michael Wilson — Likely WR2 based on snap counts + depth chart
- ⚠️ RUMOR: Team exploring WR trade options (beat reporter, unconfirmed)
```

### Rumor Handling

Rumors get special treatment per project charter (dual-track mode):

1. **Inline flag:** Always prefix with `⚠️ RUMOR:` in the relevant section
2. **Attribution:** Include source type (beat reporter, national media, agent leak, etc.)
3. **Date:** When the rumor surfaced
4. **Rumor Watch section:** Also list in the dedicated Rumor Watch section with full context

```markdown
### Rumor Watch

| Date | Rumor | Source | Confidence | Status |
|------|-------|--------|------------|--------|
| 2026-03-10 | Team exploring trade for elite pass rusher | ESPN's Adam Schefter | Medium credibility | 🔵 Active |
| 2026-03-08 | Interest in signing veteran CB | Beat reporter | Low credibility | ⚪ Stale (>48hrs, no follow-up) |
| 2026-03-05 | HC candidate interviewed | Official team statement | Confirmed → moved to Coaching Staff | ✅ Resolved |
```

**Rumor status lifecycle:** 🔵 Active → ⚪ Stale (no updates in 48hrs) → ✅ Resolved (confirmed/denied) → 🔴 Dead (proven false)

### Recording Key Financial Data Points

When recording cap data from OTC or Spotrac, use this format:

```markdown
### Cap Situation
_Last updated: 2026-03-12 via overthecap.com + spotrac.com_

**Summary:**
- ✅ Salary Cap: $301,200,000 (2026 league-wide)
- ✅ Team Cap Space: $41.7M (OTC) — Rank: 7th
- ✅ Effective Cap Space: $30.2M (OTC)
- ✅ Dead Money: $23.3M

**Top 5 Cap Hits:**
| Player | Pos | Cap Hit | Dead Cap | Cuttable? |
|--------|-----|---------|----------|-----------|
| Kyler Murray | QB | $52.7M | $54.7M | ❌ Negative savings |
| Budda Baker | S | $19.2M | $13.9M | 📊 $5.3M savings, $13.9M dead |
| Josh Sweat | EDGE | $16.4M | $31.8M | ❌ Negative savings |
| Marvin Harrison Jr. | WR | $9.6M | $20.9M | ❌ Rookie deal |
| Baron Browning | LB | $9.4M | $4.8M | 📊 $4.6M savings possible |

**Potential Cap Moves:**
- 📊 Restructure candidates: [players with high base salary that could be converted to bonus]
- 📊 Cut candidates: [players where cap savings > dead money]
- 📊 Extension candidates: [players on expiring deals worth keeping]
```

### Recording Roster Research

```markdown
### Roster
_Last updated: 2026-03-12 via espn.com depth chart + nfl.com roster_

**Projected Starters (Offense — 3WR 1TE):**
| Pos | Starter | Backup | Notes |
|-----|---------|--------|-------|
| QB | Jacoby Brissett | Gardner Minshew | New starter after Murray release |
| RB | James Conner (Q) | Tyler Allgeier | Conner questionable designation |
| WR1 | Marvin Harrison Jr. (Q) | Xavier Weaver | MHJ returning from IR |
| WR2 | Michael Wilson | Andre Baccellia | |
| WR3 | Kendrick Bourne | Jalen Brooks | |
| TE | Trey McBride | Tip Reiman | McBride got extension |
| LT | Paris Johnson Jr. (Q) | Demontrey Jacobs | |
| LG | Isaac Seumalo | Jon Gaines II | Seumalo new signing |
| C | Hjalte Froholdt | — | |
| RG | Isaiah Adams | — | |
| RT | Josh Fryar | Christian Jones | |

**Positional Depth Grades:**
- ✅ Strong: TE (McBride + Reiman), EDGE (Sweat + Robinson + Browning)
- 📊 Adequate: WR (MHJ + Wilson + Bourne), S (Baker + Blount)
- ❓ Thin: QB (no long-term answer), OT (injury concerns), CB (after Johnson departure)
```

## Examples

### New team agent first research session
```
1. Fetch ESPN depth chart → Record starters in Roster section with timestamp
2. Fetch OTC salary cap page → Record Cap Situation with top hits and space
3. Fetch ESPN transactions → Record recent moves, update Roster accordingly
4. Fetch Spotrac free agents → Check if team signed/lost anyone, note in Roster
5. Synthesize → Update Team Needs based on depth gaps and cap flexibility
6. Note what you DON'T know yet → Mark sections as "❓ Not yet researched"
```

### Updating after new information
```
# When you fetch new data:
1. Update the relevant section
2. Change the timestamp to current date
3. Adjust confidence levels if data confirms/contradicts prior entries
4. Move confirmed rumors from Rumor Watch to appropriate section with ✅
5. Mark stale rumors (>48hrs no follow-up) as ⚪
```

## Anti-Patterns

- **DO NOT record data without timestamps** — Undated information has unknown freshness and will mislead future analysis.
- **DO NOT mix confirmed facts and rumors** — Always use the ⚠️ RUMOR tag. Never state a rumor as fact.
- **DO NOT record raw web_fetch output** — Parse and structure data into the standard sections. Raw markdown tables from web pages are hard to read and consume excessive space.
- **DO NOT duplicate data across sections** — Reference other sections instead. E.g., in Team Needs, say "Need CB — see Roster for current depth" rather than re-listing the CB room.
- **DO NOT skip the confidence level** — Every data point needs a ✅/📊/❓/⚠️ tag. This is how other agents and Lead know how much to trust the information.
- **DO NOT let history.md grow unbounded** — Archive old data (previous season, resolved rumors) to keep the file focused on current offseason. If a section exceeds ~50 lines, summarize older entries.
