# Session Log: Notes Phase 0 — Dry-run Success, Live 403, Docs Rollback

**Date:** 2026-03-17 | **Time:** 05:35 UTC | **Session ID:** scribe-notes-phase0-403
**Owner:** Joe Robinson / Lead (GM Analyst)
**Focus:** Substack Notes API validation — Phase 0 completion assessment

---

## Executive Summary

The Notes API endpoint candidate (`POST https://substack.com/api/v1/comment/feed`) from `postcli/substack` open-source library passed dry-run validation but failed live smoke testing with HTTP 403. No Note was posted. The shortcut approach to skip browser DevTools capture has been reverted; manual capture is now the required unblock.

---

## Test Execution

### Dry-Run (validate-notes-smoke.mjs --dry-run)
**Status:** ✅ PASSED
- Body construction valid
- Payload shape matches ProseMirror schema
- No syntax or serialization errors

### Live Smoke Test (validate-notes-smoke.mjs, no --dry-run)
**Status:** ❌ FAILED
**Timestamp:** 2026-03-17T05:30:00Z

```
Script:    node validate-notes-smoke.mjs
Target:    https://nfllabstage.substack.com
Auth:      ✅ PASSED — authenticated as Joe Robinson
           (profile lookup succeeded; cookies valid for publication subdomain)
Endpoint:  https://substack.com/api/v1/comment/feed
POST:      ❌ HTTP 403
Response:  HTML error page (not JSON error)
Result:    No Note was posted
```

---

## Key Findings

1. **Auth validation worked** — The smoke test successfully authenticated as Joe Robinson and verified subdomain access.
2. **Endpoint candidate failed** — The global `substack.com/api/v1/comment/feed` endpoint returned 403 when POSTed via Node `fetch()`.
3. **Browser difference** — The 403 strongly indicates that the browser sends additional request context our server-side replay does not include. Most likely candidates:
   - CSRF token (validation in `<meta>` tag or prior GET response)
   - `Origin` / `Referer` validation stricter than headers indicate
   - Cookie scope issues (cookies from `nfllabstage.substack.com` may not be valid on global `substack.com`)
   - Endpoint moved or deprecated since `postcli/substack` was last updated

---

## Decisions Recorded

### Decision 1: Open-Source Shortcut Did Not Work
**Decision:** Accept that the `postcli/substack` discovery narrowed the search but does not replace manual capture.
**Impact:** Reverts the claimed "Phase 0 shortcut" from `lead-notes-api-discovery.md`.

### Decision 2: Re-gate createSubstackNote()
**Status:** IMPLEMENTED
**Changes:**
- Restored unconditional `throw` in `extension.mjs` (`createSubstackNote()`)
- Updated `validate-notes-smoke.mjs` help text to reflect "browser capture required" state
- Removed premature "no manual capture needed" claim from docs

### Decision 3: Reinstate Browser DevTools Capture as Hard Gate
**Status:** ACTIVE
**Next Owner:** Joe Robinson
**Target:** nfllabstage.substack.com/notes
**Deliverable:** Captured POST request headers, body, response, and status code from browser DevTools
**Key focus items:**
- CSRF token (if present) + where browser sourced it
- Exact cookie string to `substack.com` (not just subdomain cookies)
- Any `X-Substack-*` headers
- Confirm endpoint path is still `/api/v1/comment/feed` or if browser uses different URL

---

## Documentation Changes

**Files Reverted:**
- `docs/notes-api-discovery.md` — corrected back to "Live Test Results: HTTP 403" and "browser capture required"
- `docs/substack-notes-feature-design.md` — no changes (remains valid)

**Files Updated:**
- `validate-notes-smoke.mjs` — help text updated to clarify live smoke test will fail until capture is done
- `extension.mjs` — `createSubstackNote()` re-gated with clear error message

**Files Created:**
- `.squad/orchestration-log/2026-03-17T053520Z-scribe-notes-phase0.md` — this orchestration entry
- `.squad/log/2026-03-17T053520Z-notes-phase0-follow-up.md` — this session log

---

## Decisions Merged to .squad/decisions.md

1. **lead-notes-plan.md** — Substack Notes Feature — Architecture & Rollout (Phase 0 design decision)
2. **lead-notes-api-discovery.md** — Notes API Endpoint Discovery (endpoint candidate found, but live test failed — decision to proceed with capture still valid)
3. **lead-notes-403-regate.md** — Re-gate Notes POST After Live 403 (decision to re-gate and reinstate browser capture as hard unblock)

---

## Cross-Agent Context Updates

### Scribe History
- Added entry documenting Notes Phase 0 dry-run/live test split outcome
- Recorded decision merge and documentation rollback

### Lead History (if applicable)
- Decision to reinstate browser capture acknowledged
- 403 failure diagnosis recorded for reference

---

## Current State

**Notes API Phase 0 Status:** ⏳ BLOCKED awaiting browser capture
- **What works:** Dry-run validation, payload construction, auth cookies
- **What's blocked:** Live 403 response from `substack.com` global endpoint
- **What's required:** Manual DevTools capture in browser to reveal missing request context
- **Timeline:** Phase 1 ungating depends on Phase 0 completion (capture + validation)

**Product Code Impact:** NONE
- Only documentation, orchestration logs, and decision tracking were modified
- `extension.mjs` and `validate-notes-smoke.mjs` re-gated (no functional change to workflow)

---

## Next Steps

1. **Joe Robinson:** Perform browser DevTools capture per `docs/notes-api-discovery.md` step-by-step guide
2. **Record:** Paste captured headers, body, and response into `docs/notes-api-discovery.md` "Captured Data" section
3. **Update:** Modify `.env` if any values differ from current (`NOTES_ENDPOINT_PATH`, etc.)
4. **Re-test:** Run `node validate-notes-smoke.mjs` (no --dry-run) and confirm success (HTTP 200)
5. **Delete:** Remove test Note from nfllabstage.substack.com/notes
6. **Proceed:** Lead can ungat `createSubstackNote()` and resume Phase 1 implementation

---

**Logged by:** Scribe (Session Logger)
**Timestamp:** 2026-03-17T05:35:20Z
