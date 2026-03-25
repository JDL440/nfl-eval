---
title: UX article Option B implementation
date: 2026-03-25
owner: UX
status: proposed
---

# Decision

Implement article-page UX Option B as a hierarchy cleanup instead of a structural redesign.

## What changed

1. The article header now labels the canonical badge as **Current stage** and adds one compact workflow status line below it (`Working`, `Paused for lead review`, `Ready to publish`, etc.).
2. Revision History is now a closed disclosure with a one-line summary (`iterations`, `latest outcome`, `top blocker`) and full details only after expansion.
3. Stage Runs no longer render as a default sidebar panel; they live inside **Advanced** as a diagnostic subsection.
4. The action panel now shows only one compact **Latest failed attempt** line instead of a larger repeated error surface.
5. Mobile follow-through: send-back uses an inline stacked card on narrow widths, and Danger Zone is hidden behind disclosure to reduce competing controls.

## Why

The article detail page was mixing canonical stage, workflow status, revision history, live activity, and run diagnostics at the same visual level. Option B works because it keeps the top stage block + timeline as the primary workflow UI and demotes everything else without re-architecting the page.

## Files

- `src/dashboard/views/article.ts`
- `src/dashboard/public/styles.css`
- `tests/dashboard/server.test.ts`
- `tests/dashboard/publish.test.ts`

