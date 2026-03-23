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
