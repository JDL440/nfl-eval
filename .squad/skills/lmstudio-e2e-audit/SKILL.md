---
name: LM Studio E2E Audit
domain: runtime-audit
confidence: high
tools: [powershell, view, sql]
---

# LM Studio E2E Audit

## When to Use

- You changed the LM Studio provider path, tool loop, stage actions, or runtime prompt bootstrap.
- You need proof from the real server startup path, not just isolated unit tests.
- You want a tool-call success/failure rundown from `llm_traces.metadata_json`.

## Fastest Repeatable Path

Use the env-gated real-provider scenario test:

```powershell
Set-Location C:\github\nfl-eval\worktrees\agenteval
$env:RUN_LMSTUDIO_SCENARIO='1'
npm run v2:test -- tests/e2e/lmstudio-scenario.test.ts
```

What this covers on a clean temp data dir:

1. starts the real `v2:serve` server
2. forces `LLM_PROVIDER=lmstudio`
3. drives `POST /api/ideas`
4. drives `POST /api/articles/:id/auto-advance`
5. waits until the article reaches `writeDraft` or later
6. reads `stage_runs` and `llm_traces`
7. summarizes persisted tool calls by name and success/failure

## Expected Floor

Today, the stable floor for this scenario is:

1. `ideaGeneration` completes
2. `generatePrompt` completes
3. `composePanel` completes
4. `runDiscussion` completes, often via the single-moderator fallback
5. `writeDraft` is reached, even if draft validation later fails

If the scenario regresses before `runDiscussion`, treat that as a serious runtime break.

## What to Inspect When It Fails

1. **Startup logs**
   - confirm `LM Studio provider registered`
   - confirm fresh runtime prompt refresh happened at startup

2. **`stage_runs`**
   - find the first failed stage
   - distinguish guard failures from agent/runtime failures

3. **`llm_traces`**
   - inspect `surface`, `status`, `error_message`
   - inspect `metadata_json.toolCalls`

4. **Prompt bootstrap**
   - verify clean runtimes include stage-critical charters and skills from `CORE_RUNTIME_PROMPT_DEFAULTS`
   - missing `panel-moderator` or `publisher` is a startup/bootstrap bug, not an LM Studio model issue

## Current Known Behavior

- Fresh clean runtimes now refresh the stage-critical bundle:
  - charters: `lead`, `writer`, `editor`, `panel-moderator`, `publisher`
  - skills: `article-discussion`, `article-lifecycle`, `discussion-prompt`, `panel-composition`, `fact-checking`, `idea-generation`, `substack-article`, `writer-fact-check`, `editor-review`, `publisher`
- `runDiscussion` may still fall back when panel composition invents analyst charter names like `sea`, `cap`, or `defense`
- `writeDraft` can still fail validation on unsupported precise financial claims even after retry

## Useful Follow-Up Queries

If you need to inspect the latest scenario DB directly:

```sql
SELECT stage, surface, status, notes
FROM stage_runs
WHERE article_id = ?
ORDER BY started_at, id;

SELECT stage, surface, status, error_message, metadata_json
FROM llm_traces
WHERE article_id = ?
ORDER BY started_at, id;
```

## References

- `tests/e2e/lmstudio-scenario.test.ts`
- `src/config/index.ts`
- `src/agents/runner.ts`
- `src/pipeline/actions.ts`
