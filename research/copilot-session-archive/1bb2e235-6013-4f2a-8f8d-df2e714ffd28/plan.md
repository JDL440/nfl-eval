1. Problem: The Stage 7 publish experience needs to become reliable and clearer. The current draft action appears broken in practice, the publish-page preview uses a lower-fidelity renderer than the richer article preview, and the article detail page/error states still reflect the older two-step mental model too bluntly.

Approach:
- Fix the draft path by unifying markdown cleanup/serialization logic used by preview and Substack draft creation.
- Reuse the richer article preview presentation inside the publish page so editors see something much closer to the final published article.
- Expand the publish actions to support both saving/updating a Substack draft and publishing directly from the publish page, with "publish now" safely ensuring draft state exists first.
- Clean up Stage 7 article-detail messaging and publish-page errors so the flow is explicit and recoverable.
- Add focused tests for the new route behavior and UI states, then re-run the targeted publish/dashboard validation plus build.

## Status Update (2026-03-25T10:30:00Z)

**COMPLETED: Publish Payload Fixes**
- ✅ ProseMirror HTML regression fixed (line 276 in src/dashboard/server.ts)
- ✅ Enrichment refactored from HTML strings to ProseMirror document nodes
- ✅ All 45 publish tests pass
- ✅ Stage validation complete; payload structure correct
- ✅ Decisions merged and staged for commit

**ACTIVE: Social Publishing Fixes**
- Note publishing 500s (Publisher investigation)
- Tweet publishing 500s (Code investigation)
- Expected similar fix pattern to payload regression

**NEXT PHASE:**
1. Commit .squad/ state (decisions, logs, histories)
2. Ship publish payload fixes
3. Complete Note/Tweet 500 investigations
4. Monitor first live republish for rendering parity

Todos:
- publish-note-fix (in_progress)
- publish-tweet-fix (in_progress)
- commit-squad-state

Notes:
- Preserve the existing Stage 7 -> Stage 8 persistence model (ecordPublish) and Substack draft URL storage.
- Prefer extending the current /api/articles/:id/draft and /api/articles/:id/publish behavior rather than inventing a parallel publish pipeline.
- Keep terminology consistent between article detail, publish page, and server errors.
