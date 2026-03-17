# Decision: Mobile Dual-Render for Dense Tables (Issue #75)

**Date:** 2026-03-17
**Author:** Lead
**Status:** Implemented — awaiting human review

## Decision

Implement Alternative A (dual-render) from issue #75. Every dense/borderline table now produces two PNGs — a desktop render at existing 960–1160px widths and a mobile render at 500–660px with larger fonts. The mobile variant is embedded in article markdown by default.

## Key Parameters

| Setting | Desktop | Mobile |
|---------|---------|--------|
| Canvas width (3 cols) | 1020px | 500px |
| Canvas width (4 cols) | 960–1040px | 560px |
| Canvas width (5 cols) | 1100px | 620px |
| Canvas width (6+ cols) | 1120–1160px | 660px |
| Body font | 17px | 20px |
| Header font | 14px | 16px |

## Validation Results

- Mobile PNGs at 375px viewport: 10.4–12.3px effective font size ✅
- Desktop PNGs at 375px viewport: 5.0–5.6px effective font size ❌
- Mobile renders ~2× more readable than desktop at phone widths

## Open Items for Human Review

1. The 6–7 column mobile renders hit 10.4px effective font — borderline. On retina screens (2x DPR) this is 20.8 physical pixels, which is legible. On low-DPR Android devices it may still be tight.
2. Email rendering: mobile PNGs should display better in email clients (narrower base = less downscaling), but hasn't been tested on actual email delivery yet.
3. The boundary validation article needs to be published to nfllabstage and reviewed in the actual Substack mobile app/email.
4. Future consideration: Alternative E (text summaries) for low-complexity tables could complement this approach.

## Files Changed

- `.github/extensions/table-image-renderer/renderer-core.mjs` — core dual-render support
- `fix-dense-tables.mjs` — batch renders both variants
- `audit-tables.mjs` — MOBILE_RISK classification
- `validate-mobile-tables.mjs` — new Playwright visual validator
- `content/articles/mobile-table-boundary-validation/draft.md` — test article
