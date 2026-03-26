---
name: Additive Multi-Provider Rollout
domain: llm-architecture
confidence: high
tools: [view, rg, vitest]
---

# Additive Multi-Provider Rollout

## When to Use

- A codebase already has a model router or gateway and wants multiple LLM providers without a full policy rewrite.
- Provider override UI/data has partially landed, but runtime still behaves like a single-provider app.
- You need to review or implement per-article/provider preference while preserving backward-compatible auto routing.

## Pattern

Treat the rollout as **wiring completion**, not a new architecture.

1. Start at startup wiring in `src/dashboard/server.ts` (or equivalent bootstrap) and confirm whether providers are registered additively or through a mutually exclusive branch.
2. Check the request seam in `src/llm/gateway.ts` and `src/agents/runner.ts` to see whether provider intent can travel alongside model/stage/task context.
3. Verify persistence in `src/db/schema.sql`, `src/db/repository.ts`, and `src/types.ts` for both:
   - article-level preferred provider intent
   - requested-vs-actual execution telemetry
4. Compare dashboard/server handlers with dashboard views so JSON and HTMX/editorial flows accept the same provider field and render the same meaning.
5. Only after those seams line up should you consider richer policy additions.

## Recommended Order

1. **Startup unlock**
   - register multiple healthy providers in one runtime
   - keep mock-only/testing short-circuit behavior separate
2. **Gateway hinting**
   - add `auto` / `prefer` / `require` style provider intent without changing default behavior
3. **Pipeline threading**
   - read article preference
   - pass it through runner → gateway
4. **Intent telemetry**
   - persist requested provider separately from actual provider/model
5. **Optional later policy**
   - stage/provider preferences only after the additive path works

## Must-Haves

- Keep model policy model-first during the first pass.
- Preserve unset/auto behavior exactly.
- Keep requested provider distinct from actual provider/model returned by execution.
- Review JSON and HTMX metadata paths together; partial acceptance is a common regression.

## Lockout Heuristics

- Reject any rollout that combines provider support with a provider-policy rewrite unless explicitly requested.
- Reject any implementation that treats provider `supportsModel()` as equivalent to model fidelity when a provider can silently substitute its own local/default model.
- Reject any implementation that makes UI/config surfaces look multi-provider while startup/runtime still only hosts one provider path.

## NFL Lab Example

- `src/llm/gateway.ts` is already the right abstraction.
- `src/dashboard/server.ts` startup is the real unlock seam.
- `articles.llm_provider` can land before runtime wiring is complete, so review for partial-rollout drift.
- `usage_events.provider` shows actual execution; `stage_runs` may still need requested-provider intent to explain fallback behavior cleanly.
