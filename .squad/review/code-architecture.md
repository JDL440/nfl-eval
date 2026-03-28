# Code Architecture Review: Runner / Pipeline / Test Integration for Tool Wiring

**Date:** 2025-07-24  
**Scope:** `runner.ts`, `gateway.ts`, `actions.ts`, `writer-support.ts`, test suites, `package.json`

---

## 1. Architecture Overview

```
Dashboard (Hono + HTMX)
  └─ autoAdvanceArticle / executeTransition
       └─ STAGE_ACTIONS (actions.ts)
            └─ AgentRunner.run()
                 └─ LLMGateway.chat()
                      └─ LLMProvider.chat() (Copilot, LM Studio, Stub, Mock)
```

### Core call flow

1. **`actions.ts`** defines 7 stage actions (`generatePrompt`, `composePanel`, `runDiscussion`, `writeDraft`, `runEditor`, `runPublisherPass`, `publish`) registered in `STAGE_ACTIONS`.
2. **`executeTransition()`** looks up the action for a given stage, runs guard checks via `PipelineEngine.canAdvance()`, executes the action, and advances the stage.
3. **`autoAdvanceArticle()`** loops `executeTransition()` repeatedly, handling REVISE outcomes by regressing to stage 4 for re-drafting (up to `maxRevisions`).
4. Each action calls **`AgentRunner.run()`** which: loads charter → loads skills → recalls memories → composes system prompt → calls `LLMGateway.chat()` → separates thinking tokens → stores learning memory → returns result.
5. **`LLMGateway.chat()`** resolves model candidates via `ModelPolicy`, builds provider attempt order (respecting `preferredProvider` / `providerStrategy` / `allowedProviders`), and cascades through providers with automatic failover.

### Key type interfaces

| Interface | Role |
|---|---|
| `ActionContext` | Bundles `repo`, `engine`, `runner`, `auditor`, `config` for every stage action |
| `AgentRunParams` | Carries `agentName`, `task`, `articleContext`, `skills`, provider hints, conversation context |
| `ChatRequest` | Gateway-level: `messages`, `model`, `stageKey`, `taskFamily`, provider preferences |
| `AgentRunResult` | `content`, `thinking`, `model`, `provider`, `tokensUsed` |
| `ActionResult` | `success`, `duration`, `outcome` (APPROVED/REVISE/REJECT), `error` |

---

## 2. How Runner Orchestrates Agents and Pipelines

**`AgentRunner`** is a stateless orchestrator. Each `.run()` call:

1. Loads the agent's charter from disk (`{chartersDir}/{name}.md` or `{name}/charter.md`)
2. Loads requested skills (YAML frontmatter + markdown body)
3. Recalls relevant memories from `AgentMemory` (SQLite-backed, scoped by agent name)
4. Composes a system prompt with section ordering: Identity → Responsibilities → Skills → Memories → Roster Context → Boundaries
5. Builds the user message from `task` + `articleContext` + `conversationContext`
6. Resolves model selection: charter-specified model > `AGENT_STAGE_KEY` stage mapping > `taskFamily` fallback
7. Calls `LLMGateway.chat()` with all provider routing hints
8. Post-processes: separates thinking tokens, touches recalled memories (boost relevance), stores a new learning memory

**No tool/function-calling is wired at the runner level.** The runner sends text prompts and receives text responses. There is no MCP tool dispatch, function calling schema, or structured tool-use loop in the `AgentRunner → LLMGateway` path.

---

## 3. How Gateway Routes Calls to Providers

**`LLMGateway`** is a pure LLM routing layer — it does not handle MCP or tool calls.

### Model resolution

- Explicit `model` → use directly (bypass policy)
- `stageKey` / `taskFamily` → `ModelPolicy.resolve()` → returns `candidates[]`
- No context → throws `GatewayError`

### Provider routing

1. Filter providers by `allowedProviders` if set
2. If `preferredProvider` + `strategy='prefer'|'require'`: try preferred first
3. For `strategy='auto'`: LM Studio is deprioritized unless it has the exact model loaded
4. Build `attempts[]` as `(provider, model)` pairs; iterate with try/catch fallover
5. On all failures: throw combined error with cause chain

### Structured output

`chatStructured<T>()` wraps `.chat()` with `responseFormat: 'json'` and validates via Zod schema. Throws `StructuredOutputError` on parse/validation failure.

### What's NOT here

- No tool/function-call schema in `ChatRequest` or `ChatMessage`
- No MCP client integration
- No streaming support
- No tool-result round-trip loop

---

## 4. How Actions and Writer-Support Wire Tools to Agents

### actions.ts (77KB, ~1800 lines)

The action layer is where pipeline-specific intelligence lives. Key patterns:

| Action | Agents called | Skills injected | Special tool wiring |
|---|---|---|---|
| `generatePrompt` | `lead` | `discussion-prompt` | `ensureRosterContext()` for player validation |
| `composePanel` | `lead` | `panel-composition` | `buildAgentRoster()` to list available agents |
| `runDiscussion` | individual panelists + `panel-moderator` | `article-discussion` | Parallel `Promise.all()`, fallback to single-moderator |
| `writeDraft` | `lead` (fact-check) + `writer` (draft) | `fact-checking`, `substack-article`, `writer-fact-check` | `extractClaims()`, `ensureFactCheckContext()`, `executeWriterFactCheckPass()`, `buildWriterSupportArtifact()`, self-heal retry |
| `runEditor` | `editor` | `editor-review` | Verdict extraction + retry, revision blocker detection, escalation to Lead |
| `runPublisherPass` | `publisher` | `publisher` | `validatePlayerMentions()`, `validateStatClaims()`, `validateDraftClaims()` |
| `publish` | none | none | Guard-only: checks `substack_url` |

**Tool wiring is deterministic, not LLM-driven.** The actions layer calls local TypeScript functions (claim extraction, roster validation, fact-check context building) and passes their output as context in the LLM prompt. The LLM never invokes tools directly.

### writer-support.ts

A pure deterministic module that:
- Builds a `writer-support.md` artifact from fact-check reports, roster data, and source artifacts
- Classifies roster freshness (fresh/caution/stale/unknown)
- Extracts canonical player names via regex
- Builds allowed-facts and caution-claims lists
- Provides parsing round-trip (`buildWriterSupportArtifact` ↔ `parseWriterSupportArtifact`)

No LLM or tool calls — purely structured data transformation.

---

## 5. Test Coverage Analysis

### `tests/agents/runner.test.ts` (~600 lines)

| Area | Coverage | Notes |
|---|---|---|
| Charter loading | ✅ Thorough | Files, subdirectories, missing charters |
| Skill loading | ✅ Good | YAML frontmatter parsing, tools extraction |
| Agent listing | ✅ Good | Scanning, sorting, empty directories |
| System prompt composition | ✅ Thorough | Section ordering, empty sections, roster context |
| `run()` integration | ✅ Good | Basic flow, provider hints, memory recall/touch/store |
| Thinking separation | ✅ Good | Various tag formats |
| Provider routing from runner | ✅ | `preferredProvider`, `providerStrategy`, `allowedProviders` forwarded |

**Gap:** No test for `AGENT_STAGE_KEY` mapping logic (how `charter.model` vs `stageKey` vs `taskFamily` priority works in `.run()`).

### `tests/llm/gateway.test.ts` (~590 lines)

| Area | Coverage | Notes |
|---|---|---|
| Provider management | ✅ | Register, remove, constructor injection |
| Model-based routing | ✅ | Claude/GPT prefix matching |
| Policy-based routing | ✅ | `stageKey`, `taskFamily`, `depthLevel` |
| Preferred provider | ✅ | prefer, require, fallback |
| LM Studio anti-hijack | ✅ | Auto-routing suppression |
| Fallback cascade | ✅ | Provider failures, all-fail scenarios |
| `chatStructured` | ✅ | Valid JSON, invalid JSON, schema mismatch |
| Error types | ✅ | NoProviderError, RequiredProviderError, GatewayError |

**Gap:** No test for `allowedProviders` filtering (it's tested indirectly through runner tests, but not directly on gateway).

### `tests/pipeline/actions.test.ts` (~2000+ lines)

| Area | Coverage | Notes |
|---|---|---|
| All 7 stage actions | ✅ | Happy path for each |
| Provider hint forwarding | ✅ | `preferred_llm_provider` → `preferredProvider` |
| Error conditions | ✅ | Missing artifacts, missing articles |
| Panel composition parsing | ✅ | Multiple format patterns |
| Parallel panelist execution | ✅ | Success, partial failure, all-fail fallback |
| Draft validation + self-heal | ✅ | Word count, structure, preflight |
| Editor verdict extraction | ✅ | APPROVED, REVISE, missing verdict retry |
| Revision loop | ✅ | Conversation context, revision summaries |
| `autoAdvanceArticle` | ✅ | Multi-stage advancement, revision caps |
| Usage recording | ✅ | Token tracking through agent results |

**Strongest test file.** Covers the full integration from stage action → runner → gateway → provider with `PipelineTestProvider` that returns context-sensitive stub responses.

---

## 6. Package.json Dependencies and Scripts

### Dependencies relevant to tool integration

| Package | Role |
|---|---|
| `@github/copilot-sdk` | Copilot LLM provider |
| `@modelcontextprotocol/sdk` | MCP server (exposed via `mcp/server.mjs`) |
| `hono` / `@hono/node-server` | Dashboard serving |
| `zod` | Structured output validation in `chatStructured` |
| `vscode-jsonrpc` | JSON-RPC transport (MCP related) |

### Scripts

| Script | Purpose |
|---|---|
| `npm test` / `npm run v2:test` | `vitest run` — full test suite |
| `npm run mcp:server` | Canonical local MCP tool server (`mcp/server.mjs`) |
| `npm run mcp:pipeline` | Legacy pipeline-only MCP surface |
| `npm run v2:build` | `tsc` — TypeScript compilation |

---

## 7. Identified Gaps

### G1: No LLM-side tool/function calling

The pipeline uses a "context injection" pattern — local functions run deterministically and their output is pasted into the LLM's context window. The LLM never invokes tools. This is a deliberate design choice for reliability, but it means:

- **Pro:** Fully deterministic pipeline control; no hallucinated tool calls
- **Con:** LLM cannot request additional data mid-generation; all context must be pre-gathered

**Recommendation:** This is appropriate for the current 8-stage pipeline. If tool-use is needed later (e.g., writer querying nflverse mid-draft), add an optional `tools` array to `ChatRequest` and a tool-dispatch loop in `LLMGateway.chat()`.

### G2: MCP server is disconnected from the pipeline

The MCP server (`mcp/server.mjs`) exposes tools (image gen, nflverse queries, publishing) to external clients (Copilot CLI, VS Code). But the pipeline's `actions.ts` never uses MCP — it calls local TypeScript functions directly. There are two separate tool surfaces:

1. **MCP tools** — for external AI agents to call
2. **Pipeline internals** — deterministic functions called by `actions.ts`

**Recommendation:** Document this intentional separation. If unification is desired, create a shared service layer that both MCP handlers and pipeline actions call.

### G3: Gateway `allowedProviders` lacks direct unit test

The `allowedProviders` filtering logic in `buildAttempts()` is tested indirectly through runner integration tests but has no dedicated gateway-level test.

**Recommendation:** Add a focused test in `gateway.test.ts`:
```typescript
it('filters providers by allowedProviders', async () => {
  const openai = new FakeProvider('openai', 'gpt');
  const anthropic = new FakeProvider('anthropic', 'claude');
  const gw = new LLMGateway({ modelPolicy: policy, providers: [openai, anthropic] });
  const res = await gw.chat({
    messages: [{ role: 'user', content: 'Hi' }],
    model: 'gpt-4o',
    allowedProviders: ['openai'],
  });
  expect(res.provider).toBe('openai');
});
```

### G4: No test for model selection priority in runner.run()

The `run()` method has a three-tier model resolution: `charter.model` → `AGENT_STAGE_KEY` → `taskFamily` fallback. No test exercises all three branches in isolation.

**Recommendation:** Add a test that verifies:
- Charter with explicit model → gateway receives that model, no stageKey
- Charter with `model: auto` → gateway receives stageKey from `AGENT_STAGE_KEY`
- Unknown agent name → gateway receives `taskFamily: 'deep_reasoning'`

### G5: `AGENT_STAGE_KEY` is hardcoded, not configurable

The mapping `{ lead, writer, editor, publisher, panel-moderator, scribe }` is a static constant. New agents added to the pipeline won't get stage-aware routing unless this map is updated.

**Recommendation:** Either derive from charter metadata or move to `models.json` config.

### G6: writer-support has no explicit error path tests

`buildWriterSupportArtifact()` has no test for malformed/null inputs at the boundary (e.g., a `WriterFactCheckReport` with empty arrays). The parse round-trip is tested via `actions.test.ts` integration but not in isolation.

**Recommendation:** Add a dedicated `writer-support.test.ts` with round-trip and edge-case coverage.

---

## 8. Recommended Change Map

| Priority | File | Change | Rationale |
|---|---|---|---|
| Low | `tests/llm/gateway.test.ts` | Add `allowedProviders` filtering test | G3: Close direct unit test gap |
| Low | `tests/agents/runner.test.ts` | Add model selection priority tests | G4: Verify 3-tier model resolution |
| Info | `docs/` or README | Document MCP vs pipeline tool surface separation | G2: Prevent confusion about dual tool surfaces |
| Future | `src/llm/gateway.ts` | Add optional `tools` + dispatch loop to `ChatRequest` | G1: Only if LLM-driven tool-use is needed |
| Low | `src/agents/runner.ts` | Consider deriving `AGENT_STAGE_KEY` from config | G5: Reduce maintenance burden |
| Low | `tests/pipeline/writer-support.test.ts` | Add isolated round-trip + edge case tests | G6: Improve unit-level coverage |

---

## 9. Summary

The architecture follows a clean **layered orchestration** pattern:

- **Actions** handle domain logic and deterministic validation
- **Runner** handles agent identity, memory, and prompt composition
- **Gateway** handles multi-provider routing with automatic failover
- **Providers** handle the actual LLM API calls

Tool wiring is **context-injection based** — all tool output is pre-gathered and injected into LLM prompts. The LLM never calls tools directly. This gives full pipeline control at the cost of LLM autonomy.

Test coverage is strong across all three layers, with the actions integration tests being particularly thorough. The identified gaps are minor and mostly about isolated unit test coverage rather than missing functionality.
