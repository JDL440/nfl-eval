Problem
- Article quality appears to have dropped after the v2 move to isolated per-call agent execution. The goal is to add an optional mode that behaves more like the original shared article context flow, then enable that mode so it can be tested without removing the current v2 path.

Current state
- `src/pipeline/actions.ts` owns article-stage execution. `runDiscussion` fans out panelists into separate `ctx.runner.run(...)` calls, then synthesizes with another call. `writeDraft`, `runEditor`, and `runPublisherPass` each make fresh calls with compact context injection.
- `src/agents/runner.ts` currently collapses each run into one system message plus one user message, even though `src/llm/gateway.ts` and providers already support multi-message chats.
- `src/pipeline/conversation.ts` already stores a shared per-article thread, but today it is used mainly for summaries and dashboard history, not as a first-class reconstructed chat transcript.
- Context inclusion is configurable via `src/pipeline/context-config.ts`, global `pipeline-context.json`, and per-article `_config.json`, and the dashboard already persists those overrides.
- Existing tests show the advanced context config does work today for default includes, global overrides, per-article overrides, and revision-sensitive writer/editor handoffs. It can change what artifacts each stage sees, but it does not change the fact that stages still execute as separate LLM calls.

Proposed approach
- Start with the lightest plausible experiment: leverage the existing advanced context-config system to widen the artifacts available to article stages, and make that easy to set from the article/idea workflow.
- Treat this as Phase 1 because it directly addresses “maybe the quality drop is from context starvation” and it is already wired, tested, and low-risk.
- Keep a Phase 2 fallback available: if broader artifact context still does not recover quality, add a true shared-transcript article mode using reconstructed `messages[]` through the existing gateway.
- Keep the existing stage machine, artifacts, and revision loop intact in both phases so the change is behavior-scoped to LLM context handling rather than pipeline semantics.

Implementation plan
1. Validate and map the current advanced context-config path.
   - Confirm the exact stages already covered by `CONTEXT_CONFIG`, global `pipeline-context.json`, and per-article `_config.json`.
   - Confirm revision behavior stays correct when include lists change, especially for `writeDraft`, `runEditor`, and `runPublisherPass`.
   - Document which “quality-relevant” artifacts can already be exposed to each stage without code-level prompt redesign.

2. Use the existing context-config system as the first implementation path.
   - Define stronger default include lists for the full article flow where quality likely regressed.
   - Add a simple way to apply a richer preset from the article/idea workflow so testing does not require manual artifact editing.
   - Prefer using the existing per-article override artifact/schema instead of introducing a brand-new mode if the quality goal can be met by context changes alone.

3. Add testable rollout controls around that existing config.
   - Support a global config/env default for the richer context preset so it can be enabled broadly for testing.
   - Optionally seed the per-article `_config.json` from article creation or the idea page so new test articles inherit the richer preset automatically.
   - Make the effective context preset visible in the UI/logs so test runs are easy to identify.

4. Validate whether context-config-only changes are enough.
   - Add or update tests proving the richer defaults are honored in normal and revision flows.
   - Run side-by-side quality validation using the same pipeline with current defaults versus richer-context defaults.
   - If the output quality improves enough, stop here and keep the solution config-driven.

5. Keep a Phase 2 fallback only if needed: true shared transcript mode.
   - If richer artifact context does not recover quality, then add a deeper article-level execution mode that reconstructs shared `messages[]` from article history and replays them through the gateway.
   - Apply that fallback across the full article flow, including panel, draft, editor, and publisher stages, while preserving artifacts and guards.
   - Reuse the existing gateway and provider message support rather than inventing a separate execution engine.

6. Finish with focused validation.
   - Add/update tests for the chosen Phase 1 path first, then Phase 2 only if it becomes necessary.
   - Finish with `npm run v2:build` and focused Vitest coverage for the touched pipeline, dashboard, and runner files.

Notes and assumptions
- Confirmed rollout: initial enablement should come from a global config/env default.
- Current evidence says the advanced context config already works correctly for the relevant include-list behavior, including revisions, because `gatherContext(...)` merges defaults/global overrides/per-article overrides and the tests cover per-article overrides plus revision-specific handoff behavior.
- That config system can likely be surfaced from the idea/article workflow and may be enough for the first experiment.
- This plan assumes “all LLM calls happen in the same context window” applies to article-production calls, not image generation or external publishing integrations.
- Important constraint: changing context-config defaults can widen stage inputs, but by itself it does not make separate LLM calls share one live context window or remove panel fan-out. If the user specifically needs true single-window semantics, that remains the Phase 2 fallback.
