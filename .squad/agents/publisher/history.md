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
- 2026-03-25T02:47:00Z — **Substack output gap trace (documented and merged)**: `src/dashboard/server.ts:262-317` builds two parallel outputs from the same cleaned draft — `htmlBody = proseMirrorToHtml(doc)` for local preview and `substackBody = JSON.stringify(doc)` for `draft_body`. Preview-only chrome from `src/dashboard/views/preview.ts:89-151` adds cover/inline images, bottom subscribe CTA, and footer blurb that never enter the Substack payload. `src/dashboard/views/publish.ts:42-92` also does not render `subscribeWidget`/paywall/button nodes, so the local frame is not a reliable parity check for payload-native v1 affordances. Created `.squad/skills/substack-preview-payload-parity/SKILL.md` as diagnostic reference. Recommended first real republish candidate: `content/articles/sea-emmanwori-rookie-eval/draft.md` (has two `::subscribe` markers and multiple inline image references for cleanest widget + image parity validation). Precondition: ensure real image assets exist or payload path uploads and rewrites them to Substack URLs.
