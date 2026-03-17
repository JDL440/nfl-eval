# Decision: Substack Notes Article Card Rendering

**Date:** 2026-03-18
**Author:** Editor (independent revision)
**Status:** Implemented — awaiting Joe's final review

## Context

Five stage review Notes were posted with ProseMirror link marks wrapping article URLs. The expectation was that Substack would auto-resolve these into rich article cards (hero image + publication logo + title). Instead, all 5 rendered as plain hyperlinks.

## Root Cause

Substack Notes article cards are **not** generated from ProseMirror link marks. They require an explicit **post-type attachment** workflow:

1. `POST /api/v1/comment/attachment` with `{ url: "<article-url>", type: "post" }` → returns `{ id: "<uuid>", type: "post", publication: {...}, post: {...} }`
2. Include the UUID in `attachmentIds: ["<uuid>"]` in the `POST /api/v1/comment/feed` payload
3. The card is rendered server-side from the attachment metadata

### Evidence

| | Working Note (c-228989056) | Broken Note (c-229378039) |
|---|---|---|
| `attachments` array | `[{ type: "post", publication: {...}, post: {...} }]` | `[]` (empty) |
| ProseMirror body | Plain text "Check out my new post!" | Text with link marks around URL |
| Card rendered? | ✅ Yes | ❌ No |

The working Note was created through Substack's UI, which handles attachment registration transparently. Our extension was not replicating that flow.

## Decision

1. Added `registerPostAttachment(page, url)` function to `extension.mjs`
2. Updated `createSubstackNote()` to accept and pass `attachmentIds`
3. Updated the tool handler to auto-register post attachments when `linkedArticleUrl` contains a `substack.com/p/` URL
4. Replaced all 5 broken stage Notes with attachment-backed versions

## Outcome

All 5 new Notes render article cards correctly. The fix is forward-compatible — future Notes posted via the extension will automatically register post attachments when an article link is provided.

## Key Learning

The prior team's Phase 3/4 diagnosis ("link marks trigger server-side card resolution") was a hypothesis never validated against the working Note's actual API payload. The fix was only verified at the HTML level (checking for link marks in ProseMirror), not at the rendered output level. **Always compare known-good vs known-bad payloads when debugging rendering issues.**
