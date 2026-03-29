# NFL Content Intelligence Platform — v2 Architecture Research & Replatforming Plan

## Executive Summary

The NFL Content Intelligence Platform (nfl-eval) has proven its core thesis — 47 specialized AI agents can produce expert-grade NFL analysis that rivals human beat writers. However, the current architecture has severe structural limitations: it is tightly coupled to GitHub Copilot CLI as both the runtime and orchestrator, mixes data and source code in a single Git repository, embeds editorial rules in LLM prompts rather than deterministic code, and cannot be deployed to a server for autonomous operation[^1][^2]. This report catalogs every subsystem, identifies what must be preserved versus rebuilt, and proposes a v2 architecture that separates data from source, encodes business logic deterministically, treats LLMs as pluggable content generators, supports both local development and VM-hosted production, and provides a rich web dashboard for pipeline management.

---

## Table of Contents

1. [Current Architecture Inventory](#1-current-architecture-inventory)
2. [Structural Problems](#2-structural-problems)
3. [What to Preserve (Proven Assets)](#3-what-to-preserve-proven-assets)
4. [v2 Architecture Overview](#4-v2-architecture-overview)
5. [Component Deep-Dives](#5-component-deep-dives)
6. [LLM Abstraction Layer](#6-llm-abstraction-layer)
7. [Data Separation Strategy](#7-data-separation-strategy)
8. [Deterministic Logic Extraction](#8-deterministic-logic-extraction)
9. [Dashboard v2](#9-dashboard-v2)
10. [Migration Strategy](#10-migration-strategy)
11. [Cost & Infrastructure](#11-cost--infrastructure)
12. [Confidence Assessment](#12-confidence-assessment)

---

## 1. Current Architecture Inventory

### 1.1 System Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CURRENT ARCHITECTURE (v1)                           │
│                                                                            │
│  ┌──────────────────┐     ┌──────────────────┐    ┌────────────────────┐  │
│  │  GitHub Copilot   │────▶│  Squad Coordinator│───▶│ Agent Charters     │  │
│  │  CLI (runtime)    │     │  (.github/agents)  │    │ (.squad/agents/*)  │  │
│  └──────────────────┘     └──────────────────┘    └────────────────────┘  │
│          │                        │                        │               │
│          ▼                        ▼                        ▼               │
│  ┌──────────────────┐     ┌──────────────────┐    ┌────────────────────┐  │
│  │  MCP Server       │     │ Skill Documents   │    │ Article Artifacts  │  │
│  │  (mcp/server.mjs) │     │ (.squad/skills/*) │    │ (content/articles) │  │
│  └──────────────────┘     └──────────────────┘    └────────────────────┘  │
│          │                                                 │               │
│          ▼                                                 ▼               │
│  ┌──────────────────┐     ┌──────────────────┐    ┌────────────────────┐  │
│  │  Extensions       │     │ pipeline.db       │    │ Dashboard          │  │
│  │  (.github/ext/*) │     │ (content/)        │    │ (dashboard/)       │  │
│  └──────────────────┘     └──────────────────┘    └────────────────────┘  │
│          │                        │                                        │
│          ▼                        ▼                                        │
│  ┌──────────────────┐     ┌──────────────────┐                            │
│  │  Python Scripts   │     │ Substack API      │                           │
│  │  (content/data/*) │     │ (shared/*.mjs)    │                           │
│  └──────────────────┘     └──────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Census

| Component | Language | Files | Location | Purpose |
|-----------|----------|-------|----------|---------|
| **MCP Server** | Node.js (ESM) | 2 | `mcp/` | Tool aggregation via MCP protocol[^3] |
| **Extensions** | Node.js (ESM) | 12 | `.github/extensions/` | Image gen, table render, Substack publish, nflverse query, prediction markets[^4] |
| **Dashboard** | Node.js (ESM) | 8 | `dashboard/` | Pipeline board, article detail, preview, publish, validation[^5] |
| **Shared Libs** | Node.js (ESM) | 6 | `shared/` | Substack API, ProseMirror, Twitter, session[^6] |
| **Pipeline DB** | SQLite | 1 + schema | `content/pipeline.db` | Article stage tracking, transitions, reviews, usage events[^7] |
| **Pipeline State** | Python | 1 (1000+ lines) | `content/pipeline_state.py` | CLI for all DB mutations — advance stage, record reviews, set URLs[^8] |
| **Article Board** | Python | 1 (500+ lines) | `content/article_board.py` | Artifact-first stage inference from filesystem[^9] |
| **Model Policy** | Python | 1 (318 lines) | `content/model_policy.py` | LLM model selection by stage/task family[^10] |
| **Data Queries** | Python (Polars) | 12 | `content/data/` | NFL stats from nflverse parquet cache[^11] |
| **Agent Charters** | Markdown | 47 dirs | `.squad/agents/` | Agent identity, knowledge, behavioral rules[^12] |
| **Skills** | Markdown | 23 dirs | `.squad/skills/` | Reusable workflow documents (article lifecycle, publishing, fact-checking)[^13] |
| **Ralph (Orchestrator)** | Markdown + JSON | 4 | `ralph/` | Autonomous pipeline loop prompt and config[^14] |
| **Article Content** | Markdown + images | 46+ dirs | `content/articles/` | All article artifacts (ideas, prompts, panels, drafts, reviews)[^15] |
| **One-off Scripts** | Node.js | ~15 | repo root | Batch publish, fix tables, validate, stage management[^16] |

### 1.3 Dependency Map

```
Runtime Dependencies:
  Node 22+ (node:sqlite, ESM)
  Python 3.10+ (polars, nflreadpy)
  Playwright (table rendering, validation)
  @modelcontextprotocol/sdk (MCP server)
  @github/copilot-sdk (legacy extension support)
  zod (schema validation)

External Services:
  Substack API (publishing, notes)
  Twitter/X API (promotion)
  Google Gemini API (image generation)
  nflverse (parquet data, auto-fetched)
  Polymarket Gamma API (prediction markets)

Orchestration:
  GitHub Copilot CLI (the ONLY runtime — cannot run headless)
  Squad agent system (.github/agents/squad.agent.md)
  Ralph loop (ralph/prompt.md — requires Copilot CLI)
```

---

## 2. Structural Problems

### 2.1 Copilot CLI Lock-in (Critical)

The entire orchestration layer is **implicit** — it exists as LLM prompts interpreted by GitHub Copilot CLI agents[^1]. There is no runnable orchestrator. The pipeline cannot advance without a human sitting at VS Code with Copilot CLI running.

**Evidence:**
- `ralph/prompt.md` is the "autonomous pipeline loop" — it's a markdown prompt, not executable code[^14]
- `.github/agents/squad.agent.md` is the coordinator — again, just a prompt[^17]
- Agent charters in `.squad/agents/*/charter.md` define behavior but have no executable equivalent[^12]
- The pipeline *looks like* it has 8 deterministic stages, but stage transitions are triggered by LLM agents reading markdown instructions

**Impact:** Cannot schedule automated pipeline runs. Cannot deploy to a server. Cannot run without Copilot Pro+ subscription.

### 2.2 Data/Source Entanglement (Critical)

Article content, pipeline state, agent history, and NFL intelligence data are all stored in the Git repository alongside source code[^15][^18].

**Files that are data, not source:**
- `content/pipeline.db` (SQLite database — 9 tables of pipeline state)[^7]
- `content/articles/*/` (46+ directories of markdown artifacts)[^15]
- `content/data/cache/` (parquet files from nflverse)
- `.squad/agents/*/history.md` (agent memory — 20K+ lines total)[^12]
- `.squad/log/` (100+ orchestration log files)[^18]
- `.squad/orchestration-log/` (130+ files)
- `dashboard/publish-results.json`, `dashboard/validation-results.json`

**Impact:** Git history bloated. Cannot share source without sharing data. Cannot have multiple environments. Merge conflicts on data files.

### 2.3 Business Logic in LLM Prompts (Critical)

Rules that should be deterministic code are instead written as natural language instructions that LLMs follow imperfectly:

| Rule | Current Location | Should Be |
|------|-----------------|-----------|
| Stage transition validation (1→2, 2→3, etc.) | Prompt in `ralph/prompt.md`[^14] | Deterministic state machine |
| Panel size by depth level (2/3-4/4-5) | Markdown in `SKILL.md`[^19] | Config + validation code |
| Editor verdict parsing (APPROVED/REVISE/REJECT) | Regex in `article_board.py`[^9] | ✅ Already code |
| Publisher pass checklist (13 boolean fields) | DB schema + dashboard UI[^7] | ✅ Already code |
| Article naming conventions | Markdown in project-conventions skill | Validation function |
| "Expert disagreement is the product" | Prompt in Writer charter | Quality scoring rubric |
| Model selection per stage | `model_policy.py`[^10] | ✅ Already code |
| Substack formatting rules | Markdown in `substack-publishing/SKILL.md` | ✅ ProseMirror code exists |

### 2.4 Mixed Language Runtime

The codebase splits between Node.js (ESM) and Python with no clear boundary:

- **Node.js:** Dashboard, MCP server, extensions, shared Substack/Twitter clients, ProseMirror pipeline
- **Python:** Pipeline state management, article board, model policy, all 12 nflverse data queries

The Node.js MCP tools shell out to Python scripts via `child_process.spawn`[^20]. The dashboard's `publish.mjs` calls `pipeline_state.py` via `spawnSync`[^21]. This creates fragile cross-process coupling.

### 2.5 One-off Script Proliferation

The repo root contains ~15 one-off scripts with names like `batch-publish-prod.mjs`, `fix-dense-tables.mjs`, `repair-prod-drafts.mjs`, `replace-stage-notes-v2.mjs`[^16]. These represent operational debt — they solved immediate problems but aren't part of a coherent system.

### 2.6 No Test Infrastructure

`package.json` has `"test": "echo \"Error: no test specified\" && exit 1"`[^22]. There are no automated tests for any component. The `mcp/smoke-test.mjs` is the only verification script.

---

## 3. What to Preserve (Proven Assets)

Not everything needs to be rewritten. These components have proven their value:

### 3.1 Keep As-Is (Port Directly)

| Asset | Why It's Proven | v2 Treatment |
|-------|----------------|--------------|
| `content/schema.sql` | Well-designed 9-table schema with audit trails[^7] | Migrate to proper data directory |
| `content/pipeline_state.py` (logic) | Robust DB mutation layer with validation[^8] | Rewrite in TypeScript as service |
| `content/article_board.py` (logic) | Artifact-first inference is architecturally sound[^9] | Rewrite as TypeScript module |
| `content/model_policy.py` | Clean model selection with task families[^10] | Port to TypeScript config |
| `shared/substack-prosemirror.mjs` | Battle-tested ProseMirror conversion[^6] | Keep, move to `src/services/` |
| `shared/substack-article.mjs` | Draft upsert logic works well | Keep, refactor into service |
| `shared/substack-session.mjs` | Auth/cookie handling proven in production | Keep |
| `content/data/*.py` queries | 12 working nflverse query scripts[^11] | Keep Python, formalize as service |
| Agent charters (47 files) | 20K+ lines of curated NFL knowledge[^12] | Migrate to data directory |
| `models.json` config | Clean task-family model resolution[^23] | Move to `config/` |

### 3.2 Keep the Concepts, Rebuild the Implementation

| Concept | Current Form | v2 Form |
|---------|-------------|---------|
| 8-stage pipeline | Markdown instructions + DB + artifact scan | Deterministic state machine in code |
| Expert panel discussions | LLM prompt → spawn agents → synthesize | Orchestrated LLM calls with structured output |
| Writer/Editor flow | Agent charters as behavior guides | Structured prompts with schema-validated output |
| Dashboard | Basic read-only HTML + publish | Full CRUD with real-time state, queue management |
| Ralph autonomous loop | Markdown prompt iterated by Copilot CLI | Job scheduler with deterministic advancement |

---

## 4. v2 Architecture Overview

### 4.1 Design Principles

1. **Data lives outside the source tree.** Article content, pipeline DB, agent knowledge, and analytics cache go in a configurable data directory (e.g., `~/.nfl-lab/` locally, `/data/nfl-lab/` on VM).
2. **Business rules are code, not prompts.** The state machine, validation rules, panel composition logic, and quality gates are deterministic TypeScript.
3. **LLMs are called services, not the runtime.** The system calls LLMs for content generation and review — it does not require an LLM to orchestrate itself.
4. **Single language for application code.** TypeScript (Node.js) for the application layer. Python data scripts remain as a sidecar service.
5. **Local-first, server-ready.** Runs via `npm start` locally; deploys to a $5-10/mo VM with a simple `docker compose up`.
6. **Copilot Pro+ stays in the loop.** Copilot CLI remains a first-class client for interactive work, but the system doesn't require it for operation.

### 4.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          v2 ARCHITECTURE                                    │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    APPLICATION SERVER (Node.js)                      │   │
│  │                                                                     │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │   │
│  │  │ Pipeline  │  │   LLM    │  │  Agent   │  │    Dashboard     │  │   │
│  │  │ Engine    │  │ Gateway  │  │  Runner  │  │    (Web UI)      │  │   │
│  │  │          │  │          │  │          │  │                  │  │   │
│  │  │ State    │  │ Copilot  │  │ Charter  │  │ Board view       │  │   │
│  │  │ Machine  │  │ Anthropic│  │ Parser   │  │ Article detail   │  │   │
│  │  │ Rules    │  │ OpenAI   │  │ Prompt   │  │ Preview          │  │   │
│  │  │ Engine   │  │ Gemini   │  │ Builder  │  │ Publish actions  │  │   │
│  │  │ Scheduler│  │ Local    │  │ Output   │  │ Queue management │  │   │
│  │  │          │  │          │  │ Parser   │  │ Analytics        │  │   │
│  │  └─────┬────┘  └─────┬────┘  └────┬─────┘  └────────┬─────────┘  │   │
│  │        │              │            │                  │            │   │
│  │        └──────────────┴────────────┴──────────────────┘            │   │
│  │                              │                                     │   │
│  │                    ┌─────────▼──────────┐                          │   │
│  │                    │   Service Layer    │                          │   │
│  │                    │                   │                          │   │
│  │                    │ SubstackService   │                          │   │
│  │                    │ TwitterService    │                          │   │
│  │                    │ ImageService      │                          │   │
│  │                    │ DataService       │                          │   │
│  │                    │ (nflverse proxy)  │                          │   │
│  │                    └─────────┬──────────┘                          │   │
│  └──────────────────────────────┼─────────────────────────────────────┘   │
│                                 │                                          │
│  ┌──────────────────────────────▼──────────────────────────────────────┐   │
│  │                       DATA LAYER (external)                         │   │
│  │                                                                     │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │   │
│  │  │ pipeline │  │ articles/│  │ nflverse │  │  agent           │  │   │
│  │  │ .db      │  │ artifacts│  │  cache/  │  │  knowledge/      │  │   │
│  │  │          │  │          │  │ (parquet)│  │  (charters +     │  │   │
│  │  │ SQLite   │  │ markdown │  │          │  │   history)       │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘  │   │
│  │                                                                     │   │
│  │  Location: $NFL_DATA_DIR (default: ~/.nfl-lab/ or /data/nfl-lab/)  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     EXTERNAL CLIENTS                                │   │
│  │                                                                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │   │
│  │  │ Copilot CLI  │  │ Web Browser  │  │  Cron / Scheduler        │ │   │
│  │  │ (MCP client) │  │ (Dashboard)  │  │  (automated pipelines)   │ │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Technology Choices

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Language** | TypeScript (ESM, Node 22+) | Unify the codebase; keeps `node:sqlite`, Playwright, ProseMirror |
| **HTTP Framework** | Hono or Fastify | Lightweight, fast, great TypeScript support |
| **Database** | SQLite (via `better-sqlite3` or `node:sqlite`) | Already proven; portable; no server needed |
| **Frontend** | htmx + Alpine.js (or React lite) | Server-rendered with progressive enhancement; keeps it simple |
| **LLM Clients** | Direct HTTP/SDK per provider | Copilot SDK, Anthropic SDK, OpenAI SDK, Google GenAI SDK |
| **Task Queue** | BullMQ (Redis) or simple in-process queue | Pipeline job scheduling and worker management |
| **Deployment** | Docker Compose | Single container (app) + optional Redis; runs on any $5 VM |
| **Python Sidecar** | FastAPI thin wrapper over existing query scripts | Keeps Polars/nflverse ecosystem; called via HTTP |

---

## 5. Component Deep-Dives

### 5.1 Pipeline Engine (New — The Heart of v2)

The Pipeline Engine replaces both `ralph/prompt.md` and the squad coordinator. It is **deterministic code, not an LLM prompt**.

```typescript
// src/pipeline/state-machine.ts

export const STAGES = {
  IDEA: 1,
  DISCUSSION_PROMPT: 2,
  PANEL_COMPOSITION: 3,
  PANEL_DISCUSSION: 4,
  ARTICLE_DRAFTING: 5,
  EDITOR_PASS: 6,
  PUBLISHER_PASS: 7,
  PUBLISHED: 8,
} as const;

export type Stage = typeof STAGES[keyof typeof STAGES];

interface TransitionRule {
  from: Stage;
  to: Stage;
  guard: (article: Article) => TransitionResult;
}

// Every transition is an explicit rule with a guard function
const TRANSITIONS: TransitionRule[] = [
  {
    from: STAGES.IDEA,
    to: STAGES.DISCUSSION_PROMPT,
    guard: (a) => requireArtifact(a, 'idea.md'),
  },
  {
    from: STAGES.DISCUSSION_PROMPT,
    to: STAGES.PANEL_COMPOSITION,
    guard: (a) => requireArtifact(a, 'discussion-prompt.md'),
  },
  {
    from: STAGES.PANEL_COMPOSITION,
    to: STAGES.PANEL_DISCUSSION,
    guard: (a) => requireArtifact(a, 'panel-composition.md') 
                   && requirePanelSize(a),
  },
  {
    from: STAGES.PANEL_DISCUSSION,
    to: STAGES.ARTICLE_DRAFTING,
    guard: (a) => requireArtifact(a, 'discussion-summary.md'),
  },
  {
    from: STAGES.ARTICLE_DRAFTING,
    to: STAGES.EDITOR_PASS,
    guard: (a) => requireArtifact(a, 'draft.md')
                   && requireNoPlaceholders(a),
  },
  {
    from: STAGES.EDITOR_PASS,
    to: STAGES.PUBLISHER_PASS,
    guard: (a) => requireEditorVerdict(a, 'APPROVED')
                   && requireMinImages(a, 2),
  },
  {
    from: STAGES.PUBLISHER_PASS,
    to: STAGES.PUBLISHED,
    guard: (a) => requirePublisherChecklist(a)
                   && requireSubstackUrl(a),
  },
];
```

**Key responsibilities:**
- Artifact-first stage inference (port of `article_board.py`)[^9]
- Deterministic transition validation (guards check preconditions)
- Automatic scheduling of next actions per article
- Batch advancement: find all unblocked articles, advance them in parallel
- Full audit trail (stage_transitions table)
- Drift detection and repair

### 5.2 LLM Gateway (New)

```typescript
// src/llm/gateway.ts

export interface LlmProvider {
  id: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
  supportsStructuredOutput: boolean;
}

export interface ChatRequest {
  model: string;
  systemPrompt: string;
  messages: Message[];
  responseSchema?: JsonSchema;  // for structured output
  maxTokens?: number;
  temperature?: number;
}

// Provider implementations
export class CopilotProvider implements LlmProvider { ... }   // Uses @github/copilot-sdk
export class AnthropicProvider implements LlmProvider { ... }  // Direct API
export class OpenAIProvider implements LlmProvider { ... }     // Direct API  
export class GeminiProvider implements LlmProvider { ... }     // Direct API
export class LocalProvider implements LlmProvider { ... }      // Ollama/llama.cpp
```

**Model resolution** uses the existing `models.json` policy[^23], ported to TypeScript:

```typescript
// src/llm/model-policy.ts
// Ports content/model_policy.py — same logic, native TypeScript

export function resolveModel(opts: {
  stageKey?: string;
  depthLevel?: number;
  taskFamily?: string;
  overrideModel?: string;
}): ResolvedModel { ... }
```

**Copilot Pro+ integration:** The CopilotProvider wraps the `@github/copilot-sdk` for users with Copilot Pro+ licenses. This is the default provider for interactive use. For server/automated use, direct API providers (Anthropic, OpenAI) are used with API keys.

### 5.3 Agent Runner (New)

The Agent Runner replaces the implicit "spawn an agent via Copilot CLI" pattern with explicit, structured LLM calls:

```typescript
// src/agents/runner.ts

export interface AgentContext {
  charter: string;           // Parsed from markdown charter file
  skills: string[];          // Relevant skill documents
  articleContext: ArticleContext;
  knowledgeBase?: string;    // Agent history / accumulated knowledge
}

export interface AgentTask {
  agent: AgentName;          // 'writer' | 'editor' | 'cap' | 'sea' | ...
  task: TaskType;            // 'panel_position' | 'draft' | 'review' | ...
  input: Record<string, any>;
}

export interface AgentOutput {
  content: string;           // The generated content
  metadata: Record<string, any>;
  structured?: Record<string, any>;  // Parsed structured output if schema was provided
}

export async function runAgent(
  task: AgentTask, 
  gateway: LlmGateway,
  dataDir: string
): Promise<AgentOutput> {
  const context = await buildAgentContext(task, dataDir);
  const model = resolveModel({ stageKey: task.task, ... });
  const prompt = buildPrompt(context, task);
  
  const response = await gateway.chat({
    model: model.selectedModel,
    systemPrompt: context.charter,
    messages: [{ role: 'user', content: prompt }],
    responseSchema: getOutputSchema(task.task),
    maxTokens: model.outputBudgetTokens,
  });
  
  return parseAgentOutput(response, task);
}
```

**Panel execution** becomes parallel LLM calls:

```typescript
// src/pipeline/actions/run-panel.ts

export async function runPanelDiscussion(
  article: Article,
  panelAgents: string[],
  gateway: LlmGateway
): Promise<PanelResult> {
  // Run all panel agents in parallel
  const positions = await Promise.all(
    panelAgents.map(agent => 
      runAgent({
        agent,
        task: 'panel_position',
        input: {
          discussionPrompt: article.artifacts['discussion-prompt.md'],
          agentQuestion: article.panelQuestions[agent],
        }
      }, gateway, dataDir)
    )
  );
  
  // Synthesize into discussion summary (another LLM call)
  const synthesis = await runAgent({
    agent: 'lead',
    task: 'synthesis',
    input: { positions, discussionPrompt: article.artifacts['discussion-prompt.md'] },
  }, gateway, dataDir);
  
  return { positions, synthesis };
}
```

### 5.4 Service Layer

Services wrap external APIs and internal capabilities:

```
src/services/
├── substack.service.ts      // Port of shared/substack-*.mjs
├── twitter.service.ts       // Port of shared/twitter-client.mjs
├── image.service.ts         // Port of gemini-imagegen + table-renderer
├── nflverse.service.ts      // HTTP proxy to Python sidecar
├── prosemirror.service.ts   // Port of shared/substack-prosemirror.mjs
└── publisher.service.ts     // Port of dashboard/publish.mjs
```

### 5.5 Python Data Sidecar

The 12 nflverse query scripts stay in Python (Polars is best-in-class for this), but get a thin HTTP wrapper:

```python
# services/nflverse-api/main.py
from fastapi import FastAPI
app = FastAPI()

@app.get("/api/player/{name}")
async def player_stats(name: str, season: int = 2025): ...

@app.get("/api/team/{abbrev}")
async def team_efficiency(abbrev: str, season: int = 2025): ...

# ... etc for all 12 query types
```

This also serves as the MCP tool backend — the MCP server calls the sidecar HTTP API instead of spawning Python processes.

---

## 6. LLM Abstraction Layer

### 6.1 Provider Priority Chain

```
1. Copilot Pro+ (via @github/copilot-sdk)     ← default for interactive/local use
2. Anthropic Claude API                         ← default for server/automated use
3. OpenAI API                                   ← fallback / specific model needs
4. Google Gemini API                            ← image generation + fallback
5. Local (Ollama / llama.cpp)                   ← offline development, cost savings
```

### 6.2 Copilot Pro+ Strategy

Copilot Pro+ provides access to premium models (Claude Opus, GPT-5.x) through the GitHub subscription[^23]. The v2 system leverages this in two modes:

**Interactive mode (local):** When running locally with Copilot CLI, the MCP server exposes all pipeline tools. The human can issue commands like "advance the Arizona article" and Copilot CLI orchestrates via the Pipeline Engine API. The LLM calls for content generation route through Copilot's model router.

**Server mode (VM):** When running on a VM, the system uses direct API keys (Anthropic, OpenAI) for LLM calls. Copilot Pro+ isn't available server-side, but the same model policy[^23] selects equivalent models from direct API access.

### 6.3 Structured Output

v2 mandates structured output for all agent interactions where possible:

```typescript
// Editor review output schema
const EditorReviewSchema = z.object({
  verdict: z.enum(['APPROVED', 'REVISE', 'REJECT']),
  errors: z.array(z.object({
    severity: z.enum(['red', 'yellow', 'green']),
    category: z.string(),
    description: z.string(),
    location: z.string().optional(),
    correction: z.string().optional(),
  })),
  summary: z.string(),
});
```

This eliminates the current fragile regex parsing of editor verdicts from markdown[^9].

---

## 7. Data Separation Strategy

### 7.1 Directory Layout

```
$NFL_DATA_DIR/                          # ~/.nfl-lab/ (local) or /data/nfl-lab/ (VM)
├── pipeline.db                         # Article pipeline state
├── articles/                           # All article artifacts
│   ├── sea-emmanwori-rookie-eval/
│   │   ├── idea.md
│   │   ├── discussion-prompt.md
│   │   ├── panel-composition.md
│   │   ├── cap-position.md
│   │   ├── sea-position.md
│   │   ├── discussion-summary.md
│   │   ├── draft.md
│   │   ├── editor-review.md
│   │   └── publisher-pass.md
│   └── ...
├── images/                             # Generated article images
│   └── sea-emmanwori-rookie-eval/
│       ├── cover.png
│       └── inline-1.png
├── agents/                             # Agent knowledge (moved from .squad/)
│   ├── charters/                       # Behavioral definitions
│   │   ├── lead.md
│   │   ├── writer.md
│   │   └── ...
│   └── history/                        # Accumulated knowledge
│       ├── lead.md
│       └── ...
├── nflverse-cache/                     # Parquet data files
│   ├── player_stats_2025.parquet
│   └── ...
├── logs/                               # Orchestration logs
│   ├── pipeline/                       # Pipeline run logs
│   └── sessions/                       # Interactive session logs
└── config/                             # Runtime config (NOT committed)
    ├── models.json                     # Model policy
    └── .env                            # API keys
```

### 7.2 Source Tree (What's in Git)

```
nfl-eval/
├── src/                                # Application code (TypeScript)
│   ├── pipeline/                       # State machine, scheduler, actions
│   │   ├── state-machine.ts
│   │   ├── scheduler.ts
│   │   ├── artifact-scanner.ts
│   │   └── actions/
│   │       ├── run-panel.ts
│   │       ├── run-writer.ts
│   │       ├── run-editor.ts
│   │       └── run-publisher.ts
│   ├── llm/                            # LLM abstraction
│   │   ├── gateway.ts
│   │   ├── model-policy.ts
│   │   └── providers/
│   │       ├── copilot.ts
│   │       ├── anthropic.ts
│   │       ├── openai.ts
│   │       ├── gemini.ts
│   │       └── local.ts
│   ├── agents/                         # Agent runner
│   │   ├── runner.ts
│   │   ├── charter-parser.ts
│   │   └── prompt-builder.ts
│   ├── services/                       # External service clients
│   │   ├── substack.service.ts
│   │   ├── twitter.service.ts
│   │   ├── image.service.ts
│   │   └── nflverse.service.ts
│   ├── dashboard/                      # Web dashboard
│   │   ├── server.ts
│   │   ├── routes/
│   │   ├── views/
│   │   └── public/
│   ├── mcp/                            # MCP server (for Copilot CLI clients)
│   │   └── server.ts
│   ├── db/                             # Database layer
│   │   ├── schema.sql
│   │   ├── migrations/
│   │   └── repository.ts
│   └── config/                         # Configuration
│       ├── index.ts
│       └── defaults/
│           └── models.json
├── services/                           # Python sidecar
│   └── nflverse-api/
│       ├── main.py
│       ├── queries/                    # Port of content/data/*.py
│       └── requirements.txt
├── tests/                              # Test suite
│   ├── pipeline/
│   ├── llm/
│   ├── services/
│   └── fixtures/
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

### 7.3 Migration Path for Existing Data

```bash
# One-time migration script
npx nfl-lab migrate-data \
  --source ./content \
  --source-squad ./.squad \
  --target ~/.nfl-lab

# What it does:
# 1. Copies pipeline.db to $NFL_DATA_DIR/pipeline.db
# 2. Copies content/articles/* to $NFL_DATA_DIR/articles/
# 3. Copies content/images/* to $NFL_DATA_DIR/images/
# 4. Copies .squad/agents/*/charter.md to $NFL_DATA_DIR/agents/charters/
# 5. Copies .squad/agents/*/history.md to $NFL_DATA_DIR/agents/history/
# 6. Copies content/data/cache/* to $NFL_DATA_DIR/nflverse-cache/
# 7. Copies .squad/config/models.json to $NFL_DATA_DIR/config/models.json
```

---

## 8. Deterministic Logic Extraction

### 8.1 Inventory of Rules to Codify

Here is every business rule currently embedded in prompts, with its extraction plan:

| # | Rule | Current Location | Extraction |
|---|------|-----------------|------------|
| 1 | Stage transitions follow strict 1→2→3→...→8 order | `ralph/prompt.md`[^14], `article-lifecycle/SKILL.md`[^19] | State machine guards (§5.1) |
| 2 | Panel size: 2 (casual), 3-4 (beat), 4-5 (deep dive) | `models.json`[^23], `article-discussion/SKILL.md` | Config validation in `composePanelAction` |
| 3 | Panel must include team agent + ≥1 specialist | `article-discussion/SKILL.md` | Validation function |
| 4 | Article must have 2 inline images before publish | `ralph/prompt.md`[^14] | Guard on stage 6→7 transition |
| 5 | Editor is mandatory — no article skips it | `ralph/prompt.md`[^14] | Guard on stage 5→7 (blocks skip) |
| 6 | Publisher pass has 13 boolean checkpoints | `schema.sql`[^7] | Already in DB; add completion validation |
| 7 | Expert disagreement must be preserved, not smoothed | Writer/Lead charters | Prompt instruction (stays LLM) + quality metric |
| 8 | 2026 offseason framing: 2025 stats, 2026 cap | `AGENTS.md`[^25] | Config constant: `{ statsSeason: 2025, capYear: 2026 }` |
| 9 | Substack formatting: subscribe buttons, hero image safety | `substack-prosemirror.mjs`[^6] | ✅ Already code — keep |
| 10 | Dense table detection and blocking | `renderer-core.mjs`, ProseMirror pipeline | ✅ Already code — keep |
| 11 | Tag-based publishing (not sections) | `prd.json`[^24], conventions | Config constant + validation |
| 12 | Model selection per stage/task family | `model_policy.py`[^10] | ✅ Already code — port to TS |
| 13 | Artifact-first stage inference | `article_board.py`[^9] | ✅ Already code — port to TS |
| 14 | Editor verdict parsing | `article_board.py` regex[^9] | Replace with structured output schema |
| 15 | Name cross-contamination check | Editor charter | Add fuzzy-name validation utility |
| 16 | Stage 8 only after live URL exists | Various prompts, memories | Guard on transition (requireSubstackUrl) |
| 17 | Default Note uses article subtitle as teaser | Memory, `substack-notes.mjs` | ✅ Already code in `buildSubtitleCardNoteBody` |

### 8.2 What Stays as LLM Instructions

Some things are inherently non-deterministic and should remain as LLM prompts:

- **Writer voice and style** ("The Ringer meets OverTheCap")
- **Expert analysis quality** (what constitutes good NFL analysis)
- **Creative content generation** (article writing, discussion positions)
- **Fact-checking judgment** (which claims need verification, what sources to check)
- **News significance scoring** (is this trade worth an article?)

The key insight: **the pipeline orchestration is deterministic; the content generation within each stage is LLM-driven.**

---

## 9. Dashboard v2

### 9.1 Current Dashboard Limitations

The current dashboard[^5] is a read-only HTML app with server-rendered templates:
- No authentication
- No queue management
- No direct stage advancement from UI
- No LLM call monitoring
- No cost tracking visualization
- No real-time updates (page refresh required)
- Basic string-template HTML (no component model)

### 9.2 v2 Dashboard Requirements

| Feature | Priority | Description |
|---------|----------|-------------|
| **Pipeline Board** | P0 | Kanban-style board showing all articles by stage, with drag-drop advancement |
| **Article Detail** | P0 | Full artifact viewer, diff view, stage history timeline |
| **Preview** | P0 | Live Substack-accurate preview (keep existing ProseMirror pipeline) |
| **Publish Actions** | P0 | One-click publish, Notes, Twitter from UI |
| **Queue Management** | P0 | View/manage scheduled pipeline jobs, retry failed steps |
| **LLM Monitor** | P1 | Real-time view of active LLM calls, token usage, cost tracking |
| **Agent Viewer** | P1 | View agent charters, accumulated knowledge, panel history |
| **Analytics** | P1 | Cost per article, time to publish, stage throughput |
| **Authentication** | P1 | Basic auth (single user initially; JWT for multi-user later) |
| **Real-time Updates** | P1 | Server-Sent Events or WebSocket for live state changes |
| **Mobile Responsive** | P2 | Usable on phone for monitoring |
| **Editorial Calendar** | P2 | Visual calendar of planned/scheduled articles |

### 9.3 Technical Approach

```
Dashboard v2 Stack:
  Server: Hono/Fastify (same process as Pipeline Engine)
  Rendering: Server-rendered HTML + htmx for interactivity
  Style: Tailwind CSS
  Real-time: Server-Sent Events (SSE)
  State: SQLite (same pipeline.db)
  Preview: Existing ProseMirror pipeline (preserved)
```

**Why htmx over React SPA:** The dashboard is primarily a monitoring and action tool, not a complex interactive application. htmx provides the interactivity needed (live updates, form submissions, partial page updates) with far less complexity. The existing server-rendered approach was close — it just needed interactivity.

### 9.4 Key Dashboard Views

**Board View (Kanban):**
```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│  Ideas   │ Prompts  │  Panels  │Discussion│  Writer  │  Editor  │Publisher │Published │
│  (3)     │  (0)     │  (10)    │  (2)     │  (2)     │  (11)    │  (5)     │  (2)     │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ CIN      │          │ ATL      │ LAR      │          │ ARI      │ BUF      │ JSN      │
│ CLE      │          │ BAL      │ SF       │          │ CAR      │ DEN      │ W'spoon  │
│ PIT      │          │ CHI      │          │          │ DAL      │ HOU      │          │
│          │          │ ...      │          │          │ ...      │ JAX      │          │
│          │          │          │          │          │          │ LV       │          │
│          │          │          │          │          │          │          │          │
│ [Advance]│          │[Run All] │          │          │[Run All] │[Publish] │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

**Actions from the Board:**
- "Advance" button on individual cards → triggers deterministic transition + LLM call
- "Run All" batch buttons → advance all articles in that stage
- "Publish" → runs the existing publish workflow
- Drag-and-drop for manual stage override (with audit trail)
- Color-coded by status (blocked=red, ready=green, in-progress=blue)

---

## 10. Migration Strategy

### 10.1 Phased Approach

**Phase 1: Foundation (Week 1-2)**
- Set up TypeScript project structure with build pipeline
- Implement data directory separation with `NFL_DATA_DIR` environment variable
- Port `pipeline_state.py` → `src/db/repository.ts`
- Port `article_board.py` → `src/pipeline/artifact-scanner.ts`
- Port `model_policy.py` → `src/llm/model-policy.ts`
- Write migration script for existing data
- Set up test infrastructure (Vitest)

**Phase 2: Pipeline Engine (Week 2-3)**
- Implement state machine with transition guards
- Build scheduler (find unblocked articles, queue actions)
- Port pipeline actions (run-panel, run-writer, run-editor, run-publisher)
- Implement audit trail and drift detection

**Phase 3: LLM Gateway (Week 3-4)**
- Implement provider abstraction
- Build CopilotProvider (wraps existing SDK)
- Build AnthropicProvider and OpenAIProvider
- Implement structured output handling
- Port agent runner with charter parsing

**Phase 4: Service Layer (Week 4-5)**
- Port Substack services (`shared/substack-*.mjs` → `src/services/`)
- Port Twitter service
- Port image generation service
- Build nflverse HTTP sidecar (FastAPI wrapper)
- Port table renderer

**Phase 5: Dashboard v2 (Week 5-7)**
- Set up Hono/Fastify HTTP server
- Implement board view with htmx
- Implement article detail view
- Implement publish workflow UI
- Add SSE for real-time updates
- Port preview rendering

**Phase 6: MCP Server + Integration (Week 7-8)**
- Rebuild MCP server to call Pipeline Engine API
- Verify Copilot CLI integration
- Implement batch automation (cron-triggered pipeline runs)
- Docker Compose setup for VM deployment
- End-to-end testing

### 10.2 Parallel Operation

During migration, both systems can run side-by-side:
- v1 (Copilot CLI + squad) continues operating on the current data
- v2 reads from the same `pipeline.db` (read-only initially)
- Cutover happens when v2 can advance an article end-to-end

### 10.3 Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Losing accumulated agent knowledge | Migration script preserves all history files |
| Breaking Substack publish flow | Port `substack-*.mjs` files nearly verbatim |
| ProseMirror regression | Keep existing parsing code, add snapshot tests |
| Model API compatibility | Test each provider against existing article outputs |

---

## 11. Cost & Infrastructure

### 11.1 VM Options

| Provider | Spec | Monthly Cost | Notes |
|----------|------|-------------|-------|
| **Hetzner CX22** | 2 vCPU, 4GB RAM, 40GB SSD | ~$5/mo | Best value; EU-based |
| **DigitalOcean Basic** | 1 vCPU, 2GB RAM, 50GB SSD | $6/mo | US-based |
| **Oracle Cloud Free** | 4 OCPU, 24GB RAM, 200GB | Free | ARM; generous free tier |
| **AWS Lightsail** | 1 vCPU, 1GB RAM, 40GB SSD | $5/mo | Familiar ecosystem |

**Recommended:** Hetzner CX22 ($5/mo) or Oracle Cloud Free Tier. SQLite + Node.js is extremely lightweight.

### 11.2 LLM Cost Estimates

| Provider | Model | Use Case | Cost per Article (~5 calls) |
|----------|-------|----------|----------------------------|
| Copilot Pro+ | Claude Opus 4.6 | Panel + Writer + Editor | $0 (included in $39/mo sub) |
| Anthropic Direct | Claude Sonnet 4 | Panel + Writer + Editor | ~$0.30-0.50 |
| OpenAI Direct | GPT-5.1 | Fallback | ~$0.20-0.40 |
| Google | Gemini 3 Pro | Image generation | ~$0.05 per image |

**At 32 articles/month with Copilot Pro+:** $39/mo flat. **With direct API:** ~$10-15/mo.

### 11.3 Total Monthly Cost (Estimated)

| Component | Cost |
|-----------|------|
| VM hosting | $5/mo |
| Copilot Pro+ (interactive work) | $39/mo |
| Direct API (automated runs) | $10-15/mo |
| Gemini (images, 64 images/mo) | $3/mo |
| Substack (free tier) | $0 |
| **Total** | **$57-62/mo** |

---

## 12. Confidence Assessment

### High Confidence (Verified in Code)
- The 8-stage pipeline model is well-defined in both schema and Python code[^7][^8][^9]
- The Substack publish flow is proven and works reliably[^5][^21]
- Model policy resolution is clean and portable[^10][^23]
- ProseMirror conversion handles edge cases well[^6]
- nflverse data layer works and can be wrapped as an HTTP service[^11]
- SQLite is the right database for this scale

### Medium Confidence (Inferred from Patterns)
- htmx + server-rendering is the right dashboard approach (could also be React; trade-off is complexity)
- CopilotProvider will work for LLM calls outside of Copilot CLI (SDK may have limitations)
- 8-week migration timeline assumes one developer working full-time
- Docker Compose is sufficient for deployment (might need systemd for simpler setups)

### Lower Confidence (Assumptions)
- Oracle Cloud Free Tier will remain available (it's been stable for years)
- The existing agent charters will produce equivalent quality when called via direct API vs. Copilot CLI
- BullMQ/Redis is needed (might be overkill — a simple in-process queue could suffice for <100 articles/month)
- Python sidecar via FastAPI is preferable to porting nflverse queries to TypeScript (Polars is strongly preferred for this workload, but it adds deployment complexity)

### Open Questions
1. **Should agent knowledge (history.md) migrate to SQLite or stay as markdown files?** Markdown is human-readable but hard to query. SQLite is queryable but loses the "edit it in VS Code" workflow.
2. **Is a separate Python sidecar worth the deployment complexity?** Alternative: use a JavaScript parquet reader (e.g., `parquet-wasm`) and port the queries.
3. **How much of the Squad framework should be preserved?** The casting/naming system is not essential to v2, but the charter format is.
4. **Should the dashboard be a separate package or monorepo module?** Monorepo keeps it simple; separate package allows independent deployment.

---

## Footnotes

[^1]: `README.md:42-44` — "This is an interactive system. You talk to the agents through GitHub Copilot CLI."
[^2]: `VISION.md:34-39` — Automation listed as "not built" in capabilities table
[^3]: `mcp/server.mjs:1-249` — MCP server aggregating all tools
[^4]: `.github/extensions/README.md:1-280` — Extension architecture documentation
[^5]: `dashboard/server.mjs:1-488` — Full dashboard HTTP server
[^6]: `shared/substack-prosemirror.mjs:1-40` — ProseMirror conversion library
[^7]: `content/schema.sql:1-263` — Full pipeline database schema
[^8]: `content/pipeline_state.py:1-100` — Pipeline DB mutation helper
[^9]: `content/article_board.py:1-320` — Artifact-first stage inference
[^10]: `content/model_policy.py:1-318` — Model selection policy
[^11]: `content/data/*.py` — 12 nflverse query scripts using Polars
[^12]: `.squad/agents/` — 47 agent directories with charter.md + history.md
[^13]: `.squad/skills/` — 23 skill directories with SKILL.md files
[^14]: `ralph/prompt.md:1-180` — Autonomous pipeline loop prompt
[^15]: `content/articles/` — 46+ article artifact directories
[^16]: Root-level scripts: `batch-publish-prod.mjs`, `fix-dense-tables.mjs`, etc.
[^17]: `.github/agents/squad.agent.md:1-80` — Squad coordinator prompt
[^18]: `.squad/log/` and `.squad/orchestration-log/` — 230+ log files
[^19]: `.squad/skills/article-lifecycle/SKILL.md:1-100` — 8-stage lifecycle skill
[^20]: `.github/extensions/nflverse-query/tool.mjs` — shells out to Python scripts
[^21]: `dashboard/publish.mjs:49-62` — spawnSync to pipeline_state.py
[^22]: `package.json:10` — `"test": "echo \"Error: no test specified\" && exit 1"`
[^23]: `.squad/config/models.json:1-122` — Model policy configuration
[^24]: `ralph/prd.json:10-16` — Publisher rules including tag-based publishing
[^25]: `ralph/AGENTS.md:34-38` — Key conventions including 2026 offseason framing
