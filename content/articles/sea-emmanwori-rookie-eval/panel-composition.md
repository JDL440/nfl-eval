# Panel Composition: Nick Emmanwori Rookie Season Evaluation

**Article:** `sea-emmanwori-rookie-eval`
**Depth Level:** 2 — The Beat (3–4 agents)
**Panel Size:** 3 agents (minimum for Level 2)

## Selected Panel

| Agent | Role on Panel | Specific Question | Lane |
|-------|---------------|-------------------|------|
| **SEA** | Seattle Seahawks Team Analyst | After the Woolen/Bryant changes, does Emmanwori's 768-snap / 84.9% rookie year give Seattle enough secondary confidence to spend #32 and #64 on CB/EDGE — or does the team still need insurance? | Roster context — depth chart, offseason secondary moves, draft capital fork |
| **Analytics** | Data & Statistical Analyst | Emmanwori: 768 snaps, 80 tackles (90.9% efficiency), 74.2% comp allowed on 66 targets, 89.1 passer rating allowed, R2 #35 with AV 4. How does this compare to the Round 2 safety benchmark (26 picks, 25.5 avg AV, 30.8% starter+)? | Numbers — populated data tables, on-ball production, Round 2 comps, coverage efficiency |
| **Defense** | Defensive Scheme Expert | In Macdonald's disguise-heavy rotation, was Emmanwori's deployment genuinely versatile (post-snap rotation trust, big-nickel breadth, simulated-pressure/red-zone reps) or system-sheltered by a championship defense anchored by Witherspoon? | Scheme fit — deployment diversity, chess-piece validation, 2026 projection through Macdonald's lens |

## Selection Rationale

**Why these three:**
- **SEA** is mandatory — every team-specific article includes the team agent for roster context. Critical here because the Woolen/Bryant secondary changes create a direct fork: if Emmanwori is real, the draft board shifts to CB/EDGE; if not, safety insurance becomes a priority.
- **Analytics** is the spine of this article. The issue explicitly requires data-backed evaluation. Analytics now has populated data from nflverse (`snap_counts`, `pfr_defense`) plus the Round 2 safety benchmark table. Their job is to present the numbers cleanly and let the comparison speak.
- **Defense** provides the scheme layer that neither SEA (roster focus) nor Analytics (numbers focus) covers: whether Macdonald's system inflated Emmanwori's numbers. Defense must evaluate through the disguise-rotation lens, not conventional safety box-score analysis.

**Why not others:**
- **Cap** excluded — this is not a contract or cap-space article. Emmanwori is on a rookie deal with no extension timeline.
- **Draft / CollegeScout** excluded — the article evaluates his NFL rookie season, not his college tape or draft profile. Draft context (R2 #35, AV benchmarks) is handled by Analytics.
- **PlayerRep** excluded — no negotiation or contract advocacy angle.

## Lane Boundaries

- **SEA** owns the roster/depth-chart angle and the draft capital fork. Do NOT duplicate Analytics' statistical tables or Defense's scheme interpretation.
- **Analytics** owns the numbers and benchmark comparisons. Produce tables with the populated data (snap counts, pfr_defense, draft value). Do NOT interpret scheme fit or deployment diversity — that's Defense's lane.
- **Defense** owns scheme interpretation through Macdonald's system. Do NOT re-list snap counts or tackle totals that Analytics already covers. Focus on what the deployment patterns mean for the chess-piece archetype.

## Misleading Evidence Warnings (from Defense specialist input)

These metrics are misleading for this article and should NOT be used as primary evidence:

| Metric | Why It's Misleading |
|--------|-------------------|
| Raw tackle totals (80) | High tackles can mean lots of contact, not coverage quality; box safeties inflate this |
| Low INT totals | In Macdonald's rotation, safeties aren't targeted deep enough to generate INTs; low INTs ≠ bad coverage |
| Simplistic snap% narratives | 84.9% in a disguise-heavy rotation doesn't tell you how many different looks he was responsible for |
| Offensive EPA metrics | `query_player_epa.py` and WR/QB positional comparisons do not apply to safeties |

**Use instead:** Tackle efficiency (90.9%), comp% allowed (74.2%), passer rating allowed (89.1), aDOT allowed (5.6), blitz deployment (34 blitzes / 7 pressures), and deployment breadth within Macdonald's scheme.
