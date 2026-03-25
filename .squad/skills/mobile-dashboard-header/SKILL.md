---
name: Mobile Dashboard Header
domain: dashboard-ui
confidence: high
tools: [view, css, vitest]
---

# Mobile Dashboard Header

## When to Use

- A shared dashboard header has too many always-on actions to fit comfortably on mobile.
- A quick collision fix has turned the header into a tall stack of full-width buttons.
- You need to preserve desktop navigation while making the mobile treatment feel intentional.

## Pattern

1. Split the header into two mobile layers:
   - Row 1: brand + utility controls (theme, environment, status).
   - Row 2: primary navigation.
2. Keep the nav row as compact pills with `white-space: nowrap`.
3. Prefer horizontal scrolling on the nav row over turning every action into a full-width block.
4. Hide decorative icons at smaller breakpoints when labels already communicate the destination.
5. Reserve the strongest visual treatment for the single most important action (for this repo: `New Idea`).
6. Add one focused server-rendered assertion so shared-header markup changes stay covered.

## Why It Works Here

- The dashboard header is shared across editorial flows, so bulky mobile chrome hurts every page.
- The theme toggle and env badge read more like utilities than navigation; grouping them reduces visual competition.
- Horizontal scroll is acceptable for global destinations because the user does not need to compare all actions at once.

## Current Example

- `src/dashboard/views/layout.ts`
- `src/dashboard/public/styles.css`
- `tests/dashboard/server.test.ts`
