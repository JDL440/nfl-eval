# Local dashboard implementation plan

## Problem

Build a local dashboard for the NFL Lab pipeline with two core experiences:

1. An overview page that shows all articles, current state, queue health, readiness, and drift.
2. An article-centric page that exposes the full article dossier: idea, prompt, panel outputs, draft, editor passes, assets, publish state, note state, and a preview that is as close as practical to final Substack rendering.

The dashboard should be designed so token/cost telemetry can be added later without reworking the information architecture.

## Current state

- Dashboard v1 implemented (overview board, article dossier, canonical preview) and verified against repository data and sample articles.
- Live validation hooks (Phase 2) implemented: stage-only, background worker model that spawns a child process to run existing Playwright CLIs; results persist to `dashboard/validation-results.json` and screenshots to `content/images/stage-validation-screenshots/{slug}/`.
- Structured pipeline state already exists in `content/pipeline.db` via `content/schema.sql`.
- Shared read/write helpers already exist in `content/pipeline_state.py`.
- Artifact-first stage inference, drift detection, and note-gap reporting already exist in `content/article_board.py`.
- Canonical publish-time preview semantics already exist in `.github/extensions/substack-publisher/extension.mjs` and were extracted into a shared preview helper for the dashboard.
- Table rendering for Substack-safe images already exists in `.github/extensions/table-image-renderer/renderer-core.mjs`.
- Browser/mobile validation flows already exist in `validate-substack-editor.mjs` and `validate-stage-mobile.mjs` (these are run by the dashboard via a child process; the original CLI scripts were not modified).

## Proposed approach

Build a lightweight **Node-based local dashboard** so implementation can directly reuse the existing JavaScript preview/publishing logic and stay aligned with the repo’s current extension/runtime tooling.

Guiding principles:

- **Artifact-first, DB-backed**: use `pipeline.db` for fast board queries, but enrich every article with artifact-derived health/drift data from `article_board.py`.
- **Read-only first**: v1 focuses on visibility and preview, not operational mutations. If write actions are added later, route them through `pipeline_state.py`.
- **Canonical preview over generic markdown**: reuse publisher-extension parsing and post-processing logic instead of building a separate markdown renderer.
- **Optional live validation**: support browser-validated preview as an explicit action, not the default rendering path.
- **Telemetry-ready**: add a dashboard slot for token/cost metrics now, but do not invent fake runtime telemetry before the data model exists.

## Assumptions

- v1 will run locally only and can assume repo-local file access.
- Node is the preferred implementation language for the dashboard app because it maximizes reuse of existing extension logic.
- v1 will not publish, edit, or mutate article state from the dashboard unless that proves necessary during implementation.
- Token tracking will be represented as placeholders / empty states until a real persisted telemetry schema is introduced.

## Planned work

### 1. Create dashboard foundation

- Add a local app entrypoint and folder structure for server + UI.
- Add a simple run command in `package.json`.
- Keep dependencies minimal and consistent with the existing repo.

### 2. Build unified read model for the overview page

- Query `pipeline.db` for the board dataset.
- Reuse `article_board.py` semantics for drift, inferred stage, editor readiness, and note gaps.
- Normalize DB rows, inferred artifact state, and derived health flags into a single board payload.

### 3. Implement the overview page

- Article table with filters for team, stage, status, depth, publish readiness, draft URL presence, and drift.
- KPI/header strip for counts by stage and actionable queues.
- Health panels for note gaps, reconciliation drift, and publisher-ready items.

### 4. Build article detail read model

- Aggregate DB row, stage transitions, editor reviews, publisher pass, notes, and all article-directory artifacts.
- Inventory article assets from `content/images/{slug}` and classify inline images, rendered tables, and validation screenshots.
- Expose ordered artifact groups for idea, prompt, panel, summary, draft, reviews, assets, and timeline.

### 5. Implement the article detail page

- Left-rail summary with state, team, publish metadata, and URLs.
- Tabs for Overview, Prompt & Panel, Draft & Edits, Assets, Preview, Publish / Notes, and Timeline.
- Rich artifact viewers for markdown files and review history.

### 6. Implement canonical local preview

- Reuse `.github/extensions/substack-publisher/extension.mjs` parsing/post-processing logic for:
  - markdown to ProseMirror conversion
  - subscribe button insertion
  - hero-first-image enforcement
  - dense-table blocking behavior
- Render a local preview from the canonical transformed structure rather than raw markdown.
- Surface preview warnings when the draft would diverge from the publish path.

### 7. Add optional live validation hooks (IMPLEMENTED)

- Wire explicit actions to run existing validation flows for:
  - Substack editor schema/load validation
  - mobile preview validation
- Implementation notes:
  - Dashboard triggers run a background child-process worker (`dashboard/validation-worker.mjs`) which calls the existing Playwright-based CLIs. The original CLI scripts are left unchanged.
  - Validation is guarded to run only against stage-hosted Substack drafts (stage-only) to prevent accidental runs against production drafts.
  - Results persist to `dashboard/validation-results.json`; screenshots and canonical artifacts are saved under `content/images/stage-validation-screenshots/{slug}/`.
  - Validation runs are manual only (UI button or POST `/api/validate/{editor|mobile}/{slug}`), and the article page polls `/api/validation/{slug}` for status updates.

### 8. Add token telemetry placeholders

- Add overview/detail UI sections for future token/cost metrics.
- Read model should allow a future telemetry table or file source to join cleanly by article + stage + agent/run.
- v1 should clearly label these sections as “not yet instrumented” unless real telemetry exists.

### 9. Document and validate

- Add concise repo-local docs for running the dashboard.
- Validate that board and detail pages render against current repo data.
- Re-run any existing relevant validation commands after implementation.

## Proposed file/component plan

- `package.json`
- New dashboard app directory (server + UI)
- Reused logic imported or extracted from:
  - `.github/extensions/substack-publisher/extension.mjs`
  - `.github/extensions/table-image-renderer/renderer-core.mjs`
  - `content/article_board.py`
  - `content/pipeline_state.py`
- Optional docs update in `README.md` if a run command is added

## Key implementation decisions

- Prefer extracting reusable preview logic from the publisher extension into a shared module if direct import proves awkward.
- Treat `article_board.py` as the semantic source for drift/health rules, even if the dashboard reimplements some read-only logic in Node for runtime convenience.
- Keep v1 dashboard mutations out of scope; focus on visibility, preview fidelity, and operational confidence.
- Expose browser-based validation as a manual action because it depends on auth/cookies and can be slow.

## Risks and mitigations

- **Risk:** Reusing extension code directly may be awkward because it is built as an extension entrypoint.
  - **Mitigation:** Extract shared pure functions into a reusable module and keep the extension as a thin wrapper.

- **Risk:** DB and filesystem can disagree.
  - **Mitigation:** Make drift explicit in the UI and never hide artifact-derived discrepancies.

- **Risk:** Generic preview drifts from actual Substack behavior.
  - **Mitigation:** Reuse publisher transformation rules and offer optional live validation.

- **Risk:** Token tracking UI could become misleading before telemetry exists.
  - **Mitigation:** Implement empty states and schema-ready placeholders only.

## Todo outline

- `dashboard-foundation`
- `board-read-model`
- `overview-page`
- `article-read-model`
- `article-detail-page`
- `canonical-preview`
- `live-validation-hooks`
- `token-telemetry-placeholders`
- `dashboard-docs-and-validation`
