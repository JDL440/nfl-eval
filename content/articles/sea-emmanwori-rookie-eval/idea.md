# Article Idea: Nick Emmanwori's Rookie Season — What the Analytics Say About Seattle's Defensive Chess Piece

**Source:** GitHub Issue #80
**Status:** ✅ Approved (issue opened by Joe Robinson with full brief)
**Depth Level:** 2 — The Beat
**Primary Team:** SEA — Seattle Seahawks

## Angle / Tension

Nick Emmanwori played 768 defensive snaps (84.9%) as a rookie on a championship-caliber defense that allowed -0.121 EPA/play. That's 6th on the team in defensive snap share — not a rotational piece, a fixture. But the real question is whether those numbers reflect genuine trust in a versatile chess piece, or a system-sheltered role inside Macdonald's disguise-heavy rotation where even average players look good when Witherspoon anchors the back end.

The article answers this with real analytics — snap share, on-ball production (80 tackles, 90.9% tackle efficiency, 74.2% comp allowed on 66 targets), deployment breadth (blitz reps, big-nickel, sub-package usage), and Round 2 safety benchmarks (26 picks since 2015, 30.8% starter+ rate). The goal isn't scouting language; it's a data-backed verdict on whether Year 1 evidence supports expanding his role or whether Seattle still needs secondary insurance at #32/#64.

## Why This Is Worth Reading

Most Emmanwori coverage uses "chess piece" and "versatility" without anchoring those claims in what actually happened. This article gives Seahawks fans a clear framework: here's what 768 snaps at 84.9% actually looked like through Macdonald's deployment lens, here's how the on-ball production compares to the Round 2 safety baseline, and here's whether that evidence changes what Seattle should do in the draft.

**Key reader takeaway:** If Emmanwori is real, Seattle can spend #32 and #64 on CB/EDGE instead of secondary insurance. If he's not, the draft board changes completely. This article gives fans the data to evaluate that fork.

## Grounded Data Points

| Metric | Value | Source |
|--------|-------|--------|
| Defensive snaps | 768 | `query_snap_usage.py --player "Nick Emmanwori"` |
| Defensive snap share | 84.9% | Same |
| SEA defense rank (snap share) | 6th | Same |
| SEA EPA/play allowed | -0.121 | `query_team_efficiency.py --team SEA` |
| SEA success rate allowed | 42.5% | Same |
| SEA sacks | 47 | Same |
| SEA interceptions | 18 | Same |
| Tackles | 80 | `pfr_defense` dataset |
| Tackle efficiency | 90.9% (8 missed) | Same |
| Targets against | 66 | Same |
| Comp% allowed | 74.2% | Same |
| Passer rating allowed | 89.1 | Same |
| aDOT allowed | 5.6 | Same |
| Blitzes | 34 | Same |
| Pressures (on blitz) | 7 | Same |
| Draft position | R2 #35 | `query_draft_value.py --player "Nick Emmanwori"` |
| Year 1 AV | 4 | Same |
| R2 S hit rate (since 2015) | 30.8% starter+ (26 picks, 25.5 avg AV) | `query_draft_value.py --position S --round 2` |

## Suggested Panel

| Agent | Role | Lane |
|-------|------|------|
| **SEA** | Roster context, depth-chart implications | How Woolen/Bryant changes affect Emmanwori's path; draft capital fork at #32/#64 |
| **Analytics** | Snap usage, benchmark tables, defensive context | Populated data tables, Round 2 safety comps, on-ball production analysis |
| **Defense** | Scheme fit, deployment interpretation | Macdonald's disguise-rotation system; chess-piece vs. conventional safety framing |

## Target

- **Length:** 2,000–3,500 words
- **Publish window:** ASAP — before draft and OTA role assumptions harden
- **Audience:** Beat-level Seahawks fans who follow roster construction and want analytics, not just scouting language
