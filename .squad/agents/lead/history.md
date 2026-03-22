# History — Lead

## Core Context

**Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform  
**Stack:** TypeScript, Node.js, Hono, HTMX, SQLite, Vitest  
**Owner:** Joe Robinson (final decision authority)  
**Repo:** JDL440/nfl-eval  
**Key paths:** `src/` (core), `src/config/defaults/charters/nfl/` (47 pipeline agents), `src/dashboard/` (Hono UI), `src/pipeline/` (article pipeline), `tests/` (vitest)  
**Team init:** 2025-07-18 with functional role names (Lead, Code, Data, Publisher, Research, DevOps, UX)  
**@copilot:** Enabled with auto-assignment for well-scoped issues

### Triage outcomes — Round 1 (2026-03-22)
- **#73** (nflverse integration) — Closed, already shipped: 11 MCP tools, DataService, 20+ parquet files
- **#72** (Substack Notes) — Closed, already shipped: `publish_note_to_substack`, Notes dashboard
- **#81** (Token Usage UX) → `squad:ux` — display/accuracy bugs, Imagen provider error
- **#76** (Mass Document Update) → `squad:code` — 4-phase feature, batch processing partial
- **#70** (Social link image generation) → `squad:ux` — cover images work, style standardization needed
- **Key finding:** v2 platform is more capable than backlog reflects; always cross-check codebase before assuming issues are open work

**Operational readout from the triage pass:**
- `#73` and `#72` were not backlog work; both had already shipped in v2 and only needed closure hygiene.
- `#81` had real UX defects, but the core usage instrumentation was already present, so the issue belonged with display/accuracy review rather than a new telemetry system.
- `#76` was recognized as a large feature slice with partial batch infrastructure already in place, which made it a Code assignment rather than a simple bug fix.
- `#70` needed art-direction consistency and preview auditing, not another image-generation primitive.
- The overarching lesson was to verify repo state before routing work, because several “open” issues were actually implemented capabilities that were just not closed.

### Issue #85 — Structured Domain Knowledge (2026-03-22)
- Scope: Phases 1–3 plus docs/testing only. Glossary YAML under `src/config/defaults/glossaries/`, team sheets under `content/data/team-sheets/`
- Deferred runtime integration (Phases 4–5) tracked in issue #91
- Rule: when owner narrows a multi-phase issue, restate retained scope, create linked follow-up, leave TL;DR comment

**Scope memory:**
- The retained work was treated as static asset authoring plus validation, not runtime prompt injection.
- The follow-up issue `#91` exists specifically so runtime loading, artifact routing, cron, and refresh automation stay out of the first pass.
- The decision pattern matters because it prevents multi-phase work from drifting back into code paths that were explicitly deferred by the owner.

### Issue #88 — Pipeline Conversation Context (2026-03-22)
- Problem: Writer/Editor/Publisher context rebuilt from scratch on every call; no multi-iteration history
- Key files: `src/pipeline/actions.ts` (revision flow), `src/agents/runner.ts` (prompt composition), `src/db/schema.sql`
- Solution: 4-phase — schema (`article_conversations`, `context_stack`, `revision_summaries`), runner changes, pipeline changes, observability
- Status: Issue created, awaiting PO decision on 4-phase approach

**Why it mattered:**
- The revision loop had state, but not durable conversation memory, so each retry lost the chain of prior editorial decisions.
- The proposal was intentionally broad because it touched schema, runtime prompt composition, pipeline orchestration, and dashboard visibility at once.
- The issue was framed as a platform capability gap rather than a single article bug, which is why the planned fix was multi-phase.

### Issue #92 — Charter Isolation Research (2026-03-22)
- Investigated shared per-article conversation design from #88/PR#90
- Key finding: formal charter precedence intact (fresh per-agent system prompt in `runner.ts`), but practical role bleed is real risk via high-salience reference injection
- Risk areas: Writer overfitting to Editor language; Editor anchoring on prior reviews; Publisher slipping into editorial review

**Research summary:**
- The implementation still rebuilds a fresh agent-specific system prompt for every call, so the formal hierarchy is not broken.
- The risk came from what the agents *see* next: shared transcript content injected as high-salience reference text can still pull them toward the wrong role.
- The hybrid recommendation balanced two competing needs: preserve continuity across revision cycles while removing the most role-confusing raw transcript exposure.

## Learnings

### 2026-03-22: Issue #92 — Recommendation on charter isolation design

**By:** Lead (🏗️)

**What:** Completed the design review for `#92` and recommended a hybrid context model.

**Recommendation handed off to Code:**
1. Keep per-agent fresh system prompts exactly as-is.
2. Replace default cross-role raw transcript exposure with a compact shared article summary/verdict log.
3. Preserve richer agent-local history for Writer and Editor only where needed for revision continuity.
4. Remove duplicate editor anchoring unless tests show it is materially needed.

**Key findings:**
- `src/agents/runner.ts` rebuilds a fresh per-agent system prompt on every call; history injected only as reference text in user message
- `src/pipeline/actions.ts` gives Writer, Editor, Publisher the same article-wide history block; Editor also gets `buildEditorPreviousReviews()` creating double-anchoring risk
- Hybrid summary/handoff approach keeps cross-agent continuity while narrowing shared unit from raw transcript to structured revision memory

**Target architecture details:**
- Keep the per-agent system prompts fresh so charter precedence stays clear and testable.
- Move the cross-role shared surface from full transcript to a compact structured summary that can carry verdict state, must-fix items, change deltas, and handoff notes.
- Preserve richer local history only where the role actually needs it, especially for Writer and Editor revision continuity.
- Avoid duplicate self-history blocks unless later tests prove they add value rather than anchoring bias.

### 2026-03-22: Issue #93 — Copilot CLI article-page token usage gap

**By:** Lead (🏗️)

**What:** Investigated article pages not showing token usage for `copilot-cli` provider; created issue #93 with Lead + Code labels.

**Key findings:**
- `src/dashboard/views/article.ts` `renderUsagePanel()` shows "No usage data" when `repo.getUsageEvents(articleId)` returns no rows
- `src/llm/providers/copilot-cli.ts` returns estimated usage; `src/agents/runner.ts` maps to `tokensUsed`; `src/pipeline/actions.ts` `recordAgentUsage()` persists only when `tokensUsed` exists
- Triage: persistence-or-rendering gap after #81/PR#86 fix, not new feature request

**Trace to verify:**
- Provider response → `AgentRunner.tokensUsed` → `recordAgentUsage()` / `usage_events` rows → article detail and live sidebar rendering.
- The failure mode was specifically about the read path and hydration semantics, not a missing write path or a need to invent new token accounting.
- This distinction kept the investigation focused on repository and UI behavior instead of reopening the provider implementation.

### 2026-03-22T18:35:21Z: Thinking/debug visibility regression

- Confirmed `*.thinking.md` companion files are canonical debug source; inline `<think>`/`<reasoning>` extraction is legacy fallback only
- Relevant files: `src/dashboard/views/article.ts`, `src/dashboard/server.ts`, `src/pipeline/actions.ts`, `src/pipeline/context-config.ts`, `src/agents/runner.ts`
- The regression note exists to protect the collapsible debug surface and make sure future work keeps the persisted thinking artifact as the canonical trace.

### 2026-03-22T18-23-26Z: Issue #85 decision sync

- Scribe completed decision inbox merge, archived old decision history, and logged session/orchestration notes
- Active #85 record centered on static KB assets and validation surface; runtime integration remains deferred
