# Table Renderer Comparison: Chrome vs Playwright vs Canvas

*Side-by-side visual comparison across 6 scenarios, 3 backends, desktop + mobile*

Three rendering approaches evaluated:
- **A) Chrome spawnSync** — Current system. Headless Edge/Chrome via raw process spawn + PowerShell crop
- **B) Playwright** — Same HTML/CSS, but captured via Playwright's element screenshot API
- **C) Canvas** — Pure @napi-rs/canvas rendering. No browser, no HTML — all drawing is manual

---

## Performance Summary

| Backend | Avg Time | Browser? | CSS Support | Element Clip | Cross-Platform |
| :-- | --: | :-- | :-- | :-- | :-- |
| Chrome | 1273ms | Yes | Full | PowerShell crop | Windows only |
| Playwright | 179ms | Yes | Full | Native element | Yes |
| Canvas | 29ms | No | None | N/A | Yes |

---

## Simple (3 columns, 3 rows)

### Desktop

**Chrome** (2040×367, 1255ms):

![Simple (3 columns, 3 rows) desktop chrome](../../images/table-renderer-comparison/simple-desktop-chrome.png)

**Playwright** (2016×352, 243ms):

![Simple (3 columns, 3 rows) desktop playwright](../../images/table-renderer-comparison/simple-desktop-playwright.png)

**Canvas** (2040×436, 24ms):

![Simple (3 columns, 3 rows) desktop canvas](../../images/table-renderer-comparison/simple-desktop-canvas.png)

### Mobile

**Chrome** (1040×414, 1198ms):

![Simple (3 columns, 3 rows) mobile chrome](../../images/table-renderer-comparison/simple-mobile-chrome.png)

**Playwright** (1016×398, 171ms):

![Simple (3 columns, 3 rows) mobile playwright](../../images/table-renderer-comparison/simple-mobile-playwright.png)

**Canvas** (1040×430, 12ms):

![Simple (3 columns, 3 rows) mobile canvas](../../images/table-renderer-comparison/simple-mobile-canvas.png)

---

## Standard (5 columns, 4 rows)

### Desktop

**Chrome** (2200×456, 1282ms):

![Standard (5 columns, 4 rows) desktop chrome](../../images/table-renderer-comparison/standard-desktop-chrome.png)

**Playwright** (2176×440, 183ms):

![Standard (5 columns, 4 rows) desktop playwright](../../images/table-renderer-comparison/standard-desktop-playwright.png)

**Canvas** (2200×536, 27ms):

![Standard (5 columns, 4 rows) desktop canvas](../../images/table-renderer-comparison/standard-desktop-canvas.png)

### Mobile

**Chrome** (1360×575, 1354ms):

![Standard (5 columns, 4 rows) mobile chrome](../../images/table-renderer-comparison/standard-mobile-chrome.png)

**Playwright** (1336×560, 182ms):

![Standard (5 columns, 4 rows) mobile playwright](../../images/table-renderer-comparison/standard-mobile-playwright.png)

**Canvas** (1360×591, 21ms):

![Standard (5 columns, 4 rows) mobile canvas](../../images/table-renderer-comparison/standard-mobile-canvas.png)

---

## Dense (7 columns, 6 rows)

### Desktop

**Chrome** (2320×634, 1292ms):

![Dense (7 columns, 6 rows) desktop chrome](../../images/table-renderer-comparison/dense-desktop-chrome.png)

**Playwright** (2296×618, 184ms):

![Dense (7 columns, 6 rows) desktop playwright](../../images/table-renderer-comparison/dense-desktop-playwright.png)

**Canvas** (2320×736, 43ms):

![Dense (7 columns, 6 rows) desktop canvas](../../images/table-renderer-comparison/dense-desktop-canvas.png)

### Mobile

**Chrome** (1520×999, 1286ms):

![Dense (7 columns, 6 rows) mobile chrome](../../images/table-renderer-comparison/dense-mobile-chrome.png)

**Playwright** (1496×984, 173ms):

![Dense (7 columns, 6 rows) mobile playwright](../../images/table-renderer-comparison/dense-mobile-playwright.png)

**Canvas** (1520×853, 33ms):

![Dense (7 columns, 6 rows) mobile canvas](../../images/table-renderer-comparison/dense-mobile-canvas.png)

---

## Cap Table (salary data)

### Desktop

**Chrome** (2080×488, 1186ms):

![Cap Table (salary data) desktop chrome](../../images/table-renderer-comparison/cap-desktop-chrome.png)

**Playwright** (2056×472, 166ms):

![Cap Table (salary data) desktop playwright](../../images/table-renderer-comparison/cap-desktop-playwright.png)

**Canvas** (2200×637, 36ms):

![Cap Table (salary data) desktop canvas](../../images/table-renderer-comparison/cap-desktop-canvas.png)

### Mobile

**Chrome** (1360×835, 1457ms):

![Cap Table (salary data) mobile chrome](../../images/table-renderer-comparison/cap-mobile-chrome.png)

**Playwright** (1336×820, 180ms):

![Cap Table (salary data) mobile playwright](../../images/table-renderer-comparison/cap-mobile-playwright.png)

**Canvas** (1360×1016, 34ms):

![Cap Table (salary data) mobile canvas](../../images/table-renderer-comparison/cap-mobile-canvas.png)

---

## Draft Board (prospect eval)

### Desktop

**Chrome** (2160×376, 1162ms):

![Draft Board (prospect eval) desktop chrome](../../images/table-renderer-comparison/draft-desktop-chrome.png)

**Playwright** (2136×362, 160ms):

![Draft Board (prospect eval) desktop playwright](../../images/table-renderer-comparison/draft-desktop-playwright.png)

**Canvas** (2200×436, 31ms):

![Draft Board (prospect eval) desktop canvas](../../images/table-renderer-comparison/draft-desktop-canvas.png)

### Mobile

**Chrome** (1360×533, 1337ms):

![Draft Board (prospect eval) mobile chrome](../../images/table-renderer-comparison/draft-mobile-chrome.png)

**Playwright** (1336×518, 177ms):

![Draft Board (prospect eval) mobile playwright](../../images/table-renderer-comparison/draft-mobile-playwright.png)

**Canvas** (1360×612, 21ms):

![Draft Board (prospect eval) mobile canvas](../../images/table-renderer-comparison/draft-mobile-canvas.png)

---

## Priority List (ranked needs)

### Desktop

**Chrome** (1920×560, 1232ms):

![Priority List (ranked needs) desktop chrome](../../images/table-renderer-comparison/priority-desktop-chrome.png)

**Playwright** (1896×546, 156ms):

![Priority List (ranked needs) desktop playwright](../../images/table-renderer-comparison/priority-desktop-playwright.png)

**Canvas** (2040×636, 33ms):

![Priority List (ranked needs) desktop canvas](../../images/table-renderer-comparison/priority-desktop-canvas.png)

### Mobile

**Chrome** (1160×897, 1231ms):

![Priority List (ranked needs) mobile chrome](../../images/table-renderer-comparison/priority-mobile-chrome.png)

**Playwright** (1136×882, 170ms):

![Priority List (ranked needs) mobile playwright](../../images/table-renderer-comparison/priority-mobile-playwright.png)

**Canvas** (1360×935, 36ms):

![Priority List (ranked needs) mobile canvas](../../images/table-renderer-comparison/priority-mobile-canvas.png)

---

## Verdict

Review the images above and decide:
1. **Playwright** — Same quality as Chrome, but faster, cross-platform, no PowerShell hack
2. **Canvas** — Fastest, but visually basic (no gradients, rank pills, status chips, or rich formatting)
3. **Current (Chrome)** — Already works well, but Windows-only cropping is fragile

The HTML/CSS template system is the real asset. The screenshot backend is just a capture mechanism.
