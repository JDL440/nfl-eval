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
