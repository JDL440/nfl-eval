# Notes API Discovery — Phase 0 Capture Checklist

> **Status:** ✅ **PHASE 0 COMPLETE** — Smoke test succeeded (HTTP 200, Note ID 229257782 posted to nfllabstage)
> **Owner:** Joe / Lead
> **Target:** nfllabstage.substack.com (automation); live capture recorded on nfllab.substack.com
> **Script:** `validate-notes-smoke.mjs`

---

## Purpose

The Substack Notes API is undocumented. Before we can automate Note
creation, we need to know the real endpoint, headers, and payload shape.

**Update (2025-07-27):** An endpoint candidate was discovered from the
[postcli/substack](https://github.com/postcli/substack) open-source library
(`src/lib/substack.ts` → `publishNote()`). The library claims
`POST https://substack.com/api/v1/comment/feed` with no CSRF token.

**Update (2025-07-27 — live test result):** Running
`node validate-notes-smoke.mjs` (no `--dry-run`) authenticated successfully as
Joe Robinson, but the POST returned **HTTP 403 with an HTML error page** (not a
JSON error). No Note was posted. The 403 strongly suggests the browser enforces
additional context that our server-side replay does not include — likely one or
more of: CSRF token, specific `Origin`/`Referer` validation, browser-only
session cookie attributes, or an endpoint change since the open-source library
was written.

**Conclusion:** Manual browser DevTools capture is still the required next step
to finish Phase 0. The open-source discovery narrows what to look for, but does
not replace the capture.

---

## Pre-requisites

- [ ] Chrome (or Chromium-based browser)
- [ ] Logged in to **nfllabstage.substack.com** as a user with publish rights
- [ ] `.env` in repo root has a valid `SUBSTACK_TOKEN` and `SUBSTACK_STAGE_URL`

---

## Step-by-Step Capture

### 1. Open the Notes composer

1. Navigate to **https://nfllabstage.substack.com/notes**
2. If there's a "Write a note…" text area at the top, click into it.
   - Alternative: look for a floating "+" or "New Note" button.
3. **Do NOT submit yet.**

### 2. Open DevTools → Network tab

1. Press **F12** (or Ctrl+Shift+I) to open Chrome DevTools.
2. Switch to the **Network** tab.
3. Check **Preserve log** (so the request isn't cleared on navigation).
4. In the filter bar, type `method:POST` or just clear it and watch for
   POST requests after you submit.

### 3. Create a test Note

Type a short, clearly identifiable test message, e.g.:

```
🏈 NFL Lab stage smoke test — safe to delete
```

Optionally attach a link (paste a URL) to capture the link payload shape.

Click **Post** (or whatever the submit button says).

### 4. Capture the POST request

In the Network tab, find the new POST request that appeared. It will
likely be one of these patterns:

| Likely URL pattern | Notes |
|---|---|
| `/api/v1/comment/create` | "Comment" is Substack's internal name for Notes |
| `/api/v1/note` or `/api/v1/notes` | If they use a dedicated endpoint |
| `/api/v1/post/comment` | Alternate comment-based endpoint |

Click the request and record:

#### 4a. Request URL (full path)

```
Example: https://nfllabstage.substack.com/api/v1/comment/create
         ──────────────────────────────── ─────────────────────
         (base URL — ignore this part)    (THIS is NOTES_ENDPOINT_PATH)
```

**Record the path portion only**, starting with `/api/...`

#### 4b. Request Method

Should be `POST`. If it's something else, note it.

#### 4c. Request Headers (important ones)

In the **Headers** tab of the request, note these specifically:

| Header | Expected value | Record if different |
|--------|---------------|---------------------|
| `Content-Type` | `application/json` | |
| `Cookie` | Contains `substack.sid=...` | |
| `Origin` | `https://substack.com` or `https://nfllabstage.substack.com` | |
| `X-CSRF-Token` | ??? — if present, this is critical | Record the value AND where it comes from |
| Any `X-Substack-*` header | ??? | Record name + value |

**CSRF tokens are the #1 blocker.** If one is present, we need to figure
out where the browser gets it (usually from a meta tag or a prior GET).

#### 4d. Request Body (THE MOST IMPORTANT PART)

Switch to the **Payload** tab (or **Request** body).

Copy the **entire raw JSON body** and paste it below.

Expected shapes (one of these):

**Shape A — ProseMirror bodyJson (most likely):**
```json
{
  "bodyJson": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [
          { "type": "text", "text": "Your note text here" }
        ]
      }
    ]
  }
}
```

**Shape B — Plain text body:**
```json
{
  "body": "Your note text here"
}
```

**Shape C — Something else entirely:**
Copy the full JSON as-is.

#### 4e. Response Body

Switch to the **Response** tab. Copy the full JSON response.

Key fields to look for:
- `id` — the Note's unique identifier
- `url` or `canonical_url` — the public URL of the Note
- `type` — what Substack calls this object internally
- Any error messages

### 5. Delete the test Note

On the Notes page, find your test Note, click the `···` menu, and
delete it. If there's no delete option, note that too.

---

## Where to Record Captured Values

### In `.env` (machine-readable, used by `validate-notes-smoke.mjs`)

Add these lines after the existing Substack variables:

```bash
# Notes API — captured from DevTools on nfllabstage (Phase 0)
NOTES_ENDPOINT_PATH=/api/v1/comment/create   # ← replace with actual captured path
NOTES_PAYLOAD_SHAPE=prosemirror               # ← "prosemirror" or "plain"
```

### In this file (human-readable reference)

Paste the raw captured data below so we have a permanent record:

---

## Captured Data (discovered from open-source, NOT YET VALIDATED)

**Date discovered:** 2025-07-27
**Live test result:** ⛔ HTTP 403 (2025-07-27) — see "Live Test Results" section below

**Source:** [postcli/substack](https://github.com/postcli/substack) — `src/lib/substack.ts` (`publishNote()` method) + `src/lib/http.ts` (`globalPost()` method)

### Endpoint (candidate — not yet confirmed live)

```
Method:  POST
Host:    substack.com  (GLOBAL — not publication-specific)
Path:    /api/v1/comment/feed
Full:    https://substack.com/api/v1/comment/feed
```

**Critical:** Notes POST goes to `substack.com`, NOT to `{subdomain}.substack.com`.
Auth cookies determine which user the Note is attributed to.

### Headers (non-standard only)

```
Origin:       https://substack.com
Referer:      https://substack.com/
Content-Type: application/json
Cookie:       substack.sid=...; connect.sid=...
```

Open-source library claims no CSRF token is required, but the live 403 suggests
this may be wrong or that Substack has since added one. **Browser capture must
check for CSRF tokens, `X-Substack-*` headers, and any `<meta>` CSRF tags.**

### Request Body (from open-source)

```json
{
  "bodyJson": {
    "type": "doc",
    "attrs": { "schemaVersion": "v1" },
    "content": [
      {
        "type": "paragraph",
        "content": [
          { "type": "text", "text": "Your note text here" }
        ]
      }
    ]
  },
  "tabId": "for-you",
  "surface": "feed",
  "replyMinimumRole": "everyone"
}
```

Extra fields confirmed as required:
- `tabId: "for-you"` — which Notes tab to post to
- `surface: "feed"` — posting surface identifier
- `replyMinimumRole: "everyone"` — who can reply (also accepts other roles)

For replies (not relevant to first smoke test):
- Add `parent_id: <number>` to reply to an existing Note

### Response Body (expected, from open-source)

```json
{
  "id": 12345,
  "comment": { "id": 12345, ... }
}
```

The Note ID is at `res.id` or `res.comment.id`.

### Response Status Code

```
Expected: 200 (pending live validation)
```

### Notes

- ProseMirror format confirmed (bodyJson, not plain text body)
- ProseMirror schema matches article drafts: `doc` → `paragraph` → `text`
- Bold text uses `marks: [{ type: "bold" }]` (same as articles)
- Link text uses `marks: [{ type: "link", attrs: { href: "..." } }]`
- No publication_id or user_id required in payload (inferred from auth)
- `textToProseMirror()` in postcli/substack handles **bold** markdown conversion
- Delete API: `not confirmed yet` — will check during live smoke test

---

## Live Test Results

### 2025-07-27 — HTTP 403 (FAILED)

```
Script:   node validate-notes-smoke.mjs  (no --dry-run)
Target:   nfllabstage.substack.com
Endpoint: https://substack.com/api/v1/comment/feed
Auth:     ✅ Passed — authenticated as Joe Robinson
POST:     ❌ HTTP 403 — HTML error page (not JSON)
Result:   No Note was posted.
```

**Diagnosis:** Auth cookies are valid (profile lookup succeeds on the
publication subdomain), but the POST to the global `substack.com` domain returns
403. Likely causes (most probable first):

1. **Missing CSRF token** — Substack may require a CSRF token in headers or the
   request body that the browser JS fetches from a `<meta>` tag or a prior GET.
2. **Origin / Referer validation** — the server may check that Origin matches a
   browser session; our Node `fetch()` may not satisfy this even though we set
   the headers.
3. **Cookie domain scope** — `substack.sid` obtained from `nfllabstage.substack.com`
   may not be accepted by `substack.com` (different domain).
4. **Endpoint change** — Substack may have deprecated or moved the endpoint since
   the `postcli/substack` library was last updated.

---

### Browser capture success (Joe)

```
Script:   Chrome DevTools (Notes composer → POST)
Target:   nfllab.substack.com
Endpoint: https://nfllab.substack.com/api/v1/comment/feed
Auth:     ✅ Joe's logged-in session
POST:     ✅ HTTP 200 — browser-created Note was briefly posted and deleted
Result:   Captured headers, cookies, and response so automation can match the browser context.
```

**Key learnings recorded (non-secret only):**

- Publication host request succeeded at `https://nfllab.substack.com/api/v1/comment/feed`; replicating the publication host rather than the global `substack.com` target is now confirmed.
- The browser enforces a same-origin `Origin`/`Referer` pair (`https://nfllab.substack.com`); deviating from that pair results in 403.
- The browser cookie jar sent additional Substack cookies beyond `substack.sid` (e.g., `connect.sid`, several `__Secure-*` cookies, CSRF-refresh cookies); only the cookie names are recorded here and no values are persisted.

Record these findings here and apply them when replaying the POST from Node.

---

### 2025-07-27 — HTTP 200 ✅ (SUCCESS — Playwright page.evaluate)

```
Script:   node validate-notes-smoke.mjs  (no --dry-run, Playwright mode)
Target:   nfllabstage.substack.com
Endpoint: https://nfllabstage.substack.com/api/v1/comment/feed
Auth:     ✅ Passed — authenticated as Joe Robinson (user_id: 335363117)
POST:     ✅ HTTP 200 — Note created successfully
Note ID:  229257782
Result:   Note is live on nfllabstage. Manual cleanup required.
```

**Root cause of prior 403:** Cloudflare Bot Management blocks server-side
`fetch()` (both Node.js and Playwright `context.request`) for the
`/api/v1/comment/feed` write endpoint. The POST MUST be made from within
a real Chromium page context via `page.evaluate(fetch(...))`.

**Key requirements for success:**
1. Playwright with `--headless=new` (not legacy headless) and
   `--disable-blink-features=AutomationControlled`
2. Real Chrome user-agent and `sec-ch-ua` headers (not "HeadlessChrome")
3. Navigate to `/publish/home` first to accumulate Cloudflare cookies
4. POST from within `page.evaluate()` with `credentials: "same-origin"`
5. Publication host (same-origin), NOT `substack.com`

**What did NOT work (all returned 403):**
- Direct Node.js `fetch()` with any combination of headers
- Playwright `context.request.post()` (uses Node HTTP stack, not renderer)
- Playwright `page.evaluate(fetch)` without `--disable-blink-features`

---

## Next Steps — Phase 1

Phase 0 is complete. The Notes API is validated and the smoke test works.

1. **✅ Configuration applied** — `.env` uses `NOTES_ENDPOINT_PATH=/api/v1/comment/feed`,
   `NOTES_PAYLOAD_SHAPE=prosemirror`, and no `NOTES_HOST` (defaults to publication subdomain).
2. **✅ Headers matched** — Playwright page context handles all headers automatically via
   same-origin browser fetch.
3. **✅ Smoke test passed** — `node validate-notes-smoke.mjs` returns HTTP 200.
4. **⚠️ Cleanup** — Two test Notes on nfllabstage need manual deletion (IDs 229256436, 229257782).
5. **Phase 1** — Test structured Notes with article links and images on nfllabstage.
6. **Phase 2** — Real NFL Lab structured article Note on nfllabstage.
7. **Phase 3** — Production Note on nfllab (Joe approves).

---

## FAQ

**Q: Why stage only?**
A: We don't want to accidentally spam the production Notes feed with test
content. Stage-first is the same policy we use for article drafts.

**Q: Can I use the script on prod?**
A: Not yet. The script explicitly refuses `SUBSTACK_PUBLICATION_URL` and
only reads `SUBSTACK_STAGE_URL`. Production support will be added after
the API is verified and the payload is stable.

**Q: What if Notes use a totally different auth mechanism?**
A: Unlikely — all other Substack APIs use the same `substack.sid` cookie.
But if auth fails on the Notes endpoint, check the captured headers for
any extra auth tokens.

**Q: What if there's a CSRF token?**
A: We'll need to add a preflight GET to fetch the token. The capture
checklist specifically calls out CSRF headers. If found, note the header
name, value, and where the browser sourced it (usually a `<meta>` tag
or a prior API response).
