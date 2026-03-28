---
name: Substack Preview Payload Parity
domain: publishing
confidence: high
tools: [view, rg, vitest]
status: resolved
---

# Substack Preview Payload Parity

**STATUS: ✅ RESOLVED 2026-03-23** — Payload now matches preview. See implementation details below.

## Resolution

As of 2026-03-23, the Substack payload includes all elements shown in preview:

1. **Images**: `enrichSubstackBody()` uploads cover and inline images to Substack CDN and inserts them into the HTML body
2. **Subscribe CTA**: Appended automatically with caption from `config.leagueConfig.substackConfig.subscribeCaption`
3. **Publication blurb**: Footer with Lab intro and engagement prompt appended to every draft
4. **Image distribution**: `intersperseImages()` uses the same block-splitting logic as `preview.ts:intersperse()` for consistent placement

Implementation in `src/dashboard/server.ts:291-385` (`enrichSubstackBody` and `intersperseImages` functions).

## When to Use (Historical)

- A local preview looks rich, but the actual Substack draft/post is missing images, subscribe widgets, or other v1 presentation elements.
- You need to determine whether a problem lives in payload construction, preview rendering, content readiness, or a mix of those.
- There are multiple rendering paths and you need to know which one actually drives `draft_body`.

## Workflow (Historical)

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

## High-signal checks (Historical)

1. **~~If preview adds images outside the article body~~**, ✅ FIXED: Images now uploaded and added to Substack payload via `enrichSubstackBody()`.
2. **~~If preview adds a generic subscribe CTA outside the body~~**, ✅ FIXED: Subscribe CTA and footer now appended to Substack payload.
3. **~~If `SubstackService.uploadImage()` exists but is unused in draft creation~~**, ✅ FIXED: Now used during draft save in `enrichSubstackBody()`.
4. **~~If preview uses `proseMirrorToHtml()` but publish sends raw ProseMirror JSON~~**, ✅ FIXED 2026-03-23: Both preview and publish now use `proseMirrorToHtml()` consistently.
5. **If the preview renderer lacks explicit cases for payload-native node types**, the preview cannot be trusted as a one-to-one validation tool. (Still relevant for future node types)

## Current seam map

- `src/dashboard/server.ts:262-288` — `buildPublishPresentation()` converts markdown to HTML for both preview and base Substack body
- `src/dashboard/server.ts:291-385` — `enrichSubstackBody()` uploads images, intersperses them, and appends subscribe/footer
- `src/dashboard/server.ts:387-421` — `saveOrUpdateSubstackDraft()` calls enrichment before sending to Substack API
- `src/dashboard/views/preview.ts:89-151` — Preview frame adds same images/CTA for local viewing
- `src/services/substack.ts:212-235` — `SubstackService.uploadImage()` uploads to Substack CDN

## Recommendation

✅ **Resolved.** Preview and payload are now in parity. For future changes, maintain the enrichment logic in `enrichSubstackBody()` to ensure both paths receive the same content enhancements.

## Metadata parity guard

When preview and publish both show article chrome (title/deck/author line), strip the markdown H1 + italic subtitle from the packaged body before rendering or draft upload. Use `extractMetaFromMarkdown()` at the shared presentation seam, then:

- send `title` / `subtitle` through the explicit preview/Substack metadata fields
- send only `bodyMarkdown` into HTML / ProseMirror conversion
- fall back to extracted subtitle when persisted article metadata is blank, so preview and `draft_subtitle` stay aligned
