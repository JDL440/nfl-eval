---

# Decision: Treat `usage_events` as the sole source of truth for article token usage

**Issue:** #93 — Bug: article page missing token usage for Copilot CLI provider
**Status:** IMPLEMENTED
**Submitted by:** Code (🔧 Dev)
**Date:** 2026-03-22

---

## TLDR

Do not add Copilot CLI-specific dashboard logic for article usage. The article detail page and HTMX live sidebar should continue to render strictly from persisted `usage_events`, with Copilot CLI covered by the same provider → runner → persistence pipeline as every other LLM provider.

## Decision

For issue #93, the durable fix is to lock down the existing shared usage path with focused regression tests:

- provider `usage` returned by `src/llm/providers/copilot-cli.ts`
- mapped to `AgentRunner.tokensUsed` in `src/agents/runner.ts`
- persisted via `recordAgentUsage()` in `src/pipeline/actions.ts`
- rendered from `repo.getUsageEvents()` by the article detail page and live sidebar in `src/dashboard/server.ts` / `src/dashboard/views/article.ts`

## Why

- Current dashboard rendering is provider-agnostic already; it only needs persisted `usage_events` rows.
- Adding a Copilot CLI-specific UI fallback would duplicate state and hide real persistence regressions.
- The missing protection was end-to-end test coverage, not a separate rendering path.

## Operational rule

When a provider-specific usage bug is reported on the article page, first verify the shared trace (`provider response → runner → usage_events → article renderer`) before adding any dashboard branching. Prefer layered regression tests over special-case rendering.
