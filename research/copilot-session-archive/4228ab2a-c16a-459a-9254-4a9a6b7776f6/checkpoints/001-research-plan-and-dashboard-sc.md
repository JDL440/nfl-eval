<overview>
The user first asked for deep research on building a local dashboard for this NFL article pipeline, then asked to turn that research into an implementation plan, and finally the workflow moved into implementation. The approach was: audit the repo’s existing pipeline/data/preview systems, save a fully cited research report, create a structured plan with SQL-tracked todos, then start building a local Node-based read-only dashboard that reuses existing pipeline semantics where possible.
</overview>

<history>
1. The user requested deep research on a local dashboard concept
   - Investigated the repo structure, especially `content/`, `.squad/`, `docs/`, `ralph/`, `pipeline.db`, article directories, image directories, and Substack-related extensions.
   - Read and analyzed `README.md`, `VISION.md`, `TOKEN_USAGE_ANALYSIS.md`, `content/schema.sql`, `content/pipeline_state.py`, `content/article_board.py`, article lifecycle/publisher/image-generation skills, `ralph/AGENTS.md`, and several real article folders.
   - Inspected `.github/extensions/substack-publisher/extension.mjs`, `.github/extensions/table-image-renderer/*`, and validation scripts like `validate-substack-editor.mjs`, `validate-stage-mobile.mjs`, and `publish-stage-validation.mjs`.
   - Queried live `pipeline.db` and article artifact inventory with PowerShell/Python to confirm current article counts, stage distribution, notes count, and representative article artifact sets.
   - Wrote a full markdown research report to `C:\Users\jdl44\.copilot\session-state\4228ab2a-c16a-459a-9254-4a9a6b7776f6\research\it-s-getting-to-the-point-that-i-need-a-local-dash.md`.
   - Also wrote a supporting live snapshot file at `...\research\dashboard-state-snapshot.md`.
   - Final research conclusion: the dashboard should be artifact-first but DB-backed, with two main pages (overview board + article detail), and “preview as close as possible to Substack” should reuse publisher-extension semantics rather than generic markdown.

2. The user then asked to turn the research into an implementation plan
   - Re-read the saved research and core codebase files to ground the plan in the current repo.
   - Created `C:\Users\jdl44\.copilot\session-state\4228ab2a-c16a-459a-9254-4a9a6b7776f6\plan.md`.
   - The plan chose a Node-based local dashboard, read-only v1, DB-backed + artifact-enriched overview model, article dossier page, canonical preview work, optional validation hooks, and future token-telemetry placeholders.
   - Reflected the plan into SQL todos and dependencies:
     - `dashboard-foundation`
     - `board-read-model`
     - `overview-page`
     - `article-read-model`
     - `article-detail-page`
     - `canonical-preview`
     - `live-validation-hooks`
     - `token-telemetry-placeholders`
     - `dashboard-docs-and-validation`
   - Exited plan mode; the runtime then pushed work into implementation/autopilot mode.

3. Implementation of the dashboard was started
   - Started with todo tracking: marked `dashboard-foundation` as `in_progress`.
   - Launched a background `squad` agent (`dashboard-implementation`) to build the dashboard from the saved plan.
   - The squad run spun up at least two visible sub-agents:
     - `analytics-dashboard-map` (completed)
     - `lead-dashboard-build` (still running at the last check)
   - Read the completed analytics handoff, which mapped the DB/view contracts, `article_board.py` semantics, publisher-extension functions that should be reused for preview fidelity, dense-table/mobile validation caveats, and repo constraints.
   - Inspected repo changes as they landed: `dashboard/` directory was created, `package.json` gained run scripts, `README.md` gained dashboard docs, and agent history files were updated.
   - Read the newly created dashboard implementation files to audit whether they actually match the plan.

4. Most recent work before compaction
   - Audited the new dashboard code and identified that the current implementation is only a first cut.
   - Confirmed the dashboard app exists and has routes/pages/API, but found important fidelity gaps:
     - The preview path uses a custom approximate markdown-to-HTML renderer instead of reusing publisher-extension logic.
     - The preview route likely breaks image paths because markdown image sources remain relative paths like `../../images/...` while the server only exposes repo images through `/image/...`.
     - The preview is explicitly documented as approximate, which falls short of the earlier plan to reuse publisher semantics as much as practical.
   - At the moment compaction happened, I was in the middle of reviewing the dashboard code and planning direct fixes.
</history>

<work_done>
Files created:
- `C:\Users\jdl44\.copilot\session-state\4228ab2a-c16a-459a-9254-4a9a6b7776f6\research\it-s-getting-to-the-point-that-i-need-a-local-dash.md`
- `C:\Users\jdl44\.copilot\session-state\4228ab2a-c16a-459a-9254-4a9a6b7776f6\research\dashboard-state-snapshot.md`
- `C:\Users\jdl44\.copilot\session-state\4228ab2a-c16a-459a-9254-4a9a6b7776f6\plan.md`
- `C:\github\worktrees\dashboard\dashboard\server.mjs`
- `C:\github\worktrees\dashboard\dashboard\data.mjs`
- `C:\github\worktrees\dashboard\dashboard\render.mjs`
- `C:\github\worktrees\dashboard\dashboard\templates.mjs`
- `C:\github\worktrees\dashboard\dashboard\public\style.css`

Files modified:
- `C:\github\worktrees\dashboard\package.json`
- `C:\github\worktrees\dashboard\README.md`
- `.squad/agents/analytics/history.md` (agent-generated)
- `.squad/agents/lead/history.md` (agent-generated)

SQL todos created:
- 9 todos inserted with dependency graph.
- `dashboard-foundation` was updated to `in_progress`.
- All other dashboard todos remained `pending` at last check.

What currently exists in the dashboard implementation:
- Local Node HTTP server with routes for:
  - `/`
  - `/article/:slug`
  - `/preview/:slug`
  - `/api/board`
  - `/api/article/:slug`
- Zero external runtime dependencies; uses `node:http`, `node:sqlite`, and filesystem APIs.
- Read model that reads `pipeline.db` and reimplements some `article_board.py` semantics in Node.
- Server-rendered HTML templates for board/detail/preview pages.
- Basic CSS styling.
- `package.json` scripts:
  - `npm run dashboard`
  - `npm run dashboard:dev`

Current state / issues:
- The board and article detail pages appear scaffolded and likely usable at a basic level.
- The preview implementation is not yet aligned with the original plan:
  - It is approximate HTML, not reuse of canonical publisher semantics.
  - It likely has broken image URLs in preview.
- Validation of the dashboard itself has not yet been fully run by me after these changes.
- Background build agents were still running when compaction occurred, so further unreviewed changes may land after this checkpoint.
</work_done>

<technical_details>
- Core repo architecture discovered during research:
  - `content/schema.sql` defines:
    - `articles`
    - `stage_transitions`
    - `article_panels`
    - `discussion_prompts`
    - `editor_reviews`
    - `publisher_pass`
    - `notes`
    - `pipeline_board` view
  - `content/pipeline_state.py` is explicitly the single shared helper for DB writes.
  - `content/article_board.py` is the artifact-first truth/reconciliation layer.

- Important article-board semantics:
  - Stage inference precedence is highest-artifact-wins:
    - `publisher-pass.md`
    - `editor-review*.md`
    - `draft.md`
    - `discussion-summary.md` / `discussion-synthesis.md`
    - >=2 `*-position.md`
    - `panel-composition.md`
    - `discussion-prompt.md`
    - `idea.md`
  - `article_board.py` also provides drift detection, notes gap detection, editor verdict parsing, and image counting across both article dir and `content/images/{slug}`.

- Important publisher-extension semantics discovered during research:
  - `.github/extensions/substack-publisher/extension.mjs` contains the closest thing to canonical preview/publish behavior.
  - Important pure-ish functions identified in research/analytics brief for reuse or extraction:
    - `extractMetaFromMarkdown()`
    - `markdownToProseMirror()`
    - `ensureSubscribeButtons()`
    - `ensureHeroFirstImage()`
    - `validateProseMirrorBody()`
    - table parsing/classification helpers
    - `assertInlineTableAllowed()`
    - `buildCaptionedImage()`
  - Dense table blocking is a hard throw, not just a warning.
  - The extension enforces subscribe widgets and hero-first-image handling.

- Validation scripts and constraints:
  - `validate-substack-editor.mjs` checks whether drafts open cleanly in the real Substack editor and explicitly treats browser validation as the reliable predictor.
  - `validate-stage-mobile.mjs` checks rendering at mobile width and measures image readability.
  - These flows are auth-gated/manual and should be optional dashboard actions, not default page behavior.

- Live repo/data facts discovered during research:
  - `pipeline.db` contained 74 articles at the time of snapshot.
  - Stage/status counts from snapshot:
    - stage 1 proposed: 37
    - stage 2 in_discussion: 3
    - stage 3 in_discussion: 3
    - stage 4 in_discussion: 3
    - stage 5 in_production: 12
    - stage 6 in_production: 7
    - stage 7 in_production: 5
    - stage 8 published: 4
  - `notes` table had 25 rows at time of snapshot.
  - Representative articles like `jsn-extension-preview` and `den-mia-waddle-trade` already contain the full dossier-style artifact set needed for the article detail page.

- Environment and stack choices:
  - Repo root is `C:\github\worktrees\dashboard`.
  - Windows paths must be used.
  - Existing `package.json` is minimal and `type: commonjs`, but the new dashboard code uses `.mjs` modules.
  - Node 22+ is important because both the publisher extension and the dashboard’s `data.mjs` use `node:sqlite`.

- Issues encountered:
  - During research, initial PowerShell heredoc attempts using bash-style `<<'PY'` failed on Windows; switched to PowerShell here-string piping into `python -`.
  - The dashboard implementation generated by the background agent diverged from the intended preview strategy:
    - current `dashboard/render.mjs` is a standalone approximate markdown renderer
    - current `/preview/:slug` does not appear to rewrite local image paths to `/image/...`
  - There was also a stale-looking system notification about a shell command with `read_bash`; the available tooling in this session is PowerShell, not bash.

- Open questions / uncertainty:
  - The background `squad` / `lead-dashboard-build` agents were still running at last check, so repo state may continue to change.
  - I had not yet run my own end-to-end verification of the dashboard server and routes after the new files landed.
  - I had not yet reconciled whether the first-cut Node reimplementation of `article_board.py` is complete enough versus shelling out to Python JSON outputs.
</technical_details>

<important_files>
- `C:\Users\jdl44\.copilot\session-state\4228ab2a-c16a-459a-9254-4a9a6b7776f6\research\it-s-getting-to-the-point-that-i-need-a-local-dash.md`
  - The saved deep research report that drove the plan.
  - Contains the architecture recommendation: artifact-first + DB-backed, two-page dashboard, preview via publisher semantics, token telemetry as future layer.
  - Key sections near the top: Executive Summary, Architecture/System Overview, page-by-page recommendations.

- `C:\Users\jdl44\.copilot\session-state\4228ab2a-c16a-459a-9254-4a9a6b7776f6\research\dashboard-state-snapshot.md`
  - Snapshot of live repo state gathered during research.
  - Includes actual stage counts, article totals, notes totals, and selected artifact inventories.

- `C:\Users\jdl44\.copilot\session-state\4228ab2a-c16a-459a-9254-4a9a6b7776f6\plan.md`
  - Approved implementation plan.
  - Defines the intended phases:
    - dashboard foundation
    - board read model
    - overview page
    - article read model
    - article detail page
    - canonical preview
    - live validation hooks
    - token telemetry placeholders
    - docs/validation

- `C:\github\worktrees\dashboard\content\schema.sql`
  - Canonical dashboard data model source.
  - Important because the board and article detail pages should be driven from this schema and the `pipeline_board` view.
  - Key sections:
    - table definitions (`articles`, `stage_transitions`, `editor_reviews`, `publisher_pass`, `notes`)
    - `pipeline_board` view near the end.

- `C:\github\worktrees\dashboard\content\pipeline_state.py`
  - Single source of truth for pipeline DB writes.
  - Important for future dashboard mutations and for understanding read contracts.
  - Key sections:
    - `get_all_articles`, `get_editor_reviews`
    - `advance_stage`
    - `set_draft_url`
    - `record_editor_review`
    - `record_publisher_pass`
    - `record_note`
    - `record_publish`

- `C:\github\worktrees\dashboard\content\article_board.py`
  - Core artifact-first semantics and drift detection.
  - Essential for overview health, inferred stage, next action, notes gaps, and reconciliation.
  - Key areas:
    - `parse_editor_verdict`
    - `infer_stage`
    - `reconcile`
    - `notes_sweep`
    - CLI modes (`--json`, `notes-sweep`, etc.)

- `C:\github\worktrees\dashboard\.github\extensions\substack-publisher\extension.mjs`
  - The key canonical preview/publish semantics file.
  - Needed for any work that upgrades the dashboard preview from approximate to plan-aligned.
  - Important areas:
    - markdown → ProseMirror conversion
    - subscribe widget enforcement
    - hero-first-image logic
    - ProseMirror validation
    - dense table blocking
    - `publish_to_substack`
    - `publish_note_to_substack`

- `C:\github\worktrees\dashboard\dashboard\server.mjs`
  - New local dashboard server entrypoint.
  - Current routes:
    - `/`
    - `/article/:slug`
    - `/preview/:slug`
    - `/api/board`
    - `/api/article/:slug`
    - `/image/...`
  - Important because it’s the runtime entrypoint added by the implementation agent.

- `C:\github\worktrees\dashboard\dashboard\data.mjs`
  - New Node read model layer.
  - Reimplements some `article_board.py` semantics in JS.
  - Important functions:
    - DB reads
    - `inferStage`
    - `getBoardData`
    - `getArticleDetail`
  - Needs review for parity with Python semantics.

- `C:\github\worktrees\dashboard\dashboard\render.mjs`
  - New first-cut markdown preview renderer.
  - Important because it is currently the main mismatch with the implementation plan.
  - It is approximate HTML-only and does not reuse publisher-extension semantics.

- `C:\github\worktrees\dashboard\dashboard\templates.mjs`
  - New server-rendered page templates.
  - Contains board page, article detail page, tab layout, and preview page.
  - Important because it already implements the two-page information architecture at a basic level.
  - Preview tab currently labels the preview as approximate.

- `C:\github\worktrees\dashboard\dashboard\public\style.css`
  - Styles for board/detail/preview pages.
  - Important for current UI shape and responsiveness.

- `C:\github\worktrees\dashboard\package.json`
  - Modified to add:
    - `dashboard`
    - `dashboard:dev`
  - Needed to run the local dashboard.

- `C:\github\worktrees\dashboard\README.md`
  - Modified to document the new dashboard and its routes/commands.
  - Useful for continuing run/usage validation and updating docs once preview fidelity improves.

- `C:\github\worktrees\dashboard\.squad\decisions\inbox\analytics-dashboard-map.md`
  - Generated by the analytics background agent.
  - Very useful handoff doc mapping:
    - DB fields to read
    - `article_board.py` semantics
    - publisher-extension functions to extract/reuse
    - validation caveats and repo constraints
</important_files>

<next_steps>
Remaining work:
- Review whether the background agents are still writing files; if they are done or no longer needed, stop them to avoid conflicting edits.
- Run local verification on the new dashboard:
  - `npm run dashboard`
  - hit `/`, `/article/:slug`, `/preview/:slug`, `/api/board`, `/api/article/:slug`
- Fix preview fidelity so it matches the approved plan more closely.

Immediate next actions I was about to take:
1. Read the rest of the newly created dashboard code and any additional changes once the agents finished.
2. Start the dashboard locally and verify the routes actually work.
3. Fix the preview pipeline:
   - either extract/reuse publisher-extension functions into a shared module
   - or at minimum adapt preview rendering to follow publisher semantics more closely
4. Fix image handling in preview:
   - rewrite local markdown image paths to dashboard-served `/image/...` paths
   - verify `draft.md` images render in preview
5. Decide whether to keep the Node reimplementation of `article_board.py` logic or shell out to Python JSON for parity.
6. Run relevant validation after changes and then update SQL todos:
   - mark `dashboard-foundation` done if verified
   - move `board-read-model`, `overview-page`, `article-read-model`, `article-detail-page`, and `canonical-preview` forward appropriately
7. Update README/dashboard docs if the preview behavior changes from “approximate” to something stronger.

Potential blocker / caution:
- Because the runtime forced implementation after planning, some generated code landed before I could fully supervise it. The current dashboard exists but should be treated as an intermediate state, not yet a fully verified completion.
</next_steps>