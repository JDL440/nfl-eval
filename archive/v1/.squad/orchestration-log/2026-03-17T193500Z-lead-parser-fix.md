# Lead: Substack imageCaption Parser Fix

| Field | Value |
|-------|-------|
| **Agent routed** | Lead (Team Lead Specialist) |
| **Why chosen** | Critical infrastructure bug in Substack publisher affecting prod draft creation; Lead owns publisher integration and post-production repairs |
| **Mode** | `background` |
| **Why this mode** | Repair work is self-contained; no intermediate user approval needed |
| **Files authorized to read** | `.github/extensions/substack-publisher/extension.mjs`, `batch-publish-prod.mjs`, repair scripts, prod draft manifests |
| **File(s) agent must produce** | `extension.mjs` (imageCaption fix + validation), `batch-publish-prod.mjs` (imageCaption fix), `.squad/skills/substack-publishing/SKILL.md` (docs), `repair-prod-drafts.mjs`, validated prod draft read-backs |
| **Outcome** | **Completed.** Root cause identified and fixed. All 4 prod drafts verified repaired. Pre-publish validation added. |

---

## Work Summary

### Root Cause Discovery
The `buildCaptionedImage()` function in the Substack publisher extension was generating `captionedImage` ProseMirror nodes with only a single `image2` child. Substack's editor schema requires **two** children: `image2` + `imageCaption` (enforced by content expression `image2 imageCaption`). When affected drafts were opened in Substack's editor, it threw `RangeError: Unknown node type: imageCaption` and crashed.

### Fixes Applied

1. **`.github/extensions/substack-publisher/extension.mjs`**
   - Modified `buildCaptionedImage()` to emit both `image2` and `imageCaption` children in every `captionedImage` node
   - If caption text exists, `imageCaption` contains it; otherwise empty content array
   - Added `validateProseMirrorBody()` pre-publish validation: scans entire output doc for unknown node types against known Substack schema
   - Blocks publish if validation fails

2. **`batch-publish-prod.mjs`**
   - Applied identical `buildCaptionedImage()` fix to the duplicated function in this file

3. **`.squad/skills/substack-publishing/SKILL.md`**
   - Updated documentation with schema requirements and validator behavior
   - Documented that `captionedImage` must contain both `image2` and `imageCaption` children

4. **`repair-prod-drafts.mjs`** (one-time repair script)
   - Repaired all 4 affected prod drafts via Substack API authenticated read-back and regeneration
   - Verified each `captionedImage` structure after repair

### Prod Drafts Repaired & Verified

| Article | Draft ID | Images | Status |
|---------|----------|--------|--------|
| witherspoon-extension-v2 | 191200944 | 6 | ✅ Fixed & verified |
| jsn-extension-preview | 191200952 | 7 | ✅ Fixed & verified |
| den-2026-offseason | 191154355 | 6 | ✅ Fixed & verified |
| mia-tua-dead-cap-rebuild | 191150015 | 4 | ✅ Fixed & verified |

### Scope Check
- **Future articles:** ~20 other articles from earlier rolled-back batch will use the fixed conversion on next push (no manual repair needed)
- **Manual browser open recommended:** Drafts are editor-validated at API level but should be spot-checked in browser UI as a final safety step

### Files Changed
- `.github/extensions/substack-publisher/extension.mjs`
- `batch-publish-prod.mjs`
- `.squad/skills/substack-publishing/SKILL.md`
- `repair-prod-drafts.mjs` (temporary; can be deleted after verification)
