# Architecture Review: staging flow vs. intended Squad-driven MVP

## Bottom line

Yes: I think the **middle of the current pipeline should be reimplemented**, not incrementally patched.

No: I do **not** think the whole project should be scrapped.

The current system has a useful outer shell:

- dashboard job list / approval UX
- audit log
- SQLite job state
- sweep ingestion and scoring
- Substack publish integration
- article lifecycle gating

But the core product differentiator you described — **agents with charter + history arguing, producing discussion, then turning that into an article** — is **not actually wired into the runtime pipeline**. Right now the app mostly creates a queue record, then later creates a markdown brief that *references* the agent model. The actual discussion and article creation happen outside the app.

My recommendation is:

1. **Keep** the outer shell.
2. **Replace** the current `approved -> brief -> paste article` middle path with a real `idea -> discussion -> article -> review -> publish` flow.
3. For staging, build the **smallest prod-like version** around one explicit Squad discussion integration point, instead of trying to hide the current manual bridge behind more UI.

---

## What the current system actually is

### Runtime flow in code

Today the implemented runtime is:

1. Sweep reads `content/media-sweep.json`
2. Sweep scores transactions and creates SQLite jobs
3. BullMQ worker moves jobs `pending -> processing -> completed`
4. In production mode, worker **does not generate the article**
5. Human approves a completed job in dashboard
6. `POST /api/jobs/:id/write-article` generates a **brief file**
7. Human copies that brief into a separate Writer workflow
8. Human pastes finished article back through `POST /api/jobs/:id/store-article`
9. Job moves to `article_ready`
10. `POST /api/jobs/:id/publish` pushes to Substack

The key code proof:

- `scripts/job-processor.js` marks production jobs as completed with `pendingSquadArticle: true`; it does not run Writer/Editor.
- `src/content-brief.js` generates a static expert panel + question list; it does not spawn or coordinate agents.
- `dashboard/src/components/WriteArticle.jsx` explicitly describes the current app as a manual brief-copy / paste-back workflow.

### What that means product-wise

The app is currently:

- a **queue + approval + publish shell**
- with a **manual external writing bridge**
- not a true live multi-agent content system

That is why your mental model and the UI felt out of sync. You were expecting the core value engine to be inside the product; it currently is not.

---

## What is persisted in SQLite vs git / `.squad`

### SQLite / runtime state

SQLite (`.queue/jobs.db`) persists pipeline state through `src/db.js`:

- `jobs`
- `token_usage`
- `audit_log`
- `config`

This is the runtime job ledger. It is the source of truth for:

- job state
- approval/rejection
- article attachment
- publish metadata
- audit entries

### File-based runtime artifacts

These are runtime-ish artifacts stored in the repo filesystem:

- `content/processed-tx-ids.json` — sweep dedupe state
- `content/briefs/*.md` — generated writer briefs
- `content/articles/*.md` — article content files when manually created/saved outside the API flow

### `.squad` / long-lived team memory

The `.squad` tree stores long-lived agent context:

- `team.md` — roster of agents
- `routing.md` — intended routing rules
- `decisions.md` — shared decisions ledger
- `agents/*/charter.md` — role definitions
- `agents/*/history.md` — persistent agent memory / knowledge
- skills such as `.squad/skills/substack-article/SKILL.md`

This is where the **actual agent worldview** lives.

### The critical gap

The runtime app does **not** use `.squad` as an active execution substrate.

It only uses it indirectly / conceptually:

- `content-brief.js` copies routing ideas from the Substack skill into a local table
- docs refer to Writer/Editor flow
- job processor comments mention Squad

But the runtime does **not**:

- read agent histories as part of job execution
- spawn team/specialist agents
- capture expert outputs
- store disagreement transcripts
- run Editor as a blocking review stage

So the answer to your question is:

> SQL currently persists the runtime shell. Git / `.squad` persists the long-lived team intelligence. The important missing piece is that the runtime does not actually execute the `.squad` intelligence in the article pipeline.

---

## Is the current system preserving the important agent mechanic correctly?

Short answer: **no**.

### What the Squad design says

The Squad docs consistently describe:

- experts spawned in parallel
- disagreement encouraged
- Writer assembles from raw expert analysis
- Editor reviews before publish
- histories and decisions are meaningful context

Examples:

- `VISION.md` says the product is multi-agent disagreement
- `.squad/skills/substack-article/SKILL.md` says the process is experts -> Writer -> Editor
- Writer charter says Writer transforms raw expert analysis, not invents it
- Editor charter says Editor is mandatory before publish

### What the app actually runs

The app does not produce:

- raw expert outputs
- stored panel discussion
- stored disagreement artifacts
- editor report objects
- agent-by-agent provenance

Instead it produces:

- a generated brief with suggested experts/questions
- a job state transition
- a manual place to paste the final article

### My conclusion

The current implementation preserved the **language** of the original system, but not the **mechanism**.

That is the core architectural problem.

---

## Why “Run Sweep” felt wrong

This is partly a bug/UI issue I already fixed, but it also exposed a deeper product mismatch.

### What sweep currently does

Sweep is transaction ingestion plus significance scoring.

That is useful if your product is:

- “watch NFL moves”
- “auto-create candidate article jobs”

But your desired mental model is closer to:

- “generate story ideas”
- “let me edit/shape them”
- “then launch agent discussion”

Those are not the same thing.

### Current coupling problem

Right now the product conflates:

- signal ingestion
- story selection
- article initiation

That creates bad UX:

- a transaction may exist
- a brief may exist
- but the meaningful step you care about (“start the agents talking”) is missing

So even when sweep works technically, it still feels like “nothing happened.”

---

## Local using staging: how close to prod is it really?

### What is good

There is a reasonable local/prod shell:

- same backend app
- same dashboard app
- same Substack integration code
- same API routes
- `quickstart` / `quickstart -Prod` scripts
- production dashboard proxying through `/api`

### What is not actually prod-like

There are several important parity problems:

#### 1. Local uses checked-in fixture data, not live media ingest

The documented local flow uses `content/media-sweep.json`.

That is good for repeatable testing, but it is **not** the real intelligence flow.

#### 2. Production profile does not appear to durably externalize SQLite

In dev compose:

- `./.queue:/app/.queue` is mounted

In prod compose:

- `.queue` is copied into the image at build time
- no `.queue` volume is mounted

That means runtime DB state in `backend-prod` is container-local and can disappear on recreate/redeploy.

So the docs/history claim “SQLite committed to git / durable queue state” is not fully matched by the actual production container setup.

#### 3. GitHub Actions persistence story is partial

Docs say cron commits `.queue/jobs.db`.

The checked workflow currently commits:

- `content/processed-tx-ids.json`

It does **not** commit `.queue/jobs.db`.

So dedupe state is persisted via git automation, but the queue DB is not clearly persisted that same way in the implemented workflow.

#### 4. The actual article generation step is still external/manual

Even in the “prod-like” path, the most important step is not inside the runtime.

So local-with-staging is only prod-like for:

- sweep
- queue
- approval
- publish

It is **not** prod-like for the core content-generation stage.

### Staging recommendation

If the goal is “as close to prod as possible,” the right staging target is **not** the current manual brief-copy UX with nicer wording.

The right staging target is:

- same dashboard and API shell
- same Substack staging target
- real persisted job/discussion/article state
- one real discussion execution path that uses the Squad system

---

## Where the current product diverges from your desired flow

Your desired flow, restated:

1. AI generates potential story ideas
2. You can edit/refine them in dashboard
3. Kick off the discussion agents
4. Capture that output
5. Turn discussion into article
6. Editor review
7. Publish
8. Later: per-stage human vs automated review controls

The current flow does not support several of those steps:

### Missing: editable idea stage

There is no first-class “story idea” object in the dashboard/API.

Current first-class object is a **job** derived from transaction ingestion.

### Missing: discussion execution stage

There is no state like:

- `discussion_requested`
- `discussion_ready`
- `editor_review`

There is also no transcript payload, no expert-output payload, and no disagreement artifact.

### Missing: structured output capture

The system stores only:

- job data
- optional brief
- final article content

Not:

- panel transcript
- per-agent output
- editor report
- structured verdicts

### Missing: runtime use of history/charter as product inputs

Those files exist, but they are not first-class runtime dependencies in the app pipeline.

### Missing: review-mode controls

There is no per-stage policy like:

- human review
- auto-advance
- auto-review
- manual override

That can wait for later, but the lifecycle needs to be shaped around real stages first.

---

## What I would keep

I would keep these parts:

### 1. Dashboard shell

The dashboard already gives you:

- status visibility
- approval/reject actions
- publish action
- audit log

That is valuable and worth preserving.

### 2. SQLite + audit log

A simple local DB is fine for MVP/staging.

It is the right place to store:

- ideas
- discussion artifacts
- article drafts
- editor reports
- publish metadata

### 3. Sweep ingestion as one source of ideas

Do not delete sweep. Just demote it.

It should become:

- one feeder for candidate ideas
- not the controlling metaphor for the whole editorial product

### 4. Substack integration

The Substack client looks worth keeping. It is one of the more real end-to-end pieces in the codebase.

### 5. Approval and publish gates

Human approval and explicit state transitions are good. Keep them.

---

## What I would replace

I would replace the current **middle pipeline**:

### Replace this

`approved -> write-article (brief only) -> external writer chat -> paste article -> article_ready`

### With this

`idea_ready -> discussion_requested -> discussion_ready -> article_drafted -> editor_reviewed -> article_ready`

That is the correct shape for the product you described.

---

## Recommended MVP redesign for staging

This is the smallest version I think is honest, useful, and close to prod.

### New core object: Idea

Create a first-class editable `idea` record.

Suggested fields:

- `id`
- `source_type` (`sweep`, `manual`, `imported`)
- `title`
- `angle`
- `team`
- `topic_type`
- `transaction_payload` or `context_payload`
- `desired_agents`
- `status`
- `discussion_artifact`
- `article_artifact`
- `editor_report`
- `review_policy`

### Proposed state machine

- `idea_draft`
- `idea_ready`
- `discussion_requested`
- `discussion_ready`
- `article_drafted`
- `editor_reviewed`
- `article_ready`
- `published`
- `rejected`

### MVP UI

In dashboard:

1. **Ideas list**
   - show suggested ideas from sweep
   - allow manual idea creation

2. **Idea editor**
   - title
   - angle
   - source/context
   - agent panel selection/override

3. **Run Discussion**
   - explicit action
   - shows transcript/progress/status

4. **Generate Article**
   - from stored discussion output

5. **Editor Review**
   - show structured review report

6. **Publish**
   - same current publish concept

### MVP execution model

For staging, do **not** try to make BullMQ itself become the agent brain.

Instead:

#### Option A — recommended

Make one explicit “discussion runner” integration:

- backend stores idea payload
- backend calls a Squad execution endpoint / CLI bridge
- discussion result is persisted as transcript + per-agent summaries
- Writer stage then uses that persisted discussion, not a handwritten brief

This is closest to your current Copilot CLI reality.

#### Option B — acceptable temporary fallback

If direct execution is too much for the next step, make the manual step honest and structured:

- app generates a **discussion packet**, not a writer brief
- human runs Squad outside app
- human pastes back the transcript / structured outputs
- app then generates article from that stored discussion

That is still manual, but at least the manual artifact is the **discussion**, which is the real product input, not just a final pasted article.

### Why this is better

It preserves your product truth:

- the differentiated asset is the expert discussion
- the article is downstream of that, not the primary artifact

---

## Specific recommendation: keep the shell, scrap the middle

If I had to summarize the recommendation in one line:

> Keep the queue/dashboard/publish shell, but scrap the current brief-based middle and replace it with a first-class discussion pipeline.

That is the cleanest path to a working MVP that still resembles production.

---

## Concrete next build plan

### Phase 1: Make the data model honest

Add SQLite tables / JSON fields for:

- ideas
- discussion artifacts
- editor review artifacts
- stage policies

Do this before building more UI.

### Phase 2: Add idea editing in dashboard

This should support:

- sweep-generated candidates
- manual idea creation
- editing title/angle/context before discussion

### Phase 3: Add discussion stage

Minimal acceptable output:

- transcript markdown
- per-agent summary
- participating agents list
- timestamp / run metadata

### Phase 4: Generate article from discussion

Writer should consume stored discussion output, not raw transaction metadata alone.

### Phase 5: Add Editor artifact as a real stage

Store:

- errors
- suggestions
- notes
- verdict

Only then allow `article_ready`.

### Phase 6: Tighten staging/prod durability

Fix persistence inconsistencies:

- explicit durable DB volume/path in prod profile
- decide whether `.queue/jobs.db` is truly git-committed or purely runtime
- align docs/workflows with actual behavior

---

## Direct answers to your questions

### “Do we still need this?”

For the Audit Log page itself: **yes**, but only if it is showing meaningful stage artifacts.

The audit log is useful. The problem was not the page; it was that the system’s important steps were not represented clearly enough.

### “Run sweep does nothing”

Technically that was partly messaging/threshold/dedupe.

Architecturally, it also exposed that sweep is not the product step you care about most. It creates candidate jobs, not agent discussion.

### “I see the brief but I can’t generate the article”

Correct. That was not user confusion; it was an accurate read of the architecture.

The system was generating only the bridge artifact, not the actual article/discussion pipeline.

### “Do we need to scrap and reimplement?”

**Partially, yes.**

Not the entire repo.

But I do think the current middle pipeline should be treated as a temporary bridge and replaced with a real idea/discussion/article pipeline.

---

## Final recommendation

If the goal is a staging flow that is close to prod and centered on the actual product differentiator, I would choose this:

### Recommended MVP

- Sweep/manual entry creates **ideas**
- User edits idea in dashboard
- User runs **discussion**
- App stores transcript + agent outputs
- Writer creates article from stored discussion
- Editor reviews
- Human approves
- Publish to staging Substack

### What to stop investing in

- More polish on the current “generate brief then paste article back” path
- Treating transaction queue state as if it were the same thing as editorial workflow
- Describing the runtime as a live Squad pipeline when it is not

### What to invest in next

- first-class idea model
- first-class discussion artifact
- real Squad integration point
- honest staging durability

That gets you to an MVP that matches your mental model and uses the important agent/history system in a way that is actually visible in product behavior.
