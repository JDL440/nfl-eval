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
- Writer preflight opener false-positive: `writer-preflight.ts` + `writer-support.ts` sentence-opener filtering must stay synchronized (25+ conjunctions: Because, Since, Due, Given, If, When, While, Before, After, During, Following, Although, However, Furthermore, Moreover, Thus, Therefore, Consequently, As, Or, And, But, Yet, Unless, Except, Unlike, Regarding, Concerning, Considering).
- Roster parquet current-snapshot: Missing `week` field signals current snapshot. Skip week filtering; render "Current snapshot" in `roster-context.ts`.
- Dashboard mobile: Shell/nav → data-surface → detail/preview → page cleanup → regression coverage. Markup hooks exist; CSS selectors incomplete.
- Stage 5 coverage: writer-support.test.ts, writer-preflight.test.ts, roster-context.test.ts, actions.test.ts all carry focused regression paths.

## Historical Context (Archived from Learnings, 2026-03-24 and earlier)

- Stage 5/6/7 simplification: `substack-article.md` owns article structure/TLDR/image contract. `writer-fact-check.md` owns Stage 5 bounded verification. `editor-review.md` owns Stage 6 review protocol. Context distribution via `context-config.ts` + `actions.ts` avoids duplication.
- Issue #102 (Auth): Config-driven `DASHBOARD_AUTH_MODE=off|local` with env-backed credentials, SQLite-backed sessions, centralized Hono middleware, secure defaults (opaque ids, httpOnly/SameSite cookies, 24h TTL). Validation: tests in `tests/dashboard/{server,config,publish}.test.ts`, `tests/e2e/live-server.test.ts`.
- Issue #123 (Repeated Blocker): Exact consecutive Editor `REVISE` comparison via normalized fingerprint. Escalates at Stage 6 without new stage. Blocks normal loop bypass only for repeated case. Tests: 5 in actions.test.ts, 2 in conversation.test.ts, 2 in repository.test.ts, 1 in server.test.ts.
- Optional dashboard services (Substack, Twitter): Resolve via `resolveDashboardDependencies()` in `src/dashboard/server.ts`. Tests exercise real startup path.
- Writer revision retry: `writeDraft()` self-heal appends failed draft under `## Failed Draft To Revise`. Prompt guidance in charters + skills. TLDR fixes as revisions.
- Publish payload: HTML→ProseMirror refactored to operate on document nodes. Tests passing (45+).
- `buildRevisionHistoryEntries()` must normalize missing `blocker_type` to `null`.
- Stage 5 context seam: `src/pipeline/context-config.ts` makes artifacts available to Writer without widening Editor/Publisher scope.
- Generate-idea selector: NFL-wide charter key is lowercase `nfl`; UI badge uses `NFL`. Keep identifiers aligned.

- 2026-03-24T22:01:20Z — **Stall-fix runtime-regressions audit**: Code audited 8 files (4 product, 4 test) across writer-support, writer-preflight, roster-context, and actions. Existing vitest coverage is adequate: exact-vs-analytical separation tested in writer-support.test.ts; stale roster/missing player/wrong-team error paths tested in roster-context.test.ts; caution claim attribution/softening tested in writer-preflight.test.ts. Integration paths via writeDraft() append/retry/self-heal tested in actions.test.ts. Decision documented: inline stage 5 artifact writer-support.md (canonical names, exact facts allowed, caution bucket, roster guidance) built from writerFactCheckReport + roster-context + writer-preflight sources. No product code changes required. Audit complete.
- 2026-03-25T05:40:46Z — **Writer preflight opener false-positive fix session**: Code completed full fix for "Because San Francisco" validation false positive. Root cause: both `writer-preflight.ts` and `writer-support.ts` lacked sentence-opener filtering in their `BANNED_FIRST_TOKENS` lists. Implementation: added 25+ conjunctions (Because, Since, Due, Given, If, When, While, Before, After, During, Following, Although, However, Furthermore, Moreover, Thus, Therefore, Consequently, As, Or, And, But, Yet, Unless, Except, Unlike, Regarding, Concerning, Considering) to both files with synchronized lists. Paired with complementary fix: preflight now trusts writer-support canonical names as primary authority before falling back to raw extraction. Files modified: `src/pipeline/writer-preflight.ts`, `src/pipeline/writer-support.ts`, tests in both test files. Validation: focused regression tests covering "Because X", "If X", "When X" patterns all pass. `npm run v2:build` validated. Decision records merged to decisions.md covering root cause analysis, implementation rationale (two-layer approach: opener filtering + structured-support priority), architecture rationale, and mobile/dashboard audit findings. Orchestration log and session log documented at `.squad/orchestration-log/2026-03-25T05-40-46Z-Code.md` and `.squad/log/2026-03-25T05-40-46Z-preflight-opener-fix.md`.
