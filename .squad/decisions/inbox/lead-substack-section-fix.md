# Decision: Substack Section Routing Fix — `section_chosen: true`

**By:** Lead (debugging task from Joe Robinson)
**Date:** 2026-03-16
**Status:** Implemented
**Affects:** `.github/extensions/substack-publisher/extension.mjs`

## What

Fixed the Substack publisher extension's section assignment for drafts. The root cause was a missing `section_chosen: true` field in the PUT request that assigns a section to a draft.

## Changes

1. **PUT body minimized:** Changed from spreading the full draft payload (`{ ...payload, section_id, draft_section_id }`) to a minimal body with only section fields: `{ section_id, draft_section_id, section_chosen: true }`
2. **Verification GET added:** After the PUT, a GET request fetches the persisted draft to confirm `draft_section_id` and `section_chosen` were actually saved
3. **Integer coercion:** Added `parseInt` safety for `sectionId` in case upstream returns a string
4. **Output enhanced:** Extension output now shows GET verification results including `section_chosen` status

## Why

Substack's draft editor checks `section_chosen === true` before displaying a section in the UI dropdown. Without this flag, `draft_section_id` is stored but the editor treats it as unset. The old code never sent `section_chosen`, so every draft appeared to have no section despite the API confirming the ID.

## Key API Findings

| Field | At POST | After PUT | Purpose |
|-------|---------|-----------|---------|
| `section_id` | null (ignored) | null (draft-only) | Only set on published posts |
| `draft_section_id` | null (ignored) | ✅ persisted | The actual section ID for drafts |
| `section_chosen` | null (ignored) | ✅ persisted | Boolean flag — editor checks this |
| `syndicate_to_section_id` | null | null | Cross-pub syndication, not relevant |

## Verification

Test draft 191082679 (NE Patriots, section 355520) confirmed via GET: `draft_section_id: 355520, section_chosen: true`.
