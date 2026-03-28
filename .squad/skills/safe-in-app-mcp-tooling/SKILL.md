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

This keeps the policy provider-agnostic even if the MCP server itself exposes more tools.

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

## Anti-patterns

- Enabling the whole MCP server just because one safe tool is needed
- Relying on prompt text alone without runtime validation
- Letting providers own tool policy instead of the app runtime
- Exposing mutating publish/media tools to writer/editor-style in-app agents
