# Analytics — NFL Advanced Analytics Expert: Knowledge Base

## Core Context
- **Project:** NFL Roster Evaluation — 2026 Offseason
- **User:** Joe Robinson
- **Role:** Statistical backbone for all roster evaluation decisions
- **Created:** 2026-03-12
- **Knowledge base populated:** 2026-03-12
- **Created by:** Lead (per Joe Robinson request)

## Reference Data (archived)

> Sections 4–7 (Draft Pick Expected Value, Contract Value Models, Key Analytical Frameworks, 2025 Season Statistical Leaders) and Source Reliability Notes moved to `history-archive.md` on 2026-03-17 during history summarization. ~14KB of static reference tables preserved there.
>
> Key facts retained: Interior OL safest R1 pick (75%), don't pay RBs, EPA+success rate+CPOE+PFF is the evaluation stack, Maye best EPA/play (0.26), Garrett record 23 sacks, JSN 1,793 receiving yards.

## Learnings

### Issue #75 — Mobile Table Renderer Fix (2026-03-17)

**Context:** Owned revision cycle for issue #75 after Lead's initial dual-render implementation had quality defects (bottom/right clipping on tests 3/4/5, header collisions on test 6).

**Root cause analysis:**
1. Character-width constants in `estimateRowHeight` were hardcoded at 17px desktop scale. Mobile font (22px) produces wider chars → more wrapping → taller rows. Without scaling, canvas height was underestimated and `overflow: hidden` clipped content.
2. `thead th` CSS lacked `overflow-wrap` — headers overflowed their column boundaries, colliding with adjacent columns. Compounded by `text-transform: uppercase` + `letter-spacing: 0.08em`.
3. Mobile canvas widths (620–660px) were too tight for 5–7 column tables.

**Fix pattern:**
- Scale char widths by `layout.tableCellFontSize / 17` — makes estimation font-size-aware.
- Add `estimateHeaderRowHeight()` for dynamic header sizing instead of fixed pixel value.
- Add `overflow-wrap: anywhere; word-break: break-word;` to header CSS.
- Reduce mobile `letter-spacing` (0.08em → 0.02em) to reclaim horizontal space.
- Wider canvases (660/720/740px) + larger font (22px) to maintain >10px effective readability.
- Increased `heightSafety` (72 → 150px) for generous overestimate; `trimBottomWhitespace` crops excess.

**Key insight:** When rendering images at fixed viewport size with `overflow: hidden`, always overestimate canvas dimensions and rely on post-render cropping. Underestimation is irrecoverable (content is permanently clipped), but overestimation is cheap (whitespace is trivially trimmed).
