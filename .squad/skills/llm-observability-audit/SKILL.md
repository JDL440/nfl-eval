# LLM Observability Audit

## When to use

Use this skill when auditing or improving visibility around LLM requests, responses, retries, or token usage.

## Pattern

1. Start at `src/agents/runner.ts` and `src/pipeline/actions.ts` to see how prompts are constructed and where article/stage/agent identity is attached.
2. Trace normalization in `src/llm/gateway.ts` and `src/llm/providers/*` to see what metadata survives provider boundaries.
3. Check `src/db/repository.ts` and `src/db/schema.sql` to see what is actually persisted.
4. Compare that with dashboard renderers in `src/dashboard/views/article.ts` and `src/dashboard/server.ts` to see what observability is surfaced to users.

## Common gap

Token and cost totals are often persisted, but raw request envelopes, retry history, structured-output parse errors, and normalized finish reasons are usually missing unless a dedicated debug sink exists.

Another recurring failure mode is summary surfaces reading only a recent slice of usage rows. If a dashboard card or article detail page shows aggregate token totals or provider/model breakdowns, verify it reads the full persisted history (or an equivalent DB-side aggregate), not a convenience limit intended for activity feeds.

## Recommendation

For dev-only transparency, log the full normalized request/response pair together with article/stage/surface/agent metadata, but keep production telemetry limited to durable summaries and redacted diagnostics.

## Prompt-vs-envelope sanity check

When a trace UI shows a surprising top-of-prompt rule or capability restriction, verify whether the app itself authored that text before blaming the upstream provider.

1. Check the provider prompt builder (`src/llm/providers/*`) to see whether it injects policy text into the composed prompt.
2. Compare the stored prompt field with the structured request envelope; a full composed prompt should not be described or interpreted as a semantic "delta".
3. If the UI label is ambiguous, treat that as an observability bug or UX confusion seam separate from the runtime provider behavior.
4. Also compare configured-vs-effective execution fields like working directory; metadata can drift from the actual execution plan even when the request envelope is otherwise correct.

## Requested-vs-eligible sanity check

When a trace envelope contains both a feature "requested" flag and an "eligible" flag, do not assume the pair is contradictory.

1. Treat `requested` as the broad runtime/config intent (feature enabled for this provider mode).
2. Treat `eligible` as the per-request gate after stage, surface, article-id, or safety constraints are applied.
3. If `requested: true` and `eligible: false`, inspect the exact gate in provider code before calling it a bug.
4. Also verify repo-root `.env` or startup env overrides before trusting source defaults; effective runtime config may still be older than the checked-in code until the server restarts.

## Requested-vs-used session reuse check

When Copilot CLI traces mention session reuse, separate configuration intent from proof of an actual resumed CLI session.

1. Check the request envelope and CLI plan together: `sessionReuseRequested`, `sessionMode`, traced args, `attemptedSessionId`, and any returned `providerSessionId` / `sessionReused` fields should tell one coherent story.
2. If execution is still prompt-mode or one-shot, treat "requested" as observability only; it does not prove `--resume` ran successfully.
3. Keep the startup contract in view: explicit mode flags such as `toolAccessMode` should stay fail-closed, so unset env should not silently enable tools, repo MCP, or session reuse.
4. Call it a bug only when traced args or provider code show an unsafe default or an unexpected resume attempt, not merely because a trace records reuse intent.
