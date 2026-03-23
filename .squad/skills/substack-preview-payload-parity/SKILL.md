---
name: Substack Preview Payload Parity
domain: publishing
confidence: high
tools: [view, rg, vitest]
---

# Substack Preview Payload Parity

## When to Use

- A local preview looks rich, but the actual Substack draft/post is missing images, subscribe widgets, or other v1 presentation elements.
- You need to determine whether a problem lives in payload construction, preview rendering, content readiness, or a mix of those.
- There are multiple rendering paths and you need to know which one actually drives `draft_body`.

## Workflow

1. Start at the publish seam in `src/dashboard/server.ts`.
   - Find the function that prepares article presentation for both preview and publish.
   - Record exactly where the draft splits into preview HTML versus Substack payload.
2. Trace the real Substack payload path.
   - Confirm what gets passed to `SubstackService.createDraft()` / `updateDraft()`.
   - Check whether `draft_body` receives HTML, ProseMirror JSON, or some transformed hybrid.
3. Trace the local preview path.
   - Inspect `src/dashboard/views/preview.ts` and any publish-page preview wrapper.
   - Separate body content rendered from the article draft from extra frame chrome added only for preview.
4. Compare payload-native elements to preview-only elements.
   - Images from markdown
   - Images from manifest/sidecar data
   - `::subscribe` / subscribe widgets
   - footer blurbs, CTA buttons, paywall/button nodes
5. Check content readiness.
   - Do the candidate drafts actually contain `::subscribe` markers or image references?
   - Do referenced files/assets exist, or are they only local-relative paths with no upload step?

## High-signal checks

1. **If preview adds images outside the article body**, those images are not necessarily in the Substack payload.
2. **If preview adds a generic subscribe CTA outside the body**, it may hide the absence of payload-native `subscribeWidget` nodes.
3. **If `SubstackService.uploadImage()` exists but is unused in draft creation**, local image references are likely not publishable yet.
4. **If preview uses `proseMirrorToHtml()` but publish sends raw ProseMirror JSON**, an HTML-parity check alone is misleading.
5. **If the preview renderer lacks explicit cases for payload-native node types**, the preview cannot be trusted as a one-to-one validation tool.

## Current seam map

- `src/dashboard/server.ts:262-317` builds both `htmlBody` and `substackBody`.
- `src/dashboard/views/publish.ts:90-92` renders preview HTML from `proseMirrorToHtml(doc)`.
- `src/dashboard/views/preview.ts:89-151` adds cover/inline image chrome, subscribe CTA, and footer copy.
- `src/services/substack.ts:135-173` sends `draft_body` to Substack; image upload is a separate helper, not part of draft creation/update.

## Recommendation

For this repo, treat the Substack payload as the source of truth and the preview as a diagnostic surface. First make sure publish-critical elements are present in `substackBody`; then tune the preview so it reflects that payload faithfully instead of compensating with local-only presentation.
