# Decision: Issue #93 usage panel should hydrate full article history

**Issue:** #93 — article page missing token usage for Copilot CLI provider
**Submitted by:** UX (⚛️)
**Date:** 2026-03-22

## TLDR

For article detail and HTMX live-sidebar usage panels, `Repository.getUsageEvents(articleId)` should return the full per-article history by default. Any usage cap must be opt-in at the caller.

## Why

- The Copilot CLI provider already estimates usage, `AgentRunner` already maps it into `tokensUsed`, and pipeline actions already persist it into `usage_events`.
- The dashboard gap came from hydration: the repository helper silently defaulted to the newest 100 rows, so early `copilot-cli` calls disappeared once later stage activity accumulated.
- Returning full history by default keeps the human-facing usage panel trustworthy while still allowing explicit limits where a compact view is actually desired.

## Scope guard

This decision is only about the token-usage chain for issue #93. It does not change artifact thinking/debug rendering or any other dashboard debug surface.
