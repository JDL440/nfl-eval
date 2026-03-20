# Orchestration Log: Lead — Unblock witherspoon-extension-v2 & JSN for Safe Prod Drafts

**Timestamp:** 2026-03-17T00:24:54Z  
**Agent:** Lead  
**Task:** Unblock witherspoon-extension-v2 and jsn-extension-preview for safe production drafts  
**Requested by:** Joe Robinson  
**Mode:** sync

---

## Summary

Completed unblock pass for two safe Stage 7 → Stage 8 (prod draft) candidates. Fixed three critical bugs in `content/article_board.py`, applied publisher passes, and promoted both articles to production Substack. Both now awaiting Joe's Stage 8 review.

**Outcome:** ✅ **COMPLETED**

---

## Blockers Resolved

### 1. **`article_board.py` Editor Verdict Sort Bug**
- **Problem:** `_parse_editor_verdict()` sorted editor-review files by ASCII, causing `editor-review.md` (original REVISE) to sort above `editor-review-3.md` (latest APPROVED) for JSN.
- **Impact:** JSN was incorrectly marked as REVISE when it should have been APPROVED.
- **Fix:** Extract numeric suffix from filenames and sort by numeric value (fallback to 0 for base `editor-review.md`).

### 2. **`article_board.py` Image Count Bug**
- **Problem:** `_count_images()` only checked the article directory, missing images in `content/images/{slug}/` where generated images actually live.
- **Impact:** witherspoon-extension-v2 and jsn-extension-preview showed 0 images (should be 6+ each).
- **Fix:** Check both `content/articles/{slug}/` and `content/images/{slug}/` directories.

### 3. **Missing `_expected_status_for_stage()` Helper**
- **Problem:** Called in `reconcile()` repair mode but never defined, causing runtime error.
- **Impact:** Repair mode would fail when called.
- **Fix:** Added helper function to return expected DB status for each pipeline stage (DRAFT/STAGED/PRODUCTION).

---

## Production Promotion Results

| Article | Prod Draft URL | Status |
|---------|---|---|
| witherspoon-extension-v2 | https://nfllab.substack.com/publish/post/191200944 | ✅ Promoted |
| jsn-extension-preview | https://nfllab.substack.com/publish/post/191200952 | ✅ Promoted |

---

## Execution Details

| Field | Value |
|---|---|
| **article_board.py bugs fixed** | 3 |
| **Articles processed** | 2 |
| **Publisher passes created** | 2 |
| **Database repair operations** | 2 |
| **Prod Substack publishes** | 2 |
| **Prod draft URLs persisted** | 2 |
| **Failures** | 0 |

---

## Files Modified

- `content/article_board.py`: Fixed `_parse_editor_verdict()`, `_count_images()`, added `_expected_status_for_stage()`
- `content/articles/witherspoon-extension-v2/publisher-pass.md`: Created
- `content/articles/jsn-extension-preview/publisher-pass.md`: Created
- `pipeline.db`: Updated with prod draft URLs for both articles

---

## Known Cleanup Item

The earlier overbroad Stage 7 prod push created ~39 orphan drafts on nfllab.substack.com. These two new prod drafts are **separate** (not updates to orphans). The orphans remain invisible and non-destructive but should be bulk-deleted from the Substack dashboard when convenient.

---

## Next Steps

1. Joe reviews both articles in Stage 8 (final approval before publish)
2. Resume normal backlog: advance 6 REVISE articles through revision lanes
3. Schedule Editor passes for 12 Stage 5 articles
4. Optional dashboard cleanup: Delete ~39 orphan drafts from nfllab.substack.com

---

## Related Artifacts

- Decision file: `.squad/decisions/inbox/lead-witherspoon-jsn.md`
- Parent session: Lead — Assess & Complete Extension Candidates (2026-03-17T00:16:17Z)
