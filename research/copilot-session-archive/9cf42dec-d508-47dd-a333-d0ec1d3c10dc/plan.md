# Plan: High-quality Substack table rendering

## Problem

Substack does not give NFL Lab a reliable native table path for data-heavy articles. We now have two partial solutions, but neither fully solves the presentation problem:

- short markdown tables can be transformed into much more readable structured lists
- dense tables can be rendered as images, but the current proof of concept is not visually strong enough

The next plan must optimize for **high quality**, **fast runtime**, **low cost**, and **consistent rendering across web, mobile, and email**.

## What we learned from the POC

### Confirmed constraints

- Raw HTML tables are not a viable Substack publishing path for this workflow.
- Email is the hardest target, so any “best” solution must survive email gracefully.
- The user does **not** need sorting or filtering. These tables are primarily illustrative.

### Confirmed wins

- The updated `parseTable(...)` path in `publish_to_substack` is a meaningful improvement for short ranking/checklist tables.
- The new inline format is much closer to the desired output style:
  1. `OT — Right tackle succession`
     `Current state: ...`
     `Severity: ...`
- This means we should **keep** an inline conversion path for small, text-heavy tables.

### Confirmed failures

- The first `table-image-renderer` extension path is not production-ready.
- The headless browser flow hung/faulted during execution.
- The manual fallback PNGs were serviceable as a test, but not high enough quality for publication.
- A naive “draw cells into a bitmap” renderer is too low-level and too hard to make beautiful quickly.

## Current codebase state

### Already changed

- `C:\github\nfl-eval\.github\extensions\substack-publisher\extension.mjs`
  - markdown tables now convert into structured ordered/bullet lists instead of flat paragraphs
- `C:\github\nfl-eval\.squad\skills\substack-publishing\SKILL.md`
  - docs now reflect that markdown tables do not become native Substack tables
- `C:\github\nfl-eval\.github\extensions\table-image-renderer\extension.mjs`
  - prototype exists, but should be treated as experimental / replaceable
- `C:\github\nfl-eval\content\articles\ne-substack-table-poc\draft.md`
  - POC draft exists in Substack for comparison testing

### Important implication

The old plan to “block all raw markdown tables at publish time” is now too blunt.

We now have a better model:

- **short tables** → allow inline conversion
- **dense or layout-sensitive tables** → require rendered images

So the guard should become a **table classifier and quality gate**, not a universal ban.

## Updated product direction

### Default strategy

Adopt a **two-lane table system**:

1. **Inline conversion lane**
   - for short ranking, priority, checklist, and label/value tables
   - powered by the improved `parseTable(...)` logic
   - optimized for readability, speed, and zero extra assets

2. **Rendered image lane**
   - for dense comparison tables, cap tables, draft boards, or any layout where columns matter
   - powered by a deterministic HTML/CSS renderer
   - optimized for visual impact and email fidelity

### De-prioritized strategy

Datawrapper is now a **secondary option**, not the main plan and not part of the core MVP path.

Reason:

- the user does not need interactivity
- email still degrades interactive embeds
- the main need is a polished static presentation, not filtering/sorting
- dense tables now have a deterministic in-repo rendered-image path, so Datawrapper is no longer needed to close the presentation gap

Datawrapper can remain available for special cases, but it should not drive the MVP or the default author workflow.

## Success criteria

The final renderer should satisfy all of these:

1. **Looks publication-quality**
   - not “debug screenshot” quality
   - strong typography, spacing, hierarchy, and contrast

2. **Deterministic**
   - no generative model
   - no invented text or numbers
   - same input should produce the same structure every time

3. **Fast**
   - suitable for routine article workflow
   - should feel like a formatting tool, not a heavyweight publishing job

4. **Cheap**
   - prefer fully local rendering with existing tools
   - avoid per-image API spend

5. **Cross-surface safe**
   - good in Substack web post
   - good in mobile app / small screens
   - good in email, where HTML tables are not dependable

6. **Accessible enough**
   - returned markdown must include strong alt text
   - article should include a short text takeaway below dense image tables

7. **Reviewer-visible early**
   - dense table rendering should ideally happen early enough that Editor/reviewer can inspect something very close to final output
   - if this cannot be the default MVP flow, it should be preserved as a near-term enhancement path

## Recommended technical approach

### Keep

- the improved inline table conversion for short tables

### Replace

- the current rough image-renderer implementation as the primary rendering path

### New rendering stack

Build a **deterministic HTML/CSS → PNG renderer** with stronger execution control and better design templates.

#### Why this remains the best foundation

- fastest path to attractive output
- best typography/layout control
- easiest to iterate visually
- naturally supports branded templates and multiple table archetypes
- cheaper than any API-based image generation path

#### What must change versus the prototype

1. **Use a reliable browser execution path**
   - prefer a robust headless Chromium/Edge invocation with explicit lifecycle handling
   - avoid hanging by using a controlled wrapper, clear timeouts, and post-render validation

2. **Use designed templates, not raw table screenshots**
   - title area
   - subtitle / caption area
   - proper spacing rhythm
   - row striping
   - better width constraints
   - stronger typography
   - team-aware but tasteful branding

3. **Support table archetypes**
   - `priority-list`
   - `cap-comparison`
   - `draft-board`
   - `generic-comparison`

4. **Handle mobile/email intentionally**
   - fixed export widths chosen for Substack rendering realities
   - limit per-image information density
   - split very dense tables into multiple images when necessary

5. **Add render validation**
   - verify output file exists
   - verify file size is sane
   - optionally verify image dimensions
   - fail loudly instead of hanging silently

## Updated publish behavior

### Short-term behavior

- Allow markdown tables to flow through the improved inline conversion
- Use rendered images manually for dense tables where needed

### Future guarded behavior

Add a **table classifier** inside `publish_to_substack`:

- If a table is narrow and text-forward, convert inline
- If a table is too wide/dense for good inline presentation, fail with a helpful error telling the writer to render it as an image

### Candidate classifier signals

- number of columns
- average cell length
- presence of multiple numeric comparison columns
- presence of budget / AAV / cap hit / range-style headers
- total table width score

## Execution plan

1. **Stabilize the direction**
    - keep the current inline conversion path
    - treat the existing image renderer as a discarded prototype
    - close the Datawrapper branch as optional/secondary only; no MVP dependency or default integration required

2. **Design the renderer properly**
   - define 2-4 visual table templates
   - define export sizes for web/mobile/email
   - define acceptable density thresholds

3. **Rebuild the renderer**
   - deterministic HTML/CSS templating
   - robust browser screenshot execution
   - clearer error handling and timeout behavior

4. **Add table classification**
   - allow simple tables inline
   - require image rendering for dense tables

5. **Improve author workflow**
   - table rendering tool returns:
     - saved image path
     - ready-to-paste markdown
     - alt text
     - optional short takeaway text

6. **P2 nice-to-have: render during writing phase**
   - evaluate whether dense table rendering can happen immediately after Writer produces or updates a draft
   - goal: Editor/reviewer sees near-final table presentation instead of placeholder markdown
   - likely integration point: end of Writer stage, before Editor review
   - constraints to evaluate:
     - render latency in normal article flow
     - whether the draft is stable enough at that point
     - whether re-renders are cheap when tables change
     - whether this should be opt-in for only dense tables

7. **Validate on real articles**
   - New England cap/priorities
   - at least one other dense offseason article
   - inspect final Substack output on web/editor/email preview

8. **Only then decide whether Datawrapper still matters**
   - likely optional, not core

## Updated implementation todos

### Todo 1: Harden inline table conversion

- preserve the new readable list format
- refine title/label extraction for more table shapes
- keep the current quick-win path working

### Todo 2: Replace the image renderer prototype

- rebuild the renderer around stronger HTML/CSS templates
- ensure fast, deterministic local exports
- remove hanging/fault-prone behavior

### Todo 3: Add a table classifier gate

- do **not** ban all markdown tables
- block only dense tables that will look bad inline

### Todo 4: Build quality standards

- define “good enough” for:
  - typography
  - spacing
  - export width
  - density
  - email readability

### Todo 5: Re-test the POC

- regenerate the New England comparison draft with improved images
- compare inline vs rendered versions again
- decide the default recommendation by table type

### Todo 6: P2 writer-phase rendering review

- evaluate rendering dense tables during Writer stage instead of later manual prep
- decide whether this should be automatic, opt-in, or editor-triggered
- prioritize as P2 nice-to-have after the core renderer is stable

## Initial design review outcomes

### Recommended architecture

- Keep the **two-lane system**:
  - inline conversion for short ranking/checklist tables
  - rendered images for dense/layout-sensitive tables
- Rebuild the rendered-image lane around **HTML/CSS → PNG** with stronger browser lifecycle control and template quality
- Add a **table classifier** so only dense tables are forced into the rendered-image lane

### Biggest risks called out in review

1. **Browser execution hangs**
   - fix with explicit timeout handling, process cleanup, and output-file validation
2. **Email readability for dense images**
   - export at fixed widths chosen for Substack/email realities instead of naive dynamic sizing
3. **Misclassification of table types**
   - start conservative and allow manual override where necessary
4. **Writer-stage latency**
   - keep writer-phase rendering as P2 until render times are measured on real drafts

### Scope split from review

- **MVP**
  - preserve inline conversion for simple tables
  - stabilize manual high-quality image rendering for dense tables
  - add the table classifier / quality gate
- **P1**
  - improve visual templates, export widths, and archetype support
  - validate on multiple real articles
- **P2**
  - render dense tables during Writer stage so Editor can review near-final visuals earlier
  - likely best as an opt-in or selectively automatic workflow after performance is proven

## Notes

- Generative image tools are the wrong fit here because factual tables require deterministic text.
- `System.Drawing` / ad hoc bitmap drawing is acceptable for debugging, but not the long-term rendering strategy.
- The best near-term win is likely: **great inline conversion for simple tables + a high-quality HTML/CSS image renderer for dense ones**.
