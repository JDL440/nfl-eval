---
updated_at: 2025-07-27
focus_area: Substack Notes — Phase 0 blocked by 403, browser capture required
---

# What We're Focused On

**Mode:** Substack Notes Phase 0 — browser DevTools capture required (live POST returned 403).

- Notes API endpoint candidate: `POST https://substack.com/api/v1/comment/feed` (from postcli/substack open-source)
- `createSubstackNote()` was ungated for live test — authenticated as Joe Robinson, but POST returned **HTTP 403**
- **No Note was posted.** The 403 means server-side replay is missing something the browser provides.
- **Blocker:** Joe needs to do a browser DevTools capture — manually post a Note on nfllabstage, intercept the request, and record the full headers/cookies/payload
- Key values to capture: CSRF tokens, `X-Substack-*` headers, exact cookie string sent to `substack.com`, response status
- Capture checklist: `docs/notes-api-discovery.md`
- After capture: update `.env`, re-run `node validate-notes-smoke.mjs`, then Phase 1 is unblocked
- Ralph pipeline + article production continues in parallel as normal
