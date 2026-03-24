# History — Code

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
- Optional dashboard services (Substack, Twitter) resolve through startup dependency injection via `resolveDashboardDependencies()` helper in `src/dashboard/server.ts`. Tests exercise real startup path; env-configured services work correctly.
- Writer revision retry: `writeDraft()` self-heal failures append failed draft under `## Failed Draft To Revise` for revision instead of restarting. Prompt guidance aligned across `src/config/defaults/charters/nfl/{editor,publisher}.md` plus `src/config/defaults/skills/{editor-review,publisher}.md`. TLDR fixes framed as revisions that preserve working analysis.
- Writer revision handoff is assembled in `src/pipeline/actions.ts` inside `writeDraft()`: shared cross-role context from `buildRevisionSummaryContext()`, full `editor-review.md` and previous `draft.md` injected into `articleContext`. Merged writer prompt is runtime-only in `src/agents/runner.ts`; SQLite persists pieces (`artifacts`, `article_conversations`, `revision_summaries`) but not canonical per-iteration prompt snapshot.
- Publish payload: HTML→ProseMirror handling refactored to operate on document nodes instead of string replacement. All validation passed (45 passing tests).
- `buildRevisionHistoryEntries()` must normalize missing legacy/in-memory `blocker_type` values to `null` before dashboard/API consumers render revision history.
- Stage 5 context seam for new artifacts is `src/pipeline/context-config.ts`: low-risk way to make artifacts available to Writer without widening Editor/Publisher scope.

## Learnings

- 2026-03-23T21:53:55Z — **Issue #102 Auth Flow Rundown Complete**: Quick technical summary of auth implementation provided. Config loading via `DASHBOARD_AUTH_MODE` from `.env` + `~/.nfl-lab/config/.env`, login/logout via POST routes, session persistence in SQLite with opaque ids, secure cookie settings (httpOnly, SameSite, Secure), centralized middleware enforcement of protected/public route split. All test files documented and passing. Ready for merge. See `.squad/orchestration-log/20260323T215355Z-code.md` and session log `.squad/log/20260323T215355Z-issue-102-auth-review-rundown.md`.
- 2026-03-24T04:46:45Z — **Issue #102 Local Dashboard Auth Implementation Complete**: Config-driven `DASHBOARD_AUTH_MODE=off|local` auth hardening delivered and validated. Implementation seams: config parsing in `src/config/index.ts`, login/logout routes + centralized middleware in `src/dashboard/server.ts`, session persistence in `src/db/schema.sql` + `src/db/repository.ts`, middleware enforcement of protected/public routes. Secure defaults applied: opaque session ids, `httpOnly` + `SameSite=Lax` cookies with production `Secure` flag, server-side TTL (24h default). All focused auth tests passing across `tests/dashboard/server.test.ts`, `tests/dashboard/config.test.ts`, `tests/dashboard/publish.test.ts`, `tests/e2e/live-server.test.ts`. TypeScript build failure fixed. Ready for merge pending operator docs. See `.squad/orchestration-log/2026-03-24T04-46-45Z-code.md` and `.squad/decisions.md` (Code Decision — Issue #102).
- 2026-03-25T21:45:00Z — **Issue #123 Closeout & Approval**: Repeated-blocker escalation implementation for Stage 6 handoff completed and approved by Lead. All contract points validated: exact consecutive Editor `REVISE` comparison with normalized blocker fingerprint, repeated case escalates at Stage 6 without new stage, normal loop bypass narrow (skips auto-regress and max-revision force-approve), read paths expose state/artifact appropriately, artifact lifecycle bounded. All focused tests passed. Build passed. Issue ready for merge. See `.squad/orchestration-log/2026-03-24T03-26-23Z-Code.md`.
- 2026-03-24T00:00:00Z — Generate-idea selector seams: the visible team picker on `/ideas/new` is the static `NFL_TEAMS` list in `src/dashboard/views/new-idea.ts`, while the pinned-agent picker is built server-side in `src/dashboard/server.ts` from `runner.listAgents()`. The league-wide charter key is lowercase `nfl` in runtime/team-classification code (`src/dashboard/views/agents.ts`, `src/pipeline/actions.ts`), but the UI team badge uses uppercase `NFL`; keeping those two identifiers aligned is the key to making the NFL-wide agent selectable without surfacing all 32 team charters in the expert picker.
- 2026-03-26T22:39:00Z — **Generate-idea selector seam**: `/ideas/new` uses two different sources. Team-like choices come from the static `NFL_TEAMS` array in `src/dashboard/views/new-idea.ts`, while the optional pinned-expert picker is built in `src/dashboard/server.ts` from `runner.listAgents()` (`config.chartersDir`) after filtering production/team agents. League-wide NFL support should use UI key `NFL` for article/team context and agent key `nfl` for charter/runner classification; keep both in sync across `src/dashboard/server.ts`, `src/pipeline/actions.ts`, `src/dashboard/views/agents.ts`, and `tests/dashboard/{new-idea,agents}.test.ts`.
- 2026-03-26T22:46:00Z — **Stage Runs badge semantics**: \stage_runs.stage\ is already the persisted article/dashboard stage, not a "next stage" target. Keep \enderStageRunsPanel()\ aligned with \rticle.current_stage\ semantics by rendering the stored stage number/name directly; lock that expectation in \	ests/dashboard/wave2.test.ts\ and \	ests/db/repository.test.ts\. Key seams: \src/dashboard/views/article.ts\, \src/db/repository.ts\, \src/types.ts\.
- 2026-03-23T22:44:04Z — **Stage Badge Mismatch Fix Complete**: Fixed dashboard Stage Runs badge display. Article header badge (\rticle.current_stage\) and Stage Runs panel (\stage + 1\ pre-fix) showed different stage numbers for the same article. Narrow fix in \src/dashboard/views/article.ts\ removes the \+ 1\ increment; Stage Runs now renders persisted \stage_runs.stage\ directly. Updated tests in \	ests/dashboard/wave2.test.ts\ (Stage 5 expectation) and \	ests/db/repository.test.ts\ (regression test). All tests passing, build passing. Decision merged to \.squad/decisions.md\. See \.squad/orchestration-log/2026-03-23T22-44-04Z-code.md\.

## Generate Idea Selector — Implementation (2026-03-24T05:37:47Z)

**Status:** Filesystem verified; pending lead approval

**UX confirmed:** Clean render path, no UX gaps. Expert selector correctly filters NFL-wide specialists from production and team agents.

**Changes verified:**
- src/dashboard/views/new-idea.ts (selector integration)
- src/dashboard/server.ts (expert agents filter, lines 847–861)
- tests/dashboard/new-idea.test.ts (selector tests)

**Next:** Implement hygiene fixes (DRY, abbreviation) pending Lead approval.

- 2026-03-24T05:41:29Z — **Generate-Idea Selector Implementation Complete**: Minimal support for league-wide NFL team selection delivered and validated. Changes: `nfl` team classification support in `src/dashboard/views/agents.ts`, `NFL` team grid option in `src/dashboard/views/new-idea.ts`, expert picker server filter update in `src/dashboard/server.ts` to include `nfl` charter. Validation: ✅ `npm run v2:build` passed, ✅ `npm run v2:test -- tests/dashboard/agents.test.ts` passed, ✅ focused new-idea NFL selector tests passed, ⚠️ 2 pre-existing auto-advance failures in `tests/dashboard/new-idea.test.ts` unrelated to selector. **Key correction:** Current workspace allows runtime `nfl` charter to remain selectable in expert pins (not filtered out); change scope is adding/selecting `NFL` in team grid + handling team-classification. Decision documented: Keep existing team-agent filter but treat `nfl` charter as selectable exception. See `.squad/orchestration-log/2026-03-24T05-41-29Z-code.md` and `.squad/decisions.md` (Code Decision — Generate-Idea NFL Selector Support).


