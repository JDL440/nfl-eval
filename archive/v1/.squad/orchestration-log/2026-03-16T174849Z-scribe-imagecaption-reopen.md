# Incident Kickoff — Substack imageCaption Reopened

| Field | Value |
|-------|-------|
| **Timestamp** | 2026-03-16T174849Z |
| **Incident** | Substack imageCaption schema failure — reopened |
| **Reported by** | Joe Robinson (User) |
| **Root cause** | imageCaption parser fix (2026-03-17T193500Z) did NOT resolve failure in real editor |
| **Status** | 🔴 ACTIVE — All 4 review-target drafts still fail in production editor |
| **Lead action** | Launched re-diagnosis and repair of true failure path |

---

## Incident Context

### Prior Resolution (2026-03-17)
- **What was fixed:** `buildCaptionedImage()` in `extension.mjs` and `batch-publish-prod.mjs` modified to emit both `image2` + `imageCaption` children
- **Validation added:** Pre-publish `validateProseMirrorBody()` scanner in extension.mjs
- **Prod drafts repaired (4):**
  - witherspoon-extension-v2 (draft ID 191200944)
  - jsn-extension-preview (draft ID 191200952)
  - den-2026-offseason (draft ID 191154355)
  - mia-tua-dead-cap-rebuild (draft ID 191150015)
- **Verification method:** API-level read-backs via `repair-prod-drafts.mjs`
- **⚠️ Critical limitation:** API validation passed, but was **NOT** sufficient to catch client-side editor failures

### Current State (2026-03-16)
- **User feedback:** Joe Robinson confirms all 4 review-target drafts **still fail** when opened in Substack's real editor
- **Failure visibility:** User reports popup and browser console errors (visible client-side)
- **Browser-level validation:** Is now the required success criterion — not API validation
- **Conclusion:** Previous fix was incomplete — addressed server-side structure but not client-side ProseMirror schema validation

---

## Investigation Scope

**Lead must determine:**
1. What is the **true** failure path?
   - Is the `imageCaption` child still missing after repair?
   - Is the schema validation still rejecting the structure?
   - Is there a different field or nested property failing?

2. Are there **backend vs. frontend** inconsistencies?
   - API-level validation passes, but editor-side schema fails?
   - Round-trip serialization introducing new node types?

3. **Root cause types to rule out:**
   - `imageCaption` content expression not matching actual children
   - `imageCaption` attrs or marks missing required fields
   - Nested `image2` structure still incomplete
   - Substack schema version mismatch or drift

4. **Failure scope:**
   - Only captioned images? Or all images in affected drafts?
   - Only these 4 drafts? Or does the underlying parser bug affect future publishes?

---

## Investigation Scope

**Lead must determine:**
1. What is the **true** failure path (browser-level, client-side)?
   - What exact popup and console error does the browser display?
   - Is it still `RangeError: Unknown node type: imageCaption`?
   - Or a different validation error in the ProseMirror schema?

2. Why did API validation pass but browser validation fail?
   - API-level `validateProseMirrorBody()` is insufficient
   - Substack's client-side ProseMirror validator is stricter
   - Browser console is the source of truth for success criterion

3. **Root cause types to rule out:**
   - `imageCaption` content expression still not matching actual children
   - `imageCaption` attrs or marks missing required fields
   - Nested `image2` structure still incomplete
   - Serialization round-trip introducing structural corruption
   - Client-side vs. server-side schema version mismatch

4. **Failure scope:**
   - Only captioned images? Or all images in affected drafts?
   - Only these 4 drafts? Or does the underlying parser bug affect future publishes?

---

## Success Criterion

**Browser console must show NO errors when drafts are opened in Substack editor.** The popup must not appear.
- API validation is NOT sufficient
- Visual editor must load cleanly with all images intact
- No ProseMirror schema violations
- `.github/extensions/substack-publisher/extension.mjs` (prior fix location)
- `batch-publish-prod.mjs` (prior fix location)
- `repair-prod-drafts.mjs` (one-time repair script)
- `.squad/skills/substack-publishing/SKILL.md` (prior documentation)
- Stage7 publishing workflow scripts (if relevant)
- Substack API response bodies from affected drafts (if available via Datadog/logs)

---

## Expected Deliverables
1. **Root cause report:** What the true failure is, with evidence
2. **Updated parser fix:** Modified `buildCaptionedImage()` or related code
3. **Updated validation:** Hardened pre-publish validator if needed
4. **Prod draft repair round 2:** Re-repair all 4 drafts with corrected logic
5. **Documentation update:** `.squad/skills/substack-publishing/SKILL.md` with corrected schema requirements

---

## Notes for Lead
- Do NOT assume prior fix was complete; treat this as a fresh investigation
- API-level validation success is **not** proof of editor compatibility
- Check Datadog logs for any error details in the 2026-03-17 and later drafts
- Consider reaching out to Substack publisher docs/schema if schema drift suspected
- Verify the imageCaption node type is defined in Substack's ProseMirror schema
