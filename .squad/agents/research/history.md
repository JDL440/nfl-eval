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
