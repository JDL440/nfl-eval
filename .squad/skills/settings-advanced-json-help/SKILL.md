---
name: Settings Advanced JSON Help
domain: dashboard-ux
confidence: high
tools: [view, rg, vitest]
---

# Settings Advanced JSON Help

## When to Use

- A settings surface has optional advanced overrides that most operators should not see first.
- One of those overrides is a raw JSON textarea.
- The backend already validates JSON, but the UI needs clearer guidance and earlier feedback.

## Pattern

1. Keep the advanced state change and the advanced visibility change separate.
   - Use a semantic `<details>` wrapper for collapse/scanability.
   - Keep the existing checkbox or explicit opt-in control as the true switch for whether advanced fields submit.
2. Put the JSON textarea inside that advanced section.
3. Render a schema/example block immediately below the textarea.
   - Keep it concrete and copyable.
   - Show the actual expected object shape, not prose only.
4. Add client-side validation that requires the textarea to parse as a JSON object.
   - Use `setCustomValidity(...)` so the browser blocks submit with an explicit message.
   - Do not remove server-side validation; the route should still return an explicit error for malformed JSON.
5. If the page is part of a broader settings system, tighten shared settings primitives first (`settings-grid-2`, textarea/time-input styling, advanced-section card styling) before adding surface-specific chrome.

## Why

This keeps payload semantics stable while making advanced JSON less intimidating. Operators can discover the shape they need without leaving the page, and malformed JSON fails explicitly instead of disappearing into compatibility logic.

## Current Example

- `src/dashboard/views/config.ts`
- `src/dashboard/public/styles.css`
- `tests/dashboard/config.test.ts`
- `tests/dashboard/settings-routes.test.ts`
