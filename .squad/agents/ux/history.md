# History — UX

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** Hono, HTMX, SSE, CSS
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `src/dashboard/` (Hono dashboard routes + views), `src/dashboard/views/` (HTMX templates), port 3456

## Learnings

- Team initialized 2025-07-18
- Dashboard runs on port 3456 (Hono + HTMX)
- SSE used for real-time pipeline status updates
- Editorial dashboard is the primary human interface
- Social link images (og:image) are controlled by Substack — derived from first `image2` node in ProseMirror `draft_body`; we cannot set og:image directly
- Cover images generated at 1920×1080 (16:9) via Gemini 3 Pro in `src/services/image.ts`; STYLE_GUIDE constant (lines 61-70) drives all prompt styling
- `ensureHeroFirstImage()` in `src/services/prosemirror.ts` auto-swaps chart/table first images to protect social thumbnails
- Dashboard preview (`src/dashboard/views/preview.ts`) has no OG meta tag rendering — opportunity to add social preview card to Publisher view
- Platform cropping varies: Twitter/X crops to 2:1, LinkedIn to 1.91:1 — center-weight critical visual elements in cover images
- Substack API may support a separate `cover_image` field in draft payload (not yet implemented in our SubstackService)
- 2026-03-23 — Article detail stage-run data is already hydrated in `src/dashboard/server.ts` for both `/articles/:id` and the live sidebar HTMX partial via `repo.getStageRuns(id)`.
- 2026-03-23 — `src/dashboard/views/article.ts` already computes per-run elapsed time in `renderStageRunsPanel()` from `StageRun.started_at` and `completed_at` using the local `formatDuration()` helper, so an article-total clock can be derived without new UI-side primitives.
- 2026-03-23 — Issue #110 triage: article-total time looks like a presentation-layer aggregation over existing `stage_runs`, while per-state or revision-aware timing likely needs mixed shaping from `stage_runs` plus `stage_transitions`.
- 2026-03-23 — Spawn-manifest follow-up: the first issue #110 UI pass should stay on a totals aggregation over existing stage-run timestamps; state-aware breakdowns can remain a later follow-up.
- 2026-03-22: Issue #70 Investigation Outcome
- Status: Investigation complete. Label updated to go:yes. Opportunity identified: add social preview card to Publisher dashboard view to showcase OG meta tags before publishing.
- Technical findings: Substack API may support separate `cover_image` field (opportunity for future enhancement).
- 2026-03-24: Stage 7 Publish Flow Wording Review
- **Review completed:** "Publish workspace" term is ambiguous and used only once (article.ts:513 tooltip).
- **Mental model gap:** Two-step workflow (Draft → Publish) not clearly explained to users.
- **Warning copy mismatch:** Article detail says "create draft first" (blocker language), but Publish Preview says "then post Note/Tweet" (optional language).
- **Files with wording issues:** article.ts (lines 511–513, 532), publish.ts (lines 161, 219, 349, 360).
- **Key finding:** Users conflate the lab's publish preview page with Substack's live draft editor—no clear separation of concerns in messaging.
- **Bonus finding:** "Publish All" button has redundant disabled-state tooltip because the page itself gates draft-less articles.
- **Charter scope:** Fully within UX responsibilities (dashboard UI, flows, interaction patterns). See .squad/decisions/inbox/ux-publish-wording.md.
- 2026-03-24: Publish UX investigation follow-up
- `src/dashboard/views/publish.ts` currently renders a lightweight local HTML preview, while `/articles/:id/preview` already has the richer Substack-style experience with cover image, inline-image placement, and mobile toggle; the publish page is not using that richer preview model.
- The create-draft interaction likely feels broken because the initial `Create Draft` button swaps `#publish-actions`, but the success partial from `renderPublishResult()` targets `#publish-result` for the follow-up publish action, splitting the flow across two containers.
- The biggest mental-model problem is naming: "preview" means at least three different things today—local preview (`/articles/:id/preview`), publish-page preview (`/articles/:id/publish`), and external Substack draft links—so labels should explicitly distinguish local preview, draft in Substack, and go-live actions.
- Article detail should become the concise status-and-routing page, with one publish section that says what exists now (no draft / draft ready / published) and links users into either the richer preview page or the external Substack draft, instead of repeating overlapping publish controls.

## Publish-Overhaul Team Coordination (2026-03-24)

**Team session:** Coordinated with Code, Publisher, Validation, and Coordinator agents on Stage 7 publish-flow architecture.

**Two-step UX model decision:** Submitted to `.squad/decisions.md`. Recommendation treats Stage 7 as explicit two-step workflow:
- Article detail: Clean status hub ("No draft yet" / "Draft ready" / "Published live") with routing actions
- Publish page: Single workflow panel with "Create Draft" and "Publish Now" as distinct primary actions

**Key UX improvements:**
- Richer preview reuse: Embed `/articles/:id/preview` rendering on publish page (cover, inline images, mobile toggle)
- Single workflow container: Fix HTMX target split (`#publish-actions` vs `#publish-result`) so draft creation and publish stay together
- Clearer copy: Action-first language ("No draft yet — create one to continue" vs "publish workspace")
- Error clarity: Explicit next-step guidance for each state (no draft, draft ready, published, error)

**Mental model improvements:**
- Distinguish lab preview page (local sanity check) from Substack draft (editable account) from go-live action (published)
- Remove redundant disabled-state tooltips that the page itself gates
- One unified "Publish" section on article detail instead of overlapping controls across detail + publish pages

**Status:** Recommendations merged to `.squad/decisions.md` as "Decision: Publish Flow UX — Two-Step Model with Explicit Workflow". Coordinator implemented all findings. Regressions passing.

- 2026-03-23T02-30-59Z — **Ralph Round 2 session**: Stage 7 publish-flow mental models and terminology review completed. Key findings: "publish workspace" is ambiguous/jargon; warning copy conflicts with intended two-step workflow; success states need stronger language. UX decision merged into decisions.md. Recommendations: rename/clarify workspace term, strengthen warnings, upgrade publish preview, add draft status indicator. Implementation pending Code's create-draft validation and Publisher's draft-first model adoption.

- 2026-03-23T04:12:59Z — **UX Dashboard Publish Review (read-only)**: Conducted exploratory review of dashboard publish/draft missing Substack configuration messaging. Examined HTMX vs JSON error surfacing patterns and adjacent dashboard conventions. **Findings:** (1) HTMX 500 responses do not swap publish panel—operators see raw failure instead of recovery guidance; (2) Adjacent panels use inline state messages for setup guidance (config status, missing credentials); (3) Recommended smallest actionable message: combine current error text with environment setup hints inline, no additional modals or redirects. **Outcome:** Read-only review completed. No code edits requested. Findings documented for Code decision on publish workflow error handling. See orchestration-log/2026-03-23T04-12-59Z-ux.md.

