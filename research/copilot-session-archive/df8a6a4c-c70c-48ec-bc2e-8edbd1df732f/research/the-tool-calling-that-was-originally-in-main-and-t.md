# Tool Calling in Original `main` vs `v4`, and a Cleanup Plan

## Executive Summary

This is a **technical deep-dive** into the two tool-calling models that now coexist in the app: the **original `main` app-owned tool loop** and the **`v4` typed `toolCalling` runtime**.[^1][^2] The original `main` model is simple for read-only research tools and web search, but it is tightly coupled to `AgentRunner`, string-based tool lookup, and a dashboard-wide provider allowlist.[^3][^4] The `v4` model is more extensible because it introduces typed tool definitions, safety policies, explicit execution context, and pipeline-tool support, but it also adds a second orchestration path, a second local-tool registry, and route-level prompt burdens that make the overall system harder to reason about.[^2][^5][^6]

The current merged state is therefore **functional but architecturally hybrid**: `AgentRunner` still owns the legacy `toolLoop` path while also supporting the newer `toolCalling` path, and `src/agents/local-tools.ts` now carries compatibility overloads so both APIs can work at once.[^1][^7] The cleanup goal should be to converge on **one orchestration contract**, **one canonical tool catalog**, and **one trace schema**, while keeping provider-native loops like Copilot CLI observable through adapters rather than by preserving parallel runtime models.[^1][^6][^8]

My recommendation is to standardize on the **`ToolDefinition` / `ToolCallingConfig` model** as the single future-facing abstraction, migrate the legacy `toolLoop` users onto it behind compatibility helpers, and then delete the old runner-owned loop, the string-based executor path, and the duplicate MCP local registry once the route and test migrations are complete.[^2][^5][^7]

## Architecture / System Overview

The codebase currently contains **three related but different tool layers**:

```text
                         CURRENT MERGED STATE

                   ┌─────────────────────────────┐
                   │        Dashboard/App        │
                   └──────────────┬──────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
        legacy app-owned loop            v4 typed tool-calling
        (`toolLoop`)                     (`toolCalling`)
        - provider allowlist             - requested tools
        - read-only local tools          - local + pipeline tools
        - optional web_search            - safety policy + context
                    │                           │
                    └─────────────┬─────────────┘
                                  ▼
                         `AgentRunner.run()`
                                  │
               ┌──────────────────┴──────────────────┐
               │                                     │
               ▼                                     ▼
     `getSafeLocalToolCatalog()`            `listAvailableTools()`
     string-based execute                  typed `ToolDefinition`
     + `mcp/tool-registry.mjs`             + `mcp/local-tool-registry.mjs`
               │                                     │
               └──────────────────┬──────────────────┘
                                  ▼
                           trace persistence
                      (`metadata_json`, envelopes)
```

That split exists because the original `main` design configured a **global dashboard tool loop** at `AgentRunner` construction time, while the `v4` design pushed tool selection down to **per-call `toolCalling` config** supplied by routes and pipeline actions.[^4][^5] The merged code keeps both: the app still constructs `AgentRunner` with `toolLoop: buildDashboardToolLoopOptions()`, but specific routes and pipeline actions now also pass `toolCalling` blocks with requested tools and execution context.[^4][^5]

## Original `main` Tool Calling

### What it was optimizing for

The original `main` implementation centered tool use inside `AgentRunner` itself. The constructor accepted `toolLoop` options, stored a provider allowlist and web-search flag, and later decided whether to use tool looping by checking the selected provider against `toolLoopProviders`.[^3] The dashboard wired that loop in globally through `buildDashboardToolLoopOptions()`, which enabled tool use for providers like `anthropic`, `copilot`, `gemini`, `lmstudio`, `local`, and `openai`, but explicitly excluded `copilot-cli`.[^4]

In that model, the pipeline action layer did **not** pass any tool-specific config into `runner.run()`. `runAgent()` only set the provider and trace metadata, which meant the orchestration model was effectively “dashboard- or runner-owned,” not “call-site-owned.”[^9]

### How it worked

The original loop built a prompt section from `getSafeLocalToolCatalog({ includeWebSearch })`, asked the model to respond with JSON shaped like `{type:"tool_call"}` or `{type:"final"}`, then executed tool requests by **tool name string** through `executeToolCall(toolName, args, { includeWebSearch })`.[^3][^10] That executor resolved read-only local tools from `mcp/tool-registry.mjs`, optionally exposed a synthetic `web_search` tool, and returned a legacy `ToolExecutionResult` containing the original catalog entry, args, output text, error flag, and source.[^10]

This design had three strengths:

1. It was easy to bootstrap: one global provider allowlist plus one read-only tool catalog was enough to make the dashboard tool-capable.[^3][^4]
2. It kept web search simple by treating it as a built-in exceptional tool rather than a first-class registry entry.[^10]
3. It already persisted tool-loop observability into provider envelopes through `mergeToolLoopMetadata()`, which added `toolLoop.enabled`, `toolNames`, and `toolLoop.calls` to request and response envelopes.[^3]

### Limits of the original `main` model

The simplicity came from tight coupling. Tool discovery lived in `AgentRunner`, tool execution depended on string lookups, the local registry was separate from the MCP pipeline server, and pipeline actions themselves had no explicit way to request specific tools or pass an execution context.[^3][^9][^11] That meant the model was not naturally extensible to write-capable pipeline tools, surface-based safety rules, or per-agent/per-surface selection without layering more conditionals into the runner.[^10][^12]

## `v4` Tool Calling

### What `v4` changed

The `v4` architecture introduced a **typed tool system**. `src/tools/catalog-types.ts` defines `ToolDefinition`, `ToolManifest`, `ToolSafetyPolicy`, `ToolExecutionContext`, and a normalized `ToolExecutionResult`, so tools are no longer “just names plus ad hoc handler lookups.”[^13] `src/tools/pipeline-tools.ts` uses that model to define pipeline tools as first-class typed definitions, including safety metadata such as `readOnly`, `writesState`, and `externalSideEffects`.[^12]

`v4` then changed `src/agents/local-tools.ts` from a legacy read-only helper into a typed executor layer. In the `v4` version, `ToolCallingConfig` controls whether local extensions and/or pipeline tools are included, whether write tools are allowed, which tool names or aliases are requested, and what execution context should be forwarded.[^2] `listAvailableTools()` filters tools by aliases plus safety policy, `buildToolCatalogPrompt()` emits the tool contract, and `executeToolCall(tool, args, context)` validates the request against the tool schema before invoking the handler.[^2]

### How `v4` was intended to be used

Instead of relying on a dashboard-wide provider list, `v4` call sites pass explicit `toolCalling` config into `runner.run()`. The idea-generation route requests specific aliases like `nflverse-data` and `prediction-markets`, while background knowledge refresh requests tools based on skills, and pipeline actions enable both local extensions and pipeline tools with write access plus repo/engine/config/action context.[^5][^14] That design makes tool selection explicit at the call site and moves tool safety decisions closer to the user-facing surface.[^5][^14]

Inside the runner, the `v4` path computes `requestedTools`, resolves `availableTools` with `listAvailableTools()`, appends an “Available Tools” system section via `buildToolCatalogPrompt()`, and then executes an app-managed structured loop using `chatStructuredWithResponse()` and `TOOL_LOOP_RESPONSE_SCHEMA` when tools are available and the provider is not `copilot-cli`.[^1][^2] The new path also writes `availableTools` and `toolCalls` into `metadata_json` for LLM trace persistence.[^1][^8]

### What `v4` improved

The `v4` model solves real extensibility problems:

- It gives the app a typed tool contract instead of string-only lookup.[^2][^13]
- It unifies read and write tools under safety policies and execution context.[^2][^12][^13]
- It lets pipeline actions participate in the same tool runtime as dashboard routes.[^5][^14]
- It adds targeted tests around alias filtering, schema validation, pipeline execution, and Copilot-CLI trace metadata.[^15][^16]

Those are strong building blocks for a long-term tool architecture.[^2][^13][^15]

## Why the Current Merged State Feels Messy

### 1. `AgentRunner` now owns two orchestration models

The merged runner still has the original constructor-level `toolLoop` settings, `buildToolLoopPromptPart()`, `runWithToolLoop()`, and provider allowlist logic, **and** it now also supports `toolCalling`, `listAvailableTools()`, the structured `TOOL_LOOP_RESPONSE_SCHEMA`, and a second orchestration branch for typed tools.[^1] Concretely, `run()` first decides whether the legacy provider-based loop is enabled, then separately resolves `availableTools` for the `toolCalling` path, and finally chooses between the new structured path and the old `runWithToolLoop()` path.[^1]

That means the runner is doing too much:

- provider-based routing for one tool system[^1]
- call-site-based routing for another[^1]
- legacy prompt generation for one catalog[^1][^10]
- typed prompt generation for another catalog[^1][^2]
- compatibility-layer trace persistence for both[^1][^8]

This is the clearest sign that the architecture should be cleaned up.[^1]

### 2. `local-tools.ts` is now a compatibility shim, not a clean module

The merged `src/agents/local-tools.ts` contains both the old `ToolCatalogEntry` / `ToolExecutionResult` shapes and the new typed `ToolDefinition` / `ToolCallingConfig` path.[^7] It exposes both `getSafeLocalToolCatalog()` and `listAvailableTools()`, and `executeToolCall()` is overloaded so it can accept either a `toolName: string` or a full `ToolDefinition` object.[^7]

That compatibility trick was necessary to merge the branches safely, but it is not a clean long-term abstraction. One module is currently carrying:

- legacy read-only catalog generation[^7][^10]
- web search special-casing[^7][^10]
- typed tool filtering and safety enforcement[^7]
- typed tool schema validation[^7]
- backward-compatible string dispatch[^7]

This should be split so one module owns the future abstraction and any legacy bridge lives in a short-lived adapter layer.[^7]

### 3. There are duplicate local-tool registries

The merged repo now has **two local extension registries**:

- `mcp/tool-registry.mjs`, which exposes `SAFE_READ_ONLY_TOOL_NAMES`, legacy metadata, `renderToolResultText()`, and `registerLocalTools(server)`.[^11]
- `mcp/local-tool-registry.mjs`, which exports typed `localTools` entries with aliases and safety metadata for the `v4` path.[^6]

At the same time, pipeline tools live in a third typed catalog at `src/tools/pipeline-tools.ts`, and `src/mcp/server.ts` already consumes that typed catalog through `getPipelineToolDefinitions()`.[^12][^17] In other words, the repo is already halfway to a single catalog abstraction—but local extension tools did not get the same consolidation treatment that pipeline tools did.[^6][^11][^17]

### 4. The route contract is too manual in the new path

The `v4` tool-calling path introduced a subtle prompt burden: callers must often remind the model to return the final artifact inside `{"type":"final","content":"..."}` rather than raw markdown. The idea-generation route does this explicitly, and the knowledge-refresh tests explain that the route task string must include that envelope or the runner’s structured schema validation fails.[^5][^18] This is a code smell because the orchestration contract is leaking out of the runner and into each route’s task text.[^5][^18]

### 5. Observability is better, but still adapter-shaped

The merged runner now persists `availableTools`, local `toolCalls`, and provider-native calls extracted from `responseEnvelope.toolLoop.calls` into `metadata_json`.[^1][^8] The Copilot-CLI regression tests confirm the intended behavior: when provider-native tool loops bypass the app-managed loop, traces should still record `availableTools` even if app-owned `toolCalls` stay empty.[^16]

That is useful, but it also shows the current architecture is mediating **two different concepts of tool execution**: app-managed calls and provider-managed calls.[^1][^16] A cleaner design would keep one app-level trace schema while making provider-native loops implement an adapter contract into it.[^1][^8]

## Recommended Cleanup Direction

### Recommendation: Standardize on the `v4` typed model, not the original `main` loop

The **future-facing abstraction should be `ToolDefinition` + `ToolCallingConfig` + `ToolExecutionContext`**, not the original `toolLoop` model.[^2][^13] That recommendation follows directly from the code:

- The typed model already supports both local extension tools and pipeline tools.[^2][^12]
- It already has safety metadata and execution context.[^2][^13]
- It already has tests for alias filtering, validation, and execution.[^15]
- The legacy model depends on string names, a hard-coded web-search special case, and a dashboard-global provider allowlist.[^3][^4][^10]

The original `main` tool loop should therefore be treated as a **migration bridge**, not as the target architecture.[^1][^3]

## Proposed Target Architecture

```text
Call site
  └─> runner.run({ toolRequest })
         └─> ToolRegistry.resolve(toolRequest)
                ├─ local extension tools
                ├─ pipeline tools
                └─ optional provider-adapter tools (if any)
         └─> ToolExecutor.execute(definition, args, context)
         └─> TraceRecorder.record({
                availableTools,
                toolCalls,
                providerToolCalls
             })

MCP servers
  └─> adapt the same ToolRegistry entries into MCP tool descriptors
```

That architecture keeps **one canonical catalog** and **one execution model**, then lets MCP exposure and provider-native tool loops be adapters layered around it rather than parallel runtime stacks.[^6][^12][^13][^17]

## Cleanup Plan

### Phase 1: Define the canonical runtime boundary

1. **Create one canonical catalog package under `src/tools/`** for all app-visible tools.[^12][^13]
   - Keep `catalog-types.ts`.
   - Keep `pipeline-tools.ts`.
   - Add a typed `local-extension-tools.ts` that replaces `mcp/local-tool-registry.mjs` and eventually supersedes `mcp/tool-registry.mjs`.[^6][^11][^12][^13]

2. **Make `ToolDefinition` the only source of truth** for:
   - manifest
   - aliases
   - safety policy
   - handler
   - optional adapter metadata for MCP exposure.[^6][^12][^13]

3. **Move web search into the same typed model** instead of keeping it as a special case inside `executeToolCall(toolName, ...)`.[^7][^10]
   - Either define a `web_search` `ToolDefinition` in `src/tools/`.
   - Or delete it if it is no longer wanted.
   - Do not keep it as a hidden branch inside the legacy executor.[^7][^10]

### Phase 2: Collapse `AgentRunner` to one public tool API

1. **Replace `toolLoop?: AgentToolLoopOptions` with one `toolCalling`-style runtime config** at runner construction or call time, but not both.[^1][^4]
2. **Delete `buildToolLoopPromptPart()` and `runWithToolLoop()` after migration**, replacing them with a single structured execution path built around resolved `ToolDefinition[]`.[^1]
3. **Remove provider allowlist routing from dashboard bootstrap** and instead let each call site decide which tools it wants.[^4][^5]
4. **Keep provider-native tool support as an adapter only**:
   - if a provider like Copilot CLI owns tool execution, record its tool calls through a provider-to-trace adapter
   - but do not preserve a second top-level runner orchestration model for it.[^1][^16]

### Phase 3: Remove compatibility shims from `local-tools.ts`

1. Delete the legacy `ToolCatalogEntry` / legacy `ToolExecutionResult` types.[^7]
2. Delete the string-based `executeToolCall(toolName, ...)` overload.[^7][^10]
3. Delete `getSafeLocalToolCatalog()` after all legacy callers are migrated to `listAvailableTools()` or its replacement.[^7][^10]
4. Split the remaining module into:
   - `ToolRegistry`
   - `ToolExecutor`
   - optional `ToolPromptBuilder` (if prompt shaping still belongs in app code).[^7]

### Phase 4: Remove duplicate registries and MCP drift

1. Make both MCP entrypoints adapt from the same canonical tool registry:
   - `src/mcp/server.ts` already does this for pipeline tools.[^17]
   - `mcp/server.mjs` should stop depending on a separate `tool-registry.mjs` source of truth and instead adapt the same local extension definitions used by the app runtime.[^6][^11]
2. Delete either `mcp/tool-registry.mjs` or `mcp/local-tool-registry.mjs`; they should not coexist long-term.[^6][^11]

### Phase 5: Centralize the prompt contract

The current route tests prove that route tasks must manually repeat the final envelope contract for the `toolCalling` path.[^5][^18] That should be centralized.

Recommended approach:

- Let the runner own the final response contract when tools are enabled.[^1][^18]
- Give call sites only the artifact semantics they actually care about (“return an idea markdown body”, “return a knowledge brief”), not the full control-message envelope.[^5][^18]
- Add one explicit runner option for “final content should contain artifact text” if needed, rather than making every route remember to hand-write the JSON envelope instructions.[^5][^18]

### Phase 6: Keep and sharpen the observability model

The trace layer is already close to good. `Repository` persists `metadata_json`, and the runner now records `availableTools`, app-owned `toolCalls`, and provider-derived tool calls.[^1][^8] Keep that shape, but normalize it into one explicit schema such as:

```json
{
  "availableTools": ["article_get", "query_player_stats"],
  "toolCalls": [
    {
      "toolName": "article_get",
      "source": "pipeline",
      "mode": "app" | "provider",
      "isError": false,
      "args": { "article_id": "..." }
    }
  ]
}
```

That would make provider-native loops and app-managed loops comparable without preserving two orchestration systems in the runner itself.[^1][^8][^16]

## Concrete Refactor Sequence

1. **Introduce `src/tools/local-extension-tools.ts`** and migrate `mcp/local-tool-registry.mjs` data into it.[^6]
2. **Create a `ToolRegistry` class** that exposes:
   - `resolve(requestedTools, context, policy)`
   - `listBySurface(...)`
   - `toMcpDescriptors(...)`.[^12][^13][^17]
3. **Rewrite `src/agents/local-tools.ts` as a thin compatibility layer** that delegates to `ToolRegistry` and `ToolExecutor`.[^7]
4. **Switch all current `toolLoop` call sites to `toolCalling` helpers**:
   - idea generation[^5]
   - knowledge refresh[^5]
   - pipeline actions[^14]
5. **Replace `buildDashboardToolLoopOptions()` with a migration shim**, then remove it once `tests/dashboard/server.test.ts` is updated to assert the new call-site-driven policy instead of the old provider allowlist.[^4][^19]
6. **Delete the legacy runner loop** once there are no remaining `toolLoop`-only callers.[^1]
7. **Delete `mcp/tool-registry.mjs`** after MCP local-tool exposure also uses the canonical typed catalog.[^6][^11]

## Validation Strategy

A safe cleanup should preserve four test classes already present in the repo:

1. **Tool registry / executor tests**  
   `tests/agents/local-tools.test.ts` already covers alias filtering, validation, and execution with repository context; these should move intact to the new registry/executor boundary.[^15]

2. **Runner structured tool tests**  
   `tests/agents/runner.test.ts` already covers `toolCalling` execution and trace metadata for the newer path.[^20]

3. **Provider-bypass observability tests**  
   `tests/agents/tool-trace-copilot-cli.test.ts` should remain to ensure provider-native loops stay visible in traces even if the app does not own execution.[^16]

4. **Route contract tests**  
   `tests/dashboard/agents.test.ts` currently documents the envelope burden. During cleanup, those tests should be rewritten to assert the new centralized runner contract instead of manual route strings.[^18]

## Key Files Summary

| Area | Current Purpose | Key Evidence |
|---|---|---|
| Runner orchestration | Hybrid legacy + `v4` orchestration in one class | `C:\github\nfl-eval\src\agents\runner.ts`[^1] |
| Legacy local tool path | Original string-based read-only execution + web search | `C:\github\nfl-eval\src\agents\local-tools.ts` (commit `289ce3c`)[^10] |
| Typed tool model | Canonical `ToolDefinition` / context / safety abstractions | `C:\github\nfl-eval\src\tools\catalog-types.ts`[^13] |
| Pipeline tool catalog | Typed pipeline tools with safety metadata | `C:\github\nfl-eval\src\tools\pipeline-tools.ts`[^12] |
| Dashboard bootstrap | Legacy provider allowlist still globally enabled | `C:\github\nfl-eval\src\dashboard\server.ts`[^4] |
| Route call sites | New per-call `toolCalling` usage | `C:\github\nfl-eval\src\dashboard\server.ts`, `C:\github\nfl-eval\src\pipeline\actions.ts`[^5][^14] |
| MCP local registry | Legacy local tool exposure | `C:\github\nfl-eval\mcp\tool-registry.mjs`[^11] |
| MCP typed local registry | New local extension tool registry | `C:\github\nfl-eval\mcp\local-tool-registry.mjs`[^6] |
| MCP pipeline server | Already adapted to typed tool definitions | `C:\github\nfl-eval\src\mcp\server.ts`[^17] |
| Trace persistence | Shared metadata persistence seam | `C:\github\nfl-eval\src\db\repository.ts`[^8] |

Repository: [JDL440/nfl-eval](https://github.com/JDL440/nfl-eval)

## Confidence Assessment

**High confidence**

- The repo currently contains two live orchestration paths in `AgentRunner`, not just one migrated replacement.[^1]
- The legacy path is global/provider-driven while the `v4` path is per-call/request-driven.[^4][^5][^9][^14]
- The merged `local-tools.ts` is carrying explicit backward-compatibility overloads and should not be treated as an ideal end state.[^7]
- Duplicate local registries (`mcp/tool-registry.mjs` and `mcp/local-tool-registry.mjs`) are real and should be consolidated.[^6][^11]

**Medium confidence**

- Standardizing on the `v4` typed model is the right long-term direction. The code strongly suggests this because pipeline tools, safety policies, and context-aware execution already live there, but it is still an architectural recommendation rather than an explicitly documented product decision.[^2][^12][^13]
- Centralizing the final-envelope prompt contract inside the runner is likely the cleanest fix for route-level prompt drift, but there are still some model-behavior trade-offs that may require small caller hints even after cleanup.[^5][^18]

**Assumptions**

- I treated commit `289ce3c` as the “original `main`” baseline and commit `9cba6d7` as the representative `v4` baseline, because those are the concrete pre-reconciliation states visible in the repo history and merge work.[^21]
- I treated the current `main` commit `132fdca` as the merged hybrid state to analyze cleanup needs, rather than as the desired final architecture.[^21]

## Footnotes

[^1]: `C:\github\nfl-eval\src\agents\runner.ts:15-23,49-72,131-194,333-352,579-617,808-843,907-1074` (commit `132fdca`)
[^2]: `C:\github\nfl-eval\src\agents\local-tools.ts:1-57,85-92,176-247,437-523` (commit `132fdca`); `C:\github\nfl-eval\src\agents\local-tools.ts:1-231` (commit `9cba6d7`)
[^3]: `C:\github\nfl-eval\src\agents\runner.ts:574-858` (commit `289ce3c`)
[^4]: `C:\github\nfl-eval\src\dashboard\server.ts:139-152` (commit `289ce3c`); `C:\github\nfl-eval\src\dashboard\server.ts:3079-3087` (commit `132fdca`); `C:\github\nfl-eval\tests\dashboard\server.test.ts:68-75` (commit `132fdca`)
[^5]: `C:\github\nfl-eval\src\dashboard\server.ts:1204-1243,2722-2740,2794-2814` (commit `132fdca`); `C:\github\nfl-eval\src\dashboard\server.ts:1202-1228` (commit `9cba6d7`)
[^6]: `C:\github\nfl-eval\mcp\local-tool-registry.mjs:1-161` (commit `132fdca`)
[^7]: `C:\github\nfl-eval\src\agents\local-tools.ts:14-57,390-431,437-567` (commit `132fdca`)
[^8]: `C:\github\nfl-eval\src\db\repository.ts:132-180,275-285,920-1008` (commit `132fdca`)
[^9]: `C:\github\nfl-eval\src\pipeline\actions.ts:522-534` (commit `289ce3c`)
[^10]: `C:\github\nfl-eval\src\agents\local-tools.ts:229-321` (commit `289ce3c`)
[^11]: `C:\github\nfl-eval\mcp\tool-registry.mjs:1-120,512-557` (commit `132fdca`)
[^12]: `C:\github\nfl-eval\src\tools\pipeline-tools.ts:1-220` (commit `132fdca`)
[^13]: `C:\github\nfl-eval\src\tools\catalog-types.ts:1-104` (commit `132fdca`)
[^14]: `C:\github\nfl-eval\src\pipeline\actions.ts:522-550` (commit `9cba6d7`); `C:\github\nfl-eval\src\pipeline\actions.ts:522-551` (commit `132fdca`)
[^15]: `C:\github\nfl-eval\tests\agents\local-tools.test.ts:10-65` (commit `132fdca`)
[^16]: `C:\github\nfl-eval\tests\agents\tool-trace-copilot-cli.test.ts:1-16,86-150,207-259` (commit `132fdca`)
[^17]: `C:\github\nfl-eval\src\mcp\server.ts:1-103` (commit `132fdca`); `C:\github\nfl-eval\src\mcp\server.ts:1-120` (commit `289ce3c`)
[^18]: `C:\github\nfl-eval\tests\dashboard\agents.test.ts:283-288` (commit `132fdca`); `C:\github\nfl-eval\src\dashboard\server.ts:1204-1208` (commit `132fdca`)
[^19]: `C:\github\nfl-eval\tests\dashboard\server.test.ts:1-10,68-75` (commit `289ce3c`); `C:\github\nfl-eval\tests\dashboard\server.test.ts:68-75` (commit `132fdca`)
[^20]: `C:\github\nfl-eval\tests\agents\runner.test.ts:850-980` (commit `9cba6d7`)
[^21]: `C:\github\nfl-eval` history: current `main` at commit `132fdca`, prior `v4` head `9cba6d7`, prior `main` baseline `289ce3c` as verified in local git history on 2026-03-29.
