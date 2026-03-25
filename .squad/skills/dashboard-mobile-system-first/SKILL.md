---
name: Dashboard Mobile System-First
domain: dashboard-ux
confidence: high
tools: [view, rg]
---

# Dashboard Mobile System-First

## When to Use

- A dashboard page is reported as “bad on mobile,” especially when similar issues likely exist elsewhere.
- The UI is server-rendered and CSS-driven, so the main risk is layout inconsistency rather than client-state complexity.
- You need to decide whether to patch one page or introduce a shared responsive system.

## Pattern

1. Audit the dashboard as a **single shell + page family**, not as isolated routes.
   - Start with the shared layout/header.
   - Then inspect recurring page structures: grids, action bars, filter bars, tables, sidebars, preview shells.
2. Look for the breakpoint trap:
   - a grid collapses to one column,
   - but the controls, data density, and navigation still behave like desktop UI.
3. Separate mobile surfaces into two buckets:
   - **must become mobile-native**: navigation, action clusters, filter controls, workflow summaries, core operator tables
   - **can remain scroll/overflow fallbacks**: raw artifacts, code/pre blocks, long logs
4. Recommend sequence in this order:
   - UX shell contract
   - shared CSS/layout primitives
   - highest-priority workflow pages
   - secondary/admin pages
5. Reject page-by-page CSS band-aids when the same layout smell appears in multiple views.

## Repo Map

- Shared shell: `src/dashboard/views/layout.ts`
- Shared styling: `src/dashboard/public/styles.css`
- Primary workflow pages:
  - `src/dashboard/views/article.ts`
  - `src/dashboard/views/publish.ts`
  - `src/dashboard/views/preview.ts`
  - `src/dashboard/views/home.ts`
- Secondary/admin pages:
  - `src/dashboard/views/runs.ts`
  - `src/dashboard/views/memory.ts`
  - `src/dashboard/views/config.ts`
  - `src/dashboard/views/agents.ts`
  - `src/dashboard/views/new-idea.ts`
  - `src/dashboard/views/login.ts`

## Heuristics

Ask these questions in order:

1. **Does the shared header/navigation have a mobile pattern, or just desktop buttons in less space?**
2. **Does the breakpoint change information hierarchy, or only column count?**
3. **Are tables and dense lists given a true mobile treatment, or only horizontal scrolling?**
4. **Are action rows, filter bars, and sidebars implemented with reusable primitives or one-off inline styles?**
5. **Will fixing one page without the shell create a second inconsistent mobile pattern?**

## Current Example

In this repo, the dashboard already has a partial responsive base: `.dashboard-grid` and `.detail-grid` collapse at narrow widths. But the larger system remains desktop-first:

- `layout.ts` uses one sticky top bar for all primary navigation.
- `styles.css` lacks a dedicated mobile nav treatment.
- `article.ts` and `publish.ts` reuse a dense two-column operator layout with many action clusters.
- `runs.ts`, `memory.ts`, and `config.ts` remain primarily table-driven.

That combination means the right fix is a shared mobile shell and data-presentation pass, not a one-off article-page patch.

## Watch-outs

- A “mobile preview” toggle inside content does **not** make the surrounding page mobile-friendly.
- Horizontal scrolling is acceptable for raw artifacts, but poor as the main interaction model for operational tables.
- Inline `style="..."` layout tweaks in templates often signal missing system primitives.
- Absolute-positioned dropdown/forms can become the highest-friction control on small screens even when the main grid stacks correctly.
