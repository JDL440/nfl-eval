---
name: Dashboard Surface Retirement Audit
domain: dashboard-ux
confidence: high
tools: [rg, view]
---

# Dashboard Surface Retirement Audit

## When to Use

- A dashboard simplification removes whole surfaces like Runs, Agents, Memory, or advanced article controls.
- The primary routes/navigation are already cleaned up, but you need a final audit for stale copy, class names, tests, and maintenance affordances.
- Legacy backend capabilities still exist in limited form (for example, refresh endpoints or storage paths) and the UI must describe them honestly without restoring the old product surface.

## Pattern

1. Start with the shell and canonical admin page.
   - Check `src/dashboard/views/layout.ts` for the primary nav actually shown to users.
   - Check `src/dashboard/views/config.ts` for the operator story that replaces removed dashboards.
2. Audit detail pages for leftover language, not just visible panels.
   - Search for dead route names, `advanced-*` hooks, `timeline` classes, and removed panel copy.
   - Rename neutral survivors (for example trace-only sections) so they no longer carry retired feature names.
3. Prune CSS only after confirming markup usage.
   - Search the repo for selector references first.
   - Remove selectors that belong only to retired surfaces, especially shared-shell or settings-page leftovers that can mislead future work.
4. Keep deprecation copy factual.
   - If legacy storage or maintenance actions still exist, say so directly.
   - Also say what is gone: prompt injection disabled, old dashboard retired, maintenance still lives in `/config`.
5. Lock the cleanup with UI-facing tests.
   - Assert the new copy exists.
   - Assert retired links/routes/classes do not appear in rendered HTML.

## Why

Dashboard retirements often look complete in navigation while stale copy and CSS keep the old mental model alive for both users and developers. A final audit should remove those ghost references without erasing truthful operator information about remaining maintenance seams.

## Current Evidence

- `src/dashboard/views/layout.ts`
- `src/dashboard/views/config.ts`
- `src/dashboard/views/article.ts`
- `src/dashboard/views/traces.ts`
- `src/dashboard/public/styles.css`
- `tests/dashboard/config.test.ts`

## Watch-outs

- Do not describe legacy storage as active product functionality if only migration/maintenance uses remain.
- Do not remove trace or maintenance UX just because it shares words with retired surfaces; rename the hook if the capability still exists.
- Prefer surgical text/class/test changes over wider route or backend refactors in this final-pass audit.
