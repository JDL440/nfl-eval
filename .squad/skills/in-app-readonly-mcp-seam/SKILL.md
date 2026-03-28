---
name: In-App Read-Only MCP Seam
domain: agent-runtime
confidence: high
tools: [view, rg, vitest]
---

# In-App Read-Only MCP Seam

## When to Use

- You want in-app agents to use a local MCP-style tool surface.
- The app already has a text-only agent runtime and multiple model providers.
- Some local tools are safe read-only queries, while others publish, write files, or refresh caches.

## Pattern

Treat tool access as an **application runtime contract**, not a provider feature toggle.

1. Keep the agent runner as the orchestration seam.
2. Add a repo-owned structured tool loop:
   - model proposes a tool call in JSON
   - runtime validates it
   - runtime executes an allowlisted tool in-process
   - runtime feeds the result back into the conversation
   - identical tool calls in the same run reuse cached results instead of re-executing
3. Keep the first rollout provider-agnostic. Do not require provider-native function calling.
4. Reuse the existing local tool registry metadata as the source of truth for:
   - tool names
   - argument schemas
   - category labels
   - read-only vs mutating posture
   - examples / discoverability text

## Approved-first rollout shape

- Allow `local_tool_catalog`
- Allow read-only data query tools
- Deny publishing, media-generation, and cache-refresh tools
- Default-deny all future tools until reviewed

## Why

- A provider may not support tools at all.
- A provider may support tools but with behavior the app does not control.
- A repo-owned loop keeps allowlisting, validation, observability, and retry bounds inside the application.

## Guardrails

1. Do not spawn the local MCP stdio server from inside the app just to use local tools.
2. Execute shared handlers directly in-process.
3. Bound tool hops per run.
4. Fail closed on unknown tools or invalid arguments.
5. Require a final JSON-wrapped text answer once the tool budget is exhausted.
6. Add tests that prove the in-app allowlist matches the approved registry subset.
6. Deduplicate repeated identical tool calls inside one run so the same lookup is not re-executed.
7. Keep an explicit blocked set for publishing, media-generation, and cache-refresh tools even if registry metadata drifts.

## NFL Lab Example

- Discovery/source-of-truth seam: `mcp\tool-registry.mjs`
- Runtime implementation (COMPLETE): 
  - `src\agents\local-tools.ts` — loads approved registry subset, validates schemas, executes handlers, deduplicates calls
  - `src\agents\runner.ts` — injects tool prompt, loops on JSON decisions, integrates tool results into conversation
  - `LOCAL_TOOL_DECISION_SCHEMA` — model proposes `{type: "tool_call", toolName, args}` or `{type: "final", content}`
- Approved tools (12): `local_tool_catalog`, 11 nflverse queries
- Blocked tools (6): `publish_to_substack`, `render_table_image`, `publish_note_to_substack`, `publish_tweet`, `generate_article_images`, `refresh_nflverse_cache`
- Test coverage: `tests\agents\local-tools.test.ts` (allowlist + schema validation), `tests\agents\runner.test.ts` (tool loop integration)
