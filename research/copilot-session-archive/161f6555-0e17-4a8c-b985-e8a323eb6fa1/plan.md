# V4 LLM Tool Calling Plan

## Problem

Add app-managed tool calling for in-app LLM workflows in `llminputs`, covering `AgentRunner`, pipeline/dashboard agent surfaces, and MCP tool catalog cleanup, without depending on provider-native tool APIs.

User-confirmed scope/defaults:

- Scope: `AgentRunner` + pipeline/dashboard surfaces + MCP tool catalog cleanup
- Execution model: app-managed tool loop over a repo-owned tool schema
- Safety: write-capable pipeline tools are allowed in V1
- Copilot CLI: excluded from this V4 plan (parallel track handled separately)

## Status

- Completed on branch/worktree: `v4` at `C:\github\worktrees\llminputs\worktrees\v4`
- Implemented:
  - shared in-app/MCP tool catalog primitives
  - in-process local tool executor
  - bounded `AgentRunner` JSON tool loop
  - dashboard + pipeline wiring
  - MCP catalog cleanup across `src\mcp\server.ts` and `mcp\server.mjs`
  - `llm_traces.metadata_json` tool-call persistence
  - focused tests + README updates
- Validation completed:
  - `npm run v2:build`
  - `npm run v2:test -- tests\agents\local-tools.test.ts tests\agents\runner.test.ts tests\mcp\server.test.ts`
  - `npm run v2:test -- tests\pipeline\actions.test.ts tests\dashboard\server.test.ts tests\db\repository.test.ts`
- Remaining operational step:
  - none for V4 implementation itself

## Branch sync notes

- `v4` has been merged forward from `origin/main` twice after the initial V4 implementation landed.
- Latest sync commit: `624a49b` (`Merge remote-tracking branch 'origin/main' into v4`)
- Post-sync sanity check completed with `npm run v2:build`

Branch note:

- Local branch `v4` has been created from `origin/main`

## Current architecture snapshot

- `src/agents/runner.ts` is still a single-shot prompt builder + `LLMGateway.chat()` call. There is no tool loop today.
- `src/llm/gateway.ts` supports plain chat plus JSON-mode structured output (`chatStructured()`), but has no tool-call contract.
- `src/llm/providers/copilot.ts` and `src/llm/providers/lmstudio.ts` are the best first-wave providers for an app-managed loop because they already support JSON-oriented request/response handling.
- `src/llm/providers/copilot-cli.ts` explicitly suppresses tool use and should stay out of this V4 rollout.
- Tool definitions are split today:
  - `mcp\server.mjs` manually registers extension-backed local tools from `.github/extensions/*/tool.mjs`
  - `src\mcp\server.ts` exposes a separate pipeline MCP surface with a static tool list
- The repo has tool manifests/handlers already, but not a canonical importable registry or an in-process executor for `AgentRunner`.

## Proposed approach

### Slice 1 — Canonical tool registry and safety model

Create a single repo-owned registry/policy seam that can serve both in-app tool execution and MCP transport layers.

Likely work:

- Add a canonical registry module (for example `src\mcp\tool-registry.ts` or `src\tools\registry.ts`)
- Normalize tool metadata pulled from `.github/extensions/*/tool.mjs`
- Add explicit safety metadata per tool:
  - `readOnly`
  - `writesState`
  - `externalSideEffects`
  - `defaultTarget`
  - allowed surfaces / allowed agents
- Define the first-wave allowlist for V4

Goal:

- One source of truth for tool names, schemas, handlers, and safety policy

### Slice 2 — In-process executor for app-owned tool calls

Introduce an in-process execution layer for tools that `AgentRunner` can call without going through stdio MCP transport.

Likely work:

- Add `src\agents\local-tools.ts` (or similar) to:
  - list allowed tools for a given run
  - validate arguments before execution
  - execute tool handlers
  - normalize tool results/errors into a stable LLM-facing format
- Reuse the canonical registry rather than duplicating tool manifests
- Fail closed on:
  - unknown tools
  - invalid args
  - disallowed tools for the current surface/agent

Goal:

- A deterministic in-process runtime that can be called from `AgentRunner` and tested independently

### Slice 3 — Tool-call contract in gateway/runner

Extend the in-app LLM contract from plain text/JSON-only into a bounded app-managed tool loop.

Likely work:

- Extend `src\llm\gateway.ts` request/response types with a tool-call envelope
- Keep provider adapters simple by using an app-level JSON contract first instead of vendor-native tool APIs
- Update `src\agents\runner.ts` to:
  - advertise the allowed tool catalog to the model
  - accept a structured tool-call response
  - execute tool calls through the in-process executor
  - append tool results back into the conversation
  - continue until final answer or hard stop
- Add hard controls:
  - max tool calls per run
  - duplicate-call suppression
  - timeout budget
  - invalid-tool retry/fail behavior

Goal:

- Provider-agnostic tool calling for in-app agents without requiring native tool support

### Slice 4 — Surface integration

Wire the new runtime into the surfaces that already depend on `AgentRunner`.

Likely work:

- Pipeline actions in `src\pipeline\actions.ts`
- Dashboard/API surfaces that invoke agent workflows via `ActionContext`
- Agent skill/charter conventions so agents know which tools are available
- Per-surface allowlists for mutating vs non-mutating tools

Expected initial behavior:

- Tool-capable in-app agent runs on pipeline/dashboard surfaces
- Copilot CLI remains text-only in this wave

### Slice 5 — MCP catalog cleanup

Make MCP transports consume the same registry/policy seam so the stdio server and in-app runtime stop drifting.

Likely work:

- Refactor `mcp\server.mjs` to register tools from the canonical registry
- Refactor `src\mcp\server.ts` to either:
  - consume the same registry directly, or
  - clearly separate pipeline-only tools but share schema/policy primitives
- Remove duplicated schema conversion logic where possible

Goal:

- One catalog, two transports (in-app + MCP), no duplicated tool definitions

### Slice 6 — Tracing, tests, and docs

Add observability and validation before rollout.

Likely work:

- Trace tool requests/results alongside current LLM traces
- Decide whether tool events belong in:
  - enriched `llm_traces` metadata, or
  - a dedicated `llm_tool_calls` table
- Add/update tests across:
  - gateway
  - runner
  - local tool executor
  - MCP server parity
  - pipeline integrations
  - dashboard integrations
- Update docs/config so V4 has one documented tool-calling path

Goal:

- Safe rollout with debuggable traces and no hidden execution path

## Candidate files

Likely new:

- `src\agents\local-tools.ts`
- `src\mcp\tool-registry.ts` or `src\tools\registry.ts`
- `tests\agents\local-tools.test.ts`
- possibly a tool-call tracing helper/test module

Likely modified:

- `src\agents\runner.ts`
- `src\llm\gateway.ts`
- `src\pipeline\actions.ts`
- `src\dashboard\server.ts`
- `src\mcp\server.ts`
- `mcp\server.mjs`
- `.github\extensions\*\tool.mjs`
- `README.md`
- provider adapters only where JSON contract needs tightening (`copilot.ts`, `lmstudio.ts`, `mock.ts`)

Likely deferred from this plan:

- Native tool-calling support in `src\llm\providers\copilot-cli.ts`
- Provider-native Anthropic/Gemini tool-call adapters

## Risks / considerations

- Tool catalog drift between `mcp\server.mjs` and `src\mcp\server.ts`
- Mutating tools in V1 need explicit policy gates even though the rollout allows write-capable pipeline tools
- Some extension handlers have external side effects or environment coupling; these need strong metadata and test coverage
- App-managed JSON tool calling must be robust against malformed model output
- Tool traces need a clear persistence design before implementation starts

## Validation plan

- Registry parity tests: one canonical catalog for in-app runtime and MCP list/call surfaces
- Runner loop tests:
  - tool call -> tool result -> final response
  - max-call budget
  - duplicate-call suppression
  - invalid-tool handling
- Permission tests for surface/agent allowlists
- Pipeline/dashboard integration tests on tool-enabled runs
- Build + focused Vitest suites before merging

## Notes

- The cleanest V4 path is not “teach each provider tools first”; it is “introduce one app-owned tool loop and let providers stay mostly chat/json adapters”.
- Copilot API and LM Studio are the best first-wave targets because they already fit the app-owned JSON contract well.
- `copilot-cli` should remain outside this plan until the parallel work on that provider lands.
