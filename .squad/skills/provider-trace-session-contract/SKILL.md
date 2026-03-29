---
name: provider-trace-session-contract
description: Review and preserve the cross-layer contract for provider mode, session reuse, and trace envelopes.
domain: workflow-architecture
confidence: high
source: manual
tools: [view, rg, vitest]
---

# Skill Content

## Purpose

Keep provider-specific session and tool semantics coherent across runtime wiring, persistence, and dashboard observability.

## When to Use

- A provider starts emitting `providerMetadata` such as mode, session id, working directory, or request/response envelopes.
- Runner, repository, and dashboard code all changed together and you need to verify the contract end to end.
- A plain provider and a tool-enabled provider share the same `ChatRequest` shape, but only one should honor article-stage session/tool behavior.

## Workflow

1. Start at the provider entrypoint in server wiring and confirm one explicit mode value is derived before provider construction.
2. Inspect the provider to separate:
   - guarded capability mode (`toolAccessMode`)
   - resolved runtime allowances (`allowedTools`, MCP/web flags)
   - session reuse eligibility (`articleId`, stage gates, fallback path)
3. Verify the runner forwards `providerContext` and persists `providerMetadata` on both success and failure paths.
4. Verify the repository schema stores the same provider fields without renaming drift.
5. Verify dashboard trace views render those fields in human terms instead of only raw JSON.
6. Run focused tests across provider, runner, repository, and dashboard together so the seam is validated as one contract.

## Failure Pattern

- If a provider returns a valid `ChatResponse` but omits `providerMetadata`, `src\agents\runner.ts` will persist `provider_request_json` and `provider_response_json` as `NULL`, and `src\dashboard\views\traces.ts` will render empty envelope sections even though the page already supports them.
- If the app-owned tool loop exists in `src\agents\runner.ts` but the runtime constructs `AgentRunner` without `toolLoop.enabledProviders`, every non-native provider stays chat-only. Prompts can mention tools and safe local tools can exist, but traces will still show no `toolLoop` calls because `shouldUseToolLoop()` fail-closes before any tool schema is offered.
- For plain HTTP providers (for example LM Studio), the minimal fix is usually provider-local: capture the actual request body before `fetch`, attach the raw parsed response after `fetch`, and add that pair under `providerMetadata.requestEnvelope` / `responseEnvelope` on both success and relevant error paths.

## Examples

- `src\dashboard\server.ts` derives `cliMode` from env compatibility flags, then passes explicit options into `src\llm\providers\copilot-cli.ts`.
- `src\agents\runner.ts` forwards `providerContext` and stores `providerMode`, `providerSessionId`, `incrementalPrompt`, and envelopes via `repo.completeLlmTrace()` / `repo.failLlmTrace()`.
- `src\db\repository.ts` persists `provider_mode`, `provider_session_id`, `incremental_prompt`, `provider_request_json`, and `provider_response_json`, and `src\dashboard\views\traces.ts` renders the same fields.
- `src\llm\providers\lmstudio.ts` should emit `providerMetadata` containing the endpoint/body request envelope and raw LM Studio response so traces stay debuggable without changing the runner or dashboard.
- `tests\llm\provider-copilot-cli.test.ts`, `tests\agents\runner.test.ts`, `tests\db\repository.test.ts`, and `tests\dashboard\server.test.ts` together define the end-to-end contract.

## Boundaries

- Do not let the plain API provider pick up CLI-only session/tool behavior just because the request shape now includes `providerContext`.
- Do not trust provider-side resume logic unless you can explain where session identifiers originate and how fallback is represented in traces.
- If guarded mode claims to be fail-closed, verify runtime flags and rendered traces reflect missing config or disabled tools honestly.
