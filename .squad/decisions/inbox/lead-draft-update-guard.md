# Decision: Draft URL Persistence + Published-Article Guard

**Date:** 2026-03-16
**Author:** Lead
**Status:** Implemented
**Requested by:** Joe Robinson

## Context

When re-publishing an article after edits, the extension was creating duplicate Substack drafts. Joe needed a way to update an existing draft and a guard to prevent accidentally overwriting already-published articles.

## Decisions

### 1. Draft URL stored in `articles.substack_draft_url` column

Added a new `substack_draft_url` TEXT column to the `articles` table in `pipeline.db`. This is the canonical durable location for Substack draft URLs. The existing `substack_url` column remains reserved for the final published URL (set at Stage 8).

**Rationale:** Reuses the existing articles table and PipelineState pattern. No new tables, no file-based storage. Single source of truth.

### 2. Auto-detect update mode from stored draft URL

When `publish_to_substack` is called, it reads `substack_draft_url` from `pipeline.db` for the article slug. If a URL is found and the article is not published, it updates the existing draft via `PUT /api/v1/drafts/{id}` instead of creating a new one via `POST /api/v1/drafts`.

**Rationale:** Zero-friction for callers — no need to remember or pass the draft URL manually. The `draft_url` parameter exists as a manual override.

### 3. Hard guard on published articles

Both the extension (JS) and `PipelineState` (Python) refuse to operate on articles where `current_stage == 8` or `status == 'published'`. This is a hard error, not a warning. No override path exists through the draft-update flow.

**Rationale:** Published articles must be edited directly in Substack's editor. Overwriting live content through the pipeline would be destructive with no undo.

### 4. No unsafe stage transitions on update

When updating an existing draft (article already at Stage 7), the extension does NOT attempt a 6→7 stage transition. The writeback instruction only calls `set_draft_url()` to refresh the URL. Stage integrity is preserved.

## Files Changed

- `content/pipeline_state.py` — added `get_draft_url()`, `set_draft_url()`, `assert_not_published()`
- `content/pipeline.db` — added `substack_draft_url` column to `articles` table
- `.github/extensions/substack-publisher/extension.mjs` — added `updateSubstackDraft()`, `extractDraftIdFromUrl()`, `lookupArticleStateFromDb()`, `draft_url` parameter, published guard, create-vs-update logic
- `.squad/skills/publisher/SKILL.md` — updated Steps 5 and 5b
- `.squad/skills/substack-publishing/SKILL.md` — added Draft Update Mode and Published-Article Guard sections

## Backfill

Miami Tua article (`mia-tua-dead-cap-rebuild`) backfilled with known draft URL `https://nfllab.substack.com/publish/post/191150015`. Article remains at Stage 7 / `in_production`.
