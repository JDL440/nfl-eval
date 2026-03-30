## Spawn Batch — App/Runtime + Engineering-System Split (2026-03-29T19:07:44.9412166Z)

- **Status:** Two implementation streams launched.
- **Stream 1 (App/Runtime):** surfaces src\pipeline\*, src\dashboard\server.ts, article skills. Owners: Code + Publisher + UX (Lead review).
- **Stream 2 (Engineering-System):** surfaces .squad/*, squad agent, ralph-watch, heartbeat. Owners: Lead + Ralph + Research + DevOps.
- **Validation:** article quality, render QA, publish readiness, board hygiene, reduced coordination drift.

# Research Agent History

## 2026-03-28: LM Studio Tool-Use Behavior Audit

### Request
Investigate LM Studio tool-use behavior for intended model `qwen/qwen3.5-35b-a3b`. Determine whether provider-native tool calling exists, trace model string flow, and identify best code path for improvement.

### Key Learnings

#### Architecture Decisions
1. **App-Managed Tool Loop, Not Native:** LM Studio provider relies on OpenAI-compatible `/chat/completions` endpoint which does not support tool definitions. Instead, the agent runner implements a JSON request/response protocol where:
   - Tools are injected as text in system prompt
   - Model returns JSON with `{"type":"tool_call"|"final",...}`
   - Runtime parses and executes tool calls, appends results to conversation
   - This works with any model capable of JSON output (e.g., Qwen 3.5)

2. **Model String Flow is Transparent:** The model identifier `qwen/qwen3.5-35b-a3b` (or any value) flows through the system without rewriting or aliasing. It is:
   - Read from `LMSTUDIO_MODEL` environment variable OR
   - Auto-detected from live LM Studio instance OR
   - Falls back to hardcoded default `qwen-35` (line 54, `src/llm/providers/lmstudio.ts`)

3. **Default Model Divergence:** The hardcoded default `qwen-35` does NOT match the intended model `qwen/qwen3.5-35b-a3b`. This requires explicit environment configuration or auto-detection from a running LM Studio server.

#### User Preferences / Patterns
- **Team uses JSON protocol for tool-use:** Rather than exploring native tool APIs (which LM Studio's OpenAI compat layer doesn't support), the system standardized on prompted JSON responses. This is a deliberate architectural choice, not a limitation.
- **Favor explicit configuration over defaults:** The team configures models via environment variables rather than relying on hardcoded values.

#### Key File Paths
- **Provider:** `src/llm/providers/lmstudio.ts` — chat request, model handling
- **Tool loop:** `src/agents/runner.ts:649–738` — JSON request/response loop, tool execution
- **Tool catalog injection:** `src/agents/local-tools.ts:178–200` — system prompt building
- **Provider registration:** `src/dashboard/server.ts:~2050` — initialization with env vars
- **Model policy:** `src/config/defaults/models.json` — stage-to-model mapping (GPT models, not LM Studio)

#### Test Gaps
- Unit tests for LM Studio provider exist but do NOT test tool-use (JSON loop) behavior
- Agent runner tests use mock provider (not LM Studio)
- **No integration test** validates that LM Studio + Qwen model can execute a full tool-use cycle
- Live testing possible but requires manual LM Studio setup; not automated in CI

#### Recommended Next Action
Add a focused integration test (`tests/integration/lmstudio-tool-loop.test.ts`) that:
- Skips in CI (via `test.skipIf(!process.env.LMSTUDIO_URL)`)
- Validates end-to-end tool loop with actual LM Studio provider
- Confirms JSON response parsing and tool execution work
- Proves the intended model (`qwen/qwen3.5-35b-a3b`) flows correctly
- Acts as confidence baseline for future changes

### Files Analyzed
- `src/llm/providers/lmstudio.ts` — provider implementation
- `src/llm/gateway.ts` — routing abstraction
- `src/agents/runner.ts` — agent orchestration & tool loop
- `src/agents/local-tools.ts` — tool catalog & execution
- `src/dashboard/server.ts` — provider registration & config
- `src/config/defaults/models.json` — model policy (for reference)
- `src/config/index.ts` — config constants
- `tests/llm/provider-lmstudio.test.ts` — provider unit tests
- `tests/agents/runner.test.ts` — agent & tool-use tests
- `tests/agents/local-tools.test.ts` — tool execution tests
- `tests/llm/gateway.test.ts` — gateway & routing tests

### Summary
LM Studio does NOT use native tool-calling (not available in its OpenAI-compatible API). Instead, the runtime implements an app-managed JSON loop where tools are injected as text and models respond with JSON commands. The model string `qwen/qwen3.5-35b-a3b` is not masked or aliased—it flows transparently, but requires explicit environment configuration to override the hardcoded default `qwen-35`. Live evaluation is possible with manual setup; integration tests should be added to build confidence in the tool-use path.

## 2026-03-28: LM Studio live validation follow-up

- Verified the live endpoint exposes the intended model and can emit valid `{"type":"tool_call",...}` JSON without provider-native tool definitions.
- Captured the LM Studio rejection of `response_format: { type: "json_object" }`, which is the key runtime compatibility caveat.
- The app-managed JSON loop remains the correct tool-use contract to document.

## 2026-03-29: Memory Injection Audit

### Request
Verify whether memories are being created and injected into runtime; find the most recent memory injection timestamp, if any.

### Key Findings

**Current State (as of 2026-03-29 09:35 UTC):**
- **0 memories in agent_memory table** — complete empty state
- **All 87 LLM traces have empty memories_json** (value is [], never populated with actual entries)
- **1,198 memories created historically** (SQLite seq counter shows 1198, all now deleted)
- **Last decay/prune operation:** 2026-03-29 09:05:16 UTC
- **Traces created post-prune:** 11 new traces, all with empty memory arrays

**Architecture Verification (Sound):**
1. Memory recall and injection path is correct:
   - AgentRunner.run() line 884: memory.recall(agentName, { limit: 10 })
   - Line 973: memories passed to startLlmTrace({ ... memories })
   - Repository.startLlmTrace() line 952: memories correctly stored via normalizeMetadataJson(params.memories)

2. Memory creation entry points exist but dormant:
   - Dashboard UI: /api/memory/create endpoint (line 2616, server.ts)
   - Domain refresh: LLM-generated knowledge summaries (line 2763, server.ts)
   - Bootstrap: One-time seed from bootstrap-memory.json (line 186, config/index.ts)
   - Roster context: Team roster populated as domain_knowledge (line 507, roster-context.ts)

**Root Cause Identified:**
Memory injection mechanism works flawlessly—memories are correctly injected when present. However, **no code is actively creating new memories** during normal pipeline execution. All 1,198 historical memories were purged by prune() method. System awaits manual dashboard creation or explicit refresh triggers.

**Evidence:**
- Direct DB query + code inspection of src/agents/memory.ts, src/agents/runner.ts, src/db/repository.ts
- Most recent non-empty memory: Never (agent_memory table always empty)
- Most recent attempted injection: 2026-03-29 09:21:04 (writer agent) — contains memories_json = []

### Insight
System does NOT automatically extract learnings from agent execution. Memory creation is opt-in only. No passive hooks record what agents learned, decided, or found during article production.
- 2026-03-29 — New spawn batch queued Research to split the app kickoff into actionable slices after branch sync, with outputs intended to hand directly to Code for implementation start.


## 2026-03-30: Debug/Trace Surface Exposure Audit

### Request
Audit debug/trace surfaces and machine-facing detail exposure. Identify how much session/CWD/request-envelope detail is currently exposed to operators vs. relegated to dedicated diagnostics areas.

### Key Findings

**Trace internals (mostly isolated):**
1. Dedicated trace pages (`src/dashboard/views/traces.ts`) provide structured observability for providers, tool-use, thinking, and errors
2. New-idea trace integration (Code agent) properly surfaces trace links on errors; approved as UX-safe
3. Existing trace infrastructure is solid; good home for debug material

**Machine-facing detail remaining exposed:**
1. Session/CWD/request-envelope details in article-detail chrome
2. Pipeline activity data and stageRun metadata exposed in artifact tabs
3. Provider envelopes mixed into article workflow surfaces
4. Raw system terms (status chips like `needs_lead_review`) in header

**Article detail hierarchy issues:**
1. Defaults to `idea.md` (intermediate pipeline artifact, not editorial artifact)
2. Exposes raw filenames + `💭 trace` badges as tab labels
3. Token usage, provider breakdowns, revision history occupy prime space
4. No plain-language workflow sentence or editorial context

**Recommendations:**
1. De-emphasize machine terms on article detail (remove raw status chips)
2. Reorder artifact tabs to lead with human-facing artifacts (draft, review, contract)
3. Push token/usage/provider data to collapsed secondary area or off-page
4. Preserve trace link access but move out of main action cluster
5. Add plain-language workflow sentence (e.g., "Draft ready for editor review")

### Alignment with UX Findings

Both audits converge: article detail should be editorial-first. Existing trace infrastructure is good; the issue is layout and navigation hierarchy, not trace isolation or observability design.

### Validation Points

- Artifact relabeling covers all stage transitions
- Workflow sentence accuracy across Stages 1-6
- Token/usage/provider data remains accessible (just collapsed/moved)
- Trace links still discoverable but de-emphasized from main flow

### Next Steps

- Coordinate with UX agent on artifact relabeling and workflow sentence copy
- Code agent to implement hierarchy changes with focused view tests
- DevOps to extend e2e fixtures for article-detail state validation

## Learnings

- 2026-03-30 — Debug/trace surfaces are well-segregated; the issue is article-detail hierarchy, not trace isolation. Article page mixes machine metadata with editorial context; moving debug content to secondary areas aligns with existing trace-page strategy. No new trace infrastructure needed; just hierarchy/copy fixes.

