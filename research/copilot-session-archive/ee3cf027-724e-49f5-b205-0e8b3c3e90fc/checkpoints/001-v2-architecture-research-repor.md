<overview>
The user requested a comprehensive architectural research report for replatforming the nfl-eval project (NFL Content Intelligence Platform) from v1 to v2. The current system is tightly coupled to GitHub Copilot CLI as its runtime/orchestrator, mixes data with source code in Git, embeds business logic in LLM prompts, and cannot run autonomously on a server. The goal is a v2 architecture that separates data from source, encodes rules deterministically, treats LLMs as pluggable services, supports local and VM deployment, and provides a rich dashboard.
</overview>

<history>
1. The user asked for a holistic architectural analysis and v2 replatforming plan for nfl-eval
   - Explored the entire repository structure: root files, content/, dashboard/, mcp/, shared/, .squad/, .github/, ralph/
   - Read all key source files: schema.sql, pipeline_state.py, article_board.py, model_policy.py, server.mjs (MCP), server.mjs (dashboard), data.mjs, publish.mjs, substack-session.mjs, substack-article.mjs, substack-prosemirror.mjs, twitter-client.mjs, extensions README, squad.agent.md, article-lifecycle SKILL.md, ralph prompt.md, AGENTS.md, prd.json, models.json, _shared.py, query_player_epa.py, .env.example, requirements.txt, mcp-config.json
   - Enumerated all source files (.mjs, .js, .py) and documentation files (.md) in the repo
   - Produced an exhaustive 46K-character research report covering: current architecture inventory, structural problems, assets to preserve, v2 architecture design, component deep-dives, LLM abstraction layer, data separation strategy, deterministic logic extraction, dashboard v2 design, migration strategy, cost/infrastructure estimates, and confidence assessment
   - Saved the report to the session research directory
</history>

<work_done>
Files created:
- `C:\Users\jdl44\.copilot\session-state\ee3cf027-724e-49f5-b205-0e8b3c3e90fc\research\there-are-some-serious-limitatons-with-the-archite.md` — 46,286-character comprehensive research report

Work completed:
- [x] Full inventory of all components (MCP server, extensions, dashboard, shared libs, pipeline DB, pipeline state, article board, model policy, data queries, agent charters, skills, Ralph orchestrator, article content, one-off scripts)
- [x] Identified 6 structural problems: Copilot CLI lock-in, data/source entanglement, business logic in prompts, mixed language runtime, one-off script proliferation, no test infrastructure
- [x] Cataloged assets to preserve vs rebuild (ProseMirror pipeline, schema, pipeline_state logic, model policy, nflverse queries = keep; orchestration, dashboard, agent runner = rebuild)
- [x] Designed v2 architecture with 5 core components: Pipeline Engine (deterministic state machine), LLM Gateway (multi-provider), Agent Runner (structured LLM calls), Service Layer, Dashboard v2
- [x] Designed data separation strategy ($NFL_DATA_DIR with articles/, agents/, nflverse-cache/, config/)
- [x] Inventoried 17 business rules for deterministic extraction
- [x] Proposed technology stack: TypeScript/Hono/SQLite/htmx+Alpine.js/Docker Compose
- [x] Estimated costs: ~$57-62/mo total (VM + Copilot Pro+ + API keys)
- [x] 6-phase migration plan over ~8 weeks
</work_done>

<technical_details>
Key architectural findings:
- The entire orchestration layer is implicit LLM prompts (ralph/prompt.md, squad.agent.md) — there is NO executable orchestrator
- pipeline.db uses SQLite with 9 tables: articles, stage_transitions, article_runs, stage_runs, usage_events, article_panels, discussion_prompts, editor_reviews, publisher_pass, notes
- Stage inference is "artifact-first" — article_board.py scans filesystem to determine true stage, overriding DB/labels when they disagree
- The MCP server (mcp/server.mjs) aggregates 16+ tools from .github/extensions/ and registers them via @modelcontextprotocol/sdk
- Python scripts in content/data/ use Polars for nflverse parquet data; the MCP tools shell out to these via child_process
- Dashboard (dashboard/server.mjs) is zero-dependency Node.js using node:http, node:sqlite — server-rendered HTML templates
- Substack publishing uses cookie-based auth (substack.sid), ProseMirror JSON body format, and direct API calls for draft creation and live publish
- Model policy in .squad/config/models.json defines task families (lightweight/balanced/deep_reasoning/agentic_code) with model precedence chains
- 47 agents exist: 32 team agents + 13 specialists + 2 infrastructure (Scribe, Ralph)
- 23 skills cover everything from article lifecycle to nflverse data to Substack publishing
- ~15 one-off scripts in repo root (batch-publish, fix-dense-tables, repair-prod-drafts, etc.) represent operational debt

Key technical constraints:
- Node 22+ required (uses node:sqlite built-in)
- Python 3.10+ with polars and nflreadpy for data layer
- Playwright required for table rendering and validation
- package.json type is "commonjs" but files use .mjs extensions (ESM)
- No test infrastructure exists at all ("test": "echo Error")
- Git repo contains both source AND data (pipeline.db, 46+ article dirs, 20K+ lines agent history, 230+ log files, parquet cache)

v2 design decisions:
- TypeScript monorepo with src/ for app code, services/nflverse-api/ for Python sidecar
- Pipeline Engine as deterministic state machine with guard functions per transition
- LLM Gateway with provider abstraction: CopilotProvider, AnthropicProvider, OpenAIProvider, GeminiProvider, LocalProvider
- Agent Runner replaces "spawn agent via Copilot CLI" with structured LLM calls + JSON schema output
- Data directory ($NFL_DATA_DIR) completely separate from source tree
- Dashboard v2 using htmx + server-rendering (not React SPA) for simplicity
- Python data scripts stay Python but get a FastAPI HTTP wrapper (nflverse sidecar)
- Docker Compose for VM deployment
</technical_details>

<important_files>
- `content/schema.sql`
   - Defines the 9-table pipeline database schema — the data model backbone
   - Not modified; cataloged as "keep as-is, migrate to data dir"
   - Key tables: articles (lines 10-30), stage_transitions (36-44), publisher_pass (177-193), notes (199-212), pipeline_board view (218-262)

- `content/pipeline_state.py`
   - All DB mutations for the pipeline (advance stage, record reviews, set URLs)
   - Not modified; identified for TypeScript port
   - Constants and validation at lines 26-31; core logic throughout 1000+ lines

- `content/article_board.py`
   - Artifact-first stage inference — scans filesystem to determine true article stage
   - Not modified; identified for TypeScript port
   - Stage inference function at lines 200-320; precedence: publisher-pass > editor-review > draft > discussion-summary > panel outputs > prompt > idea

- `mcp/server.mjs`
   - Central MCP server aggregating 16+ tools from extensions
   - Not modified; identified for rebuild
   - Tool registration pattern at lines 71-244; uses zod for schema validation

- `dashboard/server.mjs`
   - Pipeline dashboard HTTP server (zero dependencies)
   - Not modified; identified for major rebuild
   - Routes at lines 290-460; publish workflow at lines 217-283

- `dashboard/publish.mjs`
   - Complete publish workflow: draft upsert → live publish → Notes → Twitter
   - Not modified; identified for service extraction
   - Core workflow at lines 106-322; uses spawnSync to call pipeline_state.py

- `shared/substack-prosemirror.mjs`
   - Battle-tested markdown → ProseMirror JSON conversion
   - Not modified; identified as "keep, move to src/services/"
   - Core parsing logic; shared by publisher extension and dashboard

- `.squad/config/models.json`
   - Model selection policy: task families, precedence chains, tier assignments
   - Not modified; key config to preserve
   - Models per stage (lines 4-14), supported models (lines 33-62), task families (lines 63-116)

- `ralph/prompt.md`
   - The "autonomous pipeline loop" — currently just an LLM prompt, not executable code
   - Not modified; identified as primary replacement target for Pipeline Engine
   - Iteration protocol at lines 79-145; rules at lines 150-160

- `content/model_policy.py`
   - Executable model selection with task family resolution
   - Not modified; identified for TypeScript port
   - ModelPolicy class at lines 60-220; CLI interface at lines 222-318

- Research report: `C:\Users\jdl44\.copilot\session-state\ee3cf027-724e-49f5-b205-0e8b3c3e90fc\research\there-are-some-serious-limitatons-with-the-archite.md`
   - The deliverable — 46K chars covering full current state analysis and v2 proposal
   - Created this session
</important_files>

<next_steps>
The research report is complete and saved. No implementation work has begun. Potential next steps if the user wants to proceed:

1. **Review and refine the report** — User may want to discuss trade-offs, adjust scope, or change technology choices
2. **Create a formal implementation plan** — Convert the 6-phase migration strategy into actionable todos with dependencies
3. **Begin Phase 1: Foundation** — Set up TypeScript project structure, implement data directory separation, port pipeline_state.py and article_board.py
4. **Prototype the Pipeline Engine** — Build the deterministic state machine as the core of v2
5. **Prototype the LLM Gateway** — Implement multi-provider abstraction starting with CopilotProvider

Key open questions for the user:
- Agent knowledge (history.md): SQLite or markdown files?
- Python sidecar vs porting nflverse queries to TypeScript?
- How much of the Squad framework to preserve?
- Monorepo or separate packages for dashboard?
- Timeline/resource constraints?
</next_steps>