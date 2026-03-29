# Applying Anthropic's Harness Design Ideas to `nfl-eval`

## Executive Summary

Anthropic's article argues that long-running agent systems improve when they separate planning, generation, and evaluation; make "done" explicit through negotiated contracts; persist structured handoff artifacts between phases; and regularly re-check which harness components are still load-bearing as models improve.[^a1][^a2][^a3][^a4][^a5] `nfl-eval` already has many of those primitives: an eight-stage article pipeline, explicit artifact storage, trace and usage tables, guarded tool access, and a post-run retrospective digest.[^r1][^db1][^db2][^run1][^retro1] The biggest gap is that article generation still treats planning, writing, and evaluation as adjacent stages, but not as a tightly-coupled harness with explicit contracts and skeptical evaluator loops.[^act1][^sub1][^edit1]

My updated recommendation is to evolve the article pipeline toward a **planner -> generator -> evaluator** harness rather than add more free-form prompting. Concretely, that means: add an `article-contract` artifact before drafting, make Editor evaluate against that contract plus explicit thresholds, introduce a pre-publish render/QA pass, and add context-reset / handoff mechanics for long revision chains.[^a2][^a3][^act1][^publish1] On the engineering side, the same ideas map cleanly onto Squad/Ralph as **Lead -> Code -> Reviewer/QA** with issue contracts, handoff artifacts, and retrospective-driven harness pruning.[^a5][^squad1][^retro1]

## What the article actually contributes

The article's most useful ideas for this repo are not "use more agents" in the abstract. They are four more specific harness moves.

First, Anthropic found that naïve long-running agents drift because they lose coherence over long tasks and because they are poor judges of their own work; separating the work-doer from the evaluator was a major lever.[^a1] Second, their stronger coding harness used three personas — **planner, generator, evaluator** — each with a specific responsibility rather than one monolithic agent.[^a2] Third, before each sprint the generator and evaluator negotiated a **sprint contract** defining what would be built and how success would be verified, and agents communicated through files so each step had explicit handoff artifacts.[^a3] Fourth, they stress-tested harness complexity over time, removing components that were no longer load-bearing as model capability improved; the evaluator remained useful only when tasks sat beyond what the base model could reliably do solo.[^a4][^a5]

Those ideas fit `nfl-eval` unusually well because the repo is already built as a stateful editorial harness rather than a chat app. The README describes a dashboard, pipeline engine, agent runner, model-routing gateway, SQLite repository, and publication services.[^r1] The schema stores articles, stage runs, usage events, LLM traces, artifacts, article conversations, revision summaries, and retrospectives as first-class entities.[^db1][^db2] In other words: the infrastructure for a better harness already exists.

## Current repo architecture through the article's lens

Today the app uses an eight-stage content pipeline from Idea Generation through Published.[^r2] In practice, the key article-generation stages are:

- Stage 1-4: planning and evidence gathering (`generatePrompt`, `composePanel`, `runDiscussion`), including parallel panelist execution and synthesis.[^act1]
- Stage 5: writing (`writeDraft`), including panel fact-check, writer fact-check, revision context, and one retry on structural failure.[^act2]
- Stage 6: evaluation (`runEditor`), where Editor reviews the draft and returns `APPROVED`, `REVISE`, or `REJECT`.[^act3][^edit1]
- Stage 7-8: packaging and publication, where Publisher verifies readiness and the dashboard converts markdown to ProseMirror, uploads images, injects subscribe/footer chrome, validates the payload, saves the Substack draft, and then publishes it live.[^pub1][^publish1]

That means the repo already approximates planner/generator/evaluator. But two article ideas are still under-realized:

1. **No explicit negotiated contract** currently bridges planning and evaluation. Writer gets rich context, but Editor is not grading against a shared, pre-agreed artifact that says what this article must prove.[^act2][^act3]
2. **Evaluator skepticism exists, but not as a tuned harness loop.** Editor checks quality and structure, but there is no dedicated evaluator prompt tuned around contract thresholds the way Anthropic tuned QA against concrete fail criteria.[^a3][^edit1]

## How I would apply the article to the article-generation system

### 1. Introduce an `article-contract.md` artifact before Stage 5

The strongest direct application is Anthropic's sprint-contract idea. Their generator and evaluator agreed on what "done" meant before building, because the planner spec stayed intentionally high-level.[^a3] `nfl-eval` has the same shape: Stage 1-4 generate ideas, prompts, panels, and summaries, but nothing currently crystallizes those into a compact contract that both Writer and Editor must honor.[^act1][^act2]

I would add an `article-contract.md` artifact at the end of Stage 4 containing:

- article thesis / core question,
- required evidence anchors,
- required disagreement to preserve,
- mandatory sections,
- acceptable uncertainty / caveats,
- explicit fail conditions for Editor,
- publish-readiness checks relevant to this article.

Where it lands:

- `src\pipeline\actions.ts` after `runDiscussion-synthesis` to write the contract artifact.[^act1]
- `src\pipeline\context-config.ts` / gather-context path so Stage 5 and Stage 6 automatically receive it as upstream context.[^ctx1]
- `src\db\schema.sql` does not need a new table; the existing `artifacts` table can store it directly.[^db2]

Why this matters: it turns the article pipeline from "Writer gets a lot of context" into "Writer is implementing an explicit contract, and Editor is evaluating against the same contract." That is the cleanest translation of the article's harness pattern.[^a3]

### 2. Strengthen the planner role instead of making Writer think harder

Anthropic's planner expanded a short prompt into an ambitious but still high-level spec, avoiding early over-specification of implementation details.[^a2] In `nfl-eval`, Stage 1 and Stage 2 already play a planner-like role: the idea-generation skill creates the angle and sourced data points, and the discussion prompt shapes the central question and tensions.[^idea1][^act1]

The improvement is to make planning more explicit and more product-like. Stage 1/2 should produce a compact planning bundle:

- `idea.md` (existing),
- `discussion-prompt.md` (existing),
- `article-contract.md` (new),
- optional `evidence-gap.md` listing what is still uncertain.

This matches the article's insight that high-level planning should define outputs and constraints, while leaving some implementation freedom to the generator.[^a2] In repo terms, Lead should be more ambitious in defining what the article must accomplish, while Writer stays focused on execution.

### 3. Make Editor a true evaluator with contract thresholds

Anthropic's evaluator only added value once it was tuned to be skeptical, test concretely, and fail work when any criterion fell below threshold.[^a1][^a4] `nfl-eval` already has the right actor for this: Editor. The problem is that Editor is still framed more as a reviewer than as a harness evaluator with explicit pass/fail criteria tied to a contract.[^edit1][^act3]

I would evolve Editor to grade against four article-specific thresholds analogous to Anthropic's design/coding rubric:

- **Evidence completeness** — are the article's load-bearing claims actually supported?
- **Disagreement fidelity** — did Writer preserve the interesting tension rather than average it away?
- **Reader usefulness** — does the piece answer a real franchise question with a clear verdict?
- **Publishability** — does the draft satisfy the Substack/article contract and avoid stale or over-precise claims?

Where it lands:

- `src\config\defaults\skills\editor-review.md` for the explicit threshold language and failure rules.[^edit1]
- `src\pipeline\actions.ts` in `runEditor` so the task references `article-contract.md` and possibly emits a machine-readable score block before the existing verdict.[^act3]

This is a harness improvement, not just a prompt tweak: it makes evaluation more reliable and repeatable.

### 4. Add a pre-publish render/QA evaluator pass

Anthropic's evaluator used Playwright to interact with the live product, not just inspect code or static outputs.[^a1][^a4] `nfl-eval` already has a parallel reality: the thing readers consume is not raw markdown but the rendered/published output. The dashboard publish path converts `draft.md` into a ProseMirror document, uploads images, inserts subscribe widgets and footer blurbs if missing, validates the body, saves the draft, and then publishes to Substack.[^publish1] The Substack article skill also treats top-of-article structure and TLDR placement as hard contract items.[^sub1]

So the repo needs an evaluator pass aimed at **rendered article behavior**, not just prose quality. I would add a deterministic or agent-assisted `publish-preview` pass after Stage 6 that:

- builds the ProseMirror payload,
- validates TLDR, subscribe widgets, footer, and image embedding,
- screenshots or inspects the preview for obvious layout issues,
- fails before Stage 7 if the delivered article shape is wrong.

Where it lands:

- `src\dashboard\server.ts` `buildPublishPresentation()` / `enrichSubstackDoc()` path for the actual render truth source.[^publish1]
- `src\pipeline\actions.ts` as a new surface, likely between Editor and Publisher, or folded into Stage 7 as a stricter gate.[^act3][^pub1]

This is one of the highest-ROI changes because the final product is a publish artifact, not just a draft.

### 5. Use structured handoff artifacts for long revision chains and context resets

A major point in the article is that long-running agents lose coherence, and context resets only work if structured handoff artifacts carry enough state to resume cleanly.[^a1] `nfl-eval` already has many of those ingredients: artifacts, article conversations, revision summaries, and LLM traces.[^db2] But the active drafting/evaluation loop still mostly relies on raw accumulated context plus a compact revision summary.[^act2][^act3]

I would add a dedicated `handoff.md` artifact whenever:

- revision count exceeds a threshold,
- prompt/context size approaches a configurable budget,
- a provider session is intentionally reset.

That handoff should include:

- current article state,
- latest contract,
- unresolved editor blockers,
- evidence still missing,
- next exact task.

Where it lands:

- `src\agents\runner.ts` near trace/context assembly, where memory, context parts, and conversation context are already composed.[^run1]
- `src\llm\providers\copilot-cli.ts` near the existing session-reuse / one-shot execution plan, which already distinguishes resumed vs one-shot modes and records that metadata.[^cli1]
- `src\db\schema.sql` again does not need a new primitive because `artifacts`, `article_conversations`, and `llm_traces` already exist.[^db2]

The key choice here is not whether to reset every time, but whether the harness can do so cleanly when needed.

### 6. Be willing to simplify the article harness as models improve

Anthropic's later lesson is just as important as the multi-agent architecture: remove constructs that are no longer load-bearing.[^a5] This repo should apply that discipline to its article pipeline.

Examples of components worth stress-testing:

- Are all current stages necessary for simple article types, or could some "easy" runs collapse Stage 2-4 into a lighter path?
- Is parallel panel execution still worth its latency/cost for low-depth articles?
- Is the current retry/self-heal behavior in Stage 5 sufficient, or should it be replaced by a smaller contract-fix loop?

You already have the measurement substrate to answer these questions: `usage_events`, `llm_traces`, and `article_retrospectives` can reveal which stages add real quality lift versus just cost and delay.[^db1][^db2][^retro1]

## How I would dogfood the article in Squad / engineering workflow

### 1. Recast Squad as planner -> generator -> evaluator

The README already describes a multi-agent engineering system: Lead triages and coordinates, Code/Data/UX/DevOps implement, Ralph watches the queue, and Scribe records context.[^squad1] That maps almost perfectly onto the article's harness pattern.

A practical dogfood model is:

- **Planner:** Lead,
- **Generator:** Code / Data / UX / DevOps,
- **Evaluator:** Code-review agent, Lead, or a dedicated QA/reviewer loop.

The important shift is not role names; it is to make these roles explicit in issue execution rather than implicit.

### 2. Add issue contracts before coding starts

Anthropic's sprint contracts were a bridge between broad product intent and testable execution.[^a3] Squad issues could adopt the same pattern through an `issue-contract.md` artifact or issue comment template containing:

- scope for this round,
- acceptance criteria,
- out-of-scope items,
- verification method,
- who evaluates completion.

Where it lands:

- `.squad\agents\lead\charter.md` or related Squad skills as a new requirement before handing off work.
- existing issue-comment/TLDR workflow documented in `README.md` already gives a place to put it.[^squad1]

### 3. Use retrospectives to decide which engineering harness pieces still matter

The repo already has a retrospective digest that groups findings into process-improvement and learning-update candidates.[^retro1] That is the exact mechanism you want for the article's "remove what is no longer load-bearing" principle.[^a5]

In engineering terms, use retrospectives to ask:

- Which agent handoffs repeatedly add value?
- Which review steps catch real bugs versus ceremonial noise?
- Which prompts or checks have gone stale after model improvements?

This is especially relevant to Ralph and Squad because they are long-running orchestration systems in their own right.[^squad1]

## New plan

### Phase 1 — Contract-first article harness

1. Add `article-contract.md` as a first-class artifact after Stage 4.
2. Feed that contract into Stage 5 Writer and Stage 6 Editor automatically via `gatherContext()`.
3. Update Editor to score against explicit threshold categories before emitting `APPROVED` / `REVISE` / `REJECT`.[^ctx1][^act3][^edit1]

### Phase 2 — Evaluator-strengthening and delivery QA

1. Add a pre-publish render/QA pass using the existing publish transformation path.
2. Record failures as structured artifacts and usage events.
3. Use retrospective digest data to tune evaluator strictness and article-contract fields.[^publish1][^retro1]

### Phase 3 — Long-running harness hygiene

1. Add explicit `handoff.md` artifacts for long revision chains.
2. Introduce context-budget / reset heuristics in the runner/provider path.
3. Periodically audit which stages/loops are still adding quality lift versus just cost.[^a1][^cli1][^db1]

### Phase 4 — Dogfood in Squad

1. Introduce `issue-contract.md` or equivalent issue-comment contract.
2. Make planner/generator/evaluator roles explicit in Squad workflows.
3. Extend retrospective digest thinking to engineering work so harness complexity stays honest.[^squad1][^retro1]

## Recommendation priority

If you only do three things, I would do these first:

1. **Add `article-contract.md`.** This is the cleanest translation of the article and will improve both drafting and editing immediately.[^a3][^act1]
2. **Turn Editor into a stricter evaluator against that contract.** This is where the biggest quality lift likely sits.[^a1][^edit1]
3. **Add pre-publish render QA.** Your real product is the rendered article, and you already have the code to evaluate that surface.[^publish1][^sub1]

## Confidence Assessment

High confidence:

- The article's core mechanisms are planner/generator/evaluator roles, negotiated contracts, file-based handoffs, and complexity pruning as models improve.[^a1][^a2][^a3][^a4][^a5]
- `nfl-eval` already has the architectural seams to absorb those ideas without a rewrite: stages, artifacts, traces, usage, publish transformations, and retrospectives.[^r1][^db1][^db2][^run1][^publish1][^retro1]

Medium confidence:

- `article-contract.md` plus stricter Editor evaluation is the highest-value near-term change. It matches the article well and fits the existing code shape, but the exact contract schema will need iteration in real runs.[^a3][^act2][^act3]
- Pre-publish QA should catch real issues because the publish path is already deterministic and validation-oriented, but the right amount of agentic vs deterministic checking will need experimentation.[^publish1]

Lower confidence:

- Whether the current article pipeline should later collapse some stages depends on empirical data from your own runs and model/provider mix, not just the article's philosophy.[^a5][^db1]

## Footnotes

[^a1]: [Anthropic article](https://www.anthropic.com/engineering/harness-design-long-running-apps), sections "Why naive implementations fall short" and "Frontend design: making subjective quality gradable". Key points quoted/paraphrased: agents lose coherence over lengthy tasks; self-evaluation is weak; separating the agent doing the work from the agent judging it is a strong lever.
[^a2]: [Anthropic article](https://www.anthropic.com/engineering/harness-design-long-running-apps), section "Scaling to full-stack coding". Key points quoted/paraphrased: the harness used planner, generator, and evaluator personas; planner expands short prompts into specs; generator works feature-by-feature; evaluator uses QA criteria.
[^a3]: [Anthropic article](https://www.anthropic.com/engineering/harness-design-long-running-apps), section "The architecture". Key points quoted/paraphrased: before each sprint, generator and evaluator negotiated a sprint contract; communication was handled via files; the contract defined what would be built and how success would be verified.
[^a4]: [Anthropic article](https://www.anthropic.com/engineering/harness-design-long-running-apps), sections "Iterating on the harness" and "Removing the sprint construct". Key points quoted/paraphrased: simplify methodically, remove one component at a time, and keep the evaluator when tasks remain beyond what the base model handles reliably.
[^a5]: [Anthropic article](https://www.anthropic.com/engineering/harness-design-long-running-apps), section "What comes next". Key point quoted/paraphrased: re-examine a harness as models improve, stripping away pieces that are no longer load-bearing and adding new pieces for greater capability.
[^r1]: `C:\github\nfl-eval\worktrees\agenteval\README.md:7-14,109-140`
[^r2]: `C:\github\nfl-eval\worktrees\agenteval\README.md:191-202`
[^db1]: `C:\github\nfl-eval\worktrees\agenteval\src\db\schema.sql:9-178`
[^db2]: `C:\github\nfl-eval\worktrees\agenteval\src\db\schema.sql:190-406`
[^ctx1]: `C:\github\nfl-eval\worktrees\agenteval\src\pipeline\actions.ts:698-767`
[^act1]: `C:\github\nfl-eval\worktrees\agenteval\src\pipeline\actions.ts:822-1049`
[^act2]: `C:\github\nfl-eval\worktrees\agenteval\src\pipeline\actions.ts:1062-1273`
[^act3]: `C:\github\nfl-eval\worktrees\agenteval\src\pipeline\actions.ts:1286-1462`
[^run1]: `C:\github\nfl-eval\worktrees\agenteval\src\agents\runner.ts:795-980`; `C:\github\nfl-eval\worktrees\agenteval\src\agents\local-tools.ts:437-540`
[^cli1]: `C:\github\nfl-eval\worktrees\agenteval\src\llm\providers\copilot-cli.ts:224-352`
[^sub1]: `C:\github\nfl-eval\worktrees\agenteval\src\config\defaults\skills\substack-article.md:19-39,86-183`
[^edit1]: `C:\github\nfl-eval\worktrees\agenteval\src\config\defaults\skills\editor-review.md:15-72`
[^pub1]: `C:\github\nfl-eval\worktrees\agenteval\src\pipeline\actions.ts:1393-1462`
[^publish1]: `C:\github\nfl-eval\worktrees\agenteval\src\dashboard\server.ts:326-559`
[^retro1]: `C:\github\nfl-eval\worktrees\agenteval\src\cli.ts:179-376`; `C:\github\nfl-eval\worktrees\agenteval\src\db\schema.sql:377-410`
[^idea1]: `C:\github\nfl-eval\worktrees\agenteval\src\config\defaults\skills\idea-generation.md:32-76`; `C:\github\nfl-eval\worktrees\agenteval\src\dashboard\server.ts:1200-1243`
[^squad1]: `C:\github\nfl-eval\worktrees\agenteval\README.md:293-383`
