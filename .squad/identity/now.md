---
updated_at: 2026-03-18T06:30Z
focus_area: Substack Notes — Phase 5 complete. Article cards rendering correctly on all 5 stage Notes.
---

# What We're Focused On

**Mode:** Phase 5 complete — Stage review Notes replaced with post-type attachments for article card rendering.

- Phase 0 ✅ — API discovery complete via browser DevTools. Cloudflare Bot Management requires Playwright page.evaluate(fetch) from browser context.
- Phase 1 ✅ — All three smoke test cases passed (plain text, linked draft, inline image). Notes images use attachmentIds after /api/v1/comment/attachment. All smoke Notes cleaned up.
- Phase 2 ✅ — Text-only promotion Note (229307547) posted and reviewed; identified as too long per Joe feedback. Cleaned up.
- Phase 3 ✅ — Image + caption Note posted (229347247); card NOT rendered (no published /p/ link). Root cause confirmed.
- Phase 4 ✅ — Link marks added but did NOT produce cards. ProseMirror link marks only create clickable hyperlinks, not rich embeds.
- **Phase 5 ✅ — Article cards rendering via post-type attachments**
  - Root cause: Cards require `POST /api/v1/comment/attachment` with `{ url, type: "post" }`, then `attachmentIds` in the Note payload. Link marks alone never produce cards.
  - `extension.mjs` updated with `registerPostAttachment()` and `attachmentIds` support.
  - All 5 old Notes deleted and replaced with attachment-backed versions.
  - New Note IDs: 229384944 (JSN), 229384978 (KC Fields), 229385012 (Denver), 229385048 (Miami), 229385077 (Witherspoon)
  - All 5 verified rendering article cards (hero image + NFL Lab logo + article title).

- **Phase 6 NEXT:** Based on Joe's review — if approved → ready for production Notes workflow
- Also backfilled: `substack_url` for both Stage 8 published articles (seahawks-rb1a-target-board, witherspoon-extension-cap-vs-agent)
- Ralph pipeline continues in parallel as normal
