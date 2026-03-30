# Dashboard and article-page removal research report

## Executive Summary

The top-of-page `Agents`, `Memory`, `Runs`, and `Config` buttons are centralized in one place, `renderLayout()`, so removing them from the visible header is a small UI change; however, each button currently leads to a fully implemented page family with dedicated routes, view modules, and tests, so fully deleting those features is a much larger cleanup than the header change alone.[^1][^2][^3][^4][^5]

The article detail page currently composes four major surfaces: a pipeline activity bar, the metadata/header block, a dot-based stage timeline, a right sidebar with token usage and stage runs, and an `Advanced` accordion that nests trace summary, roster, audit log, article metadata, and per-article context configuration.[^6][^7][^8]

You already have the “simple trace button” the request is asking for in spirit: the action panel renders a `Full Trace Timeline` link to `/articles/:id/traces`, and that route already has a dedicated full-page timeline view plus standalone trace pages.[^9][^10] That means the advanced trace summary can be deleted without losing trace access; the existing button can simply be renamed or simplified.[^9][^10]

The deepest cleanup opportunity is to split work into two layers: first, remove the requested UI surfaces from the article page and header; second, decide whether the admin/debug subsystems (`Agents`, `Memory`, `Runs`, `Config`) should remain as hidden routes or be deleted entirely with their routes, helpers, CSS, and tests.[^2][^3][^4][^5]

## Architecture/System Overview

The dashboard shell is server-rendered from `src\dashboard\server.ts` and `src\dashboard\views\*.ts`; the shared header/footer live in `renderLayout()`, which is why the top navigation buttons are all controlled from a single template.[^1]

The article detail page is assembled in `GET /articles/:id`, which loads transitions, editor reviews, revision history, usage events, stage runs, LLM traces, artifacts, and pinned agents before calling `renderArticleDetail()`.[^6] The same page also keeps parts of the UI live with SSE/HTMX partials: `live-header` refreshes the title+timeline block, `live-artifacts` refreshes the artifact tabs, and `live-sidebar` re-renders usage, stage runs, and advanced content.[^7]

The dedicated trace experience is already separate from the article page. `GET /articles/:id/traces` renders the full article trace timeline, while `GET /traces/:id` renders a standalone trace detail page.[^10] This separation is important because it means article-page simplification does **not** require deleting trace persistence or trace pages.[^10][^11]

```text
renderLayout()
  ├─ Home (/)
  ├─ Agents (/agents)
  ├─ Memory (/memory)
  ├─ Runs (/runs, /runs/:id)
  ├─ Config (/config)
  └─ Article (/articles/:id)
       ├─ live-header -> title + stage timeline
       ├─ live-artifacts -> artifact tabs
       ├─ live-sidebar -> usage + stage runs + advanced
       └─ traces button -> /articles/:id/traces
```

## Findings by Removal Area

### 1. Header buttons on the top of the page

The four buttons you named are all emitted in one contiguous block inside `renderLayout()`: `Agents`, `Memory`, `Runs`, and `Config` sit beside `+ New Idea`, the theme toggle, and the environment badge.[^1] If the product change is only “remove those buttons from the header,” this is a one-file view edit.[^1]

If the product change is “delete those features entirely,” each button currently fronts a complete subsystem:

| Surface | Primary route(s) | Primary view file | Notable backend/helpers | Tests tied to it |
|---|---|---|---|---|
| Agents | `/agents`, `/agents/:name`, `/agents/skills/:name`, multiple HTMX/API edit/history routes | `C:\github\nfl-eval\src\dashboard\views\agents.ts` | `readCharterSummaries()`, `readSkillSummaries()`, `resolveCharterPath()`, refresh-knowledge routes | `tests\dashboard\agents.test.ts`[^2][^12][^13] |
| Memory | `/memory`, `/htmx/memory`, `/api/memory/*` | `C:\github\nfl-eval\src\dashboard\views\memory.ts` | CRUD and maintenance routes over `AgentMemory` plus direct DB admin operations | server-side code in `server.ts`; browser UI in `memory.ts`[^3][^14] |
| Runs | `/runs`, `/htmx/runs`, `/runs/:id` | `C:\github\nfl-eval\src\dashboard\views\runs.ts` | `getAllStageRuns()`, `countAllStageRuns()`, `getStageRunDetail()`, `getStageRunLlmTraces()` | `tests\dashboard\runs.test.ts`[^4][^15][^16] |
| Config | `/config` | `C:\github\nfl-eval\src\dashboard\views\config.ts` | env inspection + model-routing inspection | `tests\dashboard\config.test.ts`[^5][^17] |

My recommendation is to treat header-button removal and subsystem deletion as two different scopes. The header edit is trivial; deleting the subsystems is a coordinated route/view/test cleanup.[^1][^2][^3][^4][^5]

### 2. Article-page stage circles (`1` through `8`)

The circles are the `renderStageTimeline()` output in `article.ts`; the dots and connectors are styled with a dedicated CSS block in `styles.css`.[^8][^18] The stage timeline is rendered both in the initial article page and in `renderLiveHeader()`, which means removing it should also simplify the `live-header` partial and let the article page stop fetching transitions **for UI purposes**.[^6][^7][^8]

This removal has a nice cleanup tail:

- Delete `renderStageTimeline()` and its call sites in `renderArticleDetail()` and `renderLiveHeader()`.[^8]
- Delete the timeline CSS selectors `.stage-timeline`, `.stage-dot`, and `.stage-connector`.[^18]
- Delete the article-view tests that assert `stage-dot` classes and connectors.[^19]

One caution: `stage_transitions` and `repo.getStageTransitions()` are **not** article-page-only data. The repository method is also used by CLI/export tooling, so you should remove the article-page rendering dependency, but you should **not** drop transition persistence or the repository method globally just because the circles go away.[^20]

### 3. Article-page `Stage Runs` section on the right

The sidebar section is rendered by `renderStageRunsPanel()` and injected in two places: the initial article render and `renderLiveSidebar()` for SSE refreshes.[^8] The server also exposes a dedicated `GET /htmx/articles/:id/stage-runs` endpoint, but there is no in-repo UI reference to that endpoint; the current page path uses the full `live-sidebar` refresh instead.[^7][^21]

That makes the stage-runs panel a strong removal candidate with clear backend fallout:

- View removal: `renderStageRunsPanel()` and its article-page call sites.[^8]
- Route removal: `GET /htmx/articles/:id/stage-runs` looks orphaned today.[^21]
- Repository cleanup: `repo.getStageRuns()` is only used by the article page and that HTMX endpoint, so it becomes dead if both are removed.[^22]
- CSS cleanup: `.stage-runs`, `.stage-run*` selectors become removable.[^23]
- Test cleanup: Wave 2 tests and article-page tests explicitly assert `Stage Runs` content and the dedicated HTMX route.[^24]

This is one of the cleanest “delete UI + delete backend + delete tests” opportunities in the codebase.[^8][^21][^22][^23][^24]

### 4. Everything under `Advanced`

The `Advanced` accordion is all in one function, `renderAdvancedSection()`. It nests five things: trace summary, roster panel, audit log, article metadata, and context-config editing.[^8] Removing the accordion from the article page is therefore mechanically straightforward, but the sub-features differ in how coupled they are.

#### 4a. Trace summary inside `Advanced`

The trace summary is provided by `renderTraceSummaryPanel()`, but the actual trace experience already lives on `/articles/:id/traces` and `/traces/:id`.[^10][^11] Because the action panel already includes a trace-timeline button, the summary card is redundant UI rather than core functionality.[^9][^10]

This is a high-confidence cleanup:

- Remove `renderTraceSummaryPanel()` from `renderAdvancedSection()`.[^8]
- Keep the existing `/articles/:id/traces` route and full-page trace views.[^10][^11]
- Rename the existing `Full Trace Timeline` button to something simple like `Trace` if you want the article page to expose only one trace entry point.[^9]

#### 4b. Roster panel

The roster panel is article-page-only UI: it lazy-loads `GET /htmx/roster/:team`, which converts `buildTeamRosterContext()` output into HTML for display.[^25] That display route can be removed with the panel.

However, roster context itself is a real pipeline dependency. The runner and pipeline actions inject roster context into prompts, and `pipeline\context-config.ts` also includes `roster-context.md` in default upstream artifacts for several stages.[^26][^27] So the right cleanup is “delete the roster viewer UI,” **not** “delete roster context from the system.”[^25][^26][^27]

#### 4c. Audit log and article metadata blocks

The audit log and article metadata blocks are only rendered inside `renderAdvancedSection()`.[^8] The audit log relies on `repo.getStageTransitions()` and the article metadata block uses pinned-agent/article fields already loaded for the page.[^6][^8]

UI-wise, these are easy deletions. Data-wise, transition history should stay persisted because it is still used outside the page, while article metadata itself obviously must remain because it is part of the article record and inline metadata editing is still a live feature above the fold.[^6][^20][^28]

#### 4d. Context-config editor

The context-config editor is the most important `Advanced` sub-feature to handle carefully. The UI is rendered in `renderContextConfigInner()`/`renderContextConfigPanel()` and backed by `GET /htmx/articles/:id/context-config` plus `POST`/`DELETE /api/articles/:id/context-config`.[^25][^29]

But those routes are not just decorative: per-article context overrides are stored as `_config.json`, and pipeline actions read those overrides through `getArticleContextOverrides()` when assembling upstream prompt context.[^27][^29] In other words, the **editor UI** is optional, but the **override mechanism** is a real runtime feature.[^27][^29]

So there are two valid cleanup levels:

- **UI-only removal:** delete the advanced context-config editor and its article-page routes, but keep `pipeline\context-config.ts` and the pipeline-side override loading so existing `_config.json` artifacts still work.[^25][^27][^29]
- **Feature removal:** delete the article-page editor, the routes, the helper rendering code, and the pipeline-side override handling; this is a broader product decision because it removes per-article prompt tuning entirely.[^27][^29]

### 5. Replace all of that with a simple trace button

You do not need new backend for this. `renderActionPanel()` already emits a trace link for every article state, and the destination route `/articles/:id/traces` is already implemented.[^9][^10] The smallest product-consistent change is:

1. Keep the action-panel trace link.
2. Rename it from `Full Trace Timeline` to `Trace`.
3. Remove the `Advanced` trace summary and any trace links that depend on `/runs/:id` if the runs page is also being deleted.[^9][^10][^15]

That is a cleaner UX because it preserves full trace access while removing duplicated trace affordances from the article detail page.[^8][^9][^10]

## Whole-Subsystem Deletion Candidates

If the goal is a much leaner maintenance surface — not just a cleaner article page — these are the subsystem-level deletions I would seriously consider.

### A. Delete the `Runs` subsystem entirely

This is the strongest full-subsystem deletion candidate if you are comfortable making trace pages the only debugging surface. The runs subsystem consists of `/runs`, `/htmx/runs`, `/runs/:id`, the `runs.ts` view file, the repository aggregation helpers used only by those pages, CSS for runs tables, and a full dedicated test file.[^4][^15][^16][^22][^23]

The main coupling to watch is trace linking: both the article-page trace summary and the full trace timeline can render links that currently jump through `/runs/:id#trace-*`.[^11] If you delete runs, update those links to point directly to `/traces/:id` or remove them where you are already removing summary UI.[^11]

### B. Delete the `Config` page, or keep it but hide it

The `Config` page is operationally useful but not part of the editorial workflow. Its route and view are isolated, and its tests are self-contained.[^5][^17]

The catch is that the publish UI currently links users to `/config` when Substack is not configured.[^30] If you delete the page entirely, replace those hints with plain `.env` instructions rather than route-based guidance.[^30]

### C. Delete the `Agents` UI, but keep charters/skills as runtime files

The agents UI is entirely administrative: listing charters, editing charters and skills, viewing edit history, and manually triggering knowledge refresh for an agent.[^2][^12][^13] None of that is required for day-to-day article workflow as long as the underlying charter/skill files remain in the filesystem for the runner to consume.[^2][^31]

If you delete this subsystem, `readCharterSummaries()`, `readSkillSummaries()`, and `resolveCharterPath()` become dead server helpers, and most of `views\agents.ts` plus the related tests can go with them.[^13][^31]

One noteworthy extra: `POST /api/agents/refresh-all` appears unlinked in the repo and has no in-repo UI consumer, so it is a particularly good candidate for outright deletion if the agents admin surface is going away.[^32]

### D. Delete the `Memory` browser, but keep runtime memory

The memory page is also an admin surface rather than a workflow page. It provides browsing, CRUD, decay, prune, and manual entry creation over `AgentMemory`.[^3][^14]

But the memory system itself is still runtime infrastructure: the runner recalls memories before runs, config/bootstrap code stores memories, and roster-context/bootstrap code stores domain knowledge.[^33] So, like roster context, the right decision is often “delete the browser UI, keep the runtime subsystem.”[^14][^33]

If you do remove the browser UI, also remove the agent-detail memory section and the `View All in Memory Browser` cross-link from `renderAgentMemorySection()`.[^14][^34]

## Already-Dead or Likely-Orphaned Code

These are the strongest “remove immediately” candidates I found.

### 1. `renderContextConfigShell()` is already unused

`renderContextConfigShell()` is exported from `article.ts`, but the only repo reference is its own definition; there are no call sites in `src` or tests.[^35] This is genuine dead code and can be deleted without any product decision.

### 2. `GET /htmx/articles/:id/stage-runs` is likely orphaned

The route exists in `server.ts`, and tests exercise it, but there are no in-repo UI references to that endpoint; the real article page uses the combined `live-sidebar` partial instead.[^7][^21][^24] If you remove the stage-runs panel, this route and its test coverage should disappear with it.[^21][^24]

### 3. `GET /htmx/articles/:id/usage` is likely orphaned

Like the stage-runs endpoint, `GET /htmx/articles/:id/usage` exists in `server.ts`, but there are no UI references to it in the source tree.[^36] The live article sidebar renders usage through `renderLiveSidebar()`, not this standalone endpoint.[^7][^8][^36] If token-usage stays on the page, you can still delete this endpoint as redundant.

### 4. `POST /api/agents/refresh-all` is unlinked

I found the route definition, but no source-tree view or test references to it.[^32] That does not prove nobody calls it manually, so I would rate it as “high-probability orphan” rather than “proven dead,” but it is still a strong cleanup candidate if the agents admin surface is being removed.[^32]

## Recommended Removal Plan

### Tier 1: High-confidence removals

These are the safest cleanup wins with the least architectural risk.

- Remove `Agents`, `Memory`, `Runs`, and `Config` from the header template in `renderLayout()`.[^1]
- Remove the article stage timeline, its CSS, and the tests that assert `stage-dot` rendering.[^8][^18][^19]
- Remove the article `Stage Runs` panel, the orphan HTMX stage-runs endpoint, its CSS block, and the repository helper `getStageRuns()`.[^8][^21][^22][^23][^24]
- Remove the advanced trace summary and keep only the existing trace-page button/route.[^9][^10][^11]
- Delete `renderContextConfigShell()` and the redundant `/htmx/articles/:id/usage` endpoint.[^35][^36]

### Tier 2: Product-decision removals

These are cleanly removable, but they change product capabilities rather than just deleting redundant UI.

- Delete the `Advanced` accordion entirely, including roster viewer, audit log, article metadata block, and context-config editor UI.[^8][^25]
- Delete the whole `Runs` debug subsystem if trace pages are enough.[^4][^15][^16]
- Delete the `Config` page after replacing publish-page links to `/config` with inline instructions.[^5][^17][^30]
- Delete the `Agents` and `Memory` admin UIs while keeping their runtime file/data systems.[^2][^3][^14][^33]

### Tier 3: Keep even after the cleanup

These parts still look useful or are still used elsewhere.

- Keep trace persistence and the trace pages (`/articles/:id/traces`, `/traces/:id`).[^10][^11]
- Keep `stage_transitions` persistence and `repo.getStageTransitions()` because they are used outside the article page by export/tools code.[^20]
- Keep the runtime context-config mechanism unless you explicitly want to abolish per-article overrides as a feature.[^27][^29]
- Keep the runtime memory system even if the memory browser goes away.[^33]

## Confidence Assessment

**High confidence:** the header buttons, stage timeline, stage-runs panel, advanced-section composition, trace-route existence, `renderContextConfigShell()` dead export, and the likely orphan status of `/htmx/articles/:id/stage-runs` and `/htmx/articles/:id/usage` are all directly verified from current source and test references.[^1][^7][^8][^10][^21][^35][^36]

**Medium confidence:** `POST /api/agents/refresh-all` looks unlinked in the repository, but an external caller could still exist; I would confirm with logs or usage history before deleting that specific endpoint in production.[^32]

**Important product caveat:** removing the advanced context-config **UI** is easy, but removing the context-config **feature** is broader because pipeline actions still read `_config.json` overrides at runtime.[^27][^29]

## Footnotes

[^1]: `C:\github\nfl-eval\src\dashboard\views\layout.ts:32-55`
[^2]: `C:\github\nfl-eval\src\dashboard\views\agents.ts:90-140`; `C:\github\nfl-eval\src\dashboard\server.ts:2312-2442`
[^3]: `C:\github\nfl-eval\src\dashboard\views\memory.ts:162-303`; `C:\github\nfl-eval\src\dashboard\server.ts:2465-2647`
[^4]: `C:\github\nfl-eval\src\dashboard\views\runs.ts:132-257`; `C:\github\nfl-eval\src\dashboard\server.ts:2861-2901`
[^5]: `C:\github\nfl-eval\src\dashboard\views\config.ts:86-132`; `C:\github\nfl-eval\src\dashboard\server.ts:914-1051`
[^6]: `C:\github\nfl-eval\src\dashboard\server.ts:758-810`
[^7]: `C:\github\nfl-eval\src\dashboard\server.ts:1724-1749`
[^8]: `C:\github\nfl-eval\src\dashboard\views\article.ts:165-217`; `C:\github\nfl-eval\src\dashboard\views\article.ts:296-345`; `C:\github\nfl-eval\src\dashboard\views\article.ts:892-907`; `C:\github\nfl-eval\src\dashboard\views\article.ts:1222-1256`
[^9]: `C:\github\nfl-eval\src\dashboard\views\article.ts:551-576`; `C:\github\nfl-eval\src\dashboard\views\article.ts:607-612`; `C:\github\nfl-eval\src\dashboard\views\article.ts:656-663`; `C:\github\nfl-eval\src\dashboard\views\article.ts:703-709`
[^10]: `C:\github\nfl-eval\src\dashboard\server.ts:813-831`; `C:\github\nfl-eval\src\dashboard\views\traces.ts:307-350`
[^11]: `C:\github\nfl-eval\src\dashboard\views\traces.ts:221-245`; `C:\github\nfl-eval\src\dashboard\views\traces.ts:249-305`
[^12]: `C:\github\nfl-eval\tests\dashboard\agents.test.ts:92-177`; `C:\github\nfl-eval\tests\dashboard\agents.test.ts:192-245`; `C:\github\nfl-eval\tests\dashboard\agents.test.ts:362-391`
[^13]: `C:\github\nfl-eval\src\dashboard\server.ts:2255-2442`
[^14]: `C:\github\nfl-eval\src\dashboard\views\memory.ts:73-157`; `C:\github\nfl-eval\src\dashboard\views\memory.ts:162-303`
[^15]: `C:\github\nfl-eval\tests\dashboard\runs.test.ts:90-316`
[^16]: `C:\github\nfl-eval\src\db\repository.ts:376-495`
[^17]: `C:\github\nfl-eval\tests\dashboard\config.test.ts:110-142`
[^18]: `C:\github\nfl-eval\src\dashboard\public\styles.css:499-545`
[^19]: `C:\github\nfl-eval\tests\dashboard\server.test.ts:901-912`
[^20]: `C:\github\nfl-eval\src\db\repository.ts:498-503`; `C:\github\nfl-eval\src\tools\pipeline-tools.ts:108-108`; `C:\github\nfl-eval\src\cli\export.ts:73-73`
[^21]: `C:\github\nfl-eval\src\dashboard\server.ts:1715-1719`; `C:\github\nfl-eval\src\dashboard\views\article.ts:304-315`
[^22]: `C:\github\nfl-eval\src\db\repository.ts:363-368`; `C:\github\nfl-eval\src\dashboard\server.ts:801-803`; `C:\github\nfl-eval\src\dashboard\server.ts:1715-1719`; `C:\github\nfl-eval\src\dashboard\server.ts:1742-1747`
[^23]: `C:\github\nfl-eval\src\dashboard\public\styles.css:1342-1379`
[^24]: `C:\github\nfl-eval\tests\dashboard\wave2.test.ts:346-383`; `C:\github\nfl-eval\tests\dashboard\wave2.test.ts:468-499`; `C:\github\nfl-eval\tests\dashboard\wave2.test.ts:502-533`
[^25]: `C:\github\nfl-eval\src\dashboard\server.ts:1552-1666`; `C:\github\nfl-eval\src\dashboard\views\article.ts:913-1065`
[^26]: `C:\github\nfl-eval\src\agents\runner.ts:503-588`; `C:\github\nfl-eval\src\pipeline\actions.ts:942-959`; `C:\github\nfl-eval\src\pipeline\actions.ts:1070-1159`; `C:\github\nfl-eval\src\pipeline\actions.ts:1401-1414`
[^27]: `C:\github\nfl-eval\src\pipeline\context-config.ts:10-55`; `C:\github\nfl-eval\src\pipeline\actions.ts:721-777`
[^28]: `C:\github\nfl-eval\src\dashboard\views\article.ts:70-162`; `C:\github\nfl-eval\src\dashboard\server.ts:836-886`; `C:\github\nfl-eval\tests\dashboard\metadata-edit.test.ts:106-146`
[^29]: `C:\github\nfl-eval\src\pipeline\context-config.ts:57-91`; `C:\github\nfl-eval\src\dashboard\server.ts:1561-1666`; `C:\github\nfl-eval\tests\dashboard\server.test.ts:728-802`
[^30]: `C:\github\nfl-eval\src\dashboard\views\publish.ts:235-237`; `C:\github\nfl-eval\src\dashboard\views\publish.ts:415-423`; `C:\github\nfl-eval\tests\dashboard\publish.test.ts:298-315`
[^31]: `C:\github\nfl-eval\src\dashboard\views\agents.ts:169-295`; `C:\github\nfl-eval\src\dashboard\server.ts:2255-2418`
[^32]: `C:\github\nfl-eval\src\dashboard\server.ts:2783-2859`; `C:\github\nfl-eval\src\dashboard\views\agents.ts:186-208`; `C:\github\nfl-eval\tests\dashboard\agents.test.ts:362-391`
[^33]: `C:\github\nfl-eval\src\agents\runner.ts:884-884`; `C:\github\nfl-eval\src\config\index.ts:186-186`; `C:\github\nfl-eval\src\pipeline\roster-context.ts:504-511`
[^34]: `C:\github\nfl-eval\src\dashboard\server.ts:2342-2347`; `C:\github\nfl-eval\src\dashboard\views\memory.ts:294-302`
[^35]: `C:\github\nfl-eval\src\dashboard\views\article.ts:978-991`
[^36]: `C:\github\nfl-eval\src\dashboard\server.ts:1706-1710`; `C:\github\nfl-eval\src\dashboard\views\article.ts:304-315`
