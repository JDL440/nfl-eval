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

Another common failure mode is a history cap at the repository/query layer: the UI renderer can be correct, but article pages still lose early provider rows if they only read the latest N usage events instead of the full per-entity history.

## Recommendation

For dev-only transparency, log the full normalized request/response pair together with article/stage/surface/agent metadata, but keep production telemetry limited to durable summaries and redacted diagnostics.

## Quick triage heuristic

When an article page is "missing" provider usage, separate two seams before changing code:

1. **Provider/persistence seam:** verify the provider test returns `usage`, `AgentRunner` maps it to `tokensUsed`, and `recordAgentUsage()` writes rows only when `tokensUsed` exists.
2. **Repository/UI seam:** verify the article/dashboard surface reads the full per-article `usage_events` history rather than a capped subset that can hide older provider rows.

If the provider path is already covered by tests but the article-page failure only appears after many later events, the bug is usually the repository history cap, not the renderer itself.
