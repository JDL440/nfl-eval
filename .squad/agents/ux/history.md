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
- LLM observability is split across article detail (`src/dashboard/views/article.ts`), run history (`src/dashboard/views/runs.ts`), config (`src/dashboard/views/config.ts`), and agent/artifact views (`src/dashboard/views/agents.ts`); the artifact viewer is the main place where persisted thinking traces are exposed
- Article detail correlates article/stage/agent/provider/model/token data through stage runs, usage events, audit log, and SSE-driven live partials; raw request/response envelopes and retry internals are not shown in the dashboard
- `src/pipeline/actions.ts` persists agent thinking as `*.thinking.md` artifacts with agent/model headers, while `src/dashboard/server.ts` only surfaces cleaned article bodies in preview/publish flows
- Issue #93 token-usage path depends on persisted `usage_events`, not live recomputation: `src/llm/providers/copilot-cli.ts` estimates usage, `src/agents/runner.ts` maps it to `tokensUsed`, `src/pipeline/actions.ts` records it, and article surfaces in `src/dashboard/server.ts` / `src/dashboard/views/article.ts` must hydrate the full article history so older `copilot-cli` rows are not clipped out of detail or SSE sidebar views.
- Issue #93 trace result: Copilot CLI usage is created in `src/llm/providers/copilot-cli.ts`, mapped by `src/agents/runner.ts`, and persisted by `src/pipeline/actions.ts`; the article-page gap came from `Repository.getUsageEvents()` defaulting to the newest 100 rows
- Article detail and live-sidebar usage panels (`src/dashboard/server.ts` → `src/dashboard/views/article.ts`) should read full per-article usage history so early-provider rows like `copilot-cli` idea-generation calls are not dropped after heavy later activity
- Issue #93 fix stayed scoped to the usage hydration seam: `src/db/repository.ts` now returns full per-article usage history by default, while article detail (`src/dashboard/server.ts`) and the HTMX live sidebar keep reusing the same query path unchanged.
- Focused verification for #93: `tests/llm/provider-copilot-cli.test.ts`, `tests/pipeline/actions.test.ts`, `tests/dashboard/server.test.ts`, `tests/dashboard/wave2.test.ts`, and `tests/db/repository.test.ts` pass locally, proving the break was the repository/query cap rather than missing provider estimation or persistence.
- Issue #93 follow-up evidence showed the article UI already rendered correctly when `usage_events` rows existed; the safer regression anchor is the full provider → runner → `recordAgentUsage()` → repository → article/live-sidebar chain, not seeded dashboard-only rows.
- For Copilot CLI usage regressions, prefer a stage-action test that runs against a provider reporting `provider: 'copilot-cli'` plus usage numbers, then assert both the persisted `usage_events` row and the article/live-sidebar HTML.

### 2026-03-22: Issue #70 Investigation Outcome

**Status:** Investigation complete. Label updated to go:yes. Opportunity identified: add social preview card to Publisher dashboard view to showcase OG meta tags before publishing.

**Technical findings:** Substack API may support separate \cover_image\ field (opportunity for future enhancement).

### 2026-03-22: Issue #93 Outcome

**Status:** Fixed in repository hydration path.

**Technical findings:** Copilot CLI estimated usage was already being created in `src/llm/providers/copilot-cli.ts` and persisted through `recordAgentUsage()` into `usage_events`. The article detail page and HTMX live sidebar were losing older Copilot CLI rows because `Repository.getUsageEvents()` silently defaulted to `LIMIT 100`, so later stage activity could push early Copilot usage out of the dashboard query window.


### 2026-03-22T19:02:18Z: Issue #93 token usage history fix

- Merged the decision inbox entry for the article usage panel gap into `.squad/decisions.md`.
- Recorded that the repository default must preserve full per-article usage history so early Copilot CLI rows stay visible in article detail panels.

### 2026-03-22T12:10:00Z: Issue #93 scoped UX handoff

- Re-verified the Copilot CLI token path end-to-end and kept the final change on the real article usage seam only: repository hydration.
- Explicitly did **not** carry forward the rejected artifact-thinking/debug renderer change; the article page fix is just full-history usage hydration plus focused dashboard/repository regression coverage.

### 2026-03-22T19:07:48.2253500Z: Issue #93 decision sync

- Confirmed the issue #93 decision record is now canonical in `.squad/decisions.md` and the inbox files were removed.
- Kept the UX finding aligned on the repository query cap: article detail and live usage panels should read full per-article usage history by default.
### 2026-03-22T19-13-43Z: Scribe sync — Issue #93 inbox merge
- Consolidated the issue #93 usage-history decision into `.squad/decisions.md`.
- Article detail and live sidebar usage panels should keep reading full per-article history by default, with explicit limits reserved for bounded queries.

### 2026-03-22T19:13:43Z: Issue #93 regression safeguard

- UX now records the regression guard that validates the full Copilot CLI usage path through persistence and hydration.
- The article detail and live sidebar views should continue to read the full per-article usage history by default.
- The rejected thinking/debug renderer path stays out of scope.

### 2026-03-22T19:14:56Z: Issue #93 blocked / not reproducible follow-up
- Traced the provider -> runner -> persistence -> dashboard chain end to end.
- Could not reproduce a Copilot-CLI-specific defect in the current code.
- Kept the diagnosis scoped to the actual dashboard read path and left the issue blocked.
