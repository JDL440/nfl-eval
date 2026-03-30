# Applying the Missing Article's Likely Concepts to `nfl-eval`

## Executive Summary

I could not actually "read the article" because the current session prompt includes no URL, title, or body text, so the analysis below is necessarily concept-first rather than article-specific.[^u1] Even with that limitation, the repo already contains a strong substrate for the kinds of ideas most article-generation/design essays advocate: explicit stages, typed artifacts, constrained tool access, machine-readable validation, human-gated publishing, and a retrospective loop.[^r2][^r3][^db1][^retro1] The highest-leverage opportunity is not another monolithic prompt; it is to turn more of the article-generation process into explicit intermediate products: an angle card, evidence plan, disagreement ledger, outline/thesis pass, and claim ledger feeding Editor and Publisher.[^idea1][^discussion1][^draft1][^editor1] On the engineering side, the same pattern can be dogfooded by treating issue triage, postmortems, and release narratives as "articles" that move through a structured editorial pipeline, especially given the existing Squad/Ralph workflow and the repo's retrospective-digest machinery.[^squad1][^retro1]

## Important Limitation

The missing article source matters. I can map concepts cleanly into this codebase, but I cannot honestly claim "the article says X" because the article itself is absent from the provided context.[^u1] So I am treating the request as: "What kinds of article-generation and engineering-system ideas would fit this app best, given how it is built today?" That framing keeps the recommendations grounded in verified code rather than invented external claims.[^u1][^r1]

## Architecture/System Overview

The app is already an editorial operating system, not just a prompt wrapper. The README describes a dashboard + pipeline engine + agent runner + LLM gateway + SQLite repository + external services stack, and the canonical pipeline is eight stages from Idea Generation through Published.[^r2][^r3] The database schema reinforces that design by storing articles, stage transitions, stage runs, usage events, LLM traces, artifacts, conversations, publisher checklists, notes, and retrospectives as first-class records.[^db1][^db2][^db3][^db4]

ASCII view of the current system and the best concept-insertion points:

```text
User prompt / operator intent
  -> Stage 1: idea generation       [add angle card + gap list]
  -> Stage 2: discussion prompt     [add evidence plan]
  -> Stage 3: panel composition     [add lane schema / quotas]
  -> Stage 4: panel discussion      [add disagreement ledger]
  -> Stage 5: draft writing         [add outline pass + claim ledger]
  -> Stage 6: editor review         [consume claim ledger, enforce contract]
  -> Stage 7: publisher pass        [generate metadata variants + render proof]
  -> Stage 8: dashboard publish     [human gate, Substack sync]
  -> retrospectives + digest        [feed prompt/policy updates back upstream]
```

That architecture is important because it means most improvements can be implemented as new artifacts or validations rather than a risky rewrite of the runner or publishing stack.[^db4][^draft1][^editor1][^publisher1]

## Where the concepts fit best in article generation

### 1. Make Stage 1 produce an "angle card," not just idea markdown

Stage 1 already uses the Lead agent plus the `idea-generation` skill to produce structured idea markdown with a working title, angle/tension, team, and sourced data points; it can also use approved tools like `nflverse-data` and `prediction-markets` when available.[^idea1] That is close to an angle-selection system, but it is still mostly prose. The next step is to persist a compact, structured `angle-card` artifact alongside `idea.md` with fields like `core_decision`, `stakes`, `freshness_confidence`, `known_gaps`, `expected_disagreement`, and `reader_payoff`.

Why this fits the repo:

- Stage 1 already has explicit output-contract pressure in the dashboard request and skill file.[^idea1]
- Artifacts are generic rows keyed by `article_id` and `name`, so adding `angle-card.json` or `angle-card.md` is mechanically cheap.[^db4]
- Later stages already gather upstream artifacts automatically, so an angle card would flow forward without special plumbing once named in stage context config.[^gather1]

This would improve article generation because it separates "what is the actual story?" from "how do we write it?" and makes stale or under-evidenced ideas visible earlier.[^idea1][^gather1]

### 2. Add an explicit evidence plan before the panel runs

The `article-discussion` skill already says good prompts need data anchors, explicit tensions, and open questions, and Stage 2/4 code already gathers context and synthesizes disagreement.[^discussion1] What is missing is a first-class evidence plan artifact that states:

- which claims must be evidenced before the article can take a strong stance,
- which evidence is already present,
- which gaps are acceptable to write around,
- which gaps should block a strong claim.

Today, some of that happens implicitly: Stage 5 extracts claims from discussion outputs, builds fact-check context, runs a lightweight fact-check, and writes `panel-factcheck.md` plus `writer-factcheck.md`.[^draft1] That is useful, but it happens after the panel has already framed the article. Moving part of that logic earlier would make the panel itself better, not just the draft safer.

Concretely, I would insert `evidence-plan.md` between Stage 2 and Stage 4 and have the moderator synthesize against it. That keeps the current architecture intact while reducing late-stage editorial churn.[^discussion1][^draft1]

### 3. Make disagreement a durable artifact, not just a paragraph in the summary

This repo's brand promise is that disagreement is the product. The vision doc explicitly calls out "expert panel disagrees" as a proven capability, and the `substack-article` skill tells Writer to surface disagreements rather than hide them.[^v1][^sub1] Stage 4 already runs individual panelists in parallel and then asks the moderator to preserve tension when synthesizing.[^discussion1]

The opportunity is to promote disagreement from prose to data. I would add a `disagreement-ledger.md` or JSON artifact with entries like:

- topic / question
- side A
- side B
- evidence supporting each side
- what would resolve the disagreement
- whether Writer should present it as unresolved tension or final verdict

Why this matters:

- It gives Writer stronger raw material than a polished summary alone.[^discussion1][^sub1]
- It makes the "Disagreement" section in the article template easier to fill without flattening nuance.[^sub1]
- It creates a reusable evaluation surface for later retrospectives: did the final article keep the real disagreement or accidentally smooth it over?[^retro1]

### 4. Insert a lightweight outline/thesis pass before full draft generation

Stage 5 currently does a lot in one shot: collects context, runs panel fact-checking, runs writer fact-checking, injects previous draft/editor feedback on revision, asks Writer for a full article, validates the draft contract, and retries once if it fails.[^draft1] That is already more disciplined than most prompt pipelines, but it is still asking the biggest generation step to do both architecture and prose at once.

The best leverage here is a tiny intermediate artifact such as `outline.md` or `thesis-stack.md` containing:

- final thesis / recommended path,
- counter-thesis,
- section plan,
- where each panelist contribution lands,
- claims that require cautious phrasing,
- the exact "Next from the panel" teaser target.

This fits because the code already treats artifacts as the source of truth and already distinguishes revision context, editor feedback, and preflight artifacts.[^db4][^draft1] An outline pass would reduce the need for expensive repair retries and make later editor reviews more about correctness and less about structure.[^draft1][^editor1]

### 5. Turn the writer fact-check into a canonical claim ledger shared by Editor and Publisher

The write phase already builds `writer-factcheck.md` and the editor prompt is instructed to treat that artifact as an advisory Stage 5 ledger.[^draft1][^editor1] That is the clearest seam for improvement. Right now, the ledger helps, but the system still passes mostly narrative markdown between roles.

A stronger version would be a structured claim ledger with one row per high-risk claim:

- claim text,
- claim type (`roster`, `stat`, `contract`, `timeline`, `quote`),
- status (`verified`, `attributed`, `omitted`, `unresolved`),
- supporting artifact or URL,
- recommended phrasing strength,
- editor disposition.

Why this is high leverage:

- Stage 5 already extracts claims and produces fact-check artifacts, so the information exists.[^draft1]
- Stage 6 and Stage 7 both do additional deterministic validation; they would benefit from a single source of truth rather than repeated rediscovery.[^editor1][^publisher1]
- The schema already has `artifacts`, `usage_events`, and `llm_traces`, so the ledger can be stored and inspected without new infrastructure.[^db2][^db3][^db4]

### 6. Run the publish formatter earlier as a validation step, not only at publish time

The dashboard publish flow does more than "send to Substack." It converts markdown to ProseMirror, uploads local images to Substack, inserts subscribe widgets and the footer blurb if missing, validates the body, saves or updates the draft URL, and only later publishes the draft live.[^publish1] The prose-rendering code also blocks dense tables that would collapse badly inline and tells operators to render them as images first.[^prose1]

That means the repo already has a real rendering truth source. One of the best concepts to apply is "evaluate the actual deliverable, not just the prompt output." Practically, the system should run a publish-preview render earlier - ideally after Stage 5 and again after Stage 6 - so Writer and Editor can fail on formatting/rendering problems before Stage 7 handoff.[^publish1][^prose1]

This is especially valuable for the article generation piece because canonical article quality in this repo is not just prose. It includes TLDR placement, subscribe widgets, image behavior, tables, and footer/teaser structure.[^sub1][^publisher1][^publish1]

### 7. Generate title/subtitle/TLDR variants as a dedicated packaging step

The canonical article skill makes headline, subheadline, TLDR, and "Next from the panel" contractually important, and Publisher already owns metadata refinement while stopping short of autonomous publication.[^sub1][^publisher1] Right now, Stage 7 mostly checks readiness. A conceptually strong addition would be a packaging step that produces:

- 3 headline variants,
- 2 subtitle variants,
- 2 TLDR variants (tight vs analytical),
- confidence notes on which version best matches the article's real stance.

This recommendation is not "add more AI for its own sake." It follows the repo's existing separation between article drafting and distribution packaging, while still preserving the dashboard's human final gate.[^publisher1][^publish1]

### 8. Use retrospectives as a true prompt/policy tuning loop

The repo already persists revision retrospectives, stores structured findings, and includes a CLI that groups recurring problems into process-improvement and learning-update candidates.[^retro1] That is unusual and powerful. The natural next step is to close the loop automatically:

- recurring structure failures update the `substack-article` skill,
- recurring evidence failures update `article-discussion` or `idea-generation`,
- recurring publisher issues update the publish-preview validator,
- recurring prompt drift creates new deterministic guards.

This is the cleanest way to dogfood article-generation concepts because the system is already instrumented to learn from churn rather than only from successful outputs.[^retro1]

## Dogfooding the same concepts in the engineering system

### 1. Treat GitHub issues and design changes like editorial pieces

The repo already has a Squad team, role charters, routing rules, a Ralph loop, and issue-driven workflow with explicit status movement.[^squad1] That looks a lot like the article pipeline, just pointed at code instead of content. A strong dogfood move would be to formalize an "engineering editorial pipeline":

- Idea: issue or bug report
- Discussion prompt: crisp design question
- Panel composition: code/devops/ux/research roles
- Discussion: structured tradeoff debate
- Draft: implementation plan or PR description
- Editor: code review / design review
- Publisher: merge + changelog + rollout note
- Published: merged PR / deployed change

The point is not metaphor; it is reuse. This repo already believes multi-agent disagreement improves article quality, and the same pattern would improve engineering decision quality if kept bounded and machine-readable.[^squad1][^discussion1]

### 2. Use the retrospective digest for engineering postmortems too

The current retrospective system is article-focused, but the data model is close to what you would want for engineering postmortems: participants, revision count, findings, priorities, and grouped digest output.[^db4][^retro1] Instead of inventing a separate learning system for app-building, the team could dogfood the same structure for:

- repeated PR review churn,
- recurring release breakages,
- recurring agent misroutes,
- tool-loop safety issues,
- prompt/schema drift.

That would align the product's "learning loop" story with the engineering team's real practice.[^retro1][^squad1]

### 3. Use the constrained tool loop as the default dogfood environment

The runner already assembles requested tools from skills, filters them through local/pipeline tool registries, and enforces safety/write rules before exposing them to the model.[^tool1][^tool2] That means the repo already has a strong answer to a classic agentic-systems question: how do you let the model act without giving it everything?

If the missing article argued for more autonomous or tool-using agents, this repo should dogfood that concept through the existing allowlisted tool catalog rather than broader shell/file autonomy. The pattern to expand is "small explicit tools with known safety," not "give the model the repo."[^tool1][^tool2]

### 4. Produce engineering narratives with the same packaging discipline as articles

The publish flow shows the app already understands that raw markdown is not the final product; rendered delivery, metadata, images, CTA placement, and final human gate all matter.[^publish1][^publisher1] The engineering side could reuse that mindset for:

- changelog entries,
- milestone summaries,
- issue-resolution reports,
- architecture decision records generated from discussion artifacts.

In other words, the team can dogfood the article system not only by writing about football, but by using the same `draft -> edit -> package -> publish` discipline for its own operational communication.[^squad1][^publish1]

## Prioritized roadmap

### Now

1. Add `angle-card` and `evidence-plan` artifacts. This is the safest, highest-return change because artifacts are already generic and context gathering already supports upstream composition.[^db4][^gather1]
2. Add early publish-preview validation after Stage 5. This will catch TLDR/table/image/render issues before Stage 7.[^publish1][^prose1][^sub1]
3. Start using retrospective digest output to drive targeted updates to `idea-generation`, `article-discussion`, and `substack-article` skills.[^retro1]

### Next

1. Add `disagreement-ledger` and `outline/thesis-stack` artifacts between panel synthesis and full draft.[^discussion1][^draft1]
2. Convert `writer-factcheck` into a structured claim ledger that Editor and Publisher both consume.[^draft1][^editor1][^publisher1]
3. Add a packaging pass for headline/subtitle/TLDR variants before dashboard review.[^sub1][^publisher1]

### Later

1. Dogfood the editorial pipeline on engineering issues, postmortems, and release narratives through Squad/Ralph.[^squad1]
2. Generalize retrospective storage and digest logic so content and engineering workflows learn from the same system.[^retro1]
3. Consider stronger typed schemas for stage outputs where the repo currently relies on markdown conventions alone.[^idea1][^panel1][^editor1]

## Key repositories / files summary

| Repository | Purpose | Key Files |
| --- | --- | --- |
| [JDL440/nfl-eval](https://github.com/JDL440/nfl-eval) | Current app, article pipeline, dashboard, publish flow, Squad workflow | `C:\github\nfl-eval\worktrees\agenteval\src\pipeline\actions.ts`, `C:\github\nfl-eval\worktrees\agenteval\src\db\schema.sql`, `C:\github\nfl-eval\worktrees\agenteval\src\dashboard\server.ts`, `C:\github\nfl-eval\worktrees\agenteval\src\services\substack.ts`, `C:\github\nfl-eval\worktrees\agenteval\src\config\defaults\skills\*.md`, `C:\github\nfl-eval\worktrees\agenteval\README.md` |

## Confidence Assessment

High confidence:

- The current pipeline shape, storage model, tool-loop design, and publish handoff are directly verified in the repo.[^r2][^r3][^db1][^db2][^db3][^db4][^tool1][^tool2][^publish1]
- The recommendations above are mechanically compatible with the current architecture because they mostly add artifacts, validations, or skill/prompt changes rather than replacing core infrastructure.[^db4][^gather1][^publisher1]

Medium confidence:

- The highest-leverage improvements for article generation are the intermediate-artifact and validation ideas, because the repo already invests heavily in stage contracts, preflight checks, and machine-readable guards.[^draft1][^editor1][^publisher1]
- Dogfooding the same pattern on engineering workflow should fit culturally because Squad/Ralph already treats issues as structured work routed across specialized roles.[^squad1]

Low confidence / inferred:

- Any claim about the external article's exact thesis, examples, or terminology would be speculation, since the article itself was not provided in this session.[^u1]

## Footnotes

[^u1]: Current session prompt / research task; no article URL, title, or article body was provided.
[^r1]: `C:\github\nfl-eval\worktrees\agenteval\README.md:3-15`
[^r2]: `C:\github\nfl-eval\worktrees\agenteval\README.md:109-140`
[^r3]: `C:\github\nfl-eval\worktrees\agenteval\README.md:191-202`
[^v1]: `C:\github\nfl-eval\worktrees\agenteval\VISION.md:21-29`
[^db1]: `C:\github\nfl-eval\worktrees\agenteval\src\db\schema.sql:9-30`
[^db2]: `C:\github\nfl-eval\worktrees\agenteval\src\db\schema.sql:51-121`
[^db3]: `C:\github\nfl-eval\worktrees\agenteval\src\db\schema.sql:136-179`
[^db4]: `C:\github\nfl-eval\worktrees\agenteval\src\db\schema.sql:272-279,339-406`
[^idea1]: `C:\github\nfl-eval\worktrees\agenteval\src\dashboard\server.ts:1200-1243`; `C:\github\nfl-eval\worktrees\agenteval\src\config\defaults\skills\idea-generation.md:32-76`
[^gather1]: `C:\github\nfl-eval\worktrees\agenteval\src\pipeline\actions.ts:728-767`
[^panel1]: `C:\github\nfl-eval\worktrees\agenteval\src\pipeline\actions.ts:861-918`; `C:\github\nfl-eval\worktrees\agenteval\src\config\defaults\skills\panel-composition.md:13-57`
[^discussion1]: `C:\github\nfl-eval\worktrees\agenteval\src\pipeline\actions.ts:933-1049`; `C:\github\nfl-eval\worktrees\agenteval\src\config\defaults\skills\article-discussion.md:29-44,82-95,131-200`
[^draft1]: `C:\github\nfl-eval\worktrees\agenteval\src\pipeline\actions.ts:1075-1273`; `C:\github\nfl-eval\worktrees\agenteval\src\config\defaults\skills\substack-article.md:19-40,65-184`
[^editor1]: `C:\github\nfl-eval\worktrees\agenteval\src\pipeline\actions.ts:1286-1382`; `C:\github\nfl-eval\worktrees\agenteval\src\config\defaults\skills\editor-review.md:15-72`
[^publisher1]: `C:\github\nfl-eval\worktrees\agenteval\src\pipeline\actions.ts:1393-1462`; `C:\github\nfl-eval\worktrees\agenteval\src\config\defaults\skills\publisher.md:31-139`
[^publish1]: `C:\github\nfl-eval\worktrees\agenteval\src\dashboard\server.ts:326-352,435-559,1905-1954`; `C:\github\nfl-eval\worktrees\agenteval\src\services\substack.ts:138-211`
[^prose1]: `C:\github\nfl-eval\worktrees\agenteval\src\services\prosemirror.ts:520-547`
[^tool1]: `C:\github\nfl-eval\worktrees\agenteval\src\agents\runner.ts:795-845,857-980`
[^tool2]: `C:\github\nfl-eval\worktrees\agenteval\src\agents\local-tools.ts:437-481`; `C:\github\nfl-eval\worktrees\agenteval\src\tools\pipeline-tools.ts:53-280`
[^retro1]: `C:\github\nfl-eval\worktrees\agenteval\src\pipeline\actions.ts:392-417`; `C:\github\nfl-eval\worktrees\agenteval\src\db\repository.ts:1336-1467`; `C:\github\nfl-eval\worktrees\agenteval\src\cli.ts:179-376`
[^sub1]: `C:\github\nfl-eval\worktrees\agenteval\src\config\defaults\skills\substack-article.md:19-184`
[^squad1]: `C:\github\nfl-eval\worktrees\agenteval\README.md:293-383`

