# Agent Tool Wiring — Precise Implementation Map

## Part 1: Current Architecture — Exact Responsibility Map

### Agent Execution Layer
| Module | Function | Responsibility |
|--------|----------|---|
| `src/agents/runner.ts:345-451` | `AgentRunner.run()` | Main agent execution orchestrator; calls gateway.chat(); no tool awareness |
| `src/agents/runner.ts:292-341` | `AgentRunner.composeSystemPrompt()` | Builds system prompt from charter + skills + memories; **missing: tool catalog** |
| `src/agents/runner.ts:19-35` | `AgentCharter` interface | Charter metadata loaded from `.squad/agents/{name}/charter.md`; includes `model` field but no `tools` |
| `src/agents/runner.ts:28-35` | `AgentSkill` interface | Skill metadata with YAML `tools` field (line 33) but **field is never used** |
| `src/agents/runner.ts:171-207` | `parseSkillFile()` | Parses YAML frontmatter; extracts `tools` array but does not validate/use |

### LLM Gateway Layer
| Module | Function | Responsibility |
|--------|----------|---|
| `src/llm/gateway.ts:20-32` | `ChatRequest` interface | Request type; has `preferredProvider`, `allowedProviders`, `providerStrategy` but **no `tools` field** |
| `src/llm/gateway.ts:126-172` | `LLMGateway.chat()` | Multi-provider dispatch; no tool handling |
| `src/llm/gateway.ts:226-289` | `LLMGateway.buildAttempts()` | Provider routing logic; no tool awareness |

### Tool Registry Layer (Standalone)
| Module | Function | Responsibility |
|--------|----------|---|
| `mcp/tool-registry.mjs:144-250` | `local_tool_catalog` entry | **Discovery tool** with metadata: `sideEffects`, `inputSchema`, examples |
| `mcp/tool-registry.mjs:450-800` | NFL data tool entries (9 tools) | `query_player_stats`, `query_team_efficiency`, `query_snap_counts`, `query_positional_rankings`, `query_draft_history`, `query_ngs_passing`, `query_combine_profile`, `query_pfr_defense`, `query_historical_comps`, `query_rosters` |
| `mcp/tool-registry.mjs:62` | `TOOL_CATEGORIES` | Enum: `["all", "help", "media", "publishing", "data"]` |
| `mcp/tool-registry.mjs:56-61` | Constant enums | `SUBSTACK_TARGETS`, `AUDIENCES`, `IMAGE_TYPES`, `IMAGE_MODELS`, `TABLE_TEMPLATES`, `PREDICTION_MARKET_TYPES` |

### Pipeline Action Layer (Agent Invocation)
| Module | Function | Responsibility |
|--------|----------|---|
| `src/pipeline/actions.ts:57-63` | `ActionContext` interface | Bundles `repo`, `engine`, `runner`, `auditor`, `config`; **runner has no tool access** |
| `src/pipeline/actions.ts:810-847` | `generatePrompt()` action | **Calls `runner.run()`** with `agentName: 'lead'`, `skills: ['discussion-prompt']`; no tools |
| `src/pipeline/actions.ts:824-835` | runner.run() call site | Passes `articleContext`, `skills`, `preferredProvider`, `providerStrategy`; **no tool params** |
| `src/pipeline/actions.ts:37-73` | `AgentRunParams` interface | Interface used by `runner.run()`; **missing: `toolAllowlist`, `toolExecutor`** |
| `src/pipeline/actions.ts:768-805` | `buildAgentRoster()` | Lists agents; reads charters; no tool discovery |

---

## Part 2: Where Tool Configuration Currently Lives

| Item | Current Location | Status |
|------|------------------|--------|
| **Tool catalog metadata** | `mcp/tool-registry.mjs:144-800` | ✗ JS module; not accessible to TS agents |
| **Tool descriptions** | `mcp/tool-registry.mjs:150-251` (per entry) | ✗ Inline in handlers; not centralized |
| **NFL data tool allowlist** | `mcp/tool-registry.mjs:451-700` | ✗ Implicit; no explicit safe-list |
| **Publishing tool allowlist** | `mcp/tool-registry.mjs:337-449` | ✗ Implicit; no guard preventing exposure |
| **Agent role mappings** | `src/agents/runner.ts:63-70` | `AGENT_STAGE_KEY` only maps to model policy, not tools |
| **Prompt injection point** | `src/agents/runner.ts:292-341` | `composeSystemPrompt()`; **hardcoded sections, no tool section** |
| **Tool allowlist enforcement** | *None* | ✗ No allowlist mechanism at agent level |
| **Tool invocation interface** | *None* | ✗ No parsing/execution of tool calls |

---

## Part 3: Exact Code Changes Per File

### Phase 1: Interfaces & Gateway Extension

#### File: `src/llm/gateway.ts`

**Change 1.1 — Extend ChatRequest (lines 20–32)**
```typescript
// BEFORE:
export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stageKey?: string;
  depthLevel?: number;
  taskFamily?: string;
  responseFormat?: 'text' | 'json';
  preferredProvider?: string;
  allowedProviders?: string[];
  providerStrategy?: 'auto' | 'prefer' | 'require';
}

// AFTER: Add after line 31
tools?: Array<{
  name: string;
  description: string;
  inputSchema: unknown; // JSON Schema
}>;
toolChoice?: 'auto' | 'required' | 'none';
```

**Rationale:** Signal tool support to providers that implement tool_use.

---

#### File: `src/agents/runner.ts`

**Change 1.2 — Extend AgentRunParams (lines 37–60)**
```typescript
// AFTER line 59 (allowedProviders):
  /** Optional tool allowlist for this run. Format: "category:*" or "tool:name1,name2". */
  toolAllowlist?: string;
  /** Optional tool execution callback for handling tool invocations. */
  toolExecutor?: (toolName: string, args: unknown) => Promise<unknown>;
```

**Rationale:** Allow actions to gate tool availability and optionally handle execution.

---

### Phase 2: Tool Catalog Extraction

#### File: `src/mcp/tool-catalog.ts` (NEW)

**Create new TypeScript module exporting tool registry:**

```typescript
/**
 * Tool catalog bridge: extracted from mcp/tool-registry.mjs and adapted for TypeScript.
 * Provides safe-list definitions and role-based tool access.
 */

export interface ToolEntry {
  name: string;
  title: string;
  category: 'help' | 'media' | 'publishing' | 'data';
  description: string;
  sideEffects: string;
  readOnlyHint?: boolean;
  idempotentHint?: boolean;
  inputSchema: Record<string, unknown>;
  examples?: Array<{ label: string; args: unknown }>;
}

/** NFL data query tools — safe read-only. */
export const NFL_DATA_TOOLS = [
  'query_player_stats',
  'query_team_efficiency',
  'query_positional_rankings',
  'query_snap_counts',
  'query_draft_history',
  'query_ngs_passing',
  'query_combine_profile',
  'query_pfr_defense',
  'query_historical_comps',
  'query_rosters',
] as const;

/** Tools safe for any agent: read-only, no side effects. */
export const SAFE_READ_ONLY_TOOLS = [
  'local_tool_catalog',
  ...NFL_DATA_TOOLS,
] as const;

/** Publishing tools: only for publisher role. */
export const PUBLISHING_TOOLS = [
  'publish_to_substack',
  'publish_note_to_substack',
  'publish_tweet',
] as const;

export const TOOL_READ_ONLY = new Set(SAFE_READ_ONLY_TOOLS);
export const TOOL_PUBLISHING = new Set(PUBLISHING_TOOLS);

/** Role-based tool allowlist. */
export const AGENT_TOOL_ALLOWLIST: Record<string, readonly string[]> = {
  'writer': SAFE_READ_ONLY_TOOLS,
  'editor': SAFE_READ_ONLY_TOOLS,
  'lead': SAFE_READ_ONLY_TOOLS,
  'scribe': SAFE_READ_ONLY_TOOLS,
  'panel-moderator': SAFE_READ_ONLY_TOOLS,
  'publisher': [...SAFE_READ_ONLY_TOOLS, ...PUBLISHING_TOOLS],
  'coordinator': SAFE_READ_ONLY_TOOLS,
};

/** Get tools allowed for an agent role. */
export function getAllowedToolsForAgent(agentName: string): readonly string[] {
  return AGENT_TOOL_ALLOWLIST[agentName] ?? SAFE_READ_ONLY_TOOLS;
}

/** Minimal tool catalog entries for system prompt injection. */
export function getToolCatalogForPrompt(tools: readonly string[]): ToolEntry[] {
  // Map tool names to full entries from MCP registry
  // For now, return stub entries; in Phase 2.2 hydrate from MCP server
  return tools.map(name => ({
    name,
    title: name.replace(/_/g, ' '),
    category: name.startsWith('publish_') ? 'publishing' : 'data',
    description: `Tool: ${name}. See system prompt for details.`,
    sideEffects: TOOL_READ_ONLY.has(name) ? 'none (read-only)' : 'writes to external service',
    readOnlyHint: TOOL_READ_ONLY.has(name),
    inputSchema: {},
  }));
}
```

**Rationale:** Centralize allowlist logic; make it accessible to TypeScript agents.

---

### Phase 3: System Prompt Injection

#### File: `src/agents/runner.ts`

**Change 3.1 — Import tool catalog (top of file, after line 14)**
```typescript
import { getAllowedToolsForAgent, getToolCatalogForPrompt, TOOL_READ_ONLY } from '../mcp/tool-catalog.js';
```

**Change 3.2 — Add method to AgentRunner class (after line 257)**
```typescript
/** Get tools allowed for this agent. */
getAllowedTools(agentName: string): string[] {
  return Array.from(getAllowedToolsForAgent(agentName));
}
```

**Change 3.3 — Extend composeSystemPrompt signature (line 292)**
```typescript
// BEFORE:
composeSystemPrompt(
  charter: AgentCharter,
  skills: AgentSkill[],
  memories: MemoryEntry[],
  rosterContext?: string,
): string

// AFTER:
composeSystemPrompt(
  charter: AgentCharter,
  skills: AgentSkill[],
  memories: MemoryEntry[],
  rosterContext?: string,
  allowedTools?: string[],
): string
```

**Change 3.4 — Add tool catalog section to composeSystemPrompt body (insert after line 330, before boundaries)**
```typescript
// Tools (if provided)
if (allowedTools && allowedTools.length > 0) {
  const toolEntries = getToolCatalogForPrompt(allowedTools);
  const toolLines = toolEntries.map(t => 
    `- **${t.name}**: ${t.description} (${t.sideEffects})`
  ).join('\n');
  parts.push(
    '## Available Tools\n' +
    'You may use these tools when they improve task outcomes.\n\n' +
    toolLines + '\n\n' +
    '### Tool Invocation\n' +
    'Invoke tools using XML tags:\n' +
    '```\n' +
    '<tool_use name="tool_name">{ "arg1": "value", "arg2": 123 }</tool_use>\n' +
    '```\n' +
    'You may invoke multiple tools in one response.'
  );
}
```

**Change 3.5 — Update run() method to pass allowedTools to composeSystemPrompt (line 375)**
```typescript
// BEFORE (line 375):
const systemPrompt = this.composeSystemPrompt(charter, skills, memories, params.rosterContext);

// AFTER:
const allowedTools = this.getAllowedTools(agentName);
const systemPrompt = this.composeSystemPrompt(charter, skills, memories, params.rosterContext, allowedTools);
```

**Change 3.6 — Pass tools to gateway.chat() (line 404–415)**
```typescript
// AFTER line 414 (allowedProviders: params.allowedProviders):
tools: allowedTools.map(name => ({
  name,
  description: `See system prompt for tool usage.`,
  inputSchema: {}, // Hydrated from MCP in Phase 2.2
})),
toolChoice: 'auto' as const,
```

---

### Phase 4: Tool Execution Handler (Deferred)

**Not implemented in initial Phase 1–3.** Placeholder for future work:
- Post-process LLM response for `<tool_use>` tags
- Extract tool name and args
- Execute via handler map
- Inject results back into response

---

## Part 4: Specific Risks

| Risk | Severity | Exact Location | Mitigation |
|------|----------|---|---|
| **Tool name hallucination** | HIGH | `src/agents/runner.ts:run()` after LLM response | Hardcode `SAFE_READ_ONLY_TOOLS` set; validate tool names in response before execution |
| **Publishing tools exposed to non-publishers** | HIGH | `src/mcp/tool-catalog.ts:AGENT_TOOL_ALLOWLIST` | Unit test role→tools mapping; test that writer allowlist excludes `publish_*` |
| **Tool catalog injection bloats prompt** | MEDIUM | `src/agents/runner.ts:composeSystemPrompt()` line 330–348 | Lazy-load catalog; limit to 5 most relevant tools if token budget exceeded |
| **Gateway ignores tools field** | MEDIUM | `src/llm/gateway.ts:ChatRequest` line 33–34 | Test that `tools` field is passed through to provider; document provider support matrix |
| **Tool execution fails mid-article** | MEDIUM | `src/agents/runner.ts:run()` after Phase 4 | Catch errors; inject error message into response; let agent retry or skip tool |
| **MCP registry and TS catalog drift** | MEDIUM | `mcp/tool-registry.mjs` vs `src/mcp/tool-catalog.ts` | Sync on each update; consider single source of truth (JS or TS) post-Phase 2 |

---

## Part 5: Exact Tests to Add/Update

### Existing Test Files to Update

#### File: `tests/agents/runner.test.ts`

**Test Suite 1: Tool Allowlist Per Role**
- **Location:** Add after existing charter/skill tests (line ~80)
- **Cases:**
  ```typescript
  describe('Agent tool allowlist', () => {
    it('writer gets all safe read-only tools', () => {
      const allowed = runner.getAllowedTools('writer');
      expect(allowed).toContain('query_player_stats');
      expect(allowed).toContain('local_tool_catalog');
      expect(allowed).not.toContain('publish_to_substack');
    });

    it('editor gets same as writer', () => {
      const writerTools = new Set(runner.getAllowedTools('writer'));
      const editorTools = new Set(runner.getAllowedTools('editor'));
      expect(editorTools).toEqual(writerTools);
    });

    it('publisher gets publishing tools + read-only', () => {
      const allowed = runner.getAllowedTools('publisher');
      expect(allowed).toContain('publish_to_substack');
      expect(allowed).toContain('query_player_stats');
    });

    it('unknown agent falls back to safe tools', () => {
      const allowed = runner.getAllowedTools('unknown-agent');
      expect(allowed).toContain('query_player_stats');
    });
  });
  ```

**Test Suite 2: Tool Catalog in System Prompt**
- **Location:** Add after composeSystemPrompt tests (line ~120)
- **Cases:**
  ```typescript
  describe('Tool injection in system prompt', () => {
    it('includes ## Available Tools section when tools provided', () => {
      const prompt = runner.composeSystemPrompt(
        WRITER_CHARTER, [], [], undefined,
        ['query_player_stats', 'local_tool_catalog']
      );
      expect(prompt).toContain('## Available Tools');
      expect(prompt).toContain('query_player_stats');
    });

    it('omits tool section when no tools provided', () => {
      const prompt = runner.composeSystemPrompt(
        WRITER_CHARTER, [], [], undefined,
        []
      );
      expect(prompt).not.toContain('## Available Tools');
    });

    it('includes tool usage examples', () => {
      const prompt = runner.composeSystemPrompt(
        WRITER_CHARTER, [], [], undefined,
        ['query_player_stats']
      );
      expect(prompt).toContain('<tool_use');
      expect(prompt).toContain('Tool Invocation');
    });
  });
  ```

**Test Suite 3: AgentRunParams with toolAllowlist**
- **Location:** Add after existing run() tests (line ~200)
- **Cases:**
  ```typescript
  describe('AgentRunParams tool fields', () => {
    it('accepts toolAllowlist parameter', async () => {
      const result = await runner.run({
        agentName: 'writer',
        task: 'Analyze this stat.',
        toolAllowlist: 'data:*',
      });
      expect(result.content).toBeDefined();
    });

    it('accepts toolExecutor callback', async () => {
      const executor = vi.fn().mockResolvedValue({ data: [] });
      const result = await runner.run({
        agentName: 'writer',
        task: 'Query the data.',
        toolExecutor: executor,
      });
      expect(result.content).toBeDefined();
    });
  });
  ```

---

#### File: `tests/llm/gateway.test.ts`

**Test Suite: ChatRequest tools field**
- **Location:** Add after provider routing tests (line ~150)
- **Cases:**
  ```typescript
  describe('ChatRequest tools', () => {
    it('accepts tools array', () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'test' }],
        model: 'claude-3-sonnet',
        tools: [
          { name: 'query_data', description: 'Query data', inputSchema: {} },
        ],
        toolChoice: 'auto',
      };
      expect(request.tools).toHaveLength(1);
    });

    it('toolChoice defaults to auto', () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'test' }],
        model: 'gpt-4',
        tools: [],
        toolChoice: 'auto',
      };
      expect(request.toolChoice).toBe('auto');
    });
  });
  ```

---

#### File: `tests/pipeline/actions.test.ts`

**Update existing runner.run() call sites**
- **Location:** Lines where `ctx.runner.run()` is called (e.g., line ~600 in test action)
- **Change:**
  ```typescript
  // BEFORE:
  const result = await ctx.runner.run({
    agentName: 'writer',
    task: 'Write the article.',
  });

  // AFTER (add optional assertion):
  const result = await ctx.runner.run({
    agentName: 'writer',
    task: 'Write the article.',
  });
  // Tools should be injected automatically; verify no errors
  expect(result.content).toBeTruthy();
  ```

---

### New Test Files to Create

#### File: `tests/mcp/tool-catalog.test.ts` (NEW)

```typescript
import { describe, it, expect } from 'vitest';
import {
  NFL_DATA_TOOLS,
  SAFE_READ_ONLY_TOOLS,
  PUBLISHING_TOOLS,
  TOOL_READ_ONLY,
  TOOL_PUBLISHING,
  AGENT_TOOL_ALLOWLIST,
  getAllowedToolsForAgent,
  getToolCatalogForPrompt,
} from '../../src/mcp/tool-catalog.js';

describe('Tool Catalog', () => {
  it('NFL_DATA_TOOLS has 10 tools', () => {
    expect(NFL_DATA_TOOLS).toHaveLength(10);
  });

  it('SAFE_READ_ONLY_TOOLS includes discovery + NFL data', () => {
    expect(SAFE_READ_ONLY_TOOLS).toContain('local_tool_catalog');
    expect(SAFE_READ_ONLY_TOOLS).toContain('query_player_stats');
  });

  it('PUBLISHING_TOOLS are distinct from read-only', () => {
    const overlap = new Set([...SAFE_READ_ONLY_TOOLS].filter(t => PUBLISHING_TOOLS.includes(t as any)));
    expect(overlap.size).toBe(0);
  });

  it('TOOL_READ_ONLY set covers all safe tools', () => {
    for (const tool of SAFE_READ_ONLY_TOOLS) {
      expect(TOOL_READ_ONLY.has(tool as any)).toBe(true);
    }
  });

  describe('Agent role allowlists', () => {
    it('writer gets all safe tools, no publishing', () => {
      const tools = getAllowedToolsForAgent('writer');
      expect(tools).toContain('query_player_stats');
      expect(tools).not.toContain('publish_to_substack');
    });

    it('editor gets all safe tools, no publishing', () => {
      const tools = getAllowedToolsForAgent('editor');
      expect(tools).toContain('query_team_efficiency');
      expect(tools).not.toContain('publish_tweet');
    });

    it('publisher gets safe + publishing tools', () => {
      const tools = getAllowedToolsForAgent('publisher');
      expect(tools).toContain('publish_to_substack');
      expect(tools).toContain('query_player_stats');
    });

    it('unknown role defaults to safe tools', () => {
      const tools = getAllowedToolsForAgent('unknown');
      expect(tools).toContain('query_player_stats');
    });
  });

  describe('Tool catalog for prompts', () => {
    it('returns ToolEntry for each requested tool', () => {
      const catalog = getToolCatalogForPrompt(['query_player_stats', 'local_tool_catalog']);
      expect(catalog).toHaveLength(2);
      expect(catalog[0].name).toBe('query_player_stats');
    });

    it('marks read-only tools appropriately', () => {
      const catalog = getToolCatalogForPrompt(['query_player_stats']);
      expect(catalog[0].readOnlyHint).toBe(true);
      expect(catalog[0].sideEffects).toBe('none (read-only)');
    });

    it('marks publishing tools appropriately', () => {
      const catalog = getToolCatalogForPrompt(['publish_to_substack']);
      expect(catalog[0].readOnlyHint).toBe(false);
    });
  });
});
```

---

#### File: `tests/agents/runner-tools.test.ts` (NEW)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRunner } from '../../src/agents/runner.js';
import { LLMGateway } from '../../src/llm/gateway.js';
import { StubProvider } from '../../src/llm/providers/stub.js';
import { AgentMemory } from '../../src/agents/memory.js';
import { ModelPolicy } from '../../src/llm/model-policy.js';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';

describe('AgentRunner Tool Integration', () => {
  let runner: AgentRunner;
  let gateway: LLMGateway;
  let chartersDir: string;
  let skillsDir: string;

  beforeEach(() => {
    chartersDir = mkdtempSync();
    skillsDir = mkdtempSync();
    gateway = new LLMGateway({
      modelPolicy: new ModelPolicy(join(process.cwd(), 'src', 'config', 'defaults', 'models.json')),
      providers: [new StubProvider()],
    });
    runner = new AgentRunner({
      gateway,
      memory: new AgentMemory(),
      chartersDir,
      skillsDir,
    });
  });

  describe('Tool allowlist per agent', () => {
    it('getAllowedTools returns array of tool names', () => {
      const tools = runner.getAllowedTools('writer');
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('writer allowlist does not include publishing tools', () => {
      const tools = runner.getAllowedTools('writer');
      expect(tools).not.toContain('publish_to_substack');
      expect(tools).not.toContain('publish_tweet');
    });

    it('publisher allowlist includes publishing tools', () => {
      const tools = runner.getAllowedTools('publisher');
      expect(tools).toContain('publish_to_substack');
    });
  });

  describe('Tool injection into system prompt', () => {
    it('composeSystemPrompt includes tool section when tools provided', () => {
      const charter = { name: 'test', identity: 'Test agent', responsibilities: [], knowledge: [], boundaries: [] };
      const prompt = runner.composeSystemPrompt(charter, [], [], undefined, ['query_player_stats']);
      expect(prompt).toContain('## Available Tools');
      expect(prompt).toContain('query_player_stats');
    });

    it('includes Tool Invocation section with example', () => {
      const charter = { name: 'test', identity: 'Test', responsibilities: [], knowledge: [], boundaries: [] };
      const prompt = runner.composeSystemPrompt(charter, [], [], undefined, ['query_player_stats']);
      expect(prompt).toContain('Tool Invocation');
      expect(prompt).toContain('<tool_use');
    });

    it('omits tool section when no tools provided', () => {
      const charter = { name: 'test', identity: 'Test', responsibilities: [], knowledge: [], boundaries: [] };
      const prompt = runner.composeSystemPrompt(charter, [], [], undefined, []);
      expect(prompt).not.toContain('## Available Tools');
    });

    it('lists each tool with description and side effects', () => {
      const charter = { name: 'test', identity: 'Test', responsibilities: [], knowledge: [], boundaries: [] };
      const prompt = runner.composeSystemPrompt(charter, [], [], undefined, [
        'query_player_stats',
        'query_team_efficiency',
      ]);
      expect(prompt).toContain('query_player_stats');
      expect(prompt).toContain('query_team_efficiency');
      expect(prompt).toContain('(read-only)');
    });
  });
});
```

---

## Summary Table: Files & Changes

| Phase | File | Change Type | Lines Affected | Priority |
|-------|------|-------------|---|---|
| 1 | `src/llm/gateway.ts` | Extend `ChatRequest` | +2 properties | P0 |
| 1 | `src/agents/runner.ts` | Extend `AgentRunParams` | +2 properties | P0 |
| 2 | `src/mcp/tool-catalog.ts` | NEW file | ~120 lines | P0 |
| 3 | `src/agents/runner.ts` | Import + 4 changes | Lines 14, 257, 292, 330, 375, 415 | P0 |
| 4 | `src/agents/runner.ts` | Tool execution (deferred) | Lines ~420+ | P1 (defer) |
| — | `tests/agents/runner.test.ts` | Add 3 test suites | After line 80, 120, 200 | P0 |
| — | `tests/llm/gateway.test.ts` | Add 1 test suite | After line 150 | P0 |
| — | `tests/pipeline/actions.test.ts` | Update call sites | Multiple | P1 |
| — | `tests/mcp/tool-catalog.test.ts` | NEW file | ~100 lines | P0 |
| — | `tests/agents/runner-tools.test.ts` | NEW file | ~120 lines | P0 |
