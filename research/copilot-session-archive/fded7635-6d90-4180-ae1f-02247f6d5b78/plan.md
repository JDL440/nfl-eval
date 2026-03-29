# LLM Tracing Feature Plan

## Problem

The app already assembles rich LLM inputs at runtime, but it does not persist or expose a first-class trace of what each model call actually saw. Today we can inspect outputs, usage events, stage runs, and some `*.thinking.md` sidecars, but we cannot reliably answer:

- what exact system instructions were sent,
- which skills and memories were injected,
- what article/conversation context was included,
- what provider/model routing happened,
- and what raw response envelope came back.

The goal for this feature is to add a first-class tracing surface for **LLM inputs and outputs** in v3, without waiting for tool-calling support.

## Scope / non-goals

### In scope

- Persist canonical LLM request/response traces for in-app agent runs
- Capture prompt inputs, context parts, routing metadata, outputs, and thinking
- Add dashboard UX for browsing traces globally and per article
- Keep current artifacts/stage runs/usage views working during rollout

### Out of scope

- Enabling runtime tool calling
- Cleaning legacy prompt files in `~/.nfl-lab`
- Redesigning agent roles or prompt content beyond what is needed to trace them

## Proposed approach

Implement tracing in three layers:

1. **Persistence layer:** add first-class trace tables linked to `article_id`, `run_id`, and `stage_run_id`
2. **Runtime capture layer:** capture the canonical prompt in `AgentRunner`, then attach routing/provider-native envelopes in `LLMGateway` and provider adapters
3. **Dashboard layer:** add a dedicated trace thread view and article/global entry points, while keeping existing thinking sidecars as a compatibility path during rollout

The guiding principle is: **capture the exact assembled prompt envelope before the provider call, then preserve enough structure to render it as a thread/group-chat page later.**

## Phased implementation plan

### Phase 1 — Trace schema and repository plumbing

Create first-class trace storage in `pipeline.db`.

Suggested tables:

- `llm_traces`
- `llm_trace_messages`
- `llm_trace_context_parts`
- `llm_trace_tool_events` (reserved now, empty until tool calling exists)

Key trace fields:

- article/run linkage: `article_id`, `run_id`, `stage_run_id`, `stage`
- actor/routing: `agent_name`, `provider`, `model`, `requested_model`, `stage_key`, `task_family`
- request controls: `temperature`, `max_tokens`, `response_format`
- lifecycle: `status`, `started_at`, `completed_at`, `latency_ms`, `finish_reason`, `error_message`
- usage: `prompt_tokens`, `completion_tokens`, `total_tokens`, `cost_usd_estimate`
- thinking/output linkage: `thinking_artifact_name`, optional metadata JSON

Message/context breakdown should preserve enough structure to render:

- system instructions
- user message
- memory injections
- roster/article context
- revision/conversation context
- assistant output
- thinking
- provider-native request/response payloads

Likely file touchpoints:

- `src\db\repository.ts`
- `src\db\artifact-store.ts`
- any DB init/migration code colocated in repository startup

### Phase 2 — Capture canonical prompt envelopes in runtime

Instrument `AgentRunner.run()` to create the human-meaningful trace:

- resolved charter source / agent name
- loaded skill names and source paths
- recalled memories
- roster context
- assembled `systemPrompt`
- assembled `userMessage`
- article context details
- conversation context details
- final canonical `messages` array passed to the gateway

Important design choice:

- Persist both the **full text** and a **structured breakdown** of context parts so the UI can show “what was included” without reparsing prompt text later.

Likely file touchpoints:

- `src\agents\runner.ts`
- `src\pipeline\actions.ts`
- `src\pipeline\conversation.ts`
- `src\pipeline\context-config.ts`

### Phase 3 — Capture gateway/provider routing and native envelopes

Extend `LLMGateway.chat()` to:

- start/complete trace records around provider calls
- persist selected provider/model and policy-routing metadata
- record latency and finish reason
- capture failures as trace records, not just thrown errors

Extend each provider to optionally attach provider-native request/response data:

- OpenAI-compatible providers
- Anthropic
- Gemini
- Copilot CLI wrapper

Provider-specific design note for later:

- evaluate whether `CopilotCLIProvider` should reuse Copilot CLI sessions via resume/session ID instead of always spawning a fresh one-shot process
- in the short term, investigate whether article-stage Copilot calls can deliberately share the same resumed Copilot session and the same working directory across the full article flow
- if session reuse is adopted, persist both the full canonical prompt snapshot and the smaller incremental prompt delta sent into the resumed session
- capture provider session metadata such as `provider_session_id`, working directory / trusted-dir policy, and whether the provider ran in one-shot or resumed-session mode
- treat working directory as part of the trace surface for resumed Copilot sessions, because file visibility, approvals, and MCP usability depend on the session environment as much as the prompt text
- if Copilot CLI MCP access is enabled later, keep the first rollout limited to the existing pipeline MCP server and the local data MCP server (nflverse + prediction-market data), not the broader repo tool catalog

This should be stored as provider-native debug envelopes, but separated from the canonical prompt so the UI can show:

- “what the app meant to send”
- and “how this provider was actually called”

#### Copilot session reuse implementation spike

Turn the short-term Copilot idea into a bounded implementation spike inside Phase 3.

Goal:

- determine whether all article-stage Copilot calls can reuse the same Copilot session and the same working directory without breaking trace visibility, stage isolation, or provider reliability

Deliverables:

- a provider design for article-scoped Copilot session reuse
- trace fields for session-aware runs
- a small prototype or guarded implementation path
- a clear fallback to one-shot mode if resume/session behavior is unreliable

Proposed implementation steps:

1. **Investigate the current Copilot CLI path**
   - verify whether the current non-interactive `copilot -p` invocation can participate in a reusable session/resume flow
   - confirm what session identifier, if any, can be captured and reused across calls
   - confirm whether working directory must remain stable for resumed sessions to behave correctly

2. **Add an article-scoped session model**
   - define an article-level Copilot session record keyed by article/run
   - persist `provider_session_id`, session mode, and session working directory
   - decide whether session ownership belongs in `CopilotCLIProvider`, pipeline actions, or a thin provider-session manager

3. **Keep tracing first-class**
   - continue storing the full canonical prompt snapshot for every stage call
   - also store the incremental prompt delta actually sent into the resumed session
   - mark whether a request created, resumed, or ignored a prior Copilot session

4. **Stabilize the working directory**
   - define a deterministic per-article working directory strategy for resumed Copilot sessions
   - treat working directory and trust/approval policy as traced execution context, not an implicit detail
   - ensure the same directory can be reused safely across writer/editor/reviser article stages

5. **Guard rollout behind provider-specific configuration**
   - add a Copilot-only config flag to enable session reuse experiments
   - keep one-shot mode as the default fallback until the resumed path is proven
   - scope any future MCP exposure in this mode to the pipeline MCP server and the local data MCP server only

Validation criteria:

- multiple article-stage Copilot calls can reuse the same session ID
- the same working directory is preserved across the article flow
- traces still show both canonical full input and per-call incremental input
- failure cases fall back cleanly or surface explicit errors instead of silently switching behavior
- stage/run linkage remains intact in traces, usage events, and article history

Decision gate:

- if the CLI resume/session model works cleanly with the current provider shape, keep it as a near-term Copilot-only enhancement
- if not, leave one-shot behavior in place for v3 tracing and treat session reuse as a later provider redesign

Likely file touchpoints:

- `src\llm\gateway.ts`
- `src\llm\providers\*.ts`

### Phase 4 — Tie traces to existing run/usage records

Ensure traces line up with existing observability records.

Specifically:

- thread `stageRunId` through trace creation
- keep `run_id` / `article_id` aligned with `stage_runs` and `usage_events`
- preserve `*.thinking.md` sidecars during migration
- optionally add trace IDs into `usage_events.metadata_json` for easier cross-linking

Likely file touchpoints:

- `src\db\repository.ts`
- `src\pipeline\actions.ts`
- helpers that write usage events / agent results

### Phase 5 — Dashboard surfaces

Add a first-class trace UX instead of overloading artifact tabs.

Recommended entry points:

- global `/traces` index
- article-scoped `/article/:id/traces` page
- optional single-trace detail route if needed

Recommended article UX changes:

- keep a small trace summary card inside `Advanced`
- add a clear link from article page -> trace thread page
- continue showing `💭 trace` badge for artifact-sidecar compatibility during rollout

Recommended trace thread layout:

- trace header: article, stage, agent, provider, model, timing, token usage
- system instructions section
- context stack section (skills, memories, artifacts, conversation context)
- canonical request view
- provider-native request/response view
- assistant output
- thinking block (moved here as the primary place to inspect reasoning)

Likely file touchpoints:

- `src\dashboard\server.ts`
- `src\dashboard\views\article.ts`
- `src\dashboard\views\runs.ts`
- new trace view file(s), e.g. `src\dashboard\views\traces.ts`
- layout/nav if a top-level Traces page is added

## Safety / operational considerations

### Redaction and privacy

Even though this app is mostly internal/debug-oriented, the trace system should assume prompts can contain sensitive or noisy content.

Need explicit policy for:

- `.env`-style secrets never being persisted
- provider auth tokens never being written into trace payloads
- optional truncation of very large provider-native bodies
- hiding or redacting trace sections in the UI when needed

### Size and retention

Full envelopes can get large quickly, especially if we keep:

- full prompts
- context parts
- provider-native bodies
- thinking

Plan for:

- text truncation rules in list views
- full-content rendering only on detail pages
- possible retention controls for older traces
- keeping sidecar artifacts temporarily while avoiding duplicate long-term storage forever

### Failure capture

A failed model call should still leave behind a trace row with:

- the assembled input,
- routing info,
- error state,
- and any partial provider response or error payload that is safe to retain

## Biggest risks / open questions

1. **Trace size growth**  
   Full prompt envelopes may increase DB size quickly; retention/truncation policy should be part of the first implementation, not an afterthought.

2. **Provider payload inconsistency**  
   Each provider shapes requests differently, so the canonical trace model must be primary and provider-native payloads should be treated as optional attachments.

3. **Copilot CLI resumed-session semantics**  
   If `CopilotCLIProvider` later moves from one-shot calls to resumed sessions, traces must still explain what context the provider already carried vs. what this specific stage added. That means session IDs, working-directory/trust configuration, request-level canonical snapshots, and incremental prompt deltas cannot be implicit.

4. **Stage/run linkage drift**  
   If traces, stage runs, and usage events are not linked consistently, the UX will feel fragmented again.

5. **Duplicate debug surfaces**  
   During rollout, the app will temporarily have artifacts, thinking sidecars, stage runs, usage events, and traces all showing related information. The migration should be staged to avoid confusing overlap.

6. **Legacy prompt cleanup is separate**  
   The trace feature will expose stale live prompt data, but it should not block on prompt cleanup. The plan should assume tracing lands first, cleanup second.

## Validation strategy

Validation should prove both persistence and UX behavior.

### Build / baseline

- `npm run v2:build`

### Focused automated coverage

- agent runtime tests around `AgentRunner`
- gateway/provider tests around `LLMGateway` and provider adapters
- repository tests for new trace tables and query helpers
- dashboard/server/view tests for trace routes and rendering

Likely existing areas to extend:

- `tests\agents\runner.test.ts`
- `tests\llm\gateway.test.ts`
- provider-specific tests under `tests\llm\`
- dashboard/server tests if present

### Manual verification

Run a real article stage and confirm:

- a trace row exists
- system prompt and user message are captured
- skills/memories/context parts are visible
- thinking is visible in the trace page
- stage run / usage event / trace link to the same stage action
- article page shows a working trace entry point

## Likely implementation order

1. `trace-schema-design`
2. `trace-runtime-capture`
3. `trace-provider-envelopes`
4. `copilot-session-reuse-spike`
5. `trace-dashboard-surfaces`
6. `trace-policy-controls`
7. `trace-validation-rollout`

## SQL todo mapping

- `trace-schema-design`
- `trace-runtime-capture`
- `trace-provider-envelopes`
- `copilot-session-reuse-spike`
- `trace-dashboard-surfaces`
- `trace-policy-controls`
- `trace-validation-rollout`

## Notes

- Build this for **message-only runtime tracing first**. Do not block on tool-calling support.
- Reserve a `tool_events` table now so the schema and UI do not need a major redesign later.
- Treat `Advanced` as a launch point, not the final home for heavy trace rendering.
- The trace system should expose the live prompt reality, even if that reveals stale instructions. That is a feature, not a bug.
- If `CopilotCLIProvider` later adopts resumed sessions, keep request-level canonical snapshots so a long-lived provider session never becomes an opaque black box.
