# Research: How to Leverage Copilot Pro+ and Squad Files for a 45+ Agent System

## Executive Summary

The good news is that this repository already has a **real, native GitHub Copilot custom agent**: `.github/agents/squad.agent.md`. That means Copilot can already recognize a top-level `Squad` coordinator in the repo, and the repo also contains GitHub Actions workflows that read `.squad/team.md` to create labels, triage issues, route work, and optionally assign `@copilot` for autonomous issue execution.[^1][^2][^3][^4]

The bad news is that the **45+ specialist/team agents are not native Copilot custom agents today**. They live under `.squad/agents/*/charter.md`, which is meaningful to the Squad coordinator and to your own repo conventions, but **GitHub/Copilot does not auto-discover those files as custom agents**. Likewise, the repo’s reusable instructions live in `.squad/skills/*`, while GitHub’s native skill discovery expects `.github/skills` (or personal skill directories), so those skills are not automatically loaded by Copilot today.[^5][^6][^7][^8]

That distinction matters because the **product runtime is still not using live Squad orchestration**. The backend generates a markdown brief from a static routing table derived from `.squad/skills/substack-article/SKILL.md`, saves the brief, and then expects a human to paste that brief into Writer; the worker explicitly marks production articles as "pending Squad article" rather than generating discussion/article output itself.[^9][^10][^11][^12]

So the answer is: **yes, we can strongly leverage Copilot Pro+ plus Squad files for development, issue routing, and coordinated analysis; no, the current implementation does not yet prove a fully automated 45+ agent runtime for the article pipeline**. To get there, we should keep `.squad/` as the source of truth for routing and memory, use GitHub-native Copilot features for top-level coordination and issue automation, and build a dedicated runtime bridge that turns `.squad` metadata into persisted `discussion` artifacts instead of treating GitHub coding agent as the synchronous article engine.[^5][^8][^9][^10][^11]

## Architecture / System Overview

### The three layers that matter

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Layer 1: Native Copilot / Pro+ surface                             │
│  - Copilot CLI                                                      │
│  - Copilot coding agent (@copilot)                                  │
│  - Custom agents in .github/agents                                  │
│  - Skills in .github/skills                                          │
│  - Custom instructions in .github/copilot-instructions.md / AGENTS  │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Layer 2: Repo-local Squad metadata                                 │
│  - .squad/team.md                                                   │
│  - .squad/routing.md                                                │
│  - .squad/agents/*/charter.md + history.md                          │
│  - .squad/skills/*/SKILL.md                                         │
│  - .squad/decisions.md                                              │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Layer 3: Product runtime                                            │
│  - sweep / queue / dashboard / publish                              │
│  - write-article endpoint                                            │
│  - content brief generation                                           │
│  - manual Writer→Editor handoff                                      │
└──────────────────────────────────────────────────────────────────────┘
```

Today, Layer 1 and Layer 2 are **partially connected** for issue routing and human-led sessions, but Layer 3 still uses only a **brief bridge**, not live multi-agent execution.[^1][^2][^9][^10][^11][^12]

## What Copilot Pro+ Actually Gives Us

Copilot Pro+ gives you the highest individual-tier access to Copilot features, including Copilot coding agent, premium models, and a larger premium-request allowance than standard Pro. Official GitHub docs describe Pro+ as including everything in Pro plus a larger premium allowance and full access to all available models in Copilot Chat.[^13]

For this repo, the most relevant Pro+ capabilities are:

| Capability | Why it matters here | Evidence |
|---|---|---|
| Copilot coding agent | Can pick up GitHub issues, work in the background, create PRs, and request review | GitHub Docs say coding agent works from issues/PRs and runs in an ephemeral GitHub Actions environment.[^5] |
| Custom agents | Lets the repo define specialized Copilot agents in `.github/agents` | GitHub Docs say repository custom agents live in `.github/agents/*.agent.md`.[^6] |
| Skills | Lets Copilot auto-load specialized instructions/resources when relevant | GitHub Docs say project skills live in `.github/skills` or `.claude/skills`.[^7][^8] |
| Custom instructions | Lets you preload build/test/validation guidance into Copilot | GitHub Docs support `.github/copilot-instructions.md`, path instructions, and `AGENTS.md`.[^14][^15] |
| Premium request headroom | Important because coding agent sessions and premium-model usage are metered | GitHub Docs say Pro+ includes 1,500 premium requests/month and coding agent sessions consume premium requests plus Actions minutes.[^13][^16] |
| Copilot Memory | Useful for repository-level learned context, but not a replacement for `.squad` | GitHub Docs say Copilot Memory is available for Pro/Pro+ and can improve repository knowledge.[^5] |

Two cost/operational implications matter immediately.

First, **coding agent is issue/PR oriented**, not request/response app-runtime oriented. GitHub documents it as a background GitHub Actions-powered agent that creates pull requests from issues or PR comments, which is perfect for repo work but not a natural fit for synchronous article-generation inside your app.[^5]

Second, **each coding agent session consumes premium requests and GitHub Actions minutes**. GitHub documents coding agent usage this way explicitly, and Pro+ gives a larger allowance, not unlimited background-agent compute.[^13][^16]

## What This Repo Already Has That We Can Leverage Right Now

### 1. A real top-level native custom agent

The repo has a `.github/agents` directory, and it currently contains `squad.agent.md`.[^2][^17] That file is a bona fide GitHub custom agent profile and contains the coordinator logic for reading `.squad/team.md`, `.squad/routing.md`, `.squad/casting/registry.json`, spawning agents with the `task` tool, and using Ralph-style monitoring and GitHub issue workflows.[^1]

That means `Squad` itself is already positioned correctly to be invoked through GitHub Copilot’s custom-agent mechanism. This is the most important native integration that already exists.[^1][^6]

### 2. A rich Squad metadata layer

The team roster is already large and structured. `.squad/team.md` defines specialists, all 32 NFL team experts, Phase 2 automation roles (Backend, Frontend, Tester), and support roles (Writer, Editor, Scribe, Ralph).[^18] The adjacent `.squad/routing.md` maps work types to those roles and defines multi-agent evaluation patterns.[^19]

This is valuable because it gives you:

- a stable ontology of **who exists**,
- a routing map for **who should talk on which topic**, and
- persistent per-agent charters/history files for domain memory.[^18][^19][^20]

### 3. Repo-driven GitHub issue automation

The GitHub workflows under `.github/workflows` already use `.squad/team.md` as a source of truth.

- `sync-squad-labels.yml` parses the members table and creates/updates `squad:*`, `go:*`, `release:*`, `type:*`, `priority:*`, and signal labels.[^3]
- `squad-triage.yml` reads the roster and routing context, triages new `squad` issues, and can optionally route to `@copilot` when the capability profile indicates a good fit.[^4]
- `squad-issue-assign.yml` posts assignment comments and can assign GitHub’s coding agent bot via `agent_assignment` when `squad:copilot` is applied.[^21]
- `squad-heartbeat.yml` acts as Ralph on GitHub, scanning issues/PRs, auto-triaging, and optionally assigning `@copilot` while passing custom instructions that point the coding agent back at `.squad/team.md` and `.squad/routing.md`.[^22]

That is real leverage. It means the repo can already use Copilot Pro+ to automate parts of the **software development workflow** around backlog → route → coding agent → PR.[^3][^4][^21][^22]

### 4. A clear content skill that already encodes routing discipline

The `substack-article` skill is important because it encodes the intended editorial routing logic. It says every article should map to a small panel of relevant experts and explicitly warns: **"Don’t use all 45 agents — 2-4 experts per article, max."**[^20]

That is actually the right operating principle. “Fully take advantage of 45+ agents” should not mean “fan out 45 agents on every article.” It should mean “maintain 45+ addressable expert personas and route each idea to the smallest credible panel.”[^20]

## Where the Current Implementation Stops Working

This is the section where the repo must be called out honestly.

### 1. The 45+ agents are not native GitHub custom agents today

GitHub’s native custom-agent mechanism expects repository agent profiles in `.github/agents/*.agent.md`.[^6] This repo has only one such file: `squad.agent.md`.[^2][^17]

The rest of the roster lives under `.squad/agents/*/charter.md`. Those files are meaningful to the coordinator and to humans, but **they are not automatically exposed as first-class Copilot agents in GitHub’s agent picker or CLI custom-agent registry**.[^1][^2][^6][^18]

So if the goal is “I want all 45+ agents to be directly selectable as native Copilot custom agents,” the current implementation is **not sufficient**.

### 2. The skills are in the wrong place for native discovery

GitHub’s native skill locations are `.github/skills` and `.claude/skills` for project skills, or home-directory skill locations for personal skills.[^7][^8] This repo’s skills live under `.squad/skills`, and the repo’s `.github` directory contains only `agents/` and `workflows/`—there is no `.github/skills` directory today.[^17][^23]

That means the current skills are **not natively auto-discovered by Copilot**. They only help if the coordinator explicitly reads them and injects them into an agent prompt, which is exactly what `squad.agent.md` instructs the coordinator to do.[^1][^7][^8]

So if the goal is “skills should just work natively in Copilot,” the current implementation is **not sufficient**.

### 3. There is no active repository custom-instructions file

GitHub supports repository-wide custom instructions via `.github/copilot-instructions.md`, path-based instructions via `.github/instructions/**/*.instructions.md`, and agent instructions via `AGENTS.md` files.[^14][^15]

This repo currently has no `.github/copilot-instructions.md` and no `AGENTS.md`; `.github` only contains `agents/` and `workflows/`.[^17] There is a useful template at `.squad/templates/copilot-instructions.md`, but templates under `.squad/templates` are not active native Copilot instructions by themselves.[^24][^17]

So the repo is missing the easiest native mechanism for teaching Copilot how to build/test/validate changes without re-learning the repo every session.[^14][^24]

### 4. The article pipeline is still a manual brief bridge — and the intended pipeline is fundamentally different

The code proves this directly.

src/content-brief.js builds a static routing table and question set from transaction type and outputs markdown instructing a human to paste the brief into Writer.[^9] src/server.js uses generateBrief(job), writes the brief to content/briefs/{job-id}-brief.md, and transitions the job only to rticle_requested.[^10]

The worker does not run live panel discussions. In production mode, scripts/job-processor.js marks the job complete with pendingSquadArticle: true and a subtitle that says article generation is pending via the Squad Writer→Editor pipeline.[^11]

The architecture docs match the code: BACKEND.md states that the human copies the brief to Writer, Writer produces the article, Editor reviews it, and then the human attaches it back to the backend.[^12]

So if the goal is "the app itself should automatically exploit the 45+ agent routing behavior," the current implementation is **not sufficient**.

**The intended pipeline is not "brief + manual paste." It is a first-class, team-scoped content production line:**

1. **Ideation:** Media + Editor generate **Ideas** — catchy Substack topic titles, cross-expert discussion topics that can favor strong disagreement, with optional recommended publish dates/date ranges or open-ended timing.
2. **Panel Discussion:** Ideas spawn **PanelDiscussions** (possibly from a generated discussion prompt). A small expert panel (2–4 agents) debates the topic via .squad/routing.md. The PanelDiscussion is a **first-class persisted artifact**, not throwaway intermediate state.
3. **Writing:** Writer turns the PanelDiscussion into an **Article** — a polished Substack-ready draft built from the transcript and agent outputs.
4. **Editing:** Editor reviews/edits the Article with a structured report (errors, suggestions, verdict). Revision loop if needed.
5. **Publishing:** A **Publisher** role handles Substack release — timing, scheduling, sanity checks, and auto-publish configuration for approved articles.

This flow runs **per team (all 32 NFL teams)** and can advance **automatically or require human approval** through a modern dashboard that is **not constrained by the current UI**.[^9][^10][^11][^12][^18][^19][^20]
### 5. GitHub-native `@copilot` assignment is only partially wired

The issue-routing workflows are promising, but they are not fully wired to your custom agent stack yet.

`squad-issue-assign.yml` can assign the coding agent bot and uses the `agent_assignment` payload, but it currently sends empty strings for `custom_instructions`, `custom_agent`, and `model`.[^21] In contrast, `squad-heartbeat.yml` at least passes a non-empty `custom_instructions` string telling the coding agent to read `.squad/team.md` and `.squad/routing.md`.[^22]

That means `@copilot` issue pickup is currently **inconsistent**. It can be assigned, but it is not yet guaranteed to run as your `Squad` custom agent or with your intended model/profile.[^21][^22]

### 6. There is at least one path/config smell in the Squad layer

`.squad/config.json` still points `teamRoot` at `Q:\github\nfl-eval`, while the active repo in this session is `C:\github\nfl-eval`.[^25] That does not prove a runtime failure by itself, but it is the sort of path drift that will hurt any future attempt to build a deterministic runner around `.squad` metadata.[^25]

## What “Fully Take Advantage of 45+ Agents” Should Mean

The repo’s own skill file already gives the right answer: **not all agents should run on all tasks**.[^20]

The correct model is:

1. Keep the 45+ agents as an **addressable expert graph**.
2. Use routing rules to select the **smallest credible panel**.
3. Persist the outputs as structured discussion artifacts.
4. Hand those artifacts to Writer and Editor.

For example:

| Idea type | Correct panel | Why |
|---|---|---|
| Seahawks signing | `SEA + Cap + Offense/Defense + Writer + Editor` | Team context plus money plus scheme |
| Trade between BUF and KC | `BUF + KC + Cap + Draft + Writer + Editor` | Two advocates plus cap/pick mechanics |
| League-wide cap trend piece | `Lead + Cap + Analytics + Media + Writer + Editor` | No single team advocate needed |
| Draft pick article | `Team + Draft + CollegeScout + Offense/Defense + Writer + Editor` | Prospect + roster fit + writing/review |

That model scales to 45+ agents because the roster is broad, not because all 45 run simultaneously.[^19][^20]

## Recommended Plan

## Plan A — What We Can Do Immediately with Current Platform Support

### A1. Keep one native top-level `Squad` custom agent

Do **not** try to make every `.squad` persona a first-class GitHub agent immediately. Keep `.github/agents/squad.agent.md` as the native entry point and let it orchestrate the deeper roster through `.squad/team.md`, `.squad/routing.md`, and per-agent charters.[^1][^2][^18][^19]

This is already aligned with how the repo is structured and is the least disruptive path.

### A2. Promote the most important instructions into native Copilot locations

Create these native files/directories:

- `.github/copilot-instructions.md`
- `.github/skills/substack-article/SKILL.md`
- `.github/skills/knowledge-recording/SKILL.md`
- `.github/skills/production-smoke-testing/SKILL.md`
- `.github/skills/sqlite-corruption-recovery/SKILL.md` (if still relevant)

That gives Copilot native access to the repo’s highest-value knowledge without needing the coordinator to manually inject every skill every time.[^7][^8][^14][^23][^24]

### A3. Add a small number of first-class native coding agents only where it helps

If you want richer GitHub-native issue pickup, create a **small operational set** of `.github/agents/*.agent.md` files:

- `lead.agent.md`
- `backend.agent.md`
- `frontend.agent.md`
- `tester.agent.md`
- `writer.agent.md`
- `editor.agent.md`

I do **not** recommend generating 45+ native `.agent.md` files as the first move. That would create a huge selection surface without solving the real runtime orchestration gap. The 32 team agents and many specialists are better treated as domain personas under the Squad routing layer unless you have a strong product reason to make each one independently invocable in GitHub UI.[^6][^18][^19]

### A4. Finish the `@copilot` issue-assignment wiring

Update `squad-issue-assign.yml` so `agent_assignment` passes:

- `custom_agent: 'squad'` (or another intentional native agent)
- non-empty `custom_instructions`
- an explicit model when appropriate

Today those fields are empty in the direct assignment workflow.[^21] The heartbeat workflow proves the pattern by already passing custom instructions pointing back at `.squad/team.md` and `.squad/routing.md`.[^22]

## Plan B — The Full Ideas → PanelDiscussion → Article → Publish Pipeline

This is the most important recommendation.

The intended product is **not** a brief bridge. It is a first-class content production pipeline with five distinct stages, team-scoped across all 32 NFL teams, with configurable automation at every gate.

### The Pipeline (per team × 32)

```text
  IDEATION              PANEL DISCUSSION        WRITING             EDITING             PUBLISHING
  Media + Editor        PanelDiscussion         Writer              Editor              Publisher
  generate Ideas        (first-class artifact)  drafts Article      reviews/edits       schedules &
  | catchy title        | discussion prompt     from discussion     Article             publishes to
  | topic area          | 2–4 expert panel      transcript +        | verdict:          Substack
  | teams[]             | transcript +          agent outputs       | approve/revise/   | timing
  | pub date/range      | agent_outputs                             | reject            | auto-publish
  | angle/thesis        | disagreements                             | revision loop     | sanity checks
```

### Stage Details

**1. Ideation (Media + Editor)**
- Media and Editor generate **Ideas**: possible Substack topics with catchy titles.
- Each Idea has a topic area suited for cross-expert discussion; can intentionally favor strong disagreement.
- Includes optional recommended publish date/date range, or can be left open-ended.
- Ideas are team-scoped (`teams[]` array, `primary_team`). All 32 NFL teams are first-class citizens.
- Sources can also include sweep (automated transaction discovery), manual creation, or import.

**2. Panel Discussion (Expert Agents)**
- An Idea spawns a **PanelDiscussion** — a first-class persisted artifact, not throwaway intermediate state.
- A discussion prompt is generated (or written manually) from the Idea metadata.
- The panel is selected via `.squad/routing.md` — typically 2–4 expert agents per topic.[^19][^20]
- Experts produce structured outputs: summary, position, key claims, confidence, sources. Disagreements are tracked explicitly.
- The transcript and `agent_outputs` JSON are stored in the `discussions` table and are queryable, versionable, and auditable.[^26]

**3. Writing (Writer)**
- Writer turns the PanelDiscussion into a polished **Article** — Substack-ready markdown.
- Uses the structured transcript and per-agent outputs as source material.
- Produces a complete draft with attribution to expert analysis.

**4. Editing (Editor)**
- Editor reviews the Article with a structured report: errors (critical/major/minor), suggestions (style/accuracy/structure/sourcing), and a verdict (approve/revise/reject).
- Revision loop: `revise` sends the article back to Writer for another pass.
- **Hard gate:** No article reaches publish-ready without Editor approval.

**5. Publishing (Publisher)**
- A distinct **Publisher** role handles the final Substack release.
- Manages timing and scheduling — especially important for auto-publish cases where articles should drop at optimal times.
- Sanity checks before publish: title, subtitle, body length, team tags, metadata completeness.
- Can be configured for manual publish (human clicks button) or auto-publish (article advances automatically after Editor approval + optional delay).

### Stage Transition Configuration

Every stage gate can be configured as **auto-advance** or **human-gated**:

| Gate | Auto-Advance Behavior | Human-Gated Behavior |
|------|----------------------|---------------------|
| Idea → PanelDiscussion | Discussion prompt generated and panel spawned automatically | Human reviews Idea and clicks "Run Discussion" |
| PanelDiscussion → Article | Writer drafts immediately on discussion completion | Human reviews discussion and triggers "Write Article" |
| Article → Editor Review | Editor runs automatically on draft completion | Human triggers editorial review |
| Editor Approved → Publish | Publisher auto-schedules per Idea's recommended date | Human reviews editor report and clicks "Publish" |

**MVP default:** Human-gated everywhere. Auto-advance is opt-in per Idea or per global config. The dashboard must support both modes cleanly.

### Dashboard: Modern, Not Constrained

The dashboard should be **redesigned from scratch** to serve this pipeline. The current Jobs/queue UI was built for the brief-paste workflow and should not constrain the new design.

The new dashboard needs:
- **Team-scoped pipeline views** — see all Ideas/Discussions/Articles for a given team, or across all 32 teams.
- **Stage indicators** — visual pipeline showing where each Idea is in its lifecycle.
- **Approval gates** — clear approve/reject/advance controls at each human-gated stage.
- **Auto-advance configuration** — per-Idea or global toggle for each stage gate.
- **Discussion viewer** — read panel transcripts with per-agent attribution, disagreement highlighting.
- **Publish scheduler** — calendar/timeline view for upcoming publishes across teams.

The existing Jobs view can be preserved as "Legacy Queue" during transition, but the new pipeline view should be the primary experience.

### Why not use GitHub coding agent as the runtime discussion engine?

Because GitHub coding agent is designed for **issue/PR-driven software tasks** in ephemeral Actions environments, not for synchronous or high-frequency application runtime calls.[^5][^16]

It is excellent for repo issues, coding tasks, refactors, tests, docs, and background development work. It is not the right abstraction for "generate panel transcript now" or "do this repeatedly as part of the product runtime."

So the plan is **not** to scrap Squad; it is to **separate development orchestration from product orchestration**. Squad metadata (`.squad/routing.md`, charters, skills) feeds the product pipeline's panel selection and expert prompts. GitHub-native Copilot features handle repo work.

## Recommended End State

```text
Development plane
-----------------
GitHub Issues / PRs
   -> sync-squad-labels / triage / heartbeat
   -> @copilot for good-fit coding tasks
   -> Squad custom agent for multi-agent repo work

Product plane (per team × 32)
-----------------------------
Media + Editor → Ideas (catchy titles, cross-expert topics, pub dates)
   -> PanelDiscussions (discussion prompt → 2–4 experts via .squad routing)
   -> Writer (discussion → polished article draft)
   -> Editor (structured review, revision loop, hard approval gate)
   -> Publisher (timing, scheduling, auto-publish config, Substack release)

Dashboard: modern pipeline view with team-scoped lanes,
           configurable auto-advance / human-gated per stage
```

That is the cleanest way to leverage Pro+, the Squad files, and the 45+ agent map without forcing GitHub coding agent into a job it was not designed to do.[^5][^16][^26]

## Verdict

### What is possible today

- Use Copilot Pro+ to run **Squad as a top-level repo custom agent**.[^1][^2][^6]
- Use GitHub workflows plus `@copilot` to automate **issue triage, assignment, and coding tasks**.[^3][^4][^21][^22]
- Use `.squad/team.md`, `.squad/routing.md`, charters, and decisions as the **source of truth for routing and memory**.[^18][^19]

### What is not actually implemented today

- 45+ native GitHub custom agents selectable from `.github/agents`.[^2][^6]
- Native Copilot skill discovery for the repo's `.squad/skills` content.[^7][^8][^17][^23]
- The Ideas → PanelDiscussion → Article → Publish pipeline described above.[^9][^10][^11][^12]
- Media + Editor as Idea generators (currently sweep is the only automated source).[^9][^10]
- PanelDiscussions as first-class persisted artifacts (currently no discussion objects exist).[^11][^12]
- A Publisher role for Substack timing/scheduling/auto-publish.[^12]
- Configurable auto-advance vs human-gated stage transitions.[^12]
- A modern, team-scoped pipeline dashboard (current dashboard is built for the brief-paste workflow).
- Fully wired `@copilot` assignment that always invokes your intended custom agent/profile/model.[^21][^22]

### My recommendation

Do **not** scrap the Squad files. They are useful and already encode the domain model, routing map, and memory structure you want.[^18][^19][^20]

But do **stop pretending that the current brief generator equals a live 45+ agent runtime**. It does not.[^9][^10][^11][^12]

The correct plan is:

1. **Use Pro+ and GitHub-native Copilot features immediately for development orchestration.**
2. **Promote selected instructions/skills into `.github/*` so native Copilot can discover them.**
3. **Build the full Ideas → PanelDiscussion → Article → Publish pipeline** with Media + Editor as Idea generators, PanelDiscussions as first-class artifacts, Writer/Editor/Publisher as distinct pipeline roles, configurable auto-advance at every gate, and a modern team-scoped dashboard.[^7][^8][^14][^26]
4. **Scope everything per team (all 32).** The `teams[]` array on Ideas and the `idea_teams` junction table make team-scoped pipeline views, filtering, and routing a first-class capability from day one.

That path lets you fully exploit the 45+ agent roster **as a routing and memory system**, while keeping native Copilot features focused on what they are best at: issue automation, code generation, background repo work, and reusable repo intelligence.[^5][^13][^16]
## Confidence Assessment

**Certain**

- The repo has one native custom agent in `.github/agents/squad.agent.md` and many non-native Squad personas under `.squad/agents/*`.[^1][^2][^17][^18]
- Native Copilot skill discovery expects `.github/skills` / `.claude/skills`, not `.squad/skills`.[^7][^8]
- The current article pipeline generates and stores briefs, then relies on human handoff to Writer/Editor instead of live automated discussion orchestration.[^9][^10][^11][^12]
- GitHub workflows already parse `.squad/team.md` to sync labels, triage work, and optionally assign `@copilot`.[^3][^4][^21][^22]

**High-confidence inference**

- Treating GitHub coding agent as the synchronous product-runtime discussion engine would be a poor fit, because the official model is issue/PR/background work in ephemeral GitHub Actions environments rather than app-runtime invocation.[^5][^16]
- Creating 45+ first-class native `.agent.md` files is lower-value than keeping a smaller operational set of native agents and letting Squad orchestrate the long-tail expert personas via metadata.[^6][^18][^19][^20]

**Open / needs implementation proof**

- The exact runner technology for the future Discussion Runner (CLI subprocess, API-backed orchestrator, or another bridge) is still a design/implementation choice.
- The cost envelope for repeated article discussions will depend on the chosen model mix and how often the system invokes premium-model work.

## Footnotes

[^1]: `C:\github\nfl-eval\.github\agents\squad.agent.md:95-134, 211-254`.
[^2]: `C:\github\nfl-eval\.github\agents` directory listing shows only `squad.agent.md`; `C:\github\nfl-eval\.github` directory listing shows only `agents` and `workflows`.
[^3]: `C:\github\nfl-eval\.github\workflows\sync-squad-labels.yml:20-60, 106-169`.
[^4]: `C:\github\nfl-eval\.github\workflows\squad-triage.yml:25-40, 42-67, 118-240`.
[^5]: GitHub Docs, "About GitHub Copilot coding agent," https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent .
[^6]: GitHub Docs, "Creating custom agents for Copilot coding agent," https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-custom-agents .
[^7]: GitHub Docs, "Creating agent skills for GitHub Copilot CLI," https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-skills .
[^8]: GitHub Docs, "About agent skills," https://docs.github.com/en/copilot/concepts/agents/about-agent-skills .
[^9]: `C:\github\nfl-eval\src\content-brief.js:1-15, 128-211, 261-340`.
[^10]: `C:\github\nfl-eval\src\server.js:172-206`.
[^11]: `C:\github\nfl-eval\scripts\job-processor.js:17-20, 119-141`.
[^12]: `C:\github\nfl-eval\BACKEND.md:35-44, 46-50, 122-131, 217-220, 259-263`.
[^13]: GitHub Docs, "Plans for GitHub Copilot," https://docs.github.com/en/copilot/get-started/plans .
[^14]: GitHub Docs, "Using GitHub Copilot CLI," https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli .
[^15]: GitHub Docs, "Adding repository custom instructions for GitHub Copilot," https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions .
[^16]: GitHub Docs, "GitHub Copilot premium requests," https://docs.github.com/en/billing/concepts/product-billing/github-copilot-premium-requests .
[^17]: `C:\github\nfl-eval\.github` directory listing; `C:\github\nfl-eval\.github\agents` directory listing.
[^18]: `C:\github\nfl-eval\.squad\team.md:11-129`.
[^19]: `C:\github\nfl-eval\.squad\routing.md:5-37, 54-83, 84-99`.
[^20]: `C:\github\nfl-eval\.squad\skills\substack-article\SKILL.md:19-32, 34-62, 135-153, 164-169, 183-191`.
[^21]: `C:\github\nfl-eval\.github\workflows\squad-issue-assign.yml:116-160`.
[^22]: `C:\github\nfl-eval\.github\workflows\squad-heartbeat.yml:266-309`.
[^23]: `C:\github\nfl-eval\.squad\skills` directory listing; `C:\github\nfl-eval\.github` directory listing.
[^24]: `C:\github\nfl-eval\.squad\templates\copilot-instructions.md:1-46`.
[^25]: `C:\github\nfl-eval\.squad\config.json:1-4`.
[^26]: `C:\Users\jdl44\.copilot\session-state\974b6ddc-5ffe-4821-9c9c-31fc5bef6d94\plan.md:21-31, 55-105, 108-132, 214-250`.
