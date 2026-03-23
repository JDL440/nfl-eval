# History — Publisher

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, MCP tools for Substack/image gen
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `content/` (pipeline output), `mcp/` (MCP tools), `src/services/` (publishing services)

## Learnings

- Team initialized 2025-07-18
- Substack is the primary publication target
- Twitter/X used for promotion
- MCP tools available for Substack publishing and image generation

### 2026-03-22: Publish Bug Fix Deployed

**Outcome:** Issue #82 (Publish button broken) was investigated and fixed by Code agent. PR #87 merged. Publish button now correctly targets /api/articles/:id/publish endpoint.

**Impact:** Articles can now be successfully published to Substack from stage 7.

### 2026-03-23: Stage 7 publish UX review

**Architecture:** Stage 7 is a manual two-step publishing flow. `runPublisherPass()` prepares publisher artifacts/checklist state but does not create a draft (`src/pipeline/actions.ts:816-886`); draft creation and final publish are handled by dashboard routes (`src/dashboard/server.ts:1277-1438`).

**Product pattern:** In current UI terms, “publish workspace” is the dedicated route `/articles/:id/publish`, rendered by `src/dashboard/views/publish.ts`. That page acts as a publish preview/action hub with article preview, draft creation, publish, Note, Tweet, and Publish All controls.

**UX finding:** The warning text “Create a Substack draft in the publish workspace before publishing” is functionally correct, but the noun “workspace” is not reinforced elsewhere in the product. The detail page (`src/dashboard/views/article.ts:508-563`) and publish page (`src/dashboard/views/publish.ts:119-182`, `344-364`) describe the same surface with different terms, which can blur the editor mental model.

**Validation:** Relevant publish-flow tests passed: `tests/dashboard/publish.test.ts` and `tests/dashboard/server.test.ts`.

### 2026-03-24: Publish warning investigation

**Expected flow:** Stage 7 (`Publisher Pass`) is editorially ready but still requires a manual Substack step: open `/articles/:id/publish`, create the Substack draft, then publish that saved draft live. Stage 8 is only reached after `repo.recordPublish(...)` stores the live Substack URL (`src/dashboard/server.ts:1429-1446`, `tests/dashboard/publish.test.ts:301-324`).

**Terminology note:** “Publish workspace” currently maps to the dashboard page `/articles/:id/publish`, but surrounding UI uses mixed labels like “Review & Publish,” “Open Publish Workspace,” and “Publish Actions.” That means the warning is implementation-correct but weaker than the user’s likely mental model of “publish page” or “Substack draft step.”

**Key paths:** `src/dashboard/views/article.ts`, `src/dashboard/views/publish.ts`, `src/dashboard/server.ts`, `src/pipeline/actions.ts`, `tests/dashboard/publish.test.ts`, `tests/dashboard/server.test.ts`, `tests/e2e/pipeline.test.ts`.


### 2026-03-23T02:17:46Z: Publish-flow decision submitted

**Decision:** Treat Stage 7 publishing as explicitly **manual two-step** (create draft → publish draft), and standardize terminology for /articles/:id/publish page to reduce editor confusion (recommend "Publish Page", "Publish Console", or "Publish Workspace" — but use only one).

**Status:** Decision merged to .squad/decisions.md as "Publisher publish-flow review — Stage 7 mental models".

### 2026-03-23: Publish page overhaul investigation

### 2026-03-24T02:38:09Z: Ralph Round 3 — Issue #107 Revision Completed

**Session:** Publisher executed image-policy deduplication per Lead request.

**Scope:** Removed duplicated policy language from `src/config/defaults/skills/publisher.md` Step 2, replaced with reference to canonical `../substack-article.md` Phase 4b. Retained technical verification checks (syntax, naming, existence, alt text quality).

**Validation:** Reference path and section title verified in target file. Documentation-only change; no code/test impacts.

**Decision Status:** "Issue #107 Revision: Publisher Skill Deduplication" merged to `.squad/decisions.md`.

### 2026-03-23T04-16-31Z: Scribe Cross-Agent Update — Publish Config Fix Coordination

**Coordinated Session:** Multi-agent Publish Config investigation  

**Publisher decision finalized:** Treat Substack dashboard publishing failures as two distinct product states—missing configuration vs. service unavailability despite config. Service-availability detection should precede publish-action rendering.

**UX decision finalized:** Short alert ("Substack publishing is not configured.") with actionable recovery details (env var names, /config link, restart guidance) in separate hint section.

**Stage 7 architecture validated:** Flow is correctly manual two-step (Create Draft → Publish). UX gap is terminology consistency across article detail, publish page, and preview surfaces. Both decisions merged to .squad/decisions.md.

**Validation:** Focused publish and server tests passed (tests/dashboard/publish.test.ts, tests/dashboard/server.test.ts).

**Next:** Lead to execute publish-overhaul feature branch isolation strategy (decision documented in "Publish-Overhaul Isolation Strategy").

**Flow recommendation:** Keep Stage 7 as a draft-first workflow. “Save/Create Draft” should be a safe create-or-update action that never publishes; “Publish Now” should publish the reviewed Substack draft already linked to the article, not a separate direct-from-markdown path.

**Preview finding:** The publish page currently shows a lightweight local HTML render from markdown (`src/dashboard/views/publish.ts`), while the richer article preview uses `renderArticlePreview(...)` with cover image, inline image placement, CTA, and mobile toggle (`src/dashboard/views/preview.ts`, `src/dashboard/server.ts:1256-1287`). Editorially, that means the current publish-page preview is only a sanity check, not a high-fidelity publish preview.

**Likely UX bug:** The draft action appears broken because creating a draft swaps only the `#publish-actions` fragment, while other publish-page state such as “Publish All” remains rendered from the old no-draft state until refresh (`src/dashboard/views/publish.ts:154-176`, `344-360`; `src/dashboard/server.ts:1368-1372`).

**Key failure cases to surface clearly:** missing draft markdown, Substack service not configured, no saved draft yet, malformed/stale draft URL, and upstream Substack API failures. The current server routes already distinguish these cases (`src/dashboard/server.ts:1333-1457`), but the UI should present them in editor language rather than generic errors.

### 2026-03-24: Publish-overhaul team coordination

**Team session:** Coordinated with Code, UX, Validation, and Coordinator agents on publish-flow architecture.

**Draft-first model decision:** Submitted to `.squad/decisions.md`. Model treats Stage 7 as manual two-step: idempotent save/create draft (never publishes), then publish-now action (publishes existing linked draft only). Substack service already exposes `createDraft` and `updateDraft`, so implementation is straightforward.

**Key benefits:** 
- Prevents divergence between "what editor reviewed" and "what got published"
- Single draft lifecycle eliminates mental-model confusion
- Idempotent save means users can repeat click without side effects

**Preview expectation:** Publish page should move to high-fidelity preview by reusing richer preview rendering from `/articles/:id/preview` (cover image, inline placement, subscribe CTA, mobile toggle).

**Error states:** Surface draft creation state (no markdown, Substack not configured, save failed, URL stale, publish failed, page refresh needed).

**Status:** Decision merged to `.squad/decisions.md` as "Decision: Publish-Flow Architecture — Draft-First Model". Awaiting Coordinator implementation.

- 2026-03-23T02-30-59Z — **Ralph Round 2 session**: Publish-flow overhaul proposal merged into decisions. Draft-first model recommended: Create Draft → Publish Now (two-step explicit workflow). Blocking issue: create-draft function appears broken/incomplete in publishToSubstack.ts. Routed validation request to Code team. UX and error-handling implications documented. Awaiting Code's create-draft fix before implementing draft-first UI changes.

### 2026-03-24: Issue #107 Revision — Publisher Skill Deduplication

**Outcome:** Removed duplicated normative image-policy text from `src/config/defaults/skills/publisher.md` Step 2. Publisher now references `../substack-article.md` Phase 4b as the single canonical source for image count, placement, hero-safety, naming, and alt-text policy. Retained only publisher-specific verification checks: syntax validation, filename verification, file existence, alt text descriptiveness, and broken-link detection.

**Revision detail:** Step 2 originally enumerated the full image placement policy (cover image above TLDR, exactly 2 inline images, hero-safety, player-centric cover for player articles, naming convention, no captions). All policy text removed; replaced with concise reference to canonical contract. Verification checklist reduced to 5 technical checks that are publisher-specific and not policy enforcement.

**Rationale:** Following Issue #107 decision: single canonical source (substack-article.md) prevents policy drift across Writer, Editor, and Publisher skill docs. Publisher role is to verify compliance, not re-state policy. Division of responsibility: substack-article.md states "what images must be," publisher.md verifies "did this article's images match the contract."

**Status:** Merged to `src/config/defaults/skills/publisher.md`. No code changes, no runtime validation needed (markdown documentation change). Change is surgical and complete.

### 2026-03-25: Dashboard Substack config trace

**Root cause:** Dashboard draft/publish routes only work when `createApp()` receives a `substackService` dependency (`src/dashboard/server.ts:167-177`), but `startServer()` currently builds `imageService` only and calls `createApp(repo, config, { actionContext, imageService, memory })` without constructing/passing `SubstackService` (`src/dashboard/server.ts:2455-2495`).

**Trigger condition:** Any dashboard started through normal `startServer()` / `npm run v2:serve` flow will leave `substackService` undefined, so `/api/articles/:id/draft` and `/api/articles/:id/publish` immediately return HTTP 500 "Substack publishing is not configured for this environment." (`src/dashboard/server.ts:1366-1381`, `1415-1429`) even if `.env` contains valid Substack keys.

**Config expectation:** For dashboard article draft/publish, the meaningful runtime keys are `SUBSTACK_TOKEN` and `SUBSTACK_PUBLICATION_URL` (`src/services/substack.ts`, `.env.example`). `SUBSTACK_STAGE_URL` is optional stage-target support, and `NOTES_ENDPOINT_PATH` is only needed for Notes, not article draft/publish.

**UX note:** Current publish UI adds a helpful config hint when this exact error string appears (`src/dashboard/views/publish.ts:195-205`), but in this bug it is misleading because the environment can already be configured correctly. Better product behavior would be to detect service availability before rendering actions, disable/replace publish controls, and distinguish "missing env" from "startup wiring bug / service unavailable."

**Validation:** `npx vitest run tests/dashboard/publish.test.ts` passes, but those route tests inject a mock `substackService` directly into `createApp()` (`tests/dashboard/publish.test.ts:227`, `253`, `328`, `353`), so they do not cover real startup wiring.

### 2026-03-25T02:47:00Z: Scribe Orchestration — Publisher Session Finalized

**Session outcome logged:**
- Orchestration log written: `.squad/orchestration-log/2026-03-25T02-47-00Z-publisher.md`
- Session log written: `.squad/log/2026-03-25T02-47-00Z-publisher-substack-trace.md`
- Root cause documented: Startup wiring bug (missing SubstackService dependency injection) vs. configuration issue
- Next action: Code agent to fix `startServer()` SubstackService construction and pass to `createApp()`

### 2026-03-25: Dashboard publish config investigation

**Exact trigger:** The 500 `"Substack publishing is not configured for this environment."` is raised whenever `createApp()` has no `substackService` dependency and a user hits `/api/articles/:id/draft` or `/api/articles/:id/publish` (`src/dashboard/server.ts`). In current startup, `startServer()` calls `createApp(repo, config, { actionContext, imageService, memory })` without constructing/passing `SubstackService`, so normal local dashboard runs leave publishing unavailable even when env vars exist.

**Expected local config:** Article draft/publish needs `SUBSTACK_TOKEN` and `SUBSTACK_PUBLICATION_URL`; env is loaded from repo-root `.env` or `~/.nfl-lab/config/.env`. `SUBSTACK_STAGE_URL` is optional stage-target support, and `NOTES_ENDPOINT_PATH` is only needed for Notes, not article draft/article publish.

**UX assessment:** Current publish page hint says to set env vars and restart, which is only partly right. Better UX should distinguish true missing-env cases from service-startup/wiring failures, and disable or replace publish actions when the dashboard knows Substack service is unavailable.

**Key paths:** `src/dashboard/server.ts`, `src/dashboard/views/publish.ts`, `src/services/substack.ts`, `src/config/index.ts`, `.github/extensions/README.md`, `README.md`.
