# Code Agent Project History

## Learnings

### LM Studio Tool-Use Architecture (2026-03-28)

**Key Architecture Patterns:**
1. **App-Managed Tool Loop:** All tool-use is runtime-orchestrated, not provider-native. Models receive JSON response format instructions in system prompt, not tool definitions in request. See `src/agents/runner.ts` lines 649–733 for the iteration loop.

2. **Provider Model Routing:** LMStudioProvider (like all providers) receives model strings via `ChatRequest.model` parameter but LM Studio currently **ignores this and always uses `defaultModel`**. This is a bug blocking multi-model support.

3. **Model String Propagation:** Gateway routes candidates via ModelPolicy, but LMStudioProvider's `supportsModel()` returns true for everything, masking the fact that the actual model string is never used. Fixed by using `request.model ?? this.defaultModel`.

4. **Tool Catalog Format:** Tools are presented to models as text instructions + JSON examples in system prompt (see `buildToolCatalogPrompt()` lines 178–199), not as structured function definitions. This works for instruction-following models but requires careful prompt engineering.

**Critical Files:**
- `src/llm/providers/lmstudio.ts` — Provider implementation, line 116 is the fix point
- `src/agents/runner.ts` — Tool loop orchestration, lines 649–733
- `src/llm/gateway.ts` — Model resolution, ignores return from `supportsModel()`
- `src/dashboard/server.ts` — LM Studio registration, lines 2949–2965

**Best Next Fix:**
Change `src/llm/providers/lmstudio.ts` line 116 from:
```typescript
const model = this.defaultModel;
```
to:
```typescript
const model = request.model ?? this.defaultModel;
```

This aligns LM Studio with all other providers (Copilot, Mock) and allows model strings like `qwen/qwen3.5-35b-a3b` to flow end-to-end without being dropped.

**Live Testing Status:**
- `.live-lmstudio-data/` directory exists with config and database
- No active LM Studio runtime configured
- Can be enabled by setting `LMSTUDIO_URL=http://localhost:1234/v1` and starting LM Studio server
- Tests are currently mocked only (`tests/llm/provider-lmstudio.test.ts`)

**Notes:**
- No provider-native OpenAI tool calling is used (no `tools` field sent to LM Studio)
- Model receives only text instructions to output `{"type":"tool_call"...}` or `{"type":"final"...}`
- This works but is fragile if model training/alignment doesn't match exact JSON format expectations
- Future: Consider sending structured tool definitions if LM Studio API supports function calling

---
- 2026-03-28 — LM Studio tool use in v4 is app-managed in `src/agents/runner.ts` via JSON `{type:"tool_call"|"final"}` decisions and `src/agents/local-tools.ts`; provider-native tool calling is not wired. Live local LM Studio served `qwen/qwen3.5-35b-a3b`, direct text chat worked, but the tool loop failed because `src/llm/providers/lmstudio.ts` sends `response_format: { type: 'json_object' }`, while the live server rejected it and required `json_schema` or `text`. The same provider also masks requested models by forcing `defaultModel`, so `request.model` and policy-selected names do not flow through unless the provider itself is reworked.

## 2026-03-28: LM Studio live eval follow-up

- Confirmed the live LM Studio endpoint is reachable and serves `qwen/qwen3.5-35b-a3b`.
- `response_format: { type: "json_object" }` is rejected by LM Studio; plain chat still returned valid tool-call JSON.
- Targeted LM Studio/provider and agent tests passed, and `npm run v2:build` succeeded.
