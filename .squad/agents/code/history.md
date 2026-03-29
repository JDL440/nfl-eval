# Code Agent Project History

## Core Context
- Dashboard cleanup treats `/config` as the single admin surface; legacy `/agents`, `/memory`, `/runs`, and article-side advanced/context-config/stage-runs UI are removed.
- Trace observability stays on `/articles/:id/traces` and `/traces/:id`, with `POST /api/agents/refresh-all` preserved.
- Memory storage/schema remain intact, but runtime memory injection is intentionally disabled pending redesign.
- Runner traces should preserve `availableTools` and merge provider-native tool-loop calls when the app-managed loop is bypassed.
- LM Studio structured output on qwen requires `json_schema` or `text`; `json_object` is rejected.
- Fast-forward-only advancement of checked-out `main` is the safe integration policy.

## Learnings
- 2026-03-29 — Dashboard regression tests for the approved cleanup should assert operator-visible states only: `/config` always renders the maintenance target, refresh-all form visibility depends on runner+memory initialization, and article tests should verify the current metadata/detail shape while excluding legacy `/context-config` and inline edit-form copy.
- 2026-03-29 — Dashboard surface cleanup validated: deprecated `/agents`, `/memory`, and `/runs` UI was removed; trace pages and `POST /api/agents/refresh-all` stayed intact; article detail now focuses on metadata, artifacts, revisions, reviews, actions, and usage.
- 2026-03-29 — The clean integration lane for v4 forward-port validation is `C:\github\worktrees\nfl-eval-v4-integration-f31a5ec` on branch `devops/v4-integration-f31a5ec`; use it for focused validation instead of the dirty root checkout when possible.
- 2026-03-29 — LM Studio and Copilot trace seams depend on provider metadata continuity: trace start records available tools, and completion must merge app-managed tool calls or provider-native tool-loop calls so traces stay observable.
- 2026-03-29 — The dashboard settings/config surface is the preferred low-risk seam for runtime validation, while model/tool-loop/provider routing changes should be kept isolated from operator UI cleanup.
- 2026-03-29 — Dashboard cleanup follow-up: `src\dashboard\views\layout.ts` should keep only Dashboard/New Idea/Settings in primary nav; `src\dashboard\views\article.ts` should stay free of legacy stage-runs/timeline/context-config chrome; `src\dashboard\views\config.ts` is the honest place to describe memory as stored-but-not-injected and to host `POST /api/agents/refresh-all`.
- 2026-03-29 — Honest memory deprecation copy must match the live runtime seam in `src\agents\runner.ts`: the `## Relevant Context` block and touch logic remain dormant source paths, while active writes come from bootstrap/manual refresh flows instead of per-run auto-learning.
- 2026-03-29 — Final dashboard cleanup audits should check for dead article-detail remnants as well as removed pages: `src\dashboard\views\article.ts` must not reference `stageRuns`, pipeline-activity, or inline run-failure chrome once `/runs` is retired, and `tests\dashboard\server.test.ts` should assert `/agents`, `/memory`, `/runs`, and `/runs/:id` return 404 while trace pages and `POST /api/agents/refresh-all` stay live.
- 2026-03-29 — Settings copy has to describe deprecation plainly: say legacy memory storage still exists, prompt injection is disabled, the old Memory dashboard stays retired, and refresh-all now lives on `/config`.
- 2026-03-29T18:42:53Z — Dashboard cleanup audit/fix completed in background; repo files updated and filesystem verified; UX exposure audit confirmed simplified dashboard.
- 2026-03-29 — Mobile-first dashboard modernization now rides on shared seams instead of page-only patches: `layout.ts` owns `.shared-mobile-header` / `.shared-mobile-nav`, `article.ts` + `publish.ts` share `.mobile-detail-layout`, and `config.ts` uses `.responsive-table` so narrow-screen structure is backed by real CSS and regression tests.

## Cross-Agent Context Updates (2026-03-29T20-08-26Z)

### From Orchestration (Scribe)
**Mobile shell restyle handoff:** Implement the system-level mobile shell fix first, then layer premium dashboard polish on top. Eliminate hamburger overlap and overflow before page-specific decoration.
