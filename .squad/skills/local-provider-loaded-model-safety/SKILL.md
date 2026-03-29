---
name: local-provider-loaded-model-safety
description: Keep gateway routing aliases from overriding the loaded model of a local provider.
domain: llm-architecture
confidence: high
source: manual
tools: [view, rg, vitest]
---

# Skill Content

## Purpose

Protect local OpenAI-compatible providers from receiving abstract gateway policy aliases as transport-level model ids.

## When to Use

- A gateway resolves stage/task/model-policy aliases such as `gpt-5-mini` or `gpt-5`.
- The executing provider is local and fronts a manually loaded model, such as LM Studio.
- Startup/runtime can auto-detect the loaded local model and set a provider default.

## Workflow

1. Separate provider selection from transport model selection.
2. Confirm whether startup/runtime already resolved a loaded local default model.
3. In the provider adapter, forward `request.model` only if it is truly an explicit local-provider model id.
4. If the incoming model is only a gateway policy alias, keep the effective transport model on the loaded/default local model.
5. Record both `requestedModel` and `effectiveModel` in provider metadata so traces stay honest.
6. Add a regression that exercises the real gateway-policy-to-local-provider path, not just direct provider calls.

## NFL Lab Example

- `worktrees\v4\src\dashboard\server.ts` auto-detects loaded LM Studio models and sets the provider default when `LMSTUDIO_MODEL` is unset.
- `worktrees\v4\src\llm\gateway.ts` may resolve `writer` or similar stages to policy aliases like `gpt-5-mini`.
- `worktrees\v4\src\llm\providers\lmstudio.ts` must keep the effective request model on the loaded/default LM Studio model unless the caller supplied a real discovered LM Studio model id such as `qwen/qwen3.5-35b-a3b`.
- `worktrees\v4\tests\llm\gateway.test.ts` and `worktrees\v4\tests\llm\provider-lmstudio.test.ts` should cover both alias fallback and explicit local-model passthrough.

## Boundaries

- This pattern does not change gateway policy selection; it only protects transport-level model fidelity for local providers.
- Do not use a provider's broad `supportsModel()` result as proof that forwarding the requested model is safe.
- Keep structured-output fixes separate from model-selection fixes, even when both are involved in the same provider revision.
