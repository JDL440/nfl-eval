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

### 2026-03-22: Issue #70 Investigation Outcome

**Status:** Investigation complete. Label updated to go:yes. Opportunity identified: add social preview card to Publisher dashboard view to showcase OG meta tags before publishing.

**Technical findings:** Substack API may support separate \cover_image\ field (opportunity for future enhancement).


