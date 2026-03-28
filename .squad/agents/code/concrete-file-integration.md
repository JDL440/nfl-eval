# Concrete File-by-File Integration Breakdown

**Scope:** Tool-wiring changes for runner.ts, gateway.ts, actions.ts, writer-support.ts, and associated tests  
**No modifications to any files — inspection only**

---

## 1. `src/agents/runner.ts`

### Current Behavior

**Line 37–60: `AgentRunParams` interface**
- Currently has: `agentName`, `task`, `articleContext`, `skills`, `temperature`, `maxTokens`, `responseFormat`, `rosterContext`, `conversationContext`, `preferredProvider`, `providerStrategy`, `allowedProviders`
- **Missing:** No `toolCatalog` parameter

**Line 19–35: `AgentCharter` interface**
```typescript
export interface AgentCharter {
  name: string;
  identity: string;
  responsibilities: string[];
  knowledge: string[];
  boundaries: string[];
  model?: string;
}
```
- **Missing:** No `tools?: string[]` field for allowlist

**Line 110–160: `parseCharter()` function**
- Parses markdown sections: `## Identity`, `## Responsibilities`, `## Knowledge`, `## Boundaries`, `## Model`
- Splits on `/^## /m` regex (lines 120)
- **Missing:** No parsing for `## Tools` section

**Line 293–342: `composeSystemPrompt()` method**
- Current signature: `composeSystemPrompt(charter, skills, memories, rosterContext?): string`
- Injects sections in order: identity → responsibilities → skills → memories → roster context → boundaries (lines 301–339)
- **Missing:** No tool allowlist injection between memories and boundaries

**Line 344–451: `run()` method**
- Line 375: Calls `this.composeSystemPrompt(charter, skills, memories, params.rosterContext)`
- **Missing:** No `toolCatalog` passed to `composeSystemPrompt()`
- Line 404–414: Passes provider hints to gateway but no tool-related data

### Integration Points

1. **Parse Tools Section**
   - Add case in parseCharter() switch (after line 149, `case 'model'`)
   - Extract bullet list same as `case 'responsibilities'` (line 134)
   - Store in `charter.tools = parseBulletList(body)`

2. **Extend AgentCharter Type**
   - Add `tools?: string[];` after `model?: string;` in interface (line 26)

3. **Accept Catalog in `composeSystemPrompt()`**
   - Add 5th parameter: `toolCatalog?: ToolCatalog` after `rosterContext?` (line 297)
   - Call signature becomes: `composeSystemPrompt(charter, skills, memories, rosterContext, toolCatalog)`

4. **Inject Tool Allowlist in System Prompt**
   - After "Roster context" block (line 328–331), add:
   ```typescript
   // Tools allowlist
   if (charter.tools && toolCatalog) {
     const allowed = charter.tools
       .map(id => toolCatalog.getTool(id))
       .filter((t): t is ToolDefinition => t != null);
     if (allowed.length > 0) {
       const toolBlock = [
         '## Available Tools',
         '',
         'You have access to the following tools...',
         ...allowed.map(t => `### ${t.name} (\`${t.id}\`)\n${t.description}`)
       ].join('\n');
       parts.push(toolBlock);
     }
   }
   ```
   - Insert BEFORE boundaries block (before line 333)

5. **Accept Catalog in `run()` Method**
   - Add to destructuring (line 346–354): `toolCatalog?: ToolCatalog,`
   - Pass to composeSystemPrompt at line 375:
   ```typescript
   const systemPrompt = this.composeSystemPrompt(
     charter, skills, memories, params.rosterContext, params.toolCatalog
   );
   ```

6. **Extend `AgentRunParams` Interface**
   - Add after line 59 (`allowedProviders`):
   ```typescript
   /** Optional tool catalog for agent discovery and allowlisting. */
   toolCatalog?: ToolCatalog;
   ```

### New Imports Needed
```typescript
import type { ToolCatalog, ToolDefinition } from '../services/tool-catalog.js';
```

---

## 2. `src/llm/gateway.ts`

### Current Behavior

**Line 20–44: `ChatRequest` interface**
```typescript
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
```

**Line 46–53: `LLMProvider` interface**
```typescript
export interface LLMProvider {
  id: string;
  name: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
  listModels(): string[];
  supportsModel(model: string): boolean;
  supportsPreferredRouting?(model: string): boolean;
}
```

**No tool-related fields anywhere in gateway. This is correct — gateway is LLM-agnostic.**

### Analysis

- **Gateway should NOT handle tool validation or allowlisting**
- Tools are agent-level concern (runner.ts), not LLM-level
- Tool enforcement happens at:
  1. Agent system prompt (what tools are visible to LLM)
  2. MCP server call_tool handler (who can invoke what)
  3. NOT in gateway.chat()

**Conclusion: No changes needed to gateway.ts**

---

## 3. `src/pipeline/actions.ts`

### Current Behavior: 12 `runner.run()` Invocations

Searched for `runner.run` calls (lines containing actual invocations):

**Call 1: Line ~495 (`generateDiscussionPrompt`)**
```typescript
const result = await ctx.runner.run({
  agentName: 'lead',
  task: buildDiscussionPromptTask(...),
  skills: ['discussion-prompt'],
  // ...
});
```

**Call 2: Line ~545 (`composePanel`)**
```typescript
const result = await ctx.runner.run({
  agentName: 'lead',
  task,
  skills: ['panel-composition'],
  ...providerHint,
  articleContext: { slug, title, stage, content },
});
```

**Call 3: Line ~600 (`runDiscussion` — parallel panelist)**
```typescript
const result = await ctx.runner.run({
  agentName: panelist.agentName,
  task: buildPanelistTask(...),
  // No skills specified
  rosterContext,
  articleContext,
  ...providerHint,
});
```

**Call 4: Line ~650 (`runDiscussion` — fallback moderator)**
```typescript
const result = await ctx.runner.run({
  agentName: 'panel-moderator',
  task: '...',
  skills: ['article-discussion'],
  rosterContext,
  articleContext,
  ...providerHint,
});
```

**Call 5: Line ~700 (`synthesizeDiscussion`)**
```typescript
const result = await ctx.runner.run({
  agentName: 'panel-moderator',
  task,
  skills: ['article-discussion'],
  rosterContext,
  conversationContext: discussionContext,
  ...providerHint,
  articleContext: { slug, title, stage },
});
```

**Call 6: Line ~800 (`writeDraft` — writer fact-check)**
```typescript
const factCheckResult = await ctx.runner.run({
  agentName: 'writer',
  task: buildFactCheckTask(...),
  // No skills
  rosterContext,
  conversationContext: contextForFactCheck,
  ...providerHint,
  articleContext: { slug, title, stage, content: draftContent },
});
```

**Call 7: Line ~850 (`writeDraft` — main writer)**
```typescript
const result = await ctx.runner.run({
  agentName: 'writer',
  task: buildWriterTask(isRevision),
  // No skills directly passed (WRITER_EDITOR_PREFLIGHT_CHECKLIST injected in task text)
  rosterContext,
  conversationContext,
  ...providerHint,
  articleContext: { slug, title, stage, content: contextContent },
  temperature: 1.0,
  maxTokens: 8000,
});
```

**Call 8: Line ~920 (`writeDraft` — writer repair)**
```typescript
const retryResult = await ctx.runner.run({
  agentName: 'writer',
  task: buildDraftRepairInstruction(repairState),
  rosterContext,
  conversationContext,
  ...providerHint,
  articleContext: { slug, title, stage, content: currentDraft },
  temperature: 1.0,
  maxTokens: 8000,
});
```

**Call 9: Line ~1050 (`runEditor`)**
```typescript
const result = await ctx.runner.run({
  agentName: 'editor',
  task: buildEditorTask(...),
  skills: ['editor-review'],
  rosterContext,
  conversationContext: editorContext,
  ...providerHint,
  articleContext: { slug, title, stage, content: draftContent },
  temperature: 1.0,
  maxTokens: 6000,
});
```

**Call 10: Line ~1100 (`runEditor` — retry)**
```typescript
const retryResult = await ctx.runner.run({
  agentName: 'editor',
  task: buildEditorTask(...),
  skills: ['editor-review'],
  rosterContext,
  conversationContext,
  ...providerHint,
  articleContext: { slug, title, stage, content: draftContent },
  temperature: 1.0,
  maxTokens: 6000,
});
```

**Call 11: Line ~1200 (`publishArticle`)**
```typescript
const result = await ctx.runner.run({
  agentName: 'publisher',
  task: buildPublisherTask(...),
  skills: ['substack-article'],
  rosterContext,
  conversationContext: publishContext,
  ...providerHint,
  articleContext: { slug, title, stage, content: draftContent },
});
```

**Call 12: Line ~1300 (`retrospective` — lead)**
```typescript
const result = await ctx.runner.run({
  agentName: 'lead',
  task,
  // No skills
  conversationContext: retrospectiveContext,
  articleContext: { slug, title, stage },
});
```

### Integration Point: Instantiate and Pass Catalog

**New code needed (single location, early in any action execution):**

Around line 65 (before stage action functions), add:
```typescript
import { buildLocalToolCatalog } from '../services/tool-catalog.js';

// At module level or at start of each stage action:
const LOCAL_TOOL_CATALOG = buildLocalToolCatalog();
```

Then in **each of the 12 `runner.run()` calls**, add:
```typescript
toolCatalog: LOCAL_TOOL_CATALOG,
```

**Example for Call 2 (composePanel, line ~545):**
```typescript
const result = await ctx.runner.run({
  agentName: 'lead',
  task,
  skills: ['panel-composition'],
  toolCatalog: LOCAL_TOOL_CATALOG,  // ← ADD THIS
  ...providerHint,
  articleContext: { slug, title, stage, content: promptContent },
});
```

**All 12 calls need the same single-line addition.**

### Testing Coverage

None of these calls are directly tested in actions.test.ts (they're tested via integration tests that mock the runner). The catalog will be used in-process, so no test changes needed for action invocations themselves—only for runner tests (see below).

---

## 4. `src/pipeline/writer-support.ts`

### Current Behavior

**Line 10–30: `WriterSupportAllowedFact`, `WriterSupportCautionClaim`, `ParsedWriterSupportArtifact` interfaces**
- No tool-related fields
- These are artifact structures, not agent configs

**Line 84–131: `buildWriterSupportArtifact()` function**
- Takes `BuildWriterSupportArtifactParams` with: `generatedAt`, `primaryTeam`, `rosterArtifactUpdatedAt`, `panelFactCheck`, `rosterContext`, `sourceArtifacts`, `report`
- Builds markdown artifact with sections: Generated, Roster, Canonical Names, Exact Facts, Cautions, Guidance
- No tool-related output

### Analysis

**Conclusion: No changes needed to writer-support.ts**

This file generates artifacts for agents to _consume_, not agent configuration. Tool wiring is orthogonal to what writer-support produces.

---

## 5. `src/llm/gateway.ts` (Reprise)

### Why No Changes?

Gateway is the transport layer:
- Takes `messages` (system prompt already composed by runner)
- Routes to provider
- Returns response

If tools are in the system prompt (composed by runner → gateway.chat receives full prompt), gateway doesn't need to know about tools.

**Tool visibility path:**
1. Agent charter `## Tools` section ← parsed by runner
2. System prompt injected ← handled by runner.composeSystemPrompt()
3. LLM receives structured prompt with tool list ← gateway passes unchanged
4. LLM can call tools (Copilot CLI handles tool invocation) ← outside gateway

---

## 6. `tests/agents/runner.test.ts`

### Current Tests (What Exists)

**Lines 143–296: Charter/Skill Loading Tests**
- `loadCharter()` — loads from markdown, parses sections ✓
- `loadSkill()` — loads YAML + content ✓
- `listAgents()`, `listSkills()` — directory scanning ✓
- No tests for tools section

**Lines 300–403: `composeSystemPrompt()` Tests**
- `composeSystemPrompt` composition test (lines 301–353)
  - Verifies identity, responsibilities, skills, memories, boundaries appear
  - **Missing:** No assertion for tool allowlist
- Omits empty sections test (lines 355–370)
- Section ordering test (lines 372–406)
  - **Missing:** Doesn't check where tools appear relative to other sections

**Lines 408+: `run()` Method Tests**
- Basic run test, skill loading, memory injection, thinking separation
- **Missing:** No test that passes `toolCatalog` param

### Tests That Need Updating/Adding

**1. Update: `parseCharter()` (New Case)**

Add test around line 214 (after `returns null for missing charter`):
```typescript
it('parses tools section from charter', () => {
  const charterWithTools = `# Analytics
## Identity
Statistical expert.
## Tools
- query_player_stats
- query_team_efficiency
- query_snap_counts
`;
  writeFileSync(join(chartersDir, 'analytics-test.md'), charterWithTools);
  const charter = runner.loadCharter('analytics-test');
  expect(charter).not.toBeNull();
  expect(charter!.tools).toEqual(['query_player_stats', 'query_team_efficiency', 'query_snap_counts']);
});
```

**2. Update: `composeSystemPrompt()` Tests**

Modify the "composes system prompt" test (line 301–353) to:
```typescript
it('composes system prompt from charter, skills, memories, and tools', () => {
  const charter: AgentCharter = {
    name: 'Analytics',
    identity: 'The quant.',
    responsibilities: [],
    knowledge: [],
    boundaries: [],
    tools: ['query_player_stats', 'query_team_efficiency'],  // ← NEW
  };
  
  // Mock tool catalog
  const toolCatalog = {
    tools: [
      {
        id: 'query_player_stats',
        name: 'Query Player Stats',
        category: 'nflverse',
        safety: 'read-only',
        description: 'EPA + efficiency metrics',
        schema: {} as any,
      },
      {
        id: 'query_team_efficiency',
        name: 'Query Team Efficiency',
        category: 'nflverse',
        safety: 'read-only',
        description: 'Team-level EPA metrics',
        schema: {} as any,
      },
    ],
    getTool: (id: string) => toolCatalog.tools.find(t => t.id === id) || null,
    listTools: () => toolCatalog.tools,
  } as ToolCatalog;
  
  const prompt = runner.composeSystemPrompt(charter, [], [], undefined, toolCatalog);
  
  // Assert tools appear in prompt
  expect(prompt).toContain('## Available Tools');
  expect(prompt).toContain('query_player_stats');
  expect(prompt).toContain('query_team_efficiency');
  expect(prompt).toContain('EPA + efficiency metrics');
});
```

**3. Add: Tool Ordering Test**

After the section ordering test (line 405), add:
```typescript
it('places available tools section after memories and before boundaries', () => {
  const charter: AgentCharter = {
    name: 'Test',
    identity: 'IDENTITY',
    responsibilities: ['RESP'],
    knowledge: [],
    boundaries: ['BOUND'],
    tools: ['query_player_stats'],
  };
  
  const toolCatalog = {
    tools: [{
      id: 'query_player_stats',
      name: 'Player Stats',
      category: 'nflverse',
      safety: 'read-only',
      description: 'Stats query',
      schema: {} as any,
    }],
    getTool: (id: string) => toolCatalog.tools.find(t => t.id === id) || null,
    listTools: () => toolCatalog.tools,
  } as ToolCatalog;
  
  const prompt = runner.composeSystemPrompt(charter, [], [], undefined, toolCatalog);
  
  const idxTools = prompt.indexOf('## Available Tools');
  const idxBound = prompt.indexOf('## Boundaries');
  
  expect(idxTools).toBeGreaterThan(0);
  expect(idxBound).toBeGreaterThan(idxTools);
});
```

**4. Add: Test with No Tools Section**

After omits empty sections test (line 370), add:
```typescript
it('gracefully handles charter without tools section', () => {
  const charter: AgentCharter = {
    name: 'NoTools',
    identity: 'Agent without tools.',
    responsibilities: [],
    knowledge: [],
    boundaries: [],
    // No tools field
  };
  
  const toolCatalog = {
    tools: [],
    getTool: () => null,
    listTools: () => [],
  } as ToolCatalog;
  
  const prompt = runner.composeSystemPrompt(charter, [], [], undefined, toolCatalog);
  
  // Should not crash, should not include tool section
  expect(prompt).not.toContain('## Available Tools');
});
```

**5. Add: Test Tool Catalog Passed to run()**

After the main `run()` test (around line 450+), add:
```typescript
it('passes toolCatalog to composeSystemPrompt', async () => {
  const charter = runner.loadCharter('writer')!;
  const composeSpy = vi.spyOn(runner, 'composeSystemPrompt');
  
  const mockCatalog = {
    tools: [],
    getTool: () => null,
    listTools: () => [],
  } as ToolCatalog;
  
  const result = await runner.run({
    agentName: 'writer',
    task: 'Write something.',
    toolCatalog: mockCatalog,
  });
  
  // Verify composeSystemPrompt was called with catalog
  expect(composeSpy).toHaveBeenCalledWith(
    expect.any(Object),  // charter
    expect.any(Array),   // skills
    expect.any(Array),   // memories
    undefined,           // rosterContext
    mockCatalog          // toolCatalog ← THIS
  );
  
  composeSpy.mockRestore();
});
```

### New Imports for Tests
```typescript
import type { ToolCatalog } from '../../src/services/tool-catalog.js';
```

---

## 7. `tests/llm/gateway.test.ts`

### Current Tests

Lines 92+: Test provider management, routing, model resolution, structured output

### Analysis

**Conclusion: No changes needed**

Gateway tests don't touch system prompts; they test provider selection logic. Tool allowlisting is a runner-level concern, not gateway-level.

---

## 8. `tests/pipeline/actions.test.ts`

### Current Tests

**Lines 143–165: Fixture setup**
- Sets up temp repo, engine, auditor, runner with stub provider
- Writes agent charters (lead, writer, editor, publisher, panel-moderator)

**Lines 167+: Various stage action tests**
- `generateDiscussionPrompt()` — mocked runner, checks artifact
- `composePanel()` — checks panel composition parsing
- `runDiscussion()` — checks all panelists run in parallel
- `writeDraft()` — checks revision loop, fact-check, draft validation
- `runEditor()` — checks editor logic, verdict extraction
- etc.

**None of these tests directly inspect `runner.run()` calls** — they mock the runner and check artifacts.

### Tests That Need Updating

**1. Update: Fixture Setup (Around Line 145)**

In `beforeEach()`, add catalog creation:
```typescript
beforeEach(() => {
  // ... existing setup ...
  
  // Create tool catalog (used in all action tests)
  // This would come from src/services/tool-catalog.ts
  ctx.toolCatalog = buildLocalToolCatalog();  // ← NEW
});
```

But since actions.ts is internal, and the catalog is created inside each action function, **no test fixture change is strictly necessary** — the catalog is already built in-process at runtime.

**2. Update: Verify Catalog is Used (Indirect)**

The tests won't directly assert "catalog was passed" because the runner is mocked. Instead, verify that:
- System prompts contain expected tool sections (once actual agents run with real runner)
- This is best tested via integration tests, not unit tests

**Minimal change: None required for unit tests**

Real validation happens when:
1. Create `tests/agents/runner.test.ts` tests (above) — validates runner parses + injects tools
2. Create integration test `tests/pipeline/agent-tool-integration.test.ts` — validates full pipeline with tool catalog

---

## 9. `README.md` and `package.json`

### `README.md`

**Current:** Lines 127–149 document LLM providers, model routing, agent charters/skills

**Updates needed (optional but recommended):**
- Add section "Agent Tool Discovery" explaining:
  - Agents load allowlists from charters (`## Tools` section)
  - Tool descriptions injected into system prompt
  - List of built-in tools (nflverse, pipeline, etc.)
  - How to add new tools to catalog

### `package.json`

**No changes needed** — tools are an in-process feature, not a new npm dependency

---

## Summary Table

| File | Current State | Changes Needed | Test Updates |
|------|---------------|-----------------|--------------|
| `src/agents/runner.ts` | No tool parsing, no catalog acceptance | Add tool parsing (3 lines), extend AgentCharter interface (1 line), update composeSystemPrompt() signature (1 param), inject tool section in prompt (8 lines), pass catalog in run() (2 lines) | Yes — 5 new tests |
| `src/llm/gateway.ts` | No tool awareness | **None** | No |
| `src/pipeline/actions.ts` | 12 runner.run() calls with no catalog | Add 1-line catalog creation at module start, add `toolCatalog: LOCAL_TOOL_CATALOG,` to all 12 calls | No (covered by runner tests) |
| `src/pipeline/writer-support.ts` | Artifact generation | **None** | No |
| `tests/agents/runner.test.ts` | Tests charter/skill loading, prompt composition | Add 4 new describe blocks: parse tools, tool injection, tool ordering, no-tools graceful handling; update 2 existing tests to include catalog | Yes — 5–6 tests |
| `tests/llm/gateway.test.ts` | Provider/routing tests | **None** | No |
| `tests/pipeline/actions.test.ts` | Mock runner, check artifacts | Optional: Add indirect validation that catalog built in-process | Minimal/Optional |
| `README.md` | Docs on providers/charters | Add optional "Agent Tool Discovery" section explaining allowlists | Optional |

---

## Line-by-Line Edit Summary

### `src/agents/runner.ts`

1. **Line 19–26 (AgentCharter type):** Add `tools?: string[];` after `model?: string;`
2. **Line 37–60 (AgentRunParams):** Add `toolCatalog?: ToolCatalog;` after line 59
3. **Line 150–160 (parseCharter tools case):** Add new switch case for `'tools'` (copy pattern from line 134–137)
4. **Line 293–297 (composeSystemPrompt signature):** Add `, toolCatalog?: ToolCatalog` to params
5. **Line 328–339 (before boundaries):** Insert 8–10 line tool allowlist injection block
6. **Line 375 (run method):** Update call to pass `params.toolCatalog` as 5th arg
7. **Line 8 (imports):** Add `import type { ToolCatalog, ToolDefinition } from '../services/tool-catalog.js';`

### `src/pipeline/actions.ts`

1. **Line 65 (after imports):** Add `import { buildLocalToolCatalog } from '../services/tool-catalog.js';`
2. **Line 65–70 (module level):** Add `const LOCAL_TOOL_CATALOG = buildLocalToolCatalog();`
3. **12 runner.run() calls:** Each gets `toolCatalog: LOCAL_TOOL_CATALOG,` added (1 line per call)

### `tests/agents/runner.test.ts`

1. **After line 214 (loadCharter tests):** Add tools parsing test (12 lines)
2. **Line 301–353 (composeSystemPrompt test):** Update to include toolCatalog param (6 new lines in test setup)
3. **After line 370 (omits empty sections):** Add tool ordering test (15 lines)
4. **After line 370:** Add no-tools graceful handling test (12 lines)
5. **After line 450+ (run tests):** Add test that toolCatalog passed to composeSystemPrompt (16 lines)

---

## What Tests Verify

✓ Charter `## Tools` section parses correctly  
✓ Tool allowlist appears in system prompt  
✓ Tools appear between memories and boundaries  
✓ Agents without tools don't error  
✓ catalog param flows through runner.run() → composeSystemPrompt()  
✓ Mock tool catalog integrates correctly  
✓ (Indirect) Actions build catalog and pass to runner  

---

## No Breaking Changes

- All parameters are optional (`toolCatalog?`)
- Existing calls without catalog still work (tools not injected)
- Existing tests don't break (mock catalog added only where needed)
- Gateway behavior unchanged
- Actions behavior unchanged (only parameter addition)
