---
name: provider-state-native-tool-loop
description: Preserve opaque provider conversation state when native tool calling must resume across app-managed loop turns.
domain: llm-runtime
confidence: high
source: manual
tools: [view, rg, vitest]
---

# Provider State Native Tool Loop

## Purpose

Use this pattern when the app keeps its own tool loop contract (`{ "type": "tool_call" }` / `{ "type": "final" }`) but a backend provider requires raw, provider-owned conversation state to continue native tool calling safely.

## When to Use

- A provider emits native tool calls that must be resumed on the next request.
- The provider returns opaque metadata or content parts that the app must round-trip exactly (for example Gemini `thoughtSignature`).
- Rebuilding the conversation only from normalized `ChatMessage[]` would lose backend-required state.

## Pattern

1. Add `providerState?: unknown` to the shared gateway request/response types.
2. In every runner loop that can make repeated `gateway.chat()` calls, declare a local `providerState` variable before the loop.
3. Pass `providerState` into each call and replace it with `response.providerState` after each response.
4. In the provider adapter:
   - store the raw backend conversation state in `response.providerState`
   - on follow-up calls, prefer that raw state over rebuilding old turns from normalized chat messages
   - append only the fresh post-response tool-result turns that the app added since the last provider response
5. Keep the runner-facing response envelope unchanged so callers still see the app's canonical JSON control messages.

## NFL Lab Example

- `src\llm\gateway.ts` carries opaque `providerState`.
- `src\agents\runner.ts` threads `providerState` through both `runWithToolLoop()` and the structured native-tool path.
- `src\llm\providers\gemini.ts` stores raw Gemini `contents`, preserves `thoughtSignature`, emits native `functionDeclarations`, and maps Gemini tool calls back to the runner's `{ type: "tool_call", toolName, args }` contract.
- `tests\llm\providers.test.ts` proves the provider reuses prior contents and appends only trailing tool results.

## Boundaries

- Do not make the runner understand provider-specific opaque state formats.
- Do not rebuild old native-provider turns from lossy text if the backend requires exact round-tripping.
- Do not change the shared tool-loop JSON contract just because one provider needs extra internal state.
