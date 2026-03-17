# Decision: Witherspoon + JSN Publisher Pass and Prod Push

**Date:** 2026-03-17  
**Decision maker:** Lead  
**Status:** EXECUTED

---

## Context

After the overbroad Stage 7 prod push was rolled back (only DEN and MIA confirmed safe), reconciliation identified `witherspoon-extension-v2` and `jsn-extension-preview` as the next safe targets.

## Blockers Resolved

1. **`article_board.py` sort bug** — `_parse_editor_verdict` sorted editor-review files by ASCII, causing `editor-review.md` (the original REVISE review) to sort above `editor-review-3.md` (the latest APPROVED review) for JSN. Fixed by sorting on extracted numeric suffix.

2. **`article_board.py` image-path bug** — `_count_images` only checked the article directory, not `content/images/{slug}/` where images actually live. Fixed to check both locations.

3. **Missing `_expected_status_for_stage` helper** — Called in `reconcile()` repair mode but never defined. Added the function.

4. **Witherspoon inline image alt text** — Contained "Placeholder for generated art:" production notes. Cleaned to descriptive captions.

## Actions Taken

- Fixed 3 bugs in `content/article_board.py`
- Created `publisher-pass.md` for both articles
- Ran `--repair` to sync DB stages (6 → 7) and status fields
- Published both to prod Substack via API
- Updated `pipeline.db` with prod draft URLs

## Prod Draft URLs

| Article | Prod Draft URL |
|---------|---------------|
| witherspoon-extension-v2 | https://nfllab.substack.com/publish/post/191200944 |
| jsn-extension-preview | https://nfllab.substack.com/publish/post/191200952 |

## Orphan Draft Note

The original overbroad push created ~39 orphan drafts on nfllab.substack.com. These two new prod drafts are **new** drafts (not updates to orphans). The orphans remain invisible and non-destructive but should be bulk-deleted from the Substack dashboard when convenient.

## Next Recommended Step

The 4 confirmed Stage 7 articles (DEN, MIA, witherspoon-v2, JSN) are all awaiting Joe's Stage 8 review. The next pipeline work should resume the normal backlog: advance the 6 REVISE articles through revision lanes, then the 12 Stage 5 articles through editor passes.
