<overview>
This segment focused first on recovering and finishing the `worktrees\V3` multi-provider / multiple-LLM-model work, then improving the V3 dashboard UX so article provider selection is visible and usable from the article detail screen and the New Idea page. Near the end, the user pivoted to a research task: design a single local MCP server that hosts the repo’s nflverse and related data tools; I investigated the current MCP implementations and data-tool architecture but had not yet written/saved the final research report before compaction.
</overview>

<history>
1. The user asked to recover the work on the `V3` branch regarding multiple LLM models after a crash.
   - I checked the session todo board and the `worktrees\V3` git state.
   - I initially restarted several background “port/review” agent lanes to recover prior work and validation context.
   - I gathered findings from multiple finished agents:
     - V3 already had most of the article provider persistence/runtime plumbing.
     - Missing/uncertain seams were mainly dashboard UX surfaces and a broken provider port merge in `src\pipeline\actions.ts`.
     - Some agent reports also flagged unrelated churn in `engine.ts` / `writer-preflight.ts`, which I treated cautiously.
   - I stopped trusting the stale/overlapping agent outputs and directly inspected the V3 code.

2. I verified the actual V3 provider state and discovered the real regression.
   - I read:
     - `worktrees\V3\src\pipeline\actions.ts`
     - `worktrees\V3\src\dashboard\views\article.ts`
     - `worktrees\V3\src\dashboard\server.ts`
     - `worktrees\V3\tests\dashboard\metadata-edit.test.ts`
     - `worktrees\V3\tests\dashboard\server.test.ts`
   - I found that the provider UX/API seams were already present in V3, but `src\pipeline\actions.ts` had a bad merge:
     - duplicate `const providerHint = buildArticleProviderHint(article);` declarations in `generatePrompt()`
     - later uses of `providerHint` in `writeDraft()` / `runEditor()` without an in-scope declaration
   - I ran V3 validation and confirmed the build/tests were failing on those duplicate/missing declarations.

3. I fixed the provider-port regression in V3 and validated it.
   - I surgically edited `worktrees\V3\src\pipeline\actions.ts` to:
     - remove duplicate `providerHint` declarations in `generatePrompt()`
     - add the missing `providerHint` declaration at the top of `writeDraft()`
     - add the missing `providerHint` declaration at the top of `runEditor()`
   - I updated tests:
     - `worktrees\V3\tests\dashboard\metadata-edit.test.ts`
       - fixed response typing to include `provider`
       - added a provider-clear (`null`) PATCH test
     - `worktrees\V3\tests\dashboard\server.test.ts`
       - added an article detail render assertion for persisted provider metadata
   - I ran:
     - `npm run v2:build`
     - `npx vitest run tests\dashboard\metadata-edit.test.ts tests\dashboard\server.test.ts tests\dashboard\wave2.test.ts --pool=threads --poolOptions.threads.singleThread`
   - Both passed.
   - I marked the V3-specific todo `v3-provider-port` done and stored the focused validation command as memory.
   - I also sent “stop work / no more file changes” messages to stale background agents to prevent stray writes.

4. The user asked whether the remaining open todos should be finished.
   - I queried the SQL todo board and found the remaining open items were:
     - `provider-backend-core` — in progress
     - `provider-validation` — pending
   - I concluded these were stale leftovers from the older main-checkout provider rollout, not the recovered V3 lane.
   - I recommended:
     - treat `v3-provider-port` as the real completed V3 work
     - only keep the remaining todos if the user wanted a separate cleanup of the old main-tree rollout

5. The user asked how to select the LLM provider because they didn’t see it in the UX.
   - I inspected V3 article detail UI and confirmed:
     - provider is per-article
     - it was available behind the ✏️ “Edit metadata” form on the article detail page
     - the detail page displayed a provider-routing badge
   - I explained that the provider could be edited there.

6. The user requested that provider selection be available from the New Idea page.
   - I traced the `/ideas/new` UI and `/api/ideas` flow.
   - I found:
     - `repo.createArticle()` already accepted `provider`
     - `/api/ideas` already threaded a request `provider` into:
       - article creation
       - `preferredProvider` / `providerStrategy` on the idea-generation runner call
     - the missing part was the New Idea form/JS
   - I added a provider input to `worktrees\V3\src\dashboard\views\new-idea.ts` and wired the form submission JS to include `provider`.
   - I added tests to `worktrees\V3\tests\dashboard\new-idea.test.ts` for:
     - form rendering
     - persistence of provider on article creation
     - passing provider through to the LLM runner
   - I validated with:
     - `npx vitest run tests\dashboard\new-idea.test.ts --pool=threads --poolOptions.threads.singleThread`
     - `npm run v2:build`
   - Both passed.

7. The user then asked to make provider selection a dropdown on the main New Idea page.
   - I inspected the provider-listing seam and found:
     - `AgentRunner` exposes `runner.gateway`
     - `LLMGateway` exposes `listProviders()`
   - I updated:
     - `worktrees\V3\src\dashboard\views\new-idea.ts`
       - changed the provider field from free-text in Advanced options to a visible top-level `LLM Provider` dropdown
       - accepted `providerOptions` and rendered a `Default routing` option plus registered providers
     - `worktrees\V3\src\dashboard\server.ts`
       - updated `GET /ideas/new` to gather provider IDs from `runner.gateway.listProviders()` and pass them to `renderNewIdeaPage`
     - `worktrees\V3\tests\dashboard\new-idea.test.ts`
       - updated render tests for the dropdown
       - updated route tests to expect `Default routing`
       - added a test proving `/ideas/new` renders registered providers when the runner has them
       - adjusted the mocked runner to provide `gateway.listProviders()` and `listAgents()`
   - I revalidated:
     - `npx vitest run tests\dashboard\new-idea.test.ts --pool=threads --poolOptions.threads.singleThread`
     - `npm run v2:build`
   - Both passed.

8. The user asked how to set up LM Studio in this environment.
   - I inspected the V3 startup/config path:
     - `worktrees\V3\README.md`
     - `worktrees\V3\src\dashboard\server.ts`
     - `worktrees\V3\src\llm\providers\lmstudio.ts`
   - I confirmed the relevant env vars:
     - `LMSTUDIO_URL`
     - `LMSTUDIO_MODEL`
     - optional `LLM_PROVIDER=lmstudio` if the user wants LM Studio as the global default
   - I explained that if `LMSTUDIO_URL` is set, V3 can register `lmstudio` as a provider; no auth token is required.

9. The user asked what `LMSTUDIO_MODEL` value had worked previously.
   - I searched the session store and repo for prior references.
   - I found prior evidence that the working model value had been `qwen-35`, including earlier session logs that said LM Studio registered with model `qwen-35`.
   - I also noted that the current V3 `.env` did not have `LMSTUDIO_MODEL` set at that time.

10. The user said the values were set but `lmstudio` still did not appear in the dropdown.
   - I inspected the actual current V3 `.env` and startup logic.
   - I found two issues:
     - `LLM_PROVIDER=copilot-cli` was forcing startup into a single-provider copilot-cli path
     - `.env` had a typo: `LMSTUDIO_UR=` instead of `LMSTUDIO_URL=`
   - I explained why the dropdown shows registered providers, not arbitrary env values.
   - I recommended leaving `LLM_PROVIDER` unset and setting a correct `LMSTUDIO_URL`.

11. The user asked me to fix those settings using their provided values.
   - I updated `worktrees\V3\.env` to:
     - remove the active `LLM_PROVIDER=...` line so both providers can register
     - set:
       - `LMSTUDIO_URL=http://localhost:1234/v1`
       - `LMSTUDIO_MODEL=qwen/qwen3.5-35b-a3b`
     - add a clarifying comment that `LLM_PROVIDER` should be left unset to register both `copilot-cli` and `lmstudio`
   - I did not echo back or further manipulate the other sensitive `.env` values beyond preserving the file.
   - I told the user to restart the V3 server so the dropdown would reflect the corrected provider registration.

12. The user then requested deep research and design work:
    - “in a previous version of this app - some of the data access and tools were hosted as an MCP server. I want to take any of the data tools that we have from nflverse or other providers and host them as a single local mcp server. research and design this”
   - I began a research pass focused on codebase evidence.
   - I identified:
     - a legacy JS MCP server under `mcp/server.mjs`
     - a newer TS MCP entrypoint under `src/mcp/server.ts`
     - the V2 CLI `mcp` command in `src/cli.ts`
     - extension-based data tools under `.github/extensions/nflverse-query/tool.mjs`
     - the TypeScript `DataService` in `src/services/data.ts`
     - python-backed query scripts under `content/data/`
     - file-based cache implementations in both TS and extension ESM layers
   - Key finding: there is currently a split architecture:
     - `src/cli.ts mcp` still launches the older pipeline-only MCP server (`src/mcp/server.ts`)
     - `.github/extensions/README.md` describes an MCP-first design with a separate aggregator under `mcp/server.mjs`
     - the data tools already exist as extension handlers, but several pipeline modules still shell out directly to Python instead of reusing one shared data-service layer
   - I had not yet written or saved the final markdown research report when compaction was requested.
</history>

<work_done>
Files updated:
- `C:\github\nfl-eval\worktrees\V3\src\pipeline\actions.ts`
  - Fixed broken provider-port merge.
  - Removed duplicate `providerHint` declarations in `generatePrompt()`.
  - Added missing `providerHint` declarations in `writeDraft()` and `runEditor()`.

- `C:\github\nfl-eval\worktrees\V3\tests\dashboard\metadata-edit.test.ts`
  - Updated provider typing in PATCH response assertions.
  - Added provider-clear round-trip test (`provider: null`).

- `C:\github\nfl-eval\worktrees\V3\tests\dashboard\server.test.ts`
  - Added article detail assertion showing persisted provider metadata/routing.

- `C:\github\nfl-eval\worktrees\V3\src\dashboard\views\new-idea.ts`
  - First added provider support to the New Idea form and JS submission payload.
  - Then changed it to a top-level visible dropdown instead of free text in Advanced options.
  - Added `providerOptions` support and `Default routing` option.

- `C:\github\nfl-eval\worktrees\V3\src\dashboard\server.ts`
  - Already had `/api/ideas` support for `provider`.
  - Updated `GET /ideas/new` to pass registered provider IDs from `runner.gateway.listProviders()` into the New Idea page.

- `C:\github\nfl-eval\worktrees\V3\tests\dashboard\new-idea.test.ts`
  - Added tests for provider persistence on article creation.
  - Added tests for provider hint passthrough to the LLM runner.
  - Updated render tests for the New Idea provider dropdown.
  - Added route test proving `/ideas/new` renders registered provider options from the runner.

- `C:\github\nfl-eval\worktrees\V3\.env`
  - Fixed LM Studio settings:
    - removed active `LLM_PROVIDER=...` so both providers can register
    - set `LMSTUDIO_URL=http://localhost:1234/v1`
    - set `LMSTUDIO_MODEL=qwen/qwen3.5-35b-a3b`
    - added comment explaining `LLM_PROVIDER` should remain unset for multi-provider registration

Work completed:
- [x] Recovered the V3 provider-routing work after crash.
- [x] Identified and fixed the `providerHint` build regression in `actions.ts`.
- [x] Validated V3 provider/dashboard changes with:
  - `npm run v2:build`
  - `npx vitest run tests\dashboard\metadata-edit.test.ts tests\dashboard\server.test.ts tests\dashboard\wave2.test.ts --pool=threads --poolOptions.threads.singleThread`
- [x] Added provider selection to the New Idea page.
- [x] Upgraded provider selection on the New Idea page to a visible top-level dropdown.
- [x] Validated New Idea changes with:
  - `npx vitest run tests\dashboard\new-idea.test.ts --pool=threads --poolOptions.threads.singleThread`
  - `npm run v2:build`
- [x] Diagnosed why `lmstudio` was missing from the dropdown.
- [x] Corrected the V3 `.env` LM Studio settings.

Current state:
- The V3 provider-routing recovery is complete and validated.
- The V3 New Idea page now supports provider selection via a top-level dropdown populated from registered providers.
- The dropdown will only show `lmstudio` if the V3 server is restarted after the `.env` fix and startup successfully registers LM Studio.
- Research for a unified local MCP server is in progress but not finalized/saved yet.

Issues encountered:
- Early recovery was noisy because many stale background agents were still alive; I mitigated by directly inspecting code and later telling stale agents to stop.
- `actions.ts` had a broken merge that blocked compile/test until repaired.
- The `.env` bug was a combination of a typo (`LMSTUDIO_UR`) and an active `LLM_PROVIDER=copilot-cli` forcing single-provider registration.
- The MCP research uncovered a launch-path mismatch: the V2 CLI currently starts the older pipeline-only MCP server, while another local-tool MCP aggregation path already exists separately.
</work_done>

<technical_details>
- V3 provider-routing architecture:
  - `Article.provider` stores per-article preferred provider metadata.
  - `stage_runs.requested_provider` is separate and represents per-run requested provider intent.
  - `usage_events.provider` captures actual observed runtime provider usage.
  - These should remain distinct concepts.

- In V3, article provider routing now flows through:
  - dashboard metadata / New Idea UI
  - article persistence in `Repository.createArticle()` / `updateArticle()`
  - pipeline execution via `buildArticleProviderHint(article)`
  - LLM runner fields:
    - `preferredProvider`
    - `providerStrategy`

- Key provider startup behavior in V3:
  - `LLM_PROVIDER=lmstudio` forces LM Studio-only startup path.
  - `LLM_PROVIDER=copilot-cli` forces copilot-cli-only startup path.
  - If `LLM_PROVIDER` is unset, startup uses additive registration:
    - tries Copilot CLI
    - tries Copilot API
    - adds LM Studio if `LMSTUDIO_URL` is set
  - Therefore, to show both `copilot-cli` and `lmstudio` in the New Idea dropdown, `LLM_PROVIDER` must be unset and `LMSTUDIO_URL` must be valid.

- LM Studio specifics:
  - `LMSTUDIO_URL` default is `http://localhost:1234/v1`.
  - `LMSTUDIO_MODEL` can override the default LM Studio model; current configured value is `qwen/qwen3.5-35b-a3b`.
  - Historical evidence suggested the previous working model was `qwen-35`.
  - `LMStudioProvider` auto-detects models with `fetchModels()` when possible and picks the first non-embedding model if no explicit default is set.

- New Idea provider dropdown behavior:
  - It is populated from `runner.gateway.listProviders().map(provider => provider.id)`.
  - The form always includes a `Default routing` option plus any registered provider IDs.
  - The value is sent to `/api/ideas`; blank becomes `null`.
  - `/api/ideas` uses the selected provider both for:
    - persisted article metadata (`repo.createArticle({ provider: requestedProvider })`)
    - Stage 1 idea-generation routing (`preferredProvider`, `providerStrategy: 'prefer'`)

- Verified V3 validation commands:
  - `npm run v2:build`
  - `npx vitest run tests\dashboard\metadata-edit.test.ts tests\dashboard\server.test.ts tests\dashboard\wave2.test.ts --pool=threads --poolOptions.threads.singleThread`
  - `npx vitest run tests\dashboard\new-idea.test.ts --pool=threads --poolOptions.threads.singleThread`

- SQL/todo state:
  - `v3-provider-port` was marked done during recovery.
  - Remaining open todos (`provider-backend-core`, `provider-validation`) appear to be stale leftovers from the older main-checkout provider rollout, not the V3 recovery lane.

- MCP/server research findings (important, unfinished):
  - There are at least three MCP-related surfaces:
    1. `mcp/server.mjs` — legacy/local JS aggregator server for repo extensions
    2. `src/mcp/server.ts` — V2 TypeScript pipeline MCP server exposing pipeline tools (`pipeline_status`, `article_get`, `article_create`, etc.)
    3. `.github/extensions/*` — MCP-style tool definitions + handlers, including `nflverse-query`
  - `src/cli.ts` command `mcp` currently launches `src/mcp/server.ts` (the older pipeline-only MCP server), not the JS aggregator described in `.github/extensions/README.md`.
  - `.github/extensions/README.md` explicitly recommends MCP-first design and says tools should be aggregated into one MCP server.
  - The current nflverse data tools are mostly implemented in `.github/extensions/nflverse-query/tool.mjs` as MCP tool definitions/handlers that shell out to Python scripts in `content/data/`.
  - `src/services/data.ts` is a separate TypeScript façade that also shells out to Python scripts (or can fall back to an HTTP sidecar), meaning there is duplication between extension handlers and app runtime data access.
  - Several pipeline modules (`roster-context.ts`, `fact-check-context.ts`, `validators.ts`) still call Python scripts directly instead of reusing a shared service.
  - There is also duplicated cache logic:
    - TS-side cache defaults in `src/cache/provider.ts`
    - ESM MCP cache wrapper in `.github/extensions/nflverse-query/mcp-cache.mjs`
  - The `content/data/fetch_nflverse.py` script defines the local dataset catalog and parquet-cache fetch/warmup model.
  - The prediction-market query is not nflverse-backed; it uses Polymarket Gamma API with its own Python cache TTL.

Unresolved / not yet completed:
- The final research report for the “single local MCP server” design was not yet written or saved.
- I had not yet decided the final migration recommendation between:
  - promoting the JS extension-aggregator server to canonical
  - promoting the TS server to canonical and importing handlers there
  - or building a new unified server that wraps the shared service layer
- I had not yet saved the mandatory research markdown file at:
  - `C:\Users\jdl44\.copilot\session-state\13f196d1-ec8e-488c-afb5-0ea0ec48bf9a\research\in-a-previous-version-of-this-app-some-of-the-data.md`
</technical_details>

<important_files>
- `C:\github\nfl-eval\worktrees\V3\src\pipeline\actions.ts`
  - Why it matters: central provider hint threading into stage execution.
  - Changes made: fixed duplicate/missing `providerHint` declarations that were breaking build/tests.
  - Key sections:
    - `generatePrompt()` around lines ~1207-1226
    - `writeDraft()` around lines ~1490-1493
    - `runEditor()` around lines ~1718-1723

- `C:\github\nfl-eval\worktrees\V3\src\dashboard\views\article.ts`
  - Why it matters: article detail metadata display/edit surface for provider routing.
  - State: already had Provider Routing display + edit field when recovery inspection occurred.
  - Key sections:
    - `renderArticleMetaDisplay()` around ~163-201
    - `renderArticleMetaEditForm()` around ~204-250
    - advanced metadata / stage-run display later in file also references provider routing and requested provider.

- `C:\github\nfl-eval\worktrees\V3\src\dashboard\server.ts`
  - Why it matters: dashboard HTTP/HTMX routes and New Idea page provider-option injection.
  - Changes/state:
    - already had article metadata PATCH/HTMX provider handling
    - updated `/ideas/new` to pass `providerOptions`
    - `/api/ideas` already supported `provider` and runner hinting
  - Key sections:
    - `POST /htmx/articles/:id/edit-meta` around ~857-895
    - `PATCH /api/articles/:id` around ~1068-1132
    - `POST /api/ideas` around ~1165-1265
    - `GET /ideas/new` around ~905-920
    - provider registration startup around ~2879-2962

- `C:\github\nfl-eval\worktrees\V3\src\dashboard\views\new-idea.ts`
  - Why it matters: New Idea page UX for selecting provider at article creation time.
  - Changes made:
    - added top-level `LLM Provider` dropdown
    - added `providerOptions` support
    - form submission JS sends `provider`
  - Key sections:
    - `renderNewIdeaPage()` signature and provider option setup around ~132-142
    - visible provider dropdown around ~186-192
    - submit handler around ~368-377

- `C:\github\nfl-eval\worktrees\V3\tests\dashboard\metadata-edit.test.ts`
  - Why it matters: provider metadata PATCH/HTMX round-trip coverage.
  - Changes made:
    - include `provider` in response typing
    - added provider-clear test
    - verifies HTMX edit-meta save flow with provider
  - Key sections:
    - PATCH tests around ~57-122
    - HTMX tests around ~124-166

- `C:\github\nfl-eval\worktrees\V3\tests\dashboard\server.test.ts`
  - Why it matters: article detail render assertions.
  - Changes made: added persisted provider render assertion.
  - Key sections:
    - article detail tests around ~268-294

- `C:\github\nfl-eval\worktrees\V3\tests\dashboard\new-idea.test.ts`
  - Why it matters: provider UX and create-flow validation on the New Idea page.
  - Changes made:
    - render tests for provider dropdown
    - persistence test for provider on `/api/ideas`
    - runner passthrough test
    - provider-options render test on `/ideas/new`
  - Key sections:
    - render tests around ~133-177
    - GET `/ideas/new` test around ~217-231
    - prompt-based `/api/ideas` tests around ~232-363
    - LLM-backed route tests around ~367 onward, especially mocked runner setup and provider-option assertion

- `C:\github\nfl-eval\worktrees\V3\.env`
  - Why it matters: actual runtime provider registration settings.
  - Changes made:
    - removed active `LLM_PROVIDER=...`
    - corrected `LMSTUDIO_URL`
    - set `LMSTUDIO_MODEL=qwen/qwen3.5-35b-a3b`
  - Key lines: top of file, especially the LLM section.

- `C:\github\nfl-eval\src\mcp\server.ts`
  - Why it matters: current V2 CLI `mcp` target.
  - Research finding: exposes pipeline tools only; it is the server launched by `src/cli.ts mcp`.
  - Key sections:
    - tool list at top (~30-153)
    - `createMCPServer()` around ~200
    - `startMCPServer()` around ~473-478

- `C:\github\nfl-eval\mcp\server.mjs`
  - Why it matters: separate JS MCP aggregator that imports extension handlers.
  - Research finding: already registers publishing/image/data tools as a single local MCP server.
  - Key sections:
    - imports and normalization helpers near top
    - tool registration for publishing/data tools throughout file
    - stdio startup around ~258-260

- `C:\github\nfl-eval\.github\extensions\nflverse-query\tool.mjs`
  - Why it matters: current MCP-style implementation of nflverse/local data tools.
  - Research finding: defines tool metadata + handlers for player stats, team efficiency, rankings, snaps, draft, NGS, combine, PFR defense, historical comps, rosters, cache refresh, etc.
  - Key sections:
    - shell-out helper near top (~21-45)
    - per-tool exports/handlers throughout
    - rosters around ~515-533
    - cache refresh around ~538-590

- `C:\github\nfl-eval\src\services\data.ts`
  - Why it matters: TypeScript data-service façade for the same dataset family.
  - Research finding: duplicates much of the extension handler logic but exposes it for app runtime; supports scripts/http/auto modes.
  - Key sections:
    - architecture comment at top (~1-12)
    - public query methods (~111 onward)
    - `runScript()` / `query()` internals (~312 onward)

- `C:\github\nfl-eval\content\data\fetch_nflverse.py`
  - Why it matters: authoritative dataset catalog and cache warmer.
  - Research finding: shows exactly which datasets are supported and how local parquet caching works.
  - Key sections:
    - `DATASETS` map around ~28-48
    - cache/fetch behavior around ~60-100

- `C:\github\nfl-eval\.github\extensions\README.md`
  - Why it matters: explicitly documents the intended MCP-first design and current aggregation pattern.
  - Research finding: recommends one MCP server aggregating tool handlers and deprecates native extension loading.
  - Key sections:
    - MCP-first rationale around ~5-16
    - current implementation layout around ~17-42
    - setup/testing guidance around ~76-139
</important_files>

<next_steps>
Remaining work:
- Finish the research/design task for hosting the nflverse and related data tools as a single local MCP server.
- Write and save the required research markdown report to:
  - `C:\Users\jdl44\.copilot\session-state\13f196d1-ec8e-488c-afb5-0ea0ec48bf9a\research\in-a-previous-version-of-this-app-some-of-the-data.md`
- Then provide the user a concise summary pointing at that file.

Recommended immediate next steps for the research task:
1. Synthesize the findings already gathered into a technical deep-dive report with:
   - executive summary
   - architecture overview
   - current-state inventory
   - gaps/duplication analysis
   - recommended target design for a single canonical local MCP server
   - migration plan
   - operational setup/runbook
   - confidence assessment
   - footnotes with file/line citations
2. In the design, explicitly address:
   - whether to consolidate on `mcp/server.mjs` or replace `src/mcp/server.ts`
   - how to share one canonical handler/service layer between:
     - MCP server
     - dashboard runtime
     - pipeline helpers
   - how to eliminate duplicate Python shell-out wrappers and duplicate cache logic
   - how to include non-nflverse providers like prediction markets in the same local MCP server
3. Save the report to the required session-state research path.
4. Return a concise summary to the user.

Pending runtime/user-facing note:
- For the provider dropdown / LM Studio work, the V3 server still needs to be restarted to pick up the corrected `.env` and show `lmstudio` if it is not already restarted.

Board/todo cleanup note:
- The remaining SQL todos are likely stale leftovers from the older main-checkout provider rollout.
- If continuing beyond the research task, consider either:
  - marking them superseded/complete relative to V3
  - or renaming one into an explicit main-tree cleanup task
</next_steps>