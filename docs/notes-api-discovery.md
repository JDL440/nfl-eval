# Notes API Discovery — Phase 0 Capture Checklist

> **Status:** Not started
> **Owner:** Joe / Lead
> **Target:** nfllabstage.substack.com (STAGE ONLY)
> **Script:** `validate-notes-smoke.mjs`

---

## Purpose

The Substack Notes API is undocumented. Before we can automate Note
creation, we need to capture the real endpoint, headers, and payload shape
by manually creating a Note while recording the network traffic.

This checklist walks through exactly what to capture and where to record it.

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

## Captured Data (fill in after DevTools capture)

**Date captured:** _______________

**Browser / version:** _______________

### Endpoint

```
Method:  POST
Path:    _______________
```

### Headers (non-standard only)

```
X-CSRF-Token: _______________  (if present)
Other:        _______________
```

### Request Body (raw JSON)

```json

```

### Response Body (raw JSON)

```json

```

### Response Status Code

```
_______________
```

### Notes

- Link payload shape (if you pasted a URL):
- Image upload (if you attached one — separate upload endpoint?):
- Delete API (if you found one):
- Any other observations:

---

## After Capture — Next Steps

1. **Set `.env` variables:**
   ```bash
   NOTES_ENDPOINT_PATH=/api/v1/<captured-path>
   NOTES_PAYLOAD_SHAPE=prosemirror   # or "plain"
   ```

2. **Run the smoke test in dry-run:**
   ```bash
   node validate-notes-smoke.mjs --dry-run
   ```
   Verify the ProseMirror body looks right compared to what you captured.

3. **Run the full smoke test:**
   ```bash
   node validate-notes-smoke.mjs
   ```
   This will POST to nfllabstage. Check the response.

4. **If it works:** Update this doc's status to "Captured" and open a
   PR to bring the endpoint config into the codebase properly.

5. **If it fails (4xx/5xx):**
   - Compare the payload shape to what was captured.
   - Check if a CSRF token or extra header is needed.
   - Check if the endpoint requires additional fields (e.g., `publication_id`).
   - Update `.env` and re-run.

6. **Record findings** in the captured data section above for the team.

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
