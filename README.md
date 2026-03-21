# NFL Content Intelligence Platform

A v2 TypeScript platform for planning, drafting, reviewing, and publishing NFL content.

## Overview

This repository now centers on a real application stack:

- **TypeScript** application under `src/`
- **Hono + HTMX** dashboard for the editorial workstation
- **SQLite** repository for pipeline state, artifacts, stage runs, and usage tracking
- **Multi-provider LLM gateway** with pluggable providers and stage-aware model routing
- **Service integrations** for Substack, Twitter/X, image generation, and NFL data ingestion

The original v1 markdown-first system has been preserved in **`archive/v1/`** for reference.

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

### Production-style run

```bash
npm install
npm run v2:build
npm run v2:start
```

### Common environment variables

Core runtime:

- `NFL_DATA_DIR` — overrides the default data directory (`~/.nfl-lab`)
- `NFL_PORT` — dashboard port (default `3456`)
- `NFL_LEAGUE` — league code (default `nfl`)

LLM selection:

- `MOCK_LLM=1` — force the mock provider for tests and local UI work
- `LLM_PROVIDER=lmstudio` — prefer LM Studio
- `LMSTUDIO_URL` — LM Studio base URL, default `http://localhost:1234/v1`
- `LMSTUDIO_MODEL` — optional LM Studio default model override
- `GITHUB_TOKEN` — GitHub Models / Copilot auth when using the Copilot provider

Optional service integrations:

- `GEMINI_API_KEY` — image generation
- `SUBSTACK_TOKEN`
- `SUBSTACK_PUBLICATION_URL`
- `TWITTER_API_KEY`

The app loads `.env` from both the repo root and `~/.nfl-lab/config/.env`.

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

- Charters: `~/.nfl-lab/agents/charters/{league}/` — agent identity and boundaries
- Skills: `~/.nfl-lab/agents/skills/` — workflow instructions and output formats
- Memory: `~/.nfl-lab/agents/memory.db` — persistent learnings, decisions, and domain knowledge

See **[docs/knowledge-system.md](docs/knowledge-system.md)** for the full knowledge architecture, bootstrap process, and multi-league extensibility guide.

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
mcp/            Legacy/local MCP entrypoints and smoke tests
tests/          Unit, integration, and e2e coverage
archive/v1/     Archived v1 source and docs
```

## Services and MCP Tools

Runtime and publishing integrations live in `src/services/`.

Key areas:

- **Substack** publishing workflows
- **Twitter/X** promotion support
- **Image generation** and render helpers
- **Data services** for nflverse-backed analysis
- **MCP tooling** via `npm run v2:mcp` and legacy tooling under `mcp/`

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

### Test layout

- `tests/llm/` — provider, routing, and model policy tests
- `tests/pipeline/` — state machine and transition behavior
- `tests/dashboard/` — rendering and endpoint coverage
- `tests/e2e/` — end-to-end article workflow behavior

Run the full suite with:

```bash
npx vitest run
```

## v1 Archive

The original v1 implementation is preserved in **`archive/v1/`**.

Use it only as historical reference for:

- legacy dashboard files
- older MCP setup docs
- archived article and workflow experiments
- migration context while validating v2 behavior

All active development should target the v2 TypeScript application in `src/`.
