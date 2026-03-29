# Active Decisions

- **User directive: Reduce subagent count** (2026-03-29T23:24:34Z): Keep subagents to 5 or fewer due to rate limiting. Captured for team memory.

- **Code: Promote article-contract.md to first-class Stage 4 artifact** (2026-03-29): Added contract generation in `runDiscussion()` after discussion summary. Enhanced Stage 4→5 guard with `requireArticleContract()` + `requireDiscussionComplete()`. Kept recovery path in `writeDraft()`. Updated skill docs. All 153 tests passing. Contract generation now appears in Stage 3→4 traces, not Stage 5. One additional LLM call per article in Stage 3→4 flow (200-400 words).

- **DevOps: Stage 4 E2E fixture fix** (2026-03-29): Narrowed e2e fixtures so Stage 4+ flows include `article-contract.md` before 4→5 or later advances. Modified 4 test files (ux-happy-path, edge-cases, pipeline, full-lifecycle). Enhanced `advanceToStage()` helper to auto-write contract fixture. Fixture-only changes; no product code modified. E2E: 91/93 passing, 2 unrelated memory-storage failures.

- **Code: Next app/runtime seams after article-contract** (2026-03-29): Treat next slice as extension of existing revision-summary seam. Keep `revision_summaries` as durable routing source for blocker metadata. Keep `lead-review.md` + `needs_lead_review` for repeated-blocker hold instead of new stage. Risky couplings noted: contract generation currently Stage-5-coupled; regression cleanup doesn't classify `article-contract.md`; Publisher path not contract-aware by default. Recommend #120 read-model hardening pass for next slice.

- **App/runtime + engineering-system split** (2026-03-29T19:07:38.8847972Z): Two separate implementation streams for Anthropic harness follow-up. Stream 1 (app/runtime): src\pipeline\*, src\dashboard\server.ts, article skills (Code + Publisher + UX). Stream 2 (engineering-system): .squad/*, squad agent, ralph-watch, heartbeat workflow (Lead + Ralph + Research + DevOps).

- **Dashboard cleanup audit final** (2026-03-29T18:42:53Z): Treat `/config` (Settings) as the only remaining dashboard admin surface. Keep `/articles/:id/traces`, `/traces/:id`, and `POST /api/agents/refresh-all`. Remove/fail closed any leftover references implying retired `/agents`, `/memory`, `/runs`, `/runs/:id`, or article-detail stage-run/timeline chrome still exist. Trace observability lives on trace pages; maintenance lives on Settings; retired admin browsers do not linger through copy, tests, or dead code.

- **Dashboard article cleanup complete** (2026-03-29T11:38:22Z by Code): Removed pipeline-activity bar, stageRuns data, stageRunErrorHtml from article detail. Cleaned dead CSS. All view/test/import artifacts confirmed already removed.

- Runner traces must preserve `availableTools` and merge provider-native tool-loop calls when the app-managed loop is bypassed.

- LM Studio structured output for qwen should use `json_schema` or `text`; `json_object` is not accepted.

- Checked-out `main` should only advance through a fast-forward descendant of the validated target.

- Older detailed decision history has been archived to `.squad/decisions-archive.md`.
