# History — Research

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, Hono, HTMX, SQLite
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `docs/`, `VISION.md`, `README.md`, `src/config/`

## Core Context

- **Issue #85**: structured domain knowledge is intentionally scoped to static assets (glossaries + team sheets) and docs/testing; runtime loading and refresh automation were deferred.
- **Issue #102**: dashboard auth should start as a lightweight local login control with Hono middleware, secure cookies, and SQLite sessions; OAuth/SSO is deferred.
- **Issue #116/#117/#118**: retrospective follow-up should start as a manual, read-only digest grouped by role + finding_type with normalized-text dedupe.
- Publish-related research established that the dashboard publish flow is split across startup wiring, publish routes, and the Substack service boundary.
- The repository uses seeded defaults under `src/config/defaults/`; team-key normalization is important when mapping article or dashboard values to team sheets.

## Recent Learnings

- 2026-03-24 — Issue #85 implementation layout: keep the structured knowledge assets aligned with `src/config/defaults/` patterns and normalize team keys through a shared mapper.
- 2026-03-23 — Issue #102 research confirmed the dashboard has no auth/session seam yet in `server.ts`, `repository.ts`, or `schema.sql`.
- 2026-03-24 — Issue #116 digest heuristics: role + finding_type grouping, normalized-text dedupe, and bounded outputs were defined for Code.

## Learnings

- 2026-03-25 — Slug-history investigation: the exact slug `the-packers-next-big-move-might-be-trading-a-young-receiver` was not found in repo files, hidden state, worktrees, or `.copilot`; the closest live Packers artifact set is `content/articles/gb-2026-offseason/`.
- 2026-03-25 — For article history, first-draft and thinking traces persist as filesystem artifacts (`content/articles/{slug}/*.md` plus optional `*.thinking.md`), while edit/revision loop context is designed to persist in SQLite tables `article_conversations` and `revision_summaries` (`src/db/schema.sql`, `src/pipeline/conversation.ts`).
- 2026-03-25 — The local runtime scratch database at `.test-debug-retro/pipeline.db` currently has no schema or rows (4096-byte empty SQLite file), so it cannot recover draft/edit history for Packers investigations.
- 2026-03-25 — Runtime article state can live outside the repo under `~/.nfl-lab/`; by default `src/config/index.ts` resolves `pipeline.db`, article/image directories, and logs there rather than under `content/`.
- 2026-03-25 — For slug `the-packers-next-big-move-might-be-trading-a-young-receiver`, the real local history is in `C:\Users\jdl44\.nfl-lab\pipeline.db`: `artifacts` keeps the latest named files, while `article_conversations`, `revision_summaries`, `stage_transitions`, and `audit-*.jsonl` preserve revision-loop chronology.
- 2026-03-25 — `src\db\artifact-store.ts` upserts by `(article_id, name)`, so repeated `draft.md` or `editor-review.md` writes overwrite the current artifact; earlier draft/edit iterations survive only via conversation/history tables, not separate per-revision artifact rows unless a distinct filename is used.

### 2026-03-23T15-13-57Z: Lead board cleanup follow-up
- `#115` is now unblocked and assigned `go:yes` + `squad:research`, with `#117/#118` already landed.
- Next research work should continue mining retrospectives into learning updates and process-improvement candidates.
