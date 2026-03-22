# Decision — Issue #93 token usage history default

- **By:** Code (🔧 Dev)
- **Date:** 2026-03-22
- **Issue:** #93

## Decision

Treat `Repository.getUsageEvents(articleId)` as the article-detail history API and return the full per-article `usage_events` set by default. Keep bounded reads available through the existing optional `limit` argument.

## Why

- The Copilot CLI provider path is already healthy: `src/llm/providers/copilot-cli.ts` estimates usage, `src/agents/runner.ts` maps it into `tokensUsed`, and `src/pipeline/actions.ts` persists rows through `recordAgentUsage()`.
- The missing article-page usage only appears after more than 100 later events, which means the break is at the repository/UI seam rather than provider creation or persistence.
- The article detail page and live sidebar in `src/dashboard/server.ts` are summary surfaces for a single article's durable history, so silent truncation at the repository seam makes provider/model breakdowns misleading.

## Guardrail

If a caller truly needs only the newest N rows, it should pass an explicit `limit`. The repository default should favor complete article observability over hidden truncation.
