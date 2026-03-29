# Migration Issue Pack — Ideas → Discussion → Article Pipeline

> **Repository:** JDL440/nfl-eval
> **Prepared by:** Lead (GM Analyst / Orchestrator)
> **Date:** 2026-03-15
> **Status:** Ready to paste into GitHub Issues
> **Existing issues:** #1–#3 closed (M1–M3), #4 open (M4). These start at #5.
> **Note:** GitHub issue creation was blocked (no `gh` CLI, no write-capable MCP tools). This document is the executable artifact — paste each issue verbatim.

---

## Labels to Create First

| Label | Color | Description |
|-------|-------|-------------|
| `squad` | `#1D76DB` | Squad-managed issue |
| `squad:backend` | `#0E8A16` | Backend agent scope |
| `squad:frontend` | `#FBCA04` | Frontend agent scope |
| `squad:tester` | `#D93F0B` | Tester agent scope |
| `squad:lead` | `#5319E7` | Lead orchestrator scope |
| `track-1-stabilize` | `#C2E0C6` | Track 1: Bugfix stabilization to main |
| `track-2-redesign` | `#BFD4F2` | Track 2: Ideas pipeline redesign |
| `phase-0` | `#E4E669` | Phase 0: Foundation & Contracts |
| `phase-A` | `#E4E669` | Phase A: Data Model + API |
| `phase-B` | `#E4E669` | Phase B: Dashboard Ideas UI |
| `phase-C` | `#E4E669` | Phase C: Discussion Integration |
| `phase-D` | `#E4E669` | Phase D: Editor Review Stage |
| `phase-E` | `#E4E669` | Phase E: Publish + Polish |
| `priority:critical` | `#B60205` | Must complete before dependents |
| `priority:high` | `#D93F0B` | High priority |
| `blocking` | `#B60205` | Blocks other issues |

---

## Issue Ordering & Dependency Map

```
Issue #5 (Track 1: Stabilize)
    └──► Issue #6 (Phase 0: Foundation)    ← blocked until #5 merges
           └──► Issue #7 (Phase A: Schema + API)
                  ├──► Issue #8 (Phase A: Tests)     ← parallel with #9
                  └──► Issue #9 (Phase B: Dashboard Ideas UI)
                         └──► Issue #10 (Phase C: Discussion Integration)
                                └──► Issue #11 (Phase D: Editor Review)
                                       └──► Issue #12 (Phase E: Publish + Polish)
```

**Batching strategy:** Issues #7 and #8 (schema/API + tests) can be worked in parallel by Backend and Tester respectively. Issue #9 (frontend) can start once #7's API surface is merged, even if #8 is still in progress. This gives 3 agents concurrent work as early as Phase A.

---

## Issue #5 — Track 1: Stabilize `squad/4-m4-backend` → PR to main

**Title:** `[Track 1] Stabilize M4 bugfixes — clean PR to main`

**Labels:** `squad`, `squad:backend`, `track-1-stabilize`, `priority:critical`, `blocking`

**Assignee:** Backend

### Objective
Get the 24+ dirty commits on `squad/4-m4-backend` down to one clean PR that merges validated bugfixes to `main`. This unblocks all Track 2 work.

### Scope

**Include (stage these files):**
- `src/server.js` — bugfixes
- `src/db.js` — corruption recovery
- `src/content-brief.js` — clarity fixes
- `dashboard/src/components/*.jsx` — AuditLog, WriteArticle, SweepControl, JobList fixes
- `dashboard/src/api/client.js` — API client improvements
- `dashboard/src/__tests__/*.test.js` — test updates
- `BACKEND.md`, `.env.example` — doc updates
- `Dockerfile`, `docker-compose.yml` — config fixes
- `scripts/media-sweep.js`, `scripts/publish-test.js` — script improvements

**Exclude (do NOT stage):**
- `.queue/jobs.db` (runtime DB — never commit)
- `content/processed-tx-ids.json` (sweep dedupe — auto-commit only in GH Actions)
- `content/briefs/*.md`, `content/articles/*.md` (generated artifacts)
- `.squad/orchestration-log/`, `.squad/log/`, `.squad/sessions/` (session noise)
- Untracked files (~37)

**Also do:**
- Update `.gitignore` to explicitly cover runtime directories:
  ```
  .queue/
  content/briefs/
  content/articles/
  .squad/orchestration-log/
  .squad/log/
  .squad/sessions/
  ```
- Use `git add -p` for selective staging

### Acceptance Criteria
- [ ] Single clean commit on `squad/4-m4-backend` with only validated source changes
- [ ] `.gitignore` covers `.queue/`, `content/briefs/`, `content/articles/`, `.squad/orchestration-log/`, `.squad/log/`, `.squad/sessions/`
- [ ] PR opened: `squad/4-m4-backend` → `main`
- [ ] PR title: `fix: M4 bugfixes — audit log, sweep UX, article flow clarity`
- [ ] All existing tests pass (legacy API, E2E, dashboard suites)
- [ ] No Phase 0 / redesign scope creep in this PR
- [ ] `.queue/` DB files are NOT in the commit

### Dependencies
- None — this is the first issue to execute

### Notes
- Commit message template is in `plan.md` § "Appendix B"
- The branch has 24 commits ahead of main + 88 dirty files (37 untracked). Use selective staging.
- After merge, `main` is clean and ready for Track 2.

---

## Issue #6 — Phase 0: Foundation & Contracts

**Title:** `[Phase 0] Foundation — durability, audit extension, JSON schema contracts`

**Labels:** `squad`, `squad:backend`, `squad:lead`, `track-2-redesign`, `phase-0`, `priority:critical`, `blocking`

**Assignee:** Backend (Lead coordinates pairing session)

### Objective
Establish the infrastructure, durability, audit log extension, validation logic, and locked JSON schema contracts that all subsequent phases depend on. Start from a fresh `squad/5-ideas-pipeline` branch off `main` (after #5 merges).

### Scope

#### 1. Durability: Docker Volume for `.queue/`
- Edit `docker-compose.yml`: add `queue-data` named volume to `backend-prod` service
- Document backup/restore procedure in `BACKEND.md`

#### 2. Audit Schema Extension
- Add `entity_type TEXT DEFAULT 'job'` and `entity_id TEXT DEFAULT NULL` columns to `audit_log` in `src/db.js` `_initSchema()`
- Add index: `idx_audit_entity ON audit_log(entity_type, entity_id)`
- Update `addAuditEntry()` to accept optional `entity_type` / `entity_id` with backward compat

#### 3. Idempotency Keys
- Define `(source_type, source_ref)` unique index on `ideas` table (prep for Phase A)
- Define `source_hash` field for sweep dual-write deduplication

#### 4. JSON Schema Contracts (Pairing Session: Backend + Writer + Editor)
- Lock **Discussion Runner Contract**: transcript format, per-agent output structure (agent_id, summary, position, key_claims, confidence, sources_cited), disagreement array, metadata, null safety
- Lock **Editor Report Contract**: verdict enum (approve/revise/reject), errors array (severity levels), suggestions array (categories), notes, reviewed_at/by
- Document in `.squad/decisions/phase0-contracts.md`

#### 5. Validation Function
- Implement `validateTeamArrayAndPrimary(teams, primaryTeam)` in `src/db.js`
- Validate: array type, non-empty, max 8 members, all valid 32 team codes + 'NFL', primary_team ∈ teams
- Return deduplicated, sorted array

#### 6. Corruption Recovery
- Extend existing DB recovery coverage to new tables (`ideas`, `discussions`, `articles`, `idea_teams`)

### Acceptance Criteria
- [ ] Production compose mounts `queue-data` named volume; DB persists across container restarts (manual test)
- [ ] Audit schema migration runs cleanly on both fresh DB and existing `.queue/jobs.db`
- [ ] `addAuditEntry()` backward-compat test passes (existing callers unbroken)
- [ ] New audit entry with `entity_type='idea'` works
- [ ] Discussion output JSON schema documented and pair-reviewed
- [ ] Editor report JSON schema documented and pair-reviewed
- [ ] Validation function rejects: empty array, >8 teams, invalid codes, primary_team not in array
- [ ] Validation function accepts: single team, multi-team, 'NFL', and returns sorted/deduped
- [ ] Recovery covers new tables

### Dependencies
- **Blocked by:** #5 (Track 1 must merge to main first)
- **Blocks:** #7, #8, #9 (all Phase A+ work)

### Notes
- Branch: create `squad/5-ideas-pipeline` from `main` after #5 merges
- The pairing session for JSON schemas is the most important deliverable — it unblocks Writer and Editor understanding of the pipeline
- Commit message prefix: `feat(phase0):`

---

## Issue #7 — Phase A: Schema Migration + CRUD API + Dual-Write

**Title:** `[Phase A] Schema migration, Ideas CRUD API, and sweep dual-write`

**Labels:** `squad`, `squad:backend`, `track-2-redesign`, `phase-A`, `priority:high`, `blocking`

**Assignee:** Backend

### Objective
Add the `ideas`, `discussions`, `articles`, `idea_teams` tables and a complete REST API for the ideas lifecycle. Wire sweep to dual-write both `jobs` and `ideas` records.

### Scope

#### Schema (in `src/db.js` `_initSchema()`)
- `ideas` table: id, source_type, source_ref, source_hash, title, angle, primary_team, teams (JSON array), topic_type, context (JSON), desired_agents (JSON array), state, review_policy, state_version, timestamps
- `discussions` table: id, idea_id (FK), transcript, agent_outputs (JSON), agents_used (JSON array), run_metadata (JSON), state, runner_type, timestamps, retry_count, error
- `articles` table: id, idea_id (FK), discussion_id (FK nullable), title, subtitle, body, editor_report (JSON), state, approved_by, approved_at, approval_note, substack fields, timestamps
- `idea_teams` junction: idea_id + team_abbr (composite PK), role
- Indexes per plan.md spec

#### API Routes (in `src/server.js`)
- `GET /api/ideas` — list, filter by team/state
- `POST /api/ideas` — create (with teams validation, idempotent via source_hash)
- `GET /api/ideas/:id` — detail
- `PUT /api/ideas/:id` — edit (title, angle, teams, desired_agents)
- `POST /api/ideas/:id/advance` — state transition (requires `expected_version`, returns 409 on stale)
- `POST /api/ideas/:id/reject` — reject at any stage (requires `expected_version`)
- `GET /api/ideas/:id/discussion` — get discussion
- `POST /api/ideas/:id/discussion` — store discussion result (validate against Phase 0 schema)
- `GET /api/ideas/:id/article` — get article
- `POST /api/ideas/:id/article` — store article draft
- `POST /api/ideas/:id/editor-review` — store editor report (validate against Phase 0 schema)
- `POST /api/ideas/:id/publish` — publish to Substack

#### Dual-Write
- Sweep creates both `jobs` and `ideas` from same transaction data
- Idempotent via `source_hash` — re-running sweep doesn't create duplicates
- Ordering: persist SQLite first (one transaction), then enqueue BullMQ, then audit

#### Backward Compatibility
- All `/api/jobs/*` routes remain unchanged
- Existing `jobs` table untouched
- Legacy tests must still pass

### Acceptance Criteria
- [ ] Additive schema migration test passes (new tables alongside existing)
- [ ] All legacy jobs flow tests still green
- [ ] Dual-write parity test: sweep creates matching job + idea records
- [ ] Idea lifecycle contract tests: valid transitions accepted, invalid rejected with 409
- [ ] `primary_team ∈ teams` validation enforced on create/update
- [ ] `idea_teams` junction maintained transactionally on every ideas INSERT/UPDATE
- [ ] Audit log captures idea transitions with `entity_type = 'idea'`
- [ ] All new API endpoints return correct HTTP status codes (201, 200, 409, 400, 404)

### Dependencies
- **Blocked by:** #6 (Phase 0 must land first)
- **Blocks:** #8, #9, #10 (tests, frontend, discussion integration)

### Notes
- Full schema SQL is in plan.md § "2. 32-Team Data Model"
- State machine transitions are in plan.md § "3. State Machine"
- The advance endpoint is the single entry point for all state transitions — no direct state writes

---

## Issue #8 — Phase A: Test Suite for Ideas Pipeline

**Title:** `[Phase A] Contract + integration tests for ideas API and state machine`

**Labels:** `squad`, `squad:tester`, `track-2-redesign`, `phase-A`, `priority:high`

**Assignee:** Tester

### Objective
Write comprehensive tests for the new ideas pipeline API, state machine transitions, validation logic, and dual-write behavior. Can start in parallel with #7 (test against API contracts while Backend implements).

### Scope

#### State Machine Tests
- Happy path: `idea_draft → idea_ready → discussion_requested → discussion_ready → article_drafted → editor_reviewed → article_ready → published`
- Rejection at every stage → `rejected`
- Revision loop: `editor_reviewed (verdict=revise) → article_drafted → editor_reviewed → article_ready`
- Invalid transitions return 409
- Stale `state_version` returns 409

#### API Tests
- CRUD: create, read, update ideas
- Validation errors: empty teams, invalid team codes, primary_team not in teams, >8 teams
- Idempotent dual-write: same source_hash doesn't create duplicate
- Discussion storage: valid schema accepted, invalid schema rejected
- Editor report storage: valid schema accepted, invalid schema rejected
- Publish: requires article_ready state

#### Backward Compatibility Tests
- All existing `/api/jobs/*` routes unbroken
- Legacy job lifecycle still works end-to-end
- Audit log works for both old (job) and new (idea) entity types

#### Edge Cases
- Concurrent advance attempts (optimistic locking)
- Malformed JSON payloads
- Missing required fields
- Empty string vs null handling

### Acceptance Criteria
- [ ] State machine happy path test passes
- [ ] Every rejection/failure path has a test
- [ ] Revision loop test passes
- [ ] 409 stale-state test passes
- [ ] Validation error tests cover all rules from plan.md
- [ ] Dual-write parity test passes
- [ ] Legacy tests remain green
- [ ] Test file(s) in `tests/` following existing project conventions

### Dependencies
- **Blocked by:** #6 (needs Phase 0 validation function and schema contracts)
- **Can start in parallel with:** #7 (write tests against contract, run against implementation)
- **Blocks:** #10 (Phase C needs passing tests as safety net)

### Notes
- Use existing test framework (`jest.config.js` is present)
- Test against the JSON schema contracts locked in Phase 0 (#6)
- Existing test patterns: `tests/` directory and `dashboard/src/__tests__/`

---

## Issue #9 — Phase B: Dashboard Ideas UI

**Title:** `[Phase B] Dashboard Ideas tab — list, editor, team filter, feature-flagged`

**Labels:** `squad`, `squad:frontend`, `track-2-redesign`, `phase-B`, `priority:high`

**Assignee:** Frontend

### Objective
Add an Ideas tab to the dashboard as a secondary (feature-flagged) view alongside the existing Jobs tab. Support idea creation, editing, state visualization, and team filtering for all 32 teams.

### Scope

#### New Components
- **IdeasList** — Table/list of ideas with state badges, team badges, pipeline progress indicator
- **IdeaEditor** — Create/edit form: title, angle, teams multi-select with primary_team badge, topic_type dropdown, agent panel override
- **TeamFilter** — Sidebar with all 32 teams grouped by conference/division, plus "NFL" for league-wide; favorites pinnable
- **StateIndicator** — Visual pipeline indicator showing current state in the lifecycle

#### Navigation
- Ideas as a **secondary tab** (Jobs remains default)
- Feature flag approach: Ideas tab visible but labeled "Beta" or "New"
- Legacy jobs labeled "Legacy Queue" when dual-write is active
- Bidirectional links between dual-written jobs ↔ ideas ("Open related Idea" / "Open source Job")

#### UX Requirements
- Manual idea creation form
- Edit idea before advancing (title, angle, teams, agents)
- State badge with color coding per lifecycle stage
- Empty states, loading states, error states for all new views
- Migration banner explaining which queue to use
- 409 stale-state errors rendered as user-facing messages

#### Phase C Decision
- By the end of Phase B design, lock the Phase C execution model: CLI bridge (Option A) vs manual paste (Option B)
- Phase B UI must be designed to accommodate the chosen model

### Acceptance Criteria
- [ ] Ideas tab accessible from dashboard nav
- [ ] Jobs remains the default view
- [ ] Create idea: title, angle, teams (multi-select), primary_team, topic_type
- [ ] Edit idea: all editable fields update via PUT
- [ ] Team filter: filter ideas by team code
- [ ] State badges render correctly for all lifecycle states
- [ ] Advance and reject actions work from UI (calls `/api/ideas/:id/advance` and `/reject`)
- [ ] Dual-written records show cross-links (Job → Idea, Idea → Job)
- [ ] Empty/loading/error states rendered
- [ ] Dashboard tests cover create/edit/filter/advance/reject flows
- [ ] Stale-state 409 errors shown as user-friendly messages

### Dependencies
- **Blocked by:** #7 (needs API endpoints to be available)
- **Blocks:** #10, #11, #12 (discussion viewer, editor review UI, publish wiring)

### Notes
- Existing dashboard: React app in `dashboard/src/components/`
- Existing components to reference: `JobList.jsx`, `WriteArticle.jsx`, `AuditLog.jsx`, `SweepControl.jsx`
- Team abbreviations list in plan.md § "Appendix: Team Abbreviations"
- The 32-team filter should use conference/division groupings to avoid overwhelming the UI

---

## Issue #10 — Phase C: Discussion Integration

**Title:** `[Phase C] Discussion runner integration, transcript storage, and viewer`

**Labels:** `squad`, `squad:backend`, `squad:frontend`, `track-2-redesign`, `phase-C`, `priority:high`

**Assignee:** Backend (runner + API), Frontend (viewer UI)

### Objective
Wire the discussion execution step into the pipeline. This is the core product differentiator — agents discuss an idea, their outputs are captured, and the transcript feeds article generation.

### Scope

#### Backend: Discussion Runner
- "Run Discussion" action: `POST /api/ideas/:id/advance` transitions `idea_ready → discussion_requested`
- Discussion runner bridge generates a structured discussion packet from the idea
- **Option A (CLI bridge):** Backend calls Squad CLI, captures output, stores result
- **Option B (manual paste):** Backend generates discussion packet; user runs externally and pastes back via `POST /api/ideas/:id/discussion`
- (Which option is decided by end of Phase B — see #9)
- Store: transcript (structured markdown with agent headers), per-agent summaries, disagreements, metadata
- Validate stored discussion against Phase 0 JSON schema contract

#### Backend: Article Generation from Discussion
- "Generate Article" action creates article from stored discussion output
- Writer uses transcript + agent_outputs (not raw transaction data) as input
- Article stored via `POST /api/ideas/:id/article`

#### Frontend: Discussion Viewer
- Transcript view with agent attribution headers (`## Cap Analyst`, `## PlayerRep`, etc.)
- Per-agent output cards (summary, position, confidence, key claims)
- Disagreement index highlighting conflicts
- Discussion failure/retry states with cost/token info
- "Generate Article" button (available when discussion is complete)

#### Durability
- In-progress discussions survive backend restart (state persisted before runner starts)
- Failed discussions are retryable (retry_count tracked)

### Acceptance Criteria
- [ ] Happy path test: idea → discussion_requested → discussion_ready → outputs stored
- [ ] Failure path test: discussion_requested → running → failed → retry
- [ ] Transcript persistence survives backend restart
- [ ] Stored `agent_outputs` validates against Phase 0 JSON schema
- [ ] Discussion viewer shows transcript with agent attribution
- [ ] Per-agent output cards render correctly
- [ ] Disagreement index displayed
- [ ] "Generate Article" from stored discussion works (end-to-end test with fake data)
- [ ] Writer can draft article using only discussion output (not raw transaction data)
- [ ] Cost/token metadata stored in `run_metadata`

### Dependencies
- **Blocked by:** #7 (API), #8 (tests as safety net), #9 (Phase B decision on execution model)
- **Blocks:** #11 (Editor review)

### Notes
- Discussion output format is locked in Phase 0 (#6)
- The transcript must have agent attribution headers so Writer can extract quotable sections
- Even in Option B (manual paste), the stored artifact shape is identical to Option A
- This is the phase where the product starts matching the user's mental model

---

## Issue #11 — Phase D: Editor Review Stage

**Title:** `[Phase D] Editor review gate — structured review, revision loop, approval audit`

**Labels:** `squad`, `squad:backend`, `squad:frontend`, `track-2-redesign`, `phase-D`, `priority:high`

**Assignee:** Backend (review API), Frontend (review display)

### Objective
Add the mandatory editor review gate. No article reaches `article_ready` without a structured editor review. Support revision loops and rejection paths.

### Scope

#### Backend
- `POST /api/ideas/:id/editor-review` stores structured editor report (validated against Phase 0 schema)
- Hard gate: `article_ready` blocked unless `editor_report.verdict = 'approve'` AND `approved_by` is set
- Revision loop: `verdict = 'revise'` returns idea state to `article_drafted` for Writer revision
- Rejection: `verdict = 'reject'` moves idea to `rejected`
- Approval audit fields populated: `approved_by`, `approved_at`, `approval_note`
- Audit log entry for every review action

#### Frontend
- Editor review display: error list (severity badges), suggestion list (category badges), notes, verdict badge
- Approve / Revise / Reject action buttons
- Revision history visible (if multiple review rounds)
- Approval confirmation modal with optional note field

### Acceptance Criteria
- [ ] Editor gate proves: no `article_ready` without passing review
- [ ] Revision loop test: revise → re-draft → re-review → approve
- [ ] Rejection path test: reject → idea moved to `rejected`
- [ ] `approved_by`/`approved_at` populated on every approval
- [ ] Editor report validates against Phase 0 JSON schema
- [ ] Dashboard renders error list, suggestions, notes, verdict badge
- [ ] Audit log captures all review actions with entity_type='idea'

### Dependencies
- **Blocked by:** #10 (needs discussion → article flow working)
- **Blocks:** #12 (Publish wiring)

### Notes
- Editor report JSON schema locked in Phase 0 (#6)
- MVP: `review_policy` is always `human`. Auto-review is post-MVP.
- Every article MUST be reviewed — no exceptions in MVP

---

## Issue #12 — Phase E: Publish + Polish + Nav Migration

**Title:** `[Phase E] Publish wiring, unpublish rollback, nav migration to Ideas`

**Labels:** `squad`, `squad:backend`, `squad:frontend`, `track-2-redesign`, `phase-E`, `priority:high`

**Assignee:** Backend (publish API), Frontend (nav + polish)

### Objective
Wire the existing Substack client to the new `articles` table. Add unpublish/rollback. Migrate the dashboard's primary navigation from Jobs to Ideas. Run staging canary to prove both flows work.

### Scope

#### Backend
- Wire existing Substack client (`src/substack-client.js` or similar) to new `articles` table
- `POST /api/ideas/:id/publish` — publish to Substack, store substack_id/url/published_at
- Unpublish: clears Substack fields, returns to `article_ready`, logs audit
- Publish failure recovery: failed → retry without re-review
- Cost/token visibility at idea detail level
- Update audit log to reference ideas throughout

#### Frontend
- **Migrate dashboard primary nav from Jobs → Ideas** (Ideas becomes default tab)
- Legacy Jobs view kept but de-emphasized (moved to secondary position)
- Publish / Unpublish buttons on article detail view
- Publish status badges
- Full audit trail visible for entire idea lifecycle

#### Staging Canary
- Prove legacy jobs flow still works end-to-end (sweep → approve → publish)
- Prove new ideas flow works end-to-end (create → discuss → article → review → publish)
- Both flows coexist without interference

### Acceptance Criteria
- [ ] Publish to Substack works from ideas pipeline
- [ ] Unpublish clears Substack fields and logs audit
- [ ] Publish failure → retry without re-review
- [ ] Audit log trace completeness: every state transition from `idea_draft → published` has audit entry
- [ ] Dashboard defaults to Ideas tab
- [ ] Legacy Jobs view still accessible and functional
- [ ] Staging canary: legacy flow works
- [ ] Staging canary: new ideas flow works end-to-end
- [ ] Nav migration does not break existing editor workflows
- [ ] Cost/token data visible on idea detail

### Dependencies
- **Blocked by:** #11 (needs editor review gate working)
- **Blocks:** Nothing — this is the final phase

### Notes
- Only migrate the nav AFTER all screens (discussion viewer, editor review, publish) exist
- The staging canary is the final gate — both legacy and new pipelines must work
- After this ships, the product matches the user's mental model: ideas → discussion → article → review → publish

---

## Execution Summary

| Issue | Title | Owner | Track/Phase | Est. | Depends On | Blocks |
|-------|-------|-------|-------------|------|------------|--------|
| #5 | Stabilize M4 bugfixes → PR to main | Backend | Track 1 | 0.5d | — | #6 |
| #6 | Foundation — durability, audit, contracts | Backend + Lead | Phase 0 | 1d | #5 | #7, #8, #9 |
| #7 | Schema migration, Ideas CRUD API, dual-write | Backend | Phase A | 2d | #6 | #8, #9, #10 |
| #8 | Contract + integration tests for ideas pipeline | Tester | Phase A | 1.5d | #6 (parallel w/ #7) | #10 |
| #9 | Dashboard Ideas tab (feature-flagged) | Frontend | Phase B | 2d | #7 | #10, #11, #12 |
| #10 | Discussion runner, transcript storage, viewer | Backend + Frontend | Phase C | 2.5d | #7, #8, #9 | #11 |
| #11 | Editor review gate, revision loop, approval | Backend + Frontend | Phase D | 1d | #10 | #12 |
| #12 | Publish wiring, unpublish, nav migration | Backend + Frontend | Phase E | 1d | #11 | — |

**Total estimated effort:** ~11.5 days of work across 3 agents (Backend, Frontend, Tester).
**Parallelism:** #7 and #8 can overlap; #8 and #9 can overlap once API surface is defined.
**Critical path:** #5 → #6 → #7 → #9 → #10 → #11 → #12

---

## Batch Creation Order

Paste into GitHub Issues in this exact order to get correct `#N` references:

1. **Issue #5** — Track 1: Stabilize (paste first, gets #5)
2. **Issue #6** — Phase 0: Foundation (paste second, gets #6)
3. **Issue #7** — Phase A: Schema + API (paste third, gets #7)
4. **Issue #8** — Phase A: Tests (paste fourth, gets #8)
5. **Issue #9** — Phase B: Dashboard UI (paste fifth, gets #9)
6. **Issue #10** — Phase C: Discussion (paste sixth, gets #10)
7. **Issue #11** — Phase D: Editor Review (paste seventh, gets #11)
8. **Issue #12** — Phase E: Publish + Polish (paste eighth, gets #12)

> ⚠️ Issue numbers assume no other issues are created between now and pasting. If any are, adjust references accordingly.
