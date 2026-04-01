# Decision: Native Gemini Tool Calling with providerState

**Author:** Code  
**Date:** 2026-04-01  
**Status:** Implemented

## Context

Gemini 3.x models require `thoughtSignature` round-tripping for multi-turn tool calling. The previous text-based tool loop (system-prompt-instructed JSON `{"type":"tool_call",...}`) couldn't preserve these opaque tokens, causing failures on follow-up turns.

## Decision

1. **providerState threading**: `ChatRequest.providerState` and `ChatResponse.providerState` carry opaque provider state through the runner's tool loops without the runner needing to understand the contents.

2. **Native Gemini tool format**: When `request.tools` exists, the Gemini provider sends `tools:[{functionDeclarations}]` and `toolConfig.functionCallingConfig.mode='AUTO'` instead of relying on system-prompt JSON instructions.

3. **providerState contents**: Gemini preserves raw `contents` (including `thoughtSignature` parts) in `response.providerState.contents`. On subsequent calls, if `request.providerState` has contents, the provider uses them as the base conversation state and appends only trailing tool-role messages as `functionResponse` parts.

4. **Response serialization**: Tool calls serialize as `{"type":"tool_call","toolName":...,"args":...}`; final text as `{"type":"final","content":...}`. This matches the runner's existing structured tool loop contract.

5. **Runner routing**: Gemini omits `responseFormat` in the structured-tool path (alongside lmstudio) since Gemini's JSON mode is incompatible with native tool calling.

6. **mapMessages kept**: The non-providerState path still uses `mapMessages()` for backward compatibility when no tools are present.

## Impact

- Gemini models now work correctly in the structured tool calling path
- `thoughtSignature` tokens round-trip correctly across multi-turn tool conversations
- No changes to other providers — providerState is optional and ignored by providers that don't use it
- 1713/1713 tests pass (2 pre-existing publish rendering failures unrelated)
