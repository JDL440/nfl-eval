# Decision: Nick Emmanwori Rookie Eval — Article Kickoff

**Date:** 2026-03-19
**Author:** Lead
**Type:** Article pipeline — kickoff (Stages 1–2)
**GitHub Issue:** #80

## Decision

Kicked off the article creation flow for issue #80: "Nick Emmanwori's Rookie Season — What the Analytics Say About Seattle's Defensive Chess Piece."

**Slug:** `sea-emmanwori-rookie-eval`
**Path:** `content/articles/sea-emmanwori-rookie-eval/`
**Current stage:** 2 (Discussion Prompt written)
**Panel:** SEA + Analytics + Defense (3 agents, Level 2 minimum)

## Key Corrections

The original issue (#80) was created with Jacksonville context (see `lead-nick-emmanwori-article-issue.md`). The issue body has been corrected to Seattle. All kickoff artifacts use Seattle context exclusively. The prior inbox decision (`lead-nick-emmanwori-article-issue.md`) is now superseded by this document.

## Artifacts Created

| Artifact | Path | Purpose |
|----------|------|---------|
| `idea.md` | `content/articles/sea-emmanwori-rookie-eval/idea.md` | Captures the approved idea, angle, and data query list |
| `panel-composition.md` | `content/articles/sea-emmanwori-rookie-eval/panel-composition.md` | Documents panel selection (SEA, Analytics, Defense) with rationale and lane boundaries |
| `discussion-prompt.md` | `content/articles/sea-emmanwori-rookie-eval/discussion-prompt.md` | Full Stage 2 artifact — core question, tensions, data anchor commands, paths, panel instructions |
| Pipeline DB record | `content/pipeline.db` | Article row (stage 2), stage transitions, panel composition, discussion prompt record |

## What Remains Before Stage 3–4

1. **Run the nflverse data queries** listed in the discussion prompt. The data anchors are currently command stubs, not populated tables. Analytics must execute the four primary queries and paste results into the prompt before panel agents are spawned.
2. **Analytics may need to pull additional defensive data** from `snap_counts` and `pfr_defense` datasets for Emmanwori-specific stats not covered by the canned query scripts.
3. Once data anchors are populated, Lead spawns the 3-agent panel (Stage 3→4).

## Rationale

- **Depth Level 2** is correct: single-player season evaluation, not a multi-layer roster construction piece. 3 agents, 2000–3500 words.
- **3-agent panel (SEA, Analytics, Defense):** Each agent has a distinct lane — roster context, data/benchmarks, scheme interpretation. No overlap. Cap/Draft/PlayerRep excluded because this is a performance evaluation, not a contract or draft-capital article.
- **Data-first approach:** The issue explicitly requires analytics-backed evaluation. Discussion prompt marks all stats as required anchors rather than fabricating numbers. This respects the reviewer-gate convention.
- **Slug convention:** `sea-emmanwori-rookie-eval` follows the `{team}-{player}-{topic}` pattern used by `ind-sauce-gardner-gamble`, `kc-fields-trade-evaluation`, etc.
