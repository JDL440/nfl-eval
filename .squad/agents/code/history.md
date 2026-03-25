## 2026-03-27T06-46-06Z — Warner Preflight Hardening Implementation

**Orchestration log:** .squad/orchestration-log/2026-03-27T06-46-06Z-code.md  
**Session log:** .squad/log/2026-03-27T06-46-06Z-warner-preflight-hardening.md

**Status:** ✓ Completed — Preflight hardening implemented and validated in worktrees/V3

**Implementation:** Add "Lose" to BANNED_FIRST_TOKENS in writer-preflight.ts
- Release-context verbs: Lose, Cut, Release, Drop (extending the action-verb blocklist)
- Test case: filters release-context action verbs before checking names
- Validation: preflight test suite passing in V3 worktree

**Decision:** [Warner Last-Name Heuristic Boundary Review](../../decisions.md)

---

---
# History — Code

## 2026-03-25T05-51-20Z — Option B Article-Page Review

**Orchestration log:** .squad/orchestration-log/2026-03-25T05-51-20Z-code.md  
**Session log:** .squad/log/2026-03-25T05-51-20Z-option-b-article-plan.md

**Status:** ✓ Completed — Option B server/rendering/test wiring reviewed

**Findings:**
- Article-view-only implementation approved by Lead.
- No type system changes required.
- Server wiring for transient status only.
- Smallest-safe pass confirmed.

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, Hono, HTMX, SQLite, Vitest
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `src/` (core), `src/dashboard/` (Hono routes), `src/pipeline/` (article pipeline), `src/llm/` (LLM gateway), `src/mcp/` (MCP tools), `tests/` (vitest), `vitest.config.ts`

## Core Context

- Issue #107 locked the canonical `substack-article` contract: one TLDR/image policy source for Writer, Editor, Publisher, and pipeline guards.
- Issue #108 added the post-Stage-7 retrospective runtime and repository persistence, with structured tables plus a synthesized `revision-retrospective-rN.md` artifact.
- Issue #109 renders revision history from the conversation/revision seams; Issue #110 keeps stage timing as a dashboard aggregation over existing timestamps.
- Dashboard architecture is Hono + HTMX + SSE on port 3456, with config loaded from `.env` and `~/.nfl-lab/config/.env`.
- Issue #115 runtime already satisfied by existing manual/read-only retrospective digest seam: `src/cli.ts` provides `retrospective-digest` / `retro-digest`, `src/db/repository.ts` reads joined structured retrospective rows, `src/pipeline/actions.ts` persists findings, and operator guidance is documented in `README.md`.
- Issue #117 keeps the retrospective digest CLI read-only, using one joined repository query plus normalized-text dedupe and bounded markdown/JSON output.
- Issue #118 promotion rule: repeated `process_improvement` findings must promote to issue-ready independent of author or priority. Added explicit repetition check to `promoteIssueCandidates()`.
- Issue #120 stores revision blocker metadata directly on `revision_summaries` via `blocker_type` + JSON `blocker_ids`, with backward-compatible handoff through `feedback_summary` and `key_issues`. Write seam: `src/pipeline/actions.ts` (parses `[BLOCKER type:id]` tags from `## 🔴 ERRORS`); read seam: `src/pipeline/conversation.ts` + `src/db/repository.ts`.
- Issue #123 repeated-blocker escalation at Stage 6: detects exact consecutive Editor `REVISE` comparison using normalized blocker fingerprint (`blockerType` lowercase + `blockerIds` sorted/deduped), writes `lead-review.md`, sets status to `needs_lead_review`, blocks normal regress/force-approve path only for repeated case. Cleanup via `clearArtifactsAfterStage` on regression below Stage 6. Test coverage: 5 focused tests in actions.test.ts, 2 in conversation.test.ts, 2 in repository.test.ts, 1 in server.test.ts. Approved and ready for merge.
- Issue #125 writer fact-check: three-slice arc complete (Policy Definition → Runtime Enforcement → Editor Consumption). Slice A: bounded policy in `src/pipeline/writer-factcheck.ts`. Slice B: Stage 5 wall-clock budget enforcement via fetch-level abort signal. Slice C: Editor consumption of `writer-factcheck.md` as advisory context in `src/pipeline/context-config.ts` + `src/pipeline/actions.ts`. Writer provides bounded verification ledger; Editor maintains final authority. Validation passed.
- Writer support artifact decision (2026-03-27): Lead approved minimal Stage 5 artifact `writer-support.md` that normalizes names/facts/cautions from existing `writer-factcheck`, `roster-context`, and `writer-preflight` sources. Seam: immediate after `writer-factcheck.md` read block in `writeDraft()`, before `writerPreflightSources` assembly. Contains 4 sections: `Canonical Names`, `Exact Facts Allowed`, `Claims Requiring Caution`, `Roster Guidance`. Writer consumes for name/claim guidance; preflight parses first before fuzzy-match fallback. Queued for implementation.
- Optional dashboard services (Substack, Twitter) resolve through startup dependency injection via `resolveDashboardDependencies()` helper in `src/dashboard/server.ts`. Tests exercise real startup path; env-configured services work correctly.
- Writer revision retry: `writeDraft()` self-heal failures append failed draft under `## Failed Draft To Revise` for revision instead of restarting. Prompt guidance aligned across `src/config/defaults/charters/nfl/{editor,publisher}.md` plus `src/config/defaults/skills/{editor-review,publisher}.md`. TLDR fixes framed as revisions that preserve working analysis.
- Writer revision handoff is assembled in `src/pipeline/actions.ts` inside `writeDraft()`: shared cross-role context from `buildRevisionSummaryContext()`, full `editor-review.md` and previous `draft.md` injected into `articleContext`. Merged writer prompt is runtime-only in `src/agents/runner.ts`; SQLite persists pieces (`artifacts`, `article_conversations`, `revision_summaries`) but not canonical per-iteration prompt snapshot.
- Publish payload: HTML→ProseMirror handling refactored to operate on document nodes instead of string replacement. All validation passed (45 passing tests).
- `buildRevisionHistoryEntries()` must normalize missing legacy/in-memory `blocker_type` values to `null` before dashboard/API consumers render revision history.
- Stage 5 context seam for new artifacts is `src/pipeline/context-config.ts`: low-risk way to make artifacts available to Writer without widening Editor/Publisher scope.

## Learnings & Critical Seams

**Active regression prevention:**
- Article detail Option B: `src/dashboard/views/article.ts` should keep one canonical `Current stage` block plus one compact workflow-status line. Put run diagnostics under `renderAdvancedSection()` as `Execution History`, render persisted `stage_runs.stage` directly (not `stage + 1`), keep revisions collapsed, and mirror header/status changes through `renderLiveHeader()` + `src/dashboard/server.ts`. Validation seam: `tests/dashboard/server.test.ts`, `tests/dashboard/wave2.test.ts`, `npm run v2:build`.
- Writer preflight opener false-positive: `writer-preflight.ts` + `writer-support.ts` sentence-opener filtering must stay synchronized (25+ conjunctions: Because, Since, Due, Given, If, When, While, Before, After, During, Following, Although, However, Furthermore, Moreover, Thus, Therefore, Consequently, As, Or, And, But, Yet, Unless, Except, Unlike, Regarding, Concerning, Considering).
- Roster parquet current-snapshot: Missing `week` field signals current snapshot. Skip week filtering; render "Current snapshot" in `roster-context.ts`.
- Dashboard mobile: Shell/nav → data-surface → detail/preview → page cleanup → regression coverage. Markup hooks exist; CSS selectors incomplete.
- Article detail mobile width: Stage 5+ overflow came from `src/dashboard/public/styles.css` `.image-gallery` using `minmax(280px, 1fr)` inside padded `.detail-section` cards. Fix the root cause with `minmax(min(100%, 280px), 1fr)` and lock it with `renderImageGallery()` + `tests/dashboard/wave2.test.ts` rather than hiding overflow globally.
- Stage 5 coverage: writer-support.test.ts, writer-preflight.test.ts, roster-context.test.ts, actions.test.ts all carry focused regression paths.

## Core Context Summary

**Architecture & Patterns:**
- Stage 5/6/7 contracts: `substack-article.md` (structure/TLDR/image), `writer-fact-check.md` (verification), `editor-review.md` (review). Context via `context-config.ts` + `actions.ts`.
- Issue #102 (Auth): Config-driven mode with SQLite sessions, Hono middleware, secure defaults (opaque ids, httpOnly/SameSite, 24h TTL).
- Issue #123 (Repeated Blocker): Normalized fingerprint, escalates at Stage 6, blocks loop bypass only on repeat.
- Optional services (Substack, Twitter): Dependency injection via `resolveDashboardDependencies()` in `src/dashboard/server.ts`.
- Writer revision retry: Self-heal via `## Failed Draft To Revise` seam in `writeDraft()`.
- Publish: HTML→ProseMirror document-node refactoring (45+ tests).
- Stage 5 context seam: `src/pipeline/context-config.ts` provides Writer scope without expanding Editor/Publisher.

**Recent Work (2026-03-24 to 2026-03-25):**
- Audited writer-support/preflight/roster integration for runtime regressions; coverage adequate via focused test paths.
- Fixed preflight opener false-positive: synchronized 25+ conjunctions in BANNED_FIRST_TOKENS across preflight + writer-support; preflight now trusts canonical names first.
- Mobile width: identified gallery card minmax root cause, implemented CSS fix with regression coverage.
- Sentence-starter: expanded BANNED_FIRST_TOKENS with action verbs (Take, Hit, Draft, Grab, Pick, Select, Land, Sign, Ink, Target, Pursue, Add, Trade, Watch, Build, Keep, Leave, Get).

