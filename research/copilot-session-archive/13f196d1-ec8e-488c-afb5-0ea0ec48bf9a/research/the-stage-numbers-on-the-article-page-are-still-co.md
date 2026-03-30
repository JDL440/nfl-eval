# Article Page Stage UX Research

## Executive Summary

The article page currently mixes at least four different notions of “stage” in one view: the article's canonical `current_stage`, historical `stage_transitions`, execution-oriented `stage_runs`, and transient SSE/live-banner event payloads.[^1][^2][^3][^4] The underlying data is internally consistent, but the UI presents those sources as if they all describe the same thing, which is why the page feels out of sync and hard to scan.[^1][^2][^3][^4]

The biggest concrete mismatch is the Stage Runs panel: it renders each run as `Stage N+1`, even though the stored `stage_runs.stage` value is the stage being executed, not a guaranteed advancement target.[^5][^6] That means a failed Stage 5 run can visually read as “Stage 6,” while the page header, timeline, and action panel still show the article at Stage 5.[^1][^5][^6]

The simplest fix is not to add more explanation. It is to establish one primary stage model on the article page — “where the article is now” — and demote everything else to secondary or advanced diagnostic surfaces.[^1][^2][^3] In practice, that means keeping the top stage badge, stage timeline, and action state as the primary workflow UI; collapsing or demoting revisions; and moving Stage Runs into Advanced or another diagnostic surface altogether.[^1][^2][^7]

From a mobile perspective, the current page still behaves like a desktop detail page compressed into one column: the main column shows Actions, then a large Revision History block, while the sidebar still injects Token Usage, Stage Runs, and Advanced details below, creating a dense, low-hierarchy scroll stack.[^1][^7][^8] The revisions panel is especially over-prominent because it sits above artifacts and uses colored review-card styling that reads as urgent state rather than optional history.[^1][^8]

## Query Type

This is a conceptual + technical UX deep-dive: the user asked why the stage numbers do not match, what should be simplified, and how the article page should work better on mobile. The answer therefore focuses on implementation seams, information architecture, and concrete UI simplification recommendations rather than process steps.

## Architecture / System Overview

```text
Article detail page
│
├─ Top metadata badge
│  └─ article.current_stage + STAGE_NAMES[current_stage]
│
├─ Stage timeline circles
│  ├─ current_stage decides completed/current/future
│  └─ stage_transitions provide timestamps/tooltips
│
├─ Live pipeline banner
│  ├─ initial render: article.current_stage + autoAdvanceActive
│  └─ SSE events mutate text live (working / changed / complete / error)
│
├─ Action panel
│  ├─ article.current_stage
│  ├─ article.status
│  ├─ canAdvance() guard
│  └─ latest stage_run.notes shown inline as “Last run …”
│
├─ Revision history
│  ├─ revision_summaries
│  └─ matched writer/editor conversation turns
│
└─ Sidebar diagnostics
   ├─ usage_events
   ├─ stage_runs
   └─ advanced audit log / pinned agents / transitions
```

The page is assembled server-side in one route, then partially refreshed through HTMX/SSE live fragments. The full detail route passes `article`, `transitions`, `reviews`, `revisionHistory`, `usageEvents`, `stageRuns`, flash/error state, and `autoAdvanceActive` into `renderArticleDetail()`, while `/htmx/articles/:id/live-header` and `/htmx/articles/:id/live-sidebar` re-render header/timeline and sidebar sections independently after stage-related events.[^3][^4]

## Where Each Stage Representation Comes From

### 1. Top stage badge: canonical article stage

The top metadata area renders a stage badge directly from `article.current_stage` and the shared `STAGE_NAMES` map, e.g. `Stage 5 · Article Drafting`.[^1][^9] This is the simplest and most reliable representation on the page because it reflects the canonical article record, not a historical or transient event stream.[^1][^9]

### 2. Stage timeline circles: canonical stage + historical transitions

The stage circles also key off `article.current_stage`, but they decorate that primary state with transition timestamps from `StageTransition[]`.[^2][^9] Each stage dot becomes `completed`, `current`, or `future` by comparing the stage number to `current_stage`, while tooltips and small timestamps come from `transitions.to_stage -> transitioned_at`.[^2]

This means the timeline is not a diagnostic run log. It is a progression map of where the article has been and where it is now.[^2]

### 3. Live update banner: transient event text

The live banner (`pipeline-activity`) initially renders from `article.current_stage` and `autoAdvanceActive`, but once SSE events arrive it rewrites its own text based on event payloads like `stage_working`, `stage_error`, `stage_changed`, and `pipeline_complete`.[^2][^3] The event handlers set messages such as:

- `Pipeline working… Stage X — {stageName}`
- `❌ Stage X failed: …`
- `✅ Advanced to Stage Y`
- `✅ Pipeline complete — Stage Y — {stageName}`[^2]

Because this banner is driven by event payloads rather than the rendered article object, it can temporarily disagree with the rest of the page until the HTMX partial refreshes or the full page reload lands.[^2][^3][^4]

### 4. Action panel: current stage + workflow/status rules

The action panel is also keyed off `article.current_stage`, but it layers on `article.status`, guard checks, and publish/review rules.[^1] For example, Stage 6 plus `needs_lead_review` renders a paused lead-review state, Stage 7 swaps in publish controls, and other stages render “Advance ▶ Stage N+1” plus Retry Auto-Advance.[^1]

The action panel therefore answers a different question than the timeline: not “where are we?” but “what can I do next?”[^1]

### 5. Stage Runs: execution records, not article state

The Stage Runs panel renders `repo.getStageRuns(id)` sorted by `started_at DESC`.[^4][^5] A `StageRun` stores `stage`, `status`, actor/model info, notes, and timestamps.[^10] However, the view deliberately computes `targetStage = Math.min(r.stage + 1, 8)` and renders the badge as `Stage {targetStage} — {targetName}`.[^6]

That transformation is the main stage-number mismatch on the page. It converts an execution record into a future-facing label and makes the runs list read like a second stage-progress UI rather than what it really is: an execution/debug history.[^5][^6]

The tests explicitly lock in that behavior today by expecting a Stage 5 run to render as `Stage 6`.[^11]

### 6. Revision history: historical loop metadata

Revision History is not based on the current stage at all. It is built from revision summaries plus matched writer/editor conversation turns, then rendered as iterations with `from_stage → to_stage`, feedback summaries, blocker metadata, and excerpts from the writer/editor turns that formed each loop.[^1][^12][^13]

This makes revisions useful as forensic context, but they are historical loop records, not a primary indicator of where the article is now.[^1][^12][^13]

## Why The Page Feels Out of Sync

### A. The page answers multiple stage questions at once

Today the article page asks the user to interpret all of these simultaneously:

- What stage is the article currently in?
- Which stages have been completed?
- Which execution runs happened recently?
- What is the live worker doing right now?
- How many revision loops happened and between which stages?

Those are all legitimate questions, but they do not belong at the same visual level.[^1][^2][^6][^12]

### B. Stage Runs relabel execution history as forward progress

The strongest mismatch is the runs list using `stage + 1` as its visible badge label.[^6] Since `stage_runs.stage` is stored exactly as the run's stage on insert, the UI is not displaying the recorded value; it is interpreting it as the stage being attempted next.[^5][^10]

That means a failed run and a successful run can both look like “Stage 6” even though only one of them actually moved the article forward.[^5][^6]

### C. The banner is live, but the rest of the page is partially stale

The live banner mutates instantly from SSE payloads, while the header and sidebar refresh through separate HTMX endpoints, and the page finally reloads after `pipeline_complete` with a 2-second delay.[^2][^4] During that interval, the banner can say “Advanced to Stage 6” while the badge and timeline still show the previous state, which users naturally interpret as inconsistency rather than event-stream timing.[^2][^3][^4]

### D. `status` and `stage` communicate different concepts without clear hierarchy

The top meta strip displays both `Stage N · Name` and the raw `article.status` badge, but the page never clearly teaches users that stage is the pipeline location while status is an orthogonal workflow condition such as `needs_lead_review` or `published`.[^1][^9] The result is that users see multiple state labels with no explanation of which one matters most.

### E. Revisions are visually heavyweight but operationally secondary

Revision History appears directly below Actions and above Artifacts in the main column, which gives it prime attention even though it is retrospective analysis rather than the primary task surface.[^1] The revision entries reuse `review-card` styling with colored left borders for approved/revise/reject states, which visually elevates them as urgent cards.[^8]

On mobile, this means the user scrolls through bulky iteration cards before even reaching artifacts, while the sidebar diagnostics still follow later in the page.[^1][^7][^8]

## What To Simplify

### Recommended primary model: one workflow state, three supporting views

The article page should elevate exactly one primary state model:

1. **Primary:** current article stage (`current_stage`) and what it means now.
2. **Supporting:** the next available action / guard status.
3. **Supporting:** a lightweight timeline showing progress through stages.
4. **Diagnostic:** run history, usage, audit log, detailed revisions.[^1][^2][^6][^12]

That means the article page should stop trying to make Stage Runs and Revision History feel like peers of the main workflow state.

### Recommended simplification hierarchy

#### Keep prominent

- Top badge: `Stage N · {stage name}`[^1]
- Timeline circles/progress row[^2]
- Action panel / next step / guard message[^1]
- One compact live banner during active work only[^2][^3]

#### Demote

- Stage Runs -> move into Advanced / Diagnostics[^6][^7]
- Token Usage -> compact summary on article page, details in Advanced[^7]
- Revision History -> collapsed summary block by default[^1][^12]

#### Remove or move elsewhere

- Repeated large stage labels inside both stage runs and revision cards
- Full revision-body excerpts as default-open content
- Highly prominent inline “Last run” error banner when the same failure is already visible in runs history / guard state[^1][^8]

## Specific Recommendations

### 1. Unify stage language around “Current stage”

Use the top badge and timeline as the only always-visible stage-numbered UI. Both already derive from canonical stage data and shared stage names.[^1][^2][^9]

Suggested rule:

- **Badge:** “Current stage: Stage 5 · Article Drafting”
- **Timeline:** visual progress only
- **Action panel:** “Next action” language, not another stage-status explainer

### 2. Rename or relocate Stage Runs

If Stage Runs stays on the article page, it should stop looking like a second stage-progress strip. The smallest product change is to move it into Advanced and rename it to something like:

- `Execution History`
- `Recent Attempts`
- `Agent Runs`

If it remains visible, the run badge should show the recorded run stage directly, not `stage + 1`, and the text should clarify whether it was an attempt, success, or failure.[^6][^10][^11]

### 3. Make the live banner event-oriented, not stage-authoritative

The live banner should describe activity, not compete with the canonical stage display. Its current phrasing repeats stage numbers in ways that can disagree with the rest of the page during partial updates.[^2][^3][^4]

Better copy model:

- `Working on draft generation…`
- `Editor pass running…`
- `Advance complete. Refreshing…`
- `Drafting failed. See latest error.`

This lets the top badge remain the source of truth for stage numbers while the banner communicates transient activity.

### 4. Collapse revisions by default

Revision History is valuable, but it should begin as a summary card such as:

- `Revisions: 2 iterations`
- `Latest outcome: REVISE`
- `Top blocker: stale-stat`

Then let the user expand into the detailed writer/editor turns.[^1][^12][^13]

The current implementation renders all entries inline, including summary, blockers, issues, and paired writer/editor excerpts, which is too much for the main column.[^1][^12]

### 5. Reduce revision visual severity

Revision cards currently reuse colored verdict/review styling that reads like the main thing the user must act on.[^8] Revisions should look secondary — smaller badges, softer borders, tighter summaries, and details hidden under disclosure.

### 6. Keep “Needs Lead review” as a workflow status, not a stage

The page already models `needs_lead_review` as status layered on top of Stage 6.[^1][^3][^9] That is conceptually fine, but the UI should explain it more plainly:

- Stage stays `6 · Editor Pass`
- Status becomes `Paused for lead review`

That is easier to understand than showing multiple stage-like labels.

## Mobile UX Findings

### Current mobile behavior

The article page's responsive rule collapses the two-column detail grid to a single column at `max-width: 900px`, with the main column first and the sidebar second.[^7] That is directionally correct, but the content order still produces a long, dense stack:

1. Actions
2. Revision History
3. Images (when available)
4. Artifacts
5. Reviews (when no revision history)
6. Token Usage
7. Stage Runs
8. Advanced[^1][^7]

This is too much secondary information ahead of the main working surface.

### Revision prominence on mobile

Because Revision History sits immediately below Actions and before Artifacts, it consumes the most valuable scroll real estate on smaller screens.[^1] Each entry can contain verdict, stage pair, metadata, summary, blockers, issue list, and two detailed turn cards, which is costly in a one-column layout.[^1][^12]

### Action-panel overflow risk on mobile

The send-back control is implemented as an absolutely positioned dropdown anchored to the action bar.[^1][^8] On narrow screens, that layout is more likely to overflow the viewport or compete awkwardly with wrapped buttons because the form is `position: absolute`, `right: 0`, and has `min-width: 280px`.[^8]

### Sidebar diagnostics are too chatty for a phone

The sidebar contents are still rendered in full below the primary column after the mobile stack reorder.[^1][^4][^7] Token Usage, Stage Runs, and Advanced are useful, but on mobile they should become progressive disclosure, not full default content.

## Recommended Mobile-First Layout Model

```text
[Back]
Title
Stage 5 · Article Drafting
Status: In progress / Paused for review

[compact live activity]
[horizontal stage progress]

[primary action card]
- Next action
- guard / blocker summary
- advance / retry / publish button

[revisions summary disclosure]
- 2 revision loops
- latest blocker
- expand for details

[artifacts]

[compact diagnostics disclosure]
- token summary
- recent attempt summary
- advanced / audit / full runs
```

### Concrete mobile changes

1. **Keep the timeline, but shrink its role to progress only.** The stage circles already horizontally scroll on mobile; that is fine, but the timestamps should stay hidden or tooltip-only.[^2][^7]
2. **Turn Revision History into a closed disclosure by default.** Show only the count, latest verdict, and latest blocker summary until expanded.[^1][^12]
3. **Move Stage Runs into Advanced on mobile, and probably desktop too.** Its content is diagnostic, not navigational.[^6][^7]
4. **Compress Token Usage into one-line summary on mobile.** Keep full by-stage breakdown in Advanced.[^1][^4]
5. **Convert Send Back to an inline sheet/card, not an absolute dropdown.** The current positioned menu is fragile on smaller widths.[^8]
6. **Hide Danger Zone behind disclosure.** The current article page already has many controls competing for attention; destructive/archive controls should not sit in the main action scan path.[^1]

## Recommended Simplification Plan (Smallest Reasonable Version)

### Option A — Minimal change, highest value

1. Keep top stage badge + timeline as-is.
2. Change Stage Runs heading to `Recent Attempts` and move it under Advanced.
3. Replace full Revision History block with a collapsed summary/details control.
4. Tweak live banner copy to activity-oriented language.
5. Keep the current action panel structure, but demote Send Back and Danger Zone visually.

This is the best “simplify without redesign” option because it removes confusion mostly by reducing competing surfaces.

### Option B — Slightly more opinionated but still small

1. Rename the top badge to `Current stage`.
2. Add one compact status line below it, e.g. `Paused for lead review` / `Ready to publish` / `Working`.
3. Collapse revisions and move Stage Runs entirely into Advanced.
4. Show only one summary line from the latest failed attempt in the action card if present.

This better separates workflow state from diagnostics.

## What Seems Safe To Remove Or Move Elsewhere

The following information appears safe to demote or relocate without hurting primary task completion:

- per-run model names on the main article page[^6]
- full Stage Runs panel from the default sidebar[^6][^7]
- verbose historical `from_stage → to_stage` labels inside each revision card[^12]
- expanded writer/editor turn excerpts by default[^12][^13]
- duplicated failure prominence via both stage-run-error box and separate runs list[^1][^8]

## Confidence Assessment

**High confidence**

- The stage-number mismatch is driven primarily by the Stage Runs panel translating `stage_runs.stage` into `stage + 1` for display.[^5][^6][^11]
- The page currently blends canonical stage state, historical transitions, execution history, and transient SSE messages in the same visual hierarchy.[^1][^2][^3][^4]
- Revision History is too prominent in the current content order, especially on mobile.[^1][^7][^8]

**Medium confidence**

- The best simplification is to demote Stage Runs from the default page entirely rather than relabel it in place. This is strongly supported by the current implementation, but it is still a product choice.
- The current live banner perceived mismatch is caused more by event-timing and UI semantics than by incorrect back-end state. That is well supported by the split rendering paths, though I did not run a live browser trace here.[^2][^3][^4]

**Lower confidence / inferred**

- Some revision-specific classes appear to rely mostly on generic review styling rather than dedicated layout rules. That inference is based on the emitted markup and the available CSS around review cards, not on a full CSS selector inventory audit.[^1][^8]

## Footnotes

[^1]: `C:\github\nfl-eval\src\dashboard\views\article.ts:87-97,163-216,471-502,542-725`
[^2]: `C:\github\nfl-eval\src\dashboard\views\article.ts:225-336`
[^3]: `C:\github\nfl-eval\src\dashboard\server.ts:734-782`
[^4]: `C:\github\nfl-eval\src\dashboard\server.ts:1596-1625`
[^5]: `C:\github\nfl-eval\src\db\repository.ts:240-245,539-599`
[^6]: `C:\github\nfl-eval\src\dashboard\views\article.ts:1202-1235`
[^7]: `C:\github\nfl-eval\src\dashboard\public\styles.css:463-505,2410-2449`
[^8]: `C:\github\nfl-eval\src\dashboard\public\styles.css:568-595,1379-1523`
[^9]: `C:\github\nfl-eval\src\types.ts:1-18,31-62`
[^10]: `C:\github\nfl-eval\src\types.ts:235-251`
[^11]: `C:\github\nfl-eval\tests\dashboard\wave2.test.ts:468-486`
[^12]: `C:\github\nfl-eval\src\pipeline\conversation.ts:297-340`
[^13]: `C:\github\nfl-eval\tests\dashboard\server.test.ts:300-353`
