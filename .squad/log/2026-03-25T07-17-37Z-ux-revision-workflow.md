# Session Log — Revision Workflow UX Simplification
**Timestamp:** 2026-03-25T07:17:37Z  
**Topic:** V3 revision-state UX (draft-first article detail)  
**Agent:** UX Engineer  

## Summary
UX review and implementation of revision-state simplification for V3 dashboard article detail. Made article tab default show draft artifact (requiring work) instead of discussion summary when editor sends back for revision. Updated workflow status line to clarify revision context. Tests passed (105/105), build passed.

## Key Decision
Artifact tab order: `draft.md` → `editor-review.md` → `discussion-summary.md` for focused revision workflow visibility, even when canonical stage remains 4.

## Files Touched
- article.ts (tab default + status line)
- styles.css (mobile CSS — preserved)
- server.test.ts (revision tab assertions)
- wave2.test.ts (mobile gallery — maintained)
