# 2026-03-17T193500Z — Substack Parser Fix & Prod Draft Repair

## Session Overview
Fixed critical imageCaption schema error in Substack publisher. Root cause: `buildCaptionedImage()` generated incomplete ProseMirror nodes missing required `imageCaption` child. Substack editor schema demands `captionedImage` contains both `image2` + `imageCaption`. Missing second child caused `RangeError: Unknown node type: imageCaption` on draft open.

## Work Completed

### 1. Root Cause Analysis
- Traced error from 4 prod drafts (witherspoon-v2, jsn-preview, den, mia) unable to open in Substack editor
- Found `buildCaptionedImage()` in extension.mjs and batch-publish-prod.mjs producing single-child nodes
- Verified Substack schema requirement via API responses and editor behavior

### 2. Fixes Implemented
- **extension.mjs:** `buildCaptionedImage()` now emits `image2` + `imageCaption` children; added pre-publish validator
- **batch-publish-prod.mjs:** Applied identical `buildCaptionedImage()` fix
- **SKILL.md:** Updated documentation with schema rules and validation approach
- **repair-prod-drafts.mjs:** Created one-time script to repair all 4 affected drafts

### 3. Prod Draft Repairs
All 4 drafts verified via authenticated API read-back:
- witherspoon-extension-v2 (191200944): 6 captioned images — ✅ Fixed
- jsn-extension-preview (191200952): 7 captioned images — ✅ Fixed
- den-2026-offseason (191154355): 6 captioned images — ✅ Fixed
- mia-tua-dead-cap-rebuild (191150015): 4 captioned images — ✅ Fixed

### 4. Scope & Safety
- ~20 older articles from rolled-back batch will auto-fix on next push
- Pre-publish validation now prevents future imageCaption schema violations
- Manual browser spot-check recommended (API validation passed; UI double-check best practice)

## Files Changed
- `.github/extensions/substack-publisher/extension.mjs`
- `batch-publish-prod.mjs`
- `.squad/skills/substack-publishing/SKILL.md`
- `repair-prod-drafts.mjs` (temporary repair script)

## Key Learnings
1. **Schema completeness matters:** Partial node structures pass database storage but fail editor instantiation. Must validate against full schema, not just presence of a node type.
2. **Dual-function risk:** `buildCaptionedImage()` duplicated in two files (extension.mjs and batch-publish-prod.mjs) — fix had to go to both. Consider consolidating to shared utility.
3. **Pre-publish validation is critical:** Added to prevent similar issues in future. Catches schema violations before they block editors.

## Next Steps
- Manual browser open of all 4 prod drafts (optional, but recommended safety check)
- Delete `repair-prod-drafts.mjs` after verification
- Monitor next batch publish for auto-fix of ~20 older articles
