---
name: Prompt Handoff Isolation
domain: pipeline
confidence: high
tools: [view, rg, vitest]
---

# Prompt Handoff Isolation

## When to Use

- Multiple pipeline agents share article state, but only part of that state should cross role boundaries.
- A prompt currently includes raw prior outputs from other roles and you need to reduce role bleed without removing continuity.
- You want regression tests that prove some context is excluded, not just reformatted.

## Workflow

1. Start in `src/pipeline/actions.ts` to find which stage action assembles `conversationContext` for each agent.
2. Check `src/agents/runner.ts` to confirm whether the problem is system-prompt precedence or user-message context assembly.
3. In `src/pipeline/conversation.ts`, keep the full-history formatter available for debug/history surfaces, but add a compact summary formatter for default runtime handoffs.
4. Give downstream roles only the minimum shared summary they need. Keep agent-local detail separate (for example, Editor self-history via a dedicated helper).
5. Add focused tests in both the formatter file and the action layer:
   - positive assertions for the summary block that should appear
   - negative assertions for sentinel raw thread strings that must not appear

## Must-Haves

- Preserve fresh per-agent system prompts; do not solve role bleed by weakening charter authority.
- Prefer presentation-layer changes over schema churn when the stored data already exists.
- Treat Publisher as summary-only unless there is a deliberate debug mode.
- Use exclusion assertions in tests to prove raw cross-role transcript leakage is gone.

## Example

- Issue `#92` kept `article_conversations` and `revision_summaries` intact.
- `buildRevisionSummaryContext()` became the default shared handoff in `src/pipeline/conversation.ts`.
- `src/pipeline/actions.ts` switched Writer and Publisher to summary-only handoffs, while Editor receives the shared summary plus `buildEditorPreviousReviews()`.
