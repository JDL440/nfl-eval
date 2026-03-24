---
name: "idea-generation"
description: "Generate one strong Stage 1 article idea from the dashboard or issue workflow without adding avoidable setup complexity."
domain: "content-production"
confidence: "high"
source: "manual — simplified 2026-03-24 for V3 dashboard-first Stage 1 flow"
---

# Idea Generation — Skill

## Purpose

Turn an initial prompt into **one concrete article idea** that is ready to enter the pipeline.

The default path is the dashboard form at `/ideas/new`: a user gives one prompt, and Lead returns a structured Stage 1 idea without requiring extra setup unless the operator explicitly provides it.

## Default Dashboard Path

When the request comes from the dashboard:

1. Treat the user prompt as the primary input.
2. Respect any provided team, depth, or pinned-agent hints, but do not require them.
3. Infer the strongest single angle from the prompt instead of offering multiple branches.
4. Keep the output decision-oriented and pipeline-ready.
5. Prefer one primary team unless the prompt is clearly cross-team by nature.

### Dashboard Heuristics

- **Prompt first:** If the prompt already contains a clear team or tension, do not ask for more scaffolding.
- **Optional controls stay optional:** Team picker, depth, auto-advance, and pinned experts are guidance, not prerequisites.
- **One strong idea beats many weak ones:** Return the best angle, not a brainstorm list.
- **Avoid fake freshness:** Use provided roster/context hints; do not invent "current" facts.

## GitHub Issue Path

When a GitHub issue explicitly says **"IDEA GENERATION REQUIRED"**, use the stricter research-first flow:

1. Read this skill before drafting the idea.
2. Fetch current team context before locking the angle.
3. Use current offseason framing instead of training-data-only intuition.
4. Post the generated idea back to the issue before continuing the rest of the pipeline.

### Current-Context Checklist for Issue-Triggered Ideation

- Current QB / starter situation
- Current cap and roster pressure points
- Coaching or scheme changes that alter the angle
- 2025 → 2026 storyline carry-over

### Preferred Research Sources

- Over the Cap — cap data / free agents
- ESPN roster pages — current roster context
- Pro Football Rumors — transactions / negotiations / coaching movement
- Focused news search on team + offseason priorities

## Output Contract

Return the idea in this structure:

```
# Article Idea: {Generated Title}

## Working Title
{Specific, tension-based title}

## Angle / Tension
{The best single article angle}
{Why it matters now}

## Primary Team
{Team abbreviation and full name}

## Depth Level
{1|2|3} — {Level Name}

## Suggested Panel
{Agent1} + {Agent2} + ...

## Key Context
- {Relevant point 1}
- {Relevant point 2}
- {Relevant point 3}

## Score
- Relevance: {1-3}
- Timeliness: {1-3}
- Reader Value: {1-3}
- Uniqueness: {1-3}
- **Total: {N}/12**
```

## Quality Bar

Before finalizing:

- The idea should read like a publishable assignment, not a brainstorm note.
- The title should be clear and specific, not generic.
- The angle should describe a real tension, decision, or debate.
- The suggested panel should match the requested depth.
- The key context should support the angle rather than repeat fluff.

## Anti-Patterns

- Do not return multiple unrelated angle options.
- Do not force team/depth metadata when the prompt can already carry the setup.
- Do not pretend stale knowledge is current reporting.
- Do not add workflow chatter or GitHub-comment behavior unless the task is actually issue-driven.
