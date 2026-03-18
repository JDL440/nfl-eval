---
updated_at: 2026-03-18T07:15Z
focus_area: Substack Notes — Phase 5 retry complete. Fresh 5-note stage review set posted with article cards.
---

# What We're Focused On

**Mode:** Phase 5 retry — Fresh stage review Notes posted with post-type attachments for article card rendering.

- Phase 0 ✅ — API discovery complete via browser DevTools. Cloudflare Bot Management requires Playwright page.evaluate(fetch) from browser context.
- Phase 1 ✅ — All three smoke test cases passed (plain text, linked draft, inline image). Notes images use attachmentIds after /api/v1/comment/attachment. All smoke Notes cleaned up.
- Phase 2 ✅ — Text-only promotion Note (229307547) posted and reviewed; identified as too long per Joe feedback. Cleaned up.
- Phase 3 ✅ — Image + caption Note posted (229347247); card NOT rendered (no published /p/ link). Root cause confirmed.
- Phase 4 ✅ — Link marks added but did NOT produce cards. ProseMirror link marks only create clickable hyperlinks, not rich embeds.
- Phase 5 ✅ — Article cards rendering via post-type attachments (original batch).
- **Phase 5 retry ✅ — Fresh stage review set posted**
  - Previous batch (229384944–229385077) returned 404 on delete — already cleaned up.
  - Fresh batch posted with `registerPostAttachment()` + `attachmentIds`.
  - New Note IDs: 229399257 (JSN), 229399279 (KC Fields), 229399303 (Denver), 229399326 (Miami), 229399346 (Witherspoon)
  - Verified: article cards render (hero image + NFL Lab logo + article title) on c-229399257 via web fetch.
  - `pipeline.db` notes table updated with new URLs.

- **Phase 6 NEXT:** Based on Joe's review — if approved → ready for production Notes workflow
- Also backfilled: `substack_url` for both Stage 8 published articles (seahawks-rb1a-target-board, witherspoon-extension-cap-vs-agent)
- Ralph pipeline continues in parallel as normal
