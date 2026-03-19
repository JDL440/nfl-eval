# Decision: Nick Emmanwori Rookie Eval — Article Kickoff

**Date:** 2026-03-19
**Author:** Lead
**Type:** Article pipeline — kickoff (Stages 1–2, data-populated)
**GitHub Issue:** #80

## Decision

Kicked off and fully sharpened the article creation flow for issue #80: "Nick Emmanwori's Rookie Season — What the Analytics Say About Seattle's Defensive Chess Piece."

**Slug:** `sea-emmanwori-rookie-eval`
**Path:** `content/articles/sea-emmanwori-rookie-eval/`
**Current stage:** 2 (Discussion Prompt written, data anchors populated)
**Panel:** SEA + Analytics + Defense (3 agents, Level 2 minimum)

## Key Corrections

The original issue (#80) was created with Jacksonville context (see `lead-nick-emmanwori-article-issue.md`). The issue body has been corrected to Seattle. All kickoff artifacts use Seattle context exclusively. The prior inbox decision (`lead-nick-emmanwori-article-issue.md`) is now superseded by this document.

## Specialist Inputs Integrated

All three artifacts were sharpened with real specialist outputs:

**Analytics delivered:**
- Snap usage: 768 defensive snaps, 84.9%, 6th on SEA defense
- Team efficiency: SEA defense -0.121 EPA/play allowed, 42.5% success rate, 47 sacks, 18 INTs
- On-ball production (pfr_defense): 80 tackles, 90.9% efficiency, 74.2% comp allowed, 89.1 passer rating, 5.6 aDOT, 34 blitzes / 7 pressures
- Draft value: R2 #35, AV 4 (Year 1); R2 S benchmark: 26 picks, 25.5 avg AV, 30.8% starter+
- Tooling constraint: `query_player_epa.py` is offensive-only; do NOT use for safety evaluations

**SEA delivered:**
- Frame as Seattle/2025, not Jacksonville
- Key tension: was he protected by a championship defense / Witherspoon-anchored deployment?
- Draft capital fork: if Emmanwori is real, #32/#64 goes to CB/EDGE, not secondary insurance

**Defense delivered:**
- Evaluate through Macdonald's disguise-heavy rotation, not traditional safety box-score analysis
- Key questions: post-snap rotation trust, big-nickel breadth, simulated-pressure/red-zone reps
- Misleading evidence warnings: raw tackles, low INTs, simplistic snap% narratives
- Comp family: chess-piece / hybrid deployments, not conventional box safety framing

## Artifacts Created/Updated

| Artifact | Status | Key Changes |
|----------|--------|-------------|
| `idea.md` | ✅ Updated | Real data points table (18 grounded metrics), sharpened angle with system-shelter tension, draft capital fork |
| `panel-composition.md` | ✅ Updated | Data-grounded agent questions, misleading evidence warnings table, explicit comp-family guidance |
| `discussion-prompt.md` | ✅ Updated | All data anchors populated (no more command stubs), 4 sharpened tensions with real numbers, "Metrics NOT To Use" table, scheme-aware paths, deployment-specific panel instructions |
| Pipeline DB record | ✅ No change needed | Article row at stage 2, panel composition, discussion prompt already recorded |

## What Remains Before Stage 3–4

1. **Combine measurables** — one remaining query stub (`query_combine_comps.py --player "Nick Emmanwori"`). Run at panel time.
2. **Lead spawns 3-agent panel** (SEA, Analytics, Defense) — artifacts are now data-complete enough to proceed.
3. Analytics should produce a 3–5 player rookie safety comp table during their panel position.
