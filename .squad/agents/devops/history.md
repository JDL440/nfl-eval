## Spawn Batch — App/Runtime + Engineering-System Split (2026-03-29T19:07:44.9412166Z)

- **Status:** Two implementation streams launched.
- **Stream 1 (App/Runtime):** surfaces src\pipeline\*, src\dashboard\server.ts, article skills. Owners: Code + Publisher + UX (Lead review).
- **Stream 2 (Engineering-System):** surfaces .squad/*, squad agent, ralph-watch, heartbeat. Owners: Lead + Ralph + Research + DevOps.
- **Validation:** article quality, render QA, publish readiness, board hygiene, reduced coordination drift.

# DevOps History

## Learnings

- LM Studio is only auto-registered by the dashboard when `LLM_PROVIDER=lmstudio` or `LMSTUDIO_URL` is set (`src/dashboard/server.ts`).
- The LM Studio provider defaults to `http://localhost:1234/v1` and a fallback model of `qwen-35`, but dashboard startup will auto-detect loaded models and pick the first non-embedding model when no `LMSTUDIO_MODEL` override is set (`src/llm/providers/lmstudio.ts`, `src/dashboard/server.ts`).
- The in-app agent tool-use path is an app-managed JSON loop in `src/agents/runner.ts`, with local/pipeline tool filtering and execution handled by `src/agents/local-tools.ts`.
- Useful verification commands in this worktree: `npm exec vitest run .\tests\llm\provider-lmstudio.test.ts`, `npm exec vitest run .\tests\agents\local-tools.test.ts`, `npm exec vitest run .\tests\agents\runner.test.ts`, and `npm run v2:build`.
- Live local LM Studio was reachable at `http://localhost:1234/v1/models` during DevOps verification and reported `qwen/qwen3.5-35b-a3b` in the loaded model list.
- Current live tool-loop compatibility is blocked for that Qwen model because `src/llm/gateway.ts` forces `responseFormat: 'json'`, `src/llm/providers/lmstudio.ts` sends `response_format: { type: 'json_object' }`, and the live endpoint rejected that shape in favor of `json_schema` or `text`.
- DevOps verification on 2026-03-28: targeted LM Studio + tool-loop tests passed via `npm run test -- tests/llm/provider-lmstudio.test.ts tests/agents/runner.test.ts tests/agents/local-tools.test.ts`, and `npm run v2:build` passed cleanly.
- Local LM Studio was reachable at `http://localhost:1234/v1/models` and returned a live model list, but this worktree shell had no `LLM_PROVIDER`, `LMSTUDIO_URL`, or `LMSTUDIO_MODEL` set, so dashboard startup would not auto-register LM Studio without an explicit env opt-in (`src/dashboard/server.ts`).
- DevOps branch sync on 2026-03-29: `feature/agenteval` was clean but 8 commits behind `origin/main`; `git fetch origin main` followed by `git merge --no-ff --no-edit origin/main` updated the worktree branch without conflicts or discarded changes.
- Recurring article schedule config is managed in two dashboard surfaces: `/config?tab=schedules` for the admin/settings workflow and `/schedules` for the dedicated schedule page, both backed by `repo.createArticleSchedule` / `repo.updateArticleSchedule` in `src/dashboard/server.ts`.
- The schedule prompt/instruction source of truth is `article_schedules.prompt`, persisted alongside timing, team, preset, reader profile, article form, panel shape, analytics mode, provider override, and panel constraints in `src/db/schema.sql` and `src/db/repository.ts`.
- Tuesday casual slots default to weekday `2`, preset `casual_explainer`, `reader_profile=casual`, `article_form=brief`, `panel_shape=news_reaction`, and `analytics_mode=explain_only`; the UI explicitly hints that Tuesday-style slots should stay explain-only (`src/dashboard/views/schedules.ts`, `src/dashboard/views/config.ts`, `src/types.ts`).
- Scheduled execution currently runs through `ArticleSchedulerService` started at dashboard boot, not the older `RecurringScheduler`; it uses `schedule.prompt` in discovery (`Base prompt:`) and again in idea creation (`Base schedule prompt:`), then stores per-run `discovery_json` and `selected_story_json` in `article_schedule_runs` (`src/dashboard/server.ts`, `src/pipeline/article-scheduler-service.ts`, `src/db/schema.sql`).

## 2026-03-28: LM Studio eval follow-up

- Treat LM Studio live evaluation as an opt-in local verification path; keep `LLM_PROVIDER=lmstudio` or `LMSTUDIO_URL` explicit.
- Live `/v1/models` and plain-chat tool-call behavior were confirmed, but `response_format: json_object` failed with LM Studio-specific validation.
- Targeted verification and `npm run v2:build` both passed.
- 2026-03-29 — New spawn batch queued DevOps for branch sync in `C:\github\nfl-eval\worktrees\agenteval`; this sync is the prerequisite handoff before plan split and app implementation kickoff proceed.



## 2026-03-29T23:35:51Z: Stage 4 article-contract E2E fixture narrowing

- Requested by Backend (Squad Agent): Narrow e2e fixture updates so Stage 4+ flows include rticle-contract.md before 4→5 or later advances.
- Modified 4 test files: ux-happy-path.test.ts, edge-cases.test.ts, pipeline.test.ts, full-lifecycle.test.ts.
- Fixture pattern: After writing discussion-summary.md, immediately write rticle-contract.md before advancing to stage 5.
- Enhanced dvanceToStage() helper in edge-cases.test.ts to automatically write rticle-contract.md when advancing through or to stage 4.
- Fixture-only changes per decision inbox; no product code (src/) files modified.
- E2E test results: 91/93 tests passed. 2 pre-existing failures in pipeline.test.ts (memory storage, unrelated to fixture changes).
- Article contract fixture template: '# Article Contract\n\n## Structure\n- Introduction\n- Analysis\n- Conclusion\n\n## Word Count Target\n{N} words' where N matches the draft word count for that test scenario.

## 2026-04-01T06:30:00Z: Code audit — Python script path hardening (NFL_SCRIPTS_DIR config)

- **Related to:** Code agent audit of file-write operations in the pipeline
- **Finding:** Python data script paths hardcoded to \process.cwd()/content/data\ break when PROD runs from a different CWD or when NSSM sets CWD unexpectedly
- **Impact:** fact-check-context.ts, roster-context.ts, validators.ts, data.ts all fail in PROD when CWD ≠ repo root
- **Fix implemented:** Added \scriptsDir: string\ to AppConfig, resolved from \NFL_SCRIPTS_DIR\ env var (fallback: \join(process.cwd(), 'content', 'data')\)
- **NSSM Configuration:** For NSSM service setup, set environment variable: \NFL_SCRIPTS_DIR=C:\github\nfl-eval\content\data\
- **Validation:** Build passes, 144 tests pass, no regressions
- **Commit:** 78e646c5

## Cross-Agent Context Updates (2026-04-03T07:24:06Z)

### From Orchestration (Scribe)
**Tuesday schedule surface:** /schedules and /config?tab=schedules remain the schedule-entry surfaces; article_schedules.prompt is the prompt source of truth and article_schedule_runs.discovery_json / selected_story_json capture per-run history.
