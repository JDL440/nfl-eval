# Decision — Issue #93 article usage panels must use full per-article usage history

- **By:** UX (⚛️)
- **Date:** 2026-03-22
- **Issue:** #93

## Decision

For article detail and live usage panels, `usage_events` should be read as the full per-article history by default, not the newest 100 rows.

## Why

- The provider and pipeline layers already create Copilot CLI token usage: `src/llm/providers/copilot-cli.ts` returns estimated usage, `src/agents/runner.ts` maps it into `tokensUsed`, and `src/pipeline/actions.ts` persists it.
- The user-facing gap appeared later in the chain because `Repository.getUsageEvents()` capped article reads at 100 rows, which let early `copilot-cli` events disappear after many later panel/editor runs.
- The article usage UI in `src/dashboard/server.ts` and `src/dashboard/views/article.ts` is intended to summarize the article's durable usage record, so truncating history at the repository seam produced misleading provider/model breakdowns.

## Scope note

This decision is narrowly for article-level usage rendering. Callers that truly need a bounded history can still request an explicit limit.
