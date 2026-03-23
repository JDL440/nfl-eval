# History — Publisher

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, MCP tools for Substack/image gen
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `content/` (pipeline output), `mcp/` (MCP tools), `src/services/` (publishing services)

## Core Context

### Stage 7 Publishing Architecture
- Manual two-step flow: Create Substack draft → Publish live
- `runPublisherPass()` prepares artifacts/checklist but does not create draft; dashboard routes handle draft creation + publish
- Routes at `src/dashboard/server.ts:1277-1438` distinguish missing draft, service unavailability, stale URLs, API failures
- Currently uses mixed terminology ("publish workspace", "Review & Publish", "Publish Actions")

### Draft-First Model (Approved Decision)
- Treat Stage 7 as explicit two-step: idempotent save/create draft (never publishes), then publish-now (publishes existing linked draft)
- Substack service already exposes `createDraft` and `updateDraft` APIs
- Benefits: prevents divergence between reviewed/published content, single draft lifecycle, idempotent saves prevent side effects
- Publish page should upgrade to high-fidelity preview reusing richer rendering from `/articles/:id/preview`

### Substack Dashboard Config Wiring Issue (Critical)
- **Root cause:** `startServer()` builds `imageService` only; calls `createApp()` without constructing/passing `SubstackService`
- **Result:** Draft/publish routes return HTTP 500 even when `.env` contains valid keys
- **Required keys:** `SUBSTACK_TOKEN`, `SUBSTACK_PUBLICATION_URL` (stage/notes vars optional)
- **UX gap:** Current UI hint misleads when env is already configured; better approach is detect service availability before rendering actions
- **Testing gap:** Existing route tests inject mock `substackService` directly, so real startup wiring never tested

### Issue #107 Revision — Skill Deduplication (COMPLETED)
- Removed duplicated image-policy text from `src/config/defaults/skills/publisher.md`
- Publisher now references `../substack-article.md` Phase 4b as canonical policy source
- Retained only publisher-specific verification: syntax, filenames, file existence, alt text quality, links
- Division of responsibility: substack-article.md states policy, publisher.md verifies compliance

## Learnings

- 2026-03-23T04:12:59Z — **UX Dashboard Publish Review findings integrated into Code decisions**: UX submitted read-only findings; HTMX 500 responses don't swap the publish panel. Publisher decision aligned with Code/UX recommendations: treat startup wiring as precondition, distinguish missing-env from service-unavailable states. See decisions.md for full coordination.
