# Dashboard-led live publish status

## Overall status

- Implementation is complete in the repo: the dashboard now owns the final publish handoff instead of the pipeline auto-publishing after Stage 7.
- Validation completed for syntax, dashboard startup, key read APIs, and guarded publish behavior.
- One runtime risk remains unverified: this session did **not** execute a real end-to-end live publish to Substack.

## Implemented

- Dashboard-led publish flow added so the article flow now pauses at Stage 7 before any Substack publish occurs.
- Dashboard article page can publish the article live to Substack and optionally dispatch the Substack Note.
- Shared helpers were added in `shared/substack-session.mjs`, `shared/substack-article.mjs`, and `shared/substack-notes.mjs`.
- Dashboard publish orchestration was added in `dashboard/publish.mjs` and `dashboard/publish-worker.mjs`.
- Dashboard server, templates, and data layers were updated to support the publish UI and publish APIs.
- `content/pipeline_state.py` and `stage7-db-writeback.mjs` were updated so Stage 8 now means a truly live published article only.
- Core Ralph, README, and lifecycle documentation were updated to match the dashboard-led publish model.

## Validation completed

- `python -m py_compile content\\pipeline_state.py content\\article_board.py` passed.
- `node --check` passed for the new and changed JavaScript modules.
- The dashboard started successfully on port 3457.
- `GET /api/board` worked.
- `GET /api/article/:slug` worked.
- `GET /api/publish/:slug` worked.
- A safe `POST /api/publish/:slug` against a non-ready article returned the guarded `PREREQ_FAIL` response instead of attempting a publish.

## Remaining unverified area

- No real end-to-end live publish to Substack was executed in this session.
- That means the highest remaining runtime risk is the final production interaction with Substack itself: publishing a ready article live, persisting the resulting live URL and publish timestamp, and optionally dispatching the Substack Note against a real authenticated session.

## Recommended next step

- Run one controlled dashboard publish against a genuinely ready article in the intended environment.
- Verify that the live publish succeeds, Stage 8 is only reached after the article is truly live, `substack_url` and publish metadata are written back correctly, and the optional note path behaves as expected.
- Treat that end-to-end publish as the final go-live verification for this implementation.
