# Local Dashboard Research — NFL Lab Article Pipeline

## Executive Summary

This repository already contains the three core ingredients a local dashboard would need: a structured pipeline ledger in `content/pipeline.db`, an artifact-rich filesystem under `content/articles/` and `content/images/`, and a canonical Substack rendering path inside the publisher extension that converts markdown to Substack-compatible ProseMirror, enforces subscribe widgets, validates hero-image safety, and blocks known-problematic dense tables.[^1][^2][^3][^4]

A two-page dashboard is a strong fit for the current system. The **Overview** page should be driven primarily by `articles`, `stage_transitions`, `editor_reviews`, `publisher_pass`, and `notes`, then enriched with artifact-derived drift and health signals from `article_board.py`; the **Article Detail** page should treat the filesystem as a time-ordered evidence store and the publisher extension as the source of truth for preview semantics.[^1][^5][^6]

The most important architectural decision is to make the dashboard **artifact-first but DB-backed**: use `pipeline.db` for fast querying and sorting, but continuously reconcile it against the filesystem, because the repo already contains reconciliation logic and there is visible evidence that DB rows and artifact reality can diverge or be partially populated.[^2][^5][^7]

For “preview as close as possible to Substack,” the best path is not building a generic markdown preview. It is reusing the publisher extension’s markdown→ProseMirror conversion rules, table-image pipeline, subscribe-widget insertion, and hero-image ordering, then optionally offering a browser-validated preview mode modeled after the existing Playwright validation scripts that already open authenticated drafts and inspect them at desktop and mobile sizes.[^3][^4][^8][^9]

Finally, token tracking should be treated as a **future observability layer**, not a UI afterthought. The repo has a model config and a written token/cost analysis, but not a durable telemetry schema in `pipeline.db`, so the dashboard should reserve space for per-run usage data without hard-coding today’s estimated numbers as if they were first-class system facts.[^10][^11][^12]

## Query Type Assessment

This is a **technical deep-dive** request, not just a feature brainstorm. The question asks what a local dashboard should show, how rich article-level inspection should work, how close preview fidelity can get to final Substack output, and how future token tracking should fit into the system. That requires understanding the repository’s data model, artifact layout, preview/rendering logic, validation workflow, and operational gaps.[^1][^2][^3][^8]

## Architecture / System Overview

```text
                           ┌─────────────────────────┐
                           │    pipeline.db          │
                           │ articles                │
                           │ stage_transitions       │
                           │ editor_reviews          │
                           │ publisher_pass          │
                           │ notes                   │
                           └──────────┬──────────────┘
                                      │
                    query / summarize │
                                      ▼
┌───────────────────────────────────────────────────────────────────────┐
│                         Local Dashboard App                            │
│                                                                       │
│  Overview page                    Article detail page                 │
│  - board / filters                - timeline                          │
│  - queue health                   - artifact browser                  │
│  - drift / note gaps              - editor deltas                     │
│  - publish readiness              - preview                           │
└───────────────┬───────────────────────────────────────┬───────────────┘
                │                                       │
      reconcile │                                       │ render / inspect
                ▼                                       ▼
┌──────────────────────────┐                ┌────────────────────────────┐
│ content/article_board.py │                │ substack-publisher ext     │
│ infer_stage()            │                │ markdownToProseMirror()    │
│ reconcile()              │                │ ensureSubscribeButtons()   │
│ notes_sweep()            │                │ ensureHeroFirstImage()     │
└──────────────┬───────────┘                │ dense-table blocking       │
               │                            └──────────────┬─────────────┘
               │                                           │
               ▼                                           ▼
┌──────────────────────────┐                ┌────────────────────────────┐
│ content/articles/{slug}/ │                │ content/images/{slug}/     │
│ idea / prompt / panel    │                │ inline images              │
│ positions / summary      │                │ rendered table PNGs        │
│ draft / editor reviews   │                │ validation screenshots     │
│ publisher-pass           │                └────────────────────────────┘
└──────────────────────────┘
```

The repository’s schema makes `articles` the central ledger, with stage, status, publish timing, team metadata, and canonical artifact-path fields; `stage_transitions` provides the audit trail; `editor_reviews`, `publisher_pass`, `article_panels`, and `notes` capture structured sub-states around editorial review, publish readiness, panel composition, and post-publish promotion.[^1]

At the same time, the system explicitly recognizes that the filesystem is not just a blob store but an operational truth source. `article_board.py` scans `content/articles/*`, infers stage from artifacts such as `discussion-prompt.md`, `panel-composition.md`, `*-position.md`, `discussion-summary.md`, `draft.md`, `editor-review*.md`, and `publisher-pass.md`, and can reconcile those findings back into `pipeline.db`.[^5]

That means a dashboard should not assume the DB alone is correct. It should combine a **fast DB query path** for primary views with an **artifact reconciliation path** for health banners, drift warnings, and “actual stage vs recorded stage” diagnostics.[^2][^5]

## What Exists Today That the Dashboard Can Reuse

### 1. Structured workflow data already exists

`content/schema.sql` already defines almost everything an overview page needs: article identity, status, current stage, depth level, publish windows, canonical artifact paths, stage history, panel membership, editor verdict history, publisher readiness checklist, and notes metadata. It also defines a `pipeline_board` view that already expresses the overview-table shape of “one row per article with readable stage/depth labels.”[^1]

`pipeline_state.py` turns that schema into a shared state API. It exposes `get_all_articles()`, `get_editor_reviews()`, `advance_stage()`, artifact-path setters, draft URL management, publisher-pass recording, note recording, and publish confirmation. The file header explicitly says every orchestration surface should funnel DB writes through this module rather than ad-hoc SQL, which makes it the right backend integration point for any dashboard mutations.[^2]

### 2. Rich per-article evidence already exists on disk

The pipeline conventions in `ralph/AGENTS.md` document the expected article folder contents: idea, discussion prompt, panel composition, panelist position files, discussion summary, draft, and editor review. That maps almost one-to-one to the article-centric page the request describes.[^6]

The live snapshot confirms the shape is not theoretical. There are 74 DB article rows, 38 article directories, 12 editor-review rows, and 25 notes rows; stage distribution ranges from 37 proposed ideas to 12 stage-5 drafts, 7 stage-6 review items, 5 stage-7 publisher-pass items, and 4 published rows.[^7]

The same snapshot shows example articles already carrying the full stack of artifacts needed for a rich detail view. `jsn-extension-preview` has a discussion prompt, four position files, a discussion summary, a draft, three editor reviews, a publisher pass, and nine images; `den-mia-waddle-trade` has a prompt, four position files, a summary, a draft, four editor reviews, and two images.[^7]

### 3. The canonical preview semantics already exist

The Substack publisher extension is the most important technical asset for preview fidelity. It converts markdown into Substack-compatible ProseMirror, supports headings, blockquotes, lists, images, tables, YouTube embeds, and explicit `::subscribe` markers, then post-processes the body to ensure exactly two subscribe widgets and a hero-safe first image before upload.[^3]

That same extension also performs pre-publish structural validation against Substack’s node expectations. It knows that `captionedImage` must contain an `image2` node followed by a `caption`, and it blocks drafts when validation would likely produce Substack editor schema errors.[^3]

Dense tables are also handled deliberately rather than accidentally. The publisher logic classifies inline tables by density and comparison-ness and throws when they are too dense for safe inline conversion, instructing the caller to render them with `render_table_image` first.[^4][^13]

### 4. Mobile and browser validation workflows already exist

The repo already contains browser-level validation scripts for Substack drafts. `validate-substack-editor.mjs` opens real draft URLs in authenticated Chromium sessions and checks for RangeError/schema failures, explicitly calling this the only reliable way to predict whether a draft will open cleanly in the Substack editor.[^8]

`validate-stage-mobile.mjs` goes further by opening a draft at a 375px mobile viewport, saving screenshots, measuring image dimensions, and checking effective font readability in rendered images. That is strong evidence that the desired “rich, responsive preview” can go beyond static HTML and offer a validation-backed mobile mode.[^9]

## Recommended Dashboard Information Architecture

## Page 1 — Overview / Pipeline Board

The overview page should answer four questions immediately: **What exists? Where is each article in the pipeline? What is blocked or drifting? What is closest to publish?** The existing schema and reconciliation logic already support all four.[^1][^2][^5]

### Recommended primary table

Use `articles` plus derived joins as the default board dataset, with one row per article.

Suggested columns:

| Column | Source | Why it matters |
|---|---|---|
| Title / slug | `articles.title`, `articles.id` | Primary identity[^1] |
| Team / teams | `primary_team`, `teams` | Filtering and routing[^1] |
| Current stage | `current_stage`, `stage_name` | Board comprehension[^1] |
| Status | `status` | Distinguishes proposed vs in production vs published[^1] |
| Depth | `depth_level`, depth label | Editorial complexity / panel sizing[^1][^11] |
| Updated at | `updated_at` | “What changed recently?”[^1] |
| Target publish date / window | `target_publish_date`, `publish_window`, `expires_at` | Scheduling and staleness[^1] |
| Editor verdict summary | latest `editor_reviews` | Publish-readiness at a glance[^1][^2] |
| Publisher pass summary | `publisher_pass` row | Stage-7 completeness[^1][^2] |
| Notes status | `notes` + `notes_sweep()` | Post-publish health[^1][^5] |
| Artifact drift badge | `article_board.reconcile()` result | DB vs disk trust signal[^5] |

### Recommended overview widgets above the table

A compact KPI strip would be immediately useful because the live system already exhibits meaningful stage distribution: 37 proposed articles, 3 at stage 2, 3 at stage 3, 3 at stage 4, 12 at stage 5, 7 at stage 6, 5 at stage 7, and 4 published.[^7]

Suggested widgets:

- `In review` = count of stage-6 rows.
- `Ready for publisher` = stage-6 with APPROVED and enough images, which mirrors `article_board.py`’s next-action logic.[^5]
- `Drafts on Substack` = stage-7 rows with `substack_draft_url`.[^2][^7]
- `Published without promo note` = `notes_sweep()` warnings / urgencies.[^5]
- `Drift detected` = discrepancies found by reconcile dry-run.[^5]

### Required filters

The schema and skills strongly suggest these filters should be first-class:

- Team / multi-team article.[^1]
- Stage.[^1]
- Status.[^1]
- Depth level (`Casual Fan`, `The Beat`, `Deep Dive`).[^1][^11]
- Time-sensitive / expiring soon.[^1]
- Has draft URL / has published URL.[^2]
- Needs note / has note gap.[^5]
- Has drift between DB and artifacts.[^5]

### Overview page health panels

The overview page should not just be a table. It should surface pipeline health:

- **Notes gap panel:** `article_board.py` already has `notes_sweep()` logic that flags stage-8 published articles missing promotion notes and escalates them after 48 hours.[^5]
- **Drift panel:** the existing reconciliation flow already detects missing DB rows, string-valued stages, stage drift, missing editor review rows, and status drift.[^5]
- **Readiness panel:** publisher-pass booleans and draft URL presence show what is truly ready for Joe versus merely “around stage 7.”[^1][^2]

## Page 2 — Article Detail / Article-Centric View

This page should behave like a hybrid of an editorial dossier, an audit timeline, and a preflight preview.

### Recommended layout

#### Left rail: article summary + status

Show the current stage, status, team tags, publish window, depth level, target date, draft URL, published URL, latest editor verdict, note status, and artifact-path links. All of these already exist either directly on `articles` or through `pipeline_state.py` getters and writeback methods.[^1][^2]

#### Main column tabs

Use tabs rather than one long page, because the artifact set is deep.

Recommended tabs:

1. **Overview**
2. **Prompt & Panel**
3. **Draft & Edits**
4. **Assets**
5. **Preview**
6. **Publish / Notes**
7. **Timeline**

### Tab details

#### Overview tab

Summarize the article’s core idea, central question, tensions, panel composition, latest editor state, publisher state, and note state. The underlying concepts are already formalized in the discussion-prompt schema and article-lifecycle skill, so this is not inventing a new model.[^11][^14]

#### Prompt & Panel tab

This tab should display:

- `idea.md` if present.
- `discussion-prompt.md`.
- `panel-composition.md`.
- Every `*-position.md` artifact in order.
- `discussion-summary.md` / `discussion-synthesis.md`.[^5][^6]

This directly satisfies the request to show “the idea, the discussion prompt, full text of all of the experts.” The file convention is already part of the documented pipeline contract.[^6]

#### Draft & Edits tab

This tab should show the writer draft plus all editor passes. The article-board parser already expects multiple files matching `editor-review(-N).md`, and real articles do in fact accumulate multiple editor passes.[^5][^7]

The draft itself contains operationally meaningful preview data, such as explicit `::subscribe` markers, inline-image references, and the final footer/CTA pattern. For example, `den-mia-waddle-trade/draft.md` includes subscribe markers, inline image references into `content/images/den-mia-waddle-trade/`, and the publication footer, all of which should be visible in a review UI.[^15]

Editor reviews are structured enough to support diff-like summaries. `den-mia-waddle-trade/editor-review.md` clearly separates errors, suggestions, notes, structural review, image review, and verdict, which means the dashboard can extract “blocking items” and “resolved over time” without NLP heroics.[^16]

#### Assets tab

This should show all images and rendered tables under `content/images/{slug}/`, plus whether they are inline images, likely table images, mobile variants, or validation screenshots. The table renderer writes output into `content/images/{slug}/` and returns ready-to-paste markdown and alt text, so the dashboard can classify assets partly from filenames and partly from returned metadata conventions.[^4]

Because the publisher enforces hero-first-image safety based on image path and text patterns, the assets tab should explicitly badge which image currently qualifies as the likely social/email hero image and warn if the first body image is chart-like.[^3]

#### Preview tab

This is the most important UX element.

**Recommendation:** implement three modes, not one.

1. **Canonical Local Preview**
   - Reuse the publisher extension’s markdown→ProseMirror conversion rules, subscribe-button insertion, hero-image ordering, and dense-table blocking.[^3][^13]
   - Render the resulting structure into local HTML that mirrors the published content model, not raw markdown.

2. **Static Asset Preview**
   - Show exactly what the article body will reference after local image resolution, including rendered table PNGs.[^3][^4]

3. **Substack-Validated Preview**
   - When credentials are present and a stage/prod draft exists, launch the same kind of browser-level check used by `validate-substack-editor.mjs` and `validate-stage-mobile.mjs`, then display screenshots and validation status.[^8][^9]

That layered model matters because a local dashboard can be fast by default while still offering the “as close as possible” path when the user needs certainty.

#### Publish / Notes tab

This tab should expose:

- Publisher checklist state from `publisher_pass`.[^1][^2]
- Stored Substack draft URL and published URL.[^2]
- Notes linked to the article from `notes`.[^1][^2]
- Notes-card status and attachment/card rendering assumptions, since `publish_note_to_substack` explicitly handles article URL resolution, post-attachment registration, and stage-vs-prod note behavior.[^3]

#### Timeline tab

This should merge DB transitions and artifact timestamps into one chronological feed:

- stage transitions from `stage_transitions`.[^1]
- editor review sequence from `editor_reviews`.[^1][^2]
- note events from `notes`.[^1][^2]
- filesystem events inferred from artifact presence and mtimes.[^5]

This is especially valuable because the current system is iterative: multiple editor passes are normal, not exceptional.[^5][^16]

## Preview Fidelity: What “As Close as Possible to Substack” Really Means

A naive markdown renderer would be misleading here because the production path is not “markdown in, HTML out.” It is “markdown in, ProseMirror body out, then Substack editor/runtime interpretation,” with additional constraints around subscribe widgets, captioned images, note attachments, and dense tables.[^3][^13]

### What the local preview should reuse exactly

The dashboard should import or wrap these publisher-extension behaviors directly:

- `markdownToProseMirror()` for canonical block parsing.[^3]
- `ensureSubscribeButtons()` so previewed article structure matches actual publish enrichment.[^3]
- `ensureHeroFirstImage()` so the apparent first image aligns with social/email behavior.[^3]
- `validateProseMirrorBody()` or equivalent structural validation to catch unknown-node problems before the user trusts the preview.[^3]
- dense-table classification / blocking logic so the preview can warn “this table must be rendered to PNG first.”[^13]

### What the dashboard should not promise

It should not imply 100% Substack parity without qualification. The repo itself treats browser validation against real draft URLs as the only reliable way to predict whether a draft opens cleanly, which means a local preview should be labeled “canonical local approximation” unless it has also passed a draft-based browser check.[^8]

### Recommended preview UX copy

- **Green:** “Matches local publisher rules.”
- **Green+camera:** “Validated against live Substack draft at desktop + mobile.”
- **Yellow:** “Preview diverges from publish path: dense table / unresolved image / missing draft URL.”

## Data Model Recommendation for the Dashboard Backend

### Use DB tables directly where possible

The current schema is already sufficient for a v1 dashboard backend. Minimal required reads:

- `articles`
- `stage_transitions`
- `editor_reviews`
- `publisher_pass`
- `notes`
- `article_panels`
- `discussion_prompts`
- `pipeline_board` view[^1]

### Add derived / cached backend models rather than mutate source tables aggressively

The dashboard should create derived objects such as:

- `article_health`
- `article_artifact_inventory`
- `article_preview_status`
- `article_note_status`
- `article_token_summary` (future)

Those should be computed from the source tables plus artifact scan results, not written back as new truth unless there is a strong operational reason.

### Reconciliation service is mandatory

Because `article_board.py` already exists and because recent rows in the live DB still show null `discussion_path`/`article_path` for some in-flight articles while artifact-rich directories exist elsewhere, the dashboard backend should run an artifact scan on demand or on interval and annotate rows with drift state.[^5][^7]

The highest-value reuse is not just calling `get_all_articles()`. It is exposing a dashboard API that combines `get_all_articles()` with `scan_articles()` / `reconcile()` / `notes_sweep()` and returns one enriched board payload.[^2][^5]

## Recommended API Shape for a Local Dashboard

These are implementation recommendations, not existing endpoints.

### Overview endpoints

- `GET /api/board`
- `GET /api/board/health`
- `GET /api/board/notes-gaps`
- `GET /api/board/drift`

### Article endpoints

- `GET /api/articles/:slug`
- `GET /api/articles/:slug/artifacts`
- `GET /api/articles/:slug/timeline`
- `GET /api/articles/:slug/preview`
- `GET /api/articles/:slug/assets`
- `GET /api/articles/:slug/notes`

### Validation endpoints

- `POST /api/articles/:slug/reconcile`
- `POST /api/articles/:slug/preview/validate-substack`
- `POST /api/articles/:slug/preview/validate-mobile`

### Optional mutation endpoints

Any write path should go through `pipeline_state.py`, not raw SQL, because the repo explicitly positions it as the shared write contract.[^2]

## Responsive UX Recommendations

The request explicitly asks for a “rich, responsive experience.” The repo’s existing validation work suggests what “responsive” means in practice: not just CSS breakpoints, but confidence that tables and images remain legible at mobile width.[^9]

### Overview page mobile behavior

- Collapse the board into cards on small screens.
- Make stage, status, publish readiness, and drift badges the first line.
- Use filter chips for stage/team/depth instead of wide table filters.

### Article page mobile behavior

- Keep tabs horizontally scrollable.
- Make Preview and Timeline top-level tabs even on mobile; they are decision-critical.
- In the Assets tab, show rendered dimensions and mobile-readability status per image, mirroring the metrics gathered in `validate-stage-mobile.mjs`.[^9]

## What Should Be In v1 vs v2

### v1 (recommended first cut)

- Overview page backed by `pipeline_board` + reconciliation annotations.[^1][^5]
- Article detail page with artifact browser, editor review history, assets gallery, and canonical local preview.[^3][^5][^6]
- Notes gap and publish readiness badges.[^5]
- Draft/published URL surfacing.[^2]

This delivers most of the value with low model risk because it reuses data and logic that already exist.

### v2

- Browser-validated preview with screenshot history.[^8][^9]
- Side-by-side draft vs latest editor-review issue extraction.[^16]
- Inline artifact diffs across editor-review rounds.[^5]
- One-click local reconciliation / path repair through safe wrappers around `article_board.py` and `pipeline_state.py`.[^2][^5]

### v3

- Token / cost observability.
- Agent/run analytics.
- Batch workflow controls.
- Ralph progress embedding and queue management.[^10][^12][^17]

## Token Tracking: How to Future-Proof the Dashboard Now

The dashboard should plan for token tracking, but it should not pretend the repo already has durable per-run telemetry. The current evidence is split across two places: `.squad/config/models.json`, which defines intended model assignments, max output token budgets, and panel size limits, and `TOKEN_USAGE_ANALYSIS.md`, which estimates per-stage token consumption and explicitly describes the analysis as a complete inventory rather than a live DB-backed telemetry stream.[^10][^11]

That distinction matters because `TOKEN_USAGE_ANALYSIS.md` also states that it found no token-limiting logic in charters, skills, extensions, or the database, even though `.squad/config/models.json` now contains `max_output_tokens`. In other words, the repo has **policy/config artifacts** and **analysis artifacts**, but not yet an authoritative telemetry table that proves those limits are enforced at runtime.[^10][^11]

### Recommendation

Reserve dashboard space now for:

- model used
- input tokens
- output tokens
- estimated cost
- run start/end time
- stage
- agent
- article slug
- success/failure

But do not source those fields from `TOKEN_USAGE_ANALYSIS.md` beyond mock/prototype displays. Instead, add a future telemetry table—likely keyed by article slug + stage + agent/run id—and let the dashboard consume that when it exists.[^2][^10][^11]

### Why the UI should anticipate this now

The project vision explicitly calls out cost tracking per article as an unproven but necessary capability, and the system inventory / roadmap positions scale economics as a major unanswered question. A dashboard that has no place for token/cost observability will need a structural redesign later.[^12]

## Key Repositories / Components Summary

| Component | Purpose | Key files |
|---|---|---|
| Pipeline schema | Canonical structured state | `C:\github\worktrees\dashboard\content\schema.sql`[^1] |
| Shared state helper | Safe DB reads/writes | `C:\github\worktrees\dashboard\content\pipeline_state.py`[^2] |
| Artifact reconciliation | Stage inference, drift detection, notes gaps | `C:\github\worktrees\dashboard\content\article_board.py`[^5] |
| Publisher extension | Canonical article render + draft creation | `C:\github\worktrees\dashboard\.github\extensions\substack-publisher\extension.mjs`[^3] |
| Table image renderer | Substack-safe rendered tables | `C:\github\worktrees\dashboard\.github\extensions\table-image-renderer\renderer-core.mjs`[^4] |
| Browser validation | Real-editor / mobile validation | `C:\github\worktrees\dashboard\validate-substack-editor.mjs`, `C:\github\worktrees\dashboard\validate-stage-mobile.mjs`[^8][^9] |
| Lifecycle conventions | Stage semantics and artifact expectations | `C:\github\worktrees\dashboard\.squad\skills\article-lifecycle\SKILL.md`, `C:\github\worktrees\dashboard\ralph\AGENTS.md`[^6][^14] |
| Token / model planning | Future telemetry inputs | `C:\github\worktrees\dashboard\.squad\config\models.json`, `C:\github\worktrees\dashboard\TOKEN_USAGE_ANALYSIS.md`, `C:\github\worktrees\dashboard\VISION.md`[^10][^11][^12] |

## Concrete Recommendation

If the goal is a local dashboard that becomes the operational cockpit for this repo, I would build it around these principles:

1. **Overview = DB-first, health-enriched board.**
2. **Article page = artifact-first dossier with timeline and preview.**
3. **Preview = publisher-extension semantics, not generic markdown.**
4. **Validation = optional browser-backed certainty for high-stakes drafts.**
5. **Future telemetry = additive observability layer, not baked-in assumptions.**

That would produce a system that is immediately useful with current repo reality and still aligned with where the pipeline is clearly heading: more automation, more scale, more drafts in flight, and eventually cost/token instrumentation that needs to be visible alongside editorial state.[^2][^5][^8][^10][^12]

## Confidence Assessment

### High confidence

I am highly confident that the repo already supports the requested two-page information architecture because the schema, shared DB helper, artifact conventions, reconciliation logic, and publisher-rendering path are all present and explicit.[^1][^2][^3][^5][^6]

I am also highly confident that preview fidelity should be built around the publisher extension rather than a standalone markdown renderer, because the extension contains critical publish-time behaviors—subscribe insertion, hero-image ordering, schema validation, and dense-table blocking—that materially affect what the final Substack draft becomes.[^3][^13]

### Medium confidence

I am moderately confident about the exact shape of the best local implementation stack because this repo does not yet contain an existing dashboard application framework. The package manifest is minimal and Playwright-focused rather than app-framework-focused, so the report can confidently define architecture and reuse points but not infer a preexisting front-end preference from code.[^18]

### Lower confidence / inferred areas

I infer that a dashboard should expose reconciliation warnings prominently because the code is built around artifact-first truth and because the live snapshot shows partially populated DB path fields and a smaller number of article directories than DB rows. That inference is strong, but it is still an operational-design recommendation rather than an explicit repo requirement.[^5][^7]

I also infer that token tracking should become a first-class dashboard dimension, but the current repo does not yet implement persistent runtime telemetry. The recommendation is forward-compatible by design rather than describing a fully built subsystem.[^10][^11][^12]

## Footnotes

[^1]: `C:\github\worktrees\dashboard\content\schema.sql:10-179`
[^2]: `C:\github\worktrees\dashboard\content\pipeline_state.py:1-317,321-422`
[^3]: `C:\github\worktrees\dashboard\.github\extensions\substack-publisher\extension.mjs:638-723,952-1068,1070-1102,1535-1765,1843-2088`
[^4]: `C:\github\worktrees\dashboard\.github\extensions\table-image-renderer\renderer-core.mjs:1208-1285,1294-1360`
[^5]: `C:\github\worktrees\dashboard\content\article_board.py:72-149,152-197,202-351,385-520,652-672,688-867`
[^6]: `C:\github\worktrees\dashboard\ralph\AGENTS.md:16-29,31-39,69-85`
[^7]: `C:\Users\jdl44\.copilot\session-state\4228ab2a-c16a-459a-9254-4a9a6b7776f6\research\dashboard-state-snapshot.md:1-32`
[^8]: `C:\github\worktrees\dashboard\validate-substack-editor.mjs:2-13,64-80,117-239`
[^9]: `C:\github\worktrees\dashboard\validate-stage-mobile.mjs:2-10,61-68,72-103,129-220`
[^10]: `C:\github\worktrees\dashboard\TOKEN_USAGE_ANALYSIS.md:21-66,92-129,169-196,250-264`
[^11]: `C:\github\worktrees\dashboard\.squad\config\models.json:1-31`
[^12]: `C:\github\worktrees\dashboard\VISION.md:32-39,45-71,123-133,154-159`
[^13]: `C:\github\worktrees\dashboard\batch-publish-prod.mjs:280-381`
[^14]: `C:\github\worktrees\dashboard\.squad\skills\article-lifecycle\SKILL.md:15-27,28-57,112-147,151-253`
[^15]: `C:\github\worktrees\dashboard\content\articles\den-mia-waddle-trade\draft.md:1-47,123-126,212-220`
[^16]: `C:\github\worktrees\dashboard\content\articles\den-mia-waddle-trade\editor-review.md:1-137`
[^17]: `C:\github\worktrees\dashboard\ralph\prd.json:1-153,155-474`
[^18]: `C:\github\worktrees\dashboard\package.json:1-27`

