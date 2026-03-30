# Research Report: Why Article Orchestration Gets Stuck

## Executive summary

The article pipeline is stalling because the repo currently has **three competing state systems** with no reliable reconciler:

1. **GitHub issue labels/comments**
2. **Local article artifacts under `content/articles/`**
3. **`content/pipeline.db`**

The intended design says Lead should run the full 8-stage lifecycle automatically, update `pipeline.db` at each stage, and keep GitHub comments current. In practice, the live system does not enforce those writes, the DB instructions are internally inconsistent, the GitHub automation only watches issue-label events, and Ralph's standalone loop prompt still instructs serialized one-stage-at-a-time work even though newer squad decisions say to saturate all unblocked lanes in parallel.

The result is predictable:

- articles can be **farther along locally than GitHub says**
- `pipeline.db` can be **stale or structurally inconsistent**
- approved or revise-stage articles **do not automatically trigger the next step**
- Ralph can make the wrong scheduling decision if it trusts labels or the old prompt

## Intended architecture

The canonical lifecycle is an 8-stage flow from idea through publish, with Stage 4 panel work explicitly parallelized and the DB treated as the machine-readable ledger of stage transitions. The Lead charter goes further: article issues should run the **full 8-stage pipeline automatically**, with comments at every meaningful step, a Substack draft URL at completion, and `pipeline.db` updated "as normal."  
Citations:
- `.squad/skills/article-lifecycle/SKILL.md:28-56`
- `.squad/skills/article-lifecycle/SKILL.md:257-322`
- `.squad/skills/article-lifecycle/SKILL.md:559-612`
- `.squad/skills/article-discussion/SKILL.md:162-187`
- `.squad/agents/lead/charter.md:50-132`

## What the live system is doing instead

### 1. Local artifacts are often ahead of both GitHub and the DB

The current snapshot shows open issue `#71` still labeled `stage:panel-ready`, while the local folder already contains `discussion-summary.md`, `draft.md`, and `editor-review.md`. Issue `#52` (JAX) is also labeled `stage:panel-ready`, but its local folder already has both `draft.md` and `editor-review.md`. Issue `#64` (GB) has no visible stage label in the snapshot, but its local folder already contains a `draft.md`.  
Citations:
- `research/orchestration-state-snapshot.md:17-18`
- `research/orchestration-state-snapshot.md:29-35`
- `research/orchestration-state-snapshot.md:66-72`

### 2. `pipeline.db` is not trustworthy as the runtime source of truth

The same snapshot shows `seahawks-rb-pick64-v2` in `pipeline.db` at `stage=3` / `status=in_production`, even though the local directory already has a draft and editor review. The snapshot also shows **no rows at all** in `editor_reviews`, despite multiple local `editor-review.md` files existing.  
Citations:
- `research/orchestration-state-snapshot.md:39-43`
- `research/orchestration-state-snapshot.md:60-62`
- `research/orchestration-state-snapshot.md:66-72`

### 3. GitHub automation is focused on labels and assignees, not pipeline state

The heartbeat workflow has its cron schedule disabled. Its checks look for untriaged issues, unassigned issues, missing `go:` labels, missing `release:` labels, missing `type:` labels, and open PRs. It does **not** scan `content/articles/` or `content/pipeline.db` to discover what is actually ready next.  
Citations:
- `.github/workflows/squad-heartbeat.yml:3-17`
- `.github/workflows/squad-heartbeat.yml:80-175`

### 4. Label automation does not manage article stage labels

The label sync workflow creates `article`, depth labels, and `article:draft-ready`, but it does not define or maintain the `stage:*` labels that Ralph's standalone loop prompt depends on for stage selection. That means the live stage labels are effectively unmanaged and prone to drift.  
Citations:
- `.github/workflows/sync-squad-labels.yml:94-101`
- `.github/workflows/sync-squad-labels.yml:137-177`
- `ralph/prompt.md:48-57`

## Root causes

### Root cause 1: Split-brain state model

The repo has no enforced single source of runtime truth.

- The schema defines `articles.current_stage` as an **INTEGER** and already includes `discussion_path`.  
- The lifecycle skill says agents **must** update the DB at every stage and insert transition records.  
- But the article-discussion skill still shows a write example that sets `current_stage = 'panel_discussion'` as a string and claims the `articles` table does **not yet** have a `discussion_path` field.  
- There are also manual repair scripts for JSN that update `current_stage` to a string value (`'discussion_prompt'`) and separately patch `discussion_path` after the fact.

That is not just stale data; it is **conflicting contract documentation**. Agents following different docs will write incompatible DB state, or skip DB writes because the contract is unclear.  
Citations:
- `content/schema.sql:10-29`
- `.squad/skills/article-lifecycle/SKILL.md:559-612`
- `.squad/skills/article-discussion/SKILL.md:256-274`
- `content/update_jsn.py:6-18`
- `content/set_discussion_path.py:3-14`

### Root cause 2: Ralph's control logic is still optimized for serialized work

The standalone Ralph loop prompt still says:

- pick the highest-priority single item
- advance it **exactly one pipeline stage**
- **finish before starting** another item

That directly conflicts with the newer operating mode in `.squad/identity/now.md` and the captured user directive in `decisions.md`, both of which say Ralph should advance **all unblocked articles simultaneously** and keep Writer/Editor lanes saturated.  
Citations:
- `ralph/prompt.md:11-15`
- `ralph/prompt.md:39-60`
- `ralph/prompt.md:117-127`
- `.squad/identity/now.md:8-16`
- `.squad/decisions.md:1066-1069`
- `.squad/decisions.md:2870-2881`

### Root cause 3: GitHub workflows only automate intake, not stage progression

The triage workflow routes article issues to Lead, and the assignment workflow posts assignment acknowledgements, but neither workflow actually drives or reconciles later pipeline stages. Combined with the disabled cron heartbeat, the system only gets nudged when an issue label changes, an issue closes, a PR closes, or a human manually dispatches the workflow.  
Citations:
- `.github/workflows/squad-triage.yml:147-159`
- `.github/workflows/squad-triage.yml:210-259`
- `.github/workflows/squad-issue-assign.yml:80-115`
- `.github/workflows/squad-heartbeat.yml:3-17`

### Root cause 4: Late-stage closure loops are manual

There is no reliable automation that says:

- if Editor returns `REVISE`, spawn the fix + re-review loop
- if Editor returns `APPROVED` but images are missing, run image generation
- if publisher pass is complete, write publish-ready state back to DB and GitHub
- if Joe publishes manually, reconcile the board to Stage 8

Current article evidence:

- `witherspoon-extension-v2` is `APPROVED`, but explicitly says the next step is image generation and then publisher pass.
- `seahawks-rb-pick64-v2` is `REVISE`, with a specific next action to fix the red error and resubmit.
- `ari-2026-offseason` is `REVISE`, with a defined required-before-publish checklist.
- `mia-tua-dead-cap-rebuild/publisher-pass.md` says Stage 7 is complete, but its own next steps still include manually updating `pipeline.db` and the GitHub issue label.

These are not ambiguous next actions; they are just not being picked up automatically.  
Citations:
- `content/articles/witherspoon-extension-v2/editor-review.md:91-95`
- `content/articles/seahawks-rb-pick64-v2/editor-review.md:147-165`
- `content/articles/ari-2026-offseason/editor-review.md:132-146`
- `content/articles/mia-tua-dead-cap-rebuild/publisher-pass.md:64-99`

### Root cause 5: Skill and policy conflicts create avoidable churn

The image policy is internally inconsistent:

- Writer charter: exactly **2 inline images**, **no cover/banner image**
- Publisher skill: **no cover image** in markdown; cover is manual in Substack
- Decisions file: inline-only default, no auto-generated cover images
- But `substack-article/SKILL.md` still says to generate **cover + inline** images and paste the cover image after the subtitle
- `image-generation/SKILL.md` still says best practice is to generate 2 cover images and use the best one in the article body

This conflict already surfaced operationally: the Seahawks v2 editor review flags "cover image placeholder missing" based on the old rule, even though newer policy says there should be no cover image in markdown.  
Citations:
- `.squad/agents/writer/charter.md:34-49`
- `.squad/skills/publisher/SKILL.md:47-58`
- `.squad/decisions.md:633-649`
- `.squad/skills/substack-article/SKILL.md:159-181`
- `.squad/skills/image-generation/SKILL.md:184-191`
- `content/articles/seahawks-rb-pick64-v2/editor-review.md:65-78`

### Root cause 6: The publisher tool reads DB metadata but does not close the loop

The Substack publisher extension uses `pipeline.db` only to look up the primary team from `article_path`. I did not find corresponding DB stage-transition logic in the extension, and the MIA publisher-pass file explicitly documents the remaining DB and label updates as manual after the publish step.  
Citations:
- `.github/extensions/substack-publisher/extension.mjs:41-61`
- `content/articles/mia-tua-dead-cap-rebuild/publisher-pass.md:93-99`

### Root cause 7: The DB is being seeded and patched ad hoc, not maintained through a shared runtime helper

The repo includes bulk seeding (`seed_ideas.py`) and one-off patch scripts (`update_jsn.py`, `set_discussion_path.py`), but I did not find a shared, enforced runtime helper that every stage uses for:

- stage transitions
- artifact path updates
- editor review writes
- publisher pass writes
- publish completion writes

That strongly increases the chance of drift because every stage or one-off fix can write state differently.  
Citations:
- `content/seed_ideas.py:1-27`
- `content/update_jsn.py:6-18`
- `content/set_discussion_path.py:3-14`
- `.squad/skills/article-lifecycle/SKILL.md:583-598`

## Recommended changes

### Priority 1: Make stage discovery artifact-first

Ralph should compute the next action from **local artifacts first**, then reconcile DB and GitHub to match.

Recommended precedence during a sweep:

1. **Published proof**: `published_at`, `substack_url`, explicit publish artifact/comment
2. **Publisher pass artifact**: `publisher-pass.md`
3. **Editor review artifact**: `editor-review.md` with parsed verdict
4. **Draft artifact**: `draft.md`
5. **Discussion summary / panel outputs**
6. **Discussion prompt / panel composition**
7. **Only then** fall back to DB or issue labels when no local artifacts exist

This matches the repo's own observed reality: the filesystem is often ahead of GitHub labels and the DB. It also aligns with the proposed Ralph reconciliation rule already captured in `decisions.md`.  
Citations:
- `research/orchestration-state-snapshot.md:66-72`
- `.squad/decisions.md:2870-2881`

### Priority 2: Introduce one shared pipeline-state writer

Create a single Python helper/module for all stage writes, e.g. `content/pipeline_state.py`, and make every orchestrated stage call it instead of embedding ad hoc SQL snippets in skills or scripts.

That helper should:

- validate that `current_stage` is always numeric `1-8`
- write `stage_transitions`
- update artifact paths (`discussion_path`, `article_path`)
- record `editor_reviews`
- record `publisher_pass`
- write `published_at` / `substack_url`
- refuse incompatible writes with clear errors

This is the most important structural fix for DB reliability.  
Citations:
- `content/schema.sql:10-29`
- `.squad/skills/article-lifecycle/SKILL.md:570-598`
- `.squad/skills/article-discussion/SKILL.md:256-274`
- `content/update_jsn.py:6-18`

### Priority 3: Rewrite Ralph's operational prompt to match current policy

`ralph/prompt.md` should stop using "one stage per iteration" and label-only selection. It should instead:

- sweep **all** article issues and `content/articles/*`
- derive each article's true current stage from artifacts
- enqueue every **unblocked** next action
- batch same-stage work in parallel
- prefer keeping Writer and Editor saturated
- serialize only on intra-article dependencies

This change is directly required by the current operating mode already documented elsewhere.  
Citations:
- `ralph/prompt.md:31-60`
- `ralph/prompt.md:117-127`
- `.squad/identity/now.md:8-16`
- `.squad/decisions.md:1066-1069`

### Priority 4: Re-enable unattended sweeps, but teach heartbeat to read real state

Re-enable the heartbeat cron only after its logic is upgraded. A useful sweep should:

- scan article directories
- parse editor verdicts
- query `pipeline.db`
- compare those to issue labels/comments
- post reconciliation comments when drift exists
- trigger the next ready lane, not just label hygiene

As currently written, the heartbeat is too intake-oriented to unstick in-flight articles.  
Citations:
- `.github/workflows/squad-heartbeat.yml:3-17`
- `.github/workflows/squad-heartbeat.yml:80-175`

### Priority 5: Add explicit closure automations for late stages

Add deterministic follow-through rules:

- `REVISE` -> open a revision lane and schedule re-review
- `APPROVED` + missing images -> run image generation
- images complete -> run publisher pass
- manual publish confirmed -> write DB + GitHub stage reconciliation

This is the missing operational glue between "the work exists on disk" and "the system knows it moved forward."  
Citations:
- `content/articles/witherspoon-extension-v2/editor-review.md:91-95`
- `content/articles/seahawks-rb-pick64-v2/editor-review.md:149-165`
- `content/articles/ari-2026-offseason/editor-review.md:132-146`
- `content/articles/mia-tua-dead-cap-rebuild/publisher-pass.md:93-99`

### Priority 6: Clean up contradictory skill guidance

Before more automation is layered on top, align the instructions:

- `article-discussion` must match the actual DB schema
- `substack-article`, `image-generation`, Writer, Publisher, and Editor must all agree on the current image policy
- GitHub workflow docs should clarify whether `stage:*` labels are control-plane inputs or just human-facing mirrors

Right now the system has conflicting "source of truth" docs, which makes both humans and agents less reliable.  
Citations:
- `content/schema.sql:17-19`
- `.squad/skills/article-discussion/SKILL.md:256-274`
- `.squad/agents/writer/charter.md:34-49`
- `.squad/skills/publisher/SKILL.md:47-58`
- `.squad/skills/substack-article/SKILL.md:159-181`
- `.squad/skills/image-generation/SKILL.md:184-191`

### Priority 7: Treat GitHub as the visibility layer, not the scheduler

After Ralph computes true stage from artifacts, it should update GitHub to reflect reality:

- post reconciliation comments
- remove clearly stale stage labels
- add a correct next-step label or comment
- close the issue only when publish proof exists

This preserves GitHub as the human-readable board without making it the fragile runtime controller.  
Citations:
- `.squad/decisions.md:2875-2881`
- `.github/workflows/squad-triage.yml:147-159`
- `ralph/prompt.md:48-57`

## Suggested implementation sequence

1. **Fix the contracts first**
   - align DB stage typing + path field guidance
   - resolve image-policy contradictions
   - rewrite `ralph/prompt.md` to match max-throughput policy

2. **Build the shared state helper**
   - one helper for all DB writes
   - one parser for artifact-derived stage / next action

3. **Upgrade Ralph sweep logic**
   - artifact-first reconciliation
   - batch all unblocked work
   - keep Writer/Editor lanes full

4. **Upgrade automation**
   - rework heartbeat around actual pipeline state
   - then re-enable cron

5. **Add late-stage closure loops**
   - revise -> fix -> re-review
   - approved -> images -> publisher
   - manual publish -> DB/GitHub reconciliation

## Bottom line

The pipeline is not getting stuck because the repo lacks stages; it is getting stuck because the orchestration layer does not have a single reliable state model and does not automatically close the late-stage loops.

If I had to pick the three highest-leverage fixes, they would be:

1. **artifact-first stage reconciliation**
2. **one shared DB state writer**
3. **rewrite Ralph + heartbeat around max-parallel next-action scheduling**

Those three changes would eliminate most duplicate work, surface the real ready queue, and keep articles moving without needing a human to notice every stalled handoff.
