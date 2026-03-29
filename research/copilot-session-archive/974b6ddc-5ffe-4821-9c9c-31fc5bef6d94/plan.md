# Migration Plan: Ideas → PanelDiscussion → Article → Publish Pipeline (32-Team Ready)

> **Supersedes:** Prior bugfix-only plan. Bugfixes from `squad/4-m4-backend` are preserved via cherry-pick/PR strategy below.
> **Owner:** Lead (orchestrator) — implementation by Backend, Frontend, Tester
> **Date:** 2026-03-15
> **Revised:** 2026-03-15 — Incorporates pipeline correction: Media+Editor ideation, PanelDiscussions as first-class artifacts, Publisher role, configurable auto-advance, dashboard redesign freedom

---

## 1. Target Architecture

### Current State (what exists)
- Queue/dashboard/publish shell works (sweep → score → enqueue → approve → brief → manual-paste → publish)
- The "middle" of the pipeline is a manual bridge: generate a brief, copy to external Writer chat, paste article back
- No first-class idea, discussion, or editor-review objects
- Single-team assumption baked into `jobs.data` (one `team` field, no multi-team support)
- 24 commits on `squad/4-m4-backend` ahead of main, plus 88 dirty files (37 untracked)
- Production container does not mount `.queue` as a durable volume — DB state lost on redeploy
- GitHub Actions workflow commits `content/processed-tx-ids.json` but not `.queue/jobs.db`

### Target State (what we're building)

#### Pipeline: Ideas → PanelDiscussion → Article → Publish

```
  IDEATION                PANEL DISCUSSION        WRITING             EDITING             PUBLISHING
  (Media + Editor)        (Expert Agents)         (Writer)            (Editor)            (Publisher)
  ──────────────────────  ──────────────────────  ──────────────────  ──────────────────  ────────────────
  Media + Editor          Idea generates          Writer drafts       Editor reviews      Publisher
  generate Ideas          PanelDiscussion         Article from        Article with        schedules &
  │ catchy title          │ discussion prompt    discussion          structured report   publishes to
  │ cross-expert topic    │ 2–4 expert agents    transcript +        │ approve/revise/   Substack
  │ teams[] (32 teams)    │ transcript           agent outputs       │ reject            │ timing
  │ optional pub date     │ agent_outputs                            │ revision loop     │ auto-publish
  │ angle / disagreement  │ disagreements                                                  │ sanity checks
  └─ sweep/manual/import  └─ first-class artifact                                           └─ human or auto
```

**Key principles:**
- **Idea generation comes from Media + Editor** — not just sweep. They propose catchy Substack topics suited for cross-expert discussion, optionally favoring strong disagreement.
- **PanelDiscussions are first-class objects** — persisted, versioned, queryable. The discussion IS the product differentiator.
- **Per-team scoping (all 32 teams)** — every Idea has a `teams[]` array. Pipeline views, filtering, and routing are team-aware from day one.
- **Writer/Editor/Publisher are distinct pipeline roles** — Writer drafts from discussion, Editor reviews with structured verdicts, Publisher manages Substack timing and release.
- **Configurable auto-advance vs human-gated** — each stage transition can be configured independently. MVP defaults to human-gated; auto-advance is opt-in.
- **Dashboard is redesigned, not constrained** — the new dashboard is built for this pipeline. The current UI assumptions do not apply.

---

## 2. 32-Team Data Model

### Core Principle
Every idea has a **`teams`** array (first-level property, always an array) plus a **`primary_team`** convenience field. **`teams` is the canonical team source. `primary_team` MUST be a member of the `teams` array** (enforced by validation). For league-wide ideas, use `teams: ["NFL"]` with `primary_team: "NFL"`.

### Why `teams` (array) not `team` (string)
- Trade articles involve 2+ teams
- Roster construction / power ranking articles span divisions or leagues
- Draft articles may compare prospects across multiple teams
- Single-team stories just have `teams: ["SEA"]` with `primary_team: "SEA"`
- Cross-team stories have `teams: ["SEA", "KC"]` with `primary_team: "SEA"` (editorial focus)

### Validation Rules
- `teams` must be a non-empty JSON array of valid team codes (32 NFL abbreviations + `NFL`)
- `primary_team` must be present in the `teams` array
- Maximum 8 teams per idea (practical limit)
- Array is de-duplicated and sorted on write
- `idea_teams` junction table is maintained transactionally on every `ideas` INSERT/UPDATE — not optional

### `ideas` Table Schema

```sql
CREATE TABLE IF NOT EXISTS ideas (
  id            TEXT PRIMARY KEY,                        -- 'idea-<uuid>'
  source_type   TEXT NOT NULL DEFAULT 'manual',          -- 'sweep' | 'manual' | 'import'
  source_ref    TEXT DEFAULT NULL,                       -- job_id if from sweep, file path if import
  source_hash   TEXT DEFAULT NULL,                       -- stable hash for idempotent dual-write
  title         TEXT NOT NULL,
  angle         TEXT DEFAULT NULL,                       -- editorial angle / thesis
  primary_team  TEXT NOT NULL DEFAULT 'NFL',             -- 3-letter abbr or 'NFL'; MUST be in teams[]
  teams         TEXT NOT NULL DEFAULT '["NFL"]',         -- JSON array of team abbrs, e.g. '["SEA","KC"]'
  topic_type    TEXT DEFAULT 'general',                  -- 'free_agent_signing','trade','draft_pick', etc.
  context       TEXT DEFAULT '{}',                       -- JSON: transaction payload, background info
  desired_agents TEXT DEFAULT '[]',                      -- JSON array: override default expert routing
  discussion_prompt TEXT DEFAULT NULL,                   -- optional: custom prompt for PanelDiscussion generation
  recommended_publish_at TEXT DEFAULT NULL,              -- optional: ISO 8601 date or date range for target publish
  publish_window_end TEXT DEFAULT NULL,                  -- optional: end of publish date range (null = open-ended)
  state         TEXT NOT NULL DEFAULT 'idea_draft',      -- aggregate workflow state (source of truth)
  review_policy TEXT NOT NULL DEFAULT 'human',           -- MVP: 'human' only. Post-MVP: 'auto_advance' | 'auto_review'
  advance_config TEXT NOT NULL DEFAULT '{}',             -- JSON: per-stage auto-advance overrides (see Stage Transition Config)
  state_version INTEGER NOT NULL DEFAULT 1,              -- optimistic lock for advance/reject
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ideas_state ON ideas(state);
CREATE INDEX IF NOT EXISTS idx_ideas_primary_team ON ideas(primary_team);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ideas_source ON ideas(source_type, source_ref)
  WHERE source_ref IS NOT NULL;                          -- idempotent dual-write guard
```

> **State ownership:** `ideas.state` is the aggregate workflow state and the single source of truth for where an idea is in its lifecycle. `discussions.state` and `articles.state` are execution-local statuses (e.g., "running", "failed") and must not be used as workflow routing signals. All state transitions go through `POST /api/ideas/:id/advance` with optimistic locking (`state_version`).

### `discussions` Table Schema

```sql
CREATE TABLE IF NOT EXISTS discussions (
  id            TEXT PRIMARY KEY,                        -- 'disc-<uuid>'
  idea_id       TEXT NOT NULL,                           -- FK to ideas
  transcript    TEXT DEFAULT NULL,                       -- full markdown transcript (structured, see format below)
  agent_outputs TEXT DEFAULT '{}',                       -- JSON: per-agent structured outputs (see schema below)
  agents_used   TEXT DEFAULT '[]',                       -- JSON array of agent keys that participated
  run_metadata  TEXT DEFAULT '{}',                       -- JSON: timestamps, token counts, cost, runner_type
  state         TEXT NOT NULL DEFAULT 'requested',       -- execution-local: 'requested' | 'running' | 'completed' | 'failed'
  runner_type   TEXT NOT NULL DEFAULT 'manual',          -- 'manual' | 'cli_bridge' | 'api'
  requested_at  TEXT DEFAULT NULL,
  started_at    TEXT DEFAULT NULL,
  finished_at   TEXT DEFAULT NULL,
  retry_count   INTEGER NOT NULL DEFAULT 0,
  error         TEXT DEFAULT NULL,                       -- last error message if failed
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (idea_id) REFERENCES ideas(id)
);
```

### Discussion Output Format (Required for Writer)

The `agent_outputs` JSON must conform to this structure:

```json
{
  "<agent_id>": {
    "agent_id": "cap",
    "agent_name": "Cap Analyst",
    "summary": "Narrative summary of agent's analysis",
    "position": "Clear recommendation or stance",
    "key_claims": ["claim 1", "claim 2", "claim 3"],
    "confidence": 75,
    "sources_cited": ["OTC", "Spotrac"]
  }
}
```

Additional top-level keys in `agent_outputs`:
- `"_disagreements"`: Array of `{ agents: ["cap","player_rep"], topic: "extension value", positions: { "cap": "...", "player_rep": "..." } }`
- `"_metadata"`: `{ run_timestamp, topic, idea_id, duration_seconds }`

**Null safety:** Agents that were requested but produced no output get `{ "agent_id": "...", "agent_name": "...", "summary": null, "position": null, "key_claims": [], "confidence": 0, "error": "reason" }`.

The `transcript` field must be structured markdown with agent attribution headers (`## Cap Analyst`, `## PlayerRep`, etc.) so Writer can extract quotable sections with attribution.

### `articles` Table Schema

```sql
CREATE TABLE IF NOT EXISTS articles (
  id            TEXT PRIMARY KEY,                        -- 'art-<uuid>'
  idea_id       TEXT NOT NULL,                           -- FK to ideas
  discussion_id TEXT DEFAULT NULL,                       -- FK to discussions (nullable for manual)
  title         TEXT NOT NULL,
  subtitle      TEXT DEFAULT '',
  body          TEXT DEFAULT NULL,                       -- article markdown/HTML
  editor_report TEXT DEFAULT '{}',                       -- JSON: structured report (see schema below)
  state         TEXT NOT NULL DEFAULT 'drafted',         -- execution-local: 'drafted' | 'editor_reviewed' | 'ready' | 'published'
  approved_by   TEXT DEFAULT NULL,                       -- who approved (user ID or 'system')
  approved_at   TEXT DEFAULT NULL,                       -- ISO 8601 timestamp of approval
  approval_note TEXT DEFAULT NULL,                       -- optional note from approver
  substack_id   TEXT DEFAULT NULL,
  substack_url  TEXT DEFAULT NULL,
  published_at  TEXT DEFAULT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (idea_id) REFERENCES ideas(id),
  FOREIGN KEY (discussion_id) REFERENCES discussions(id)
);
```

### Editor Report Schema (Required for Phase D)

The `editor_report` JSON must conform to this structure:

```json
{
  "verdict": "approve" | "revise" | "reject",
  "errors": [
    { "id": "err-1", "severity": "critical" | "major" | "minor", "location": "paragraph/section ref", "description": "..." }
  ],
  "suggestions": [
    { "id": "sug-1", "category": "style" | "accuracy" | "structure" | "sourcing", "description": "..." }
  ],
  "notes": "Free-form editor commentary",
  "reviewed_at": "ISO 8601 timestamp",
  "reviewed_by": "editor"
}
```

**MVP gate:** Every article MUST receive an editor review before reaching `article_ready`. No auto-approve in MVP — the `review_policy: auto_review` option is documented but disabled until post-MVP.

### `idea_teams` Junction Table

```sql
CREATE TABLE IF NOT EXISTS idea_teams (
  idea_id   TEXT NOT NULL,
  team_abbr TEXT NOT NULL,                              -- 3-letter NFL abbreviation
  role      TEXT NOT NULL DEFAULT 'primary',            -- 'primary' | 'secondary' | 'mentioned'
  PRIMARY KEY (idea_id, team_abbr),
  FOREIGN KEY (idea_id) REFERENCES ideas(id)
);

CREATE INDEX IF NOT EXISTS idx_idea_teams_team ON idea_teams(team_abbr);
```

**Maintenance rule:** `idea_teams` rows are written/updated in the same SQLite transaction as any INSERT/UPDATE to `ideas`. This is not optional — it is the queryable team index.

This lets you query "all ideas for BUF" efficiently: `SELECT i.* FROM ideas i JOIN idea_teams it ON i.id = it.idea_id WHERE it.team_abbr = 'BUF'`

### Audit Log Extension

```sql
ALTER TABLE audit_log ADD COLUMN entity_type TEXT DEFAULT 'job';   -- 'job' | 'idea' | 'discussion' | 'article'
ALTER TABLE audit_log ADD COLUMN entity_id TEXT DEFAULT NULL;       -- idea_id, discussion_id, or article_id
```

The audit log must support non-job entities from Phase 0 onward. Every state transition, approval, rejection, and publish action is logged with `entity_type`, `entity_id`, actor, action, prior state, new state, and timestamp.

### Backward Compatibility
- The existing `jobs` table stays **as-is** for the legacy sweep/queue pipeline
- New ideas created from sweep results get a `source_ref` pointing to the original job ID
- Migration path: run both tables in parallel, sunset `jobs` once the ideas pipeline is fully wired

---

## 3. State Machine

### State Ownership
- **`ideas.state`** = aggregate workflow state (source of truth for routing)
- **`discussions.state`** = execution-local (requested/running/completed/failed) — PanelDiscussion is a first-class artifact but its internal state is execution-level
- **`articles.state`** = execution-local (drafted/editor_reviewed/ready/published)
- State transitions ONLY go through `POST /api/ideas/:id/advance` and `POST /api/ideas/:id/reject`
- Every transition requires `expected_version` (optimistic lock) — stale transitions return 409
- **Auto-advance:** When `advance_config` specifies `auto` for a gate, the backend triggers the next stage automatically on successful completion of the current stage. The transition still goes through the same API endpoint with `actor = 'system'`.

### Idea Lifecycle (Ideas → PanelDiscussion → Article → Publish)

**Roles at each stage:** Media+Editor (ideation) → Expert Panel (discussion) → Writer (drafting) → Editor (review) → Publisher (release)

```
idea_draft ──► idea_ready ──► panel_discussion_requested ──► panel_discussion_ready ──► article_drafted ──► editor_reviewed ──► publish_ready ──► published
     │              │                   │                                                │                    │                   │
     └── rejected   └── rejected        └── panel_discussion_failed (retryable)          └── editor_rejected  └── revision_needed └── publish_failed
                                                                                                │
                                                                                                └── (returns to article_drafted for revision)
```

> **Stage rename note:** `discussion_*` → `panel_discussion_*` to reflect that PanelDiscussions are a named first-class concept, not generic discussions. `article_ready` → `publish_ready` to clarify that the Publisher role owns the final gate.

### Transition Rules
| From | To | Trigger | Gate | Role |
|------|----|---------|------|------|
| `idea_draft` | `idea_ready` | Media + Editor confirm Idea | — | Media / Editor |
| `idea_ready` | `panel_discussion_requested` | "Run Discussion" (human or auto-advance) | — | System / Human |
| `panel_discussion_requested` | `panel_discussion_ready` | PanelDiscussion runner completes | discussions.state = 'completed' | Expert Panel |
| `panel_discussion_ready` | `article_drafted` | Writer produces article from PanelDiscussion | — | Writer |
| `article_drafted` | `editor_reviewed` | Editor review completes | editor_report.verdict present | Editor |
| `editor_reviewed` | `publish_ready` | Human or auto-advance approves | editor_report.verdict = 'approve' AND approved_by set | Human / System |
| `publish_ready` | `published` | Publisher releases to Substack | Substack auth required; Publisher timing/sanity checks pass | Publisher |
| Any stage | `rejected` | User or editor rejects | — | Human / Editor |
| `editor_reviewed` (verdict=revise) | `article_drafted` | Writer revises | Loops back for another review | Writer |
| `published` | `publish_ready` | Unpublish action | Clears substack_id/url, logs audit | Publisher |

### Stage Transition Configuration (Auto-Advance vs Human-Gated)

Each stage gate can be configured independently via `advance_config` on the Idea (JSON object) or global system config:

| Gate | Config Key | Auto-Advance Behavior | Human-Gated Behavior (MVP default) |
|------|-----------|----------------------|-----------------------------------|
| Idea → PanelDiscussion | `idea_to_discussion` | Discussion prompt generated and panel spawned automatically | Human reviews Idea and clicks "Run Discussion" |
| PanelDiscussion → Article | `discussion_to_article` | Writer drafts immediately on discussion completion | Human reviews discussion and triggers "Write Article" |
| Article → Editor Review | `article_to_review` | Editor runs automatically on draft completion | Human triggers editorial review |
| Editor Approved → Publish | `review_to_publish` | Publisher auto-schedules per Idea's `recommended_publish_at` | Human reviews editor report and clicks "Publish" |

**MVP constraint:** All gates default to human-gated. Auto-advance is opt-in per Idea or per global config.
**Hard rule (never auto-skip):** Every article MUST receive an Editor review before reaching `publish_ready`. No `advance_config` value can bypass the Editor gate.

```json
// Example: auto-advance from idea to discussion, human-gated for everything else
{
  "idea_to_discussion": "auto",
  "discussion_to_article": "human",
  "article_to_review": "human",
  "review_to_publish": "human"
}
```

---

## 4. Branch & PR Strategy

### Track 1: Stabilize Current Fixes → PR to main
**Branch:** `squad/4-m4-backend` (current)
**Goal:** Get the validated bugfixes and MVP clarity changes merged to main.

Steps:
1. On `squad/4-m4-backend`, create a **clean commit** of only the validated, reviewed source changes (exclude `.queue/` DB files, generated briefs, untracked `.squad` history noise).
2. Use `git add -p` or selective staging to commit only:
   - `src/server.js`, `src/db.js`, `src/content-brief.js` bug fixes
   - Dashboard component fixes (AuditLog, WriteArticle, SweepControl, JobList)
   - Test updates for existing components
   - Doc updates (BACKEND.md, .env.example)
   - Docker config fixes (Dockerfile, docker-compose.yml)
3. Open **PR #8** from `squad/4-m4-backend` → `main` titled "fix: M4 bugfixes — audit log, sweep UX, article flow clarity"
4. `.gitignore` the `.queue/` directory and generated content before merging (these are runtime artifacts).
5. After merge, main is clean and stable.

### Track 2: Pipeline Redesign → Fresh Branch from main
**Branch:** `squad/5-ideas-pipeline` (new, from main after Track 1 merges)
**Goal:** Implement the ideas → discussion → article pipeline.

Steps:
1. After PR #8 merges to main, create `squad/5-ideas-pipeline` from `main`.
2. Implement in the phased order below.
3. This branch gets the schema migration, new API routes, new dashboard views, and new tests.
4. PR strategy: one PR per phase, or one large PR for all of Phase A (schema + API + basic UI).

### Why Two Tracks
- The bugfixes are **already validated and useful** — they should ship independently.
- The pipeline redesign is a **breaking conceptual change** to the data model — it should start clean.
- Mixing them creates a messy PR with 10K+ line diffs that no one can review.

---

## 5. Rollout Phases

### Phase 0: Foundation & Contracts (1 day)
> Must land before Phase A. Establishes durability, audit, and contracts so Phase A has solid ground.

- [ ] **Durability decision:** Mount `.queue/` as a named Docker volume in production compose; document backup/export procedure
- [ ] **Audit schema extension:** Add `entity_type` + `entity_id` columns to `audit_log` table
- [ ] **Idempotency keys:** Define `(source_type, source_ref)` unique index and `source_hash` for sweep dual-write
- [ ] **PanelDiscussion runner contract:** Lock the stored shape for PanelDiscussion results (runner_type, requested_at, started_at, finished_at, agents_used, transcript, agent_outputs, token_usage, cost_usd, error, retry_count). PanelDiscussions are first-class artifacts. Same shape for manual paste and automated runner.
- [ ] **Publisher role definition:** Define Publisher responsibilities (timing, scheduling, sanity checks, auto-publish), distinct from Editor. Document in `.squad/agents/publisher/charter.md`.
- [ ] **Discussion output JSON schema:** Finalize per-agent output format (agent_id, summary, position, key_claims, confidence, sources_cited, disagreements, metadata, null safety). Backend + Writer pairing session.
- [ ] **Editor report JSON schema:** Finalize verdict/errors/suggestions/notes structure.
- [ ] **`primary_team ∈ teams` validation function:** Write and test the team validation logic.
- [ ] **Corruption recovery:** Extend existing DB recovery coverage to new tables.

**Merge gate — Phase 0:**
- [ ] Production compose mounts durable `.queue` volume
- [ ] Audit schema extension migration runs cleanly on existing DB
- [ ] Validation function rejects invalid team codes, non-member primary_team, duplicates
- [ ] Discussion output + editor report JSON schemas documented and agreed (Backend + Writer + Editor)

### Phase A: Data Model + API (1-2 days)
- [ ] Add `ideas`, `discussions`, `articles`, `idea_teams` tables to `src/db.js`
- [ ] Add migration logic: `_initSchema` creates new tables alongside existing ones
- [ ] New API routes in `src/server.js`:
  - `GET /api/ideas` — list ideas, filter by team/state
  - `POST /api/ideas` — create idea (with teams validation, idempotent via source_hash)
  - `GET /api/ideas/:id` — get idea detail
  - `PUT /api/ideas/:id` — edit idea (title, angle, teams, desired_agents)
  - `POST /api/ideas/:id/advance` — transition to next state (requires `expected_version`, returns 409 on stale)
  - `POST /api/ideas/:id/reject` — reject at any stage (requires `expected_version`)
  - `GET /api/ideas/:id/discussion` — get discussion artifact
  - `POST /api/ideas/:id/discussion` — store discussion result (validates against agreed schema)
  - `GET /api/ideas/:id/article` — get article
  - `POST /api/ideas/:id/article` — store article draft
  - `POST /api/ideas/:id/editor-review` — store editor report (validates against agreed schema)
  - `POST /api/ideas/:id/publish` — publish to Substack
- [ ] All `/api/jobs/*` routes remain unchanged
- [ ] Sweep dual-write: creates both `jobs` and `ideas` from same data, idempotent via source_hash
- [ ] Dual-write ordering: persist SQLite first (one transaction), then enqueue BullMQ, then audit
- [ ] Tests: API endpoint tests for all new routes, including validation errors and 409 stale-state

**Merge gate — Phase A:**
- [ ] Additive schema migration test passes (new tables alongside existing)
- [ ] Old jobs flow still passes (all legacy tests green)
- [ ] Dual-write parity test: sweep creates matching job + idea records
- [ ] New idea lifecycle contract tests pass (valid transitions accepted, invalid rejected with 409)
- [ ] `primary_team ∈ teams` validation enforced on create/update
- [ ] Audit log captures idea transitions with `entity_type = 'idea'`

### Phase B: Modern Pipeline Dashboard (2-3 days)
> **The dashboard is redesigned for the Ideas → PanelDiscussion → Article → Publish pipeline.** Not constrained by current UI. Legacy Jobs view preserved as "Legacy Queue" during transition.

- [ ] **Team-scoped pipeline view** as the primary dashboard experience (not a tab on Jobs)
- [ ] Pipeline stage indicators: visual flow showing where each Idea is in its lifecycle (Idea → PanelDiscussion → Article → Editing → Publish)
- [ ] **Idea creation form:** title, angle, teams multi-select with `primary_team` badge, topic type, agent panel override, recommended publish date/range, discussion prompt (optional)
- [ ] **Idea generation by Media + Editor:** dedicated "New Idea" flow that surfaces Media agent suggestions and Editor refinement
- [ ] Team filter sidebar (all 32 teams + "NFL" for league-wide) with conference/division groupings
- [ ] **Approval gates UI:** clear approve/reject/advance controls at each human-gated stage
- [ ] **Auto-advance configuration:** per-Idea or global toggle for each stage gate, visible in Idea detail
- [ ] Empty states, loading states, error states for all new views
- [ ] Legacy Jobs view preserved as "Legacy Queue" (accessible but not default)
- [ ] Link dual-written jobs ↔ ideas in UI (bidirectional "Open related Idea" / "Open source Job")

**Merge gate — Phase B:**
- [ ] Dashboard tests cover create/edit/filter/advance/reject flows for all pipeline stages
- [ ] Stale-state errors rendered correctly (409 → user-facing message)
- [ ] Pipeline view is the primary dashboard experience; Legacy Queue accessible but not default
- [ ] Team-scoped filtering works across all 32 teams
- [ ] Auto-advance toggles visible and functional in Idea detail
- [ ] Dual-written records show clear labeling and cross-links

### Phase C: PanelDiscussion Integration (2-3 days)
- [ ] "Run PanelDiscussion" action → `POST /api/ideas/:id/advance` (auto-advance or human-triggered per `advance_config`)
- [ ] **Discussion prompt generation:** from Idea metadata (title, angle, teams, topic_type) or manual `discussion_prompt` field
- [ ] PanelDiscussion runner:
  - Selects expert panel via `.squad/routing.md` (2–4 agents per topic)
  - Runs panel debate; stores transcript + per-agent structured outputs validated against agreed JSON schema
  - PanelDiscussion is a **first-class persisted artifact** (not intermediate state)
- [ ] **PanelDiscussion viewer** in dashboard: transcript with agent headers, per-agent outputs, disagreement index, confidence scores
- [ ] PanelDiscussion failure/retry states visible in UI with cost/token info
- [ ] "Write Article" action from stored PanelDiscussion (auto-advance or human-triggered)
- [ ] Restart durability: in-progress PanelDiscussions survive backend restart (state persisted before runner starts)

**Merge gate — Phase C:**
- [ ] PanelDiscussion happy-path test (request → running → completed → outputs stored as first-class artifact)
- [ ] PanelDiscussion failure-path test (request → running → failed → retry)
- [ ] Transcript persistence survives backend restart
- [ ] Stored `agent_outputs` validates against agreed JSON schema
- [ ] Writer can draft from stored PanelDiscussion output (end-to-end test with fake data)
- [ ] Auto-advance from `panel_discussion_ready` → `article_drafted` works when configured

### Phase D: Editor Review Stage (1 day)
- [ ] Editor review artifact: structured errors, suggestions, notes, verdict per agreed schema
- [ ] Dashboard editor review display (error list, suggestion list, notes, verdict badge)
- [ ] Hard gate: `publish_ready` blocked unless `editor_report.verdict = 'approve'` AND `approved_by` is set
- [ ] Revision loop: verdict=revise returns idea to `article_drafted` for Writer revision
- [ ] Reject path: verdict=reject moves idea to `rejected`
- [ ] Approval audit fields populated: `approved_by`, `approved_at`, `approval_note`

**Merge gate — Phase D:**
- [ ] Editor gate proves no `publish_ready` without passing review
- [ ] Revision loop test (revise → re-draft → re-review → approve)
- [ ] Rejection path test
- [ ] `approved_by`/`approved_at` populated on every approval

### Phase E: Publisher + Publish + Polish (1-2 days)
- [ ] **Publisher role implementation:** distinct from Editor; owns the `publish_ready` → `published` transition
- [ ] **Publish scheduling:** Publisher respects `recommended_publish_at` / `publish_window_end` for timing
- [ ] **Auto-publish configuration:** when `advance_config.review_to_publish = 'auto'`, Publisher auto-schedules after Editor approval + optional delay
- [ ] **Sanity checks before publish:** title, subtitle, body length, team tags, metadata completeness
- [ ] Wire existing Substack client to new `articles` table
- [ ] Publish/unpublish/retry with rollback (unpublish clears Substack fields, logs audit)
- [ ] Publish failure recovery (failed → retry without re-review)
- [ ] Update audit log to reference ideas (not just jobs)
- [ ] Cost/token visibility at idea detail level
- [ ] **Publish scheduler in dashboard:** calendar/timeline view for upcoming publishes across teams
- [ ] Legacy jobs view kept but de-emphasized
- [ ] Staging canary: prove both legacy and new flows work end-to-end

**Merge gate — Phase E:**
- [ ] Publisher role tests: scheduling, sanity checks, auto-publish
- [ ] Publish/unpublish rollback tests pass
- [ ] Audit-log trace completeness (every state transition from idea_draft → published has audit entry)
- [ ] Staging canary proves legacy jobs flow + new ideas flow both work
- [ ] Auto-publish end-to-end test: Idea with `auto` advance_config flows from Editor approval through Publisher to Substack

---

## 6. Risks & Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| Schema migration breaks existing `.queue/jobs.db` | 🟡 Medium | New tables are additive — existing `jobs` table untouched. Run both in parallel. |
| PanelDiscussion runner integration is complex | 🟡 Medium | PanelDiscussions are first-class artifacts with a defined runner contract. Start with manual paste, upgrade to automated runner in Phase C. |
| 32-team filter overwhelms dashboard UI | 🟢 Low | Conference/division groupings. Default to "All" with favorites pinned. |
| Two-track branch strategy creates merge conflicts | 🟡 Medium | Track 1 merges first. Track 2 starts clean from main. No overlap. |
| Sweep stops working during migration | 🟢 Low | Sweep continues creating `jobs` records; new code also creates `ideas` from same data. Idempotent dual-write with source_hash. |
| State drift across ideas/discussions/articles tables | 🟡 Medium | `ideas.state` is sole workflow truth. `discussions.state`/`articles.state` are execution-local. Optimistic locking on all transitions. |
| Dual-write confuses editors (same story in Jobs + Ideas) | 🟡 Medium | Phase B: pipeline dashboard is primary; legacy Jobs view preserved as "Legacy Queue" with cross-links. |
| Production DB not durable | 🔴 High | Phase 0: mount `.queue` as Docker volume, document backup, test recovery. Must be solved before Phase A. |
| Publisher auto-publish without human review | 🟡 Medium | Hard rule: Editor gate is never auto-skipped. Publisher only auto-publishes after Editor approval. Sanity checks catch obvious issues. |
| PanelDiscussion output schema mismatch between Backend/Writer | 🟡 Medium | Phase 0: pair Backend + Writer on JSON schema. Validate with fake data before Phase C. |

### Backout Strategy
- Phase 0 is infrastructure/contracts only — backout = revert compose changes and audit migration.
- Phase A is purely additive (new tables, new routes). Backout = drop tables, revert route file.
- Each phase can be reverted independently without losing prior phases.
- The existing jobs pipeline continues working throughout — it's never removed, only supplemented.

---

## 7. Concrete Next Steps (Recommended Order)

### Track 1 (Stabilize)
1. **Now:** On `squad/4-m4-backend`, stage only validated source changes (not `.queue/`, not generated briefs). Commit clean.
2. **Now:** Add `.queue/` and `content/briefs/` and `content/articles/` to `.gitignore`.
3. **Now:** Push `squad/4-m4-backend`, open PR #8 to main.
4. **Track 1 merge gate:** `.gitignore` covers runtime artifacts, legacy API/E2E/dashboard suites green.

### Track 2 (Pipeline Redesign)
5. **After PR merges:** Create `squad/5-ideas-pipeline` from main.
6. **Phase 0 (first):** Durability fix (Docker volume), audit schema extension, JSON schema pairing (Backend + Writer + Editor), validation function, PanelDiscussion runner contract, Publisher role definition.
7. **Phase A:** Schema migration (including `discussion_prompt`, `recommended_publish_at`, `publish_window_end`, `advance_config` fields) + CRUD API + dual-write + contract tests.
8. **Phase B:** Modern pipeline dashboard (primary view, not tab) + Idea creation with Media+Editor flow + team-scoped views + auto-advance configuration UI + legacy Jobs as "Legacy Queue."
9. **Phase C:** PanelDiscussion runner integration (first-class artifacts) + discussion prompt generation + panel viewer + failure states + auto-advance wiring + restart durability.
10. **Phase D:** Editor review gate + revision loop + approval audit.
11. **Phase E:** Publisher role implementation + publish scheduling + auto-publish + sanity checks + audit completeness. Staging canary.

---

## Appendix: Team Abbreviations (32 teams)

For the `teams` array and `idea_teams` junction table:
```
AFC East:  BUF, MIA, NE, NYJ
AFC North: BAL, CIN, CLE, PIT
AFC South: HOU, IND, JAX, TEN
AFC West:  DEN, KC, LV, LAC
NFC East:  DAL, NYG, PHI, WSH
NFC North: CHI, DET, GB, MIN
NFC South: ATL, CAR, NO, TB
NFC West:  ARI, LAR, SF, SEA
```

Plus `NFL` for league-wide stories.

---

## Appendix B: Immediate Execution Checklist (Phase 0 Preparation)

### NOW: Current Branch (`squad/4-m4-backend`) — Stabilization Cleanup

**Goal:** Get 24 dirty commits down to 1 clean PR that merges to main independently of the redesign.

**Checklist:**

1. **Stage clean source files only** (use `git add -p`):
   - ✓ `src/server.js` — bugfixes
   - ✓ `src/db.js` — corruption recovery
   - ✓ `src/content-brief.js` — clarity fixes
   - ✓ `dashboard/src/components/*.jsx` — audit, write-article, sweep UI fixes
   - ✓ `dashboard/src/api/client.js` — API client improvements
   - ✓ `dashboard/src/__tests__/*.test.js` — test updates
   - ✓ `BACKEND.md`, `.env.example` — doc updates
   - ✓ `Dockerfile`, `docker-compose.yml` — config fixes
   - ✓ `scripts/media-sweep.js`, `scripts/publish-test.js` — script improvements

2. **Unstage/leave uncommitted** (runtime artifacts):
   - `.queue/jobs.db` (DB state — never commit)
   - `content/processed-tx-ids.json` (sweep dedupe state — only auto-commit in GH Actions)
   - `content/briefs/*.md` (generated briefs)
   - `content/articles/*.md` (manual articles)
   - `.squad/orchestration-log/`, `.squad/log/` (session noise)
   - `node_modules/` (already .gitignored)
   - Untracked files (~37)

3. **Update `.gitignore`** to be explicit about runtime dirs (if not already):
   ```gitignore
   # SQLite runtime state (never commit)
   .queue/
   
   # Generated content artifacts (runtime only)
   content/briefs/
   content/articles/
   
   # Squad session state (regenerated)
   .squad/orchestration-log/
   .squad/log/
   .squad/sessions/
   ```

4. **Commit message:**
   ```
   fix: M4 bugfixes — audit log, sweep UX, article flow clarity

   - Fix audit log columns in dashboard display
   - Clarify WriteArticle step messaging for brief-based workflow
   - Fix SweepControl UI state handling
   - Fix JobList filtering and rendering
   - Improve error handling in server.js and db.js
   - Add corruption recovery to db module
   - Update documentation for clarity

   Fixes database logging issues and improves UX for current brief-paste workflow.
   Does not change core state machine or data model.
   
   Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
   ```

5. **Create PR #8**: `squad/4-m4-backend` → `main`
   - Title: "fix: M4 bugfixes — audit log, sweep UX, article flow clarity"
   - Description: Links to review notes, emphasizes this is stabilization only
   - Do NOT include Phase 0 / redesign scope creep
   - Merge only after tests pass

---

### AFTER Track 1 Merges: Fresh Branch (`squad/5-ideas-pipeline`)

**Goal:** Start clean from main, begin Phase 0.

1. **Create branch:**
   ```bash
   git checkout main
   git pull
   git checkout -b squad/5-ideas-pipeline
   ```

2. **Phase 0 tasks** (see detailed checklist below):
   - Durability (Docker volume mount)
   - Audit schema extension
   - JSON schema contracts (pairing session)
   - Validation function
   - Corruption recovery for new tables

3. **Commit Phase 0:**
   ```
   feat(phase0): foundation for ideas pipeline

   - Mount .queue as named Docker volume in production compose
   - Extend audit_log with entity_type + entity_id columns
   - Lock discussion output JSON schema (pair Backend + Writer)
   - Lock editor report JSON schema (pair Backend + Editor)
   - Implement primary_team ∈ teams validation function
   - Extend DB recovery to cover new tables
   
   Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
   ```

4. **Open PR:** `squad/5-ideas-pipeline` → `main` (Phase 0 only)

---

### Phase 0 Detailed Checklist (1 day, blocking Phase A)

#### 1. Durability: Docker Volume for `.queue/`

- [ ] Edit `docker-compose.yml`:
  - Development `backend` service: already mounts `.queue:/app/.queue` ✓
  - Production `backend-prod` service: add volume mount
    ```yaml
    volumes:
      - queue-data:/app/.queue
    
    volumes:
      queue-data:
        driver: local
    ```
  - Document in compose comments that `.queue` is durable state

- [ ] Document procedure in BACKEND.md:
  - Explain that `.queue/jobs.db` is persisted via Docker volume
  - Add backup procedure: `docker run -v <volume>:/queue -v $(pwd):/backup alpine cp -r /queue /backup/queue-$(date +%Y%m%d)`
  - Add restore procedure
  - Commit `.queue` backup snapshots to `.squad/assets/db-backups/` for historical record

**Merge gate:** Production compose has `queue-data` volume defined, health check passes, DB persists across container restarts (verified manual test).

---

#### 2. Audit Schema Extension

- [ ] In `src/db.js`, add migration to `_initSchema()`:
  ```sql
  ALTER TABLE IF EXISTS audit_log ADD COLUMN entity_type TEXT DEFAULT 'job';
  ALTER TABLE IF EXISTS audit_log ADD COLUMN entity_id TEXT DEFAULT NULL;
  ```
  (Use `IF EXISTS` to safely run on existing DB; `DEFAULT` ensures old rows get sensible defaults)

- [ ] Add index:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
  ```

- [ ] Update `addAuditEntry()` signature to accept optional `entity_type` and `entity_id`:
  ```js
  export function addAuditEntry({ 
    job_id,              // for backward compat
    entity_type = 'job',
    entity_id = null,
    action, 
    actor = 'system', 
    details = {} 
  }) { ... }
  ```
  (Preserve backward compat: if `entity_id` not provided, use `job_id` and default to type='job')

- [ ] Test:
  - [ ] Existing code that calls `addAuditEntry()` still works (backward compat)
  - [ ] New code can call with `entity_type = 'idea'` and `entity_id = 'idea-123'`
  - [ ] Query works: `SELECT * FROM audit_log WHERE entity_type = 'idea'`

**Merge gate:** Migration runs cleanly on both fresh and existing `.queue/jobs.db`; backward-compat test passes; new parameters tested.

---

#### 3. JSON Schema Contracts (Pairing Session: Backend + Writer + Editor)

**Goal:** Lock discussion output and editor report shapes so Phase C/D implementation is unambiguous.

- [ ] **Discussion Runner Contract** (finalize and document):
  ```json
  {
    "id": "disc-<uuid>",
    "idea_id": "idea-<uuid>",
    "transcript": "# Full markdown transcript...",
    "agent_outputs": {
      "cap": { ... },
      "player_rep": { ... },
      "_disagreements": [ ... ],
      "_metadata": { run_timestamp, topic, idea_id, duration_seconds }
    },
    "agents_used": ["cap", "player_rep", "team_strategist"],
    "run_metadata": {
      "runner_type": "manual" | "cli_bridge" | "api",
      "requested_at": "ISO 8601",
      "started_at": "ISO 8601",
      "finished_at": "ISO 8601",
      "duration_seconds": 450,
      "token_usage": { input: 12000, output: 8000 },
      "cost_usd": 0.18
    },
    "state": "completed" | "failed",
    "retry_count": 0,
    "error": null
  }
  ```
  - Writer confirms: can extract quotable sections from `transcript` with agent attribution
  - Writer confirms: can build article from `agent_outputs` structure
  - Backend commits: will validate against this schema on store

- [ ] **Editor Report Contract** (finalize and document):
  ```json
  {
    "verdict": "approve" | "revise" | "reject",
    "errors": [
      { "id": "err-1", "severity": "critical" | "major" | "minor", "location": "section", "description": "..." }
    ],
    "suggestions": [
      { "id": "sug-1", "category": "style" | "accuracy" | "structure" | "sourcing", "description": "..." }
    ],
    "notes": "Free-form commentary",
    "reviewed_at": "ISO 8601",
    "reviewed_by": "user@example.com"
  }
  ```
  - Editor confirms: structured enough to automation-proof Phase D reviews
  - Backend commits: will validate against this schema on store, enforce `verdict ∈ ['approve', 'revise', 'reject']`

- [ ] **Documentation**: Add `.squad/decisions/phase0-contracts.md`:
  ```markdown
  # Phase 0: JSON Schema Contracts
  
  Date: 2026-03-15
  Attendees: Backend, Writer, Editor
  
  ## Decision
  
  Locked discussion runner contract and editor report contract for Phase C/D implementation.
  
  ### Discussion Output Schema
  [Full JSON example above]
  
  ### Editor Report Schema
  [Full JSON example above]
  
  ### Validation Rules
  - Backend validates incoming discussion results against schema
  - Null agent outputs get error marker: `{ agent_id, agent_name, summary: null, error: "reason" }`
  - Every article must have editor report before article_ready
  - Revision loop: verdict=revise means article goes back to draft
  ```

**Merge gate:** Schemas documented, pair-reviewed by Backend + Writer + Editor, no ambiguity remains.

---

#### 4. Validation Function: `primary_team ∈ teams`

- [ ] Add to `src/db.js`:
  ```js
  const VALID_TEAMS = [
    'BUF', 'MIA', 'NE', 'NYJ',
    'BAL', 'CIN', 'CLE', 'PIT',
    'HOU', 'IND', 'JAX', 'TEN',
    'DEN', 'KC', 'LV', 'LAC',
    'DAL', 'NYG', 'PHI', 'WSH',
    'CHI', 'DET', 'GB', 'MIN',
    'ATL', 'CAR', 'NO', 'TB',
    'ARI', 'LAR', 'SF', 'SEA',
    'NFL'
  ];
  
  export function validateTeamArrayAndPrimary(teams, primaryTeam) {
    if (!Array.isArray(teams)) {
      throw new Error('teams must be an array');
    }
    if (teams.length === 0) {
      throw new Error('teams must not be empty');
    }
    if (teams.length > 8) {
      throw new Error('teams must have <= 8 members');
    }
    const invalid = teams.filter(t => !VALID_TEAMS.includes(t));
    if (invalid.length > 0) {
      throw new Error(`Invalid team codes: ${invalid.join(', ')}`);
    }
    if (!teams.includes(primaryTeam)) {
      throw new Error(`primary_team '${primaryTeam}' must be in teams array`);
    }
    // Return deduplicated, sorted
    return {
      teams: [...new Set(teams)].sort(),
      primaryTeam
    };
  }
  ```

- [ ] Add tests in `src/__tests__/db.test.js`:
  - Valid: `['SEA', 'KC']` with `primary_team = 'SEA'` ✓
  - Valid: `['NFL']` with `primary_team = 'NFL'` ✓
  - Valid: `['BAL', 'PIT', 'CLE', 'CIN']` (4 teams, one division) ✓
  - Invalid: `['SEA', 'INVALID']` → error ✓
  - Invalid: `['KC']` with `primary_team = 'BUF'` → error ✓
  - Invalid: empty array → error ✓
  - Invalid: 9+ teams → error ✓
  - Dedup + sort: `['KC', 'SEA', 'KC']` → `['KC', 'SEA']` ✓

**Merge gate:** All validation tests pass; rejects invalid cases, accepts valid cases.

---

#### 5. Corruption Recovery for New Tables

- [ ] In `src/db.js`, update `RECOVERABLE_TABLES`:
  ```js
  const RECOVERABLE_TABLES = ['jobs', 'token_usage', 'audit_log', 'config', 'ideas', 'discussions', 'articles', 'idea_teams'];
  ```

- [ ] Update `_snapshotDatabase()` to cover new tables (already iterates `RECOVERABLE_TABLES`, so no code change needed if we add tables to the list)

- [ ] Update `_restoreSnapshot()` to restore new tables (add blocks for ideas, discussions, articles, idea_teams):
  ```js
  for (const row of snapshot.ideas || []) {
    try {
      db.prepare(`
        INSERT INTO ideas (id, source_type, title, primary_team, teams, state, ...)
        VALUES (?, ?, ?, ?, ?, ?, ...)
      `).run(...);
      counts.ideas += 1;
    } catch { /* skip */ }
  }
  // ... similar for discussions, articles, idea_teams
  ```

- [ ] Add `counts.ideas`, `counts.discussions`, `counts.articles`, `counts.idea_teams` to return object

- [ ] Test:
  - [ ] Simulate corruption on a DB with `ideas` records
  - [ ] Trigger recovery
  - [ ] Verify `ideas` records are restored

**Merge gate:** Recovery test passes with new tables; snapshots and restores correctly.

---

### After Phase 0: Ready for Phase A

Once Phase 0 PR merges:
- Production deployments are durable (`.queue` persists)
- Audit log supports non-job entities
- JSON schemas are locked
- Validation logic is tested
- Recovery covers all tables

**Next:** Phase A (Data Model + API) starts immediately on `squad/5-ideas-pipeline`.
