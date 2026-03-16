# Decision: Gemini 3 Pro Image as Default Image Generator

**Date:** 2026-03-17
**Author:** Lead
**Scope:** Image generation pipeline (all future articles)

---

## Context

The `generate_article_images` extension previously defaulted to Imagen 4 Ultra (`use_model: "auto"` → try Imagen 4 first, fall back to Gemini Flash). During a v2 image regeneration for MIA and DEN articles, Joe reviewed both model outputs side-by-side and preferred the Gemini 3 Pro Image variants for editorial quality.

## Decision

Changed the default image model from `"auto"` (Imagen 4 primary) to `"gemini"` (Gemini 3 Pro Image primary) in `.github/extensions/gemini-imagegen/extension.mjs`.

### Model options after this change:
| `use_model` | Behavior |
|-------------|----------|
| `"gemini"` (new default) | Uses Gemini 3 Pro Image directly |
| `"auto"` | Tries Gemini first, falls back to Imagen 4 |
| `"imagen-4"` | Uses Imagen 4 Ultra directly |

### Image cleanup:
- Promoted 4 approved Gemini variants to canonical `-inline-{1,2}.png` filenames
- Deleted 8 superseded image variants (`-v2.png` and `-v2-gemini.png` for both articles)
- Updated both Substack prod drafts in-place with the new images

## Rationale

- Joe's direct preference after side-by-side comparison
- Gemini produces better atmospheric/editorial images for this workflow's style guide (abstract, no faces/likenesses, team-color tones)
- Imagen 4 remains available via explicit `use_model: "imagen-4"` for cases where photorealistic output is preferred

## Impact

All future `generate_article_images` calls will use Gemini 3 Pro Image unless explicitly overridden. No existing published articles are affected — only the two Stage 7 drafts (MIA, DEN) were updated.
