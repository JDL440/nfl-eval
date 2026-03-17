# Mobile Table Rendering — Boundary Validation

Testing dual-render (desktop + mobile PNG) at various table density levels.
Each section below exercises a different column count, density tier, and template type to validate readability at 375px viewport width.

---

## Test 1: Simple 3-Column Table (OK tier — should look fine everywhere)

| Player | Position | Status |
|--------|----------|--------|
| Josh Allen | QB | Franchise |
| Stefon Diggs | WR | Traded |
| Von Miller | EDGE | Restructured |

---

## Test 2: 4-Column Priority List (Borderline tier)

![Test 2: 4-Column Priority List (Borderline tier). 5 rows and 4 columns. Columns include Priority, Position, Top Target, and more. First row: EDGE rusher.](../../images/mobile-table-boundary-validation/mobile-table-boundary-validation-test-2-4-column-priority-list-borderline-tier-mobile.png)

---

## Test 3: 5-Column Cap Comparison (Dense — triggers render)

![Test 3: 5-Column Cap Comparison (Dense — triggers render). 5 rows and 5 columns. Columns include Player, 2026 Cap Hit, Dead Cap, and more. First row: Von Miller.](../../images/mobile-table-boundary-validation/mobile-table-boundary-validation-test-3-5-column-cap-comparison-dense-triggers-render-mobile.png)

---

## Test 4: 6-Column Draft Board (High density)

![Test 4: 6-Column Draft Board (High density). 7 rows and 6 columns. Columns include Pick, Round, Player, and more. First row: 28.](../../images/mobile-table-boundary-validation/mobile-table-boundary-validation-test-4-6-column-draft-board-high-density-mobile.png)

---

## Test 5: 7-Column Dense Financial Table (Maximum density)

![Test 5: 7-Column Dense Financial Table (Maximum density). 6 rows and 7 columns. Columns include Player, Position, 2025 Base, and more. First row: Josh Allen.](../../images/mobile-table-boundary-validation/mobile-table-boundary-validation-test-5-7-column-dense-financial-table-maximum-density-mobile.png)

---

## Test 6: 4-Column with Long Cell Content (Notes column stress test)

![Test 6: 4-Column with Long Cell Content (Notes column stress test). 4 rows and 4 columns. Columns include Scenario, Probability, Cap Impact, and more. First row: Cut Von Miller post-June 1.](../../images/mobile-table-boundary-validation/mobile-table-boundary-validation-test-6-4-column-with-long-cell-content-notes-column-stress-t-mobile.png)

---

## Test 7: 2-Column Label-Value Table (Should always inline — control case)

| Metric | Value |
|--------|-------|
| 2026 Cap Space | $23.5M |
| Dead Cap Committed | $47.2M |
| Players Under Contract | 48 |
| Draft Picks | 8 |
| UFA Count | 14 |

---

## Test 8: 5-Column Comparison with Mixed Content

| Category | Bills (BUF) | Dolphins (MIA) | Jets (NYJ) | Patriots (NE) |
|----------|------------|----------------|------------|---------------|
| 2026 Cap Space | $23.5M | $15.2M | $8.7M | $95.3M |
| QB Situation | Allen locked in | Tua injury risk | Rodgers gone | Rebuilding |
| Draft Capital | 8 picks | 7 picks | 6 picks | 11 picks |
| Window Status | Open now | Closing | Closed | Reset |
| Key FA Need | EDGE, WR2 | OL, LB | Everything | QB of future |

This table is useful for visual testing because the mixed text/number content creates uneven cell widths that challenge mobile readability.
