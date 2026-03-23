# History — Code

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, Hono, HTMX, SQLite, Vitest
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `src/` (core), `src/dashboard/` (Hono routes), `src/pipeline/` (article pipeline), `src/llm/` (LLM gateway), `src/mcp/` (MCP tools), `tests/` (vitest), `vitest.config.ts`

## Core Context

- Team initialized 2025-07-18; the 47 article pipeline agents in `src/config/defaults/charters/nfl/` are separate from Squad agents.
- Issue #81 added usage-event cost estimation; Copilot CLI usage remains estimated because provider usage is undefined.
- Issue #82 is the publish-stage guardrail case: the article page must call the real Substack publish endpoint, not the generic advance handler.
- Issue #83 wired fact checking into the pipeline with claim extraction, nflverse fact-check context, and deterministic validators.
- Issue #85 established the static knowledge-asset proof of concept under defaults/team-sheet artifacts, with runtime loading deferred.
- Issue #88 and #92 established per-article conversation context plus the hybrid summary/handoff model.
- Issue #93 fixed article usage-history reads by keeping full-history ordering deterministic and bounded reads explicit.
- Persisted `*.thinking.md` artifacts are the canonical article debug source.

## Learnings

- 2026-03-22 — TLDR enforcement investigation: writer instructions come from the charter plus `substack-article`, but TLDR remains prompt-only; the runtime guard should hard-fail missing structure instead of relying on prompts.
- 2026-03-22 — Issue #104 usage history follow-up: `created_at DESC, id DESC` ordering plus a matching index makes same-second history reads deterministic.
- 2026-03-22 — Debug visibility restore: the main article view should read companion `*.thinking.md` artifacts first, with inline extraction only as a fallback.
- 2026-03-22 — Issue #85 static knowledge pass: keep authored assets under `src/config/defaults/` plus team-sheet artifacts; runtime loading stays deferred.
- 2026-03-22 — Issue #93 history handling: keep the repository default bounded for callers that only need recent usage, and preserve the unbounded full-history path for UI history views.
- 2026-03-22 — Revision/thinking persistence investigation: latest draft/review/pass artifacts are overwritten in `artifacts` via `writeAgentResult()` + `ArtifactStore.put()`, but durable iteration history lives in `article_conversations` and `revision_summaries`.
- 2026-03-22 — Thinking/debug is a separate persistence path from revision history: `AgentRunner` strips thinking before conversation writes, so conversations store cleaned outputs only while debug survives as `*.thinking.md` sidecar artifacts.
- 2026-03-22 — Dashboard article detail still does not read `article_conversations` or `revision_summaries`; only transient auto-advance SSE emits `revisionCount`.
- 2026-03-22 — `publisher-pass.md` is persisted and included in context-config choices, but the article artifact tab set/allowlist does not surface it.
- 2026-03-22 — Runtime revision history and dashboard revision cards use different stores: `runEditor()` writes `editor-review.md`, `article_conversations`, and `revision_summaries`, but the article page still renders `Editor Reviews` from legacy `editor_reviews`, which normal pipeline runs never populate.
- 2026-03-22 — Issue #107 article contract drift: src/pipeline/engine.ts only gates on draft.md existence and word count, while src/config/defaults/skills/substack-article.md, editor assets, and publisher assets expect a TLDR block; src/llm/providers/mock.ts and current pipeline tests still permit TLDR-less drafts, so durable enforcement belongs in shared runtime/article-contract validation plus focused guard/action/mock regressions.
- 2026-03-22 — Issue #109 dashboard fix: hydrate revision history from `getRevisionHistory()` + `getArticleConversation()`/`buildRevisionHistoryEntries()` in `src/dashboard/server.ts`, then render it in `src/dashboard/views/article.ts` as a dedicated Revision History section.
- 2026-03-22 — Issue #109 artifact visibility: preserve the canonical latest-state artifact tabs, but surface persisted non-hidden extras (for example `publisher-pass.md`) in a separate collapsible list so the tab model does not become pseudo-history.
- 2026-03-22 — Issue #109 debug rendering: `renderArtifactContent()` should prefer persisted `*.thinking.md` sidecars and only use inline `<think>` extraction as a fallback; focused regressions live in `tests/dashboard/server.test.ts`, `tests/dashboard/wave2.test.ts`, and `tests/pipeline/conversation.test.ts`.
- 2026-03-22 — Issue #108 retrospectives: hook the automation after auto-advance reaches Stage 7+, then persist one markdown artifact plus a structured parent/child DB record keyed by `(article_id, completion_stage, revision_count)` so reruns stay idempotent without inventing a Stage 9.

### 2026-03-22T22:16:52Z: Scribe inbox merge
- Confirmed the TLDR gap is still a deterministic pipeline-enforcement problem: Writer can omit the block because the validator is missing.
- The retrospective request stays as post-stage artifact/logging work, not a new pipeline stage.
- Inbox findings were merged into `.squad/decisions.md` and deduplicated.


### 2026-03-22T22:18:04Z: TLDR contract decision merge
- Merged the TLDR contract drift notes into the canonical decision log.
- Keep the TLDR requirement as a deterministic draft-structure gate with regression coverage.
