---
name: Helper JSON Priority Inversion
domain: dashboard-config
confidence: high
tools: [view, rg, vitest]
---

# Helper JSON Priority Inversion

## When to use

- A form exposes both structured helper inputs and a raw JSON textarea for the same persisted object.
- The save path accepts both helper fields and a `...Json` field such as `panelConstraintsJson`.
- Operators report that helper edits “saved” but did not change runtime behavior.

## Pattern

Audit the render path and parse path together.

1. **Find the rendered helpers**
   - Examples: `requiredAgents`, `excludedAgents`, `panelMin`, `panelMax`, `scopeMode`, checkboxes.
2. **Find the raw JSON field**
   - Example: `panelConstraintsJson` / `panel_constraints_json`.
3. **Inspect parser precedence**
   - If the parser returns the raw JSON immediately when it is non-empty, helper fields are dead on any record that already has JSON.
4. **Check edit vs create separately**
   - Create forms often start with empty JSON, so helpers work there.
   - Edit forms often preload JSON, so the same helpers silently no-op.

## Repository example

- `src\dashboard\views\config.ts` renders schedule helper inputs plus a prefilled `panelConstraintsJson` textarea.
- `src\dashboard\server.ts` `parsePanelConstraintsInput()` returns the textarea value before reading helper inputs.
- Result: editing helper controls on existing schedules does not change `panel_constraints_json` unless the operator also rewrites the raw textarea.

## Fix options

1. Make helper fields authoritative and regenerate JSON from them.
2. Hide/disable helper fields whenever raw JSON is present and editable.
3. Split “simple controls” and “advanced raw JSON” into mutually exclusive modes.

## Regression checks

- Save an existing record with non-empty JSON using only helper-field changes.
- Assert the persisted JSON changes accordingly.
- Repeat for both create and edit flows if the product has multiple live surfaces.
