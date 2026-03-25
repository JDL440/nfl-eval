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

**Stage & Architecture:**
- Issue #107: `substack-article` contract (TLDR/image).
- Issue #108: Post-Stage-7 retrospective persistence + `revision-retrospective-rN.md`.
- Issue #109: Revision history from conversation/revision seams. Issue #110: Stage timing as dashboard aggregation.
- Dashboard: Hono + HTMX + SSE on port 3456.
- Issue #115–118: Manual retrospective digest CLI + promotion rules via `src/cli.ts` + repository persistence.
- Issue #120: Blocker metadata on `revision_summaries` (`blocker_type` + JSON `blocker_ids`).
- Issue #123: Repeated-blocker escalation at Stage 6 with Lead-review hold.
- Issue #125: Writer fact-check via `src/pipeline/writer-factcheck.ts` (policy, runtime enforcement, Editor consumption).
- Writer support (2026-03-27): `writer-support.md` normalizes names/facts/cautions from `writer-factcheck`, `roster-context`, `writer-preflight`.
- Optional services via dependency injection in `src/dashboard/server.ts`.
- Writer revision retry: `## Failed Draft To Revise` seam in `writeDraft()`.
- Writer revision handoff: `buildRevisionSummaryContext()` + `editor-review.md` + previous `draft.md` injected into `articleContext`.
- Publish: HTML→ProseMirror document-node refactoring.
- Stage 5 context seam: `src/pipeline/context-config.ts` for new Writer artifacts.

## Recent Learnings & Critical Seams

- 2026-03-28 — V3 workflow simplification implementation complete. Applied simplifications to prompt contracts, engine/preflight behavior, and focused test suite in worktrees/V3. Validation: 184 tests passing. Decision inbox merged. Orchestration log: .squad/orchestration-log/2026-03-28T06-46-06Z-code.md.
- 2026-03-27 — Warner Preflight Hardening Implementation: added "Lose" to BANNED_FIRST_TOKENS in writer-preflight.ts. Release-context verbs extended with action-verb blocklist.
- 2026-03-25 — Option B Article-Page Review: approved article-view-only implementation, no type system changes required, server wiring for transient status only.
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


## Learnings
- 2026-03-28 writer/editor churn research: Stage 5 churn is concentrated in `worktrees\V3\src\pipeline\actions.ts` (`buildWriterTask`, `buildDraftRepairInstruction`, `writeDraft`) plus deterministic guards in `writer-preflight.ts` and `engine.ts`.
- Stage 6 churn surfaces also live in `worktrees\V3\src\pipeline\actions.ts` (`EDITOR_APPROVAL_GATE_TASK`, `runEditor`, auto-advance regression/force-approve paths) and prompt policy files under `worktrees\V3\src\config\defaults\charters\nfl\{writer,editor}.md` plus skills `substack-article.md` and `editor-review.md`.
- Shared revision-loop state is persisted through `worktrees\V3\src\pipeline\conversation.ts` (`RevisionSummary`, `buildRevisionSummaryContext`, repeated-blocker helpers), so simplifying Editor to a lightweight accuracy pass may allow pruning blocker metadata, lead-review escalation, and retrospective churn logic if the team chooses a less loop-heavy model.
- Targeted V3 validation command: `npx vitest run tests\pipeline\writer-preflight.test.ts tests\pipeline\engine.test.ts tests\pipeline\actions.test.ts --silent`; current baseline has one failing actions test around name-preflight retry expectations.
- 2026-03-25 send-back UX fix: in `worktrees\V3\src\dashboard\views\article.ts`, Stage 4 + `status='revision'` should render as `Revision Workspace`, prioritize `editor-review.md`/`draft.md` ahead of discussion artifacts, and default the artifact pane to the first persisted revision artifact rather than `idea.md`.
- Lead-review regression controls should frame Stage 4 as a revision destination, not a discussion rollback: the send-back disclosure copy lives in `worktrees\V3\src\dashboard\views\article.ts`, helper styles in `worktrees\V3\src\dashboard\public\styles.css`, and regression coverage in `worktrees\V3\tests\dashboard\server.test.ts` with validation via `npm run test -- tests/dashboard/server.test.ts tests/dashboard/wave2.test.ts && npm run v2:build`.
