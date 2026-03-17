---
updated_at: 2026-03-18T02:30Z
focus_area: Substack Notes — Card rendering fix complete, stage review Notes replaced
---

# What We're Focused On

**Mode:** Phase 4 corrected — Stage review Notes replaced with proper ProseMirror link marks for article card rendering.

- Phase 0 ✅ — API discovery complete via browser DevTools. Cloudflare Bot Management requires Playwright page.evaluate(fetch) from browser context.
- Phase 1 ✅ — All three smoke test cases passed (plain text, linked draft, inline image). Notes images use attachmentIds after /api/v1/comment/attachment. All smoke Notes cleaned up.
- Phase 2 ✅ — Text-only promotion Note (229307547) posted and reviewed; identified as too long per Joe feedback. Cleaned up.
- Phase 3 ✅ — Image + caption Note posted (229347247); card NOT rendered (no published /p/ link). Root cause confirmed.
- **Phase 4 ✅ (CORRECTED) — Stage review Notes with proper link marks**
  - 5 card-first Notes on nfllabstage, each with ProseMirror link marks to production published /p/ URLs
  - Original Notes (plain text URLs, no link marks) deleted and replaced
  - New Note IDs: 229378039 (JSN), 229378074 (KC Fields), 229378102 (Denver), 229378151 (Miami), 229378200 (Witherspoon)
  - Root cause: `noteTextToProseMirror()` was creating plain text — URLs not wrapped in link marks
  - Fix: Added `parseNoteInline()` helper that auto-detects URLs and applies ProseMirror link marks
  - Joe reviewing card rendering behavior on corrected Notes

- **Phase 5 NEXT:** Based on Joe's review — if cards render → ready for production Notes workflow
- Also backfilled: `substack_url` for both Stage 8 published articles (seahawks-rb1a-target-board, witherspoon-extension-cap-vs-agent)
- Ralph pipeline continues in parallel as normal
