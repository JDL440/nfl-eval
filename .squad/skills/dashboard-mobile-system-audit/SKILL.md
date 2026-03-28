# SKILL: Dashboard mobile system audit

## When to use
Use this when a dashboard/mobile bug appears across multiple views and you need to tell whether it is a page bug or a shared shell/layout/CSS-system failure.

## Pattern
- Start at the shared shell first:
  - `src/dashboard/views/layout.ts`
  - shared classes in `src/dashboard/public/styles.css`
- Map which views inherit that shell and which controls/layouts repeat across pages.
- Separate findings into three layers:
  1. shell/navigation failures
  2. shared responsive primitive failures (tables, action bars, filter bars, toolbars, dropdown overlays)
  3. page-local symptoms
- Prefer minimum system changes over one-off fixes:
  - one responsive nav pattern
  - one mobile action/filter bar pattern
  - one responsive data-display pattern for tables/lists
  - one explicit preview/mobile contract if preview pages simulate another surface
- Check tests for what they actually protect. In this repo, dashboard tests mostly verify content strings and route behavior, not narrow-screen behavior.

## Why
Dashboard mobile regressions repeat when the shell and primitive layers stay desktop-first. Auditing from shared seams downward prevents teams from spending time on isolated CSS patches that leave the system broken.
