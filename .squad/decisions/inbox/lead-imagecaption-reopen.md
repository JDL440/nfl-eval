### 2026-03-17: imageCaption Node Type — Re-opened & True Root Cause Found
**By:** Lead (Team Lead Specialist)
**Status:** EXECUTED
**Affects:** substack-publisher extension, batch-publish-prod.mjs, repair-prod-drafts.mjs, all 4 prod drafts

**Prior Fix (INSUFFICIENT):**
The earlier fix added an `imageCaption` child node inside `captionedImage`. This passed API read-back verification but DID NOT fix the editor — all 4 drafts still threw `RangeError: Unknown node type: imageCaption` in the browser.

**True Root Cause:**
Substack's ProseMirror editor does NOT have a node type called `imageCaption`. The correct node type name is **`caption`**. Per the canonical Substack document format (verified against `can3p/substack-api-notes`), the correct structure is:

```json
{
  "type": "captionedImage",
  "content": [
    { "type": "image2", "attrs": { ... } },
    { "type": "caption", "content": [{ "type": "text", "text": "..." }] }
  ]
}
```

Our code was generating `"type": "imageCaption"` — a node type that doesn't exist in Substack's schema. The API accepted the payload (Substack's API does not validate ProseMirror schema), but the editor rejected it at load time.

**Why Prior Verification Failed:**
API read-back only confirms that the JSON was stored. It does NOT validate that the editor can render it. The ProseMirror schema is enforced only in the browser editor (Tiptap-based), not by the REST API.

**Fix Applied:**
1. **`.github/extensions/substack-publisher/extension.mjs`** — Changed `"imageCaption"` → `"caption"` in `buildCaptionedImage()`. Updated `KNOWN_SUBSTACK_NODE_TYPES` to include `caption` instead of `imageCaption`. Added structural validation that checks `captionedImage` has exactly `[image2, caption]` children.
2. **`batch-publish-prod.mjs`** — Same `"imageCaption"` → `"caption"` fix.
3. **`repair-prod-drafts.mjs`** — Same fix + ran live to re-push all 4 drafts.
4. **`.squad/skills/substack-publishing/SKILL.md`** — Updated docs.

**Prod Drafts Repaired:**
| Article | Draft ID | Images | Status |
|---------|----------|--------|--------|
| witherspoon-extension-v2 | 191200944 | 6 | ✅ Re-pushed with `caption` |
| jsn-extension-preview | 191200952 | 7 | ✅ Re-pushed with `caption` |
| den-2026-offseason | 191154355 | 6 | ✅ Re-pushed with `caption` |
| mia-tua-dead-cap-rebuild | 191150015 | 4 | ✅ Re-pushed with `caption` |

**Validation Gap:**
API read-back is NOT sufficient to predict editor compatibility. The strongest safe substitute now in place is:
- Pre-publish validation that checks all node types against known Substack schema
- Structural validation that verifies `captionedImage` children are exactly `[image2, caption]`
- Full browser-based validation would require Puppeteer/Playwright with authenticated cookies, which is not currently feasible without persisting secrets

**Manual Follow-Up:**
Joe should open each of the 4 draft URLs in the Substack editor to confirm they load cleanly:
- https://nfllab.substack.com/publish/post/191200944
- https://nfllab.substack.com/publish/post/191200952
- https://nfllab.substack.com/publish/post/191154355
- https://nfllab.substack.com/publish/post/191150015

**Key Learning:** API acceptance ≠ editor compatibility. Node type names must match Substack's exact schema — `"caption"` not `"imageCaption"`. Always cross-reference against documented Substack format (`can3p/substack-api-notes`) when generating ProseMirror JSON.
