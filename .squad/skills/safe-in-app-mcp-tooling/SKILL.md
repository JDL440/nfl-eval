---
name: Safe In-App MCP Tooling
domain: llm-runtime
confidence: high
tools: [view, rg, powershell]
---

# Safe In-App MCP Tooling

## When to use

- An in-app agent runtime needs access to repo-local MCP tools
- The repo already has a mixed tool surface with both read-only and mutating MCP tools
- Copilot CLI is the provider and you need safe, explicit tool exposure instead of `--allow-all-tools`

## Pattern

Treat in-app MCP enablement as an **app-owned bounded loop**:

1. **Registry-derived allowlist**
   - load runtime metadata from `mcp\tool-registry.mjs`
   - keep only explicitly approved tool names
   - require `readOnlyHint: true`
2. **Prompt contract**
   - tell the agent which tools are allowed
   - tell it to call `local_tool_catalog` first when it needs argument examples
   - require a strict machine-readable tool request shape
3. **Runtime enforcement**
   - validate arguments against the exported tool schema
   - reject non-allowlisted tools
   - bound the number of tool calls
   - execute handlers in process

For LM Studio or other OpenAI-compatible local providers, keep the loop app-owned and request structured output with a JSON schema response format. Do not rely on provider-native MCP support or `json_object` shortcuts when the local runtime expects `json_schema`.

If a local provider rejects the structured-response transport shape outright, the safe fallback is still fail-closed at the runtime seam: allow plain text transport, strip wrapper noise (thinking tags, code fences, surrounding prose), extract one balanced JSON candidate, and require full schema validation before any tool executes.

This keeps the policy provider-agnostic even if the MCP server itself exposes more tools.

## Implementation in V4

The v4 branch implements this pattern in production:

- **Tool system:** `src/tools/catalog-types.ts` defines `ToolDefinition` + `ToolSafetyPolicy` (structured, not advisory).
- **Tool loop:** `src/agents/runner.ts` runs the iterative loop: compose prompt → send request → parse JSON response → execute tool → loop or finalize.
- **Pipeline tools:** `src/tools/pipeline-tools.ts` implements read-only article/pipeline operations under the same safety envelope as local extensions.
- **Safety model:** `ToolSafetyPolicy` enforces `readOnly: true`, surface/agent allowlists, and max iterations.
- **Registry:** Both `mcp/local-tool-registry.mjs` (extensions) and pipeline tools are discoverable at runtime.

**Difference from advisory hints:** Tools are not blocked by human-readable hints (readOnlyHint) — they're blocked by a structured enum (readOnly: boolean). This makes permissions testable.

## Safe default for this repo

Use only:

- `local_tool_catalog`
- the read-only local query tools

Do **not** expose:

- publishing tools
- image-generation tools
- cache-refresh tools
- generic file or shell tools

## Validation

- `npm run v2:build`
- `npx vitest run tests\agents\runner.test.ts tests\llm\gateway.test.ts tests\llm\provider-copilot-cli.test.ts tests\mcp\local-tool-registry.test.ts`
- For LM Studio validation, use a live dashboard run plus the trace page to confirm tool-loop metadata and actual tool calls.
- Positive live signature:
  - provider request envelope includes `toolLoop.enabled: true`, `toolLoop.maxToolCalls`, and the allowed `toolNames`
  - provider response envelope includes `toolLoop.calls` with concrete tool names, sources, and `isError` flags
- Negative/fallback signature:
  - LM Studio trace completes with no provider envelopes or no `toolLoop` block at all
  - treat that as chat-only unless another persisted trace surface independently shows executed tool calls

## Provider compatibility check

- The app-owned tool loop depends on provider-supported **structured JSON output** even when provider-native tool calling is not used.
- For LM Studio in this repo, verify the provider accepts the exact `response_format` shape emitted by `src\llm\providers\lmstudio.ts` before assuming the tool loop will work live.
- A live LM Studio run with `qwen/qwen3.5-35b-a3b` rejected `response_format: { type: 'json_object' }` and required `json_schema` or `text`, so direct text chat can work while the tool loop still fails on its first structured turn.

## Anti-patterns

- Enabling the whole MCP server just because one safe tool is needed
- Relying on prompt text alone without runtime validation
- Letting providers own tool policy instead of the app runtime
- Exposing mutating publish/media tools to writer/editor-style in-app agents
