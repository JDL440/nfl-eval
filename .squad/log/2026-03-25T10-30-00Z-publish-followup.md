# Session Log — Publish Followup

**Date:** 2026-03-25  
**Topic:** Publish payload repair validation and social publishing fixes initiation  

## Summary

Payload/image rewrite fixes for Substack publishing completed, validated, and staged. Investigation and fixes for Note/Tweet publishing 500s initiated.

## Completed Work

### 1. ProseMirror Payload Regression Fixed
- **Problem:** User reported live articles rendered worse after switching from `JSON.stringify(doc)` to `proseMirrorToHtml(doc)`
- **Root cause:** Substack's `draft_body` API expects ProseMirror JSON document structure, not HTML strings
- **Solution:** Reverted to JSON format, refactored enrichment to operate on ProseMirror nodes instead of HTML strings
- **Impact:** Live articles will now render correctly in Substack editor and on web

### 2. Validation Complete
- Comprehensive test suite validates correct payload structure
- All 45 publish tests pass
- Stage environment verification completed
- Decision: payload implementation ready for production use

### 3. Staging Status
- DevOps orchestration log documents ready-to-commit state
- Publisher confirmed payload/image rewrite fixes staged
- Three decision inbox files merged to decisions.md (awaiting commit)

## In-Progress Work

### Note Publishing 500 Investigation (Publisher)
- Identifying root cause in Note publish route handler
- Validating Note payload structure vs Substack Notes API contract
- Expected outcome: similar fix pattern as payload regression

### Tweet Publishing 500 Investigation (Code)
- Identifying root cause in Tweet publish route handler
- Reviewing image attachment and link generation logic
- Cross-referencing with Twitter/X API expectations
- Expected outcome: targeted fix + test coverage

## Decisions Merged
1. `publisher-html-regression.md` — Root cause analysis and recommended solution
2. `publisher-prosemirror-payload-fix.md` — Implementation details and test results
3. `publisher-stage-verify-prosemirror.md` — Validation evidence and production readiness

## Next Focus
After publish payload/image repairs shipped:
- Monitor first live republish for correct Substack rendering
- Resolve Note publishing 500s (Publisher team)
- Resolve Tweet publishing 500s (Code team)
- Consider extracting ProseMirror node builders to `src/services/prosemirror.ts` for code reuse

## Team Status
- **Coordinator:** Updated todo status for `publish-note-fix` and `publish-tweet-fix` to `in_progress`
- **DevOps:** Ready to stage and commit publish payload/image fixes
- **Publisher:** Transitioning to Note publishing investigation
- **Code:** Transitioning to Tweet publishing investigation
