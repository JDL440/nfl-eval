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

Treat in-app MCP enablement as a **double-enforced allowlist**:

1. **Provider layer**
   - use `--available-tools=...` to decide what the model can even see
   - use `--allow-tool=...` to pre-approve that exact surface for non-interactive runs
2. **Prompt layer**
   - tell the agent which local tools are allowed
   - tell it to call `local_tool_catalog` first when it needs tool discovery or argument examples

This keeps the runtime explicit even if the MCP server itself exposes more tools.

## Copilot CLI specifics

- `--available-tools` controls visibility
- `--allow-tool` controls approval prompts
- If you need repo-local MCP config to load, run the CLI from the **workspace root** for tool-enabled calls
- If you want plain text generation without repo context, keep no-tool calls in a sandbox cwd

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
- Relying on prompt text alone without provider-side tool filtering
- Leaving tool-enabled calls in a sandbox cwd that cannot load repo-local MCP config
- Exposing mutating publish/media tools to writer/editor-style in-app agents
