# V1 vs V2 editor revision research

## Bottom line

I do **not** see evidence that V1 had a single-pass editor who only edited once and then approved. The V1 archive already supported `APPROVED`, `REVISE`, and `REJECT`, and its board logic explicitly described a Stage 6 `REVISE` outcome as a revision lane that sends the article back through re-draft and re-review.

What *did* change in V2 is that the revision loop is now much more automatic and much more stateful:

- `runEditor()` records each `REVISE` as structured revision history. (`src\pipeline\actions.ts:1253-1262`)
- `autoAdvanceArticle()` immediately regresses Stage 6 back to Stage 4 on `REVISE`, restores `editor-review.md` and the previous `draft.md`, and retries automatically up to `maxRevisions` (default `3`). (`src\pipeline\actions.ts:1574-1763`)
- If the revision cap is exceeded, V2 overwrites `editor-review.md` with an auto-generated `APPROVED` note and keeps moving. (`src\pipeline\actions.ts:1684-1689`, `src\pipeline\actions.ts:1757-1762`)

So the current problem is **not** that V2 invented revision cycles. The bigger issue is that V2 made the revision loop more autonomous, more context-heavy, and more willing to keep retrying without a human-style intervention point.

## What V1 actually did

The strongest V1 evidence is in the archive branch `v1-archive`:

- `content/pipeline_state.py` defined `VALID_VERDICTS = ("APPROVED", "REVISE", "REJECT")`. (`v1-archive:content/pipeline_state.py:26-29`)
- The same file had `record_editor_review(...)`, which persisted repeated editor reviews by incrementing `review_number`. (`v1-archive:content/pipeline_state.py:552-574`)
- `content/article_board.py` treated Stage 6 `REVISE` as: `Revision lane -> re-draft -> re-review`. (`v1-archive:content/article_board.py:246-275`)

I also searched V1 for signs of a hard revision cap or auto-approval path. I did **not** find anything comparable to V2's `maxRevisions` / force-approve behavior. The V1 grep hits were about review numbering and the revision lane itself, not an automatic cap.

## What V2 does now

### 1. Writer revisions are more stateful

On revision, the writer is not starting from a clean slate:

- V2 appends the **previous draft** with an explicit instruction to revise it instead of starting over. (`src\pipeline\actions.ts:1066-1071`)
- V2 appends the **latest full editor review** so the writer can act on exact feedback. (`src\pipeline\actions.ts:1077-1083`)
- V2 also injects a compact **Shared Revision Handoff** built from prior revision summaries. (`src\pipeline\conversation.ts:413-424`)
- Upstream article context is still assembled through `gatherContext()`, which prepends configured artifacts before the primary input. (`src\pipeline\actions.ts:646-680`)

That is a more capable loop than V1, but it also means every retry carries more accumulated state.

### 2. The default `rich` context preset is broader

The app config loads `contextPreset` from `NFL_CONTEXT_PRESET`. (`src\config\index.ts:256-275`)

For `writeDraft`, the `rich` preset includes:

- `idea.md`
- `discussion-prompt.md`
- `panel-composition.md`
- `editor-review.md`
- `panel-factcheck.md`
- `roster-context.md`
- `fact-check-context.md`
- `writer-factcheck.md`

For `runEditor`, the `rich` preset includes:

- `idea.md`
- `discussion-prompt.md`
- `panel-composition.md`
- `discussion-summary.md`
- `panel-factcheck.md`
- `roster-context.md`
- `fact-check-context.md`
- `writer-factcheck.md`

See `src\pipeline\context-config.ts:35-45`.

That does not automatically mean the model fails, but it absolutely increases prompt size and the number of constraints the writer/editor are juggling.

### 3. The editor loop is explicitly automatic

V2's pipeline now makes the retry policy explicit in code:

- Stage 6 only passes when the latest editor verdict is `APPROVED`. (`src\pipeline\engine.ts:246-274`)
- `runEditor()` records a revision summary whenever the verdict is `REVISE`. (`src\pipeline\actions.ts:1253-1262`)
- `autoAdvanceArticle()` increments `revisionCount`, regresses `6 -> 4`, restores `editor-review.md` and `draft.md`, and retries. (`src\pipeline\actions.ts:1726-1756`)
- When the cap is exceeded, `autoAdvanceArticle()` force-writes an `APPROVED` review note. (`src\pipeline\actions.ts:1757-1762`)

This is a real behavioral change from the old board-oriented workflow: the system itself keeps driving the retries instead of waiting for a more explicit human-orchestrated decision.

## What happened on the live article

Article examined:

- `which-2023-first-rounders-are-worth-the-2026-fifth-year-gamb`
- title: `Which 2023 First-Rounders Are Worth the 2026 Fifth-Year Gamble?`
- current DB state: `current_stage = 6`, `status = approved`
- source: `C:\Users\jdl44\.nfl-lab\pipeline.db`

### It used shared/default context, not a custom article override

There is **no** `_config.json` artifact for this article, so it did not use a per-article context override. It inherited the app-level context preset.

The app config seam confirms `contextPreset` comes from the shared config (`src\config\index.ts:256-275`), and article-specific overrides would come from `_config.json` via `getArticleContextOverrides(...)` in `src\pipeline\actions.ts:652-658` / `src\pipeline\context-config.ts`.

So: **yes, it used the shared context**, and in this environment that shared preset was `rich`. But shared context alone does not explain the looping.

### It went through four editor `REVISE` cycles

Live `stage_transitions` show:

- `5 -> 6` (`runEditor`)
- `6 -> 4` (`auto-advance`, attempt `1/3`)
- `5 -> 6` (`runEditor`)
- `6 -> 4` (`auto-advance`, attempt `2/3`)
- `5 -> 6` (`runEditor`)
- `6 -> 4` (`auto-advance`, attempt `3/3`)
- `5 -> 6` (`runEditor`)

So there were **three explicit regressions** and then a **fourth editor review** at Stage 6.

Live `revision_summaries` recorded four iterations, all `REVISE`:

1. Missing `Deonte Banks` analysis even though the framework referenced him.
2. Shorthand / non-roster-exact names in the table.
3. Unsourced contract benchmarks (`Christian McCaffrey`, `T.J. Hockenson`).
4. Argument still lacked actual `2027` option-pricing stakes by position.

Important detail: all four revision summaries had `blocker_type = null` and `blocker_ids = null`.

### Why it never escalated to Lead review

V2 has a specific escape hatch for repeated blockers:

- `findConsecutiveRepeatedRevisionBlocker(...)` only fires when the last two revision summaries are both `REVISE` **and** have the same normalized blocker fingerprint. (`src\pipeline\conversation.ts:142-169`)
- `maybeEscalateRepeatedRevisionBlocker(...)` then writes `lead-review.md` and marks the article `needs_lead_review`. (`src\pipeline\actions.ts:150-167`)

That never happened here because the revision summaries had no blocker metadata at all (`null` / `null`), and the editor feedback changed each round instead of repeating the exact same issue.

So the article stayed on the default retry rail until the cap was exceeded.

### Why the article shows as approved now

The final persisted `editor-review.md` is:

- `Auto-approved after 4 revision cycles.`
- verdict: `APPROVED`

That matches V2's force-approve path exactly. In other words, the article did **not** reach approval because the editor finally signed off. It reached approval because the pipeline exhausted the revision cap and replaced the editor review with an auto-generated approval.

## Is the real problem "too much context"?

My read is: **partly, but not mainly**.

### What context probably contributed

The article used the shared `rich` preset and no custom override. That means writer/editor were working with a broad upstream bundle plus revision carryover. On revisions, the writer also gets:

- prior draft
- latest full editor review
- revision-summary handoff

So yes, V2 has a heavier and more layered prompt surface than V1.

### What looks like the bigger problem

The more important issue is the **control policy**, not just the amount of data:

1. The editor can keep finding a *new* issue each round.
2. Each `REVISE` automatically sends the article back to Stage 4.
3. Lead escalation only works for repeated structured blockers, not drifting or newly discovered issues.
4. If that never triggers, the system eventually auto-approves anyway.

That combination creates exactly the behavior you observed: the editor "never approves," the writer keeps revising, and the pipeline still eventually shoves the article forward.

So I would frame the root cause as:

- **primary:** overly automatic V2 revision policy
- **secondary:** broader context / more constraints per retry
- **tertiary:** lack of structured blocker tagging in actual editor outputs, which prevents the lead-review escape hatch from activating

## Should we greatly simplify things?

I would **not** start by ripping out the newer data inputs or broadly simplifying the whole pipeline.

I *would* simplify the **revision loop**.

## Recommendations to make V2 behave more like V1

### 1. Replace force-approval with explicit escalation

Instead of overwriting `editor-review.md` to `APPROVED` after the cap, stop at Stage 6 and escalate to `needs_lead_review`.

Why:

- This better matches a human editorial workflow.
- It avoids fake approvals.
- It gives you a real intervention point when the editor/writer are stuck in a moving-target loop.

This is the single highest-value change.

### 2. Narrow revision-time context

Keep the rich preset for first drafts if you want, but use a tighter revision payload.

For revisions, I would bias toward:

- previous draft
- latest editor review
- compact revision summary
- only the minimum factual support artifacts actually needed for the cited blocker

In other words: do **not** keep feeding the full rich upstream packet back through every revision by default.

### 3. Require structured blocker tags for hard revision requests

The repeated-blocker escalation path is good, but it depends on blocker metadata. Right now this article's revision summaries had no blocker signatures, so the mechanism could not help.

If editor reviews are going to drive automation, then hard blockers should be emitted in a machine-readable way every time they request `REVISE`.

### 4. Consider capping the editor's scope on revision passes

A practical editorial rule could be:

- on revision pass 1, full review is allowed
- on revision pass 2+, editor should prioritize unresolved prior blockers and only raise new blockers if they are publish-stopping

That would reduce moving-target behavior.

### 5. Add a dashboard signal that distinguishes real approval from cap-exhaustion

Right now the final artifact reads as `APPROVED`, but it is actually "approved by policy fallback."

That distinction should be visible in the dashboard and DB state.

## Practical conclusion

If your goal is to make V2 feel more like V1, I would **not** describe the fix as "give everyone more context" or even "simplify all the data."

I would describe it as:

- make revision handling less automatic
- escalate stuck articles instead of force-approving them
- tighten revision-stage context
- require structured blockers so the system can tell "same issue again" from "new issue discovered"

That gets you much closer to a sane editorial loop without throwing away the useful V2 improvements.
