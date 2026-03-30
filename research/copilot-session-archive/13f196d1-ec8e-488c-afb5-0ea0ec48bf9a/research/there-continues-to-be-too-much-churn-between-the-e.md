# V3 plan to reduce writer/editor churn without a full rewrite

## Ask

You asked for a realistic plan to make Writer more specific and more free to write, while shrinking Editor into a lightweight check for obvious accuracy issues. You also explicitly allowed deleting code and functions if that is the cleanest way to get there.

This memo stays inside the current V3 design. It does not propose a new pipeline or a new external research system.

## Executive summary

The current churn is not mainly a prompting problem. It is structural.

Writer, runtime guards, and Editor all enforce overlapping parts of the same contract:

- Writer is told to follow the canonical article contract and still leave final factual approval to Editor (`worktrees\V3\src\config\defaults\charters\nfl\writer.md:12-18`).
- Stage 5 runtime validation blocks on minimum length, TLDR placement, TLDR bullet count, and writer-preflight blocking issues before Editor even becomes the approval gate (`worktrees\V3\src\pipeline\actions.ts:1487-1543`; `worktrees\V3\src\pipeline\engine.ts:117-189`).
- Editor is then defined as a mandatory approval gate for both blocking accuracy and blocking structure checks, with a canonical report format and exact verdict section (`worktrees\V3\src\config\defaults\charters\nfl\editor.md:12-18`; `worktrees\V3\src\config\defaults\skills\editor-review.md:11-64`).
- When Editor returns `REVISE`, the pipeline regresses back to Stage 4, preserves prior artifacts, can escalate repeated blocker signatures to Lead review, can force-approve after max revisions, and can generate post-revision retrospectives (`worktrees\V3\src\pipeline\actions.ts:141-203`; `worktrees\V3\src\pipeline\actions.ts:2028-2144`; `worktrees\V3\src\pipeline\actions.ts:2183-2192`).

That means the system currently treats Writer as partially constrained, Editor as a heavyweight gate, and revisions as a first-class operating mode. If the goal is "Writer gets more freedom and Editor becomes lightweight," the clean answer is to simplify the operating model, not just tweak wording.

## What is currently causing the churn

### 1. Writer is already carrying editor-shaped constraints

The Writer charter says to follow the canonical article contract, use the fact-check pass only in a bounded way, and leave final factual approval to Editor (`worktrees\V3\src\config\defaults\charters\nfl\writer.md:12-18`).

On top of that, the Stage 5 task injects a writer/editor preflight checklist into the writer task itself (`worktrees\V3\src\pipeline\actions.ts:708-719`).

Then `writeDraft()` does all of this before Editor:

- builds roster and fact-check context
- runs a separate writer fact-check pass
- gathers revision history and prior editor feedback
- writes a full draft
- validates the draft with structure and writer-preflight
- retries once with a repair instruction if anything fails
- fails the stage if the repaired draft still misses the contract (`worktrees\V3\src\pipeline\actions.ts:1336-1543`)

That is a lot of policy and control flow sitting in Stage 5. It makes Writer feel constrained while still not actually owning final approval.

### 2. The runtime is enforcing article structure before Editor sees the draft

`inspectDraftStructure()` enforces a hard top-of-article contract:

1. headline
2. italic subtitle
3. optional cover image
4. TLDR block near the top
5. byline

It also requires at least 4 TLDR bullets and blocks if the TLDR is missing or too low (`worktrees\V3\src\pipeline\engine.ts:117-167`; `worktrees\V3\src\config\defaults\skills\substack-article.md:13-24`).

Then `requireDraft()` treats that structure as a guard to advance the pipeline (`worktrees\V3\src\pipeline\engine.ts:169-189`).

This is clean from a determinism standpoint, but it means Editor is not the first real reviewer. The runtime is.

### 3. Editor is doing too many jobs

The Editor charter says the role is to decide whether the draft is publish-safe, enforce the article contract, and return the canonical verdict format (`worktrees\V3\src\config\defaults\charters\nfl\editor.md:12-18`).

The `editor-review` skill then expands that into:

- blocking accuracy checks
- blocking structure checks
- approval judgment
- suggestions
- notes
- exact verdict formatting (`worktrees\V3\src\config\defaults\skills\editor-review.md:15-64`)

That makes Editor both:

- an accuracy/fact gate
- a structure/compliance gate
- an editorial taste/quality gate
- a formatter for the pipeline's state machine

If you want a lightweight Editor, this is the single biggest target.

### 4. The revision loop is symmetrical and expensive

`runEditor()` records a revision summary when the verdict is `REVISE` (`worktrees\V3\src\pipeline\actions.ts:1641-1657`).

`autoAdvanceArticle()` then treats writer structure send-backs and editor `REVISE` outcomes as regressions back to Stage 4, restores feedback artifacts, increments `revisionCount`, and retries the loop (`worktrees\V3\src\pipeline\actions.ts:2015-2144`).

Repeated blockers can escalate to Lead review using structured blocker fingerprints (`worktrees\V3\src\pipeline\actions.ts:141-203`).

If revisions keep going, the code can eventually overwrite `editor-review.md` with an auto-approved verdict and continue anyway (`worktrees\V3\src\pipeline\actions.ts:2066-2071`; `worktrees\V3\src\pipeline\actions.ts:2140-2143`).

After completion, the system can generate a post-revision retrospective (`worktrees\V3\src\pipeline\actions.ts:2183-2192`).

This is thoughtful machinery, but it is the opposite of a lightweight editing model.

### 5. Tests are locking this churn in place

The current behavior is not incidental. The tests assert it:

- Editor `REVISE` creates revision history (`worktrees\V3\tests\pipeline\actions.test.ts:1030-1059`)
- Editor output must self-heal into a canonical verdict (`worktrees\V3\tests\pipeline\actions.test.ts:1109-1139`)
- Stage 5 structure failures send the draft back to Writer (`worktrees\V3\tests\pipeline\actions.test.ts:1400-1422`)
- Stage 6 `REVISE` regresses back to Stage 4 (`worktrees\V3\tests\pipeline\actions.test.ts:1424-1470`)
- repeated blockers escalate to Lead review (`worktrees\V3\tests\pipeline\actions.test.ts:1472-1523`)
- max-revision behavior can still force-approve (`worktrees\V3\tests\pipeline\actions.test.ts:1930-1951`)

So this is not just "the prompts got heavy." V3 currently has a deliberate revision state machine.

## The realistic target state

The clean target is:

- Writer owns the draft and gets better, more explicit evidence framing up front.
- Runtime keeps only a few hard deterministic checks that are truly worth blocking on.
- Editor becomes an obvious-accuracy gate, not a full article cop plus workflow format cop.
- Revisions become rarer and more asymmetric.
- If the same article still fails after a small number of tries, a human-like Lead decision is more honest than force-approving.

In practice, that means:

### Writer should become more specific upstream

Do not make Writer "free" by removing all structure. Make Writer more specific in the input:

- one canonical source of supported names and exact facts
- explicit "safe to state exactly" vs "must attribute/soften" guidance
- clear revision instruction that says "patch the current draft, do not restart"

This is consistent with the already-discussed `writer-support` idea and is much more realistic than teaching preflight endless heuristics.

### Editor should become accuracy-only

Editor should block only on obvious issues such as:

- wrong player/team assignment
- unsupported exact figure stated as fact
- stale or contradicted factual claim
- fabricated quote or attribution

Editor should stop owning:

- TLDR placement policing
- broad style/taste suggestions
- dense notes sections
- repeated exact-format choreography beyond a simple machine-readable verdict

## Recommended V3 changes

## Phase 1: move specificity upstream into Writer

### Change

Add one compact structured artifact consumed by Writer and the lightweight checker. The earlier `writer-support` concept is the right direction.

Suggested sections:

- canonical names
- exact supported facts
- exact facts to avoid or soften
- freshness / `as_of` notes
- optional claim wording guidance for risky facts

### Why

Right now Writer has to infer too much from mixed prose plus advisory fact-check context (`worktrees\V3\src\pipeline\actions.ts:1343-1429`).

Giving Writer one clear support artifact is a better answer than keeping an ever-growing preflight blocker set.

### Code surfaces

- `writeDraft()` context assembly in `worktrees\V3\src\pipeline\actions.ts:1336-1479`
- any existing writer fact-check / preflight artifact builders referenced there
- Writer charter in `worktrees\V3\src\config\defaults\charters\nfl\writer.md`

## Phase 2: shrink writer-preflight from heavy blocker to minimal safety rail

### Change

Keep only the most valuable deterministic failures as hard blockers at Stage 5:

- empty/very short draft
- obvious placeholder content
- maybe one or two clearly unsupported exact-claim classes if precision is high and false positives are low

Downgrade the rest to warnings written into a side artifact instead of blocking the stage.

### Why

The current design makes Writer preflight a second editor before Editor (`worktrees\V3\src\pipeline\actions.ts:1487-1543`).

That is the engine of many "same pattern, different words" failures.

### Practical note

I would **not** fully delete `inspectDraftStructure()` on day one. Keep a minimal structure check, but simplify it. For example:

- require a headline
- require a subtitle
- require a recognizable TLDR block

Do not make Stage 5 block on so much article-shape detail that the runtime is effectively editing.

## Phase 3: turn Editor into a light obvious-accuracy gate

### Change

Rewrite the Editor charter and `editor-review` skill so Editor's job is:

- verify obvious factual safety
- emit a small set of blockers if needed
- otherwise approve

Recommended output:

```markdown
## Blockers
- wrong team assignment for Player X
- unsupported exact number in paragraph Y

## Verdict
REVISE
```

or

```markdown
## Verdict
APPROVED
```

No suggestions section. No notes section by default. No structure tutoring unless the article is so malformed that it prevents factual review.

### Why

The current skill explicitly makes Editor a full approval protocol with blockers, suggestions, notes, and exact report format (`worktrees\V3\src\config\defaults\skills\editor-review.md:38-64`).

That is heavier than the role you want.

### Code surfaces

- `EDITOR_APPROVAL_GATE_TASK` in `worktrees\V3\src\pipeline\actions.ts:724-730`
- `runEditor()` in `worktrees\V3\src\pipeline\actions.ts:1553-1657`
- `worktrees\V3\src\config\defaults\charters\nfl\editor.md`
- `worktrees\V3\src\config\defaults\skills\editor-review.md`

## Phase 4: simplify the revision model instead of preserving it

### Change

Replace the current loop with:

- up to 2 normal revision cycles
- on the 3rd failure, escalate to Lead review
- remove force-approve

### Why

If an article still cannot pass after a small number of clear revision attempts, auto-approving is not really reducing churn. It is hiding churn and pushing risk forward.

Lead escalation is already supported today (`worktrees\V3\src\pipeline\actions.ts:141-203`), so the easiest realistic simplification is:

- keep escalation
- delete force-approval
- lower the max

### Code to delete or simplify

- force-approve branches in `autoAdvanceArticle()` (`worktrees\V3\src\pipeline\actions.ts:2066-2071`; `worktrees\V3\src\pipeline\actions.ts:2140-2143`)
- revision-cap messaging built around repeated retries (`worktrees\V3\src\pipeline\actions.ts:2028-2144`)
- a large part of the retrospective/value-capture flow if the revision loop is no longer central (`worktrees\V3\src\pipeline\actions.ts:2183-2192`; `worktrees\V3\tests\pipeline\actions.test.ts:1818-1951`)

I would keep structured blocker metadata if you still want repeated-blocker escalation. That piece is useful and relatively clean.

## Phase 5: stop feeding Editor so much conversational baggage

### Change

Reduce editor context to:

- latest draft
- lightweight writer support artifact
- roster/fact-check context only when needed
- maybe the latest revision summary

Drop the "your previous reviews" accumulation unless there is a real measurable benefit.

### Why

`runEditor()` currently builds compact revision context and also passes prior editor reviews back into the editor context (`worktrees\V3\src\pipeline\actions.ts:1568-1584`).

That encourages Editor to behave like an ongoing conversation partner rather than a simple approval gate.

If the role is lightweight, it should mostly judge the current draft.

## Phase 6: clean up the UI/stage semantics to match the simpler model

### Change

Rename what the dashboard emphasizes during revision:

- Stage 4 should not visually read as "back to panel discussion" when the real work is draft revision.
- Make draft-first artifact tabs the default during revision.
- Prefer labels like "Revision Workspace" and "Draft revision in progress."

### Why

The article page already shows signs of this mismatch:

- Stage 4 is still named `Panel Discussion` in `STAGE_NAMES` (`worktrees\V3\src\types.ts:5-14`)
- the article view contains special revision labeling logic to compensate (`worktrees\V3\src\dashboard\views\article.ts:78-109`)

That is evidence the underlying stage model and visible UX are pulling in different directions.

## What I would delete

If you want a genuinely simpler V3, I would be comfortable deleting or sharply reducing:

1. Most of the writer self-heal wording complexity once Writer has a better support artifact (`worktrees\V3\src\pipeline\actions.ts:682-706`, `1491-1516`)
2. Most nonessential Stage 5 preflight blockers
3. Editor `SUGGESTIONS` and `NOTES` as canonical sections (`worktrees\V3\src\config\defaults\skills\editor-review.md:46-50`)
4. Force-approve after max revisions (`worktrees\V3\src\pipeline\actions.ts:2066-2071`; `2140-2143`)
5. Much of the retrospective machinery if the loop is no longer expected behavior (`worktrees\V3\tests\pipeline\actions.test.ts:1818-1951`)

I would **not** delete:

- the core stage system
- Lead escalation for repeated blockers
- some deterministic structure validation
- roster/fact-check context generation

Those still provide useful discipline without requiring the current heavy churn model.

## Concrete rollout plan

## Step 1: prompt/skill simplification

- Rewrite `writer.md` so Writer explicitly owns the article and is told to use the new support artifact as the source of exact phrasing/facts.
- Rewrite `editor.md` and `editor-review.md` so Editor is accuracy-only.
- Keep `substack-article.md`, but trim what is treated as a runtime blocker versus a drafting preference.

## Step 2: runtime simplification

- Add the writer support artifact in `writeDraft()`.
- Reduce `needsDraftRepair()` and related preflight blocking behavior.
- Keep only minimal structure validation in `engine.ts`.

## Step 3: revision loop simplification

- cap revisions at 2
- 3rd failure escalates to Lead
- remove force-approve branches
- remove tests that assert force-approve behavior

## Step 4: UX alignment

- revision status should center the draft, not discussion artifacts
- update labels and default artifact priority for revision state

## Step 5: validation

Rework tests around the new intended behavior:

- Writer can pass with warnings that do not block the stage
- Editor only blocks on obvious factual issues
- repeated failure escalates; it does not auto-approve
- dashboard revision UI points users to the draft/fixes first

## Risks and tradeoffs

### Risk: worse drafts reach Editor

Yes, somewhat. That is the cost of making Writer more autonomous.

But if Writer has a better support artifact and Editor is accuracy-only, this is a manageable trade. The system becomes easier to reason about, and failures become more honest.

### Risk: structure quality slips

Possible. That is why I would keep a small deterministic structure guard instead of deleting structure checks outright.

### Risk: Lead sees more escalations

Probably. But that is preferable to silent force-approval after repeated churn. It surfaces the genuinely hard articles instead of pretending the loop worked.

## My recommendation

If you want the most realistic version of your stated goal inside V3, do this:

1. Add the Writer support artifact.
2. Cut writer-preflight down to a minimal blocker set.
3. Rewrite Editor to obvious-accuracy-only.
4. Delete force-approve and lower the revision cap.
5. Align the article UX so revision clearly means draft work, not "back to discussion."

That gets you to a system where Writer has more room to write, Editor becomes lighter, and the code actually reflects the intended workflow instead of fighting it.

## Bottom line

You do **not** need a smarter AI to make this better.

You need a simpler contract:

- one clearer source of truth for Writer
- fewer runtime blockers before Editor
- a much smaller Editor role
- fewer automatic revision cycles

V3 can absolutely support that, but only if we simplify the control flow and delete some of the current revision machinery instead of preserving it.
