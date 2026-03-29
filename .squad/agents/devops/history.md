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

## 2026-03-28: LM Studio eval follow-up

- Treat LM Studio live evaluation as an opt-in local verification path; keep `LLM_PROVIDER=lmstudio` or `LMSTUDIO_URL` explicit.
- Live `/v1/models` and plain-chat tool-call behavior were confirmed, but `response_format: json_object` failed with LM Studio-specific validation.
- Targeted verification and `npm run v2:build` both passed.
- 2026-03-29 — New spawn batch queued DevOps for branch sync in `C:\github\nfl-eval\worktrees\agenteval`; this sync is the prerequisite handoff before plan split and app implementation kickoff proceed.


