<overview>
Joe Robinson is building nfl-lab — a Django 5.2/Python/Celery/Redis control plane for NFL analysis and AI-powered article-generation workflows. The session focused on: (1) restoring 4 background agents that were lost when the CLI closed, (2) activating Ralph's work monitor loop to drive GitHub Issues through the full pipeline, (3) routing Expert Admin implementation to Rusty+Linus, routing Pipeline UX issues (#1–#6) to Rusty+Linus, and (4) filing issue #9 for Basher to research a Substack API replacement.
</overview>

<history>
1. **User asked to restart 4 running tasks** (lost when CLI closed)
   - Checked `gh auth status` → not authenticated; killed interactive gh auth shell
   - Confirmed `gh` v2.88.1 was installed
   - Identified 4 tasks from context: Danny (Expert Admin issues), Danny (Pipeline UX audit), Rusty (Expert Admin backend), Linus (Expert Admin templates)
   - Restarted as agent-0 (Danny/pipeline audit), agent-1 (Rusty/Expert Admin backend), agent-2 (Linus/Expert Admin templates), agent-3 (pipeline UX issues via gh)
   - agent-3 completed: 6 pipeline UX issues created (#1–#6) on GitHub

2. **User said "Ralph, go" (in plan mode)**
   - Scanned GitHub: 6 open issues (#1–#6), all labeled `squad:linus` + some `squad:rusty`, 0 open PRs
   - `gh auth status` → authenticated as JDL440 ✅
   - Wrote Ralph work loop plan to `plan.md`, exited plan mode to autopilot
   - Collected agent-0, agent-1, agent-2 results (all completed)
   - agent-1 (Rusty): Expert Admin views + URLs → committed `d1fe16b` to main
   - agent-2 (Linus): Expert Admin templates → committed `067a2f1` to main
   - agent-0 (Danny): Pipeline UX audit complete, 6 gaps confirmed, audit doc written
   - Django check: ✅ no issues. Pushed 2 commits to origin/main
   - Marked all 5 Expert Admin SQL todos as done (all 16 todos now done)
   - **Round 2**: Spawned agent-4 (Rusty → issues #2 + #6) and agent-5 (Linus → issues #1, #3, #4, #5) with feature branch instructions

3. **User asked Danny to file a Substack replacement issue**
   - Captured directive: "No Substack API — use open-source alternative"
   - Wrote directive to `.squad/decisions/inbox/copilot-directive-20260315-no-substack.md`
   - Created `squad:basher` label on GitHub
   - Filed issue #9: "Research: Replace Substack API with open-source publishing alternative" with Phase 1 (research) + Phase 2 (implementation) structure, assigned to `squad:basher`

4. **User asked for status report** → this summary
</history>

<work_done>
Files created/modified:

**Code (committed to main, pushed to origin):**
- `apps/experts/views.py` — NEW: ExpertAdminListView, ExpertAdminDetailView, ExpertAdminEditView, ExpertAIRefreshView
- `apps/experts/urls.py` — NEW: 4 URL patterns for expert admin routes
- `apps/experts/tasks.py` — NEW: `refresh_expert_context` Celery stub
- `templates/experts/expert_admin_list.html` — NEW: Expert Roster page
- `templates/experts/expert_admin_detail.html` — NEW: Expert detail page
- `templates/experts/expert_admin_edit.html` — NEW: Expert edit form
- `templates/dashboard/expert_admin_list.html` — NEW (Linus's version, may duplicate)
- `templates/dashboard/expert_admin_detail.html` — NEW (Linus's version)
- `templates/dashboard/expert_admin_edit.html` — NEW (Linus's version)
- `templates/base.html` — Updated: added Experts nav link, `.badge-active`/`.badge-inactive`/`.expert-card` CSS
- `config/urls.py` — Updated: includes `apps.experts.urls`

**Squad state:**
- `.squad/decisions/inbox/copilot-directive-20260315-no-substack.md` — NEW: No Substack directive

**GitHub:**
- Issues #1–#6: Pipeline UX gaps (all `squad:linus`, some `squad:rusty`) — OPEN, no PRs yet
- Issue #7, #8: Expert Admin issues (created by earlier agent-34 session)
- Issue #9: Substack replacement research — OPEN, `squad:basher`
- Labels created: `squad:rusty`, `squad:linus`, `squad:basher`, `squad:saul`, `squad`, `go:needs-research`

**Work completed:**
- [x] Expert Admin backend views + URLs (Rusty, commit d1fe16b)
- [x] Expert Admin templates (Linus, commit 067a2f1)
- [x] Pipeline UX audit (Danny)
- [x] 6 pipeline UX issues created (#1–#6)
- [x] Issue #9 filed for Substack replacement
- [x] All 16 SQL todos marked done
- [ ] agent-4 (Rusty): Issues #2 + #6 — IN PROGRESS (feature branch)
- [ ] agent-5 (Linus): Issues #1, #3, #4, #5 — IN PROGRESS (feature branch)
- [ ] Saul: PR review + merge (blocked waiting for PRs from agent-4, agent-5)
- [ ] Basher: Research Substack alternatives (issue #9, not started)
</work_done>

<technical_details>
- **Agents committed directly to `main`** — Rusty and Linus skipped feature branches in the first Expert Admin pass. Fixed going forward: agent-4 and agent-5 were explicitly instructed to create `squad/{N}-slug` branches and open PRs.
- **Template duplication risk**: Rusty created templates under `templates/experts/` while Linus created under `templates/dashboard/`. Both committed. Views reference `templates/experts/` paths. `templates/dashboard/` copies may be unused — should be cleaned up.
- **Expert Admin URL wiring**: `config/urls.py` includes `apps.experts.urls` at root (`path("", ...)`). Django check passes. UUID-based PK routing used.
- **No open PRs yet** — agent-4 and agent-5 are building. Saul cannot review until PRs land.
- **gh CLI**: v2.88.1, authenticated as JDL440, token scopes: `gist`, `read:org`, `repo`. Repo: `JDL440/nfl-lab`.
- **Ralph loop**: Active. Ralph was activated in autopilot mode. Round 2 agents (agent-4, agent-5) are running. Next action after they complete: check PRs → spawn Saul → merge.
- **Issue #9 (Substack)**: Two-phase issue: Phase 1 = research doc at `docs/publishing-research.md`, Phase 2 = implement `PublisherProvider` interface matching `CopilotProvider` pattern in `apps/runs/tasks.py`.
- **Squad label convention**: `squad` (triage inbox) + `squad:{member}` (routing). Both needed on issues.
- **Saul merge command**: `gh pr merge --squash --delete-branch` — Joe never reviews PRs.
- **Pipeline stages in design**: Panel Composition → Panel Discussion → Article Writing → Editor Pass → Publisher Pass → Published. Each has StageRun with status/output_raw/prompt_used.
</technical_details>

<important_files>
- `apps/experts/views.py`
  - NEW: All 4 Expert Admin CBVs
  - ExpertAdminListView groups by team via ExpertTeamMembership; ExpertAIRefreshView queues Celery task
- `apps/experts/urls.py`
  - NEW: 4 routes: `/admin/experts/`, `/admin/experts/<uuid>/`, `/admin/experts/<uuid>/edit/`, `/admin/experts/<uuid>/ai-refresh/`
- `config/urls.py`
  - Updated to include `apps.experts.urls` — critical for routing to work
- `templates/experts/` (3 files)
  - Authoritative templates for Expert Admin (Rusty's versions, wired to views)
- `templates/base.html`
  - All CSS lives here + nav links. "Experts" link added between Runs and Admin.
- `apps/dashboard/views.py`
  - Main dashboard logic — IdeaListView, CreateIdeaView, ArticleRunView, StageOutputView, EditorPassView, PublisherPassView
- `apps/runs/tasks.py`
  - Celery tasks: `execute_stage`, `start_article_run` — pipeline execution engine
- `apps/runs/models.py`
  - ArticleRun, StageRun, RunLog — pipeline data model
- `.squad/decisions/inbox/copilot-directive-20260315-no-substack.md`
  - Captures Joe's constraint: no Substack API
- `.squad/team.md`
  - Authoritative roster: Danny, Rusty, Linus, Basher, Saul, Scribe, Ralph
- `.squad/routing.md`
  - All PR reviews → Saul; after any agent opens PR → Saul
</important_files>

<next_steps>
**Immediate — agents in flight:**
- agent-4 (Rusty): Creating feature branch `squad/2-panel-composition-6-published-archive`, implementing Panel Composition page + Published Archive view, opening PR
- agent-5 (Linus): Creating feature branch `squad/1-3-4-5-pipeline-ux-promote-controls`, implementing Article Detail page + stage promote controls + Publisher Review page, opening PR

**After agent-4 + agent-5 complete:**
- Collect results, verify PRs opened on GitHub
- Spawn Saul to review both PRs → patch minor issues → merge + close linked issues
- Ralph scans board: 6 pipeline UX issues should close, #9 (Substack) and any Expert Admin issues remain

**Expert Admin cleanup:**
- Reconcile template duplication: `templates/experts/` vs `templates/dashboard/` — delete unused copies
- Verify Expert Admin pages render at `/admin/experts/`

**Issue #9 (Substack replacement):**
- Basher needs to pick this up: research Ghost, WriteFreely, Hugo+static, Dev.to
- Write `docs/publishing-research.md` with comparison + recommendation
- After decision, Rusty implements `PublisherProvider` interface

**Ralph loop continues** until board is clear. Say "Ralph, idle" to stop.
</next_steps>