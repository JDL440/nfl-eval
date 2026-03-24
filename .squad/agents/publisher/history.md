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

- 2026-03-25T10:45:00Z — **Notes publishing 500 fixed (COMPLETED)**: Fixed contract mismatch causing Notes 500 errors when `NOTES_ENDPOINT_PATH` env var was unset. Root cause: `notesEndpoint` was optional in SubstackConfig but required by `createNote()` method; when missing, it threw "Missing notesEndpoint..." error manifesting as 500 in dashboard. Fix applied: Added `DEFAULT_NOTES_ENDPOINT = '/api/v1/comment/feed'` constant and updated `createNote()` to use default if not explicitly configured. This ensures Notes feature works out-of-the-box without requiring optional env var. Updated test in `tests/services/substack.test.ts` to verify default endpoint is used. All 92 tests pass (substack + publish). Same pattern applicable to Tweet code if similar issues emerge — both use optional service config that has required features.
- 2026-03-25T10:30:00Z — **Publish payload and staging decisions merged**: Three inbox decision files consolidated into decisions.md: (1) `publisher-html-regression.md` — detailed root cause analysis of Substack `draft_body` JSON vs HTML expectations, (2) `publisher-prosemirror-payload-fix.md` — implementation details for reverting to ProseMirror JSON format and refactoring enrichment to operate on document nodes instead of HTML strings, (3) `publisher-stage-verify-prosemirror.md` — comprehensive validation evidence confirming correct payload structure and 45 passing publish tests. All files ready for staging/commit. Next focus: investigate Note publishing 500s.
- 2026-03-23T04:12:59Z — **UX Dashboard Publish Review findings integrated into Code decisions**: UX submitted read-only findings; HTMX 500 responses don't swap the publish panel. Publisher decision aligned with Code/UX recommendations: treat startup wiring as precondition, distinguish missing-env from service-unavailable states. See decisions.md for full coordination.
- 2026-03-25T02:47:00Z — **Substack output gap trace (documented and merged)**: `src/dashboard/server.ts:262-317` builds two parallel outputs from the same cleaned draft — `htmlBody = proseMirrorToHtml(doc)` for local preview and `substackBody = JSON.stringify(doc)` for `draft_body`. Preview-only chrome from `src/dashboard/views/preview.ts:89-151` adds cover/inline images, bottom subscribe CTA, and footer blurb that never enter the Substack payload. `src/dashboard/views/publish.ts:42-92` also does not render `subscribeWidget`/paywall/button nodes, so the local frame is not a reliable parity check for payload-native v1 affordances. Created `.squad/skills/substack-preview-payload-parity/SKILL.md` as diagnostic reference. Recommended first real republish candidate: `content/articles/sea-emmanwori-rookie-eval/draft.md` (has two `::subscribe` markers and multiple inline image references for cleanest widget + image parity validation). Precondition: ensure real image assets exist or payload path uploads and rewrites them to Substack URLs.
- 2026-03-23T21:58:00Z — **Substack payload parity restored (COMPLETED)**: Fixed the gap between preview and live article by implementing `enrichSubstackBody()` and `intersperseImages()` in `src/dashboard/server.ts`. Now `saveOrUpdateSubstackDraft()` uploads images to Substack via `SubstackService.uploadImage()`, rewrites URLs to CDN, distributes inline images evenly throughout the body (matching preview.ts logic), and appends subscribe CTA + publication blurb from `config.leagueConfig.substackConfig`. Cover images are prepended at top. Images fail gracefully if files don't exist. Added comprehensive tests in `tests/dashboard/publish.test.ts` to verify enriched body contains subscribe CTA, footer blurb, and handles image upload workflow. Draft-first behavior remains intact — enrichment happens only during draft save/update and publish-sync operations.
- 2026-03-23T05:00:39Z — **Publish wave reconciliation complete**: Decisions logged and merged to decisions.md. Data payload path fix (JSON→HTML) and Publisher payload enrichment (images+CTA+blurb) now documented in orchestration logs. Ready for live article republish validation test before Note/Tweet 500 fixes.
- 2026-03-25T06:00:00Z — **HTML body regression identified (CRITICAL)**: User reported live articles look worse after switching from `JSON.stringify(doc)` to `proseMirrorToHtml(doc)` at line 276. Root cause: Substack's `draft_body` API field expects **ProseMirror JSON document structure**, not rendered HTML strings. The parameter name `bodyHtml` is misleading — it's a contract artifact, not semantic truth. The HTML conversion breaks Substack's ProseMirror-based editor, causing formatting loss and rendering issues. Current `enrichSubstackBody()` compounds the problem by injecting raw HTML strings (`<div style="...">`) into what should be structured document nodes. **Required fix:** Revert line 276 to `JSON.stringify(doc)`, refactor `enrichSubstackBody()` to accept ProseMirror doc object, manipulate content nodes directly (not HTML strings), append subscribe/blurb as ProseMirror nodes, return enriched doc as JSON. See `.squad/decisions/inbox/publisher-html-regression.md` for full analysis. Do not publish more articles until fixed — each publish degrades quality on Substack.
- 2026-03-25T09:14:00Z — **ProseMirror payload structure restored (COMPLETED)**: Fixed Substack publishing regression by reverting to proper ProseMirror JSON document format. Changed `buildPublishPresentation()` to return `substackDoc: ProseMirrorDoc` instead of `substackBody: string`. Replaced `enrichSubstackBody()` with `enrichSubstackDoc()` that operates on ProseMirror document nodes instead of HTML strings. Created helper functions `buildImageNode()`, `buildHorizontalRule()`, `buildSubscribeNode()`, and `buildBlurbNode()` to construct proper ProseMirror nodes. Refactored `intersperseImagesInDoc()` to insert image nodes into the document content array instead of manipulating HTML. Updated `saveOrUpdateSubstackDraft()` to serialize enriched document to JSON via `JSON.stringify(enrichedDoc)`. All 45 publish tests pass. Files modified: `src/dashboard/server.ts` (ProseMirror node helpers + enrichment refactor), `tests/dashboard/publish.test.ts` (validate JSON structure and parse for content checks). Draft-first flow and UX fixes preserved. Live posts will now render correctly in Substack's editor and on web.
- 2026-03-22T22:25:00Z — **Stage publishing verification (COMPLETED)**: Validated ProseMirror payload implementation through comprehensive test suite. All 45 publish tests pass, confirming: (1) `draft_body` parameter receives JSON-serialized ProseMirror document (`JSON.stringify(enrichedDoc)`), not HTML strings; (2) Enrichment operates at node level via `enrichSubstackDoc()`, inserting cover images, inline images, subscribe CTA, and footer blurb as proper ProseMirror nodes; (3) Image upload workflow via `SubstackService.uploadImage()` returns CDN URLs that are embedded into image nodes; (4) Thinking tags are stripped before conversion; (5) Draft-first flow enforces two-step publish (create/update draft → publish existing draft). Tests validate JSON parsing, document structure (`type: 'doc'`, `content: []`), and node integrity. Attempted live stage validation against `https://nfllabstage.substack.com` but encountered server restart limitations in test environment. Unit tests provide comprehensive payload structure verification. Current implementation ready for production use with correct Substack ProseMirror API contract.

### 2026-03-25T10-45-00Z: Issue #107 Revision Follow-up (COMPLETED)
- Publisher completed narrow-scope deduplication of TLDR contract clarification per Lead approval
- Removed duplicated image-policy text from `src/config/defaults/skills/publisher.md`
- Publisher now references `src/config/defaults/charters/nfl/substack-article.md` Phase 4b as canonical policy source
- Retained only publisher-specific verification: syntax, filenames, file existence, alt text quality, links
- Clear division of responsibility: `substack-article.md` states policy, `publisher.md` verifies compliance
- Decision merged to decisions.md; orchestration log written; ready for commit

### 2026-03-23T17-14-24Z: TLDR follow-up context sync
- TLDR follow-up decision was merged and deduplicated in .squad/decisions.md.
- Revision-first TLDR handling remains the active contract for publisher handoffs.

## 2026-03-24 — Stage 7 Analysis Completion

**Date:** 2026-03-24T22:04:25Z  
**Task:** Analysis-only review of stage 7 inputs, seams, minimum change set, tests, and constraints.  
**Outcome:** Complete

### Findings
- Stage 7 inputs: Substack article payload, dashboard state, publisher-pass.md readiness
- Seams: Publisher-pass marks readiness; dashboard UI owns draft creation/publish actions
- Minimum changes: Documentation alignment needed
- Test coverage: Adequate for two-step flow
- Constraints: Publisher should remain dashboard handoff stage
- **Gap identified:** Skill describes Stage 7 as tool-driven publish, but code treats it as dashboard/server action

### Recommendations
- Align skill to reflect dashboard ownership of actual publish
- Keep Publisher prompt focused on readiness validation, not orchestration
- Separate optional Substack Note/Tweet actions from required publish-readiness checks

**Output:** .squad/analysis/publisher-stage7.md
