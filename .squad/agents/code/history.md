## Spawn Batch — App/Runtime + Engineering-System Split (2026-03-29T19:07:44.9412166Z)

- **Status:** Two implementation streams launched.
- **Stream 1 (App/Runtime):** surfaces src\pipeline\*, src\dashboard\server.ts, article skills. Owners: Code + Publisher + UX (Lead review).
- **Stream 2 (Engineering-System):** surfaces .squad/*, squad agent, ralph-watch, heartbeat. Owners: Lead + Ralph + Research + DevOps.
- **Validation:** article quality, render QA, publish readiness, board hygiene, reduced coordination drift.

# Code Agent Project History

## Core Context
- Dashboard cleanup treats `/config` as the single admin surface; legacy `/agents`, `/memory`, `/runs`, and article-side advanced/context-config/stage-runs UI are removed.
- Trace observability stays on `/articles/:id/traces` and `/traces/:id`, with `POST /api/agents/refresh-all` preserved.
- Memory storage/schema remain intact, but runtime memory injection is intentionally disabled pending redesign.
- Runner traces should preserve `availableTools` and merge provider-native tool-loop calls when the app-managed loop is bypassed.
- LM Studio structured output on qwen requires `json_schema` or `text`; `json_object` is rejected.
- Fast-forward-only advancement of checked-out `main` is the safe integration policy.
- Article contract artifact: Stage 3→4 (discussion) now generates `article-contract.md` capturing thesis, tensions, evidence anchors, structure expectations, and open cautions. Both Writer (Stage 5) and Editor (Stage 6) receive the contract via existing context-config patterns.

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
- 2026-03-29 — New spawn batch queued Code for app implementation kickoff, explicitly downstream of DevOps branch sync and Research plan-splitting so coding starts from a synced branch and agreed slices.
- 2026-03-29 — Article contract implementation complete: `generateArticleContract` function added after discussion synthesis/fallback in all three runDiscussion paths; `article-contract.md` artifact included in writeDraft and runEditor context via CONTEXT_CONFIG updates; Editor task and skill updated to explicitly reference contract as evaluation rubric; existing test suite (79 tests) passes without modification, demonstrating backward compatibility and surgical integration.
- 2026-03-29 — Structured blocker-tracking seams already exist in the app runtime: `src\pipeline\conversation.ts` persists/normalizes `blocker_type` + `blocker_ids`, `src\pipeline\actions.ts` extracts `[BLOCKER type:id]` tags and escalates repeated fingerprints, `src\db\repository.ts` migrates the columns, and dashboard/tests already read the same metadata.
- 2026-03-29 — The current article-contract seam is coupled to Stage 5, not Stage 4: `src\pipeline\actions.ts` lazily generates `article-contract.md` inside `writeDraft()`, `src\pipeline\context-config.ts` feeds it into Writer/Editor, and `src\db\repository.ts` does not classify `article-contract.md` in `clearArtifactsAfterStage()`, so regressions can keep a stale contract unless a future slice owns regeneration or cleanup explicitly.
- 2026-03-29 — Smallest prep path for issue #120 is test-first around the existing seams (`tests\pipeline\actions.test.ts`, `tests\pipeline\conversation.test.ts`, `tests\db\repository.test.ts`, and dashboard payload readers) to harden blocker extraction/guidance/API reads without changing stages; smallest prep path for #123 is to extend the current `needs_lead_review` + `lead-review.md` assertions rather than inventing a new state model.
- 2026-03-29 — Revision-loop routing currently splits “shared” versus “exact” feedback on purpose: `buildRevisionSummaryContext()` is the compact cross-role handoff, while `writeDraft()` separately injects the latest full `editor-review.md`. Future blocker-summary or escalation work should extend the revision-summary read model first instead of depending on raw transcript reuse.


- 2026-03-29 — Stage 4 contract promotion complete: `article-contract.md` now generated in `runDiscussion()` via `generateArticleContract()` helper across all three discussion paths (normal synthesis, single-moderator fallback, all-panelists-failed fallback); new `requireArticleContract()` and `requireDiscussionComplete()` guards enforce hard 4→5 prerequisite requiring BOTH discussion-summary.md and article-contract.md; `writeDraft()` contract generation reduced to recovery-only path with warning log; skill documentation updated to reflect both artifacts as Stage 4 outputs; all 153 pipeline tests passing with proper multi-call tracking in test providers.

- 2026-03-29T23:35:51Z — DevOps fixture narrowing complete: E2E tests updated to write `article-contract.md` alongside `discussion-summary.md` before Stage 4→5 advances. Modified 4 test files (ux-happy-path, edge-cases, pipeline, full-lifecycle) with fixture-only changes; enhanced `advanceToStage()` helper to auto-write contract. Fixture-only audit: no product code modified per decision. E2E run: 91/93 passing, 2 pre-existing memory-storage failures unrelated to contract fixture changes. Stage 4→5 guard now consistent between runtime (`requireDiscussionComplete()`) and E2E test fixtures.
