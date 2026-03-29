# NFL Content Intelligence Platform

A v2 TypeScript platform for planning, drafting, reviewing, and publishing NFL content.

## Overview

This repository now centers on a real application stack:

- **TypeScript** application under `src/`
- **Hono + HTMX** dashboard for the editorial workstation
- **SQLite** repository for pipeline state, artifacts, stage runs, and usage tracking
- **Multi-provider LLM gateway** with pluggable providers and stage-aware model routing
- **Service integrations** for Substack, Twitter/X, image generation, and NFL data ingestion

The original v1 markdown-first system has been removed (available in git history for reference).

## Quick Start

### Prerequisites

- Node.js 22+
- npm
- One LLM option:
  - **Copilot** via `GITHUB_TOKEN` or `gh auth login`
  - **LM Studio** via local OpenAI-compatible server
  - **Mock** via `MOCK_LLM=1`

### First run

```bash
npm install
npm run v2:init
npm run v2:serve
```

Open `http://localhost:3456`.

Use `npm run v2:serve` for source-mode development and `npm run v2:start` only after `npm run v2:build` has produced `dist/`.

On Windows, `.\dev.ps1` defaults to source-mode startup (`npm run v2:serve`), so you do not need to rebuild first. If you specifically want the built path, run `.\dev.ps1 -Built`; it will run `npm run v2:build` immediately before `npm run v2:start`. If you want to inspect the two repo-local MCP stdio servers during local development, use:

```powershell
.\dev.ps1 -WithMcp
```

That opens separate PowerShell windows for `npm run mcp:server` and `npm run v2:mcp` while the dashboard stays in your current shell. Leave `-WithMcp` off for normal work: Copilot and other repo-local MCP clients should still launch those stdio servers on demand from `.copilot\mcp-config.json` / `.mcp.json`.

### Production-style run

```bash
npm install
npm run v2:build
npm run v2:start
```

### Common environment variables

Copy `.env.sample` to `.env` and fill in only the integrations you need.

Core runtime:

- `NFL_DATA_DIR` — overrides the default data directory (`~/.nfl-lab`)
- `NFL_PORT` — dashboard port (default `3456`)
- `NFL_LEAGUE` — league code (default `nfl`)
- `NFL_CONTEXT_PRESET` — article context preset: `rich` (default) or `balanced`

LLM selection:

- `MOCK_LLM=1` — force the mock provider for tests and local UI work
- `LLM_PROVIDER=lmstudio` — prefer LM Studio
- `LMSTUDIO_URL` — LM Studio base URL, default `http://localhost:1234/v1`
- `LMSTUDIO_MODEL` — optional LM Studio default model override
- `GITHUB_TOKEN` — GitHub Models / Copilot auth when using the Copilot provider
- `COPILOT_CLI_MODE` — `none` (default, text-only) or `article-tools` (guarded web search + repo MCP for Copilot CLI only)
- `COPILOT_CLI_WEB_SEARCH` — set to `0` to disable Copilot CLI web search access (default enabled)
- `COPILOT_CLI_MCP_CONFIG` — override the repo-scoped Copilot MCP config file (default `.copilot/mcp-config.json`)
- `COPILOT_CLI_SESSION_REUSE` — opt into the guarded Copilot session-reuse experiment; currently traces the request and falls back to one-shot mode

Optional service integrations:

- `GEMINI_API_KEY` — image generation
- `SUBSTACK_TOKEN`
- `SUBSTACK_PUBLICATION_URL`
- `TWITTER_API_KEY`

Dashboard auth:

- `DASHBOARD_AUTH_MODE` — `off` (default) or `local`
- `DASHBOARD_AUTH_USERNAME` — required when `DASHBOARD_AUTH_MODE=local`
- `DASHBOARD_AUTH_PASSWORD` — required when `DASHBOARD_AUTH_MODE=local`
- `DASHBOARD_SESSION_COOKIE` — optional cookie name override
- `DASHBOARD_SESSION_TTL_HOURS` — session lifetime, default `24`

The app loads `.env` from both the repo root and `~/.nfl-lab/config/.env`.

### Dashboard auth

The dashboard stays open by default so existing tests and solo local development continue to work. For any shared box or public deployment, enable:

```bash
DASHBOARD_AUTH_MODE=local
DASHBOARD_AUTH_USERNAME=operator
DASHBOARD_AUTH_PASSWORD=change-me
NODE_ENV=production
```

That switches the dashboard to a simple local login flow backed by SQLite sessions and an `httpOnly` cookie. Protected dashboard pages, HTMX endpoints, JSON APIs, SSE, and unpublished image routes require a valid session. Static assets, `/login`, and published image URLs remain public.

## Architecture

```text
Dashboard (Hono + HTMX)
  -> Pipeline Engine (state machine)
    -> Agent Runner
      -> LLM Gateway
        -> Providers (Copilot, LM Studio, Mock, others)

SQLite Repository
  -> articles
  -> artifacts
  -> stage transitions / stage runs
  -> editor reviews / publisher pass
  -> usage events and cost tracking

Services
  -> Substack
  -> Twitter/X
  -> Image generation
  -> Data (nflverse and related sources)
```

### Layer summary

- **Dashboard**: server-rendered editorial UI in `src/dashboard/`
- **Pipeline Engine**: stage transition rules and validation in `src/pipeline/`
- **Agent Runner**: loads charters, skills, and memory for article work
- **Agent Runner tool loop**: app-managed JSON tool calling for in-app agents, with bounded retries and trace capture
- **LLM Gateway**: resolves models and routes requests across providers
- **Repository**: SQLite-backed persistence in `src/db/`
- **Services**: outbound publishing, media generation, and data adapters in `src/services/`

## Configuration

### LLM providers

The v2 dashboard can run with different providers:

- **Copilot** — default when GitHub auth is available
- **LM Studio** — local OpenAI-compatible endpoint
- **Mock** — deterministic test/development provider

The broader gateway also includes additional provider implementations under `src/llm/providers/`.

### Model routing

Stage-aware routing lives in:

- `~/.nfl-lab/config/models.json`

`ModelPolicy` uses that file to resolve stage defaults, depth-aware panel sizing, token budgets, and tier precedence before requests hit the gateway.

### Agent charters and skills

Agent knowledge is loaded from the data directory at runtime. On a fresh install, `npm run v2:init` seeds default charters, skills, and bootstrap memory.

Skills can also advertise tool groups in frontmatter. The runtime resolves those through a shared registry used by both the in-app `AgentRunner` and the MCP surfaces, so dashboard/pipeline agents and MCP clients see the same tool catalog.

- Charters: `~/.nfl-lab/agents/charters/{league}/` — agent identity and boundaries
- Skills: `~/.nfl-lab/agents/skills/` — workflow instructions and output formats
- Memory: `~/.nfl-lab/agents/memory.db` — persistent learnings, decisions, and domain knowledge

See **[docs/knowledge-system.md](docs/knowledge-system.md)** for the full knowledge architecture, bootstrap process, and multi-league extensibility guide.

The repo also includes a proof-of-concept structured knowledge slice for issue #85:

- Glossary seeds: `src/config/defaults/glossaries/`
- Team identity sheets: `content/data/team-sheets/`

## Dashboard Pages

The editorial dashboard includes:

- **Home** (`/`) — ready-to-publish queue, pipeline summary, recent ideas, recent publishing activity, filters
- **Article Detail** (`/articles/:id`) — stage timeline, action panel, artifacts, runs, usage, metadata, publisher checks
- **New Idea** (`/ideas/new`) — prompt-driven article creation with team selection and optional auto-advance
- **Config** (`/config`) — active provider, model routing, charters, skills, and env var status
- **Agents** (`/agents`) — charter and skill browser
- **Memory** (`/memory`) — agent memory browser with filters, CRUD, prune/decay
- **Runs** (`/runs`) — filterable execution history for stage runs

## Pipeline Stages

Every article moves through the same eight-stage pipeline:

1. **Idea Generation** — create the article concept and metadata
2. **Discussion Prompt** — generate the central framing question
3. **Panel Composition** — choose the right experts/agents for the topic
4. **Panel Discussion** — gather the core analysis and disagreements
5. **Article Drafting** — turn analysis into a draft
6. **Editor Pass** — review for accuracy, issues, and revision needs
7. **Publisher Pass** — finalize metadata and prep for publication
8. **Published** — live on the target publication

## Repository Layout

```text
src/
  agents/       Agent runner + memory integration
  cli/          CLI helpers and export logic
  config/       App config + seeded defaults
  dashboard/    Hono server, HTMX handlers, views, SSE
  db/           SQLite repository and artifact store
  llm/          Gateway, model policy, providers
  migration/    v1 -> v2 migration support
  pipeline/     Engine, scheduler, actions, audit
  services/     Substack, Twitter, image, markdown, data
.squad/         Squad team config, agent charters, decisions, skills
mcp/            Legacy/local MCP entrypoints and smoke tests
tests/          Unit, integration, and e2e coverage
ralph-watch.ps1 Local Ralph outer loop (PowerShell)
```

## Services and MCP Tools

Runtime and publishing integrations live in `src/services/`.

Key areas:

- **Substack** publishing workflows
- **Twitter/X** promotion support
- **Image generation** and render helpers
- **Data services** for nflverse-backed analysis
- **MCP tooling** via `npm run v2:mcp` and legacy tooling under `mcp/`

The current tool stack uses one shared catalog:

- `src/agents/local-tools.ts` — in-process executor and tool filtering for in-app agent runs
- `src/tools/pipeline-tools.ts` — pipeline tool definitions shared with the v2 MCP server
- `mcp/local-tool-registry.mjs` — extension-backed local tool registry shared by the legacy/local MCP server

For the legacy extension-oriented MCP tooling, see [`.github/extensions/README.md`](.github/extensions/README.md).
For the main dashboard runtime, prefer the v2 CLI commands over the archived v1 `dashboard` scripts in `package.json`.

## Development

### Commands

```bash
npm test
npm run v2:test
npm run v2:build
npm run v2:dev
npm run v2:status
```

### Retrospective digest workflow

Use the manual retrospective digest when you want to mine recent article retrospectives into bounded, human-reviewable follow-up work.

```bash
npx tsx src/cli.ts retrospective-digest --limit 25
npx tsx src/cli.ts retro-digest --json --limit 10
```

- Reads structured data from `article_retrospectives` and `article_retrospective_findings`
- Produces a bounded digest with:
  - issue-ready process-improvement candidates
  - learning-update candidates
  - grouped supporting evidence by role + finding type
- Stays read-only in v1: review the output first, then manually turn approved items into GitHub issues or decision/knowledge updates
- Use `--json` when you want the same bounded report shape for downstream tooling or copy/paste review
- Use `--limit N` to control how many recent retrospectives are scanned

Recommended operator loop:

1. Run the digest on demand after a meaningful batch of recent article completions.
2. Review the promoted candidate sections before the grouped evidence section.
3. Manually promote approved process changes into issues and reusable learnings into team docs/decision inbox entries.

### Test layout

- `tests/llm/` — provider, routing, and model policy tests
- `tests/pipeline/` — state machine and transition behavior
- `tests/dashboard/` — rendering and endpoint coverage
- `tests/e2e/` — end-to-end article workflow behavior

Run the full suite with:

```bash
npx vitest run
```

## Squad — AI Team Coordination

This project uses [Squad](https://github.com/features/copilot) to coordinate a team of AI agents that manage the issue backlog, write code, and move the project board.

### Team Roster

| Agent | Role | Scope |
|-------|------|-------|
| **Lead** | Triage & architecture | Coordination, cross-functional work, design decisions |
| **Code** | Core developer | TypeScript, Hono, vitest, code reviews, refactoring |
| **Data** | Data engineer | nflverse queries, Python, NFL analytics, statistical analysis |
| **Publisher** | Content distribution | Substack publishing, Twitter/X, Markdown→HTML |
| **Research** | Documentation & analysis | Tech research, knowledge management, reports |
| **DevOps** | Infrastructure | GitHub Actions, CI/CD, MCP tools, `.github/extensions/` |
| **UX** | Dashboard & frontend | HTMX views, SSE, CSS, user experience |
| **Ralph** | Work monitor | Issue queue scanning, project board automation, heartbeat |
| **Scribe** | Session logger | Decisions, meeting notes, cross-agent context |

Agent charters live in `.squad/agents/*/charter.md`. Routing rules are in `.squad/routing.md`.

> **Note:** These Squad agents handle _project coordination_. The 47 article pipeline agents in `src/config/defaults/charters/nfl/` are a separate system loaded by the pipeline engine for content production.

### GitHub Issues + Project Board

Issues are the task system. Create an issue with the `squad` label and the team handles the rest.

**Project board:** [github.com/users/JDL440/projects/1](https://github.com/users/JDL440/projects/1)

| Status | Meaning |
|--------|---------|
| **Todo** | New work ready to start |
| **In Progress** | Agent actively working on it |
| **Pending User** | Needs human decision or input |
| **Blocked** | Cannot proceed (blocker in comments) |
| **For Review** | PR created, ready for review |
| **Done** | Completed and merged |

**Labels for routing:**

| Label | Routes to |
|-------|-----------|
| `squad` | General — Lead triages |
| `squad:code` | Code agent |
| `squad:data` | Data agent |
| `squad:publisher` | Publisher agent |
| `squad:research` | Research agent |
| `squad:devops` | DevOps agent |
| `squad:ux` | UX agent |
| `squad:ralph` | Ralph (work monitor) |
| `squad:lead` | Lead agent |
| `squad:scribe` | Scribe agent |

### Talking With Your Squad

Every agent writes comments on the issue thread — analysis, questions, progress updates. Each comment starts with a **TLDR** so you can skim.

Workflow:
1. Read the TLDR
2. Reply with instructions or guidance in the issue comments
3. Set status back to "Todo" if more work is needed
4. The agent picks it up on the next Ralph cycle

### The Ralph Loop

Ralph watches the issue queue and spawns agents for actionable work. Two modes:

**Local (PowerShell):**

```powershell
.\ralph-watch.ps1
```

- Runs every 5 minutes with a system-wide mutex guard (single instance)
- Pulls latest code before each round
- Spawns `copilot --agent squad` with a parallelism-maximizing prompt
- Structured logging to `~/.squad/ralph-watch.log`
- Heartbeat file at `~/.squad/ralph-heartbeat.json`

**GitHub Actions:**

The `squad-heartbeat.yml` workflow runs on a cron schedule (`*/30 * * * *`) to scan for untriaged issues, auto-route to agents, and reconcile the pipeline.

### Creating Tasks

Create an issue with:
- A descriptive title
- The `squad` label (or a specific `squad:*` label for direct routing)
- Optionally: `priority:p0` / `priority:p1` / `priority:p2`
- Optionally: `type:bug` / `type:feature` / `type:chore` / `type:docs`

That's it. Ralph picks it up, assigns the right agent, moves the board, and reports back.

### Squad File Layout

```text
.squad/
  team.md              Team roster (parsed by workflows for label routing)
  routing.md           Keyword → agent routing rules
  decisions.md         Append-only decision ledger
  ceremonies.md        Team rituals and cadences
  agents/
    lead/charter.md    Agent identity, scope, and behavior rules
    code/charter.md
    data/charter.md
    devops/charter.md
    publisher/charter.md
    research/charter.md
    ux/charter.md
    ralph/charter.md
    scribe/charter.md
  skills/
    github-project-board/SKILL.md   Project board status workflow + IDs
  casting/             Agent creation/retirement registry
  identity/            Team identity state
  log/                 Append-only activity log
  orchestration-log/   Cross-agent coordination log
```

## History

The original v1 implementation has been removed from the working tree (available in git history for reference). All active development targets the v2 TypeScript application in `src/`.
