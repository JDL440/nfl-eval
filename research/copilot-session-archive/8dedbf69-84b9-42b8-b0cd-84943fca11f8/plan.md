# UX modernization sprint plan

## Problem

The dashboard has been simplified functionally, but it still needs a deliberate UX modernization pass across all live pages. The goal of this sprint is to make the product feel modern, tasteful, and mobile-first, then verify the real result in-browser with Playwright rather than relying on static code review alone.

## Current live UX surface

Primary pages and flows currently in scope from the dashboard app:

- `/login`
- `/`
- `/ideas/new`
- `/articles/:id`
- `/articles/:id/traces`
- `/traces/:id`
- `/articles/:id/preview`
- `/articles/:id/publish`
- `/config`

Supporting HTMX/live surfaces that affect UX quality:

- article metadata editing
- article artifacts tabs/content
- live header / live artifacts / live sidebar updates
- publish workflow controls
- image generation/gallery blocks
- pipeline summary / filtered article lists on the dashboard home

## Proposed approach

Run the sprint in five phases:

1. inventory + baseline
2. shared shell modernization
3. page-by-page UX refinement
4. live browser review in Playwright
5. final polish + validation

The guiding principle is mobile-first layout and interaction design:

- strong spacing and typography hierarchy
- cleaner card/page rhythm
- good tap targets and responsive controls
- simplified visual density on phones
- preserved clarity on desktop without reintroducing clutter

## Assumptions to confirm

- “All UX pages” means the live dashboard pages listed above, not internal API/HTMX endpoints by themselves
- Playwright review should cover at least mobile and desktop breakpoints
- The goal is visual/interaction polish and responsive cleanup, not major product-flow redesign

## Phases and checklist

### Phase 1 — UX inventory and baseline

- [ ] Confirm exact page scope for the sprint
- [ ] Identify the shared layout primitives and CSS systems that currently control most screens
- [ ] Define target breakpoints for review (mobile first, then larger layouts)
- [ ] Record page-specific risks: dense tables, long forms, nested controls, weak hierarchy, overflow issues
- [ ] Decide which pages need seeded demo content for Playwright review

### Phase 2 — Shared shell modernization

- [ ] Refresh global header/nav spacing and mobile behavior
- [ ] Tighten page width, section rhythm, and card spacing
- [ ] Improve typography scale and heading/body hierarchy
- [ ] Normalize button, form, badge, and panel styling
- [ ] Audit responsive behavior of shared layout primitives before page-specific changes

### Phase 3 — Page-by-page refinement

- [ ] Dashboard home: make summary blocks, article lists, and stage groupings feel cleaner and work well on narrow screens
- [ ] New Idea: modernize form layout, provider/expert selection, and mobile control stacking
- [ ] Article detail: improve action panel, metadata block, artifacts tabs, usage/sidebar behavior, and mobile reading flow
- [ ] Trace timeline + standalone trace: improve density, readability, overflow handling, and mobile code/trace presentation
- [ ] Publish page: improve CTA hierarchy, checklist/actions, status messaging, and small-screen ergonomics
- [ ] Preview page: verify typography, image/media treatment, and viewport behavior
- [ ] Settings page: ensure the new admin surface feels polished, scannable, and responsive
- [ ] Login page: modernize form presentation and small-screen layout if needed

### Phase 4 — Live Playwright review

- [ ] Start the dashboard locally with representative content
- [ ] Open the real pages in Playwright
- [ ] Review at minimum a mobile viewport and a desktop viewport
- [ ] Capture concrete UX issues found only in-browser (overflow, clipping, sticky layout problems, awkward stacking, weak contrast, poor tap targets)
- [ ] Apply follow-up fixes from Playwright findings
- [ ] Re-check the corrected pages in Playwright

### Phase 5 — Validation and finish

- [ ] Run the existing build/test commands required by the touched areas
- [ ] Perform a final multi-page responsive sanity pass
- [ ] Update this plan with completed status and any follow-up recommendations
- [ ] Summarize what changed page-by-page

## Validation checklist

- [ ] `npm run v2:build`
- [ ] Relevant existing dashboard tests still pass
- [ ] Mobile viewport review completed in Playwright
- [ ] Desktop viewport review completed in Playwright
- [ ] No major overflow, clipped controls, or unreadable dense sections remain on the audited pages

## Notes

- Use Playwright for the actual visual verification instead of relying on screenshots from static code.
- Prefer shared CSS/layout improvements before page-local overrides.
- Keep the sprint focused on refinement and usability, not on introducing brand-new workflows unless the browser review exposes a clear usability gap.
