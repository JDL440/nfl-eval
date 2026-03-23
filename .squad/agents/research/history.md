# History — Research

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, Hono, HTMX, SQLite
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `docs/` (documentation), `VISION.md` (project vision), `README.md`, `src/config/` (configuration)

## Learnings

- Team initialized 2025-07-18
- VISION.md is the strategic north star — owned by Joe Robinson, last updated 2026-03-20
- 47 article pipeline agents have individual charters in `src/config/defaults/charters/nfl/`
- **2025-07-19 — Issue #85: Structured Domain Knowledge Research**
  - Completed full inventory of existing domain knowledge infrastructure
  - Found 176 bootstrap facts in `src/config/defaults/bootstrap-memory.json` (flat, no hierarchy)
  - Live roster context injected via `src/pipeline/roster-context.ts` at Idea→Prompt, Editor, Factcheck stages
  - Agent memory system (`src/agents/memory.ts`) persists learnings in SQLite with relevance scoring
  - Context config (`src/pipeline/context-config.ts`) routes artifacts to agents per-article
  - Identified 7 gaps: no team glossaries, no hierarchical KB, no factual currency, no source tracking, no team identity sheets, no unified glossary, no inter-fact relationships
  - Proposed 4-layer Hierarchical KB: Universal Glossaries (YAML), Team Identity Sheets (MD), Domain Knowledge Index (JSON), Monthly Refresh Job (cron)
  - Effort estimate: MEDIUM (5–7 days), recommend phased rollout starting with glossaries + team sheets
  - Decision document created at `.squad/decisions/inbox/research-domain-knowledge.md`
  - Full findings posted to GitHub issue #85
- **2025-07-19 — Issue #85: Research findings posted & label updated**
  - Re-ran investigation confirming prior findings; posted comprehensive comment to issue #85
  - Updated label from `go:needs-research` → `go:yes`
  - Key deliverable: 4-layer Hierarchical KB proposal (glossaries → team sheets → indexed facts → monthly refresh)
  - Affected files: runner.ts, actions.ts, bootstrap-memory.json, + new glossaries/ and team-sheets/ dirs

- **2026-03-22 — Issue #85 implementation structure recommendation**
  - Reusable seed knowledge follows `src/config/defaults/` patterns (`seedKnowledge()` already copies charters/skills from there), while article artifacts live as kebab-case files inside `content/articles/{slug}/`
  - Recommended proof-of-concept layout: `src/config/defaults/glossaries/*.yaml`, `src/config/defaults/team-sheets/{abbr}.md`, `src/config/defaults/domain-knowledge-index.json`, plus per-article `team-sheet.md`
  - Team-sheet filenames should use lowercase team abbreviations to match pipeline/article slug conventions (`sea`, `buf`, `kc`, `wsh`); note repo currently has a `was`/`wsh` inconsistency in a few dashboard helpers
  - Team sheets should complement `roster-context.md`, not duplicate it: focus on identity, leadership, scheme, roster/cap/draft snapshot, current constraints, and freshness/source notes
  - Minimal implementation docs should center on `docs/knowledge-system.md`; minimal regression coverage should extend `tests/config/bootstrap.test.ts`, `tests/pipeline/actions.test.ts`, and `tests/pipeline/validation.test.ts`

### 2026-03-22: Decision Document & Session Completion

**Decision submitted:** Research-domain-knowledge.md merged to squad decisions.md. 4-layer Hierarchical KB proposal ready for Lead/PO review.

**Coordination:** Research findings inform Code team's potential future work on domain knowledge infrastructure (Phases 1–3: glossaries, team sheets, domain index).

### 2026-03-22: Issue #85 implementation-planning handoff

- Scoped planning to Phases 1–3 plus docs/testing only; runtime glossary injection and refresh automation remain deferred under follow-up issue `#91`.
- Recommended keeping new structured KB assets under `src/config/defaults/knowledge/` instead of `content/data/` so they align with the existing seeded knowledge architecture documented in `docs/knowledge-system.md`.
- Recommended glossary assets: `src/config/defaults/knowledge/glossaries/{analytics-metrics,cap-mechanics,defense-schemes,personnel-groupings}.yaml`.
- Recommended team identity assets: `src/config/defaults/knowledge/team-identities/{SEA,KC,BUF}.md` with stable identity/scheme sections and explicit freshness metadata.
- Key implementation pitfall: `primary_team` is inconsistent today (`SEA` in dashboard/new-idea flows, lowercase full names like `seahawks` in some tests and repo calls), so any future team-sheet lookup must normalize team keys through a shared mapper instead of using raw article values.
- Testing implication: asset-validation tests are the right Phase 1–3 target; broader updates to `tests/agents/runner.test.ts`, `tests/pipeline/actions.test.ts`, `tests/config/bootstrap.test.ts`, and dashboard fixture configs only become necessary once deferred runtime loading/seeding work begins.

### 2026-03-22: Issue #85 content pass completed

- Implemented the Phase 1–3 content layer using the user-requested paths: glossary YAML under `src/config/defaults/glossaries/` and team sheets under `content/data/team-sheets/`.
- Standardized glossary files around a flat schema: `schema_version`, glossary id, description, entry field contract, refresh guidance, and per-term freshness/source fields.
- Standardized team sheets around frontmatter metadata plus durable body sections: Durable snapshot, Identity anchors (Offense/Defense), Roster-building and cap framing, and Source guidance.
- Updated `docs/knowledge-system.md` to distinguish the existing runtime prompt system from the new structured KB defaults and to state clearly that Phases 4–5 remain deferred.
- Added validation coverage focused on asset presence and format integrity rather than runtime injection behavior.



- **2026-03-22 — Issue #85 decision inbox merged**
  - Merged the POC structure decision into `.squad/decisions.md` and removed the inbox file.
  - Canonical phase 1–3 asset layout stays under `src/config/defaults/`, with lowercase team sheet stems (`sea.md`, `buf.md`, `kc.md`, `wsh.md`) and per-article `team-sheet.md` artifacts.
  - This keeps the feature aligned with seeded defaults, keeps `content/articles/{slug}/` reserved for runtime article artifacts, and leaves refresh automation for the deferred follow-up issue.

### 2026-03-22T18-23-26Z: Issue #85 decision sync
- Inbox decisions were merged into `.squad/decisions.md`; the older pre-2026 decision history was archived to `.squad/decisions-archive.md`.
- The canonical Phase 1-3 asset shape remains the static glossary + team-sheet content layer, with runtime integration still deferred.
- Keep future planning aligned to docs/testing scope unless the follow-up runtime issue explicitly expands scope.

### 2026-03-23: Issue #102 auth direction research

- GitHub issue `#102` asks to replace the temporary shared-password dashboard gate with proper authentication that also protects HTMX, API, and SSE surfaces; Joe clarified in the issue comments that the near-term target is **a simple local login control mechanism with user and password control for now**.
- Current repo architecture has no real dashboard auth seam yet: `src/dashboard/server.ts` registers `/events`, `/images/:slug/:file`, HTML pages, HTMX endpoints, and API routes directly from `createApp()`; `src/config/index.ts` exposes runtime/provider config only; `src/db/repository.ts` and `src/db/schema.sql` contain no auth/session/user persistence.
- README constraints reinforce a small first pass: this is a single-operator Hono + SQLite editorial workstation (`README.md`, `src/dashboard/`, `src/db/`), so the grounded long-term direction is **server-enforced Hono middleware + login/logout routes + opaque SQLite-backed sessions**, not OAuth/SSO or a large user-management subsystem.
- Recommended auth pattern for future implementation: keep auth config-driven and disabled by default in tests/dev, protect all dashboard surfaces except static assets and explicit login/logout endpoints, use secure cookie defaults, and treat `/events` plus unpublished image routes as protected dashboard data rather than public endpoints.
- Key file paths for issue `#102`: `src/dashboard/server.ts`, `src/dashboard/sse.ts`, `src/config/index.ts`, `src/db/repository.ts`, `src/db/schema.sql`, `tests/dashboard/server.test.ts`, `tests/dashboard/publish.test.ts`, `tests/dashboard/config.test.ts`, `tests/e2e/live-server.test.ts`, `.squad/skills/hono-dashboard-auth-seam/SKILL.md`.

### 2026-03-23T02:17:46Z: Issue #102 decision submitted

- Research findings on Issue #102 merged into `.squad/decisions.md` as "Dashboard auth direction — Issue #102".
- Recommendation: single-operator local login with Hono middleware, opaque session cookies, and SQLite persistence.
- Deferred for Code agent implementation after decision lock.

### 2026-03-23T02:21:03Z: Scribe session — decisions inbox merge and orchestration log

- Orchestration log written for Research agent (2026-03-23T02-21-03Z)
- Session log documenting Issue #102 auth research outcomes written
- Research + Lead decision inbox merged into `.squad/decisions.md`, deduplicating findings
- Merged inbox files deleted

### 2026-03-24: Issue #116 retrospective digest research

**Task:** Define grouping and promotion rules for the retrospective follow-up digest so Code can implement a stable v1 without inventing heuristics ad hoc.

**Context:**
- Issue #115 (parent) asks for a post-retrospective learning-update pass that mines structured findings into actionable process improvements and learning updates.
- Issue #116 (this task) is the Research phase to specify the exact grouping, deduping, and ranking heuristics.
- Base retrospective runtime lands on issue #114; by issue #116 the retrospectives table contains role-based findings (writer, editor, lead) with finding types (churn_cause, repeated_issue, next_time_action, process_improvement).

**Recommendation delivered:**
- **Primary grouping:** By role + finding_type (12 natural categories per digest)
- **Deduping:** Normalize finding text (lowercase, remove punctuation) and hash-group near-duplicates
- **Evidence collection:** Track article count, priority distribution, recency per finding group
- **Promotion thresholds:**
  - **Process-improvement candidate:** Lead-authored process_improvement findings, OR repeated churn/issue in 2+ articles with high priority
  - **Learning-update candidate:** Writer/editor findings with high priority in recent articles, OR findings repeating across 3+ articles
- **Output:** Human-readable markdown digest + optional JSON for programmatic use
- **Scope:** v1 is read-only (no auto-issue creation, manual CLI command only)
- **Implementation:** Define SQL queries, hash normalization logic, markdown output layout, and CLI invocation pattern

**Why this approach:**
- Simplicity: No ad-hoc categorization beyond schema dimensions (role, type)
- Deduping without false positives: Hash normalization catches near-duplicates without collapsing distinct issues
- Human-centered: Thresholds (2+ articles for process improvement, 3+ for learning) are practical and visible
- Bounded output: Ranking by evidence count + priority keeps digest scannable
- v1 is safe: No risk of unreviewed issue creation or republishing

**Deliverable:** Detailed recommendation document at `.squad/decisions/inbox/research-116.md` including:
- Executive summary and grouping heuristic
- Evidence collection and ranking logic
- Promotion rules with clear thresholds
- Full markdown and JSON output structure examples
- Database query templates
- CLI invocation pattern
- Acceptance criteria verification

### 2026-03-24T02:38:09Z: Ralph Round 3 — Research #116 Launched

**Session:** Research agent newly spawned to execute Issue #116 (manual retrospective digest CLI v1).

**Scope:** Implement manual CLI interface for cross-article retrospective synthesis, bounded markdown digest output, optional JSON format.

**Dependencies:** Awaits Code completion of #114 (base retrospective runtime merge).

**Next:** Begin design specification for digest CLI surface upon #114 completion signal.
