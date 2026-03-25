# Skill: Mobile-First Dashboard Shell

## When to use

Use this pattern when a dashboard page in this repo feels "desktop shrunk to phone" rather than intentionally designed for mobile.

Typical triggers:

- top navigation overflows or wraps awkwardly
- several buttons share one row and lose hierarchy
- tables are only usable via sideways scrolling
- a right sidebar drops below the main content without re-prioritizing information
- page chrome consumes more space than the task itself

## Core rule

Treat the phone layout as the default structure, then add density back for wider screens.

## Shared mobile system

### 1. Shell first

- Use a compact sticky header.
- Keep page padding and card padding tighter on mobile.
- Normalize a page header stack: back link → title → supporting meta → primary actions.

### 2. Action hierarchy

- Primary action comes first and is full-width unless there is a strong reason not to.
- Secondary actions stack below or become a two-up row at most.
- Destructive/debug actions move into disclosures instead of sharing the main action row.

### 3. Data surfaces

- Prefer card rows or definition-list blocks over wide tables on small screens.
- If horizontal scrolling is unavoidable, make it deliberate with chips/tabs/timelines only.
- Give scrollers visible affordance; do not hide essential content in accidental overflow.

### 4. Content order

- Lead with "what this page is" and "what I should do next."
- Put diagnostics, analytics, and rarely used controls after the primary task.
- Collapse secondary panels into accordions/details when they are not needed every visit.

## Repo-specific hotspots

- `src/dashboard/views/article.ts` needs summary/action-first mobile ordering.
- `src/dashboard/views/publish.ts` and `preview.ts` need cleaner toolbar + workflow hierarchy.
- `src/dashboard/views/runs.ts`, `memory.ts`, and `config.ts` should use mobile card transforms instead of raw tables.
- `src/dashboard/views/new-idea.ts` needs larger touch targets and better grouping for chip selectors.
- `src/dashboard/public/styles.css` should hold the shared primitives so pages stop inventing their own mobile behavior.

## Anti-patterns to avoid

- desktop-first CSS with one late `@media (max-width: 768px)` collapse and no hierarchy changes
- inline style fixes for a single page
- keeping every action visible at once on mobile
- relying on raw table overflow as the mobile solution
- mixing primary workflow controls with low-frequency debug actions in the same toolbar

## Success check

A page is ready when a phone user can answer three questions quickly:

1. What page am I on?
2. What is the main thing to do here?
3. What can I safely ignore unless I need more detail?
