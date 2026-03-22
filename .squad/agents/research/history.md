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
- Aligned team sheets to an H1-first markdown layout with the exact sections Code expects: Snapshot, Team Identity, Offensive Identity, Defensive Identity, Roster Construction Signals, and Writing Cues.
- Added an explicit top-level `id` field to each glossary so Code can validate file identity without traversing nested YAML.
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

### 2026-03-22: LLM observability research

- Current LLM observability is split across three narrow surfaces: `usage_events` / `stage_runs` in `src/db/schema.sql`, pipeline audit logging in `src/pipeline/audit.ts`, and persisted `*.thinking.md` artifacts written by `writeAgentResult()` in `src/pipeline/actions.ts`.
- `src/agents/runner.ts` composes the full system prompt and article context in memory, but it does not persist prompts, message payloads, raw provider responses, finish reasons, or request timestamps; providers in `src/llm/providers/*.ts` call APIs/CLI directly and only return normalized content plus optional usage.
- `recordAgentUsage()` in `src/pipeline/actions.ts` stores only article/stage/surface/provider/model/token totals/cost and does not attach `stageRunId`, `runId`, or `actor`, so `usage_events` are not strongly correlated to `stage_runs` even though the schema supports that join.
- Dashboard debug visibility currently means artifact-level thinking inspection, not full request transparency: `src/dashboard/views/article.ts` restores companion `*.thinking.md` traces and `src/dashboard/views/runs.ts` shows stage-run status, duration, model, and tokens, but not prompts, context payloads, raw outputs, or per-request provenance.
- Related backlog context already exists: GitHub issues `#81` and `#93` cover token-usage UX/persistence, issue `#88` added conversation/revision context plus dashboard observability for multi-pass articles, and `.squad/decisions.md` contains a separate implemented decision that debug visibility should read persisted thinking artifacts rather than hidden prompt context.
- **2026-03-22 — TLDR prompt contract drift**
  - Writer charter (`src/config/defaults/charters/nfl/writer.md`) does not explicitly require a TLDR block; it delegates structure to `substack-article.md`.
  - TLDR is required downstream by the article skeleton skill (`src/config/defaults/skills/substack-article.md`), the editor checklist (`src/config/defaults/charters/nfl/editor.md`, `src/config/defaults/skills/editor-review.md`), and the publisher checklist (`src/config/defaults/skills/publisher.md`).
  - Parser/test coverage already treats TLDR as a first-class article element (`src/services/prosemirror.ts`, `tests/services/prosemirror.test.ts`), so the safest fix is to centralize the structure contract in one canonical article template and keep charters as references.
  - Runtime enforcement is still indirect: `src/pipeline/actions.ts` passes the template/skills/context into Writer, Editor, and Publisher, but it does not hard-fail drafts for missing TLDR; `src/services/prosemirror.ts` only helps recognize the block after the fact.
  - This makes `src/config/defaults/skills/substack-article.md` the best canonical source for article skeleton policy, with role charters serving as role-specific expectations rather than duplicate contracts.
### 2026-03-22T22-07-35Z: TLDR contract drift sync
- Recorded the recommendation in `.squad/decisions/inbox/research-tldr-enforcement-investigation.md`.
- Centralize TLDR and image-order requirements in `substack-article.md` so charters can reference one source of truth.
