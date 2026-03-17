---
updated_at: 2026-03-17T13:24Z
focus_area: Substack Notes — Phase 2 (jsn-extension-preview on nfflabstage)
---

# What We're Focused On

**Mode:** Substack Notes Phase 2 execution.

- Phase 0 ✅ — API discovery complete via browser DevTools. Cloudflare Bot Management requires Playwright `page.evaluate(fetch)` from browser context.
- Phase 1 ✅ — All three smoke test cases passed (plain text, linked draft, inline image). Notes use payload-level `attachments` for images. All smoke Notes cleaned up.
- **Phase 2 READY** — Target: `jsn-extension-preview` (Jaxon Smith-Njigba Extension)
  - **Why:** Highest production value (9 images, 4-path expert panel), structured narrative ideal for promotion teaser
  - **Stage:** 7 (Publisher Pass complete)
  - **Stage Draft URL:** https://nfllabstage.substack.com/publish/post/191168255
  - **Execution:** Post teaser Note + inline image to nfflabstage, validate, delete before Phase 3
  - **Caveat:** Stage draft URL will be overwritten when article goes to prod; need separate DB column

- **Phase 3:** Production rollout (after jsn publishes to nfllab)
- Ralph pipeline continues in parallel as normal
