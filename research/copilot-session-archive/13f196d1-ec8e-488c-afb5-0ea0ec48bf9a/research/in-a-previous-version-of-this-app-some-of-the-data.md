# Research: Single local MCP server for nflverse and related data tools

## Executive Summary

The repo already contains most of the ingredients for a single local MCP server, but they are split across two incompatible entrypoints: an extension-oriented local server at `C:\github\nfl-eval\mcp\server.mjs` and a separate pipeline-only MCP server at `C:\github\nfl-eval\src\mcp\server.ts`.[^1][^2] The extension-oriented server already aggregates the nflverse query tools, prediction-market tooling, and publishing/media tools into one stdio MCP server, while the TypeScript CLI path (`npm run v2:mcp`) still launches only the pipeline tool set.[^1][^2][^3] 

For your goal, the right design is **not** to build a third server. It is to make one canonical local MCP server that owns the data tool surface and, optionally, also exposes pipeline and publishing tools behind the same stdio boundary.[^2][^3][^4] The cleanest path is to move the canonical implementation into a TypeScript server module, keep the existing tool names for compatibility, reuse/extend `DataService` for script/HTTP fallback, and leave `mcp/server.mjs` as a thin compatibility shim until clients migrate.[^2][^5][^6]

The strongest technical reason to centralize now is duplication: the repo currently has multiple Python-shell-out implementations for the same data access pattern in MCP extensions, `DataService`, roster/fact-check helpers, and validators.[^5][^7][^8][^9] A single local MCP server can become the stable access layer for nflverse-backed data, Polymarket-backed data, and future providers while reducing repeated caching, error handling, and script-discovery logic.[^5][^7][^8][^9][^10]

## Architecture / System Overview

```text
Today

Copilot / MCP client
  ├─ repo MCP config -> mcp/server.mjs
  │    └─ registers extension handlers
  │         ├─ nflverse query tools
  │         ├─ prediction market tool
  │         └─ publishing / image tools
  │
  └─ CLI command: npm run v2:mcp -> src/cli.ts -> src/mcp/server.ts
       └─ exposes pipeline-only tools

Data execution paths
  ├─ .github/extensions/nflverse-query/tool.mjs -> python query scripts
  ├─ src/services/data.ts -> python scripts OR HTTP sidecar
  ├─ src/pipeline/roster-context.ts -> execFileSync python
  ├─ src/pipeline/fact-check-context.ts -> execFileSync python
  └─ src/pipeline/validators.ts -> execFileSync python
```

```text
Recommended target

Copilot / Claude / Codex / local MCP client
  └─ one canonical stdio server
       ├─ tool registry
       │    ├─ nflverse tools
       │    ├─ non-nflverse data tools (prediction markets, future providers)
       │    ├─ pipeline tools (optional same server)
       │    └─ publishing/media tools (optional same server)
       ├─ shared result normalization
       ├─ shared cache + TTL policy
       └─ shared data adapters
            ├─ Python script adapter
            ├─ HTTP sidecar adapter
            └─ direct API adapter (e.g. Polymarket)
```

## Current State: what exists today

### 1) There are already **two** MCP server entrypoints

The package scripts expose both `mcp:server` and `v2:mcp`, but they do not launch the same implementation. `mcp:server` runs `node mcp/server.mjs`, while `v2:mcp` runs `tsx src/cli.ts mcp`.[^1] The CLI implementation resolves `handleMcp()` to `startMCPServer()` from `src/mcp/server.ts`, which is the pipeline MCP server.[^3]

At the same time, repo-level Copilot config points clients to `mcp/server.mjs`, not the TypeScript CLI path.[^4] The repo README also reflects this split state: it says MCP tooling exists via `npm run v2:mcp` and also calls the `mcp/` folder “legacy/local MCP entrypoints.”[^11]

**Implication:** the repo already behaves like it has two “truths” for MCP. If you add more data tools without consolidation, the split will get worse.[^1][^3][^4][^11]

### 2) `mcp/server.mjs` already aggregates a broad local tool surface

The local server in `mcp/server.mjs` uses `@modelcontextprotocol/sdk`’s `McpServer` and `StdioServerTransport`, then registers tools from extension modules rather than hardcoding logic in the server.[^2] It currently wires:

- article image generation
- table image rendering
- Substack publishing
- Substack Notes publishing
- tweet publishing
- nflverse query tools
- prediction-market query tooling[^2]

The extensions README explicitly says the preferred pattern is “MCP-first,” and describes `mcp/server.mjs` as the aggregator that combines extension exports into one MCP server.[^12]

**Implication:** you already have a working architectural pattern for “one local MCP server hosting multiple tool families.” The design problem is mainly consolidation and ownership, not invention.[^2][^12]

### 3) `src/mcp/server.ts` is a separate, pipeline-focused MCP server

The TypeScript server defines a different tool catalog: `pipeline_status`, `article_get`, `article_create`, `article_advance`, `article_list`, `pipeline_batch`, and `pipeline_drift`.[^13] It is built directly on `Server` + `StdioServerTransport` from the MCP SDK and talks to the repository and pipeline engine directly.[^13]

That makes this server valuable, but it is solving a different problem: editorial pipeline control, not data-tool hosting.[^13] Because `handleMcp()` in `src/cli.ts` launches this server, anyone using `npm run v2:mcp` currently gets the pipeline tool set rather than the extension/data tool set.[^3]

**Implication:** your desired end state is to merge these tool families under one server boundary, or at minimum make one canonical entrypoint choose a superset of both.[^2][^3][^13]

## Current data-tool implementation model

### 4) The nflverse MCP tools are already implemented as handler modules

The extension at `C:\github\nfl-eval\.github\extensions\nflverse-query\tool.mjs` defines tool schemas and handlers such as:

- `query_player_stats`
- `query_team_efficiency`
- `query_positional_rankings`
- `query_snap_counts`
- `query_draft_history`
- `query_ngs_passing`
- `query_combine_profile`
- `query_pfr_defense`
- `query_historical_comps`
- `query_rosters`
- `refresh_nflverse_cache`[^6][^14]

Each handler shells out to Python scripts under `content/data/`, then wraps the result with a common result envelope for LLM-facing output.[^6][^14]

**Implication:** you do not need to redesign tool semantics first. You already have a good functional tool catalog that can become the contract for the unified server.[^6][^14]

### 5) These handlers already share an MCP-specific file cache

The extension uses `cachedQuery()` from `mcp-cache.mjs`, which stores results under `~/.nfl-lab/leagues/nfl/data-cache/` and explicitly mirrors the same TTL categories used by the TypeScript `FileCacheProvider` contract.[^10][^15] The cache categories line up with the main app’s `DEFAULT_TTL` groups for roster, player stats, team stats, rankings, combine, defense, NGS, historical comps, and predictions.[^10][^16]

**Implication:** there is already an interoperable cache story. The unified server should preserve this cache path and TTL vocabulary instead of creating a new cache backend.[^10][^16]

### 6) The lower-level data source is Python + local parquet cache

The Python fetcher `content/data/fetch_nflverse.py` caches datasets locally and defines a catalog including `player_stats`, `team_stats`, `ngs_passing`, `snap_counts`, `draft_picks`, `combine`, `rosters`, `players`, `pfr_defense`, and others via `nflreadpy` + `polars`.[^17] Individual query scripts such as `query_player_epa.py` read cached nflverse data with `load_cached_or_fetch()`, disambiguate names, aggregate metrics, and emit JSON or markdown output.[^18]

The prediction-market tool is similar structurally, but its Python script hits Polymarket’s Gamma API and caches those responses for 30 minutes instead of using nflverse parquet inputs.[^19]

**Implication:** “single local MCP server” should not mean “rewrite all providers in TypeScript first.” The fastest credible design is one Node MCP server over multiple adapters, with Python scripts remaining the initial execution substrate for most data domains.[^17][^18][^19]

## The main architectural smell: duplicated data access paths

### 7) `DataService` duplicates much of the same script orchestration logic

`src/services/data.ts` already offers a service abstraction for player stats, team efficiency, positional rankings, snap counts, draft history, combine, NGS passing, defense stats, historical comps, and prediction markets.[^5] Unlike the MCP extension handlers, `DataService` supports three execution modes: `scripts`, `http`, and `auto`, where `auto` tries Python scripts first and falls back to an HTTP sidecar.[^5]

This service is powerful, but it is not yet the single source of truth for MCP tools. Notably, the viewed `DataService` surface does **not** currently include roster lookup or cache refresh methods, even though the extension tool set does.[^5][^14]

**Implication:** the clean design is to evolve `DataService` into the canonical adapter layer for the unified MCP server, but it needs parity work first (at minimum rosters + refresh, and probably result shaping helpers).[^5][^14]

### 8) Pipeline code also duplicates Python script execution directly

`src/pipeline/roster-context.ts`, `src/pipeline/fact-check-context.ts`, and `src/pipeline/validators.ts` each implement their own `runPythonQuery()` helper that discovers scripts, executes Python synchronously, and parses results locally.[^7][^8][^9] These are conceptually the same responsibilities already handled in the MCP extension layer and in `DataService`.[^5][^6][^7][^8][^9]

**Implication:** if you keep extending data access ad hoc, you will continue to pay a tax in cache drift, timeout differences, and mismatched error behavior. A unified MCP/data-adapter layer should become the reusable source for both interactive tools and internal pipeline lookups over time.[^5][^6][^7][^8][^9]

## Recommended design

## Architecture / system overview

### Canonical goal

Build **one canonical local MCP server** that owns all local tool registration for:

1. nflverse-backed data tools
2. non-nflverse data providers (starting with prediction markets)
3. optionally, pipeline tools
4. optionally, publishing/media tools[^2][^6][^12][^13][^14]

### Recommendation: canonicalize in TypeScript, keep compatibility shims

I recommend this target structure inside [JDL440/nfl-eval](https://github.com/JDL440/nfl-eval):

| Layer | Recommended owner | Why |
|---|---|---|
| Canonical MCP server | `src/mcp/local-server.ts` (new TS module) | Keeps runtime aligned with the v2 TypeScript app and lets `v2:mcp` become the real canonical entrypoint. |
| Tool registry | `src/mcp/tools/` | Central place for schemas, handlers, and grouping by domain. |
| Data adapters | `src/services/data.ts` + small provider modules | Reuse existing `scripts` / `http` / `auto` logic instead of duplicating shell-out code. |
| Compatibility shim | `mcp/server.mjs` | Preserve existing repo MCP config while redirecting to the canonical implementation. |
| Client config | `.copilot/mcp-config.json`, `.mcp.json`, `package.json` scripts | All should converge on the same server path. |

This keeps the **client surface stable** while moving implementation into the main TS application stack.[^1][^3][^4][^12]

### Proposed component model

#### A. `LocalToolRegistry`

A registry module should define the canonical list of local tools and group them by domain:

- `data:nflverse`
- `data:markets`
- `pipeline`
- `publishing`
- `media`

Internally, you can keep today’s public tool names (for compatibility with prompts and smoke tests), but the implementation should no longer be split across unrelated entrypoints.[^2][^13][^14]

#### B. `DataAdapter` interface

Create a small internal adapter interface such as:

```ts
interface DataAdapter {
  execute(scriptOrOperation: string, args: Record<string, unknown>): Promise<unknown>;
}
```

Concrete adapters:

- `PythonScriptAdapter` — wraps `execFile` against `content/data/*.py`
- `HttpSidecarAdapter` — reuses `DataService` HTTP mode
- `DirectApiAdapter` — for sources like Polymarket if you later want to remove Python from those paths

This matches the repo’s real data diversity: some tools are nflverse/parquet-backed, some are HTTP-sidecar-capable, and some are external APIs.[^5][^17][^19]

#### C. Shared cache + normalization

Keep the current cache directory and TTL vocabulary. Centralize:

- cache key building
- TTL assignment
- error normalization
- LLM-facing text rendering / JSON payload wrapping[^6][^10][^16]

The current extension server already has a good normalization helper (`normalizeToolResult`) and the data tools already use consistent `textResultForLlm` / `resultType` envelopes.[^2][^6][^14]

#### D. Tool families in one process

The simplest and most valuable unified server shape is:

```text
single stdio MCP process
  ├─ pipeline tools
  ├─ nflverse tools
  ├─ prediction market tools
  ├─ publishing tools
  └─ image/render tools
```

If you want to scope more tightly at first, ship a **data-only canonical server** first, but still make it the only local data MCP process and document it as the one supported entrypoint.[^2][^12][^13]

## Recommended migration plan

### Phase 1 — Make the server boundary singular

1. Create a new TypeScript local MCP server module under `src/mcp/`.
2. Move or wrap the existing extension-tool registrations into that module.
3. Add the pipeline tools from `src/mcp/server.ts` into the same registry.
4. Change `src/cli.ts` `handleMcp()` to launch the unified server instead of the pipeline-only server.[^2][^3][^13]

**Outcome:** `npm run v2:mcp` becomes the canonical server command.[^1][^3]

### Phase 2 — Keep `mcp/server.mjs` as a compatibility shim

Do **not** delete `mcp/server.mjs` immediately. The repo-level MCP config currently points there.[^4] Instead, make it a thin wrapper that launches or imports the new canonical implementation.

That lets existing local clients keep working while you update:

- `.copilot/mcp-config.json`
- `.mcp.json`
- README setup docs
- smoke tests[^4][^11][^12]

### Phase 3 — Consolidate data execution behind shared adapters

Refactor the data tools so they no longer each define their own shell-out logic. Start with:

- a shared Python runner
- shared cache key / TTL policy
- shared error model
- shared JSON/text formatting[^5][^6][^10][^16]

Then extend `DataService` to full MCP parity:

- add rosters
- add refresh-cache
- optionally add direct wrappers for other providers[^5][^14]

### Phase 4 — Eliminate direct pipeline Python duplication where practical

After the MCP/data service layer is stable, migrate `roster-context`, `fact-check-context`, and `validators` toward shared data-adapter helpers rather than bespoke `execFileSync` calls.[^7][^8][^9]

I would treat this as a second-wave cleanup, not a prerequisite for the single-server rollout.

## Concrete design choices I recommend

### Tool naming

Keep the current tool names for continuity:

- `query_player_stats`
- `query_team_efficiency`
- `query_positional_rankings`
- `query_snap_counts`
- `query_draft_history`
- `query_ngs_passing`
- `query_combine_profile`
- `query_pfr_defense`
- `query_historical_comps`
- `query_rosters`
- `refresh_nflverse_cache`
- `query_prediction_markets`[^6][^14]

They are already in use in smoke tests and the repo’s extension surface, so renaming them would add migration cost with little benefit.[^2][^6][^14]

### Provider coverage

Treat “other providers” as first-class citizens in the same server, not as a separate MCP process. In today’s repo, prediction markets are already implemented as a different backing provider with their own Python script and external API semantics, but the tool still fits the exact same local MCP pattern.[^2][^19][^20]

That means your unified server should be conceptually “local sports intelligence MCP,” not “nflverse MCP only.”

### Transport

Keep stdio as the default transport. The repo’s existing MCP clients and smoke tests already assume stdio, and both current server implementations are stdio-based.[^2][^13]

### Language boundary

Do **not** rewrite the Python query layer as part of the first consolidation. The current scripts already encode dataset semantics and caching assumptions, and the Node layer is best used as orchestration, registration, and normalization glue in the near term.[^17][^18][^19]

## Risks and trade-offs

### Risk 1: split-brain continues if you only add more tools

If you keep `mcp/server.mjs` and `src/mcp/server.ts` as independent product surfaces, engineers will keep getting different tool sets depending on whether they use repo MCP config or CLI MCP mode.[^3][^4][^11][^13]

### Risk 2: partial `DataService` adoption creates a third abstraction layer

If you add new MCP tools partly through the extension pattern and partly through `DataService`, without declaring one canonical adapter layer, you will still have multiple data access stacks to maintain.[^5][^6][^14]

### Risk 3: direct pipeline consumers may lag behind

Even after you consolidate the local MCP server, internal pipeline code can still diverge if `roster-context`, `fact-check-context`, and validators keep their bespoke Python execution helpers forever.[^7][^8][^9]

That is manageable, but you should explicitly treat those as follow-on debt.

## Recommended implementation sequence

1. **Declare one canonical local MCP server** (TypeScript).
2. **Port/wrap all current `mcp/server.mjs` registrations** into that server.
3. **Merge the pipeline MCP tools** from `src/mcp/server.ts` into the same registry.
4. **Make `v2:mcp`, `mcp:server`, and `.copilot/mcp-config.json` all target that same server.**[^1][^3][^4]
5. **Extract a shared data-runner module** so nflverse + prediction-market handlers stop duplicating shell-out logic.[^6][^20]
6. **Extend `DataService` to parity** (rosters + refresh), then optionally have MCP handlers delegate into it.[^5][^14]
7. **Later:** migrate internal pipeline helpers onto the same adapter layer.[^7][^8][^9]

## Key Files Summary

| File | Role in the current architecture | Why it matters to the design |
|---|---|---|
| `C:\github\nfl-eval\mcp\server.mjs` | Extension-oriented local MCP server | Already aggregates data/publishing/media handlers into one stdio MCP surface.[^2] |
| `C:\github\nfl-eval\src\mcp\server.ts` | Pipeline-only MCP server | Valuable tool family, but separate from the local data tool server.[^13] |
| `C:\github\nfl-eval\src\cli.ts` | CLI launcher | `v2:mcp` currently routes to the pipeline-only server.[^3] |
| `C:\github\nfl-eval\.copilot\mcp-config.json` | Repo MCP client config | Currently points clients at `mcp/server.mjs`.[^4] |
| `C:\github\nfl-eval\.github\extensions\nflverse-query\tool.mjs` | nflverse MCP tool handlers | Existing schemas + handlers are the best starting contract for unified data tools.[^6][^14] |
| `C:\github\nfl-eval\.github\extensions\prediction-market-query\tool.mjs` | non-nflverse data tool handler | Proves “other providers” already fit the same local MCP model.[^20] |
| `C:\github\nfl-eval\src\services\data.ts` | shared data service abstraction | Best candidate for a canonical adapter layer, but currently not full parity.[^5] |
| `C:\github\nfl-eval\content\data\fetch_nflverse.py` | dataset fetch/cache utility | Defines the nflverse dataset catalog and local parquet cache model.[^17] |
| `C:\github\nfl-eval\content\data\query_player_epa.py` | representative nflverse query script | Shows the current Python-side logic and data-shaping behavior.[^18] |
| `C:\github\nfl-eval\src\pipeline\roster-context.ts` / `fact-check-context.ts` / `validators.ts` | internal direct query consumers | Show the duplication you can pay down after server consolidation.[^7][^8][^9] |

## Bottom-line recommendation

Yes — you should host the nflverse and related data tools as **one local MCP server**, and the repo is already very close. The right move is to consolidate existing MCP surfaces rather than inventing a new one: make one canonical TypeScript stdio server, migrate the extension registrations into it, preserve tool names, and centralize execution behind shared data adapters.[^2][^3][^5][^6][^13][^14] 

If you want the smallest possible implementation path, start by making the unified server host only:

- all current nflverse query tools
- `query_prediction_markets`
- `refresh_nflverse_cache`
- the existing pipeline tools[^13][^14][^20]

Then fold in publishing/media tools once the data boundary is stable.

## Confidence Assessment

**High confidence**

- There are currently two MCP entrypoints with different tool catalogs.[^1][^2][^3][^4][^13]
- The extension-oriented server already aggregates nflverse, prediction market, and publishing/media tools.[^2][^12]
- The TypeScript CLI MCP path currently launches the pipeline-only server.[^3][^13]
- Data access is duplicated across extension handlers, `DataService`, and pipeline helpers.[^5][^6][^7][^8][^9]
- The repo already prefers an MCP-first pattern for multi-client tools.[^12]

**Medium confidence**

- The best canonical location is a new TypeScript MCP server under `src/mcp/` rather than keeping `mcp/server.mjs` as the implementation home. This is a design recommendation based on the repo’s TypeScript-first runtime shape, not an existing decision in code.[^1][^3][^11]
- `DataService` should become the canonical adapter layer. That follows from current overlap and its `scripts/http/auto` design, but it still needs parity work before it can fully replace the existing extension runner logic.[^5][^14]

**Inferred / recommendation-only**

- I recommend keeping `mcp/server.mjs` as a temporary compatibility shim while clients migrate. That is not documented in the repo today; it is the lowest-friction migration design I would use given the current `.copilot/mcp-config.json` and scripts split.[^1][^4]

## Footnotes

[^1]: `C:\github\nfl-eval\package.json:9-25`
[^2]: `C:\github\nfl-eval\mcp\server.mjs:1-260`
[^3]: `C:\github\nfl-eval\src\cli.ts:622-683`
[^4]: `C:\github\nfl-eval\.copilot\mcp-config.json:1-10`
[^5]: `C:\github\nfl-eval\src\services\data.ts:1-12`, `C:\github\nfl-eval\src\services\data.ts:82-100`, `C:\github\nfl-eval\src\services\data.ts:111-149`, `C:\github\nfl-eval\src\services\data.ts:151-307`, `C:\github\nfl-eval\src\services\data.ts:310-410`
[^6]: `C:\github\nfl-eval\.github\extensions\nflverse-query\tool.mjs:1-167`, `C:\github\nfl-eval\.github\extensions\nflverse-query\tool.mjs:170-320`, `C:\github\nfl-eval\.github\extensions\nflverse-query\tool.mjs:515-590`
[^7]: `C:\github\nfl-eval\src\pipeline\roster-context.ts:52-115`
[^8]: `C:\github\nfl-eval\src\pipeline\fact-check-context.ts:44-110`
[^9]: `C:\github\nfl-eval\src\pipeline\validators.ts:41-105`
[^10]: `C:\github\nfl-eval\.github\extensions\nflverse-query\mcp-cache.mjs:1-115`
[^11]: `C:\github\nfl-eval\README.md:206-219`
[^12]: `C:\github\nfl-eval\.github\extensions\README.md:1-42`, `C:\github\nfl-eval\.github\extensions\README.md:76-109`, `C:\github\nfl-eval\.github\extensions\README.md:139-207`, `C:\github\nfl-eval\.github\extensions\README.md:210-237`
[^13]: `C:\github\nfl-eval\src\mcp\server.ts:28-153`, `C:\github\nfl-eval\src\mcp\server.ts:200-277`, `C:\github\nfl-eval\src\mcp\server.ts:279-478`
[^14]: `C:\github\nfl-eval\.github\extensions\nflverse-query\tool.mjs:64-152`, `C:\github\nfl-eval\.github\extensions\nflverse-query\tool.mjs:172-279`, `C:\github\nfl-eval\.github\extensions\nflverse-query\tool.mjs:282-320`, `C:\github\nfl-eval\.github\extensions\nflverse-query\tool.mjs:515-590`
[^15]: `C:\github\nfl-eval\.github\extensions\nflverse-query\mcp-cache.mjs:13-31`, `C:\github\nfl-eval\.github\extensions\nflverse-query\mcp-cache.mjs:45-112`
[^16]: `C:\github\nfl-eval\src\cache\provider.ts:64-104`
[^17]: `C:\github\nfl-eval\content\data\fetch_nflverse.py:1-48`, `C:\github\nfl-eval\content\data\fetch_nflverse.py:60-145`
[^18]: `C:\github\nfl-eval\content\data\query_player_epa.py:1-24`, `C:\github\nfl-eval\content\data\query_player_epa.py:27-142`, `C:\github\nfl-eval\content\data\query_player_epa.py:143-220`
[^19]: `C:\github\nfl-eval\content\data\query_prediction_markets.py:1-28`, `C:\github\nfl-eval\content\data\query_prediction_markets.py:109-163`, `C:\github\nfl-eval\content\data\query_prediction_markets.py:177-220`
[^20]: `C:\github\nfl-eval\.github\extensions\prediction-market-query\tool.mjs:1-40`, `C:\github\nfl-eval\.github\extensions\prediction-market-query\tool.mjs:88-139`
