---
updated_at: 2026-03-18T00:00Z
focus_area: Stage 7 teasers disabled. Promotion Notes for published articles remain active. Sweep tracks MISSING_PROMOTION and STALE_PROMOTION only.
---

# What We're Focused On

**Mode:** Notes cadence — teasers disabled, promotion-note flow active.

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

- **Stage 7 teasers DISABLED (2026-03-18):** Per Joe's directive, teaser Notes are deprioritized. `MISSING_TEASER` removed from `notes-sweep`. `post-stage-teaser.mjs` deprecated. Live stage teaser c-229449096 confirmed deleted (GET → 404). Promotion Notes for published articles remain fully active.
- **Phase 6 NEXT:** Post-publish promotion Notes — after an article is published, surface that a Note can be posted (optional, not enforced)
- Ralph pipeline continues in parallel as normal
