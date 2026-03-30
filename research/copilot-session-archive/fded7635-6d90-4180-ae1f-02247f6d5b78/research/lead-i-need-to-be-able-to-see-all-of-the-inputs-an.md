# LLM Input/Output Trace Research

## Executive Summary

This request is a **technical deep-dive**: the codebase already has strong primitives for pipeline visibility, but it does **not** yet persist a complete LLM trace model. Today, the system stores stage runs, usage events, article conversation turns, and sidecar `*.thinking.md` artifacts; however, it does **not** store the full request envelope for each LLM call (system prompt, user prompt, injected context blocks, resolved model candidates, provider request body, raw response envelope, or tool-call transcript).[^1][^2][^3][^4][^5]

The current UX already has a natural place to grow this feature: article detail pages show artifacts, token usage, stage runs, and an `Advanced` section, and the global nav already exposes operational pages like `Runs`, `Memory`, and `Config`.[^6][^7][^8] A dedicated **Trace** surface fits this architecture better than continuing to overload artifact tabs with trace sidecars.[^6][^9]

The cleanest implementation is to add a first-class trace model centered on a top-level `llm_traces` row plus normalized child tables for messages/context parts and tool events. That approach maps directly to the user’s request for a thread/group-chat-style view showing **instructions, context, tools, thinking, and outputs** in one place, while reusing the existing `stage_runs`, `usage_events`, artifact storage, and htmx/SSE patterns already in the app.[^3][^5][^10][^11]

My recommendation is to ship this as a new **Advanced Trace page** with two entry points: a global `/traces` index and an article-scoped `/articles/:id/traces` detail view. The article page should keep a lightweight summary card in the existing sidebar/advanced area and move the heavy trace/thread rendering—including thinking—into the dedicated page.[^6][^7][^8][^9]

## Architecture/System Overview

The runtime path for an agent-backed LLM call is currently:

```text
Dashboard route / pipeline action
        |
        v
   AgentRunner.run()
        |
        |-- loads charter
        |-- loads skills
        |-- recalls memory
        |-- builds system prompt
        |-- builds user message (+ article context / conversation context)
        v
    LLMGateway.chat()
        |
        |-- resolves candidate models from ModelPolicy
        |-- selects provider by supportsModel()
        v
   Provider.chat(request)
        |
        |-- transforms request into vendor-specific body
        |-- POSTs to API / invokes Copilot CLI
        v
   ChatResponse { content, model, provider, usage, finishReason }
        |
        |-- separateThinking()
        |-- write artifact + optional *.thinking.md
        |-- record usage event
        |-- add assistant turn to article conversation
        v
 Dashboard article UX (artifacts / usage / stage runs / revision history)
```

That architecture is visible in `AgentRunner.run()`, which composes the prompt and calls `LLMGateway.chat()`, and in `LLMGateway.chat()`, which resolves provider/model candidates and delegates to a concrete provider implementation.[^2][^1] The article/pipeline layer then writes artifacts, usage, and conversation records, which is why the system has partial observability today but no full envelope-level trace page.[^5][^3][^4]

## Current State: What the System Already Captures

### 1. Prompt assembly and context injection already exist, but are ephemeral

`AgentRunner.run()` already constructs the exact inputs you want to surface. It loads a charter, optional skills, and recalled memories; composes those into a system prompt; appends article content and optional conversation context into the user message; and then sends a two-message chat request to the gateway.[^2]

That means the app **already knows** the high-value trace components:

- instructions/identity (`composeSystemPrompt()` from charter, skills, memories, roster context),[^2]
- article context and inline source content (`articleContext.content`),[^2]
- revision/conversation context injected into the user message, and[^2][^4]
- routing context such as `stageKey`, `taskFamily`, model override, temperature, and max tokens.[^1][^2]

The important gap is that these assembled inputs are **not persisted** anywhere before the provider call. Once `AgentRunner.run()` returns, only the output artifact, token usage, and assistant content survive.[^2][^5]

### 2. Provider request/response transformation exists, but only the final text response is retained

The gateway/provider layer is structurally ready for tracing. `ChatRequest` includes `messages`, `model`, `temperature`, `maxTokens`, `stageKey`, `depthLevel`, `taskFamily`, and `responseFormat`, while `ChatResponse` returns `content`, `model`, `provider`, `usage`, and `finishReason`.[^1]

Each provider then maps that shared request into a vendor-specific envelope:

- OpenAI sends a Chat Completions body with `model`, `messages`, optional `max_tokens`, and optional JSON `response_format`.[^12]
- Anthropic splits the system message out into a top-level `system` field and sends the rest as `messages`.[^13]
- Gemini maps messages into `contents` and `systemInstruction`.[^14]
- Copilot Models sends an OpenAI-compatible body to GitHub Models.[^15]
- Copilot CLI flattens the request into a single prompt string and explicitly wraps system content in `<instructions>` tags.[^16]

This is exactly where a trace layer should intercept and persist both the **canonical request** and the **provider-native request/response**. Today, those request bodies are generated in memory and discarded after the provider returns.[^12][^13][^14][^15][^16]

### 3. Current persistence covers runs, usage, assistant conversation turns, and artifacts

The schema already includes:

- `article_runs` for end-to-end run envelopes,[^17]
- `stage_runs` for per-stage execution metadata such as surface, actor, requested model, and timing,[^17]
- `usage_events` for token/cost attribution with extensible `metadata_json`,[^17][^3]
- `article_conversations` for per-article shared turns, and[^18][^4]
- the `artifacts` table, exposed through `ArtifactStore`, for persisted markdown/json outputs like drafts and thinking traces.[^10]

This is valuable because it means a trace feature does **not** need to invent operational scaffolding from scratch. Instead, it should link its records to `article_id`, `run_id`, and especially `stage_run_id` so traces can be browsed from the existing article and runs pages.[^3][^17]

### 4. The dashboard already exposes partial debugging surfaces

The article detail page renders a main area with artifacts and revision history plus a sidebar containing token usage, stage runs, and an `Advanced` section.[^6] The `Advanced` section currently contains roster context, an audit log, article metadata, and agent context settings.[^8]

Artifacts already show a `💭 trace` badge when a `*.thinking.md` sidecar exists, and `renderArtifactContent()` can display either a persisted sidecar trace or an extracted inline thinking block using a collapsible `<details>` section.[^9] This proves the UX already tolerates trace-adjacent content, but it also shows the limitation of the current design: thinking is attached to a single artifact tab instead of presented as part of a full multi-message LLM interaction.[^9]

The global nav exposes `Agents`, `Memory`, `Runs`, `Config`, and `New Idea`, but there is no trace-specific page yet.[^7] The `Runs` page is especially relevant because it already provides a paginated operational listing of stage runs and can serve as the model for a new trace index page.[^11]

### 5. Conversation history exists, but it is not a full LLM transcript

The per-article conversation model is close to a thread UX, but it stores only shared article turns and revision summaries, not the underlying prompt envelopes. `article_conversations` records `agent_name`, `role`, `turn_number`, `content`, and `token_count`, and the dashboard renders writer/editor revision history from those turns.[^18][^4]

In practice, the pipeline writes assistant outputs into this conversation store—e.g. writer, editor, and publisher results are added as assistant turns after the LLM returns.[^5] That makes the current conversation thread useful for editorial history, but insufficient for “show me all instructions, context, tools, and inputs.” The system prompt, injected context artifacts, and provider request body are still missing from the thread.[^2][^5]

### 6. Tool visibility is currently a future capability, not an existing one

This is the most important product constraint in the repo today: the in-app LLM surface is currently **message-only**. `ChatRequest` contains messages and routing metadata, but no tool schema or tool result channel.[^1]

That is reinforced by the Copilot CLI provider, which explicitly prepends a constraint telling the CLI to **not read files, create files, run commands, or use any tools**, and instead to “output the requested content directly as text.”[^16] The other providers similarly just serialize message arrays to remote APIs without any tool definitions.[^12][^13][^14][^15]

So the correct research conclusion is: a trace page can immediately show **instructions, context, outputs, thinking, model/provider routing, and token usage**, but it cannot show a rich tool-call transcript for in-app agents until tool calling is implemented in the runtime. The trace schema should still reserve space for tool events so the page design does not need to change later.[^1][^16]

## Why the Current UX Is Close—but Not Enough

The user request asks for a page where LLM inputs/outputs can be understood “like a thread” or “group chat.” The repo already has three nearby patterns:

- a thread-like article conversation/history model,[^18][^4]
- a debug-style runs listing,[^11]
- and an article `Advanced` area with collapsible operational detail.[^8]

What is missing is a **single object** that represents one LLM exchange end to end. Right now the data is fragmented:

- prompt construction lives only inside `AgentRunner.run()`,[^2]
- provider request shape lives inside each provider implementation,[^12][^13][^14][^15][^16]
- output content is persisted as artifacts and conversation turns,[^5][^10]
- thinking may be persisted as a sidecar artifact,[^5][^9]
- and usage/stage timing land in separate tables.[^3][^17]

Because those pieces are not linked as a first-class trace, the dashboard cannot answer basic forensic questions like “what exact instructions did the model see?”, “which context artifacts were injected?”, or “what provider-native body did we send?” even though the code assembles all of that information at runtime.[^2][^12][^13][^14][^15][^16]

## Recommended Architecture

### Recommendation: add first-class trace tables, not just more `metadata_json`

Although `usage_events.metadata_json` is extensible, it is the wrong primary home for a full trace. `usage_events` is optimized for cost/quantity attribution, not large prompt bodies, ordered message parts, or threaded rendering.[^17][^3]

I recommend a normalized trace model with **one top-level trace row plus child rows**:

#### `llm_traces`
One row per gateway/provider call.

Suggested fields:

- `id` (text/uuid)
- `article_id`
- `run_id`
- `stage_run_id`
- `stage`
- `surface`
- `agent_name`
- `provider`
- `model`
- `requested_model`
- `model_tier`
- `stage_key`
- `task_family`
- `temperature`
- `max_tokens`
- `response_format`
- `status` (`started|completed|failed`)
- `started_at`
- `completed_at`
- `latency_ms`
- `finish_reason`
- `prompt_tokens`
- `completion_tokens`
- `total_tokens`
- `cost_usd_estimate`
- `error_message`
- `thinking_artifact_name` (nullable)
- `metadata_json`

#### `llm_trace_messages`
Ordered message parts for thread/group-chat rendering.

Suggested fields:

- `id`
- `trace_id`
- `seq`
- `channel` (`instruction|context|message|thinking|output|tool`)
- `role` (`system|user|assistant|tool|meta`)
- `source` (`charter|skill|memory|roster|article|conversation|provider-request|provider-response|artifact-sidecar`)
- `label`
- `content`
- `token_estimate`
- `metadata_json`

#### `llm_trace_context_parts`
Optional denormalized breakdown of which upstream artifacts/context blocks were injected.

Suggested fields:

- `trace_id`
- `part_kind` (`artifact|memory|roster|revision-summary|editor-previous-reviews|inline-article-context`)
- `part_name`
- `origin_path`
- `content_excerpt`
- `full_content`
- `included_by` (`default|override|implicit`)

#### `llm_trace_tool_events`
Reserved now, populated later when tool calling exists.

Suggested fields:

- `trace_id`
- `seq`
- `tool_name`
- `arguments_json`
- `result_json`
- `status`
- `started_at`
- `completed_at`

This schema matches the current code structure because prompts are assembled centrally in `AgentRunner`, calls are routed centrally in `LLMGateway`, and persistence already keys everything by article/stage/run.[^2][^1][^3][^17]

## Exact Capture Points

### 1. Capture the canonical trace in `AgentRunner.run()`

`AgentRunner.run()` is the best place to persist the **human-meaningful** trace because it has access to the charter-derived system prompt, selected skills, recalled memories, roster context, article context, and formatted conversation context before they are flattened into provider-specific payloads.[^2]

At minimum, this layer should persist:

- `systemPrompt`,
- `userMessage`,
- a structured breakdown of included context blocks,
- agent name / article slug / stage,
- and the final `messages` array passed to the gateway.[^2]

### 2. Capture routing and provider-native payloads in `LLMGateway.chat()` and provider `chat()` methods

The gateway should create the trace row when it resolves candidate models and selects a provider, because that is the moment where the app knows routing information such as candidate models, selected provider, and policy context.[^1]

Each provider should then append:

- the provider-native request body,
- raw response body (or a trimmed debug-safe version),
- latency, finish reason, and any request IDs returned by the vendor.

That is the only way to accurately answer “what did we send to Anthropic vs Gemini vs Copilot CLI?” because each provider transforms the canonical request differently.[^12][^13][^14][^15][^16]

### 3. Thread `stageRunId` into trace/usage recording

`runStageAction()` already creates a `stageRunId` via `startStageRun()` and finishes it after the action completes.[^5] However, `recordAgentUsage()` currently records usage without accepting `runId` or `stageRunId`, even though the repository and schema support both fields.[^5][^3]

That is a concrete coupling bug for observability: trace writes and usage writes should always receive the same `stageRunId`, so the article page, runs page, and future trace page can cross-link reliably.[^3][^5]

### 4. Keep `*.thinking.md` during rollout, but treat it as a compatibility layer

The existing `writeAgentResult()` helper already writes sidecar `*.thinking.md` files, and the artifact renderer already knows how to display them.[^5][^9] That makes rollout easier: keep writing those files initially so nothing regresses, but also persist thinking into the new trace tables and render it primarily from the trace page.

Once the trace page is stable, artifact tabs can become lightweight outputs-only surfaces while trace/thread pages own the full reasoning transcript.[^9]

## Recommended UX

### Primary UX: dedicated thread page

Create a dedicated page at `/articles/:id/traces` with a secondary global index at `/traces`.

The **article trace page** should feel like a threaded group chat, with one expandable card per trace:

- header: timestamp, agent, stage, surface, provider/model, duration, token count, status
- lane 1: `Instructions`
- lane 2: `Injected Context`
- lane 3: `User/Input`
- lane 4: `Tool Calls` (empty/hidden until supported)
- lane 5: `Thinking`
- lane 6: `Final Output`
- footer: links to artifact, stage run, usage row, and related article conversation turn

This works especially well with the current data model because article workflows are already centered on per-article runs and conversation threads.[^6][^18]

### Secondary UX: summary inside current article page

The existing article page should get a compact `LLM Trace` card in the sidebar or `Advanced` section showing:

- latest trace count,
- latest model/provider,
- total traced calls for the article,
- and a link to `Open Trace Thread`.

That preserves the meaning of the existing `Advanced` section while moving the heavy content out of the already crowded artifact/usage/stage-run surfaces.[^6][^8][^9]

### Global UX: `/traces`

Pattern this after `/runs`. The existing runs page already has a list/table rhythm, filters, and pagination via htmx partials, which is a good fit for a trace index page.[^11]

Useful filters:

- article id/title
- agent
- stage
- provider/model
- status
- has thinking
- has tool calls
- date range

## “Move the thinking there” — recommended interpretation

Yes: move **primary thinking visibility** to the new trace page, but do not remove the artifact-sidecar immediately.

Reason:

- Today, thinking is attached to artifacts, not interactions.[^9]
- The user request is interaction-centric (“all inputs and outputs of the LLMs”).
- A trace thread is a more accurate mental model than “open draft artifact, then expand a sidecar reasoning block.”

Recommended behavior:

1. Keep writing `*.thinking.md` for backward compatibility during rollout.[^5]
2. On artifact tabs, replace the large inline thinking display with a small link/badge like `Open full trace`.[^9]
3. On the new trace page, render the full thinking block inline in sequence with instruction/context/output.

## Endpoint and UI Composition Proposal

### Backend routes

- `GET /traces` → global trace index page
- `GET /htmx/traces` → filtered table/thread partial
- `GET /articles/:id/traces` → article-scoped thread page
- `GET /htmx/articles/:id/traces` → live article trace partial
- `GET /api/traces/:traceId` → JSON detail payload

### View modules

- `src/dashboard/views/traces.ts`
- optional partial helpers co-located with `article.ts`

### Layout/nav

Add `Trace` or `Traces` to the main nav beside `Runs`; the current layout already centralizes top-level tool pages there.[^7]

### Realtime updates

The app already has an SSE bus and `/events` stream, but today it only emits coarse pipeline lifecycle events like `stage_changed`, `stage_working`, and `pipeline_complete`.[^19] Add trace-specific events such as:

- `trace_started`
- `trace_updated`
- `trace_completed`

Then use the same htmx `sse-connect` pattern already used elsewhere in the dashboard.[^7][^19]

## Risks, Constraints, and Design Notes

### 1. Storage volume

Full prompt/context persistence will grow SQLite quickly, especially if you store full article bodies and provider-native JSON for every call. The article draft and rich context presets can already be quite large.[^20][^2]

Mitigation:

- store normalized message parts,
- keep provider-native raw payloads optional or truncated,
- lazy-load long bodies in the UI,
- and consider retention/archival for old traces.

### 2. Privacy and auth

The dashboard can run with auth off or local auth, and traces will contain the most sensitive operational text in the system: charters, skills, article drafts, revision handoffs, and roster context.[^21][^7][^8]

Mitigation:

- treat the trace page as a privileged debug surface,
- obey existing dashboard auth,
- and add a feature flag so full prompt persistence can be disabled in lower-trust environments.

### 3. Tool traces are schema-first, feature-later

Because the current in-app providers do not expose tool calls and Copilot CLI tool use is intentionally disabled, “tools” should be modeled now but shown as empty/unsupported until runtime tool invocation exists.[^16][^1]

### 4. Preserve current pages as summaries, not sources of truth

The article page, runs page, and artifacts page are useful precisely because they are concise. Do not turn them into full transcript pages. Let them summarize and deep-link into the trace surface instead.[^6][^9][^11]

## Recommended Rollout Plan

### Phase 1: persistence substrate

- Add `llm_traces` and child tables.
- Add repository methods for create/update/query.
- Thread `stageRunId` and run metadata through action execution.[^3][^5][^17]

### Phase 2: runtime instrumentation

- Instrument `AgentRunner.run()` for canonical inputs.[^2]
- Instrument `LLMGateway.chat()` for routing metadata.[^1]
- Instrument providers for native request/response capture.[^12][^13][^14][^15][^16]

### Phase 3: UX

- Add `/traces` and `/articles/:id/traces`.
- Add article sidebar summary and artifact deep-links.[^6][^7][^9][^11]

### Phase 4: thinking migration

- Render thinking primarily in trace view.
- Keep `*.thinking.md` until the new page is stable.[^5][^9]

### Phase 5: future tool support

- Populate `llm_trace_tool_events` when tool-calling is introduced.

## Key Modules Summary

| Module | Purpose | Why it matters for this feature |
|---|---|---|
| `C:\github\worktrees\llminputs\src\agents\runner.ts` | Builds prompts and calls the gateway | Best place to capture instructions, context, and assembled messages[^2] |
| `C:\github\worktrees\llminputs\src\llm\gateway.ts` | Resolves models/providers and delegates chat calls | Best place to create a top-level trace and record routing[^1] |
| `C:\github\worktrees\llminputs\src\llm\providers\*.ts` | Provider-native request/response mapping | Needed for raw payload visibility[^12][^13][^14][^15][^16] |
| `C:\github\worktrees\llminputs\src\db\schema.sql` | Existing operational schema | Reuse run/usage/article relationships and add trace tables[^17][^18] |
| `C:\github\worktrees\llminputs\src\db\repository.ts` | DB write/read seam | Add trace persistence/query methods here[^3] |
| `C:\github\worktrees\llminputs\src\dashboard\views\article.ts` | Current article/debug UX | Existing sidebar/advanced/artifact patterns should link into traces[^6][^8][^9] |
| `C:\github\worktrees\llminputs\src\dashboard\views\runs.ts` | Global operational index page | Best template for `/traces` list UX[^11] |
| `C:\github\worktrees\llminputs\src\dashboard\sse.ts` | Live dashboard update transport | Reuse for trace_started/trace_completed events[^19] |

## Confidence Assessment

**High confidence**: the repo already has the necessary seams to implement this cleanly. I verified prompt construction in `AgentRunner`, routing in `LLMGateway`, provider request shaping in multiple providers, current operational persistence in `schema.sql` and `repository.ts`, and the relevant dashboard surfaces in `article.ts`, `runs.ts`, `layout.ts`, and `sse.ts`.[^1][^2][^3][^6][^7][^8][^9][^11][^19]

**Medium confidence**: the exact schema shape should be validated against expected data volume and whether you want to store fully raw provider payloads or a normalized/canonical representation only. The code clearly supports a trace page, but product decisions around retention, truncation, and auth posture are still open.[^17][^20][^21]

**Explicit assumption**: I treated “the site” as the current Hono dashboard/workstation served by `src/dashboard/server.ts`, because that is the only first-class web UI in the repository and it already contains the current advanced/debug surfaces.[^6][^7]

## Footnotes

[^1]: `C:\github\worktrees\llminputs\src\llm\gateway.ts:15-49,112-205`
[^2]: `C:\github\worktrees\llminputs\src\agents\runner.ts:33-50,282-332,335-437`
[^3]: `C:\github\worktrees\llminputs\src\db\repository.ts:93-117,226-309,539-716`
[^4]: `C:\github\worktrees\llminputs\src\pipeline\conversation.ts:12-22,39-44,198-255,413-459`
[^5]: `C:\github\worktrees\llminputs\src\pipeline\actions.ts:491-531,1122-1167,1260-1313,1400-1404,1521-1545`
[^6]: `C:\github\worktrees\llminputs\src\dashboard\views\article.ts:163-220`
[^7]: `C:\github\worktrees\llminputs\src\dashboard\views\layout.ts:32-84`
[^8]: `C:\github\worktrees\llminputs\src\dashboard\views\article.ts:878-956,1049-1073`
[^9]: `C:\github\worktrees\llminputs\src\dashboard\views\article.ts:340-435,504-538`; `C:\github\worktrees\llminputs\src\dashboard\server.ts:1554-1578`
[^10]: `C:\github\worktrees\llminputs\src\db\artifact-store.ts:10-72`
[^11]: `C:\github\worktrees\llminputs\src\dashboard\views\runs.ts:12-29,124-219`; `C:\github\worktrees\llminputs\src\dashboard\server.ts:2694-2720`
[^12]: `C:\github\worktrees\llminputs\src\llm\providers\openai.ts:72-124`
[^13]: `C:\github\worktrees\llminputs\src\llm\providers\anthropic.ts:54-107`
[^14]: `C:\github\worktrees\llminputs\src\llm\providers\gemini.ts:66-125,143-149`
[^15]: `C:\github\worktrees\llminputs\src\llm\providers\copilot.ts:164-249`
[^16]: `C:\github\worktrees\llminputs\src\llm\providers\copilot-cli.ts:162-252`
[^17]: `C:\github\worktrees\llminputs\src\db\schema.sql:50-130`
[^18]: `C:\github\worktrees\llminputs\src\db\schema.sql:283-318`
[^19]: `C:\github\worktrees\llminputs\src\dashboard\sse.ts:14-28,34-117`
[^20]: `C:\github\worktrees\llminputs\src\pipeline\context-config.ts:15-55`; `C:\github\worktrees\llminputs\src\agents\runner.ts:367-388`
[^21]: `C:\github\worktrees\llminputs\src\config\index.ts:18-43,202-235`
