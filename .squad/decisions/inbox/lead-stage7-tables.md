# Decision: Dense Table Cleanup Moves Earlier in Pipeline

**Date:** 2025-07-25
**By:** Lead (Lead / GM Analyst)
**Status:** Implemented
**Affects:** All articles, Writer skill, Editor skill, Publisher Pass, Ralph workflow

## Context

Dense markdown tables (financial comparisons, multi-column cap data) were only caught at publish time by the Substack publisher's density classifier. This caused two problems:

1. **Dense tables blocked publishing** — `publish_to_substack` throws an error, requiring manual intervention
2. **No local preview** — simple tables that pass the density check get silently converted to bullet lists on Substack, with no way to see the result before publishing

## Decision

Table density auditing and remediation now happen **before Stage 7 publish**, not during it.

### New Pipeline Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `node audit-tables.mjs` | Classify all tables in Stage 7 drafts | Before any publish attempt. Also useful at Editor stage. |
| `node fix-dense-tables.mjs` | Batch-render all blocked tables to PNG | After audit shows blocked tables. Can run `--dry-run` first. |
| `node audit-tables.mjs --slug {slug}` | Single-article audit | During writing/editing to check a specific draft |

### Classification Tiers

- **✅ OK** (density < 5.5): Will inline as bullet/ordered list — acceptable for simple label-value or short tables
- **⚠️ Borderline** (density 5.5–7.4): Will inline but may look rough — consider pre-rendering for editorial quality
- **🚫 Blocked** (density ≥ 7.5): **Must** be rendered to PNG before publishing — `fix-dense-tables.mjs` handles this automatically

### Where Table Cleanup Belongs

1. **Writer (Stage 5):** Use `render_table_image` for any dense table during drafting
2. **Editor (Stage 6):** Run `audit-tables.mjs --slug {slug}` to flag remaining dense tables
3. **Pre-Publish (Stage 7):** Run `fix-dense-tables.mjs` as a batch safety net before calling `publish_to_substack`
4. **Publisher Extension (Stage 7):** Still enforces the density guard as a final backstop — but should never fire if steps 1-3 are followed

## Implementation

- 25 blocked tables across 11 Stage 7 articles rendered and replaced in this session
- `audit-tables.mjs` and `fix-dense-tables.mjs` committed to repo root
- Both tools use the same density classifier as the Substack publisher extension
- `fix-dense-tables.mjs` imports `renderer-core.mjs` directly (no Copilot SDK dependency)

## Articles Fixed

jsn-extension-preview (4), buf-2026-offseason (2), ari-2026-offseason (1), dal-2026-offseason (1), jax-2026-offseason (5), lar-2026-offseason (1), ne-maye-year2-offseason (3), no-2026-offseason (1), sf-2026-offseason (1), witherspoon-extension-v2 (4), wsh-2026-offseason (2)
