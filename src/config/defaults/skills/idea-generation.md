---
name: "idea-generation"
description: "How to generate the best article idea for an NFL team from supplied current context without stale or invented live-research claims."
domain: "content-production"
confidence: "high"
source: "manual — designed by Joe Robinson & Lead; updated 2026-03-14 to fix stale-angle problem"
tools: [nflverse-data, prediction-markets]
---

# Idea Generation — Skill

## Purpose

Generate the single most pressing or interesting offseason question facing an NFL franchise, grounded in the current-season context supplied in the task.

This skill is for article ideation inside the current runtime. It should sharpen the angle before discussion and drafting begin.

## When to Use

- Any time Lead needs to generate a topic for a team article
- When creating multi-team content batches without pre-writing stale angles
- When the current pipeline context needs one sharp, decision-worthy angle

---

## Critical Rules

### 1. Model Selection

Model selection is handled by the runtime's model policy. This skill stays model-agnostic and focuses on idea quality, recency, and specificity.

### 2. Current Context — Required Before Generating Any Idea

Use the supplied roster, cap, schedule, news, and artifact context first. If the runtime exposes approved web research, use it to fill freshness gaps that matter to the angle.

Before proposing any angle, make sure the prompt includes enough context to answer:

- current QB / roster situation
- key 2026 offseason priorities
- major carryover storylines from the 2025 season
- any recent coaching, cap, or transaction changes already provided upstream

If that context is still missing, say the angle is provisional and name the missing inputs rather than pretending to have fetched them.

### 3. Idea Format

Generate the idea using this format:

```
## Working Title
{Specific, tension-based title — not generic}

## Angle / Tension
{The single most interesting question facing this team in 2026}
{Why it matters NOW, not historically}

## Primary Team
{Team abbreviation and full name}

## Key Data Points (sourced)
- {Stat or fact 1} (source: supplied context or upstream artifact)
- {Stat or fact 2}
- {Stat or fact 3}
```

### 4. Year Accuracy Gate

Before finalizing the idea, run this checklist:

- [ ] Confirm current year context: we are in the 2026 offseason (post-2025 season)
- [ ] All player stats cited are from the 2025 season unless explicitly labeled otherwise
- [ ] All cap figures are for the 2026 cap year
- [ ] Coaching references are current to 2026
- [ ] Year-N framing is accurate

If any of these checks fail, call out the stale assumption and generate the safest angle supported by the supplied context.

---

## General Ideation Heuristics

Ideas can still come from recurring signals:

- **news hooks** — roster moves, cap shifts, draft buzz, coaching changes already present in the prompt
- **calendar windows** — FA wave 1, pre-draft, draft week, camp, preseason, regular season
- **analytical gaps** — obvious reader questions the current article slate has not answered well
- **cross-team context** — when a team-specific question benefits from league or division comparison

## Angle Evaluation

Before locking the idea, sanity-check it against:

| Criterion | Strong Pitch | Weak Pitch |
|-----------|-------------|-----------|
| **Relevance** | Direct impact on roster, cap, or strategy | Tangential mention without stakes |
| **Reader value** | Helps explain a real decision or tension | Generic recap |
| **Uniqueness** | Fresh framing or underexplored conflict | Retread of the same narrative |
| **Timeliness** | Fits the current offseason window | Could have run unchanged months ago |
| **Depth match** | Fits the intended audience level | Too shallow or too technical for the slot |

## Notes

- If you fetched, searched, or verified something through an approved runtime tool, say so plainly and use it as evidence.
- If the context is thin, the correct move is to narrow the claim and name the missing inputs, not to bluff freshness.
