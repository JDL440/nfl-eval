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
