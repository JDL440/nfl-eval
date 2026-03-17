---
updated_at: 2026-03-17T20:28Z
focus_area: Substack Notes — Phase 2 review / Phase 3 prep
---

# What We're Focused On

**Mode:** Phase 2 Note is live on nfllabstage for Joe review.

- Phase 0 ✅ — API discovery complete via browser DevTools. Cloudflare Bot Management requires Playwright `page.evaluate(fetch)` from browser context.
- Phase 1 ✅ — All three smoke test cases passed (plain text, linked draft, inline image). Notes images use `attachmentIds` after `/api/v1/comment/attachment`. All smoke Notes cleaned up.
- **Phase 3 ✅ LIVE** — `jsn-extension-preview` card-first Note is up on `nfllabstage`
  - **Stage Draft URL:** https://nfllabstage.substack.com/publish/post/191168255
  - **Note ID:** 229347247
  - **Review feed:** https://nfllabstage.substack.com/notes
  - **Review permalink:** https://substack.com/@joerobinson495999/note/c-229347247
  - **Pattern:** Card-first (short caption + article image, no body text)
  - **Caption:** "JSN at 90% below market. Our panel breaks the extension paths."
  - **Image:** `jsn-extension-preview-inline-1.png` (1408×768 chart graphic)

- **Phase 4 PREP:** After Joe approves the stage Note, proceed with production deployment
- Ralph pipeline continues in parallel as normal
