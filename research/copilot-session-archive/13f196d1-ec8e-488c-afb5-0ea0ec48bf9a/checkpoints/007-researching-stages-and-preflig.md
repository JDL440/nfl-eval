<overview>
The user asked for two things in this segment: first, a deep research pass on the article page’s confusing/out-of-sync stage numbers and mobile UX; second, diagnosis of a new live writer-preflight failure (`Because San Francisco`) and an explanation of how to make that validation step smarter. I handled both by using Squad-style parallel analysis: Lead for simplification strategy, UX for mobile/product critique, and Code for implementation/data-flow tracing, while keeping the current dirty checkout read-only and saving the research artifact into the session workspace.
</overview>

<history>
1. The user asked for deep research on the article page stage-number confusion and mobile UX.
   - I treated this as a conceptual + technical UX deep-dive and launched three parallel agents:
     - Lead to simplify the stage/status model
     - UX to audit the article page for mobile and hierarchy issues
     - Code to trace where stage-related values are rendered and why they drift
   - In parallel, I inspected the real implementation directly in:
     - `src/dashboard/views/article.ts`
     - `src/dashboard/server.ts`
     - `src/dashboard/public/styles.css`
     - `src/types.ts`
     - related dashboard tests
   - I identified that the article page currently mixes multiple different “stage” concepts:
     - canonical `article.current_stage`
     - `StageTransition[]` history/timestamps
     - `StageRun[]` execution records
     - live SSE banner/event payloads
     - revision loop history
   - I confirmed the main concrete mismatch: the Stage Runs panel rewrites `StageRun.stage` into `targetStage = stage + 1`, so failed Stage 5 attempts can display as “Stage 6,” which conflicts with the page header/timeline/action panel.
   - I also confirmed the page structure on mobile: the main column renders Actions, then Revision History, then Images/Artifacts, while the sidebar still appends Token Usage, Stage Runs, and Advanced below on small screens, producing a dense low-hierarchy stack.
   - I saved the full research report to:
     `C:\Users\jdl44\.copilot\session-state\13f196d1-ec8e-488c-afb5-0ea0ec48bf9a\research\the-stage-numbers-on-the-article-page-are-still-co.md`
   - I summarized the result to the user:
     - keep the top stage badge + timeline + action panel as the primary workflow UI
     - demote Stage Runs into Advanced/diagnostics
     - collapse Revision History by default
     - reduce revision visual prominence
     - make the live banner activity-oriented instead of a competing stage authority

2. The user then reported a new live article failure:
   - `Writer draft failed validation after self-heal: Draft uses "Because San Francisco", but supplied artifacts support "San Francisco".`
   - They asked: “How can we make this step smarter?”
   - I first checked the current repo state and found the main checkout is dirty in many pipeline/dashboard files, including:
     - `src/pipeline/actions.ts`
     - `src/pipeline/writer-preflight.ts`
     - `src/pipeline/writer-support.ts`
     - dashboard view/CSS files
     - tests
     - multiple untracked/dirty worktrees
   - Because of that, I explicitly stayed read-only in this checkout and did not attempt code changes from `C:\github\nfl-eval`.
   - I launched two parallel agents:
     - Code to trace exactly why the current checkout can still produce the `Because San Francisco` failure, and compare it against the validated worktrees
     - Lead to recommend the smallest “smarter preflight” strategy without weakening real enforcement
   - In parallel, I directly compared the active checkout’s `writer-preflight.ts` and `writer-support.ts` against the validated worktree versions.
   - I found that the current active checkout still has the narrower `BANNED_FIRST_TOKENS` list in both:
     - `src/pipeline/writer-preflight.ts`
     - `src/pipeline/writer-support.ts`
     and **does not include `Because`** there.
   - I also verified that the older validated `worktrees\writer-contract-precision-fix\src\pipeline\writer-preflight.ts` does include `Because` and many other sentence-openers in `BANNED_FIRST_TOKENS`.
   - Code confirmed the exact diagnosis:
     - current `main`/active checkout can still false-positive on `Because San Francisco`
     - `worktrees\writer-contract-precision-fix` solves it
     - `worktrees\writer-support-artifact-fix` does not solve this specific opener-family issue
   - Lead recommended the smallest smarter strategy:
     - primary fix: broaden opener filtering (`Because`, `If`, `When`, `While`, etc.)
     - secondary improvement: prefer canonical names from `writer-support.md` when available before relying on noisier raw extraction
     - do not solve this mainly with softer copy/prompts; treat prompt guidance as secondary
   - I summarized this to the user as:
     - this is likely another sentence-opener false positive, not a real evidence mismatch
     - active checkout lacks `Because` in the banned token filters
     - the validated hardening worktree already shows the right direction
</history>

<work_done>
Files created/updated outside the repo:
- `C:\Users\jdl44\.copilot\session-state\13f196d1-ec8e-488c-afb5-0ea0ec48bf9a\research\the-stage-numbers-on-the-article-page-are-still-co.md`
  - Full research report on article page stage-number confusion, simplification recommendations, and mobile UX recommendations.

Files inspected heavily (read-only, no edits made in this segment):
- `C:\github\nfl-eval\src\dashboard\views\article.ts`
- `C:\github\nfl-eval\src\dashboard\server.ts`
- `C:\github\nfl-eval\src\dashboard\public\styles.css`
- `C:\github\nfl-eval\src\types.ts`
- `C:\github\nfl-eval\src\db\repository.ts`
- `C:\github\nfl-eval\src\pipeline\writer-preflight.ts`
- `C:\github\nfl-eval\src\pipeline\writer-support.ts`
- `C:\github\nfl-eval\tests\pipeline\writer-preflight.test.ts`
- `C:\github\nfl-eval\worktrees\writer-contract-precision-fix\src\pipeline\writer-preflight.ts`
- `C:\github\nfl-eval\worktrees\writer-support-artifact-fix\src\pipeline\writer-preflight.ts`
- `C:\github\nfl-eval\worktrees\writer-support-artifact-fix\src\pipeline\writer-support.ts`

Work completed:
- [x] Researched article-page stage/status inconsistency and mobile UX
- [x] Saved a full research report for the article-page problem
- [x] Diagnosed the `Because San Francisco` live failure as a sentence-opener false positive
- [x] Compared active checkout vs validated worktree logic for opener filtering
- [x] Produced a concrete “smarter validation step” recommendation
- [ ] No code was changed in this segment
- [ ] No merge/cherry-pick/integration work was performed in the dirty main checkout

Current state:
- The article page research is complete and saved.
- The `Because San Francisco` diagnosis is complete enough to act on.
- The current checkout is dirty across many pipeline/dashboard files, so any implementation should happen in a clean worktree or after an explicit user instruction about working in the current tree.
</work_done>

<technical_details>
- The article page currently conflates multiple distinct concepts:
  - `article.current_stage` = canonical pipeline position
  - `StageTransition[]` = audit trail / timestamps
  - `StageRun[]` = execution attempt records
  - SSE/live banner event payloads = transient current activity
  - revision summaries + conversation turns = historical loop diagnostics
- The top stage badge and the stage timeline are the cleanest canonical sources on the article page:
  - the badge uses `article.current_stage` and `STAGE_NAMES`
  - the timeline uses `article.current_stage` for completed/current/future and `transitions` only for timestamps/tooltips
- The main source of stage-number confusion is the Stage Runs panel:
  - `renderStageRunsPanel()` computes `targetStage = Math.min(r.stage + 1, 8)` and renders that, rather than the stored run stage
  - tests currently lock this behavior in by expecting a Stage 5 run to show as Stage 6
  - this makes failed runs look like forward progress
- The live banner (`pipeline-activity`) is SSE/event-driven and can diverge temporarily from the rest of the page:
  - it updates instantly from `stage_working`, `stage_error`, `stage_changed`, `pipeline_complete`
  - the rest of the page updates via HTMX partials and final reload timing
  - that timing split can make the banner “feel wrong” even when the DB state is fine
- Revision History is historical, not current-state UI:
  - built from `revision_summaries` plus matched writer/editor conversation turns
  - currently sits too high in the page hierarchy, especially on mobile
  - uses `review-card` visual styling that makes it feel urgent/prominent
- Mobile article-page behavior:
  - `detail-grid` collapses to one column under media queries
  - the page still shows a long sequence of dense sections
  - sidebar diagnostics are not meaningfully simplified for mobile
  - send-back uses `position: absolute` dropdown UI, which is risky on narrow screens
- For the new writer-preflight failure:
  - the active checkout’s `src/pipeline/writer-preflight.ts` has a narrow `BANNED_FIRST_TOKENS` set and does **not** include `Because`
  - `src/pipeline/writer-support.ts` has a separate copy of the same idea and also does **not** include `Because`
  - `extractSupportedNames()` in active `writer-preflight.ts` therefore can still interpret `Because San Francisco` as a name candidate
- The validated older worktree (`worktrees\writer-contract-precision-fix`) contains the broader opener filtering:
  - includes `Because`, `If`, `With`, `Once`, `When`, `While`, `Although`, `Though`, `But`, `And`, `Or`, `So`, `Yet`, `After`, `Before`, `Since`, etc.
- Important subtlety:
  - `writer-support-artifact-fix` added structured support/allowlist logic, but by itself it does **not** solve this exact opener-family false positive
  - the safer smarter direction is layered:
    1. prefer `writer-support.md` canonical names when present
    2. maintain a broader sentence-opener filter in both `writer-preflight.ts` and `writer-support.ts`
- Recommended smarter-step strategy from Lead:
  - solve primarily with opener filtering + structured support prioritization
  - do **not** rely mainly on softer rewrite/self-heal prompts
  - keep real name-consistency enforcement intact
- Dirty repo state matters:
  - `git status` showed many modified pipeline/dashboard files and multiple dirty/untracked worktrees
  - I explicitly did not apply changes in the shared checkout because that would risk colliding with unrelated in-progress work
- SQL/todo state at the end of this segment:
  - no new SQL todos were created for this segment
  - pre-existing in-progress todos remained:
    - `mobile-dashboard-ux-impl`
    - `mobile-dashboard-code-tests`
  - previous stall-fix todos were already marked done before this segment
</technical_details>

<important_files>
- `C:\Users\jdl44\.copilot\session-state\13f196d1-ec8e-488c-afb5-0ea0ec48bf9a\research\the-stage-numbers-on-the-article-page-are-still-co.md`
  - Why it matters: full saved research artifact for the article page stage/UX problem
  - Changes made: created and saved in this segment
  - Key sections: Executive Summary, Architecture/System Overview, simplification recommendations, mobile-first layout model

- `C:\github\nfl-eval\src\dashboard\views\article.ts`
  - Why it matters: central view file for article detail page
  - Changes made in this segment: none (read-only)
  - Key sections:
    - meta badge / page assembly: ~87-216
    - pipeline activity banner + SSE text updates: ~225-290
    - stage timeline: ~310-336
    - revision history rendering: ~471-502
    - action panel / retry / send-back / last-run error: ~542-725
    - stage runs panel: ~1202-1235

- `C:\github\nfl-eval\src\dashboard\server.ts`
  - Why it matters: assembles article page data and defines HTMX live partial endpoints
  - Changes made in this segment: none
  - Key sections:
    - `/articles/:id` route and assembly of `flashMessage`, `errorMessage`, `autoAdvanceActive`, `revisionHistory`, `stageRuns`: ~734-782
    - `/htmx/articles/:id/live-header` and `/live-sidebar`: ~1596-1625

- `C:\github\nfl-eval\src\dashboard\public\styles.css`
  - Why it matters: visual hierarchy, stage timeline, revision cards, mobile behavior
  - Changes made in this segment: none
  - Key sections:
    - article detail layout: ~463-505
    - action/guard UI: ~568-595
    - review-card and send-back dropdown styling: ~1379-1523
    - pipeline-activity banner: ~1974-2004
    - mobile detail-grid / article layout reordering: ~2410-2449

- `C:\github\nfl-eval\src\types.ts`
  - Why it matters: shared definitions of `VALID_STAGES`, `STAGE_NAMES`, `Article`, `StageTransition`, `StageRun`
  - Changes made in this segment: none
  - Key sections:
    - stage constants and names: ~1-18
    - article/stage transition types: ~31-62
    - `StageRun` shape: ~235-251

- `C:\github\nfl-eval\src\db\repository.ts`
  - Why it matters: confirms how stage runs are stored and retrieved
  - Changes made in this segment: none
  - Key sections:
    - `getStageRuns(articleId)`: ~240-245
    - `startStageRun(...)`: ~539-599
    - `finishStageRun(...)`: ~601-614

- `C:\github\nfl-eval\src\pipeline\writer-preflight.ts`
  - Why it matters: active checkout’s name-consistency and preflight logic
  - Changes made in this segment: none
  - Key sections:
    - `BANNED_FIRST_TOKENS` (missing `Because`): ~72-76
    - main name consistency logic: ~180-229
    - `extractSupportedNames()` current logic: ~413-438
    - imports show active checkout already has `writer-support` integration: ~1-6

- `C:\github\nfl-eval\src\pipeline\writer-support.ts`
  - Why it matters: active checkout’s structured support artifact generation and its own parallel banned-token list
  - Changes made in this segment: none
  - Key sections:
    - `BANNED_FIRST_TOKENS` also missing `Because`: ~62-66
    - support artifact generation starts around ~78 onward

- `C:\github\nfl-eval\worktrees\writer-contract-precision-fix\src\pipeline\writer-preflight.ts`
  - Why it matters: validated older hardening worktree that already includes broader opener filtering
  - Changes made in this segment: none
  - Key sections:
    - stronger `NAME_TOKEN_PATTERN`: ~35-36
    - expanded `BANNED_FIRST_TOKENS` including `Because`: ~74-82
    - broader `BANNED_LAST_TOKENS` improvements: ~84-90

- `C:\github\nfl-eval\tests\pipeline\writer-preflight.test.ts`
  - Why it matters: active preflight regression coverage
  - Changes made in this segment: none
  - Key sections:
    - existing exact-name and code-span tests: ~15-73
    - writer-support canonical-name test: ~152-184
    - exact claims allowed/caution test: ~186 onward
  - Important note: there is currently no focused regression for `Because San Francisco` / sentence-opener family in the active test file
</important_files>

<next_steps>
Immediate pending work:
1. Decide whether to implement the `Because San Francisco` fix in a clean worktree or in the current dirty checkout.
   - Current checkout is not safe for blind edits because many relevant files are already modified/untracked.
   - Safest path is a clean worktree for a focused preflight/name-filter patch.

2. Implement the smallest code-level fix:
   - Add broader sentence-opener tokens (at minimum `Because`) to `BANNED_FIRST_TOKENS` in:
     - `src\pipeline\writer-preflight.ts`
     - `src\pipeline\writer-support.ts`
   - Prefer `writer-support.md` canonical names as primary authority when available before falling back to noisier raw extraction (if not already sufficiently prioritized in the intended implementation branch).

3. Add focused tests for this failure family:
   - exact regression for:
     - `Because San Francisco`
   - small family test for similar openers such as:
     - `If`, `When`, `While`, `Although`, `After`, `Before`, `Since`

4. Validate the fix with focused tests/build and, ideally, a runtime-style reproduction against the live failing article.

5. If the user wants to continue on the article-page UX side:
   - convert the research recommendations into an implementation plan or code changes
   - likely start with:
     - demoting Stage Runs
     - collapsing Revision History
     - simplifying the live banner copy
     - adjusting mobile hierarchy/order

6. Optionally update `plan.md` to add a short new subsection for this new sentence-opener false-positive family, since the reminder explicitly flagged plan maintenance and this issue is a natural extension of the stall-reduction work.

Blockers / cautions:
- Dirty main checkout is the major implementation blocker.
- The new failure appears to be a real missing local filter, not just stale runtime data.
- `writer-contract-precision-fix` appears to contain the relevant opener-filter direction, but that worktree must be compared/merged carefully with the newer `writer-support` changes to avoid regression or partial backslide.
</next_steps>