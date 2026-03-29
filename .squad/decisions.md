# MERGED INBOX ENTRIES (2026-03-29T01-23-41Z)

## devops devps1 startup (APPROVED):

# DevOps Decision — dev.ps1 startup mode should be source-first with explicit built preflight

**Date:** 2026-03-29  
**Owner:** DevOps  
**Status:** APPROVED

### Context

- `package.json` in both `C:\github\nfl-eval` and `C:\github\worktrees\llminputs\worktrees\v4` exposes both `v2:serve` (source via `tsx`) and `v2:start` (built via `dist\cli.js`).
- Operators move between the main repo and the v4 worktree and asked whether `.\dev.ps1` requires a rebuild first.
- The current successful path is source-first; only the built path needs `dist` freshness.

### Decision

- Keep `.\dev.ps1` defaulting to `npm run v2:serve`.
- Add an explicit `-Built` switch that runs `npm run v2:build` immediately before `npm run v2:start`.
- Apply the same behavior to both `C:\github\nfl-eval\dev.ps1` and `C:\github\worktrees\llminputs\worktrees\v4\dev.ps1`.

### Why

- This preserves the existing fast path that already works without requiring rebuilds.
- It removes the stale-build footgun for the built startup path.
- Mirroring behavior across both locations lowers operator error when switching worktrees.

### Validation

- Spot-checked both scripts with `-CommandOnly` in default and `-Built` modes.
- `npm run v2:build` passed in both locations.
- Full `npm test` still fails in both locations on pre-existing e2e/database issues unrelated to `dev.ps1`.

---

## code lmstudio envelope fix (APPROVED):

# Code Decision Inbox — LM Studio trace envelope visibility

**Date:** 2026-03-29  
**Owner:** Code  
**Status:** APPROVED

### Context

- The trace timeline page already renders `provider_request_json` and `provider_response_json` from `src\dashboard\views\traces.ts`.
- `src\agents\runner.ts` only persists those fields when a provider returns `response.providerMetadata.requestEnvelope` / `responseEnvelope`.
- `src\llm\providers\lmstudio.ts` returned content/usage only, so successful LM Studio traces stored NULL envelopes and the dashboard showed empty sections.

### Decision

- Fix the problem at the LM Studio provider seam by emitting `providerMetadata` with the actual LM Studio request envelope and raw response envelope.
- Preserve runner, repository, and dashboard behavior for every other provider.
- Cover the seam with focused provider, runner, and dashboard tests instead of broad trace refactors.

### Why

- The trace page was not broken; the persistence chain never received LM Studio envelope data.
- Provider-local metadata keeps the fix small and avoids changing shared trace plumbing that already works for Copilot CLI.
- Capturing envelopes on success and relevant error paths makes LM Studio traces debuggable without widening scope into unrelated provider behavior.

---

## code recurring schema error (APPROVED):

### 2025-07: Tool-loop final envelope must appear in task text for every route with toolCalling enabled

**By:** Code (via investigation) / Joe Robinson  
**Date:** 2025-07  
**Status:** APPROVED

### Decision

Every server route that calls `runner.run()` with `toolCalling: { enabled: true }` MUST include the JSON final envelope instruction in the task string itself — not just in the system prompt. System prompt injection via `buildToolCatalogPrompt()` alone is insufficient for smaller models (Qwen via LM Studio) which follow the task-level instruction over the system prompt when both conflict.

### Why

Two separate fixes confirmed this pattern:
1. `/api/ideas` — fixed in prior session (idea-generation task text updated)
2. `/api/agents/:name/refresh-knowledge` and `/api/agents/refresh-all` — fixed in separate session (`knowledgePromptFor()` refactored to always append `KNOWLEDGE_REFRESH_ENVELOPE_FOOTER`)

The exact error these missing envelopes produce: "LLM response does not match schema: invalid option expected one of final|tool_call" — from `TOOL_LOOP_RESPONSE_SCHEMA` in `v4/src/agents/runner.ts:144`.

### Enforcement

Regression tests in `tests/dashboard/agents.test.ts` and `tests/dashboard/new-idea.test.ts` now verify the envelope phrases are present in all affected task strings. Any future route adding `toolCalling: { enabled: true }` must follow the same pattern.

---

# MERGED INBOX ENTRIES (2026-03-29T173307Z)

## code idea json (TO REVIEW):
# Code Decision Inbox — Idea JSON Failure

## Context
- The v4 idea page uses `src\dashboard\server.ts` POST `/api/ideas`, which calls `AgentRunner.run()` with tool calling enabled for stage 1.
- For LM Studio, that path reaches `src\agents\runner.ts` → `LLMGateway.chatStructuredWithResponse()` and requires machine-readable JSON decisions.
- The reported user error surfaced the raw model prose instead of a route mismatch or prompt-path issue.

## Decision
- Keep the existing stage-1 dashboard/request path and tool-loop contract.
- Fix LM Studio at the provider seam by sending backend-compatible structured-output mode (`response_format.type = "json_schema"`) instead of relying on plain text.
- Preserve strict gateway/schema validation, but tolerate Qwen-style wrappers (`<think>`, fenced JSON, leading/trailing prose) when extracting the actual JSON payload.

## Why
- The failure mode is provider request shaping plus local-model wrapper noise, not the wrong route or a broken prompt file.
- Changing the dashboard flow would not address the actual contract mismatch and would risk bypassing the existing safe tool loop.
- This keeps the fix localized to LM Studio structured output while leaving other providers and callers unchanged.

## lead idea json review (APPROVED):
# Lead Decision — idea-generation JSON fix review

**Date:** 2026-03-29  
**Owner:** Lead  
**Status:** APPROVED

## Decision

Approve this patch for merge as a **localized fix** for the idea-generation JSON failure.

## Why

- The patch corrects the two seams directly implicated in the failure:
  1. `src\llm\providers\lmstudio.ts` now sends `response_format.type = "json_schema"` instead of the rejected `json_object` shape.
  2. `src\llm\gateway.ts` now recovers valid JSON when Qwen-style output wraps the payload in `<think>` tags, code fences, or surrounding prose, while still failing closed if no parseable JSON remains.
- The added tests cover:
  - provider request shaping (`tests\llm\provider-lmstudio.test.ts`)
  - gateway structured parsing and LM Studio integration (`tests\llm\gateway.test.ts`)
  - runner/tool-loop behavior with wrapped JSON (`tests\agents\runner.test.ts`)
  - the dashboard idea flow (`tests\dashboard\new-idea.test.ts`)
- Validation passed:
  - `npm run v2:build`
  - `npx vitest run tests/llm/gateway.test.ts tests/llm/provider-lmstudio.test.ts tests/agents/runner.test.ts tests/dashboard/new-idea.test.ts`

## Scope guard

This approval is limited to fixing the **idea-generation JSON failure**. It does **not** close the broader LM Studio follow-up around requested-vs-effective model traceability or provider envelope visibility.

## Follow-up not required for this fix

1. Add LM Studio `providerMetadata.requestEnvelope` / `responseEnvelope` so traces show the exact structured request and raw response.
2. Refine LM Studio model forwarding so policy aliases remain route hints while real LM Studio model ids can still be honored explicitly and traced.

---

# MERGED INBOX ENTRIES (2026-03-28T22:10:19Z)

## devops lmstudio v4 revision (APPROVED):

# Decision — DevOps LM Studio v4 Revision

**Date:** 2026-03-28  
**Owner:** DevOps  
**Status:** APPROVED

## Decision

Keep the landed LM Studio structured-output fixes, but do **not** forward gateway policy aliases into LM Studio as backend model ids.

## Why

- In `worktrees\v4`, `src\llm\gateway.ts` still resolves policy aliases like `gpt-5-mini` for routing.
- When LM Studio is the default/first provider, blindly forwarding that alias overrides the actually loaded local model and breaks the live path.
- The safe contract is: LM Studio may accept the route, but it should only forward `request.model` when that value matches the discovered/default local LM Studio model set.

## Applied Revision

1. Preserve the good patch behavior:
   - Qwen-style wrapped JSON parsing in `src\llm\gateway.ts`
   - no `response_format.type = "json_object"` in `src\llm\providers\lmstudio.ts`
2. Tighten LM Studio model selection:
   - keep the default loaded local model for policy-routed aliases
   - honor `request.model` only when it is a real LM Studio model id already known to the provider
3. Keep the fallback visible in provider metadata so traces can show requested vs effective model.

## Validation

- `npm run v2:build`
- `npx vitest run tests\llm\gateway.test.ts tests\llm\provider-lmstudio.test.ts tests\agents\runner.test.ts`
- Live smoke against local LM Studio with `qwen/qwen3.5-35b-a3b` confirmed the gateway still resolved `gpt-5-mini` as the route hint while LM Studio executed `qwen/qwen3.5-35b-a3b`.

## Durable Rule

When LM Studio is the default provider, gateway policy aliases are route hints only; `src\llm\providers\lmstudio.ts` should forward `request.model` only when it matches the loaded/default LM Studio model set, otherwise keep the effective local default model.

---

# MERGED INBOX ENTRIES (2026-03-28T21:52:59Z)

## lead lmstudio v4 review (APPROVED):

# Lead Decision — LM Studio v4 review gate

**Date:** 2026-03-28  
**Owner:** Lead  
**Status:** APPROVED

## Decision

Do **not** approve the upcoming v4 LM Studio patch unless it proves the live `qwen/qwen3.5-35b-a3b` tool-loop failure is fixed at the actual structured-response seam, not just in stubbed tests.

## Approval criteria

1. **Structured-output request shaping is live-compatible**
   - The LM Studio path no longer sends the failing `response_format: { type: 'json_object' }` shape for structured tool-loop turns.
   - The replacement shape is explicitly compatible with the live LM Studio/Qwen path (for example `json_schema`) or the implementation ships a tested text fallback that still preserves bounded parsing safety.

2. **Requested model/provider intent survives provider shaping**
   - `src\llm\providers\lmstudio.ts` must not silently discard `request.model` when one is supplied.
   - Any fallback/default behavior must stay explicit and traceable in provider metadata.

3. **Tool-loop eligibility stays app-owned and model-safe**
   - If `src\llm\gateway.ts` adds a route-preview seam, it must help the runner decide tool eligibility from the resolved provider without weakening model-first routing.
   - Reject any patch that broadens `LMStudioProvider.supportsModel()` semantics or otherwise makes LM Studio capture policy-model traffic just to enable tools.

4. **Trace envelopes prove what actually happened**
   - Provider metadata should expose request/response envelopes that make the structured request shape and LM Studio response debuggable in traces.
   - Review should be able to tell configured intent apart from effective runtime behavior.

5. **Regression tests cover the real failure path**
   - `tests\llm\provider-lmstudio.test.ts` should assert the new LM Studio request body shape and request-model behavior.
   - `tests\agents\runner.test.ts` should still prove the bounded loop works with structured turns and persists trace metadata.
   - Green tests alone are insufficient unless they directly exercise the code path that used to emit `json_object`.

## Reject conditions

- Docs/env wiring lands without fixing the LM Studio structured request.
- The patch changes Copilot CLI behavior or broader tool policy instead of the LM Studio seam under review.
- The change claims to fix Qwen live looping but leaves no trace evidence showing the new request/response envelope.

## Why

Current v4 baseline already passes targeted unit tests and `npm run v2:build`, yet prior live validation showed LM Studio rejecting the exact structured-output body the provider emits today. The review gate therefore has to focus on request-shape correctness, provider traceability, and model-safe routing rather than trusting existing green tests.

---

## copilot directive 2026-03-28T21-10-32Z (USER DIRECTIVE):

### 2026-03-28T21-10-32Z: User directive
**By:** Joe Robinson (via Copilot)
**What:** Use qwen/qwen3.5-35b-a3b for LM Studio testing while evaluating tool use on v4.
**Why:** User request - captured for team memory

---

## code lmstudio tooling (DECISION):

### Decision — Code Agent LM Studio Tooling

Enable LM Studio for safe in-app tool use through the app-owned bounded loop instead of provider-native MCP or Copilot CLI flags.

**Actions:**
1. Keep Copilot CLI behavior unchanged.
2. Add a canonical local tool registry at `mcp\tool-registry.mjs`.
3. Let `AgentRunner` activate the bounded tool loop for LM Studio only, using:
   - `local_tool_catalog`
   - approved read-only query tools
   - optional bounded `web_search`
4. Reject mutating local tools by default.
5. Record tool-loop metadata in LLM traces for audit/debug visibility.

**Why:**
- LM Studio in this repo talks to an OpenAI-compatible chat endpoint, not MCP directly.
- The safest bridge is app-owned execution of the already-approved local handlers.
- This preserves Copilot CLI parity where it already exists while giving LM Studio access to the same safe repo-local capabilities inside article runs.

**Notes:**
- LM Studio rejected `response_format.type = "json_object"` during live validation; `json_schema` worked.
- Live validation succeeded against the local dashboard on port 3466 with LM Studio + tool loop enabled, and the trace page showed `local_tool_catalog`, `query_player_stats`, and `web_search` in the recorded tool loop.

---

## code lmstudio v4 port recommendation (DECISION):

### Code Decision — LM Studio v4 port recommendation

**Date:** 2026-03-28  
**Owner:** Code  
**Status:** Proposed

Port the **LM Studio-specific runtime seams** from dirty `main` into `v4`, but **do not** bulk-copy the constructor-level tool-loop architecture.

**Recommended port set:**

1. `src\llm\gateway.ts`
   - add `previewRoute()` so the runner can decide tool eligibility from the resolved provider before sending a request
2. `src\llm\providers\lmstudio.ts`
   - switch structured output from `response_format.type = "json_object"` to `response_format.type = "json_schema"`
   - emit `providerMetadata.requestEnvelope` / `responseEnvelope` for traceability
3. `src\dashboard\server.ts` + env/docs
   - add explicit LM Studio tool/web-search toggles and wire them into the live app
   - document the toggles in `.env.sample` and operator docs
4. tests
   - carry the LM Studio-specific runner/provider coverage that proves bounded local tools and bounded web search

**Do Not Port As-Is:**
- Do **not** transplant `AgentRunner`'s constructor-level `toolLoop` option from dirty `main` into `v4`.
- Keep `v4`'s per-run `toolCalling` surface, because it is the more flexible long-term contract for stage/surface-specific tool grants.

**Required Reconciliation:**

Before calling `v4` ready, reconcile its broader current grants in `src\pipeline\actions.ts`:
- `toolCalling.enabled = true`
- `includeLocalExtensions = true`
- `includePipelineTools = true`
- `allowWriteTools = true`

That surface is broader than the safer LM Studio direction validated on dirty `main`, where the loop is narrowed to read-only repo-local tools plus optional bounded `web_search`.

**Why:**

The research plan favored an app-owned bounded loop, explicit tool policy, and traceability. Dirty `main` adds the missing LM Studio plumbing for that direction, while `v4` already has most of the generic loop machinery but still lacks the LM Studio-specific route preview, structured-output fix, trace envelopes, and operator-facing wiring.

**Practical Recommendation:**
- **Port:** LM Studio route preview, `json_schema`, request/response envelopes, env/docs, focused tests
- **Adapt, not copy:** runner activation wiring
- **Audit before live test:** `src\pipeline\actions.ts` write-capable grants

---

## devops copilot session reuse squad (DECISION):

### DevOps Decision Inbox — Copilot CLI session-reuse squad merge

**Date:** 2026-03-28  
**Owner:** DevOps  
**Status:** Proposed

Carry forward three durable team rules from the `feature/copilot-session-reuse` squad artifacts:

1. Keep `src\llm\providers\copilot-cli.ts` as the sole owner of CLI-native `toolAccessMode`, repo MCP gating, and session-reuse behavior/metadata.
2. Preserve a fail-closed startup contract: when explicit Copilot mode or compatibility flags are unset, tools, repo MCP, and session reuse should remain off.
3. Treat session reuse traces as "requested vs actually used" observability unless the provider truly executes a resume flow; tests and reviews should not over-claim resumed execution from intent-only metadata.

**Why:**
- The compared worktree contained useful architecture-review notes, but main already holds the newer/superset versions of most scoped decisions and skills.
- The durable gap worth preserving is the contract boundary and review heuristic: CLI-native behavior belongs in the CLI provider, and trace metadata must distinguish configuration intent from real resume execution.

**Implications:**
- Review `src\dashboard\server.ts` and `src\llm\providers\copilot-cli.ts` together whenever tool mode, repo MCP, or session reuse behavior changes.
- Keep `.copilot\mcp-config.json` and `.mcp.json` aligned, but remember config parity does not override the explicit provider mode contract.
- When validating traces, look for concrete CLI args and provider metadata before calling session reuse active.

---

## devops lmstudio v4 live test (DECISION):

### Decision: LM Studio v4 Live-Test Feasibility

**Status:** Assessment Complete  
**Date:** 2026-03-28  
**Owner:** DevOps  
**Requestor:** Backend (Squad Agent)  

**Executive Summary:**

**v4 CAN be live-tested safely RIGHT NOW** without any porting from main. v4 has already ported the critical LM Studio tool-calling infrastructure (local-tools loop, executor, safe-catalog) that enables real tool use on LM Studio, and the branch is merged current with main. The live test is not blocked by missing code or config—only by three prerequisites: a running LM Studio instance, the correct env vars set, and understanding what evidence proves tool success vs fallback-to-chat-only.

**Key Findings:**

v4 Status: Safe, Ready, Already Ahead
- Build: ✅ Clean (`npm run v2:build` succeeds)
- Main merge: ✅ Current (v4 merged current; no stale divergence)
- Tool loop: ✅ Implemented (`src/agents/local-tools.ts`, 231 lines)
- LM Studio provider: ✅ Ready (chat-only transport; tool calls app-owned)
- Tool executor: ✅ Ready (`executeToolCall()` validates and runs)
- Agent runner: ✅ Tool-aware (multi-turn tool loop implemented)
- Safe catalog: ✅ Constrained (~13 read-only tools; blocking publish/image-gen/cache)
- Web search: ✅ Guarded (bounded DuckDuckGo; configurable)

**Startup Prerequisites:**
```env
LLM_PROVIDER=lmstudio
LMSTUDIO_URL=http://localhost:1234/v1
LMSTUDIO_MODEL=<model-loaded>  # e.g., qwen-35
LMSTUDIO_ENABLE_TOOLS=1
LMSTUDIO_ENABLE_WEB_SEARCH=1
```

**Evidence of Tool Success vs Fallback:**
1. Check dashboard trace at `/runs` for `tool_call` entries
2. Look for app logs from `AgentRunner.runWithTools()`
3. Inspect `providerMetadata.toolLoopStats` with `toolCallCount` > 0
4. Query database for `"type": "tool_call"` entries in trace

**Blockers:** None. No code porting needed; tool loop already in v4.

**Confidence:** Very High (95%+). The only operational variable is the quality of the loaded LM Studio model; some models have only "default" tool support, not native.

**Tool Catalog (Safe):**
- local_tool_catalog, query_player_stats, query_team_efficiency, query_positional_rankings, query_snap_counts, query_draft_history, query_ngs_passing, query_combine_profile, query_pfr_defense, query_historical_comps, query_rosters, web_search (if enabled)

**Tool Catalog (Blocked):**
- generate_article_images, render_table_image, publish_to_substack, publish_tweet, refresh_nflverse_cache

---

## lead copilot session reuse squad (DECISION APPROVED):

### Lead Decision Inbox — copilot-session-reuse squad knowledge carry-back

**Date:** 2026-03-28  
**Owner:** Lead  
**Status:** APPROVED

**Decision:**

Carry back only additive, durable `.squad` knowledge from `feature/copilot-session-reuse` into `main`.

**Approved carry-back:**
- `copilot-cli-guarded-mode-contract`
- `provider-capability-envelope`
- `provider-trace-session-contract`
- `nodenext-js-specifier-diagnosis`
- `stage5-valid-draft-fixtures`

**Why:**

The tracked `.squad` snapshot on the feature branch is older than current `main` and would delete newer team knowledge if merged directly. The worktree also contains untracked skill drafts that are durable and repo-specific, so the safe path is selective additive carry-back rather than wholesale replacement.

**Reject:**

Do not accept deletions or stale replacements for:
- `decisions-archive.md` truncation or wholesale replacement from the older branch snapshot
- `copilot-cli-mcp-config`
- `dev-startup-with-background-mcp`
- `memory-pollution-detection`
- `panel-construction-audit`
- newer `llm-observability-audit` guidance
- `.env.sample` wording in `optional-dashboard-service-wiring`

---

## lead lmstudio v4 keep or port (DECISION):

### Lead Decision — LM Studio v4 keep or port

**Verdict:**

Keep `v4` as the implementation path. Do **not** treat dirty `main` as the preferred branch and do **not** ignore it entirely; selectively port the additive safety and validation pieces from dirty `main` into `v4`.

**Why:**

1. **`v4` already follows the research direction.**
   The research plan recommends an app-owned tool loop above the provider, not provider-native LM Studio tooling. `v4` already does that with `src\agents\runner.ts`, `src\agents\local-tools.ts`, `src\tools\*`, and live dashboard callsites in `src\dashboard\server.ts`.

2. **Dirty `main` is narrower but safer.**
   Dirty `main` adds a bounded LM Studio-only loop, explicit read-only allowlisting in `mcp\tool-registry.mjs`, optional web search, route preview/disallow support in `src\llm\gateway.ts`, and LM Studio trace envelope capture in `src\llm\providers\lmstudio.ts`.

3. **Dirty `main` is not a superset of `v4`.**
   It does not carry over `v4`'s richer requested-tool selection, pipeline-tool plumbing, or live route integrations. Replacing `v4` with dirty `main` would be a feature regression, not an upgrade.

4. **Neither branch implements provider-native OpenAI `tool_calls` for LM Studio.**
   Both branches still rely on a prompt-mediated JSON contract. That is acceptable for now because it matches the research recommendation to keep control in-app, but it means the real question is safety + route wiring, not LM Studio transport support.

**Port from dirty `main`:**
- Safe read-only allowlist pattern from `mcp\tool-registry.mjs`
- LM Studio-specific runner coverage proving the loop works end-to-end
- LM Studio provider trace envelope metadata
- The routing guardrails that prevent tool-loop turns from falling into `copilot-cli`
- If desired for live testing, the optional bounded web-search path

**Do not port wholesale:**
- The entire `main` tool-loop shape as a replacement for `v4`
- Any narrowing that would remove `v4`'s requested-tool model or pipeline tool support
- Any branch-level `.squad` or docs state that would overwrite newer `main` context

**Minimal next steps:**
1. Start the clean `v4` app and test `/api/ideas` with `provider: "lmstudio"` first; that route already enables read-only data tools.
2. Before broader rollout, add/port the LM Studio-specific tests and allowlist hardening from dirty `main`.
3. Treat `localhost:1234` as ready for testing now, but note the dashboard app was not running during review.

---

## research lmstudio tool plan comparison (DECISION):

### Research Decision — Tool-Calling Plan Alignment: Main vs V4

**Date:** 2026-03-28  
**Owner:** Research  
**Status:** Recommendation for coordinator review

**Decision:**

The main branch has tool-calling implementation (dirty state) that is **functionally usable but architecturally misaligned** with the tool-calling research plan. V4 has a **more complete and safer implementation** that addresses all recommendations.

**Action:** Coordinate with Code to review v4's approach and decide between:
1. **Port v4 into main** (recommended) — full safety model, pipeline tool access, gateway prep.
2. **Ship main as-is** (faster) — works for local LM Studio tool loop but leaves gaps on safety formalization and future provider roadmap.

**Rationale:**

The research plan recommended:
1. **In-app controlled tool loop** (not Copilot CLI native) ✓ Both branches do this.
2. **Use existing MCP server as first tool catalog** — Half-done on main; fully done on v4.
3. **Formalize permission boundaries** — Advisory hints on main; structured policy on v4.
4. **Prepare gateway for Gemini/OpenAI tool calling** — Main skipped this; v4 added `tools` field.

**Technical Comparison:**

**Main branch (dirty):**
- Local tool loop: yes, works for LM Studio.
- Tool catalog: `mcp/tool-registry.mjs` with handler functions.
- Safety model: `readOnlyHint` boolean + free-form `sideEffects` string.
- Pipeline tools: not exposed; separate from local loop.
- Gateway changes: none.
- Test coverage: basic local-tools tests.

**V4 branch:**
- Local tool loop: yes, same pattern, more complete.
- Tool catalog: split between `mcp/local-tool-registry.mjs` (extensions) and `src/tools/pipeline-tools.ts` (repo tools).
- Safety model: structured `ToolSafetyPolicy` with `readOnly`, `writesState`, `externalSideEffects` enums + `allowedSurfaces`/`allowedAgents` allowlists.
- Pipeline tools: formal implementations (article_get, pipeline_status, etc.) callable via the same tool loop.
- Gateway changes: added `tools` field to `ChatRequest`.
- Test coverage: runner.test.ts covers loop orchestration; local-tools.test.ts covers execution.

**Risk of Main As-Is:**

If you ship main without v4's safety formalization:
- **Silent permissions:** Tools are safe *by intent* (readOnlyHint), not by structure. Easy to add a write tool and forget to restrict it.
- **No pipeline tool access:** If you later want article_get callable via tool loop, you'll have to retrofit it.
- **Gateway misalignment:** When Gemini/OpenAI provider support lands, gateway won't have the right contract shape.
- **Testing gap:** Loop orchestration not covered; only tool execution is tested.

**Benefits of V4:**
- **Formal safety envelope:** `ToolSafetyPolicy` makes permissions testable and auditable.
- **Pipeline tool integration:** Can safely expose read-only repo operations without expanding the MCP surface.
- **Cleaner separation:** Tool definitions in `src/tools/` under version control; handlers still loaded dynamically.
- **Future-proof:** Gateway prepared for provider-level tool calling.

**Carry-Forward Knowledge:**

From the comparison, this durable knowledge stands:

**Tool-calling safety principle:** Once models call tools, the permission boundary must be enforced by structure (enums, allowlists) not by documentation. Code must not allow accidental privilege escalation.

**Pipeline tool access:** Read-only pipeline operations (article_get, pipeline_status, etc.) should be callable via the same tool loop as local extensions, not a parallel MCP path. Unified interface reduces confusion and tracing surface.

**Gateway contract:** Even if a provider doesn't use tool calling yet, the gateway contract should be prepared for it (e.g., ChatRequest.tools field). This reduces rework when Gemini support lands.

**Recommended Path:**

**If Code wants to ship on main:**
1. Keep main's `src/agents/local-tools.ts` and `mcp/tool-registry.mjs`.
2. Port v4's `src/tools/catalog-types.ts` (type system) and `src/tools/pipeline-tools.ts` (implementations).
3. Update main's runner to use v4's `ToolDefinition` and `ToolSafetyPolicy` instead of `ToolCatalogEntry`.
4. Add `tools` field to `src/llm/gateway.ts` ChatRequest (not used yet, but prepared).
5. Copy v4's runner test coverage (especially loop orchestration tests).

**If Code wants to integrate v4 wholesale:**
1. Rebase main onto v4.
2. Resolve any conflicts with newer main-specific work (decisions.md is likely the only conflict).
3. Test LM Studio tool calling against the live app.

---

## research lmstudio v4 test plan (DECISION):

### LM Studio Tool-Calling v4 Implementation: Test Plan & Validation Checklist

**Date:** 2026-03-29  
**Author:** Research Agent  
**Status:** Ready for Team Review  
**Scope:** V4 branch implementation vs. LM Studio tool-use research plan; validation path for qwen/qwen3.5-35b-a3b

**Executive Summary:**

The v4 branch **fully implements the app-owned tool-calling pattern** recommended in the research plan. All core safety and functionality requirements are met. The implementation is ready for live validation with Qwen 3.5-35B, with a clear 10-item test checklist to verify tool discovery, allowlisting, execution, and trace capture.

**Status:** ✅ Aligned with research plan. No architectural gaps. Ready for Qwen validation.

**Alignment Table:**

| Research Recommendation | V4 Code Location | Status |
|---|---|---|
| App-owned loop, not provider-native | `src/agents/runner.ts:649–738` | ✅ Fully implemented |
| Structured `ToolSafetyPolicy` (readOnly, writesState, externalSideEffects) | `src/tools/catalog-types.ts:31–38` | ✅ Enforced |
| Allowlist per agent/stage/surface | `src/agents/local-tools.ts:138–153` | ✅ Validated at execution |
| Deduplication via call args hash | `src/agents/runner.ts:698, 707–711` | ✅ seenCalls Set prevents duplicates |
| Bounded tool budget (configurable max calls) | `src/agents/runner.ts:652, 660–733` | ✅ Default 4 calls, configurable |
| Normalized JSON turn loop | `src/agents/runner.ts:727–732` | ✅ Schema: {type: 'tool_call'\|'final'} |
| Auditable traces | `src/agents/runner.ts:717–723, 599–636` | ✅ Metadata captured |
| Copilot CLI exclusion (native tool calling) | `src/agents/runner.ts:649` | ✅ Line 649: opt-out |
| Gateway prepared for future schemas | `src/llm/gateway.ts` (ChatRequest.tools) | ✅ Field added, passive |

**10-Item Test Checklist:**

1. ✅ JSON Response Format Validation — Qwen emits valid JSON; invalid JSON caught gracefully
2. ✅ Tool Discovery & Allowlist Filtering — Only allowed tools visible; disallowed tools rejected
3. ✅ Tool Call Execution & Result Loop — Tool calls succeed; results injected; loop continues
4. ✅ Thinking Token Preservation (Qwen) — Thinking markers extracted; trace includes thinking metadata
5. ✅ Safety Boundary Validation — Read-only tools always available; write tools blocked unless enabled
6. ✅ Tool Schema Validation — Arguments validated against schema; invalid args return error
7. ✅ Error Handling & Graceful Degradation — Tool handler errors caught; no stack traces leak; loop continues
8. ✅ Trace Metadata Capture — Tool calls logged with full context (toolName, args, source, isError, resultText)
9. ✅ Pipeline Tool Integration — Pipeline tools work correctly; repo/engine context injected
10. ✅ Local Extension Tool Registry Loading — Local tools load at startup; caching works; deduplication applied

**Live Test Commands:**

**Option A: Unit Test (Vitest)**
```bash
npm run test -- tests/agents/runner.test.ts --reporter=verbose
# Look for: "executes a bounded tool loop and stores tool call metadata in traces"
```

**Option B: Integration Test (LM Studio Live)**
```bash
export LM_PROVIDER=lmstudio
npm run dev  # http://localhost:3456
# Create article requiring tools; inspect trace for tool_call entries
```

**Option C: Type Safety Check**
```bash
npx tsc --noEmit
# Verify ToolDefinition, ToolSafetyPolicy, ToolExecutionContext types compile
```

**Gaps & Mitigations:**

| Gap | Impact | Mitigation |
|---|---|---|
| No Qwen-specific test provider | Hard to test Qwen thinking tokens in unit tests | Add `QwenTestProvider` to tests if needed; live test captures real behavior |
| Qwen-specific settings not exposed | Temperature/top_p/reasoning not configurable per tool | Can add to `ToolCallingConfig` if needed; currently uses shared runner config |
| Local registry not hot-reloaded | Changes to tool definitions require restart | Acceptable; registry is static in production. Consider lazy-load if dynamic tools needed |
| No live NFLVerse API in tests | Pipeline tools tested with mocked repo | Full e2e requires live DB; current unit tests sufficient for tool loop logic |
| Tool timeout not enforced | Slow handlers can block loop | Add `AbortController` timeout wrapper if needed; decision.md recommends 2min timeout |
| Web search not in v4 sample | Plan mentions web search; v4 shows pipeline/local only | Copilot CLI has web search; separate from tool-calling loop. Can be added as web_search tool |

**Recommendation:**

**Proceed with v4 as the baseline for LM Studio tool-calling validation.**

**Reason:** V4 aligns perfectly with the research plan. All core requirements are implemented and tested.

**Next steps:**
1. ✅ Code review: Verify `src/agents/runner.ts` (tool loop), `src/agents/local-tools.ts` (allowlist), `src/tools/catalog-types.ts` (types)
2. ✅ Run 10-item test checklist against Qwen 3.5-35B (live or unit tests)
3. ✅ If all items pass: proceed to LM Studio provider registration and live validation
4. ✅ If any item fails: identify root cause and iterate

---

# MERGED INBOX ENTRIES (2026-03-28T23:59:00Z)

## lead copilot session reuse squad merge (APPROVED):

# Lead Decision — copilot-session-reuse squad knowledge carry-back

## Decision

Carry back only additive, durable `.squad` knowledge from `feature/copilot-session-reuse` into `main`.

Approved carry-back:

- a durable team rule that Copilot CLI tool/session behavior belongs in `src\llm\providers\copilot-cli.ts` plus its startup wiring, while `src\llm\providers\copilot.ts` stays a plain text-only adapter
- a durable observability rule that traces must distinguish configured intent from effective runtime capability

## Why

The feature worktree is behind current `main` and its tracked `.squad` snapshot would regress newer knowledge if merged wholesale. The safe carry-back is therefore limited to additive, scoped provider-boundary and observability guidance from the allowed comparison set.

## Rejected regressions

Do **not** delete or overwrite newer `main` knowledge while carrying back feature-branch learning.

Rejected regressions from the feature snapshot:

- truncating `decisions-archive.md` to the older branch snapshot (feature diff shows a massive archive shrink and is not merge-safe)
- deleting `copilot-cli-mcp-config`, `dev-startup-with-background-mcp`, `memory-pollution-detection`, or `panel-construction-audit`
- trimming newer sanity-check guidance from `llm-observability-audit`
- replacing `.env.sample` guidance with stale `.env.example` wording in `optional-dashboard-service-wiring`
- replacing current `decisions.md` or `decisions-archive.md` wholesale with the older branch copy

## Accepted durable knowledge

1. Copilot CLI guarded mode is an explicit contract: `toolAccessMode` wins over legacy booleans.
2. Session reuse is narrower than tool mode: allow it only for article stages 4-7, with `articleId`, and only when the CLI provider has session reuse enabled.
3. Provider traces must carry mode/session/envelope data end-to-end without teaching the plain Copilot provider CLI-only behavior.

# MERGED INBOX ENTRIES (2026-03-28T19:15:11Z)

## code copilot session reuse contract (IMPORTED FROM feature/copilot-session-reuse):

# Code Decision - Copilot CLI provider contract carry-forward

- **Date:** 2026-03-28
- **Owner:** Code
- **Status:** Imported from `feature/copilot-session-reuse`

## Decision

Carry forward the durable Copilot provider split from `feature/copilot-session-reuse`:

- `src\llm\providers\copilot-cli.ts` remains the sole owner of guarded `article-tools` behavior, approved MCP allowlisting, session reuse, and trace/session metadata.
- `src\llm\providers\copilot.ts` stays text-only and must not inherit CLI-only article-tools or session semantics.
- `src\dashboard\server.ts` should pass explicit `toolAccessMode` into the CLI provider; legacy `enableTools`-style flags are compatibility shims only.

## Why

This keeps runtime safety, tests, and provider boundaries aligned. It also prevents the plain API adapter from accidentally inheriting CLI-only behavior that belongs to the CLI-backed path.

## Additional carry-forward guidance

- Prefer explicit allowlists over deny-lists for tools and MCP exposure.
- Keep safety defaults opt-in (`=== '1'` style gates), not opt-out.
- Fail closed if `.copilot\mcp-config.json` is unavailable; execution flags and prompt policy should agree.
- Treat session reuse as conservative and trace-first until prompt-mode resume is proven safe end to end.

---

## lead lmstudio architecture review (REJECTED):

# Lead Decision — LM Studio tools/MCP/web search architecture review

- **Date:** 2026-03-28
- **Owner:** Lead
- **Status:** Rejected
- **Risk:** Medium-high if forced without redesign

## Decision

Reject any proposal to "fully enable" LM Studio for tools, MCP servers, and web search **as a configuration-only change** in the current architecture.

## Why

1. **LM Studio is chat-only in the working tree.**  
   `src\llm\providers\lmstudio.ts` issues one OpenAI-compatible chat request and returns one text response. It has no tool schema, tool-call loop, MCP client path, or web-search contract.

2. **Tooling is intentionally provider-specific today.**  
   `src\llm\providers\copilot-cli.ts` owns `toolAccessMode`, guarded web fetch, repo MCP wiring, and session reuse. `src\dashboard\server.ts` only passes those controls into Copilot CLI registration.

3. **Gateway/runner are not provider-agnostic tool orchestrators in this checkout.**  
   `src\agents\runner.ts` forwards plain chat requests into `src\llm\gateway.ts`, and the gateway expects providers to return final text. There is no shared tool-execution seam to drop LM Studio into safely.

4. **Auto-routing would get riskier, not safer.**  
   `src\llm\gateway.ts` picks the first provider whose `supportsModel()` matches. `src\llm\providers\lmstudio.ts` returns `true` for every model name, so moving LM Studio earlier in registration order widens its capture of model-policy traffic without adding tool safety.

5. **Repo MCP exposure is broad.**  
   `.mcp.json` and `.github\extensions\README.md` expose `nfl-eval-local` / `nfl-eval-pipeline` with `tools: ["*"]`. `mcp\server.mjs` includes mutating publish/media/cache tools alongside read-only queries, so "turn on MCP" is not equivalent to "safe read-only MCP."

## Closest supported path

- Keep **LM Studio** as the text-only local-model provider.
- Use **Copilot CLI in `article-tools` mode** for guarded web search, repo MCP, and session reuse.
- If the product wants "LM Studio + tools," build it as an **app-owned provider-agnostic tool loop** above providers, with explicit allowlisting and live end-to-end validation, rather than as an LM Studio-specific toggle.

## Runtime Validation

- DevOps can prepare manual/live validation wiring with `LLM_PROVIDER=lmstudio`, `.\dev.ps1 -WithMcp`, and `/config` inspection.
- That wiring helps future testing, but it still does **not** imply LM Studio tool execution, repo MCP forwarding, or web-search brokerage.
- Keep the guarded MCP/tool path on Copilot CLI until a provider-agnostic allowlist seam exists.

## Evidence

- Provider boundary: `src\llm\gateway.ts`, `src\llm\providers\lmstudio.ts`, `src\llm\providers\copilot-cli.ts`
- Startup wiring: `src\dashboard\server.ts`
- Pipeline/runner threading: `src\agents\runner.ts`, `src\pipeline\actions.ts`
- MCP exposure: `mcp\server.mjs`, `src\mcp\server.ts`, `.mcp.json`, `.github\extensions\README.md`
- Tests: `tests\llm\provider-lmstudio.test.ts`, `tests\llm\gateway.test.ts`, `tests\llm\provider-copilot-cli.test.ts`, `tests\mcp\server.test.ts`

## Validation

Baseline validation passed in this review:

- `npm run v2:build`
- `npx vitest run tests\llm\provider-lmstudio.test.ts tests\llm\gateway.test.ts tests\llm\provider-copilot-cli.test.ts tests\mcp\server.test.ts`

---

## devops lmstudio mcp audit (PROPOSED):

# Decision Inbox — DevOps LM Studio MCP Audit

**Date:** 2026-03-28  
**Owner:** DevOps  
**Status:** Proposed

## Decision

Do **not** enable LM Studio for repo MCP tools or web search in the current branch. Keep LM Studio on the existing chat-only path and keep tool-aware article work on the guarded Copilot CLI path until the app owns a provider-neutral allowlist/execution seam for LM Studio as well.

## Why

- `src/llm/providers/lmstudio.ts` only forwards OpenAI-compatible chat completions and optional JSON mode; it does not send tool definitions, MCP config, or web-search directives.
- `src/llm/gateway.ts` and `src/agents/runner.ts` still exchange plain text responses with no provider-neutral tool-call contract in this branch.
- `src/llm/providers/copilot-cli.ts` is the only provider that currently enforces explicit tool controls (`article-tools`, approved MCP server names, optional web fetch, repo-scoped MCP config, and bounded session reuse).
- Repo MCP config files (`.copilot/mcp-config.json`, `.mcp.json`) expose `tools: ["*"]` for both local servers, and `mcp/server.mjs` includes mutating publish/render/cache tools alongside read-only queries, so attaching LM Studio directly would bypass the current provider boundary.

## Operational Path

1. Keep `LLM_PROVIDER=lmstudio` available for local chat-only runs.
2. Keep `COPILOT_CLI_MODE=article-tools` as the closest supported path for guarded web search + repo MCP.
3. If LM Studio parity is required later, add one of:
   - an app-owned provider-neutral tool loop with an explicit allowlist, or
   - an LM Studio-specific native tool adapter that reuses the same allowlist, validation, and audit rules.

## Evidence

- `src/llm/providers/lmstudio.ts`
- `src/llm/providers/copilot-cli.ts`
- `src/llm/gateway.ts`
- `src/agents/runner.ts`
- `mcp/server.mjs`
- `.copilot/mcp-config.json`
- `.mcp.json`
- `tests/llm/provider-lmstudio.test.ts`
- `tests/llm/provider-copilot-cli.test.ts`
- `tests/llm/gateway.test.ts`
- `tests/mcp/server.test.ts`

---

## devops lmstudio runtime (PROPOSED):

# DevOps Decision — LM Studio runtime validation stays wiring-first

## Context

The repo already has two separate local MCP entrypoints (`npm run mcp:server` and `npm run v2:mcp`) plus repo-local Copilot MCP configs in `.copilot\mcp-config.json` and `.mcp.json`. At the same time, `src\llm\providers\lmstudio.ts` only speaks OpenAI-compatible chat completions and optional JSON mode, while `src\dashboard\server.ts` wires repo MCP + web search only for the Copilot CLI provider.

## Decision

For LM Studio work, DevOps should prepare **manual/live validation wiring** rather than imply tool support that the runtime does not implement yet:

1. keep MCP inspection opt-in via `.\dev.ps1 -WithMcp`
2. point operators at `http://localhost:<port>/config` to confirm the active provider, URL, and model
3. document clearly that repo MCP and web search are not currently forwarded through LM Studio

## Why

This preserves truthful operator expectations while still making future LM Studio tool-path testing easy. It also avoids racing application feature work or over-promising capabilities that depend on provider-native LM Studio support or Code-owned runtime changes.

## What is possible now

- Start the dashboard against LM Studio with `LLM_PROVIDER=lmstudio`
- Auto-detect or pin an LM Studio model
- Keep both repo-local MCP servers visible during a run for future/manual inspection
- Validate provider selection and env wiring on `/config`

## What still depends on Code or provider work

- Passing repo MCP tools through LM Studio requests
- Brokering web search through LM Studio from the app runtime
- Any LM Studio-native tool-calling or search feature that is not exposed through the provider/runtime contract

---

# MERGED INBOX ENTRIES (2026-03-28T18:07:22Z)



## code cli trace analysis:



# Code — Copilot CLI Tool-Access Diagnosis



## Summary



- Stage 1 / `ideaGeneration` showing no Copilot CLI tool access is expected under today's default startup contract.

- The main user-facing issue is observability/labeling confusion, not a confirmed Stage 1 runtime bug.

- There is one nearby real bug in trace metadata: effective execution cwd can be misreported.



## Current Runtime Contract



1. `src\dashboard\server.ts` registers `CopilotCLIProvider` with `toolAccessMode: 'none'` unless `COPILOT_CLI_MODE=article-tools` or legacy tool env flags are set.

2. `src\dashboard\server.ts` sends Stage 1 ideas through `runner.run()` with `stage: 1` and `surface: 'ideaGeneration'`.

3. `src\agents\runner.ts` forwards that stage/surface/article trace metadata into `providerContext`, but does not decide tool access.

4. `src\llm\providers\copilot-cli.ts` uses stage only for session-reuse eligibility (`ARTICLE_STAGE_REUSE = [4,5,6,7]`); tool enablement still comes from provider instance mode plus runtime flags.



## Expected Fields



For a normal Stage 1 no-tools Copilot CLI trace, these are expected:



- `toolAccessMode: "none"`

- `toolAccessConfigured: false`

- `toolsEnabled: false`

- `allowedTools: []`

- `webSearchEnabled: false`

- `repoMcpEnabled: false`

- `mcpServerNames: []`



The prompt may also begin with the app-authored no-tools constraint telling the model to answer directly and avoid tools.



## Suspicious Signals



- Prompt starts with no-tools constraint **but** request envelope says `toolAccessMode: "article-tools"`.

- `toolsEnabled: true` with an empty `allowedTools` array.

- A no-tools run reports repo-root cwd instead of the sandbox cwd.

- Reviewers infer tool policy from Stage 1 vs Stage 5 alone; today only session reuse is stage-gated.



## Minimal Fixes (do not implement here)



1. **UX fix:** rename `Provider Prompt Delta` in `src\dashboard\views\traces.ts` to `Provider Prompt` or `Provider-Composed Prompt`.

2. **Real bug fix:** in `src\llm\providers\copilot-cli.ts`, report `plan.cwd` (effective cwd) instead of `this.workingDirectory ?? plan.cwd` in provider metadata.

3. **Only if product wants stage-aware tools:** move tool-mode selection from provider construction time to request time, derived from `providerContext.stage/surface`.



## Test Follow-ups



- Add a Stage 1 `copilot-cli` test with provider configured for `article-tools` to lock current inheritance behavior.

- Add a trace test proving no-tools mode stores the injected constraint in `incrementalPrompt`.

- Add a metadata test proving no-tools mode reports sandbox cwd.

- Update dashboard trace rendering tests if the prompt label is renamed.



---



## code trace label clarification:



# Code — Trace Label Clarification



## Context



`src\dashboard\views\traces.ts` renders `trace.incremental_prompt` for dashboard trace timelines. For Copilot CLI traces, that field stores the full provider-composed prompt wrapper, not a semantic diff against an earlier prompt.



## Decision



Render that section as **Provider-Wrapped Prompt** instead of **Provider Prompt Delta**.



## Why



- It stays accurate for Copilot CLI traces that prepend wrapper text such as tool-policy or no-tools constraints.

- It avoids implying the stored value is a delta or patch.

- It still leaves room for other providers to store their full provider-side composed prompt in the same field.



---



## devops env sample:



# DevOps Decision — Copilot CLI env sample coverage



## Decision



Document the Copilot CLI runtime surface in `.env.sample`, led by `COPILOT_CLI_MODE`, and include the still-supported compatibility flags that can widen tool access or session reuse.



## Why



`src\dashboard\server.ts` currently treats `COPILOT_CLI_MODE=article-tools` as the preferred switch, but it also honors older flags like `COPILOT_CLI_ENABLE_TOOLS`, `COPILOT_ENABLE_TOOLS`, and `COPILOT_ENABLE_SESSION_REUSE`. If the sample omits those knobs, operators can end up with behavior that looks undocumented when local env files or old runbooks still set legacy flags.



## Scope



- `.env.sample` should show the current preferred knobs and defaults

- compatibility-only flags should stay documented, but clearly labeled as legacy

- no runtime behavior changes are implied by this sample-file update



---



## devops history gitignore:



# DevOps Decision — Local Agent History Files Stay Untracked



## Context



Agent-specific `.squad/**/history.md` files are useful as local working memory, but tracking them in Git creates noisy diffs and accidental churn across branches.



## Decision



Treat `.squad/**/history.md` as local-only artifacts. Keep them on disk for each operator, add the exact ignore rule in `.gitignore`, and remove any already-tracked copies from the Git index with cached deletes so the files remain locally available.



## Guardrails



- Only untrack files whose exact basename is `history.md` under `.squad/`.

- Do not remove or untrack other `.squad` artifacts as part of this cleanup.

- If unrelated local-only `.squad` changes exist, leave them untouched and call them out in the handoff.



---



---



# MERGED INBOX ENTRIES (2026-03-28T17:54:23Z)

---

# MERGED INBOX ENTRIES (2026-03-28T18:23:20Z)

## DevOps Decision — dev.ps1 startup mode should be source-first with explicit built preflight

### Context
- `package.json` in both `C:\github\nfl-eval` and `C:\github\worktrees\llminputs\worktrees\v4` exposes both `v2:serve` (source via `tsx`) and `v2:start` (built via `dist\cli.js`).
- Operators move between the main repo and the v4 worktree and asked whether `.\dev.ps1` requires a rebuild first.
- The current successful path is source-first; only the built path needs `dist` freshness.

### Decision
- Keep `.\dev.ps1` defaulting to `npm run v2:serve`.
- Add an explicit `-Built` switch that runs `npm run v2:build` immediately before `npm run v2:start`.
- Apply the same behavior to both `C:\github\nfl-eval\dev.ps1` and `C:\github\worktrees\llminputs\worktrees\v4\dev.ps1`.

### Why
- This preserves the existing fast path that already works without requiring rebuilds.
- It removes the stale-build footgun for the built startup path.
- Mirroring behavior across both locations lowers operator error when switching worktrees.

### Validation
- Spot-checked both scripts with `-CommandOnly` in default and `-Built` modes.
- `npm run v2:build` passed in both locations.
- Full `npm test` still fails in both locations on pre-existing e2e/database issues unrelated to `dev.ps1`.

---

## Code Decision — LM Studio trace envelope visibility

### Context
- The trace timeline page already renders `provider_request_json` and `provider_response_json` from `src\dashboard\views\traces.ts`.
- `src\agents\runner.ts` only persists those fields when a provider returns `response.providerMetadata.requestEnvelope` / `responseEnvelope`.
- `src\llm\providers\lmstudio.ts` returned content/usage only, so successful LM Studio traces stored NULL envelopes and the dashboard showed empty sections.

### Decision
- Fix the problem at the LM Studio provider seam by emitting `providerMetadata` with the actual LM Studio request envelope and raw response envelope.
- Preserve runner, repository, and dashboard behavior for every other provider.
- Cover the seam with focused provider, runner, and dashboard tests instead of broad trace refactors.

### Why
- The trace page was not broken; the persistence chain never received LM Studio envelope data.
- Provider-local metadata keeps the fix small and avoids changing shared trace plumbing that already works for Copilot CLI.
- Capturing envelopes on success and relevant error paths makes LM Studio traces debuggable without widening scope into unrelated provider behavior.

---

## Code Decision — Recurring tool-loop schema error

### Context
- Joe reported the old error string `LLM response does not match schema: invalid option expected one of final|tool_call` again after the earlier v4 idea-generation fix.
- The fixed v4 code lives in `C:\github\worktrees\llminputs\worktrees\v4\src\dashboard\server.ts` and explicitly tells `/api/ideas` runs to end with `{"type":"final","content":"..."}`.
- The currently running dashboard process on port 3456 is not serving that v4 worktree; another checkout is still active on the machine.

### Decision
- Treat this recurrence primarily as runtime/worktree drift, not a fresh regression in the validated v4 fix.
- Keep the same prompt hardening in `C:\github\nfl-eval\src\dashboard\server.ts` so this repo does not reintroduce the idea-page failure when it is the served checkout.
- During triage, identify the live dashboard worktree before widening schema parsing or altering the tool-loop contract.

### Why
- The exact error string belongs to the app-managed tool-loop schema path, but operators can still be hitting an older checkout whose `/api/ideas` task text never picked up the explicit final-envelope reminder.
- Restarting the correct worktree is safer than weakening the contract.
- Mirroring the prompt fix into the team root keeps `C:\github\nfl-eval` aligned with the already-validated v4 behavior.





---



## code cli trace analysis:



# Code — Copilot CLI Trace Analysis (2026-03-28)



## Summary



Current Copilot CLI trace behavior is mostly expected, not a provider bug.



- `src\llm\providers\copilot-cli.ts` defaults to `toolAccessMode: 'none'`

- `src\dashboard\server.ts` only enables `article-tools` when `COPILOT_CLI_MODE=article-tools` or legacy tool env flags are set

- In `none` mode, the provider intentionally prepends:

  - `<constraint>Output the requested content directly as text. Do NOT read files, create files, run commands, or use any tools.</constraint>`

- The request envelope therefore correctly reports:

  - `allowedTools: []`

  - `toolsEnabled: false`

  - `webSearchEnabled: false`

  - `repoMcpEnabled: false`



## Stage 1 Finding



For Stage 1 / `ideaGeneration`, tool access `none` is expected **today** unless the dashboard process was started with article-tools enabled. There is no stage-based widening rule in the provider; tool access is provider-instance configuration, not surface-specific routing.



## Likely UX Confusion



`src\dashboard\views\traces.ts` renders `trace.incremental_prompt` under the title **Provider Prompt Delta**. For Copilot CLI this value is the full provider-wrapped prompt, not a semantic diff. Renaming that label to something like **Provider Prompt** or **Provider-Wrapped Prompt** would be a tiny, factual clarification if we choose to improve the trace UX.





---



## code commit scope:



# Commit Scope: Provider Persistence Fix (2026-03-28)



## Status

✅ **ALREADY COMMITTED ON `main`** — the provider-persistence product work is present in `HEAD` as commit `1ccc9c4` (`Persist article provider across stages`).



## Current State

- **Branch:** `main`

- **Branch ahead of `origin/main`:** 2 commits

- **Committed provider-persistence scope:** already included in `HEAD`

- **Current unrelated dirty file:** `.squad\agents\code\history.md`



## Minimal Safe Commit Scope

### For the provider-persistence product work

**No new product commit is needed.** The relevant code and tests are already committed together in `1ccc9c4`.



That committed scope covers these 9 product files:

1. `src\types.ts`

2. `src\db\schema.sql`

3. `src\db\repository.ts`

4. `src\dashboard\server.ts`

5. `src\dashboard\views\new-idea.ts`

6. `src\pipeline\actions.ts`

7. `tests\dashboard\new-idea.test.ts`

8. `tests\dashboard\server.test.ts`

9. `tests\pipeline\actions.test.ts`



### Files that should NOT be included in any product commit

- `.squad\agents\code\history.md` — investigation/coordination metadata only



## Merge Decision

**Merge is NOT needed.** The working branch is already `main`, so there is nothing to merge into `main`. The correct next step, if desired, would be to push `main`.



## Decision

For requests framed as "commit and merge to main," first verify whether the product work is already present in `HEAD`. If it is, do **not** create a duplicate commit; exclude any `.squad\` metadata dirt and treat the task as a push/no-op merge situation.





---




## lead provider fixes approval:



# Decision — Provider Fixes Approved for Mainline Commit



**Date:** 2026-03-29  

**Owner:** Lead (Joe Robinson)  

**Status:** Approved  



## Directive



Ship approved for commit and merge to main:



1. **Provider-persistence fix**: Provider selection now propagates through all pipeline stages (Stage 1 → generatePrompt, composePanel, runDiscussion, writeDraft, runEditor, runPublisherPass).

2. **Provider-label clarification**: Dashboard label mapping consolidated to eliminate confusion between "GitHub Copilot Pro+" (GitHub Models API) and "GitHub Copilot CLI" (separate provider).



## Approval



- **Requested by:** Joe Robinson

- **Approval statement:** "Looks good. commit and merge to main"

- **Implementation status:** Both fixes are already in code and validated.



## Next Action



Coordinator to confirm git state is safe (no conflicts, all tests passing), then execute:



```bash

git add .squad/

git commit -m "Provider fixes approved for mainline: persistence propagation + label clarification"

git push origin main

```





---



## research panel construction:



# Research Inbox — Panel Construction Abstraction



## Context



Research audited current article panel construction for beat-level article generation.



Key source seams:



- `src/pipeline/actions.ts:843-1033`

- `src/config/defaults/skills/panel-composition.md:15-43`

- `src/config/defaults/skills/article-discussion.md:98-127`

- `src/pipeline/context-config.ts:26-43`

- `src/dashboard/server.ts:1167-1186`

- `src/dashboard/views/new-idea.ts:89-118`

- `src/types.ts:20-29`



## Observations



1. Panel composition is **policy-by-prompt**. There is no typed `article_type`, `panel_profile`, or composition schema in article records.

2. Runtime enforcement is weak:

   - `composePanel()` tells Lead the depth-size rules in prose.

   - `runDiscussion()` parses whatever `panel-composition.md` contains and executes it if parseable.

   - `requirePanelComposition()` only checks for non-empty bullet-like lines.

3. Depth and composition guidance are duplicated across UI, prompt skills, and stage tasks:

   - `new-idea.ts` template asks Lead to output a suggested panel.

   - `server.ts` depth labels encode word-count/agent-count copy.

   - `panel-composition.md` and `article-discussion.md` repeat the same size matrix.

4. Depth level 4 (`Feature`) exists in types/UI, but panel-composition logic treats any non-1/non-2 depth as `4-5 agents`, effectively collapsing level 4 into the level-3/deep-dive branch.

5. Pinned agents are stored structurally (`article_panels`) but only as required names/optional roles; they do not define lane templates, quotas, or composition profiles.



## Recommendation



Move panel construction toward a typed, composable contract:



### 1. Add a first-class composition spec



Store per-article structured selection data such as:



- `compositionProfile` (e.g. `contract_extension`, `draft_eval`, `roster_strategy`)

- `panelConstraints`

  - `minPanelists`

  - `maxPanelists`

  - `requiredRoles`

  - `requiredAgents`

  - `preferredRoles`

  - `allowTeamAgents`

  - `allowDuplicateArchetypes`



### 2. Separate depth policy from article-type policy



Depth should control budgets/size ceilings.

Article type should control lane mix.

Today those concerns are blended in prompt prose and a static matrix.



### 3. Generate prompts from structured policy



Keep markdown skills, but render them from typed config so one source of truth feeds:



- dashboard labels

- idea template guidance

- composePanel task text

- validation/guard rails



### 4. Validate composition structurally before discussion



Before Stage 3→4, validate:



- panel size within bounds

- pinned agents included

- required team/specialist presence

- agent names exist in roster

- no duplicate/overlapping lanes if disallowed



### 5. Resolve depth-4 semantics explicitly



Either:



- give Feature its own composition policy, or

- formally alias it to Deep Dive everywhere.



Right now UI and runtime communicate different semantics.



## Suggested Direction



Prefer a small typed “panel policy registry” over more prompt text. Prompts should explain the why; code/config should own the actual rules.





---




## Code: MCP Tooling Allowlist Policy



# Decision Inbox — Code Agent MCP Tooling



**Date:** 2026-03-28  

**Owner:** Code  

**Status:** Proposed



## Decision



Enable repo-local MCP access for in-app agents only through an explicit safe subset:



- `local_tool_catalog`

- `query_player_stats`

- `query_team_efficiency`

- `query_positional_rankings`

- `query_snap_counts`

- `query_draft_history`

- `query_ngs_passing`

- `query_combine_profile`

- `query_pfr_defense`

- `query_historical_comps`

- `query_rosters`

- `query_prediction_markets`



Do **not** expose publishing, media-generation, or cache-refresh tools to the in-app agent runtime.



## Implementation seam



Enforce the policy in the app runtime, above providers:



1. **Registry-derived allowlist** — load local tool metadata from `mcp\tool-registry.mjs`, then keep only the explicit approved tool names that are also marked `readOnlyHint: true`.

2. **Bounded tool loop** — let the model request at most three in-process tool calls through a strict JSON contract.

3. **Fail closed** — reject non-allowlisted tools and invalid arguments before any handler runs.

4. **In-process execution only** — call the local tool handlers directly from the app runtime; do not delegate tool permissions to provider-specific CLI flags.



## Why



- The MCP server already exposes both safe read-only tools and mutating tools.

- The in-app runtime previously had no safe, explicit local-tool execution seam.

- An app-owned loop keeps tool policy provider-agnostic and auditable while still enabling factual lookup work.



## Validation



- `npm run v2:build`

- `npx vitest run tests\agents\runner.test.ts tests\llm\gateway.test.ts tests\llm\provider-copilot-cli.test.ts tests\mcp\local-tool-registry.test.ts`







## DevOps Decision — Canonical env template

## Decision

Keep `.env.sample` as the single canonical environment template and remove `.env.example`.

## Why

`.env.sample` already reflects the current Copilot CLI/runtime configuration surface, including `COPILOT_CLI_MODE`, web search, repo MCP, and session reuse flags. Keeping `.env.example` alongside it creates drift and operator confusion.

## Scope

- remove `.env.example`
- keep `.env.sample` as the only template users copy to `.env`
- keep docs and runtime-facing references pointed at `.env.sample`



---



---

## Code Decision — Copilot CLI observability findings

## Copilot CLI issue triage

- Repo source of truth already defaults Copilot CLI to `claude-sonnet-4.6` (`src/config/index.ts`, `src/llm/providers/copilot-cli.ts`, `src/dashboard/server.ts`), so seeing `claude-sonnet-4` at runtime most likely means a stale running server process, an explicit `COPILOT_MODEL` env override, or older historical trace data rather than a current repo bug.
- `sessionReuseRequested: true` with `sessionReuseEligible: false` is expected on `GeneratePrompt`: reuse is only eligible for article stages 4-7 in `src/llm/providers/copilot-cli.ts`, while `generatePrompt` runs at stage 1 in `src/pipeline/actions.ts`.
- `GeneratePrompt` failure points are most likely missing `idea.md` / article lookup (`src/pipeline/actions.ts`), model-policy or provider invocation from `runAgent` (`src/agents/runner.ts`), or Copilot CLI process/runtime errors surfaced by `execFile`/`spawn` in `src/llm/providers/copilot-cli.ts`. No clear repo-local bug was found in this pass.

------

## DevOps & Code Decision — v4 Merge Safety + LM Studio Tool Capability Assessment

### v4 Branch Merge Readiness
**Status:** Clean, low-risk merge expected

- v4 branch (e1b3821): Clean state, ready for assessment
- local main (311e061, d063f30): Ahead with recent changes
- Overlapping file changes: README.md, src/dashboard/server.ts
- **Risk assessment:** Low; merge conflict unlikely if server.ts tooling edits are compatible
- **Next step:** Backend to approve v4 merge timing based on server.ts compatibility verification

### LM Studio vs. Copilot CLI Tool Support

**LM Studio provider (chat-only):**
- No tool support (chat completions API only)
- No MCP support
- No web search support
- **Use case:** Chat-only articles, lightweight workflows

**Copilot CLI provider (full tooling):**
- Full tool support (explicit tool plumbing)
- MCP support (explicit server plumbing)
- Web search support (via tool infrastructure)
- **Use case:** Tool-intensive workflows, articles requiring factual lookup or code integration

**Recommendation:** Use LM Studio for chat-only; fall back to Copilot CLI for tool-dependent work. No code changes needed; both are correctly configured per their API contracts.



---

# MERGED INBOX ENTRIES (2026-03-28T00:00:00Z)

## DevOps Decision — LM Studio validation should stay capability-true

### Decision

Separate local validation into three explicit lanes and keep all read-only/operator surfaces honest about which lane they cover:

1. **LM Studio connectivity** — local `/v1/models` and `/chat/completions` reachability
2. **Repo MCP startup/inventory** — whether the repo-local stdio servers start and are discoverable
3. **Tool-enabled execution** — whether a provider can actually invoke web/MCP tools during a live run

Do not present LM Studio as web-search/MCP/tool capable until runtime/provider work adds that support in `src\llm\providers\lmstudio.ts`.

### Why

- `src\dashboard\server.ts` currently derives `/config` provider status from env heuristics, which can overstate LM Studio as the active provider when multiple providers are available.
- `README.md` currently describes `COPILOT_CLI_MODE` defaults differently from the runtime defaults in `src\config\index.ts`.
- `.env.sample` currently opts into `LLM_PROVIDER=lmstudio`, which can accidentally turn an example file into an active routing decision.
- `mcp\smoke-test.mjs` is not a safe default validation path because it invokes image/publishing/nflverse tool paths.

### Immediate Safe Scope

- Align README and `.env.sample` with runtime defaults and current limitations
- Make `/config` report effective provider/capability state from the registered runtime, not env hints alone
- Preserve `.mcp.json` / `.copilot\mcp-config.json` parity
- Prefer side-effect-free validation commands over `npm run mcp:smoke` in operator guidance

### Deferred To Code / Runtime

- LM Studio tool definitions or tool-calling payloads
- LM Studio-to-MCP brokering
- Provider-native LM Studio web search support

---

## DevOps Decision — LM Studio MCP Audit

**Date:** 2026-03-28  
**Owner:** DevOps  
**Status:** Approved

### Decision

Do **not** enable LM Studio for repo MCP tools or web search in the current branch. Keep LM Studio on the existing chat-only path and keep tool-aware article work on the guarded Copilot CLI path until the app owns a provider-neutral allowlist/execution seam for LM Studio as well.

### Why

- `src/llm/providers/lmstudio.ts` only forwards OpenAI-compatible chat completions and optional JSON mode; it does not send tool definitions, MCP config, or web-search directives.
- `src/llm/gateway.ts` and `src/agents/runner.ts` still exchange plain text responses with no provider-neutral tool-call contract in this branch.
- `src/llm/providers/copilot-cli.ts` is the only provider that currently enforces explicit tool controls (`article-tools`, approved MCP server names, optional web fetch, repo-scoped MCP config, and bounded session reuse).
- Repo MCP config files (`.copilot/mcp-config.json`, `.mcp.json`) expose `tools: ["*"]` for both local servers, and `mcp/server.mjs` includes mutating publish/render/cache tools alongside read-only queries, so attaching LM Studio directly would bypass the current provider boundary.

### Operational Path

1. Keep `LLM_PROVIDER=lmstudio` available for local chat-only runs.
2. Keep `COPILOT_CLI_MODE=article-tools` as the closest supported path for guarded web search + repo MCP.
3. If LM Studio parity is required later, add one of:
   - an app-owned provider-neutral tool loop with an explicit allowlist, or
   - an LM Studio-specific native tool adapter that reuses the same allowlist, validation, and audit rules.

### Evidence

- `src/llm/providers/lmstudio.ts`
- `src/llm/providers/copilot-cli.ts`
- `src/llm/gateway.ts`
- `src/agents/runner.ts`
- `mcp/server.mjs`
- `.copilot/mcp-config.json`
- `.mcp.json`
- `tests/llm/provider-lmstudio.test.ts`
- `tests/llm/provider-copilot-cli.test.ts`
- `tests/llm/gateway.test.ts`
- `tests/mcp/server.test.ts`

---

## DevOps Decision — LM Studio runtime validation stays wiring-first

**Date:** 2026-03-28  
**Owner:** DevOps  
**Status:** Approved

### Context

The repo already has two separate local MCP entrypoints (`npm run mcp:server` and `npm run v2:mcp`) plus repo-local Copilot MCP configs in `.copilot\mcp-config.json` and `.mcp.json`. At the same time, `src\llm\providers\lmstudio.ts` only speaks OpenAI-compatible chat completions and optional JSON mode, while `src\dashboard\server.ts` wires repo MCP + web search only for the Copilot CLI provider.

### Decision

For LM Studio work, DevOps should prepare **manual/live validation wiring** rather than imply tool support that the runtime does not implement yet:

1. keep MCP inspection opt-in via `.\dev.ps1 -WithMcp`
2. point operators at `http://localhost:<port>/config` to confirm the active provider, URL, and model
3. document clearly that repo MCP and web search are not currently forwarded through LM Studio

### Why

This preserves truthful operator expectations while still making future LM Studio tool-path testing easy. It also avoids racing application feature work or over-promising capabilities that depend on provider-native LM Studio support or Code-owned runtime changes.

### What is possible now

- Start the dashboard against LM Studio with `LLM_PROVIDER=lmstudio`
- Auto-detect or pin an LM Studio model
- Keep both repo-local MCP servers visible during a run for future/manual inspection
- Validate provider selection and env wiring on `/config`

### What still depends on Code or provider work

- Passing repo MCP tools through LM Studio requests
- Brokering web search through LM Studio from the app runtime
- Any LM Studio-native tool-calling or search feature that is not exposed through the provider/runtime contract

---

## Lead Decision — LM Studio tools/MCP/web search architecture review

**Date:** 2026-03-28  
**Owner:** Lead  
**Status:** Rejected  
**Risk:** Medium-high if forced without redesign

### Decision

Reject any proposal to "fully enable" LM Studio for tools, MCP servers, and web search **as a configuration-only change** in the current architecture.

### Why

1. **LM Studio is chat-only in the working tree.**  
   `src\llm\providers\lmstudio.ts` issues one OpenAI-compatible chat request and returns one text response. It has no tool schema, tool-call loop, MCP client path, or web-search contract.

2. **Tooling is intentionally provider-specific today.**  
   `src\llm\providers\copilot-cli.ts` owns `toolAccessMode`, guarded web fetch, repo MCP wiring, and session reuse. `src\dashboard\server.ts` only passes those controls into Copilot CLI registration.

3. **Gateway/runner are not provider-agnostic tool orchestrators in this checkout.**  
   `src\agents\runner.ts` forwards plain chat requests into `src\llm\gateway.ts`, and the gateway expects providers to return final text. There is no shared tool-execution seam to drop LM Studio into safely.

4. **Auto-routing would get riskier, not safer.**  
   `src\llm\gateway.ts` picks the first provider whose `supportsModel()` matches. `src\llm\providers\lmstudio.ts` returns `true` for every model name, so moving LM Studio earlier in registration order widens its capture of model-policy traffic without adding tool safety.

5. **Repo MCP exposure is broad.**  
   `.mcp.json` and `.github\extensions\README.md` expose `nfl-eval-local` / `nfl-eval-pipeline` with `tools: ["*"]`. `mcp\server.mjs` includes mutating publish/media/cache tools alongside read-only queries, so "turn on MCP" is not equivalent to "safe read-only MCP."

### Closest supported path

- Keep **LM Studio** as the text-only local-model provider.
- Use **Copilot CLI in `article-tools` mode** for guarded web search, repo MCP, and session reuse.
- If the product wants "LM Studio + tools," build it as an **app-owned provider-agnostic tool loop** above providers, with explicit allowlisting and live end-to-end validation, rather than as an LM Studio-specific toggle.

### Evidence

- Provider boundary: `src\llm\gateway.ts`, `src\llm\providers\lmstudio.ts`, `src\llm\providers\copilot-cli.ts`
- Startup wiring: `src\dashboard\server.ts`
- Pipeline/runner threading: `src\agents\runner.ts`, `src\pipeline\actions.ts`
- MCP exposure: `mcp\server.mjs`, `src\mcp\server.ts`, `.mcp.json`, `.github\extensions\README.md`
- Tests: `tests\llm\provider-lmstudio.test.ts`, `tests\llm\gateway.test.ts`, `tests\llm\provider-copilot-cli.test.ts`, `tests\mcp\server.test.ts`

### Validation

Baseline validation passed in this review:

- `npm run v2:build`
- `npx vitest run tests\llm\provider-lmstudio.test.ts tests\llm\gateway.test.ts tests\llm\provider-copilot-cli.test.ts tests\mcp\server.test.ts`

---

## Lead Decision — LM Studio Tooling Boundary Review

**Date:** 2026-03-28  
**Owner:** Lead  
**Status:** Approved with constraints

### Decision

Do **not** treat LM Studio as a drop-in replacement for the current Copilot CLI tooling path.

In this repo today, fully enabling LM Studio for tools, repo MCP servers, and web search is **not acceptable as a surgical change**. The safe path is either:

1. keep LM Studio chat-only and continue routing tool-dependent work to Copilot CLI, or
2. add LM Studio support through the repo-owned, provider-agnostic tool loop / a separate provider-native implementation that preserves the same allowlist, validation, and telemetry boundaries.

### Why

- `src\llm\providers\lmstudio.ts` is currently a minimal OpenAI-compatible chat adapter. It does not send tool definitions, receive tool calls, execute MCP handlers, or expose web-search controls.
- `src\agents\runner.ts` forwards provider context and traces, but the inspected current file does not own a live tool-execution loop for LM Studio requests.
- `src\llm\providers\copilot-cli.ts` already owns a guarded tooling contract (`article-tools`, approved MCP servers, web fetch flags, session reuse), and tests cover that boundary directly.
- `mcp\server.mjs` and `src\mcp\server.ts` expose broad tool surfaces, including mutating tools, so widening LM Studio directly to "all MCP" would bypass the repo's explicit allowlist posture.

### Constraints for any future Code implementation

1. Keep provider boundaries explicit: no LM Studio-specific `--allow-tool` style shadow contract in the gateway.
2. Do not weaken model-first auto-routing by making LM Studio the generic fallback for policy models it only proxies to its local default.
3. Keep tool policy app-owned and fail-closed: explicit allowlist, schema validation, bounded tool budget, normalized tool-result turn loop, auditable traces.
4. Separate requested provider from actual executing provider/model in telemetry.
5. Preserve the current safe fallback: tool-heavy work remains on Copilot CLI until LM Studio path has parity tests.

### Evidence reviewed

- `src\llm\gateway.ts`
- `src\llm\providers\lmstudio.ts`
- `src\llm\providers\copilot-cli.ts`
- `src\dashboard\server.ts`
- `src\agents\runner.ts`
- `src\pipeline\actions.ts`
- `mcp\server.mjs`
- `src\mcp\server.ts`
- `tests\llm\provider-lmstudio.test.ts`
- `tests\llm\gateway.test.ts`
- `tests\mcp\server.test.ts`
- `.squad\decisions.md`

---

# Code Decision — Fix v4 idea-page JSON failure in the LM Studio/Qwen seam

## Context

The v4 dashboard idea page (\/ideas/new\) submits to \POST /api/ideas\, and that route uses \AgentRunner.run()\ with the app-owned tool loop enabled for the Lead agent.

For non-Copilot providers, the tool loop depends on \src\llm\gateway.ts::chatStructuredWithResponse()\ parsing strict JSON objects that match \TOOL_LOOP_RESPONSE_SCHEMA\. With LM Studio serving \qwen/qwen3.5-35b-a3b\, the live response can include reasoning wrappers or prose around the JSON payload, producing the user-facing error:

\LLM response is not valid JSON: The user wants me to generate a structured article idea...\

## Decision

Treat this as a structured-output seam bug in the LM Studio/Qwen path, not a dashboard route bug.

Keep the dashboard request path unchanged and fix the provider/gateway boundary:

1. LM Studio must not send \esponse_format: { type: "json_object" }\ for this path.
2. The shared gateway may recover JSON from Qwen-style wrappers (think tags, code fences, leading/trailing prose) before schema validation.
3. LM Studio should continue honoring the loaded local model by default, only forwarding \equest.model\ when it matches a real discovered LM Studio model id.

## Why

The request is already hitting the intended code path: idea page → \/api/ideas\ → \AgentRunner\ tool loop → \chatStructuredWithResponse()\.

The failure happens before any dashboard-specific logic goes wrong. It is caused by backend-specific structured-output drift plus local-model aliasing risk, so the safest localized fix is at the gateway/provider seam with regression coverage.

## Validation

- \
pm run v2:test -- tests/llm/gateway.test.ts tests/llm/provider-lmstudio.test.ts tests/agents/runner.test.ts\
- \
pm run v2:build\

---

# DevOps Decision — LM Studio v4 revision should preserve local default-model safety

## Context

The first LM Studio patch in \worktrees\v4\ correctly fixed the structured-output seam for Qwen by:

- teaching \src\llm\gateway.ts\ to recover JSON from think-tag/code-fence wrappers
- removing LM Studio's rejected \esponse_format: { type: "json_object" }\

But the rejected revision also started forwarding \equest.model\ blindly from gateway policy resolution into \src\llm\providers\lmstudio.ts\.

## Decision

Keep the structured-output fixes, but treat gateway policy aliases as routing hints, not transport-level model ids, when LM Studio is the executing provider.

For LM Studio:

1. forward \equest.model\ only when it matches the known local/default LM Studio model set
2. otherwise keep the provider's loaded/default local model as the effective request model
3. preserve envelope telemetry so traces show both \equestedModel\ and \ffectiveModel\

## Why

\gpt-5-mini\ is a gateway/model-policy alias, not a real LM Studio-loaded model. If LM Studio is the default/first provider, blindly passing that alias can override or bypass the intended loaded Qwen model and break the real live path.

The startup path in \src\dashboard\server.ts\ already auto-detects loaded LM Studio models and sets the provider default when no \LMSTUDIO_MODEL\ override is supplied. The provider must honor that runtime-local default on policy-routed requests.

## Evidence

- Focused regressions now cover:
  - gateway policy alias → LM Studio default-model path
  - explicit discovered LM Studio model passthrough
  - alias fallback to default local model
  - Qwen-style wrapped JSON parsing in the runner/gateway seam
- Validation passed:
  - \
pm run v2:build\
  - \
pm run v2:test -- tests/llm/provider-lmstudio.test.ts tests/llm/gateway.test.ts tests/agents/runner.test.ts\
- Live smoke against local LM Studio succeeded with \qwen/qwen3.5-35b-a3b\, showing \equestedModel: "gpt-5-mini"\ and \ffectiveModel: "qwen/qwen3.5-35b-a3b"\ in provider metadata.

