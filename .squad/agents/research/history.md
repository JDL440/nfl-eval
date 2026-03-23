# History — Research

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, Hono, HTMX, SQLite
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `docs/` (documentation), `VISION.md` (project vision), `README.md`, `src/config/` (configuration)

## Core Context

### Issue #85 — Structured Domain Knowledge

**Recommendation:** 4-layer Hierarchical KB with phased rollout.
- **Phase 1-3 (current):** Glossary YAML files under `src/config/defaults/glossaries/` and team sheets under `content/data/team-sheets/`. Include validation tests; docs in `docs/knowledge-system.md`.
- **Phase 4-5 (deferred #91):** Runtime glossary injection via `src/agents/runner.ts`, team-identity synthesis in `src/pipeline/actions.ts`, refresh automation script.

**Existing infrastructure:** 176 bootstrap facts in `src/config/defaults/bootstrap-memory.json`, live roster context injected via `src/pipeline/roster-context.ts`, agent memory system with SQLite persistence and relevance scoring, per-article context routing.

**Gaps identified:** No team glossaries, hierarchical KB, factual currency tracking, source tracking, team identity sheets, unified glossary, or inter-fact relationships.

**Implementation layout:** Glossaries at `src/config/defaults/glossaries/{analytics-metrics,cap-mechanics,defense-schemes,personnel-groupings}.yaml`; team sheets at `src/config/defaults/team-sheets/{sea,buf,kc,wsh}.md` with stable identity/scheme sections and freshness metadata. Note: `primary_team` key inconsistency (`SEA` vs lowercase names) requires normalization mapper.

### Issue #102 — Dashboard Auth Hardening

**Recommendation:** Single-operator local login via Hono middleware, opaque session cookies, SQLite persistence, config-driven enable/disable.

**Current state:** No auth seam; `src/dashboard/server.ts` exposes all routes (SSE, API, HTMX, images) directly from `createApp()`. No auth/session/user tables in schema.

**Architecture:** Protect all dashboard surfaces except static assets and explicit login/logout endpoints. Use secure cookie defaults. Treat `/events` and unpublished image routes as protected dashboard data.

**Implementation routing:** Code (middleware, handlers, schema changes), UX (login page/form), DevOps (secure defaults, env docs), Lead review gate. Deferred for follow-up issue after decision lock.

### Issue #116 — Retrospective Digest Research (In Progress)

**Task:** Define grouping/promotion rules for retrospective follow-up digest.

**Context:** Base retrospective runtime lands in #114; this phase specifies heuristics for v1 manual CLI digest.

**Recommendation delivered:**
- **Grouping:** By role + finding_type (12 natural categories)
- **Deduping:** Normalize text (lowercase, remove punctuation), hash-group near-duplicates
- **Evidence:** Article count, priority distribution, recency per group
- **Promotion thresholds:**
  - Process improvement: Lead-authored findings OR churn/issue in 2+ articles with high priority
  - Learning update: Writer/editor findings with high priority in recent articles OR 3+ articles
- **Output:** Human-readable markdown + optional JSON
- **Scope:** Read-only, manual CLI command only (no auto-issue creation)

**Why:** Simplicity, dedup without false positives, human-centered thresholds, bounded output, safe v1 (no unreviewed issue creation).

## Learnings


