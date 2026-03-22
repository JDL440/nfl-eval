# Decision: Article usage summaries must read full per-article history

**Issue:** #93 — article page missing token usage for Copilot CLI provider
**Status:** IMPLEMENTED
**Submitted by:** Code (🔧 Dev)
**Date:** 2026-03-22

---

## TLDR

When the dashboard renders an article-level token usage summary, it must aggregate from the full `usage_events` history for that article, not an arbitrary recent-row cap.

## Decision

Change `Repository.getUsageEvents(articleId)` so the default call returns all usage rows for the article. Keep the `limit` parameter only for explicit callers that truly want truncation (`getUsageEvents(articleId, 100)`).

## Why

- The Copilot CLI provider already returns estimated usage, `AgentRunner` maps that to `tokensUsed`, and `recordAgentUsage()` persists it into `usage_events`.
- The bug surfaced later because article detail and live-sidebar routes hydrate their summary panels with `repo.getUsageEvents(articleId)`, and the old default limit of 100 rows silently dropped early-stage usage once later panel/editor events accumulated.
- Article usage panels show aggregate totals and provider/model breakdowns, so truncating the source rows changes correctness, not just pagination.

## Guardrail

Any UI or report that presents article-wide token totals, provider breakdowns, or cost summaries must read the full per-article usage history unless it also performs a correctness-preserving aggregate query in the database.
