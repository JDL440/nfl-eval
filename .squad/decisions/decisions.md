# Decisions Log

## Code — Editorial Follow-ups (2026-04-02)

**Date:** 2026-04-02  
**Owner:** Code  
**Status:** Approved

### Schedule State Preservation

Preserve schedule `next_run_at` on config edits unless `weekdayUtc` or `timeOfDayUtc` changes. Name, prompt, provider, and editorial-only edits should be state-preserving — the schedule's next run time should not reset simply because metadata changed.

**Rationale:** Editorial changes (name, prompt) should not disrupt running schedules. Only changes to *when* the schedule runs should reset timing.

---

### Migration View Compatibility

Keep migration view compatibility anchored on the live repository/schema contract by dropping `pipeline_board` view and letting `Repository` recreate it instead of hand-maintaining a divergent compatibility view.

**Rationale:** Compatibility views are maintenance debt. Let the source-of-truth (Repository) own the schema; migrations should only concern themselves with data transitions.

## Dashboard Cleanup Decisions (2026-03-29)

### Dashboard Simplification Pass — UX Review

**Date:** 2026-03-30  
**Owner:** UX  
**Status:** Implemented

#### 1. Trace Page — Default to Preview Mode

When a trace block has markdown or JSON preview available, default to showing the preview pane instead of raw text. Users visit traces to understand what happened, not to parse raw JSON. Preview mode surfaces the readable content immediately — raw is one click away if needed.

**Implementation:**
- In `renderTraceBlock()`, flip the default: show `preview` pane by default when `hasJsonPreview || hasMarkdownPreview` is true.
- Keep Raw button first in toolbar, but mark Preview as `.is-active` and show preview pane while hiding raw.
- Script `toggleTracePreview()` already handles toggling correctly.

---

#### 2. Dashboard Home — Remove "A calmer view..." Copy

Remove the page-subtitle line `"A calmer view of the desk, from first pitch to the final publish pass."` from the dashboard hero.

**Rationale:** This is aspirational marketing copy, not functional guidance. "Calmer" is subjective and risks feeling ironic when the desk is busy. Functional UI should not editorialize.

**Implementation:**
- In `home.ts`, remove or empty the `<p class="page-subtitle">` in `.dashboard-hero`.
- Do not replace with another tagline — let the section kicker ("Editorial desk") and h1 ("Dashboard") speak for themselves.

---

#### 3. Dashboard Home — Remove "a calmer workspace" (if present elsewhere)

Audit for any other "calmer" or aspirational copy and remove it. Same rationale as above — functional UI should not editorialize.

---

#### 4. Ready to Publish — Remove High-Level Numbers

Remove the hero stats block (`.dashboard-hero-stats`) showing "ready to publish", "recent ideas", "recently published", "articles in flight" counts.

**Rationale:** These numbers duplicate what the sections themselves show. The hero numbers add visual weight without adding information — they make the page feel like a KPI dashboard instead of a working editorial desk.

**Implementation:**
- In `home.ts`, remove the entire `<div class="dashboard-hero-stats">...</div>` block from the `.dashboard-hero` section.
- Keep the section kicker, h1, and any operational subtitle if we add one later.
- Do not hide the numbers with CSS — remove them from the markup.

---

#### 5. Dashboard Home — Move Intake to Top

Reorder sections so "Recent ideas" (Intake) appears before "Ready to publish" and "Pipeline".

**Rationale:** Intake is where new work enters the system. Placing it first reinforces the editorial workflow: pitch → draft → review → publish. It also makes the "Start a new idea" CTA more prominent.

**Implementation:**
- In `home.ts`, move the `section.section-ideas#recent-ideas` block above `section.section-ready#ready-to-publish`.
- The section ordering inside `.dashboard-grid` should become: Search → **Intake** → Ready to Publish → Pipeline → Recently Published.
- The HTMX `hx-target` selectors and SSE triggers are ID-based, so reordering won't break them.

---

#### 6. Config/Settings Page — Remove "Stage Keys" Section

Remove the `renderRoutingTable()` output showing Stage Key → Model routing.

**Rationale:** Model routing is internal wiring, not operator-facing configuration. Exposing stage keys suggests the user can or should modify them, but they can't from this UI. Keep the LLM Runtime summary (provider, model, URL) but drop the routing table.

**Implementation:**
- In `config.ts`, remove the `${renderRoutingTable(modelRouting)}` call from the LLM Runtime section.
- Keep the `<h2>LLM Runtime</h2>`, the `<dl class="settings-kv">`, and the `modelPolicyError` callout.
- Remove `modelRouting` from the `ConfigPageData` interface and server data fetch if it's no longer displayed.

---

#### 7. Config/Settings Page — Remove "Runtime Paths" Section

Remove the entire "Runtime Paths" panel showing labels like "Data directory", "Article storage", etc.

**Rationale:** File paths are developer/ops context, not editorial context. Operators don't need to know where SQLite lives — they need to know if the system is working. The Services & Maintenance section already covers operational health.

**Implementation:**
- In `config.ts`, remove the `<section class="detail-section settings-panel">` containing `<h2>Runtime Paths</h2>`.
- Remove `runtimePaths` from `ConfigPageData` interface and server data fetch.

---

#### 8. Config/Settings Page — Remove "Prompt Inventory" Section

Remove the panel showing charter and skill file counts.

**Rationale:** Like model routing and file paths, this is internal tooling context. If we want to expose agent capabilities, it should be in a dedicated agent/capability browser, not a settings panel.

**Implementation:**
- In `config.ts`, remove the `<section class="detail-section settings-panel">` containing `<h2>Prompt Inventory</h2>`.
- Remove `charters` and `skills` from `ConfigPageData` interface and server data fetch.

---

### Dashboard Cleanup Follow-up

**Date:** 2026-03-31  
**Agent:** Code  
**Status:** Implemented

#### Changes Made

**Trace Preview Default (traces.ts):**
- Changed trace preview toggles to default to showing preview (markdown or JSON) when available.
- Raw text now hidden by default; users can toggle to see it.
- Rationale: Rendered previews are more useful for quick scanning; raw is still one click away for debugging.

**Calmer Copy Removal:**
- Removed "A calmer view of the desk..." from home.ts dashboard hero.
- Removed "A calmer workspace..." from layout.ts footer.
- Simplified to direct descriptions without editorial tone.

**Dashboard Hero Stats Removal (home.ts):**
- Removed the four high-level number boxes (ready to publish, recent ideas, recently published, articles in flight) from top of dashboard.
- Moved "Intake" (Recent ideas) section to top position after hero.
- Reordered sections: Hero → Intake → Search → Ready to Publish → Pipeline → Published.

**Admin/Config Simplification (config.ts):**
- **Removed stage routing table:** Simplified model routing display from full table to simple list format.
- **Removed Runtime Paths section:** Eliminated Windows paths display.
- **Removed Prompt Inventory section:** Removed charters/skills file counts and lists.
- Rationale: Settings page was too detailed for operator needs; kept only runtime behavior and maintenance controls.

#### UI Contract Changes

- **Tests:** No test changes needed — verified no dashboard tests assert on removed elements.
- **CSS:** Unused CSS rules remain (.dashboard-hero-stats, .hero-stat-*) but can be pruned in future CSS cleanup.
- **HTMX fragments:** No fragment contracts broken — removed elements were full-page only.

#### Pattern Updates

None — changes were content/layout only, no new reusable patterns extracted.

---

### Mobile Dashboard Shell Restyle

**Date:** 2026-03-30  
**Status:** In progress

#### Decisions for Code

1. **Do not spend next pass on body-level overflow prevention.**
   - The shared shell is holding the viewport correctly on reviewed pages.
   - No body/html horizontal overflow observed on home, new idea, settings, article, traces, preview, or publish.

2. **Treat article artifact navigation as the immediate mobile width problem.**
   - On mobile article detail, `.tab-bar` is still a local horizontal scroller.
   - Prefer a premium mobile pattern: a segmented control with truncation + active state, top tabs + "More", or a stacked/disclosure artifact navigator.

3. **Preserve the shared hamburger shell, but restyle it instead of rebuilding it.**
   - `src/dashboard/views/layout.ts` already has the right interaction contract: `aria-expanded`, `.is-open`, outside-click close, escape close, and resize reset.
   - Focus on visual quality: make nav the primary mobile affordance, reduce utility chrome competition, and give the opened state clearer drawer/panel presence.

4. **Reduce the "AI app/control plane" feel by demoting runtime language from primary surfaces.**
   - The biggest offenders are Settings and New Idea, not Home.
   - In `src/dashboard/views/config.ts`, headings like `LLM Runtime`, `Prompt Inventory`, and `Environment Surface` keep the page feeling like operator tooling.
   - In `src/dashboard/views/new-idea.ts`, runtime language arrives too early in the flow.
   - Reframe these as secondary/advanced controls under an editorial-first hierarchy.

5. **Restyle article/operator labels away from internal pipeline vocabulary where possible.**
   - `src/dashboard/views/article.ts` still surfaces internal labels such as `discussion-prompt`, `panel-composition`, `discussion-summary`, and `🧠 Trace` directly in primary interaction space.
   - Keep access to those surfaces, but group them under calmer editorial wording and lower-emphasis affordances.

#### Immediate Implementation Direction

- **Shell:** Keep current shared mobile shell logic; visually elevate the open nav panel and reduce utility dominance.
- **Article detail:** Redesign artifact navigation first; this is the clearest mobile pain point still visible in browser review.
- **Content hierarchy:** Make the article body/draft preview feel like the hero; move AI/runtime controls behind secondary sections, drawers, or disclosures.
- **Tone:** Prefer editorial/product language over infrastructure language on default-visible surfaces.

---

## Depth/Panel Redesign Analysis (2026-04-02)

### Code Decision — Dashboard Depth/Panel Audit

**Date:** 2026-04-02  
**Owner:** Code  
**Status:** Proposed

#### Decision

Treat the preset-based editorial model in `src\types.ts` (`preset_id`, `reader_profile`, `article_form`, `panel_shape`, `analytics_mode`, `panel_constraints_json`) as the target source of truth, and migrate dashboard/UI surfaces to it deliberately instead of extending legacy `depth_level` semantics.

#### Why

`depth_level` is currently overloaded across reader-facing copy, article length, panel sizing, schedule defaults, and model selection. The audit found that:

- `new-idea.ts` and `home.ts` expose only levels 1–3.
- `article.ts`, `config.ts`, `schedules.ts`, schedule APIs, and repository validation accept 1–4.
- `src\types.ts` and `src\llm\model-policy.ts` collapse depth 4 back onto the same orchestration bucket as depth 3.
- schedules already store both `content_profile` and `depth_level`, proving editorial intent and runtime shape are separate concepts.

#### Implication

When this work is implemented, change all affected surfaces together:

1. operator-facing selectors/labels,
2. schedule forms + schedule runtime,
3. article metadata editing,
4. home filters/search,
5. idea creation payloads and defaults,
6. model/panel policy seams,
7. tests and migration/legacy-compatibility copy.

Do **not** ship partial UI changes that rename controls without also reconciling defaults, validation, and legacy mappings.

---

### Research Decision — Depth/Panel Redesign Execution Rules

**Date:** 2026-04-02  
**Owner:** Research  
**Status:** Proposed

#### Context

- The saved research report found that `depth_level` is overloaded across reader-facing labeling, article ambition, panel sizing, model policy, prompts, schedules, API validation, and database state.
- Current product surfaces are inconsistent: some show three values while schedules, metadata, API, and DB allow four.
- Runtime behavior already proves `Feature` is not a distinct orchestration tier because levels 3 and 4 collapse into the same deep-dive bucket.

#### Decision

- Treat the redesign as a split of one overloaded control into explicit dimensions:
  - `reader_profile` for assumed reader sophistication
  - `article_form` for length/ambition, including `feature`
  - `panel_shape` for orchestration topology
  - `analytics_mode` for how aggressively advanced metrics are used
- Keep preset-driven UX for the normal path, with advanced overrides for panel constraints and required/excluded agents.
- Make `panel_shape` the primary runtime input for panel composition and panel sizing; `reader_profile` should influence prose/jargon expectations, not team topology.
- Stop presenting `Feature` as a separate depth level. If it remains user-visible, present it as a preset/article form instead.

#### Non-Negotiable Compatibility / Migration Expectations

- Migration must be additive first: introduce new fields while keeping `depth_level` alive as a compatibility alias/derived field.
- Short-term UI mitigation must remove the current vocabulary mismatch: all user-facing surfaces need coherent preset naming and the same exposed choices.
- Backfill new article/schedule fields from existing `depth_level` plus schedule `content_profile`; specifically, `accessible` schedules must not default to metrics-forward behavior.
- Runtime refactor must update model-policy resolution, panel-size limits, compose-panel inputs, and prompt contracts to consume the split model before `depth_level` removal is attempted.
- Do not drop old validators, API payload support, label maps, migration labels, or filters until every dependent surface has moved to the new fields.
- Preserve schedule semantics during migration: the current approachable-vs-deeper slot behavior must survive as presets/reader-profile behavior, not disappear in the redesign.

#### Why

- This preserves compatibility while removing the root cause of the 3-vs-4 mismatch and the false coupling between audience depth and orchestration shape.
- It also creates a first-class path for trade, cohort, market-map, and feature pieces that do not fit the current single-team depth abstraction.

#### Key Files

- `src\types.ts`
- `src\llm\model-policy.ts`
- `src\pipeline\actions.ts`
- `src\pipeline\idea-generation.ts`
- `src\dashboard\views\new-idea.ts`
- `src\dashboard\views\home.ts`
- `src\dashboard\views\article.ts`
- `src\dashboard\views\config.ts`
- `src\dashboard\views\schedules.ts`
- `src\dashboard\server.ts`
- `src\db\repository.ts`
- `src\migration\migrate.ts`

---

### UX Decision — Article Model Badge Provenance

**Date:** 2026-04-02  
**Owner:** UX  
**Status:** Proposed

#### Context

- Editorial users want the actual LLM model shown on article detail and dashboard cards, not just the provider family.
- Existing article metadata only stores `articles.llm_provider`, while exact model names already exist in `usage_events.model_or_tool`.

#### Decision

- Show the model badge from usage provenance whenever usage events exist.
- Derive the displayed model by choosing the per-article model with the highest combined prompt + output token count.
- Fall back to `articles.llm_provider` only when no usage events are available.
- Keep the badge in the existing badge pattern (`badge badge-model`) on article detail and card views.
- Normalize display labels for readability by trimming `models/` prefixes, dropping `-preview`, and removing trailing `:001`-style suffixes.

#### Why

- Provider badges are too coarse for editorial review; users care which exact model actually produced the work.
- Token-weighted dominance gives a stable "primary model" even when a story mixes smaller auxiliary calls with one main writing model.
- Reusing the existing badge pattern keeps the UI additive and familiar.

#### Key Files

- `src\db\repository.ts`
- `src\dashboard\server.ts`
- `src\dashboard\views\article.ts`
- `src\dashboard\views\home.ts`
- `src\dashboard\public\styles.css`

---

## End of Decisions
