# Why the writer failed to converge after three revisions

## Executive Summary

This article did not fail because the writer ignored the editor; it failed because the workflow asked the writer to solve an evidence problem without giving the writer the evidence or the authority to fetch it independently.[^1][^2][^3] The editor's feedback did evolve across passes, but the highest-priority blocker stayed basically constant from the first send-back onward: the article asserted a football-diagnostic thesis about Green Bay's receiver hierarchy without the usage, contract, and roster data needed to prove it.[^4][^5][^6] The writer responded to some feedback correctly by naming players, tightening the headline, removing the explicit `~40%-45%` threshold, softening the claim into a roster-management thesis, and clarifying the 2026 mechanism, but those were workarounds around missing data rather than true resolutions.[^5][^7][^8]

On models: the live runtime used `gpt-5.4` for every writer and editor pass in this article, even though the checked-in repo default still says `gpt-5-mini`; the active runtime policy in `C:\Users\jdl44\.nfl-lab\config\models.json` resolves writer/editor to high-tier `deep_reasoning`, whose first-precedence candidate is `gpt-5.4`.[^9][^10][^11] That strongly suggests model quality was not the primary failure mode here. The core issue was workflow design: revision loops stayed inside Writer even after the editor was asking for evidence that the system itself had already flagged as missing.[^2][^3][^12]

## What actually happened

The article went through one initial writer attempt, one writer self-heal retry, then three writer revision reruns after editor `REVISE` verdicts, followed by a fourth editor `REVISE` that exhausted the revision cap and triggered forced approval instead of another rewrite.[^13][^14] The writer/editor cycle ran quickly: the first write/editor pair completed by `05:39:57`, the third rewrite completed by `05:46:11`, and the final editor `REVISE` landed at `05:46:40` before the publisher pass at `05:48:02`.[^13]

The revision cap is hard-coded to `maxRevisions = 3` in `autoAdvanceArticle()`. When the revision count exceeds that cap, the pipeline overwrites `editor-review.md` with an auto-approval note and continues forward instead of spawning another writer pass.[^14] That means the system treated the fourth `REVISE` as "good enough to ship after three tries," not as a signal that the workflow itself was misrouted.[^14]

## Why the writer could not get the piece into a publishable state

### 1. The editor's core blocker required new evidence, not better prose

The first editor pass said the article's load-bearing claim was unproven because it cited no usage splits, target concentration, third-down data, red-zone data, or late-game deployment, and also failed to name the actual receivers under discussion.[^4] The second editor pass kept the same central complaint: the trigger was still unproven and the `40%-45%` threshold lacked actual 2025 usage data; it also objected to role claims being stated as facts and to the abstract roster-reallocation logic.[^5] The third editor pass again said the piece still lacked actual usage data and now added a new demand: explain the `2026 expiration date` with real contract timelines and market-pressure details.[^6] The fourth editor pass preserved those same blockers, tightening them again into: either add the evidence or frame the article strictly as a roster-management thesis rather than an evidence-backed offensive diagnosis.[^8]

In other words, the dominant blocker did **not** change much. The editor kept asking for external evidence on three fronts:

- leverage-situation WR usage and target concentration,
- contract / extension timing for why 2026 matters,
- Packers-specific roster-need evidence for the EDGE / OL / CB reallocation case.[^4][^5][^6][^8]

Those are not copy-edit requests. They are research/data-completion requests.

### 2. The upstream context already warned that the evidence was missing

The writer's upstream `discussion-summary.md` explicitly listed "Open Questions for the Writer" that required verifying the live Packers roster, pulling actual 2025/2026 usage splits, checking target concentration, auditing extension timelines, and evaluating premium roster holes with current depth-chart evidence.[^15] The `panel-factcheck.md` artifact went further and marked the exact same claims as unverified: the `Round 2-3` trade threshold, the `training camp 2026` pressure point, the `~40%-45%` WR target-share benchmark, the EDGE / OL / CB need framing, and the idea that a flatter hierarchy was slowing Jordan Love.[^2]

That means the writer began the draft with a contradiction embedded in the prompt:

- the argument depended on data-backed claims, and
- the preflight artifact said the data for those claims was not present.[^2][^15]

### 3. The writer is explicitly **not** supposed to independently fact-check

The writer charter says the writer should use a "lightweight prose-safety preflight" and should **not** independently verify facts against outside sources or replace the editor.[^1] The writer may soften unsupported claims, avoid inventing specificity, and defer final precision to the editor, but the role is explicitly bounded away from being a verification or research agent.[^1]

That role contract conflicts directly with what the editor demanded. By revision 2, the editor was asking for "actual 2025 usage data," "route deployment," "target-location data," and concrete Packers roster/cap rationale.[^5] By revision 3 and 4, the editor was asking for contract years, free-agent timelines, extension windows, market-pressure detail, and concrete roster stress examples.[^6][^8] The writer could not fully satisfy those requests by better rhetoric alone, because the system had not provided the underlying data and the writer role was not empowered to go fetch it.[^1][^2][^15]

### 4. The writer adapted, but mostly by narrowing claims rather than resolving the evidence gap

The writer **did** respond to feedback:

- After pass 1, the writer fixed one major omission by explicitly naming `Jayden Reed`, `Romeo Doubs`, `Dontayvion Wicks`, and `Christian Watson`, and by elevating the `training camp 2026` deadline into the TLDR and opening paragraphs.[^4][^7]
- After pass 2, the writer removed the unsupported pseudo-precision and replaced the `~40%-45%` benchmark with "which two wideouts own the offense's highest-leverage moments."[^5][^16]
- After pass 3, the writer further narrowed the claim, explicitly admitting the article was "not yet a fully proven football case" and reframing it as a roster-management thesis rather than a courtroom-proof diagnosis.[^6][^7]
- The writer also improved the 2026 explanation, adding explicit "Watson / Doubs" versus "Reed / Wicks" contract-wave framing and making the reallocation section more Packers-specific with examples like a fourth pass-rush body, sixth lineman, or third corner option.[^7]

So the writer did **not** simply misunderstand or ignore the editor. The writer understood the direction and moved the article toward a less overstated thesis. The problem is that those moves still did not generate the missing evidence the editor wanted.[^5][^6][^8]

### 5. The system kept routing an evidence deficit back to Writer instead of to Research

The handoff to Writer is intentionally compact: a summary-only revision history plus the latest full `editor-review.md`, the prior `draft.md`, and upstream artifacts like `discussion-summary.md` and `panel-factcheck.md`.[^17][^18][^19] That is good prompt hygiene, but it assumes the writer can fix the problem with better drafting. In this example, the problem was not prompt contamination; it was missing source material.[^2][^15]

The pipeline currently has no branch that says, "The editor is asking for facts that are absent from upstream context; go back to research/panel data collection instead of looping through Writer again." The only automatic response to `REVISE` is to regress from editor back to writer until `maxRevisions` is exhausted.[^14] That routing is the architectural root cause.

## Did the editor provide new feedback each time?

### Short answer

Partly. The editor provided **incremental** new feedback, but not a fundamentally new primary blocker after the first pass.[^4][^5][^6][^8]

### What stayed the same across all passes

The editor's central complaint never went away:

- the football claim about a flat hierarchy lacked real usage evidence,
- the timing claim about 2026 lacked real contract evidence,
- the roster reallocation case lacked Packers-specific support.[^4][^5][^6][^8]

That is why the four `revision_summaries` are so repetitive even in their truncated previews; each begins with some version of "the core premise / central trigger / central football claim / actual usage evidence" still being unproven.[^13]

### What was genuinely new or newly emphasized

- **Pass 1** uniquely called out that the article never named the actual receivers and that the teaser looked like a placeholder.[^4]
- **Pass 2** newly emphasized unsupported role-assignment claims and explicitly told the writer to remove pseudo-precision if no data existed.[^5]
- **Pass 3** newly emphasized that the `2026 expiration date` needed actual contract-timeline mechanics and suggested league-context benchmarking for target concentration.[^6]
- **Pass 4** sharpened the same issues again, added tone trimming, and escalated the teaser into a workflow-verification problem if the next article did not actually exist in the pipeline.[^8]

So yes, the editor was adding signal. But after pass 2, most "new" feedback was refinement of the same unresolved evidence problem rather than a new direction.

## Did the writer misunderstand the editor?

### Short answer

Only partially. The writer seems to have understood the editorial direction but was unable to satisfy the editor's strongest requests because those requests required external evidence the writer did not have.[^1][^2][^5]

### Evidence that the writer understood

The writer made several changes that map directly to editorial requests:

- The editor asked to name the receivers; the next draft named them explicitly.[^4][^7]
- The editor objected to the generic headline and vague thesis; the next two drafts shifted from the original headline to `2026 Deadline`, `2026 Expiration Date`, and finally `2026 Decision Date`.[^5][^6][^7]
- The editor objected to the unsupported `40%-45%` threshold; the writer replaced it with a softer, evidence-seeking formulation.[^5][^16]
- The editor objected to overconfident football diagnosis; the writer ultimately inserted language explicitly downgrading the claim from proven diagnosis to roster-management thesis.[^7]

### Evidence of partial misunderstanding or incomplete adaptation

The writer kept some role labels and roster-logic claims too concrete even after the editor repeatedly asked for softer framing unless backed by evidence.[^5][^8] For example, pass 3 still described Doubs and Watson in near-definitive functional terms and still pushed Wicks early as the cleanest trade-thought experiment.[^7] That suggests not full misunderstanding, but a bias toward preserving the article's sharpness even when the editor wanted more caution.

Still, I would characterize this as a **judgment mismatch under constrained evidence**, not a comprehension failure. The writer was trying to salvage the article by rhetorical narrowing. The editor wanted empirical grounding.

## What models were the writer and editor using?

### Actual live run

The live `usage_events` for this article show that all writer and editor passes used `gpt-5.4`, while the publisher pass used `gpt-5-mini`.[^9] Specifically:

- `writeDraft`, `writeDraft-retry`, and every subsequent `writeDraft` revision logged `model_or_tool = "gpt-5.4"`.[^9]
- every `runEditor` revision pass also logged `model_or_tool = "gpt-5.4"`.[^9]
- `runPublisherPass` logged `model_or_tool = "gpt-5-mini"`.[^9]

### Why the runtime model differed from the repo default

The checked-in default `src\config\defaults\models.json` still maps `writer` and `editor` to `gpt-5-mini`.[^10] But the active runtime policy file at `C:\Users\jdl44\.nfl-lab\config\models.json` maps `writer`, `editor`, and `lead` to `gpt-5`, and its `deep_reasoning` task family prefers `gpt-5.4` ahead of `gpt-5`.[^11] The resolver prepends the stage default and then appends task-family precedence, selecting the first candidate unless an explicit override is applied.[^20]

Both `writer.md` and `editor.md` set `Model: auto`, and `AgentRunner` passes the stage key (`writer` / `editor`) to the gateway when the charter model is `auto`.[^21][^22][^23] That means the runtime policy, not the repo default, determined the effective model for this article.[^11][^20][^23]

### Observability gap

`stage_runs` has fields for `requested_model`, `requested_model_tier`, and `precedence_rank`, but `autoAdvanceArticle()` starts stage runs without populating any of them, so every row for this article has those fields as `null`.[^24][^25] The actual model only becomes visible later in `usage_events`.[^9][^24] That makes debugging model effects harder than it should be.

## Was model quality the problem?

Probably not. The writer and editor were already running on `gpt-5.4`, which is the highest-priority model in the runtime's `deep_reasoning` family.[^9][^11][^20] The observed failure mode is much more consistent with a workflow contract mismatch than with weak model capability:

- the missing evidence was explicitly absent from upstream context,[^2][^15]
- the writer role explicitly does not perform independent fact-checking,[^1]
- and the editor repeatedly demanded sourced evidence the writer could not produce from the provided artifacts.[^5][^6][^8]

Better models might have produced an even cleaner "this should be reframed as opinion unless sources are added" draft earlier, but they would not have conjured real 2025 usage splits or contract tables out of missing context. The system needed a different branch, not a better decoder.

## Recommendations

### 1. Route evidence-deficit revisions to Research, not back to Writer

If `panel-factcheck.md` says usage / contract / roster support is missing, and the editor asks for actual data on those same fronts, the next transition should not be `editor -> writer`. It should be `editor -> research refresh` or `editor -> discussion/data enrichment`, followed by a new writer pass after the missing evidence is injected.[^2][^15][^14]

### 2. Introduce structured editor feedback with persistent issue IDs

`revision_summaries` currently stores only a 300-character `feedback_summary` preview, and `key_issues` was `null` for all four revisions in this article.[^13][^18] That is too lossy for iterative work. The editor should emit machine-readable blocker IDs such as:

- `missing-usage-data`
- `missing-contract-timeline`
- `needs-packers-specific-roster-rationale`
- `overstated-role-claim`

Then the writer prompt can say "resolved issues" vs "still-open issues," rather than relying on free-text pattern matching and human memory.[^18]

### 3. Add a "claim mode" decision after the second failed revision

By the third writer revision, the writer manually moved toward the correct fallback: "this is a roster-management thesis, not a courtroom exhibit."[^7] The pipeline should make that branch explicit. After two revisions with the same evidence blocker, either:

- inject the missing data, or
- automatically switch the article into `analysis / opinion-backed` mode with a rewritten assignment that forbids unsupported evidence language.

That would have forced convergence instead of repeated half-measures.

### 4. Give the writer an explicit unresolved-blockers list in the prompt

The current writer handoff includes a compact revision summary plus the latest full editor review, but it does not normalize unresolved blockers into a concise checklist.[^17][^18][^19] Adding a dedicated section like:

```md
## Unresolved editor blockers
- missing actual WR usage splits
- missing concrete 2026 contract mechanics
- missing Packers-specific EDGE / OL / CB justification
```

would reduce the odds that the writer keeps polishing already-accepted sections while leaving core blockers mostly intact.

### 5. Persist model-routing metadata in `stage_runs`

The repository already has fields for `requested_model`, `requested_model_tier`, `precedence_rank`, and `output_budget_tokens`, but the `startStageRun()` call path in `autoAdvanceArticle()` does not fill them.[^24][^25] Populate those fields at stage-run start so article-level diagnostics can answer "which model did we think we were using?" without digging through `usage_events`.

### 6. Treat repetitive editor blockers as a system failure, not just a writer failure

In this case, revisions 2 through 4 kept repeating the same top-level issue.[^13] Once the same blocker appears twice, the system should mark the article as "blocked on missing evidence" rather than merely incrementing `revisionCount`. That would prevent force-approving articles that are still failing for the same unresolved reason.

### 7. Consider making the writer charter less ambiguous about external verification

Right now the writer charter says Writer should not independently verify facts, while `discussion-summary.md` tells the writer to verify roster, usage, target concentration, extension timelines, and roster holes.[^1][^15] Those two instructions conflict. Pick one:

- either Writers can do targeted retrieval / data pulls, or
- Writers cannot, and the pipeline must provide those artifacts before drafting begins.

Leaving both in place encourages exactly the kind of stalled revision loop seen here.

## Confidence Assessment

### High confidence

- The article stalled because the editor kept demanding evidence the prompt artifacts did not supply.[^2][^4][^5][^6][^8][^15]
- The writer did respond to some feedback, especially by naming players, removing fake precision, and downgrading the claim from proven diagnosis to roster-management thesis.[^5][^7][^16]
- The live writer/editor passes used `gpt-5.4`, not `gpt-5-mini`.[^9][^11][^20]
- The fourth editor `REVISE` did not produce another writer pass because the revision cap is three and the system force-approved after that.[^13][^14]

### Medium confidence

- The writer's main issue was not misunderstanding but being boxed in by missing data and role constraints. That reading is strongly supported by the artifacts and charters, but it is still an inference about agent behavior rather than a logged self-report.[^1][^2][^5][^7]
- A different model would probably not have materially fixed the loop. That is a reasoned inference based on the evidence deficit, not a controlled experiment.[^2][^9][^11]

### Lower confidence / notable ambiguity

- The article row's current `status` was later observed as `approved`, whereas earlier inspection during the session showed `revision`; I did not rely on that mutable field because the `usage_events`, `stage_transitions`, and turn transcripts preserve the original run chronology more reliably.[^9][^13]

## Footnotes

[^1]: `C:\Users\jdl44\.nfl-lab\agents\charters\nfl\writer.md:55-83` and `C:\Users\jdl44\.nfl-lab\agents\charters\nfl\writer.md:71-80`.
[^2]: `C:\Users\jdl44\.copilot\session-state\a2bcee28-4d33-421a-acbd-277c225f5aba\research\packers-upstream-artifacts.md:88-113` and `C:\Users\jdl44\.copilot\session-state\a2bcee28-4d33-421a-acbd-277c225f5aba\research\packers-upstream-artifacts.md:133-163`.
[^3]: `C:\github\nfl-eval\src\pipeline\actions.ts:908-932`.
[^4]: `C:\Users\jdl44\.copilot\session-state\a2bcee28-4d33-421a-acbd-277c225f5aba\research\packers-raw-turns.md:1-32`.
[^5]: `C:\Users\jdl44\.copilot\session-state\a2bcee28-4d33-421a-acbd-277c225f5aba\research\packers-raw-turns.md:183-216`.
[^6]: `C:\Users\jdl44\.copilot\session-state\a2bcee28-4d33-421a-acbd-277c225f5aba\research\packers-raw-turns.md:373-402`.
[^7]: `C:\Users\jdl44\.copilot\session-state\a2bcee28-4d33-421a-acbd-277c225f5aba\research\packers-raw-turns.md:405-539`.
[^8]: `C:\Users\jdl44\.copilot\session-state\a2bcee28-4d33-421a-acbd-277c225f5aba\research\packers-raw-turns.md:542-582`.
[^9]: `C:\Users\jdl44\.copilot\session-state\a2bcee28-4d33-421a-acbd-277c225f5aba\research\packers-runtime-evidence.md:5-27`.
[^10]: `C:\github\nfl-eval\src\config\defaults\models.json:3-22` and `C:\github\nfl-eval\src\config\defaults\models.json:87-100`.
[^11]: `C:\Users\jdl44\.nfl-lab\config\models.json:3-22` and `C:\Users\jdl44\.nfl-lab\config\models.json:76-105`.
[^12]: `C:\github\nfl-eval\src\pipeline\actions.ts:1028-1108`.
[^13]: `C:\Users\jdl44\.copilot\session-state\a2bcee28-4d33-421a-acbd-277c225f5aba\research\packers-runtime-evidence.md:29-68`.
[^14]: `C:\github\nfl-eval\src\pipeline\actions.ts:1420-1427` and `C:\github\nfl-eval\src\pipeline\actions.ts:1484-1584`.
[^15]: `C:\Users\jdl44\.copilot\session-state\a2bcee28-4d33-421a-acbd-277c225f5aba\research\packers-upstream-artifacts.md:50-63`.
[^16]: `C:\Users\jdl44\.copilot\session-state\a2bcee28-4d33-421a-acbd-277c225f5aba\research\packers-raw-turns.md:219-248`.
[^17]: `C:\github\nfl-eval\src\pipeline\conversation.ts:291-326`.
[^18]: `C:\github\nfl-eval\src\pipeline\actions.ts:1100-1108`.
[^19]: `C:\github\nfl-eval\tests\pipeline\actions.test.ts:626-635`.
[^20]: `C:\github\nfl-eval\src\llm\model-policy.ts:167-209` and `C:\github\nfl-eval\src\llm\model-policy.ts:256-287`.
[^21]: `C:\Users\jdl44\.nfl-lab\agents\charters\nfl\writer.md:5-10`.
[^22]: `C:\Users\jdl44\.nfl-lab\agents\charters\nfl\editor.md:5-10`.
[^23]: `C:\github\nfl-eval\src\agents\runner.ts:52-60` and `C:\github\nfl-eval\src\agents\runner.ts:132-138` and `C:\github\nfl-eval\src\agents\runner.ts:392-401`.
[^24]: `C:\github\nfl-eval\src\db\repository.ts:454-514`.
[^25]: `C:\github\nfl-eval\src\pipeline\actions.ts:1304-1313` and `C:\Users\jdl44\.copilot\session-state\a2bcee28-4d33-421a-acbd-277c225f5aba\research\packers-runtime-evidence.md:29-42`.
