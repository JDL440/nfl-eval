# NFL Content Intelligence Platform

> 47 AI agents analyze the NFL so you don't have to read 200 beat reporters. They argue with each other, and the best analysis wins.

**Status:** Prototype proven — 2 published articles, 32 teams loaded, full editorial pipeline operational.
**Focus:** 2026 NFL Offseason (Seahawks-first, expanding to all 32 teams).

---

## What's Here

This repo is an AI-powered NFL analysis engine. It's not a codebase in the traditional sense — there's no application code. It's **pure agent orchestration**: 47 specialized agents coordinated through markdown files, persistent memory, and structured prompts.

**The agent roster:**

| Category | Count | What They Do |
|----------|-------|-------------|
| **Team Agents** | 32 | One per NFL team. Deep roster, cap, coaching, draft needs, and divisional rival knowledge. |
| **Lead** | 1 | GM-level analyst. Runs evaluations, synthesizes cross-agent input, makes final calls. |
| **Cap** | 1 | Salary cap expert. Contract structures, dead money, cap projections. |
| **Draft** | 1 | Draft class evaluator. Board rankings, scheme fits, trade-up/down scenarios. |
| **Offense / Defense / SpecialTeams** | 3 | Scheme specialists. Evaluate players through their respective lenses. |
| **Injury** | 1 | Injury history, recovery timelines, durability risk flags. |
| **Media** | 1 | Tracks free agency, trades, and rumors daily. Distributes news to affected team agents. |
| **Analytics** | 1 | Advanced metrics. EPA, DVOA, PFF grades, win probability models. |
| **CollegeScout** | 1 | Evaluates college prospects. Combine data, film traits, NFL translation profiles. |
| **PlayerRep** | 1 | CBA expert and player advocate. Contract comparables, market value, agent perspective. |
| **Writer** | 1 | Turns expert analysis into publication-ready Substack articles. |
| **Editor** | 1 | Fact-checks every article. Catches errors before they reach readers. |
| **Scribe** | 1 | Session logger. Records decisions, knowledge updates, and agent interactions. |
| **Ralph** | 1 | Work monitor. Tracks what's in progress across agents. |

**What they've produced so far:**
- 2 published long-form articles (~3,500 words each) on the NFL Lab
- An editorial calendar mapped through the 2026 NFL season
- 19+ article ideas in the pipeline
- ~20,000+ lines of accumulated NFL intelligence across agent history files
- 6 reusable skills (OTC data pulls, Spotrac lookups, roster research, knowledge recording, project conventions, Substack article formatting)

---

## How to Use It

This is an interactive system. You talk to the agents through GitHub Copilot CLI.

### Setup
1. Open the repo in **VS Code**
2. Make sure **GitHub Copilot CLI** is installed with the `squad` agent extension
3. Open the Copilot chat panel

### Talking to Agents

Address any agent by name in the chat. Examples:

```
"Media, run today's free agency sweep."
"Cap, break down Kansas City's cap situation for 2026."
"SEA, what are the Seahawks' biggest roster needs heading into the draft?"
"CollegeScout, evaluate the top 5 edge rushers in this class."
"Lead, run a full evaluation of the Cowboys' offseason moves."
```

You can also kick off the full article pipeline:

```
"Team, let's write an article on the Seahawks running back situation."
```

This triggers the expert panel → Writer → Editor → human review flow (see below).

---

## The Pipeline

Every article follows the same path. No shortcuts.

```
1. EXPERT ANALYSIS
   Multiple agents weigh in on the topic. They pull data, run evaluations,
   and — critically — disagree with each other when the data supports it.
   (Cap says $27M. PlayerRep says $33M. Both are right. That's the article.)

2. WRITER
   Takes the raw expert output and crafts it into a Substack article.
   Voice: data-driven, opinionated, readable. Ringer meets OverTheCap.

3. EDITOR
   Fact-checks everything. Player names, contract figures, draft positions,
   statistical claims. Catches errors before they embarrass anyone.
   (Editor caught 6 factual errors in one article. The system works.)

4. HUMAN REVIEW
   Joe reads the final draft. Approves, requests changes, or kills it.

5. PUBLISH
   Goes live on the NFL Lab (Substack).
```

The expert disagreement isn't a bug — it's the product. When Cap and PlayerRep argue about Devon Witherspoon's extension value, readers get two expert perspectives backed by real data. That's what makes this different from a single columnist's opinion.

---

## Data Sources

All agent knowledge comes from public sources:

| Source | What It Provides |
|--------|-----------------|
| [OverTheCap](https://overthecap.com) | Salary cap data, contract details, cap projections |
| [Spotrac](https://spotrac.com) | Contract breakdowns, free agent trackers, market value estimates |
| [ESPN](https://espn.com) | News, transactions, depth charts, game coverage |
| [NFL.com](https://nfl.com) | Official transactions, combine results, draft data |
| [Pro Football Reference](https://pro-football-reference.com) | Historical stats, player comparisons, advanced metrics |

---

## What's Next

> **TODO — Joe will fill this in as capabilities come online.**

Planned but not yet built:

- [ ] **Image creation** — Article header images, player graphics, data visualizations
- [ ] **Automated publishing** — Direct Substack API integration (no more copy-paste)
- [ ] **MCP servers / extensions** — Image generation (DALL-E, Midjourney integration), publishing automation
- [ ] **New agent roles** — Growth/Distribution agent (audience strategy, SEO, social), Graphic Designer agent
- [ ] **Automated pipeline** — Cron-triggered Media sweeps → auto-draft → Editor review → publish queue
- [ ] **Multi-team activation** — Currently Seahawks-focused; 31 more teams ready to light up
- [ ] **Cost tracking** — API spend per article, unit economics at 32-team scale

---

## Repo Structure

```
nfl-eval/
├── .squad/              # Agent system: charters, history, decisions, skills
│   ├── agents/          # 47 agent directories (charter.md + history.md each)
│   ├── skills/          # 6 reusable workflows (OTC, Spotrac, roster research, etc.)
│   ├── decisions/       # Logged decisions and rationale
│   └── team.md          # Full agent roster and project context
├── content/
│   ├── articles/        # Published and in-progress articles
│   ├── article-ideas.md # Editorial calendar and idea pipeline
│   └── proposals/       # Article proposals awaiting approval
├── VISION.md            # Internal strategy doc (not for public sharing)
└── README.md            # You are here
```
