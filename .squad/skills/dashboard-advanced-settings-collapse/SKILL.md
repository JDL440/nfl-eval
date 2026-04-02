---
name: Dashboard Advanced Settings Collapse
domain: dashboard-ux
confidence: high
tools: [view, rg, vitest]
---

# Dashboard Advanced Settings Collapse

## When to use

- A dashboard form has optional controls that distract from the primary authoring flow.
- You need to hide or reorder advanced options without changing request payloads.
- Existing tests assert the old control order or section placement.

## Pattern

1. Keep the default path visible.
   - Leave the primary authoring inputs in the main form flow.
   - Move secondary controls to the end of the form.
2. Use a semantic `<details>` wrapper.
   - Prefer a labeled summary such as `Advanced settings`.
   - Keep the section open when the form already contains non-default advanced state.
3. Preserve payload contracts.
   - Do not rename inputs just because they moved.
   - Keep disable/enable logic scoped to the same fields as before.
4. Test structure, not fragile full-page order.
   - Assert the advanced section contains the moved inputs.
   - Assert the section renders after the primary controls it should no longer interrupt.

## Repo seam

- `src\dashboard\views\new-idea.ts` already computes `advancedChecked`; reuse that state to control both the override toggle and the `<details open>` state.
- `tests\dashboard\new-idea.test.ts` is the focused regression file for new-idea layout changes.

## Watch-outs

- Do not accidentally disable unrelated controls when nesting them under the advanced wrapper.
- If a moved section feeds client-side scripts, verify the same element IDs still exist after the reorder.
- Prefer stable IDs and section slicing in tests over giant HTML snapshots.
