# Architecture Inspection: In-App Agent Tool Wiring

**Date:** 2026-03-28  
**Requestor:** Backend (Squad Agent)  
**Inspector:** Code (Core Dev)  
**Status:** Inspection Complete — No Modifications Made

---

## Executive Summary

The nfl-eval platform has a **three-layer tool architecture**: (1) MCP tools exposed via `src/mcp/server.ts` at the stdio boundary, (2) Agent charters/skills loaded from markdown files at runtime, and (3) prompt-injected instructions that guide agents on _what tools exist and how to use them_. 

**Current state:** Tools are documented in skills markdown files (e.g., `src/config/defaults/skills/nflverse-data.md`) but **agents have no native MCP tool discovery mechanism**. Agents receive tool documentation as text in their system prompt, not as structured tool manifests. The MCP `list_tools` handler exposes pipeline operations only; extension tools (nflverse queries, image generation, publishing) are handled separately or injected via skill content.

**Key insight:** To wire "in-app agent discovery of local_tool_catalog and explicit safe read-only NFL data tools," we need to:
1. Build a tool manifest/catalog structure that agents can query
2. Create an agent-accessible discovery mechanism (either MCP-based or prompt-injected)
3. Add explicit allowlists per agent to control which tools are callable
4. Update test coverage to validate tool exposure and safety constraints

---

## Current Architecture

### Layer 1: MCP Server (stdio boundary)

**File:** `src/mcp/server.ts`

**Purpose:** Exposes pipeline operations as MCP tools to external MCP clients (Copilot CLI, downstream agents, IDEs).

**Tool categories:**
- `pipeline_status`, `article_get`, `article_create`, `article_advance`, `article_list`, `pipeline_batch`, `pipeline_drift` — all pipeline operations
- No extension/query tools exposed at this layer (nflverse, image gen, Substack publishing handled separately)

**Tool registration:** Hardcoded `TOOLS` array (lines 30–152). No dynamic registry or discovery.

**Handlers:**
- `ListToolsRequestSchema` (line 215) — returns full `TOOLS` array
- `CallToolRequestSchema` (line 221) — switch statement dispatches tool calls
- No allowlisting or per-agent filtering

**Contract seam:** `createMCPServer()` factory (line 200) takes `repo`, `engine`, `config`, optional `actionContext`. Returns configured Server.

---

### Layer 2: Agent Runner (in-app coordination)

**File:** `src/agents/runner.ts`

**Purpose:** Loads agent charters + skills, injects context, calls LLM Gateway.

**Agent loading:**
- Charters: markdown files with `## Identity`, `## Responsibilities`, `## Knowledge`, `## Boundaries`, `## Model`
- Skills: markdown files with YAML frontmatter (`name`, `description`, `domain`, `confidence`, `tools` array) + content
- Memory: agent-specific conversation history and context

**System prompt composition** (lines 293–342):
```
[charter.identity]
[charter.responsibilities] 
[charter.knowledge]
[skills content]
[memories]
[roster context if provided]
[charter.boundaries]
```

**Tool exposure:** 
- Agents receive **text documentation** of tools via skill content (e.g., "MCP Tool: `query_player_stats` returns EPA + efficiency + positional rank")
- No structured tool manifest or native MCP client
- No tool allowlisting per agent
- No discovery API — agents are told "these tools exist" via markdown blocks

**Example skill:** `src/config/defaults/skills/nflverse-data.md` (lines 100–118) documents 10 MCP tools as a table + CLI examples. This is read verbatim into the system prompt.

---

### Layer 3: LLM Gateway (provider abstraction)

**File:** `src/llm/gateway.ts`

**Purpose:** Routes LLM calls across providers, resolves models via policy.

**Providers:** Copilot CLI, LM Studio, Mock (registered at startup in `src/dashboard/server.ts`)

**Tool forwarding:** None at this layer. Gateway handles model resolution, token management, retries. Tool calls are handled by the LLM's native tool use (e.g., Copilot CLI passes tool calls to the CLI, which invokes MCP handlers).

---

## Where Allowlists/Prompts/Tool Exposure Live

### Allowlists
**Location:** **Implicit / None**
- No explicit allowlist structure exists
- Tool access is controlled only by:
  - Which skills are loaded via `runner.run(params.skills)`
  - What's documented in those skills
  - LLM inference (model may choose not to call a tool)

**Example:** In `src/pipeline/actions.ts`, when running Analytics agent:
```typescript
const response = await runner.run({
  agentName: 'analytics',
  task: '...',
  skills: ['nflverse-data'],  // ← selective skill loading
  // ...
});
```

### Prompts
**Location:** Multiple seams
1. **Charter prompts:** `src/config/defaults/charters/nfl/{agent}.md` — role definition + boundaries
2. **Skill content:** `src/config/defaults/skills/{skill}.md` — procedural instructions for a domain (e.g., "How to query nflverse")
3. **Task-specific context:** Injected in `src/pipeline/actions.ts`:
   - `rosterContext` — live player/team data
   - `conversationContext` — revision history, prior feedback
   - `articleContext` — article metadata + draft content
4. **Memories:** `src/agents/memory.ts` — agent-specific learned context (similarity-ranked)

### Tool Exposure
**Location:** Three paths (implicit):
1. **Skill markdown** — text documentation (primary for agents)
2. **MCP server** — stdio tools (secondary, for Copilot CLI if configured)
3. **Agent memory** — past successful tool calls stored as learning context

**Not currently exposed:**
- Structured tool manifest (JSON schema per tool)
- Per-agent allowlists or capability matrices
- Tool safety classification (read-only vs. mutating)
- Discovery API (agents cannot query available tools)

---

## Exact Code Changes Needed

To wire "in-app agent discovery of local_tool_catalog + explicit safe read-only NFL data query tools," the following changes are necessary:

### 1. **Create a Tool Catalog Structure**

**File:** `src/services/tool-catalog.ts` (new)

**Purpose:** Single source of truth for all available tools (both MCP and domain-specific).

```typescript
export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: 'pipeline' | 'nflverse' | 'image' | 'publishing';
  safety: 'read-only' | 'side-effect';
  schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
  examples?: Array<{ input: unknown; output: string }>;
}

export interface ToolCatalog {
  tools: ToolDefinition[];
  listTools(filter?: { category?: string; safety?: string }): ToolDefinition[];
  getTool(id: string): ToolDefinition | null;
  validateCall(toolId: string, args: unknown): boolean;
}

export function buildLocalToolCatalog(): ToolCatalog {
  return {
    tools: [
      {
        id: 'query_player_stats',
        name: 'Query Player Stats',
        category: 'nflverse',
        safety: 'read-only',
        description: 'EPA, efficiency metrics, and positional rank for offensive players',
        schema: { /* ... */ },
      },
      // ... 9 more nflverse tools
      {
        id: 'pipeline_status',
        name: 'Pipeline Status',
        category: 'pipeline',
        safety: 'read-only',
        description: 'Get article counts per stage and ready-to-advance list',
        schema: { /* ... */ },
      },
      // ... more pipeline tools
    ],
    // ...
  };
}
```

### 2. **Add Tool Allowlists to Agent Charters**

**File:** `src/config/defaults/charters/nfl/{agent}.md`

**Change:** Add `## Tools` section to specify which tools an agent can call.

Example for `analytics.md`:
```markdown
## Tools

- query_player_stats
- query_team_efficiency
- query_positional_rankings
- query_snap_counts
- query_draft_history
- query_ngs_passing
- query_combine_profile
- query_pfr_defense
- query_historical_comps
- refresh_nflverse_cache
```

Example for `writer.md`:
```markdown
## Tools

- query_player_stats (for fact-checking)
```

### 3. **Extend Agent Charter Parser**

**File:** `src/agents/runner.ts`

**Change:** Parse `## Tools` section and store in `AgentCharter`:

```typescript
export interface AgentCharter {
  name: string;
  identity: string;
  responsibilities: string[];
  knowledge: string[];
  boundaries: string[];
  tools?: string[];  // ← NEW
  model?: string;
}

function parseCharter(raw: string, fileName: string): AgentCharter {
  // ... existing parsing ...
  
  switch (heading) {
    // ... existing cases ...
    case 'tools': {
      charter.tools = parseBulletList(body);
      break;
    }
  }
}
```

### 4. **Add Tool-Aware System Prompt Injection**

**File:** `src/agents/runner.ts`

**Change:** Inject tool catalog into system prompt if tools are available.

```typescript
composeSystemPrompt(
  charter: AgentCharter,
  skills: AgentSkill[],
  memories: MemoryEntry[],
  rosterContext?: string,
  toolCatalog?: ToolCatalog,  // ← NEW
): string {
  const parts: string[] = [];
  
  // ... existing parts (identity, responsibilities, skills, etc.) ...
  
  // NEW: Inject tool allowlist
  if (charter.tools && toolCatalog) {
    const allowedTools = charter.tools
      .map(id => toolCatalog.getTool(id))
      .filter((t): t is ToolDefinition => t != null);
    
    if (allowedTools.length > 0) {
      const toolBlock = [
        '## Available Tools',
        '',
        'You have access to the following tools. Call them by name with the specified input format.',
        '',
        ...allowedTools.map(t => 
          `### ${t.name} (\`${t.id}\`)\n${t.description}\n\nInput: ${JSON.stringify(t.schema)}`
        ),
      ].join('\n');
      parts.push(toolBlock);
    }
  }
  
  // ... boundaries ...
  
  return parts.join('\n\n');
}
```

### 5. **Wire Tool Catalog into Agent Runner**

**File:** `src/agents/runner.ts`

**Change:** Accept optional tool catalog and pass through to composition:

```typescript
export interface AgentRunParams {
  // ... existing fields ...
  toolCatalog?: ToolCatalog;  // ← NEW
}

async run(params: AgentRunParams): Promise<AgentRunResult> {
  const { agentName, task, toolCatalog, /* ... */ } = params;
  
  // ... load charter, skills, memories ...
  
  const systemPrompt = this.composeSystemPrompt(
    charter, 
    skills, 
    memories, 
    params.rosterContext,
    toolCatalog,  // ← NEW
  );
  
  // ... call gateway ...
}
```

### 6. **Create a Tool Discovery Skill** (optional but recommended)

**File:** `src/config/defaults/skills/tool-discovery.md` (new)

**Purpose:** Generic skill that instructs agents how to discover and use tools.

```markdown
---
name: tool-discovery
description: How to discover and use available tools
domain: core
confidence: high
tools: []
---

# Tool Discovery & Use

Your system prompt includes an "Available Tools" section listing tools you can call.

Each tool has a unique ID (lowercase, underscores), a description, and a required input schema.

## Calling a Tool

When you need information or perform an action, look for a matching tool in the "Available Tools" section.
Call it by name and input the required parameters.

Example:
- **Goal:** Get EPA stats for Jaxon Smith-Njigba
- **Tool:** `query_player_stats`
- **Call:** player="Jaxon Smith-Njigba", season=2025
- **Result:** Get back stats in structured format

## Tool Categories

- **read-only (safe):** `query_*` tools return data only, no side effects
- **side-effect (careful):** Publication and state-modifying tools; use only when instructed
```

### 7. **Create Tool Registry / Discovery Endpoint**

**File:** `src/mcp/server.ts` (extend)

**Change:** Add a tool discovery tool to the MCP server:

```typescript
const TOOLS: Tool[] = [
  // ... existing tools ...
  {
    name: 'tools_list',  // ← NEW
    description:
      'Discover available local tools by category (nflverse, pipeline, image, publishing)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: 'Filter by category: nflverse, pipeline, image, publishing',
        },
        safety: {
          type: 'string',
          description: 'Filter by safety: read-only, side-effect',
        },
      },
      required: [],
    },
  },
];

// In call_tool handler:
case 'tools_list': {
  const catalog = buildLocalToolCatalog();
  const filtered = catalog.listTools({
    category: args.category as string,
    safety: args.safety as string,
  });
  return textResult({
    count: filtered.length,
    tools: filtered.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      safety: t.safety,
    })),
  });
}
```

### 8. **Update Agent Invocations in Pipeline Actions**

**File:** `src/pipeline/actions.ts`

**Change:** Pass tool catalog when running agents:

```typescript
const toolCatalog = buildLocalToolCatalog();

const response = await runner.run({
  agentName: 'analytics',
  task: buildAnalyticsTask(/* ... */),
  skills: ['nflverse-data'],
  toolCatalog,  // ← NEW
  // ... other params ...
});
```

---

## Tests to Update / Add

### 1. **Test Tool Catalog Structure**

**File:** `tests/services/tool-catalog.test.ts` (new)

```typescript
describe('ToolCatalog', () => {
  it('lists all nflverse tools', () => {
    const catalog = buildLocalToolCatalog();
    const nflverse = catalog.listTools({ category: 'nflverse' });
    expect(nflverse).toHaveLength(10);
    expect(nflverse.every(t => t.safety === 'read-only')).toBe(true);
  });
  
  it('lists only read-only pipeline tools', () => {
    const catalog = buildLocalToolCatalog();
    const readonly = catalog.listTools({ safety: 'read-only' });
    expect(readonly.every(t => t.safety === 'read-only')).toBe(true);
  });
});
```

### 2. **Test Agent Charter Tool Parsing**

**File:** `tests/agents/runner.test.ts` (extend)

```typescript
describe('AgentRunner: Tool Parsing', () => {
  it('parses tools section from charter', () => {
    const charter = `
# Analytics
## Identity
The Analytics agent.
## Tools
- query_player_stats
- query_team_efficiency
- query_historical_comps
`;
    const parsed = parseCharter(charter, 'analytics');
    expect(parsed.tools).toEqual([
      'query_player_stats',
      'query_team_efficiency',
      'query_historical_comps',
    ]);
  });
  
  it('includes tool allowlist in system prompt', () => {
    const charter: AgentCharter = {
      name: 'analytics',
      identity: 'You are analytics.',
      responsibilities: [],
      knowledge: [],
      boundaries: [],
      tools: ['query_player_stats'],
    };
    const catalog = buildLocalToolCatalog();
    const prompt = runner.composeSystemPrompt(charter, [], [], undefined, catalog);
    expect(prompt).toContain('Available Tools');
    expect(prompt).toContain('query_player_stats');
  });
});
```

### 3. **Test MCP Tool Discovery Endpoint**

**File:** `tests/mcp/server.test.ts` (extend)

```typescript
describe('MCP Server: Tool Discovery', () => {
  it('lists all tools by category', async () => {
    // ... setup server ...
    const response = await callTool('tools_list', { category: 'nflverse' });
    expect(response.count).toBe(10);
    expect(response.tools.every((t: any) => t.category === 'nflverse')).toBe(true);
  });
  
  it('filters by safety level', async () => {
    const response = await callTool('tools_list', { safety: 'read-only' });
    expect(response.tools.every((t: any) => t.safety === 'read-only')).toBe(true);
  });
});
```

### 4. **Test Agent Tool Enforcement**

**File:** `tests/pipeline/actions.test.ts` (extend)

```typescript
describe('Agent Tool Enforcement', () => {
  it('agent receives only allowed tools in system prompt', async () => {
    const catalog = buildLocalToolCatalog();
    
    // Writer should have minimal tool access
    const writerCharter = loadCharter('writer');
    expect(writerCharter.tools).toBeDefined();
    expect(writerCharter.tools?.length).toBeLessThan(3);
    
    // Analytics should have broad data access
    const analyticsCharter = loadCharter('analytics');
    expect(analyticsCharter.tools?.length).toBeGreaterThan(5);
  });
});
```

---

## Risks & Mitigation

### Risk 1: Tool Call Hallucination

**Issue:** LLM may call tools that aren't in its allowlist (especially frontier models).

**Mitigation:**
- Keep allowlists explicit in charter markdown (easy to audit)
- Include "You may only call these tools:" in system prompt
- Monitor agent outputs for tool call attempts outside allowlist
- Test with multiple model tiers (Haiku, Sonnet, Opus)

### Risk 2: Schema Mismatch

**Issue:** Tool catalog schema drifts from actual MCP tool input schema.

**Mitigation:**
- Single source of truth: build catalog from MCP tool definitions, not manual duplication
- Add validation test that compares catalog schema to actual MCP tools
- Enforce consistency at registration time, not runtime

### Risk 3: Incomplete Tool Documentation

**Issue:** Tools in catalog lack examples, making agents less likely to use them correctly.

**Mitigation:**
- Populate `examples` field in catalog early
- Add "Common use cases" section to each tool's charter block
- Test agent response quality with tools vs. without tools

### Risk 4: Over-Exposure

**Issue:** Agents get access to tools they shouldn't (e.g., Writer calling `pipeline_advance`).

**Mitigation:**
- Classify tools explicitly (`safety: 'read-only' | 'side-effect'`)
- Default to minimal allowlist per agent
- Document the approval process for adding a tool to an agent's allowlist
- Add guardrails in MCP call_tool handler to validate caller identity

---

## Files to Create / Modify

### Create (new)
- `src/services/tool-catalog.ts` — centralized tool registry
- `src/config/defaults/skills/tool-discovery.md` — skill on using tools
- `tests/services/tool-catalog.test.ts` — tool catalog tests
- `tests/mcp/local-tool-registry.test.ts` — integration test for MCP tool exposure

### Modify
- `src/agents/runner.ts` — parse tool allowlists, inject into system prompt
- `src/mcp/server.ts` — add `tools_list` tool for discovery
- `src/pipeline/actions.ts` — pass catalog when invoking agents
- `src/config/defaults/charters/nfl/*.md` — add `## Tools` sections
- `tests/agents/runner.test.ts` — test tool parsing + injection
- `tests/mcp/server.test.ts` — test discovery endpoint
- `tests/pipeline/actions.test.ts` — test enforcement

---

## Decision Points for Backend

1. **Discovery Mechanism:** Should agents query the tool catalog at runtime (recommended) or receive a static list in their system prompt? (Current proposal: inject static list from charter, add optional MCP discovery for dynamic queries)

2. **Allowlist Granularity:** Per-agent (recommended for security) or per-role or global? (Proposal: per-agent in charter, with optional role-based defaults)

3. **Safety Enforcement:** Should the MCP server validate that a caller is allowed to invoke a tool before executing? (Proposal: yes, but validation happens at tool invocation time in `src/mcp/server.ts`, not in agent system prompt)

4. **Tool Documentation Quality:** Should we auto-generate system prompt tool blocks from MCP schemas or manually curate them? (Proposal: hybrid—scaffold from MCP schema, agents add examples + domain context in charter)

5. **Scope of "Local Tools":** Should pipeline tools (article_advance, etc.) be in the same catalog as nflverse tools, or kept separate? (Proposal: unified catalog, split by category + safety level)

---

## Summary

**Current State:**
- Agents receive tool documentation as markdown text in system prompt
- No structured tool manifest or discovery mechanism
- No explicit allowlists; tool access implicit through skill loading
- No safety classification (read-only vs. mutating)

**Proposed Wiring:**
1. Create `ToolCatalog` service with structured definitions
2. Extend agent charters with `## Tools` allowlists
3. Inject tool manifest into system prompt
4. Add MCP `tools_list` discovery tool
5. Update tests to validate exposure + enforcement

**Implementation effort:** ~6–8 focused edits across runner, actions, charters, server, and tests. No architectural changes; pure additive wiring.

**Risk level:** Low (backward compatible, isolated changes, no existing flows broken)

**Readiness:** All scaffolding complete; implementation can begin immediately.
