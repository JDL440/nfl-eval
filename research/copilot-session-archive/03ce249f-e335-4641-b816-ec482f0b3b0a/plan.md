# Table Renderer: Implement Alternatives B & C

## Goal
Build two alternative screenshot backends alongside the existing `spawnSync(chrome)` approach, then generate a comprehensive visual comparison across multiple scenarios.

## Architecture
The key insight: `buildHtml()` produces the same HTML/CSS regardless of backend. Only `renderTablePng()` (the screenshot step) changes. We'll create two new functions that accept the same `{html, width, height, outputPath}` signature:

1. **Alternative B: Playwright** — `renderTablePngPlaywright()`
2. **Alternative C: Canvas-Table** — `renderTablePngCanvas()`

Then a comparison harness renders the same table data through all 3 backends.

## Todos

### 1. install-deps
Install canvas-table + canvas (for Alt C). Playwright already in package.json but needs browser install.

### 2. playwright-backend  
Create `renderer-playwright.mjs` — async function using Playwright's Chromium to render the same HTML and screenshot the `.table-frame` element directly (no whitespace cropping needed).

### 3. canvas-backend
Create `renderer-canvas.mjs` — pure canvas-based table renderer using canvas-table/node-canvas. Must manually recreate the visual styling (colors, fonts, alternating rows, rank pills) since there's no CSS.

### 4. comparison-harness
Create `render-comparison.mjs` script that:
- Defines 4 test scenarios (simple, standard, dense, formatting-heavy)
- Renders each scenario × 3 backends × desktop + mobile = 24+ images
- Outputs to content/images/table-renderer-comparison/

### 5. update-article
Update the comparison draft.md with all rendered images organized for side-by-side review.

### 6. commit-push
Commit and push for review.
