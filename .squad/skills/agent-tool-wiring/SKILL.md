---
name: Agent Tool-Calling Architecture Pattern
domain: DevOps, Infra, LLM Integration
confidence: 0.9
description: How to wire local tools into agent systems while maintaining safety, discoverability, and MCP compatibility.
tags: [mcp, agents, tool-calling, safety, allowlists]
---

# Agent Tool-Calling Architecture Pattern

## Problem

When agents need to call local tools (data queries, media generation, publishing APIs), there are two competing tool registries:
1. **MCP tools** — registered for external clients (GitHub Copilot, Claude Code), discoverable via `ListTools`
2. **Agent-internal tools** — if agents also call tools, there's a risk of tool inventory drift between the two surfaces

If agents and MCP clients see different tool catalogs, it creates:
- Consistency problems (MCP client has tool X, but agent allowlist doesn't)
- Maintenance burden (tool definitions must be duplicated or kept in sync)
- Safety risks (agents might call tools they shouldn't; external clients might not see safe tools)

## Solution

**Single source of truth:** Define all tools in one registry, then adapt that registry for both MCP and agent use.

### Architecture Pattern

```
mcp/tool-registry.mjs
  ↓
  ├→ MCP Server (mcp/server.mjs)
  │   └→ registerLocalTools(server)
  │       └→ External clients discover tools via ListTools
  │
  └→ Agent Tool Adapter (src/agents/tool-adapter.ts)
      ├→ getLLMToolDefinitions()  // OpenAI/Anthropic format
      ├→ filterByAllowlist(names) // Apply agent/stage policy
      └→ getToolHandler(name)     // Execute handlers
```

### Implementation Steps

#### 1. Tool Registry (Source of Truth)

```javascript
// mcp/tool-registry.mjs
const localToolEntries = [
  {
    name: "query_player_stats",
    title: "Query Player Stats",
    category: "data",
    description: "...",
    inputSchema: { /* Zod schema */ },
    handler: async (args) => { /* implementation */ },
    sideEffects: "none (read-only)",
    examples: [ { label: "...", args: {...} } ],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    // NEW: Allowlist metadata
    allowedAgents: ["writer", "editor", "lead"],
    allowedStages: [4, 5, 6, 7],  // Stages where this agent can call this tool
  },
  // ... 24 more tools
];

export function registerLocalTools(server) {
  for (const entry of localToolEntries) {
    server.registerTool(entry.name, {...}, handler);
  }
}

export function getLocalToolEntries() {
  return localToolEntries;
}
```

#### 2. MCP Server Registration (No Changes)

The MCP server already imports and registers all tools correctly. This doesn't change.

```javascript
// mcp/server.mjs
import { registerLocalTools } from "./tool-registry.mjs";
const server = new McpServer({...});
registerLocalTools(server);
```

#### 3. Agent Tool Adapter (New)

```typescript
// src/agents/tool-adapter.ts

import { getLocalToolEntries } from "../../mcp/tool-registry.mjs";

export interface LLMToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export class AgentToolRegistry {
  private entries: ToolRegistryEntry[];
  private handlers: Map<string, (args: any) => Promise<any>>;

  constructor() {
    this.entries = getLocalToolEntries();
    this.handlers = new Map(
      this.entries.map(e => [e.name, e.handler])
    );
  }

  /**
   * Get LLM-format tool definitions filtered by allowlist.
   */
  getDefinitionsForAgent(
    agentName: string,
    stage: number
  ): LLMToolDefinition[] {
    return this.entries
      .filter(e => 
        e.allowedAgents?.includes(agentName) &&
        e.allowedStages?.includes(stage)
      )
      .map(e => ({
        name: e.name,
        description: e.description,
        input_schema: zodToJsonSchema(e.inputSchema),
      }));
  }

  /**
   * Execute a tool call with allowlist + error safety.
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    agentName: string,
    stage: number
  ): Promise<{ success: true; result: string } | { success: false; error: string }> {
    const entry = this.entries.find(e => e.name === toolName);
    
    // Allowlist check
    if (!entry?.allowedAgents?.includes(agentName) ||
        !entry?.allowedStages?.includes(stage)) {
      return {
        success: false,
        error: `Tool ${toolName} not allowed for ${agentName} at stage ${stage}`,
      };
    }

    const handler = this.handlers.get(toolName);
    if (!handler) {
      return {
        success: false,
        error: `Tool ${toolName} not found`,
      };
    }

    try {
      const result = await handler(args);
      return {
        success: true,
        result: typeof result === 'string' ? result : JSON.stringify(result),
      };
    } catch (err) {
      // Log full error server-side; return generic error to agent
      console.error(`[tool] ${toolName} failed:`, err);
      return {
        success: false,
        error: `${toolName} failed (logged)`,
      };
    }
  }
}
```

#### 4. LLM Gateway with Tool Support (Enhanced)

```typescript
// src/llm/gateway.ts

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  tools?: LLMToolDefinition[];
  toolChoice?: 'auto' | 'required' | 'none';
  // ... existing fields
}

export interface ChatResponse {
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  // ... existing fields
}

export class LLMGateway {
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const candidates = this.resolveCandidates(request);
    const attempts = this.buildAttempts(request, candidates);

    // Attempt each provider/model until success
    for (const { provider, model } of attempts) {
      try {
        const enriched: ChatRequest = {
          ...request,
          model,
          // NEW: Pass tools to provider if present
          tools: request.tools,
          toolChoice: request.toolChoice,
        };
        return await provider.chat(enriched);
      } catch (err) {
        // log and continue
      }
    }

    throw new Error(`All providers failed`);
  }
}
```

#### 5. AgentRunner Tool Invocation Loop

```typescript
// src/agents/runner.ts

export class AgentRunner {
  private toolRegistry: AgentToolRegistry;

  constructor(options: {
    gateway: LLMGateway;
    memory: AgentMemory;
    chartersDir: string;
    skillsDir: string;
    toolRegistry: AgentToolRegistry;  // NEW
  }) {
    // ...
    this.toolRegistry = options.toolRegistry;
  }

  async run(params: AgentRunParams): Promise<AgentRunResult> {
    const charter = this.loadCharter(params.agentName);
    // ... load skills, memories, build prompts ...

    // NEW: Get tools allowed for this agent/stage
    const toolsForAgent = this.toolRegistry.getDefinitionsForAgent(
      params.agentName,
      params.articleContext?.stage ?? 0
    );

    let messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await this._gateway.chat({
      messages,
      tools: toolsForAgent,  // NEW
      toolChoice: 'auto',    // NEW
      // ... existing params
    });

    // NEW: Tool invocation loop (agentic loop)
    let finalContent = response.content;
    let toolCallCount = 0;
    const MAX_TOOL_CALLS = 10;
    const TOOL_CALL_TIMEOUT = 120000; // 2 minutes

    const startTime = Date.now();
    while (response.toolCalls && response.toolCalls.length > 0) {
      if (toolCallCount >= MAX_TOOL_CALLS) {
        console.warn(`[agent] ${params.agentName} exceeded MAX_TOOL_CALLS (${MAX_TOOL_CALLS})`);
        break;
      }
      if (Date.now() - startTime > TOOL_CALL_TIMEOUT) {
        console.warn(`[agent] ${params.agentName} exceeded TOOL_CALL_TIMEOUT`);
        break;
      }

      // Execute all tool calls in this turn
      for (const call of response.toolCalls) {
        const result = await this.toolRegistry.executeTool(
          call.name,
          call.arguments,
          params.agentName,
          params.articleContext?.stage ?? 0
        );

        // Add tool result to conversation (MCP standard format)
        messages.push({
          role: 'tool' as any,  // Not standard, but agents support it
          content: result.success
            ? result.result
            : `Error: ${result.error}`,
        });
      }

      toolCallCount++;

      // Ask agent to continue (with tool results in context)
      const nextResponse = await this._gateway.chat({
        messages,
        tools: toolsForAgent,
        toolChoice: 'auto',
        // ... existing params
      });

      finalContent = nextResponse.content;
      if (!nextResponse.toolCalls || nextResponse.toolCalls.length === 0) {
        break;  // Agent returned final response, not more tool calls
      }

      // Update messages and continue loop
      messages[messages.length - 1] = {
        role: 'assistant',
        content: finalContent,
      };
    }

    return {
      content: finalContent,
      thinking,
      model: response.model,
      provider: response.provider,
      agentName: params.agentName,
      memoriesUsed: memories.length,
      toolCallsUsed: toolCallCount,  // NEW: audit this
    };
  }
}
```

#### 6. Pipeline Integration (with Allowlist)

```typescript
// src/pipeline/actions.ts (or new agent-tool-policy.ts)

const AGENT_TOOL_POLICY: Record<string, Record<number, string[]>> = {
  'writer': {
    4: ['query_rosters', 'local_tool_catalog'],  // preflight
    5: ['query_player_stats', 'query_team_efficiency', 'query_rosters', 'local_tool_catalog'],  // draft
  },
  'editor': {
    6: ['query_player_stats', 'query_team_efficiency', 'query_rosters', 'query_snap_counts'],
  },
  'lead': {
    7: ['query_player_stats', 'query_prediction_markets', 'query_rosters'],
  },
  'publisher': {
    8: ['publish_to_substack', 'publish_note_to_substack', 'publish_tweet', 'local_tool_catalog'],
  },
};

// When calling an agent:
async function stageAction_WriteDraft(articleId: string, ctx: ActionContext): Promise<ActionResult> {
  const result = await ctx.runner.run({
    agentName: 'writer',
    task: '...',
    articleContext: {
      slug: articleId,
      title: '...',
      stage: 5,
    },
    // NEW: Allowlist filtering happens inside runner based on agent name + stage
  });

  // Tool calls are already audited inside runner.run()
  return { success: true, artifactPath: '...' };
}
```

---

## Benefits

1. **Single source of truth** — all tools defined in `mcp/tool-registry.mjs`
2. **No inventory drift** — MCP clients and agents use same tool catalog
3. **Safe by default** — allowlist enforced per agent/stage, read-only tools first
4. **Discoverable** — agents can call `local_tool_catalog` if allowed
5. **Auditable** — tool calls logged with agent name, stage, tool name, args, result
6. **Testable** — tool adapter has no dependencies on providers or agents; can be unit tested alone
7. **Backward compatible** — existing MCP clients unaffected; tool registry structure unchanged

---

## Testing

### Unit Tests

```typescript
// tests/agents/tool-adapter.test.ts
describe('AgentToolRegistry', () => {
  it('filters tools by agent and stage', () => {
    const registry = new AgentToolRegistry();
    const tools = registry.getDefinitionsForAgent('writer', 5);
    expect(tools.map(t => t.name)).toContain('query_player_stats');
    expect(tools.map(t => t.name)).not.toContain('publish_to_substack');
  });

  it('rejects tool calls outside allowlist', async () => {
    const registry = new AgentToolRegistry();
    const result = await registry.executeTool(
      'publish_to_substack',
      { file_path: 'test.md' },
      'writer',
      5  // Stage 5: writers can't publish
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  it('catches and sanitizes handler errors', async () => {
    const registry = new AgentToolRegistry();
    const result = await registry.executeTool(
      'query_player_stats',
      { player: 'invalid', season: 'not-a-number' },
      'writer',
      5
    );
    expect(result.success).toBe(false);
    expect(result.error).not.toContain('stack trace'); // No internal details leaked
  });
});
```

### Integration Tests

```typescript
// tests/pipeline/agent-tool-calls.test.ts
describe('Agent Tool Calling', () => {
  it('writer can call nflverse tools at stage 5', async () => {
    const article = await repo.createArticle({...});
    const result = await agentRunner.run({
      agentName: 'writer',
      task: 'Look up Mahomes stats and write a paragraph',
      articleContext: { slug: article.id, title: article.title, stage: 5 },
    });
    expect(result.content).toContain('Mahomes');
    // Tool call happened internally; agent returned final text
  });

  it('agent tool call loop respects timeout', async () => {
    // Mock a flaky tool that returns tool_calls repeatedly
    const result = await agentRunner.run({...});
    expect(result.toolCallsUsed).toBeLessThanOrEqual(10);
  });

  it('publisher can publish to substack', async () => {
    // Real tool call at stage 8
    const result = await agentRunner.run({
      agentName: 'publisher',
      task: 'Publish this article',
      articleContext: { slug: '...', stage: 8, content: '...' },
    });
    // Verification: check Substack draft was created
  });
});
```

---

## References

- **MCP Tool Registry:** `mcp/tool-registry.mjs`
- **MCP Server:** `mcp/server.mjs`
- **Agent Runner:** `src/agents/runner.ts`
- **LLM Gateway:** `src/llm/gateway.ts`
- **Decision:** `.squad/decisions/devops-agent-tool-wiring-review.md`

---

## Caveats

- **Provider support:** Not all LLM providers support tool calling (e.g., mock provider). Gracefully fall back to text-only mode if tools not supported.
- **Zod → JSON Schema:** Need a converter library (e.g., `zod-to-json-schema`) to translate Zod schemas to OpenAI/Anthropic format.
- **Message format:** Tool results use `role: 'tool'` which is not yet standard in all LLM APIs; may need per-provider adaptation.
- **Structured output:** If agent asks for JSON response, tool results must be in context; `responseFormat: 'json'` and tool calls may conflict.
