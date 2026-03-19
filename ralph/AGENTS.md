# AGENTS.md — NFL Content Intelligence Article Pipeline

## Project Overview

This Ralph loop drives GitHub Copilot CLI against the **nfl-eval** repository to advance the team-article backlog through an 8-stage article lifecycle. The target output is dashboard-ready Stage 7 articles and live published Stage 8 articles for all 32 NFL teams' 2026 offseason articles.

The nfl-eval repo is an AI-powered NFL analysis engine with 47 specialized agents orchestrated through markdown files, persistent memory, and structured prompts. Articles flow through expert panel discussions, Writer drafting, Editor fact-checking, dashboard review, and Substack publishing.

## Target Repository

- **Repo:** JDL440/nfl-eval (local checkout — sibling directory or as specified)
- **Focus:** 2026 NFL Offseason team articles
- **Backlog:** GitHub issues #40–#69 (one per NFL team)
- **Publication:** NFL Lab on Substack (tag-based publishing)

## Article Pipeline (8 Stages)

| Stage | Name | Owner | Key Skill |
|-------|------|-------|-----------|
| 1 | Idea Generation | Lead | idea-generation |
| 2 | Discussion Prompt | Lead | article-discussion |
| 3 | Panel Composition | Lead | article-discussion |
| 4 | Panel Discussion | Panel agents | article-discussion |
| 5 | Article Drafting | Writer | substack-article |
| 6 | Editor Pass | Editor | editor charter |
| 7 | Publisher Pass | Lead | publisher |
| 8 | Published | Joe via dashboard | — |

The loop advances items through stages 1–7. Stage 8 is reached from the dashboard publish flow after review.

## Key Conventions

- **Tag-based publishing** — Substack uses team + specialist tags, NOT sections
- **Writer voice** — The Ringer meets OverTheCap: informed, opinionated, data-heavy, narrative-driven
- **Editor is mandatory** — Every article must pass the Editor before publishing
- **Expert disagreement is the product** — Don't smooth over differences between agents
- **2026 offseason framing** — Stats reference 2025 season; cap figures are 2026 projections
- **Depth levels** — Level 1 (casual), Level 2 (the beat, default), Level 3 (deep dive)

## Issue Labels for Stage Tracking

| Label | Meaning |
|-------|---------|
| `go:yes` | Approved to begin pipeline work |
| `go:needs-research` | Needs research/idea generation first |
| `stage:idea` | Idea exists |
| `stage:discussion` | Discussion prompt written |
| `stage:panel-ready` | Panel composed |
| `stage:draft` | Panel complete, ready for Writer |
| `stage:review` | Draft exists, needs Editor |
| `stage:publisher` | Editor approved, needs dashboard review / publish |
| `stage:published` | Live article published |

## Agent Roster (in nfl-eval)

- **32 Team agents** (ARI, ATL, BAL, … TB) — deep roster/cap/coaching knowledge per team
- **Lead** — GM-level analyst, orchestrates evaluations and pipeline
- **Cap** — Salary cap expert
- **Draft** — Draft class evaluator
- **Offense / Defense / SpecialTeams** — Scheme specialists
- **Injury** — Durability and recovery risk
- **Media** — Tracks free agency, trades, rumors
- **Analytics** — Advanced metrics (EPA, DVOA, PFF)
- **CollegeScout** — College prospect evaluation
- **PlayerRep** — CBA/contract market expert
- **Writer** — Transforms analysis into Substack articles
- **Editor** — Fact-checks every article before publish

## Content Structure (in nfl-eval)

```
content/
├── articles/
│   ├── {team}-2026-offseason/
│   │   ├── idea.md                 # Stage 1 output
│   │   ├── discussion-prompt.md    # Stage 2 output
│   │   ├── panel.md                # Stage 3 output
│   │   ├── {agent}-position.md     # Stage 4 outputs
│   │   ├── panel-summary.md        # Stage 4 synthesis
│   │   ├── draft.md                # Stage 5 output
│   │   └── editor-review.md        # Stage 6 output
│   └── ...
├── pipeline.db                     # SQLite stage tracking
└── article-ideas.md                # Editorial calendar
```

## What NOT to Modify

- Agent charters (`.squad/agents/*/charter.md`) — system of record
- Skill definitions (`.squad/skills/*/SKILL.md`) — system of record
- Team configuration (`.squad/team.md`, `.squad/config.json`)
- The loop script's own ralph/ directory structure

## Error Handling

- If a required data source is unavailable, document the blocker and skip to the next item
- If the Editor rejects an article (🔴 REJECT), fix the errors and re-submit in the same iteration
- If the Stage 7 handoff is blocked or the dashboard publish flow fails, record the error and move on — Joe can retry from the dashboard or publish manually if needed
