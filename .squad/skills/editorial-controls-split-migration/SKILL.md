---
name: Editorial Controls Split Migration
domain: dashboard-runtime
confidence: high
tools: [view, rg, vitest, edit]
---

# Editorial Controls Split Migration

## When to Use

- A monolithic `depth_level` integer controls multiple independent editorial decisions (reader sophistication, article length, panel size, analytics intensity).
- The codebase already has split fields in the type system but UI surfaces still present a collapsed view.
- You need to migrate without breaking backward compatibility or forcing a full refactor.

## Pattern

Treat the split as **additive compatibility migration**, not a data model rewrite:

1. **Verify the new type system is complete** (usually in `src/types.ts`):
   - Editorial preset definitions already exist
   - Split field types (reader_profile, article_form, panel_shape, analytics_mode) are defined
   - A resolution function already exists that maps legacy → new (e.g., `resolveEditorialControls()`)
   - Panel size logic keys off shape/form, not just collapsed depth

2. **Confirm data model readiness** (in schema + interfaces):
   - Article and ArticleSchedule rows already store both legacy + new fields
   - No migration query needed; fields exist and can be backfilled

3. **Check runtime acceptance** (in policy/gateway):
   - Model policy already accepts new params alongside legacy depthLevel
   - Prompts can parse both old (depth_level) and new controls

4. **Plan UI migration surface-by-surface**:
   - Identify which surfaces expose depth (new-idea, home filter, schedules, metadata edit)
   - Each surface can migrate independently: old depth dropdown → preset selector + advanced panel
   - No surface is blocked by another surface's UI state

5. **Test backward-compat along the way**:
   - Old depth-only articles should resolve to correct preset via `resolveEditorialControls()`
   - New articles created via preset should compute correct legacy depth via `deriveDepthLevelFromArticleForm()`
   - No depth value should be lost or orphaned

## Recommended Order

1. **Phase 1: Safe backfill (no breaking changes)**
   - Confirm resolveEditorialControls() is correct and tested
   - Auto-populate new fields when any article is created/edited
   - All tests should still pass with legacy-only articles

2. **Phase 2: UI surface migration (additive only)**
   - Replace depth options dropdown with preset selector
   - Keep depth_level visible in table/list rows (for transition)
   - Add "Advanced" panel for individual control overrides
   - Run existing tests; all should pass

3. **Phase 3: Validation refinement (optional)**
   - If post-state locks exist (e.g., "don't change depth after stage 1"), refine to per-field rules
   - Only lock fields that affect prompts (reader_profile, article_form), allow shape/analytics changes
   - Update validation tests to cover split rules

4. **Phase 4: Prompt integration (with model team)**
   - Update agent context to pass reader_profile + article_form + panel_shape separately
   - Model policy already supports both paths; no breaking change
   - Add tests for new prompt paths alongside legacy paths

5. **Phase 5: Deprecation (final, optional)**
   - Mark depth_level deprecated in TSDoc (keep in schema forever)
   - Disallow depth_level in new-article paths (it's derived from form)
   - Retain for historical queries and retrospectives

## Must-Haves

- **Never delete depth_level from schema** — it's useful for historical queries and retrospectives.
- **Keep the legacy depth in API responses** — old clients may parse it; new clients use new fields.
- **Resolution function is canonical** — always use resolveEditorialControls() to populate new fields from legacy depth (not manual mapping).
- **Test both old and new paths** — articles created via depth_level should resolve to same preset/controls as articles created via preset directly.
- **Separate UI from runtime** — UI shows "Casual Explainer" preset but runtime accepts both preset_id and legacy depth_level; no runtime-breaking changes until all surfaces migrate.

## Lockout Heuristics

- **Reject** any implementation that changes the schema (all split fields should already exist).
- **Reject** any implementation that breaks backward-compat (old depth-only articles must still work).
- **Reject** partial UI migration where some surfaces still show collapsed depth and others show split controls (migrate all UI surfaces before merging any).
- **Reject** prompt changes that remove depth_level support until 100% of article creation paths use new fields.
- **Reject** validation logic that applies new rules retroactively (only apply new rules to articles created after migration is complete).

## NFL Lab Example

- `resolveEditorialControls()` in src/types.ts is the canonical backfill function
- EDITORIAL_PRESETS and getPanelSizeGuidance() are production-ready
- ArticleSchedule + Article interfaces already have split fields populated
- Recommend starting with schedules.ts UI (currently shows depth 1–4 + content_profile separately)
- new-idea.ts should follow (currently shows depth 1–3 only)
- home.ts filter should align with new-idea.ts (currently shows depth 1–3)
- After UI migration, refine article metadata edit lock from "don't change depth" to "don't change reader_profile/article_form"

## Red Flags

- If any surface still shows only 3 depth options while another shows 4 (Feature vs Deep Dive mismatch)
- If DEPTH_LEVEL_MAP collapses both 3 and 4 to same `deep_dive` bucket (Feature has no distinct behavior today)
- If resolution function doesn't exist or only works one direction (legacy → new but not new → legacy depth)
- If any agent prompt hardcodes "depth 1 = 2 agents" instead of parsing panel_shape from presets
- If schedules create articles but ignore the schedule's preset/profile choices
