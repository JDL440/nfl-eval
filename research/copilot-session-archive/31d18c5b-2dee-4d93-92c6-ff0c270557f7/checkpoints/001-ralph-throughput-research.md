<overview>
The user first activated Ralph to autonomously monitor and advance the NFL article backlog in `C:\github\nfl-eval`, then explicitly directed Ralph to maximize parallel throughput using prior successful patterns, and finally asked for status summaries of all article issues, including DB-backed status from `content\pipeline.db`. The current active task is a deep research task on why article orchestration gets stuck and how to improve it; the approach has been to reconcile intended lifecycle rules (`.squad` skills/charters/decisions) against live operational state (GitHub issues, local article artifacts, and `pipeline.db`) to identify where orchestration diverges in practice.
</overview>

<history>
1. The user said `ralph, go`
   - Resolved git/team context with `git config user.name`, `git rev-parse --show-toplevel`, and `git worktree list --porcelain`.
   - Verified `.squad/team.md` exists and read `.squad/team.md`, `.squad/routing.md`, and `.squad/casting/registry.json`.
   - Scanned GitHub issues/PRs with `gh issue list` / `gh pr list` and found article backlog issues labeled `squad:*`, mostly with no active PRs.
   - Created/updated SQL todos and created `C:\Users\jdl44\.copilot\session-state\31d18c5b-2dee-4d93-92c6-ff0c270557f7\plan.md` for the Ralph work.
   - Determined issue `#71` (`SEA — Seahawks RB Pick #64 Analysis (v2 Regeneration)`) was ready for panel discussion based on the issue and local artifacts.

2. For issue `#71`, Ralph advanced the article pipeline
   - Read issue `#71`, comments, labels, and local panel artifacts under `content\articles\seahawks-rb-pick64-v2\`.
   - Read charters for `SEA`, `Injury`, `CollegeScout`, and `Offense`, plus article skills.
   - Spawned four parallel background agents for Stage 4 panel positions:
     - `SEA` → `sea-position.md`
     - `Injury` → `injury-position.md`
     - `CollegeScout` → `collegescout-position.md`
     - `Offense` → `offense-position.md`
   - Collected results:
     - `SEA`: RB at `#64` no longer defensible due to CB/EDGE urgency.
     - `Injury`: Charbonnet Week 1 availability ~35–45%; Price Achilles discount is shrinking.
     - `CollegeScout`: Price is fair value, not a “steal”; RB dropoff to `#96` is manageable.
     - `Offense`: scheme still pulls strongly toward early RB investment.
   - Spawned `Lead` to synthesize `discussion-summary.md` and `Scribe` to log/merge decisions.
   - `Lead` produced a synthesis recommending EDGE/CB at `#64`, RB at `#96` or via veteran bridge.
   - Spawned `Writer` for `content\articles\seahawks-rb-pick64-v2\draft.md`.
   - `Writer` completed the draft (~3,485 words, 4 TLDR bullets, 2 inline image placeholders, no cover image).
   - Later, `Editor` reviewed the SEA v2 draft and returned `🟡 REVISE` with 1 red error (Charbonnet surgery year wrong) and 4 yellow suggestions.

3. The user said: “Ralph - look in you history and update your process to really push teh maximum parallel throughput like we did previoiusly”
   - Captured the directive in `.squad/decisions/inbox/copilot-directive-20260316T074016Z.md`.
   - Researched prior Ralph/parallelism evidence in `.squad/decisions.md`, `.squad/agents/lead/history.md`, and related docs.
   - Spawned `Lead` to formalize a new Ralph throughput rule.
   - `Lead` produced `.squad/decisions/inbox/lead-ralph-max-throughput.md` and updated `.squad/identity/now.md` with the maximum-throughput operating mode.
   - New rule: batch all unblocked article work by stage, keep Writer/Editor saturated, and serialize only on real intra-article dependencies.
   - Applied that rule immediately by scanning article directories for local readiness instead of trusting issue labels alone.

4. Ralph then launched a parallel mixed-stage batch
   - Scanned `content\articles\` to find ready lanes:
     - `ARI` had a draft and was Editor-ready.
     - `LAR` and `SF` had panel packages and were Writer-ready.
     - `witherspoon-extension-v2` had a draft and was Editor-ready.
     - `SEA v2` had just completed its draft and was also Editor-ready.
   - Spawned in parallel:
     - `Writer` for `LAR`
     - `Writer` for `SF`
     - `Editor` for `ARI`
     - `Editor` for `SEA v2`
     - `Editor` for `witherspoon-extension-v2`
   - Completed outcomes:
     - `LAR` draft created at `content/articles/lar-2026-offseason/draft.md`
     - `SF` draft created at `content/articles/sf-2026-offseason/draft.md`
     - `ARI` editor review saved at `content/articles/ari-2026-offseason/editor-review.md` with verdict `🟡 REVISE`
     - `SEA v2` editor review saved at `content/articles/seahawks-rb-pick64-v2/editor-review.md` with verdict `🟡 REVISE`
     - `witherspoon-extension-v2` editor review saved at `content/articles/witherspoon-extension-v2/editor-review.md` with verdict `✅ APPROVED` pending image generation

5. The user asked: “git me a summary of the state of all of the article issues. What stage are they at?”
   - Reconciled GitHub issue labels against local `content\articles\` artifacts using `gh issue list` and a custom PowerShell/Python reconciliation script.
   - Found that local artifact state often diverges from issue labels; many issues were still only “panel-ready” by label even when local drafts or editor reviews already existed.
   - Produced a rough stage rollup from local artifacts/labels, but the first pass had malformed rows and had to be rerun with a cleaner parser.
   - Also noted that some issues could not be mapped cleanly to local dirs because article IDs/slugs and GitHub issue titles do not always match 1:1.

6. The user asked: “can pull the status from the db also?”
   - Inspected `content\pipeline.db` schema and queried `articles`, `article_panels`, `editor_reviews`, etc.
   - Found DB snapshot counts:
     - `stage=1 / proposed`: 33
     - `stage=3 / in_production`: 3 (`buf-2026-offseason`, `nyj-two-firsts-qb-decision`, `seahawks-rb-pick64-v2`)
     - `stage=4 / in_production`: 1 (`mia-tua-dead-cap-rebuild`)
     - `stage=panel_discussion / in_discussion`: 1 (`jsn-extension-preview`)
     - `stage=8 / published`: 2 (`seahawks-rb1a-target-board`, `witherspoon-extension-cap-vs-agent`)
   - Reported that the DB is useful but stale: e.g. `seahawks-rb-pick64-v2` is still `stage=3` in DB even though local files now include `draft.md` and `editor-review.md`.

7. The user then issued a `[[PLAN]]` research task: “We need to improve the article orchestration here as items keep getting stuck.”
   - Began a deep research workflow using `.squad` skills/charters/decisions plus runtime state (DB + artifacts + GitHub).
   - Created SQL todos for:
     - intended orchestration design research
     - runtime stuck-point research
     - writing the final research report
   - Gathered design evidence from:
     - `.squad/skills/article-lifecycle/SKILL.md`
     - `.squad/skills/article-discussion/SKILL.md`
     - `Lead`, `Writer`, and `Editor` charters
     - decisions on Ralph max throughput and board reconciliation
   - Gathered runtime evidence from:
     - `content\pipeline.db`
     - local drafts/editor reviews (`ARI`, `SEA v2`, `Witherspoon v2`, `LAR`, `SF`)
     - `ralph\prompt.md`
     - `.github\workflows\squad-heartbeat.yml`
     - DB helper scripts (`content\init_db.py`, `seed_ideas.py`, `set_discussion_path.py`, `update_jsn.py`)
   - Research was still in progress when compaction was requested. The final research report had not yet been written to the required path.
</history>

<work_done>
Files created or updated directly by coordinator:
- `C:\Users\jdl44\.copilot\session-state\31d18c5b-2dee-4d93-92c6-ff0c270557f7\plan.md`
  - Created for the initial Ralph/backlog work.
- `C:\github\nfl-eval\.squad\decisions\inbox\copilot-directive-20260316T074016Z.md`
  - Captured the user directive to maximize Ralph throughput.

Files produced by spawned agents during this session:
- `C:\github\nfl-eval\content\articles\seahawks-rb-pick64-v2\sea-position.md`
- `C:\github\nfl-eval\content\articles\seahawks-rb-pick64-v2\injury-position.md`
- `C:\github\nfl-eval\content\articles\seahawks-rb-pick64-v2\collegescout-position.md`
- `C:\github\nfl-eval\content\articles\seahawks-rb-pick64-v2\offense-position.md`
- `C:\github\nfl-eval\content\articles\seahawks-rb-pick64-v2\discussion-summary.md`
- `C:\github\nfl-eval\content\articles\seahawks-rb-pick64-v2\draft.md`
- `C:\github\nfl-eval\content\articles\seahawks-rb-pick64-v2\editor-review.md`
- `C:\github\nfl-eval\content\articles\lar-2026-offseason\draft.md`
- `C:\github\nfl-eval\content\articles\sf-2026-offseason\draft.md`
- `C:\github\nfl-eval\content\articles\ari-2026-offseason\editor-review.md`
- `C:\github\nfl-eval\content\articles\witherspoon-extension-v2\editor-review.md`
- `.squad` logging/decision/history artifacts were also updated by `Scribe`, including a commit (`7612b8d`) for `.squad` state.

Work completed:
- [x] Activated Ralph and reconciled squad/team root/current issue backlog
- [x] Advanced issue `#71` through panel, synthesis, draft, and first editor review
- [x] Researched and formalized a new maximum-throughput Ralph rule
- [x] Applied the new rule to launch parallel Writer/Editor lanes
- [x] Completed `LAR` and `SF` drafts
- [x] Completed first editor review passes for `ARI`, `SEA v2`, and `witherspoon-extension-v2`
- [x] Produced issue-stage summaries from GitHub labels/local artifacts
- [x] Pulled DB-backed article status from `content\pipeline.db`
- [ ] Finish the deep research report on orchestration improvements
- [ ] Save the research report to `C:\Users\jdl44\.copilot\session-state\31d18c5b-2dee-4d93-92c6-ff0c270557f7\research\we-need-to-improve-the-article-orchestration-here-.md`

Current article state highlights:
- `witherspoon-extension-v2`: Editor `✅ APPROVED`, pending image generation and publisher pass
- `seahawks-rb-pick64-v2`: Editor `🟡 REVISE`, must fix red error (Charbonnet surgery year) and re-review
- `ari-2026-offseason`: Editor `🟡 REVISE`, one factual error plus cleanup items
- `lar-2026-offseason`: draft complete, not yet editor-reviewed in this session
- `sf-2026-offseason`: draft complete, not yet editor-reviewed in this session

SQL todo state near compaction:
- Earlier todos around Ralph context, board scan, routing, synthesis, draft, DB summary were mostly marked done.
- Research todos active:
  - `research-design` — in progress
  - `research-runtime-state` — in progress
  - `write-research-report` — pending
</work_done>

<technical_details>
- **Core orchestration architecture**
  - The intended article pipeline is 8 stages: idea → discussion prompt → panel composition → panel discussion → draft → editor → publisher pass → publish (`.squad/skills/article-lifecycle/SKILL.md`).
  - `Lead` charter says article issues should run the full pipeline automatically, with comments posted at each meaningful step.
  - `Writer` is only responsible for draft assembly; `Editor` is mandatory and final on factual correctness.

- **Important mismatch: intended state vs actual state**
  - `article-lifecycle` skill says agents **must** update `content/pipeline.db` at every stage transition, insert `stage_transitions`, insert `editor_reviews`, etc.
  - In practice, DB updates are inconsistent or missing. Example: `seahawks-rb-pick64-v2` remained at DB `stage=3` / `in_production` even after local `draft.md` and `editor-review.md` existed.
  - DB fields are also inconsistent in type/semantics:
    - Most rows use numeric stages (`1`, `3`, `4`, `8`)
    - `jsn-extension-preview` uses string-like `current_stage='panel_discussion'`
  - `article_panels` counts in DB were often `0/0` even for local panel-complete articles.

- **Local artifacts are more truthful than labels/DB**
  - A proposed decision already states that Ralph board sweeps should prefer local article artifacts over stale `stage:*` labels.
  - This was validated during reconciliation: multiple issues were still “panel-ready” or similar by label while local files showed draft/editor progress.
  - The coordinator applied this local-first rule operationally even before formal merge into `decisions.md`.

- **Ralph throughput rule**
  - Prior successful pattern from history/decisions: run same-stage batches in parallel (e.g., 8 panel agents across two NFC West articles) with no quality degradation and major wall-time gains.
  - New live rule from user directive + Lead synthesis:
    - fan out all unblocked articles simultaneously
    - keep Writer/Editor lanes saturated while panels run
    - serialize only on true intra-article dependencies
  - This rule was written into `.squad/identity/now.md` and a Lead decision inbox file.

- **Heartbeat/automation limitation**
  - `.github/workflows/squad-heartbeat.yml` exists but cron is commented out/disabled.
  - The workflow currently reacts to issue/PR events and manual dispatch only, so unattended periodic Ralph sweeps are not active.
  - This is likely one reason items “keep getting stuck” when no human/session kicks the process forward.

- **Legacy Ralph prompt vs new Ralph behavior**
  - `ralph\prompt.md` still encodes “one article, one stage per iteration” behavior and “finish before starting,” which directly conflicts with the newer max-throughput rule.
  - The prompt also relies heavily on issue labels and a progress file, whereas current research suggests local artifacts are the more reliable source of truth.

- **DB helper scripts are ad hoc**
  - `content\init_db.py` seeds two pre-DB published articles.
  - `content\seed_ideas.py` bulk-seeds many proposed ideas.
  - `content\set_discussion_path.py` and `content\update_jsn.py` are one-off scripts for specific records.
  - I did not find a general runtime orchestrator that consistently updates DB rows as agents advance stages.

- **Editor review findings that matter operationally**
  - `witherspoon-extension-v2`: approved, but still needs image generation before publisher pass.
  - `seahawks-rb-pick64-v2`: revise; red error is surgery year (`2025` should be `2026`), inherited from source artifact; also missing cover image placeholder and some support text.
  - `ari-2026-offseason`: revise; one factual error (Trubisky draft position) plus cleanup/image tasks.
  - This creates a needed re-review loop, but no automatic orchestration was yet launched to perform those corrections during this session.

- **Substack/publisher dependency**
  - Stage 7 depends on `publish_to_substack`, which auto-detects `primary_team` from `content/pipeline.db` by matching `article_path`.
  - Because DB state drifts from files, stale/missing `article_path` and stage info can block or confuse publisher pass logic.

- **User preferences / directives discovered**
  - User explicitly directed: “Max out parallel throughput for Ralph across all issues right now. Do not use artificial caps; only block on real dependencies.”
  - User also asked for issue status from GitHub/labels/local artifacts and from the DB.

- **Environment notes**
  - Repo root: `C:\github\nfl-eval`
  - Windows paths are required
  - `gh` CLI is installed/authenticated
  - `content\pipeline.db` exists and is queryable via Python/SQLite
  - No internet via PowerShell tool, but GitHub MCP server was available and used for issue reads
</technical_details>

<important_files>
- `C:\Users\jdl44\.copilot\session-state\31d18c5b-2dee-4d93-92c6-ff0c270557f7\plan.md`
  - Session planning file created during Ralph activation.
  - Contains the initial backlog/board-scan/routing/logging plan.

- `C:\github\nfl-eval\.squad\team.md`
  - Defines the full squad roster, including `Lead`, all team agents, `Writer`, `Editor`, `Scribe`, and `Ralph`.
  - Important because Ralph behavior and available agents are derived from it.
  - Key sections: `## Members`, `## Project Context`.

- `C:\github\nfl-eval\.squad\routing.md`
  - Defines work routing rules, including `Ralph` as work monitor and article routing patterns.
  - Important for deciding which agents to launch for article tasks.

- `C:\github\nfl-eval\.squad\skills\article-lifecycle\SKILL.md`
  - Canonical design for the 8-stage article pipeline.
  - Critical lines/sections:
    - Lifecycle overview and stages: lines ~28–45
    - Stage 4–8 handoffs: ~257–484
    - DB write requirements: ~559–612
  - Key finding: says agents MUST update `pipeline.db` at each stage, but repo state suggests this is not enforced consistently.

- `C:\github\nfl-eval\.squad\skills\article-discussion\SKILL.md`
  - Defines how panels run and how synthesis should work.
  - Key lines: ~162–287 for panel execution and DB integration.
  - Important because it sets the parallel panel pattern and indicates stage updates that appear not to be reliably applied.

- `C:\github\nfl-eval\.squad\agents\lead\charter.md`
  - Defines the automated GitHub issue → article pipeline and required status comments.
  - Key section: ~50–132.
  - Important because it describes intended autonomous progression and issue-comment updates.

- `C:\github\nfl-eval\.squad\agents\writer\charter.md`
  - Defines draft structure requirements (TLDR, exactly 2 inline image placeholders, boilerplate, no cover image in markdown according to charter).
  - Key section viewed: ~58–138.
  - Important for understanding why drafts look the way they do and where handoff to Editor begins.

- `C:\github\nfl-eval\.squad\agents\editor\charter.md`
  - Defines review output format and the mandatory editor gate.
  - Key section viewed: ~45–145.
  - Important for the revise/reject loop and why certain articles are “stuck” after draft.

- `C:\github\nfl-eval\.squad\decisions.md`
  - Contains operational decisions and directives around batching, Ralph throughput, and board reconciliation.
  - Key sections:
    - ~730–750: approved parallel batch pattern for NFC West
    - ~1066–1069: user directive to maximize Ralph throughput
    - ~2855–2878: fastest parallel lane and proposed Ralph board reconciliation rule
  - Important because these decisions override the older serialized orchestration pattern.

- `C:\github\nfl-eval\.squad\identity\now.md`
  - Updated by `Lead` during this session to reflect “Maximum-throughput Ralph pipeline.”
  - Important current focus file for future spawns.

- `C:\github\nfl-eval\.github\workflows\squad-heartbeat.yml`
  - GitHub Actions heartbeat/triage workflow for Ralph.
  - Key lines: 1–8 show cron disabled; rest show issue/PR-based monitoring and simple routing.
  - Important because disabled cron likely contributes to work stalling between active sessions.

- `C:\github\nfl-eval\ralph\prompt.md`
  - Legacy/current Ralph loop prompt used by the external Ralph loop repo.
  - Key sections: iteration protocol, “advance exactly one stage,” “finish before starting,” and label-based stage detection.
  - Important because it conflicts with the newly adopted max-throughput rule and local-artifact-first reconciliation.

- `C:\github\nfl-eval\content\pipeline.db`
  - SQLite pipeline state database.
  - Tables: `articles`, `article_panels`, `discussion_prompts`, `editor_reviews`, `publisher_pass`, `stage_transitions`.
  - Important because it is supposed to be the canonical machine-readable state, but is currently stale/inconsistent.

- `C:\github\nfl-eval\content\init_db.py`
  - Initializes and seeds `pipeline.db`.
  - Important because it shows DB origins and seeded published records.

- `C:\github\nfl-eval\content\seed_ideas.py`
  - Bulk-seeds article idea rows into `pipeline.db`.
  - Important because many “proposed” DB rows come from this static seeding script, which helps explain why DB is full of stage-1 ideas.

- `C:\github\nfl-eval\content\set_discussion_path.py`
  - One-off helper that updates `discussion_path` for `jsn-extension-preview`.
  - Important evidence that DB maintenance is ad hoc rather than systemic.

- `C:\github\nfl-eval\content\update_jsn.py`
  - One-off helper script that updates the `jsn-extension-preview` row manually.
  - Important because it shows mixed stage typing (`discussion_prompt`) and manual status manipulation.

- `C:\github\nfl-eval\content\articles\seahawks-rb-pick64-v2\*`
  - Central session work product.
  - Important files:
    - `discussion-prompt.md`
    - `panel-composition.md`
    - `sea-position.md`, `injury-position.md`, `collegescout-position.md`, `offense-position.md`
    - `discussion-summary.md`
    - `draft.md`
    - `editor-review.md`
  - Represents the full pipeline progression from panel-ready through draft and first editor review.

- `C:\github\nfl-eval\content\articles\witherspoon-extension-v2\editor-review.md`
  - Approved review with zero red errors.
  - Important because it is one of the clearest examples of an article that should move forward but still needs publisher/image orchestration.

- `C:\github\nfl-eval\content\articles\ari-2026-offseason\editor-review.md`
  - Revise verdict with one factual error and cleanup/image tasks.
  - Important for understanding revise-loop requirements.

- `C:\github\nfl-eval\content\articles\lar-2026-offseason\draft.md`
- `C:\github\nfl-eval\content\articles\sf-2026-offseason\draft.md`
  - Newly created drafts from the max-throughput batch.
  - Important because they are ready for next-step Editor passes.
</important_files>

<next_steps>
Remaining work:
- Finish the deep research task on why article orchestration gets stuck.
- Write and save the required research report to:
  - `C:\Users\jdl44\.copilot\session-state\31d18c5b-2dee-4d93-92c6-ff0c270557f7\research\we-need-to-improve-the-article-orchestration-here-.md`
- Include citations and likely recommendations around:
  - DB/label/artifact source-of-truth conflicts
  - disabled heartbeat automation
  - serialized legacy Ralph prompt vs new max-throughput rule
  - missing automatic revise/re-review and publisher/image follow-through
  - lack of consistent DB stage writers

Immediate next steps that were in progress at compaction:
1. Finish reading/wrangling orchestration state writers:
   - `.github/workflows/squad-heartbeat.yml`
   - `ralph/prompt.md`
   - DB helper scripts
2. Synthesize a research answer covering:
   - intended architecture
   - actual bottlenecks / stuck states
   - recommended orchestration changes (likely local-artifact-first state reconciliation, stage transition automation, revise-loop automation, publisher handoff automation, and aligning Ralph prompt/workflows with throughput rule)
3. Save the report file in the session-state `research` folder.
4. After the report, likely operational next tasks (if continuing backlog work) would be:
   - launch fix/re-review lane for `seahawks-rb-pick64-v2`
   - launch fix/re-review lane for `ari-2026-offseason`
   - launch Editor passes for `lar-2026-offseason` and `sf-2026-offseason`
   - launch image generation + publisher pass for `witherspoon-extension-v2`

Potential blockers / open questions:
- The user requested a research report and forbade clarifying questions, so assumptions must be documented rather than asked.
- There is tension between `[[PLAN]]` mode instructions and the no-user-interaction research instructions; no `exit_plan_mode` or `ask_user` step was completed before compaction.
- The exact “source of truth” hierarchy for runtime orchestration is still under investigation, but current evidence strongly suggests local artifacts are the most accurate operational state, with DB/labels lagging behind.
</next_steps>