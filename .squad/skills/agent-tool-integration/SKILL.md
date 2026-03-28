---
name: agent-tool-integration
description: Safely integrate read-only tools into agent system prompts and enable tool discovery
domain: agent-architecture
confidence: 0.95
tools: [local_tool_catalog, query_player_stats, query_team_efficiency]
---

# Agent Tool Integration Pattern

## Problem

In a multi-agent pipeline, agents are pure LLM oracles: they process text and return text. Tools (data queries, publishing, media generation) live in a separate MCP server and are not discoverable to agents. This creates an **agency gap**: agents have no way to:

1. Learn what tools exist
2. Know if a tool call is safe (read-only, no side effects)
3. Invoke a tool and integrate results

Result: agents must complete tasks using only LLM inference, missing opportunities for fact-checking, data enrichment, and autonomous decision-making.

## Solution

**Bridge the systems via system prompt injection.** Agents gain tool awareness without changing core LLM invocation logic.

### Pattern Components

#### 1. Role-Based Tool Allowlist

Tools are exposed per agent role, not per-request. This simplifies security and intent clarity.

```typescript
const AGENT_TOOL_ALLOWLIST: Record<string, string[]> = {
  'writer': [
    'query_player_stats',
    'query_team_efficiency',
    'query_snap_counts',
    'query_positional_rankings',
    'query_draft_history',
    'query_ngs_passing',
    'query_combine_profile',
    'query_pfr_defense',
    'query_historical_comps',
    'query_rosters',
    'local_tool_catalog',
  ],
  'editor': [
    // same as writer: can query data to fact-check
    'query_player_stats',
    'query_team_efficiency',
    'query_snap_counts',
    'query_positional_rankings',
    'query_draft_history',
    'query_ngs_passing',
    'query_combine_profile',
    'query_pfr_defense',
    'query_historical_comps',
    'query_rosters',
    'local_tool_catalog',
  ],
  'publisher': [
    // all of editor's tools + publishing
    'query_player_stats',
    'query_team_efficiency',
    'query_snap_counts',
    'query_positional_rankings',
    'query_draft_history',
    'query_ngs_passing',
    'query_combine_profile',
    'query_pfr_defense',
    'query_historical_comps',
    'query_rosters',
    'local_tool_catalog',
    'publish_to_substack',
    'publish_note_to_substack',
    'publish_tweet',
  ],
};
```

**Principle:** Allowlist is conservative. Only safe (read-only, no side effects) tools are exposed by default. Publishing tools require explicit publisher role.

#### 2. Tool Metadata Injection into System Prompt

Each tool is described in the system prompt with:
- **Name:** Exact tool identifier
- **Description:** Human-readable purpose
- **Side effects:** "none (read-only)" or "writes to X"
- **Example input:** JSON schema example

```markdown
## Available Tools

Use these tools when you need external data or want to publish content.

### query_player_stats — Query Player Stats
Read-only nflverse query for one player's season-level efficiency output.
Best when you know the player name and season and want EPA/efficiency context with rank.

- Side effects: none (read-only data lookup)
- Required arguments: player, season
- Example arguments:
  ```json
  { "player": "Jaxon Smith-Njigba", "season": 2025 }
  ```

### query_team_efficiency — Query Team Efficiency
Read-only team-level efficiency lookup for one season. Use a 3-letter team code like SEA, KC, or BUF.

- Side effects: none (read-only data lookup)
- Required arguments: team, season
- Example arguments:
  ```json
  { "team": "SEA", "season": 2025 }
  ```

### local_tool_catalog — Local Tool Catalog
Discover the NFL Lab local MCP tool surface before calling another tool.

- Side effects: none (read-only help)
- Optional arguments: category, tool_name, include_examples
- Example arguments:
  ```json
  { "tool_name": "query_player_stats" }
  ```

## Tool Usage

When a tool call would improve the task outcome, invoke it using tool_use XML tags:

```xml
<tool_use name="query_player_stats">{ "player": "Jaxon Smith-Njigba", "season": 2025 }</tool_use>
```

You may invoke multiple tools in one response. Wait for results before drawing conclusions.
```

**Implementation Detail:** System prompt builder extracts this from the tool catalog module and formats it cleanly.

#### 3. Tool Invocation via Tool_Use XML Tags

Agents invoke tools by emitting `<tool_use>` XML tags in their response. This is portable across LLM providers that support structured output (Claude, GPT-4, Qwen, etc.).

```xml
<tool_use name="query_player_stats">{ "player": "Travis Kelce", "season": 2025 }</tool_use>

Here's the EPA data for Travis Kelce in 2025: [tool result would be inserted here]
```

**Why XML tags?**
- Provider-agnostic (works with JSON mode, function calls, raw text)
- Easy to parse with regex
- Natural to read in the response
- Signals tool intent clearly

#### 4. Tool Execution Handler (Phase 4+)

Once agents reliably emit tool_use tags, a post-processing step extracts and executes them:

```typescript
async function executeAgentTools(response: string, toolHandlers: Map<...>): string {
  const matches = response.matchAll(/<tool_use name="([^"]+)">(.+?)<\/tool_use>/gs);
  let result = response;
  
  for (const match of matches) {
    const [fullTag, toolName, argsStr] = match;
    const args = JSON.parse(argsStr);
    
    try {
      const handler = toolHandlers.get(toolName);
      if (!handler) throw new Error(`Unknown tool: ${toolName}`);
      
      const toolResult = await handler(args);
      result = result.replace(fullTag, `\n[Tool result: ${JSON.stringify(toolResult)}]\n`);
    } catch (err) {
      result = result.replace(fullTag, `\n[Tool error: ${err.message}]\n`);
    }
  }
  
  return result;
}
```

## Implementation Checklist

- [ ] Extract tool catalog to `src/mcp/tool-catalog.ts` (TypeScript module)
- [ ] Define `SAFE_READ_ONLY_TOOLS` set with 9 NFL data tools + local_tool_catalog
- [ ] Define `AGENT_TOOL_ALLOWLIST` role-based mapping
- [ ] Extend `AgentRunParams` with `toolAllowlist?: string`
- [ ] Extend `composeSystemPrompt()` to inject tool descriptions and usage instructions
- [ ] Add tests: verify tool allowlist per agent, tool catalog in system prompt
- [ ] Manual validation: capture system prompt from running article, inspect tool section

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Agent hallucinates tool names | Hardcode allowlist; validate tool names before passing to LLM |
| Tool execution returns unexpected data | Don't execute yet (Phase 4); agents will adapt based on tool catalog description |
| Tool schema too complex for agents | Inject simple, human-readable examples in system prompt; limit to JSON scalars initially |
| Publishing tools exposed to non-publishers | Unit test allowlist logic; define clear boundaries per role |

## References

- **Architecture:** `.squad/decisions/inbox/lead-agent-tool-wiring-review.md`
- **Tool Registry:** `mcp/tool-registry.mjs` (lines 144–800)
- **Agent Runner:** `src/agents/runner.ts` (composeSystemPrompt, run methods)
- **Actions:** `src/pipeline/actions.ts` (how runner.run() is called)

## Success Criteria

1. ✓ Agents can discover tools via `local_tool_catalog` in their allowed tool set
2. ✓ System prompt lists available tools with examples and side effects
3. ✓ Agent can emit tool_use XML tags in response without error
4. ✓ Editor can query player stats to fact-check draft claims
5. ✓ Publisher can call publish_to_substack from within agent response
6. ✓ No articles broken; tool invocation is opt-in (agents still work without tools)
