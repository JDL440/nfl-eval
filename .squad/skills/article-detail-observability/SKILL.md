---
name: Article Detail Observability
domain: dashboard-observability
confidence: high
tools: [view, rg, vitest, github]
---

# Article Detail Observability

## When to use

- An article detail page is “missing” revision history, intermediate passes, or debug/thinking traces.
- Pipeline code appears to persist iteration data, but the dashboard does not make that history understandable.
- You need to separate a persistence bug from an article-page hydration/rendering bug.

## Workflow

1. Start with the persistence seams:
   - `src/pipeline/conversation.ts` for `article_conversations` and `revision_summaries`
   - `src/pipeline/actions.ts` for where writer/editor turns and `*.thinking.md` sidecars are written
2. Then inspect the article-detail seam:
   - `src/dashboard/server.ts` for which data the page actually hydrates
   - `src/dashboard/views/article.ts` for which artifacts, revisions, or debug controls are discoverable in UI
3. Check `src/db/artifact-store.ts` / `src/db/schema.sql` only after you know whether the UI is ignoring already-persisted data.
4. Run focused dashboard + pipeline tests to confirm whether the repo currently covers:
   - revision-history rendering
   - persisted-thinking preference over inline `<think>` fallback

## Common gaps

- **Revision data exists but is unsurfaced:** full writer/editor iteration content lives in `article_conversations`, but the dashboard only shows latest-state artifacts or legacy metadata tables.
- **Thinking exists but is not paired:** `*.thinking.md` sidecars are persisted, but the renderer only extracts inline reasoning tags from the main artifact content.
- **Legacy metadata misleads the UI:** lightweight tables such as `editor_reviews` may still exist, but they are not always the live source for full multi-pass history.

## Heuristic

Ask these questions in order:

1. **Persisted?** Are revisions/debug traces actually written?
2. **Hydrated?** Does the article route load the persistence source that owns the full history?
3. **Paired?** Does the renderer connect the main artifact to its debug sidecar?
4. **Discoverable?** Is there an obvious user-facing affordance for the history/trace?

If (1) is yes and (2)-(4) are no, prefer an article-detail observability fix over schema churn.

## Recommendation

For revision visibility, use the existing conversation + revision-summary stores before inventing versioned artifact names.

For debug visibility, prefer persisted `*.thinking.md` sidecars over inline `<think>` extraction, and treat inline tags only as a backward-compatibility fallback.
