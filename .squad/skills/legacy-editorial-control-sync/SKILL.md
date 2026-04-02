---
name: Legacy Editorial Control Sync
domain: runtime-migration
confidence: high
tools: [view, rg, vitest]
---

# Legacy Editorial Control Sync

## When to use

- A repo is migrating from one overloaded legacy field to several preset-era fields.
- Old routes or forms can still PATCH only the legacy field (`depth_level`, `content_profile`, etc.).
- You need compatibility without letting derived columns drift stale.

## Pattern

1. **Resolve from explicit legacy input, not stale stored overrides.**
   - If a patch changes `depth_level`, do not feed the old `preset_id` / `article_form` back into resolution unless the caller explicitly changed them too.
   - If a patch changes `content_profile`, do not keep old `reader_profile` / `analytics_mode` blindly if they were only derived before.

2. **Preserve truly advanced overrides.**
   - Keep stored `panel_shape` / `panel_constraints_json` unless the patch explicitly changes them.
   - Legacy compatibility should recompute derived editorial defaults, not erase intentional advanced controls.

3. **Test create and partial-update paths separately.**
   - Create often derives correctly from legacy fields.
   - Partial updates are where stale preset-era columns usually survive unnoticed.

## Repo Example

- `src\db\repository.ts`
  - `resolveArticleEditorialUpdate(...)`
  - `resolveScheduleEditorialUpdate(...)`

These helpers recompute preset-era fields from legacy `depth_level` / `content_profile` changes while preserving explicit advanced overrides like `panel_shape` and `panel_constraints_json`.

## Validation targets

- `tests\db\schedule.test.ts`
- `tests\dashboard\schedules.test.ts`
- `tests\dashboard\metadata-edit.test.ts`

Add at least one assertion that a legacy-only update also changes the derived preset-era fields (`article_form`, `preset_id`, etc.), not just the legacy integer/string.
