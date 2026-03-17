# Decision: Footer Boilerplate Rollout — War Room Brand

**Date:** 2026-07-25
**Author:** Lead
**Status:** ✅ IMPLEMENTED

---

## Decision

Joe approved **Option A** ("The War Room") from `lead-footer-copy.md` as the default article footer. This is a **forward-looking rollout** — new articles use the new footer; existing drafts are not batch-rewritten.

## New Default Footer

> *The NFL Lab is a virtual front office — specialized AI analysts who debate every angle of every move, moderated and fact-checked by a human editor. When they disagree, that disagreement is the analysis. Welcome to the War Room.*
>
> *Got a trade, signing, or draft scenario you want us to break down? Drop it in the comments.*

## Files Changed

| File | What changed |
|------|-------------|
| `.squad/skills/substack-article/SKILL.md` | Structure template boilerplate + Style Guide reference updated |
| `.squad/agents/writer/charter.md` | Boilerplate section updated to new copy |
| `.squad/skills/substack-publishing/SKILL.md` | Article file conventions example updated |
| `.squad/skills/publisher/SKILL.md` | Publisher checklist item updated |
| `.github/extensions/substack-publisher/extension.mjs` | `FOOTER_PARAGRAPH_PATTERNS` — added 3 new regex patterns for War Room brand |
| `batch-publish-prod.mjs` | `FOOTER_PARAGRAPH_PATTERNS` — same 3 new regex patterns added |

## Backward Compatibility

Old footer patterns (`"consensus view"`, `"Want us to evaluate"`, `"46-agent AI expert panel"`) are **preserved** in the detection regex arrays. Subscribe widget placement and footer detection work correctly with both old and new footer copy.

## Existing Articles

18 existing articles still use the old footer. These do **not** need manual retrofit — they are either already published (editing in Substack editor if desired) or will naturally pick up the new footer if Writer revises them through the pipeline. The old footer is not "wrong," just misaligned with the brand voice.
