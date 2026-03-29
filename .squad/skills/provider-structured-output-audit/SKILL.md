---
name: provider-structured-output-audit
description: Review provider-specific structured-output changes without weakening the shared gateway or caller contract.
domain: llm-architecture
confidence: high
source: manual
tools: [view, rg, vitest]
---

# Skill Content

## Purpose

Audit changes where a shared gateway or runner asks for machine-readable output, but each provider must translate that request into its own backend-specific envelope.

## When to Use

- A gateway method like `chatStructured()` or `chatStructuredWithResponse()` forces JSON/structured mode for multiple providers.
- A caller such as a tool loop, planner, extractor, or schema-bound parser depends on strict JSON rather than best-effort prose.
- A provider-specific backend accepts different structured modes (`json_schema`, `json_object`, schema payloads, MIME hints) and live failures suggest drift at that seam.

## Workflow

1. Start at the caller contract and write down the exact machine-readable shape it expects (`tool_call` vs `final`, required keys, schema rules).
2. Trace the shared gateway seam that turns a normal request into a structured one; confirm it still parses and validates strictly rather than silently degrading to text.
3. Inspect the provider adapter and compare its outbound request body to what the actual backend honors in live use; do not assume OpenAI-compatible fields are interchangeable.
   - For local OpenAI-compatible runtimes, confirm whether `json_object` actually works; some LM Studio + Qwen combinations only honor `json_schema` or plain text.
4. Verify request/response envelope capture so reviewers can see the structured mode requested, the exact payload sent, and the raw provider response returned.
5. Demand tests at three levels:
   - provider request-shaping assertions
   - gateway parse/schema-validation assertions
   - caller/runner loop assertions proving the structured output still drives control flow end to end
6. Include at least one provider-realistic failure fixture (invalid JSON, schema mismatch, think-tag/code-fence wrappers, reasoning prefix, wrong structured mode) so the regression is not hidden by happy-path mocks.
7. When the backend can emit reasoning text around the payload, add a shared parser recovery step that strips wrapper tags/fences and extracts the first balanced JSON object before schema validation; keep the recovery narrow so non-JSON prose still fails closed.
8. If the provider advertises broad `supportsModel()` coverage or can be the default route, trace the non-explicit path too: verify gateway policy aliases are either translated to the provider's loaded/runtime model or intentionally suppressed, rather than assuming the provider-only request-shaping test proves the live path.

## Review Checklist

- Does the caller contract still require the same JSON shape?
- Does the gateway still enforce parse + schema validation strictly?
- Does the provider send the backend-specific structured-output mode that live validation actually supports?
- Is the backend-facing schema compatible with the caller’s expected object shape?
- Are raw request/response envelopes visible in traces or provider metadata?
- Do tests prove both success and failure at the real seam, not just a mocked final JSON string?
- If this provider can be the default routed provider, do tests cover the gateway-policy-to-provider path as well as the explicit `provider:` override path?

## NFL Lab Example

- `worktrees\v4\src\llm\gateway.ts` uses `chatStructuredWithResponse()` to force `responseFormat: 'json'`.
- `worktrees\v4\src\agents\runner.ts` expects `TOOL_LOOP_RESPONSE_SCHEMA` with `type: 'tool_call' | 'final'`.
- `worktrees\v4\src\llm\providers\lmstudio.ts` is the adapter seam where LM Studio request shaping must match what Qwen actually honors; for the idea-page failure, that means `response_format: { type: 'json_schema', ... }` rather than assuming `json_object` is accepted.
- `worktrees\v4\src\llm\gateway.ts` can safely recover JSON when Qwen wraps the object in `<think>...</think>`, code fences, or surrounding prose, but must still fail if no balanced JSON object remains.
- `worktrees\v4\tests\llm\provider-lmstudio.test.ts`, `worktrees\v4\tests\llm\gateway.test.ts`, and `worktrees\v4\tests\agents\runner.test.ts` together should prove or disprove a real fix.

## Boundaries

- Do not weaken the shared gateway/parser contract just to accommodate one provider.
- Do not treat “request body changed” as proof that a structured-output bug is fixed.
- Do not collapse provider-specific live behavior into generic assumptions; preserve backend-specific shaping where needed.
