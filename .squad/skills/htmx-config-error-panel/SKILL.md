# SKILL: HTMX config error panel

## When to use
Use this pattern when an HTMX-triggered dashboard action can fail for a predictable local configuration problem (missing optional service, missing env vars, unavailable startup wiring).

## Pattern
- Keep API semantics for non-HTMX callers: return the normal JSON error with the appropriate failing status.
- For HTMX callers that expect a panel swap, return a normal HTML fragment targeting the same container the action controls.
- Put concrete operator recovery steps directly in the fragment: exact env vars, whether a restart is required, and where to verify current config in-product.
- Cover both paths in tests:
  1. JSON caller still gets structured error + non-2xx status.
  2. HTMX caller gets 200 HTML that swaps cleanly and contains actionable guidance.
  3. If startup dependency injection is part of the failure mode, add a direct regression test for the startup wiring/helper too.
- When landing as a hotfix, keep the diff isolated to the panel behavior and the minimal dependency-wiring seam; do not bundle unrelated workflow/UI refactors, or review will become about scope instead of the error-state fix.

## Why
HTMX panels often do not present raw 500s in a useful way. Predictable local-setup failures should degrade into an inline recovery state instead of a dead-end error.
