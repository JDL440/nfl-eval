# Orchestration Log: Lead — Dense Table Cleanup Completion (Stage 7)

**Timestamp:** 2026-03-16T16:37:43Z  
**Agent:** Lead  
**Task:** Recover and complete dense-table cleanup for Stage 7 drafts  
**Requested by:** Joe Robinson  
**Mode:** async

## Summary

Recovery and completion of the dense-table cleanup initiative that began in Phase 1. Lowered density threshold from ≥ 7.5 (BLOCKED only) to ≥ 5.5 (BORDERLINE + BLOCKED) to ensure all Stage 7 drafts have publication-ready tables before publisher pass.

**Outcome:** ✅ **COMPLETED**

## Execution Details

| Field | Value |
|-------|-------|
| **Threshold adjustment** | Density ≥ 5.5 (was 7.5) |
| **Articles processed** | 22 Stage 7 drafts |
| **Tables fixed** | 20 tables across 14 articles |
| **Phase 1 carryover** | 25 blocked tables (prior session) |
| **Total tables rendered** | 40 → 60 images |
| **Post-fix audit result** | 0 borderline, 0 blocked, 108 clean inline tables |

## Articles Fixed (Phase 2 — Borderline)

**14 articles, 20 tables total:**
- jsn-extension-preview (1)
- buf-2026-offseason (1)
- ari-2026-offseason (2)
- car-2026-offseason (1)
- dal-2026-offseason (2)
- den-2026-offseason (1)
- gb-2026-offseason (1)
- hou-2026-offseason (3)
- jax-2026-offseason (1)
- lar-2026-offseason (1)
- ne-maye-year2-offseason (1)
- nyg-2026-offseason (2)
- sf-2026-offseason (1)
- wsh-2026-offseason (2)

## Tools & Implementation

**Pipeline modification:**
- `fix-dense-tables.mjs` now runs as **pre-publish local step** (Stage 7), not post-audit backstop
- Classification tier updated: ✅ OK (density < 5.5) | ⚠️ Borderline (5.5–7.4) | 🚫 Blocked (≥ 7.5)

**Workflow placement:**
1. Writer (Stage 5): Manual dense table rendering via `render_table_image`
2. Editor (Stage 6): Audit check with `audit-tables.mjs --slug`
3. **Pre-Publish (Stage 7):** Automated batch fix via `fix-dense-tables.mjs` ← NEW POSITION
4. Publisher Extension (Stage 7): Density guard as final backstop

## Audit Results

**Pre-fix state:** 20 borderline tables across 14 articles  
**Post-fix state:** 0 borderline, 0 blocked across all 22 Stage 7 drafts

All 108 remaining inline tables are low-density (< 5.5) and will convert cleanly to bullet/ordered lists in Substack.

## Decision Impact

This completes implementation of `.squad/decisions/inbox/lead-stage7-tables.md`:
- Phase 1 (BLOCKED): ✅ Complete
- Phase 2 (BORDERLINE): ✅ Complete  
- Pipeline position lock: ✅ Complete (pre-publish, not post-audit)

## Next Steps

1. Merge decision file into `.squad/decisions.md`
2. Update Publisher skill workflow to reference pre-publish table cleanup as prerequisite
3. All 22 Stage 7 drafts are now table-safe for publishing
4. No blocked or borderline cases remain in backlog

## Related Files

- Decision file: `.squad/decisions/inbox/lead-stage7-tables.md`
- Scripts: `audit-tables.mjs`, `fix-dense-tables.mjs`
- Stage 7 drafts: `content/articles/*/draft.md` (22 articles)
