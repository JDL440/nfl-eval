# Decision: Prod-Default Publishing

**Date:** 2025-07-25
**Decided by:** Lead, at Joe Robinson's direction
**Status:** ACCEPTED

## Context

The Chiefs / Fields trade evaluation article was published to nfllabstage instead of nfllab (prod). Joe directed: "Please send these drafts directly to prod unless we are deploying to test new functionality like the table."

The original stage-first workflow was designed as a safety measure during early pipeline development when the publisher extension was still being validated. Now that the extension is stable and validated across 20+ articles, the extra stage hop adds friction without meaningful safety benefit for normal articles.

## Decision

**Normal article drafts go directly to prod by default.** Stage is preserved as an explicit opt-in for testing new functionality.

### What changed

1. **Extension default** (`extension.mjs` line 1370): `args.target || "prod"` (was `"stage"`)
2. **Extension tool description**: Updated to reflect prod-first default
3. **Publisher skill** (`SKILL.md` Step 5): Stage-first → Prod-first
4. **Substack-publishing skill** (`SKILL.md`): Stage-First Workflow → Prod-First Workflow
5. **batch-publish-prod.mjs**: No change needed (already requires explicit mode arg)

### How to request stage/testing

Pass `target: "stage"` explicitly to `publish_to_substack()`, or run `node batch-publish-prod.mjs stage <slug>`.

Use stage when:
- Testing changes to the publisher extension itself
- Validating new table/image rendering approaches
- Testing mobile layout changes
- Any time you're deploying new publishing functionality and want a preview before prod

### Safety preserved

- Published-article guard (Stage 8 / published articles are still blocked)
- ProseMirror validation gate still fires before any draft creation
- Hero-safe image check still runs
- Dense table blocker still fires
- DB writeback is still required after every publish
