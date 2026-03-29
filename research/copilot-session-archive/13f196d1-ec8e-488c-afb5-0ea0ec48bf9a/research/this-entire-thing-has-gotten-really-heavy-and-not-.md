# Pipeline and Dashboard Simplification Research

## Executive Summary

The current system is heavy for two reasons: each stage mixes deterministic application logic with large runtime prompt payloads, and the dashboard exposes a full editorial workstation even for the simplest mobile tasks.[^1][^2][^3] The biggest structural problem is not any single stage; it is that many stages have **multiple sources of truth** at once: route-assembled tasks, seeded skills, verbose charters, memory injection, context presets, and per-stage UI controls all try to shape the same behavior.[^4][^5][^6] That overlap is especially visible at Stage 1, where idea creation has two API entry points, the dashboard route assembles its own Lead task, the `idea-generation` skill contains both the current process and a long legacy process, and the Lead charter embeds a second idea-generation protocol with different model guidance.[^7][^8][^9]

My recommendation is to simplify in this order: first remove duplicated source-of-truth layers, then simplify Stage 1, then collapse or constrain the Stage 2–4 discussion pipeline, then reduce Stage 5–7 to a narrower “ship a good article” path, and finally split the dashboard into **mobile-primary core flows** and **desktop/advanced detail pages**.[^10][^11][^12] If the near-term goal is “get back to a simple pass with fewer revisions,” the first implementation slice should be **Stage 1 + home/new-idea UX**: one idea entry path, one idea-generation contract, one model policy source, fewer form controls, and no legacy instructions loaded into the runtime prompt.[^7][^8][^9]

## Query Type

This is a **technical deep-dive with product/UX analysis**: the question asks how the pipeline is implemented today, what logic is hard-coded in the app versus delegated to LLM instructions, and where both the process and dashboard UX should be simplified.[^1][^2]

## Architecture / System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│ Dashboard (Hono + HTMX)                                        │
│ - Home / New Idea / Article Detail / Publish / Preview         │
│ - Create idea, start auto-advance, review artifacts, publish   │
└─────────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Pipeline Engine                                                 │
│ - Deterministic stage guards and stage transitions              │
│ - Stage 1→8 transition map                                      │
└─────────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage Actions                                                   │
│ - generatePrompt / composePanel / runDiscussion / writeDraft   │
│ - runEditor / runPublisherPass / publish                       │
│ - each action gathers context, calls AgentRunner, writes files │
└─────────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ AgentRunner                                                     │
│ - system prompt = charter + skills + memory + roster           │
│ - user message = conversation context + article context + task │
│ - model selection via model policy / stage keys                │
└─────────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ SQLite Repository + Artifacts                                   │
│ - articles, stage_transitions, stage_runs, publisher_pass      │
│ - per-article artifacts like idea.md, discussion-summary.md    │
└─────────────────────────────────────────────────────────────────┘
```

This architecture is solid as an audit-friendly pipeline, but it is not simple. `README.md` explicitly positions the app as a multi-stage stack with Hono dashboard, SQLite repository, agent runner, LLM gateway, and service integrations, while the eight-stage pipeline is enforced in `types.ts` and `engine.ts`.[^1][^13][^14] The issue is that the pipeline has accumulated **too many shaping layers per stage**, not that the stage machine itself is wrong.[^5][^6][^10]

## What Is Hard-Coded in the App vs. Delegated to LLM Instructions

### Hard-coded / cardified in application logic

The deterministic side is strong and centralized. Stage names and valid stage numbers are fixed in `types.ts`, the `TRANSITION_MAP` in `engine.ts` controls which transition is allowed from each stage, and guard functions enforce concrete artifact prerequisites like `idea.md`, `discussion-prompt.md`, `panel-composition.md`, `discussion-summary.md`, `draft.md`, editor approval, and publisher pass state.[^13][^14] The article record, stage transition row, publisher checklist row, pinned agents, stage runs, and usage events are all stored in SQLite rather than hidden inside prompts.[^15][^16][^17]

### Delegated to runtime prompt composition

At runtime, the `AgentRunner` composes a system prompt from charter identity, responsibilities, skills, memory recall, and optional roster context; then it builds the user message from article context, full upstream artifact text, conversation context, and the action-specific task string.[^5][^6] On top of that, per-stage context presets in `context-config.ts` determine which artifacts are injected for each action, and the default preset is `rich`, not `balanced`, meaning Writer and Editor frequently receive a wide upstream bundle by default.[^4][^18]

### Why this distinction matters

This is the core simplification opportunity: the app already has a reliable deterministic shell, but it keeps adding stage behavior to prompt layers anyway. In practice, that means a stage can be shaped by the transition engine, the action function, the route or task string, the charter, the skill, memory recall, and upstream artifact injection all at once.[^4][^5][^6] That is what makes the system feel heavy.

## Stage-by-Stage Walkthrough and Simplification Recommendations

## Stage 1 — Idea Generation

### What exists in code today

Stage 1 currently has **two different creation paths**. `/api/articles` creates a bare article row and writes a minimal `idea.md` containing only `# {title}`, while `/api/ideas` runs the Lead agent with the `idea-generation` skill, team context, roster context, depth level, optional pinned agents, and `IDEA_TEMPLATE`, then stores the generated `idea.md`, optional `idea.thinking.md`, and usage event data.[^7][^15] The Stage 1 dashboard form in `new-idea.ts` posts to `/api/ideas`, not `/api/articles`, and then separately triggers auto-advance from the client after creation if the checkbox is enabled.[^19][^20]

### What exists in instructions today

The instruction load for Stage 1 is unusually heavy. The `idea-generation` skill says idea generation must always use `claude-opus-4.6`, must fetch current data before generating any angle, and includes a long “OLD PROCESS” section that is explicitly “for context only” but still lives in the same runtime-loaded file.[^8] The Lead charter also embeds its own GitHub-issue-driven idea generation protocol, again hardcoding `claude-opus-4.6` and detailing a multi-step workflow before the rest of the article pipeline.[^9]

### Where the sources of truth conflict

The model policy conflicts are the clearest example. `src\config\defaults\models.json` sets `lead`, `writer`, and `editor` to `gpt-5-mini`, while `idea-generation.md` and the Lead charter both hardcode a top-tier Claude requirement, and `article-discussion.md` says model policy is the source of truth.[^8][^9][^21][^22] The runner itself uses agent stage keys and model policy unless a charter explicitly overrides the model, so the system is already designed for central policy—but the docs loaded into prompts are not aligned with that reality.[^5][^21]

### Why Stage 1 feels heavy

Stage 1 is doing too many jobs at once for the dashboard path: prompt drafting, team selection, depth selection, optional expert pinning, optional auto-advance, roster context injection, title extraction, slug generation, thinking artifact persistence, and usage tracking.[^7][^19][^20] The UI also exposes advanced features—team chip grid, pinned agents, and auto-advance—before the user has even created the idea.[^19][^23]

### Aggressive simplification recommendation for Stage 1

This should be the **first simplification slice**.

1. Keep **one** Stage 1 entry point: `/api/ideas`. Remove or de-emphasize `/api/articles` for dashboard users so there is a single creation contract.[^7]
2. Make the Stage 1 runtime source of truth be **one compact idea-generation contract** plus model policy, not a route task + large skill + charter protocol + legacy section.[^5][^8][^9][^21]
3. Strip the `idea-generation` skill down to current rules only. Move the legacy “OLD PROCESS” section into non-runtime documentation so it does not bloat prompts.[^8]
4. Move pinned agents out of the primary mobile idea flow and into an advanced option or the later article detail page. It is useful, but it is not core to the simplest path.[^19][^23]
5. Treat auto-advance as an advanced toggle or profile default, not a front-and-center per-idea decision. Right now the form stores it in `localStorage` and triggers a second client-side fetch after creation, which is another behavior layer to reason about.[^19]

### Suggested simplified Stage 1 contract

For the “simple pass” path, Stage 1 should only require:
- prompt
- primary team (optional but preferred)
- depth level

Everything else should be inferred or deferred. That is enough to create a good idea without pushing workflow complexity into the first screen.[^7][^19]

## Stage 2 — Discussion Prompt

### What exists in code today

Stage 2 is deterministic in the engine and relatively simple in the action: `generatePrompt()` gathers the idea artifact, ensures roster context if a primary team exists, then runs the Lead agent with the `discussion-prompt` skill and saves `discussion-prompt.md`.[^14][^24]

### What exists in instructions today

The `discussion-prompt` skill is itself quite opinionated: it requires five sections, anti-pattern rules, and a detailed template with Core Question, Key Tensions, Data Anchors, The Paths, and Panel Instructions.[^25] The `article-discussion` skill then restates much of the same Stage 2–4 workflow in longer form, including prompt-writing guidance, panel assembly rules, model routing notes, and panel prompt templates.[^22][^26]

### Why Stage 2 feels heavy

The problem here is duplication more than logic. The code already knows Stage 2 means “Lead generates discussion prompt from idea,” but there are at least two skill surfaces describing how to do it, plus the route/action task itself.[^24][^25][^26] That increases the chance that Lead receives overlapping or stale guidance.

### Aggressive simplification recommendation for Stage 2

Make `discussion-prompt.md` the only stage-specific runtime skill for Stage 2 and demote the overlapping Stage 2 content inside `article-discussion.md` into documentation or remove it.[^25][^26] More importantly, consider collapsing Stage 2 and Stage 3 into a single Lead output: “discussion frame + recommended panel,” since panel choice is downstream of prompt framing anyway.[^24][^27]

## Stage 3 — Panel Composition

### What exists in code today

`composePanel()` gathers prompt context, builds a categorized agent roster from available charters, reads any pinned agents from the repository, and asks Lead to select a panel under depth-dependent size rules before saving `panel-composition.md`.[^24][^16] The panel-selection rules are also encoded in the route task string itself—always include team agent, always include a specialist, respect depth limits, keep distinct lanes.[^24]

### What exists in instructions today

The `panel-composition` skill repeats the size limits, selection rules, and output format, while `article-discussion.md` includes yet another panel composition matrix and size guidance by depth level.[^27][^22]

### Why Stage 3 feels heavy

This stage uses LLM judgment to solve a problem that is already highly constrained in code and docs. The system knows the depth, the team, the available roster, the pinned agents, and a fairly small matrix of recommended panel types.[^24][^27] That makes Stage 3 a prime candidate for deterministic simplification.

### Aggressive simplification recommendation for Stage 3

Replace free-form LLM panel selection with **recipe-based panel composition** for the main path. For example:
- contract / cap topic → team agent + cap + playerrep
- draft topic → team agent + draft + collegescout
- scheme topic → team agent + offense or defense + analytics

Then let Lead override only when necessary. This would remove one LLM stage from the default loop while still preserving panel diversity for advanced cases.[^24][^27]

## Stage 4 — Panel Discussion

### What exists in code today

`runDiscussion()` parses the panel composition, spawns each panelist in parallel, writes individual `panel-{agent}.md` artifacts, then runs a panel moderator synthesis pass to create `discussion-summary.md`.[^24] If panel parsing fails, it falls back to a single `panel-moderator` pass; if all panelists fail, it falls back again to a moderator doing all roles itself.[^24]

### What exists in instructions today

The `article-discussion` skill treats this as a rich inner loop: spawn all panelists simultaneously, include identity, focus lane, full data anchors, path framing, output token budgets, and save-to paths, then wait for all agents and synthesize them.[^22]

### Why Stage 4 feels heavy

This is probably the single biggest contributor to pipeline weight. It multiplies model calls, artifacts, usage events, failure modes, and synthesis complexity in the name of expert disagreement.[^24][^22] That is defensible for a deep-dive article, but it is overkill if the product goal is “get a good article in a simple pass.”

### Aggressive simplification recommendation for Stage 4

For the default path, cap the panel to **2–3 voices total** regardless of depth until draft quality stabilizes. Better yet, consider a “simple mode” where Stage 4 is just:
- one team agent
- one specialist
- one Lead synthesis

The current code already has the fallback path that effectively behaves like a single-moderator discussion. That is a signal that the system can support a simpler default without architectural change.[^24]

## Stage 5 — Article Drafting

### What exists in code today

Stage 5 is the most complex runtime seam. `writeDraft()` ensures roster context, may generate fact-check context, may run a panel fact-check, always runs the bounded writer fact-check pass, builds a writer-preflight source bundle, injects prior draft and latest editor review on revision, includes revision summary context, calls Writer, validates structure and preflight, retries once on failure, and persists `writer-preflight.md`.[^28][^29]

### What exists in instructions today

The Writer charter is long and specific: canonical structure, voice rules, headlines, workflow, bounded verification, direct quote rules, superlative rules, prose-vs-table checks, teaser quality, boilerplate, and political exclusions.[^30] On top of that, Writer also loads `substack-article.md` and `writer-fact-check.md`, both of which carry additional structure and verification policy; `substack-article.md` also includes image-generation and later-stage guidance, not just draft structure.[^31][^32]

### Why Stage 5 feels heavy

This stage has become a stack of overlapping corrective layers: discussion summary, fact-check artifacts, writer fact-check policy, writer preflight, revision history, canonical article structure skill, writer charter, memory, and possibly editor review on revisions.[^4][^5][^18][^28][^29][^30][^31][^32] That may reduce certain failure modes, but it also makes it hard to reason about what actually caused the Writer to do something.

### Aggressive simplification recommendation for Stage 5

For a reset toward “simple pass,” narrow Stage 5 to three things only:
1. core article structure contract,
2. the discussion summary as primary input,
3. a **small** deterministic validation seam.

In practical terms, I would keep TLDR/structure validation and basic player/team name validation, but aggressively reduce prompt-layer duplication by moving most stage-specific craft rules into `substack-article.md` and shrinking the Writer charter back to identity + a few core voice constraints.[^14][^30][^31] I would also consider temporarily trimming the default writer context preset from `rich` to something closer to `balanced`, because the current default includes idea, prompt, panel composition, editor review, panel fact-check, roster context, fact-check context, and writer fact-check artifacts for Writer and Editor.[^4]

## Stage 6 — Editor Pass

### What exists in code today

`runEditor()` gathers draft context, injects roster context and fact-check context, includes revision summary plus prior editor reviews, runs Editor, saves `editor-review.md`, and self-heals if the verdict is not parseable.[^33] The engine guard then requires a parseable `APPROVED` verdict before Stage 6 can advance to Stage 7.[^14]

### What exists in instructions today

The Editor charter and `editor-review` skill both define a wide review surface: player names, stats, contracts, dates, team assignments, stale info, TLDR structure, tone, table formatting, flow, teaser quality, image review, and exact verdict output rules.[^34][^35]

### Why Stage 6 feels heavy

This stage is conceptually appropriate as a final gate, but the guidance is spread across two prompt sources that overlap heavily.[^34][^35] That makes Editor another candidate for “one source of truth.”

### Aggressive simplification recommendation for Stage 6

Keep Editor as the only mandatory final content gate, but simplify its runtime inputs and instruction sources. The cleanest cut is:
- keep deterministic guard on `APPROVED`,
- keep one editor review skill,
- shrink the Editor charter to identity and boundaries only,
- reduce the blocking checklist to a small set of categories that matter most for first-pass publishability.

In other words: keep Editor strong, but stop making Editor learn the same rules from two different markdown files.[^14][^34][^35]

## Stage 7 — Publisher Pass and Stage 8 Publish

### What exists in code today

`runPublisherPass()` gathers context, injects roster context, runs Publisher, then independently performs deterministic player-name validation and stat/draft claim validation, writes `publisher-pass.md`, records usage, records conversation, and ensures a `publisher_pass` row exists for the interactive checklist UI.[^17][^36] The `publisher_pass` row itself has 13 checklist fields, and the publish page adds Note, Tweet, and Publish All controls on top of preview and draft/publish actions.[^17][^37]

### What exists in instructions today

The Publisher charter says Publisher does not publish directly and focuses on readiness, while the publisher skill is a long checklist-oriented document that explicitly stops at dashboard review handoff and treats `publish_to_substack` as a manual fallback.[^38][^39] The publish page, however, exposes draft-save, live publish, Note composer, Tweet composer, and Publish All on a single screen.[^37]

### Why Stage 7 feels heavy

This is where pipeline complexity turns into UX complexity. The code is already splitting “publisher pass” from “live publish,” but the UI recombines preview, checklist, publishing, and distribution into one dense page.[^17][^37][^39]

### Aggressive simplification recommendation for Stage 7/8

Split the system into:
- **core publish path:** checklist → preview → save draft / publish
- **optional promotion path:** Note and Tweet after publish, or desktop-only advanced tools

That matches the user’s stated mobile goal far better than the current single-page publish workstation.[^37][^39]

## Cross-Cutting Complexity Problems

## 1. Too many sources of truth per stage

The runner composes prompts from charter + skills + memory + roster context, and the action layer adds article context + conversation context + action task.[^5][^6] Many stages also have duplicated guidance across charters and skills, and some documents still contain legacy or meta-procedural text that should not be loaded into runtime prompts.[^8][^9][^22][^30][^34][^38] Simplification should start by choosing **exactly one runtime instruction source per concern**:
- identity / tone → charter
- workflow / output contract → one skill
- policy / model routing → deterministic config

## 2. Context loading defaults are too generous

The default context preset is `rich`, and its Writer/Editor include lists are broad.[^4][^18] This means “simple article drafting” is often not simple at all; it arrives at the model bundled with prior artifacts, fact-check outputs, revision state, and multiple policy documents.[^4][^5][^6]

## 3. Model policy and prompt docs disagree

`models.json` centralizes stage model assignments, but runtime-loaded instructions still hardcode model expectations in multiple places.[^8][^9][^21][^22] This is exactly the kind of configuration conflict that should be eliminated before any deeper stage redesign.

## 4. The UI exposes too much system state too early

The article detail page combines action panel, revision history, image section, artifact tabs, editor reviews, usage events, stage runs, and advanced/pinned-agent surfaces in a two-column workstation layout.[^3][^40] That is powerful, but it is the opposite of the mobile-friendly “create / submit / publish” workflow the user described.[^3][^11]

## Dashboard UX Review

## Current UX posture

The dashboard is a **desktop editorial workstation**. `README.md` describes Home, Article Detail, New Idea, Config, Agents, Memory, and Runs as first-class pages, and the layout header exposes most of those destinations directly in the top nav.[^1][^41] On mobile, that breadth reads as system power, not simplicity.

## Home page

The home page renders five major sections—Search & Filter, Ready to Publish, Pipeline, Recent Ideas, and Recently Published—inside a dashboard grid.[^11] The CSS makes the grid two columns by default, with only a single breakpoint collapsing it to one column at 768px.[^42] That means mobile gets a stacked version of a dense desktop information architecture, not a mobile-first home.

### Simplification recommendation

For mobile and for the simplified product direction, the home screen should become three cards only:
1. **New Idea**
2. **In Progress**
3. **Ready to Publish**

Filters, pipeline summary, published history, Agents, Memory, Runs, and Config should move behind secondary navigation or desktop-oriented screens.[^11][^41][^42]

## New Idea page

The New Idea form includes prompt textarea, team chip grid for all 32 NFL teams, depth selector, pinned expert agents, form status, and auto-advance toggle, all inside a single form.[^19] The CSS uses an auto-fill team grid and a freeform agent badge grid, which is workable on desktop but still cognitively heavy on phones.[^23]

### Simplification recommendation

Make the mobile-primary idea form just:
- prompt
- team
- depth
- submit

Move pinned agents behind an “Advanced” expander or later-stage override. Keep auto-advance as a hidden preference or desktop option, not a prominent form field.[^19][^23]

## Article detail page

The article detail page is the densest screen in the product. It renders action panel, revision history, image section, live artifact tabs, editor reviews, usage panel, stage runs, and advanced/pinned-agent sections within a `detail-grid` layout.[^3][^40] The action panel itself changes shape by stage and includes preview, advance, retry, send-back, open publish page, and lead-review-specific branches.[^40][^42]

### Simplification recommendation

Keep the detail page, but treat it as an **advanced page**. For mobile, create a simplified article screen with:
- stage badge
- main preview / key artifact
- one primary action button
- a “More” menu for regress, retry, and advanced data

That would align the screen with the actual mobile jobs-to-be-done.[^3][^40]

## Publish page

The publish page is functionally rich but overloaded. It combines preview, publish status, 13-item checklist, Note composer, Tweet composer, and a Publish All section with asynchronous sequencing logic.[^37][^43] The mobile preview itself is good—the preview frame has a specific mobile viewport toggle and styles—but the surrounding workflow is still a desktop stack.[^12][^44]

### Simplification recommendation

Split publishing into a step-based flow:
1. readiness checklist
2. preview + save draft / publish
3. optional social promotion

This would preserve all current functionality while making the critical path legible on phones.[^37][^44]

## What I Would Simplify First

## Product / pipeline simplification order

1. **Stage 1 source-of-truth cleanup**
   - one creation path
   - one idea-generation skill
   - model policy wins everywhere
   - remove legacy/runtime-overloaded idea instructions[^7][^8][^9][^21]

2. **Collapse Stage 2 + 3 for default flow**
   - Lead outputs discussion frame + recommended panel in one pass[^24][^25][^27]

3. **Constrain Stage 4**
   - default to 2–3 voices, not maximal expert spread[^22][^24]

4. **Trim Stage 5 prompt load**
   - reduce Writer input to summary + structure contract + minimal deterministic validation[^4][^18][^28][^30][^31]

5. **Editor becomes the single rich quality gate**
   - one runtime review skill, smaller charter[^33][^34][^35]

6. **Publish becomes core path + optional promotion path**
   - no social compose tools in the main mobile publishing flow[^37][^39]

## UX simplification order

1. **Mobile-first home**: New Idea / In Progress / Ready to Publish only[^11][^41][^42]
2. **Minimal new-idea form**: prompt, team, depth, submit[^19][^23]
3. **Simplified article screen**: one primary action, advanced data hidden[^3][^40]
4. **Step-based publish flow**: checklist → preview/publish → optional social[^37][^44]

## Proposed “Simple Pass” Operating Mode

If the goal is to get back to a good article with fewer revisions, I would define a temporary simple mode like this:

- Stage 1: Lead generates idea from prompt, team, depth only.[^7][^19]
- Stage 2/3: Lead generates discussion frame and picks a recipe-based panel in one pass.[^24][^27]
- Stage 4: two panel voices + Lead synthesis.[^22][^24]
- Stage 5: Writer gets discussion summary plus one canonical article skill; minimal deterministic validation only.[^14][^28][^31]
- Stage 6: Editor remains mandatory final gate.[^14][^33][^35]
- Stage 7/8: checklist + preview + publish; Notes/Tweets optional after publish.[^17][^37][^39]

That mode would not require ripping out the whole architecture. It mostly requires turning off overlap and reducing optionality in the default path.[^4][^5][^6]

## Confidence Assessment

### High confidence

I am highly confident that the current heaviness comes from **overlap of shaping layers**, not from the existence of a deterministic stage engine itself. The code clearly shows a clean stage machine and repository model, but also shows prompt assembly pulling from charters, skills, memory, context presets, route tasks, and article artifacts at the same time.[^5][^6][^14][^15]

I am also highly confident that Stage 1 is the right place to start. It already exposes the core pattern—multiple entry points, multiple instruction sources, and early UX complexity—and it is the first user touchpoint, so simplification there will produce visible product wins fastest.[^7][^8][^9][^19]

### Moderate confidence

I am moderately confident that collapsing Stage 2 and 3 and constraining Stage 4 will materially improve first-pass article quality, because a smaller discussion surface usually means less synthesis drift. That said, the exact best panel size for your content style is still partly a product judgment, not something the code alone can prove.[^22][^24][^27]

I am also moderately confident that shifting the dashboard to a mobile-first core flow will improve usability, because the current views and CSS are clearly workstation-oriented. But the exact final IA should still be validated against your real publishing habits after a first simplification pass.[^11][^19][^37][^41][^42]

## Footnotes

[^1]: `C:\github\nfl-eval\README.md:7-15,95-125,162-185`
[^2]: `C:\github\nfl-eval\src\types.ts:1-18`
[^3]: `C:\github\nfl-eval\src\dashboard\views\article.ts:163-219`
[^4]: `C:\github\nfl-eval\src\pipeline\context-config.ts:10-55`
[^5]: `C:\github\nfl-eval\src\agents\runner.ts:282-332,361-402`
[^6]: `C:\github\nfl-eval\src\pipeline\actions.ts:682-717`
[^7]: `C:\github\nfl-eval\src\dashboard\server.ts:1076-1092,1099-1221`
[^8]: `C:\github\nfl-eval\src\config\defaults\skills\idea-generation.md:25-103`
[^9]: `C:\github\nfl-eval\src\config\defaults\charters\nfl\lead.md:50-129`
[^10]: `C:\github\nfl-eval\src\pipeline\actions.ts:772-999,1012-1225,1236-1420`
[^11]: `C:\github\nfl-eval\src\dashboard\views\home.ts:29-103,110-239`
[^12]: `C:\github\nfl-eval\src\dashboard\views\preview.ts:89-170`; `C:\github\nfl-eval\src\dashboard\public\styles.css:1704-1777`
[^13]: `C:\github\nfl-eval\src\types.ts:1-18`
[^14]: `C:\github\nfl-eval\src\pipeline\engine.ts:53-184,301-420`
[^15]: `C:\github\nfl-eval\src\db\repository.ts:1258-1299`
[^16]: `C:\github\nfl-eval\src\db\repository.ts:1303-1325`
[^17]: `C:\github\nfl-eval\src\db\repository.ts:926-979`; `C:\github\nfl-eval\src\pipeline\actions.ts:1343-1412`
[^18]: `C:\github\nfl-eval\src\config\index.ts:238-277`
[^19]: `C:\github\nfl-eval\src\dashboard\views\new-idea.ts:132-209,296-355`
[^20]: `C:\github\nfl-eval\src\dashboard\views\new-idea.ts:46-79,81-112`
[^21]: `C:\github\nfl-eval\src\config\defaults\models.json:1-100`
[^22]: `C:\github\nfl-eval\src\config\defaults\skills\article-discussion.md:15-19,33-60,145-216`
[^23]: `C:\github\nfl-eval\src\dashboard\public\styles.css:896-1056`
[^24]: `C:\github\nfl-eval\src\pipeline\actions.ts:772-999`
[^25]: `C:\github\nfl-eval\src\config\defaults\skills\discussion-prompt.md:15-61`
[^26]: `C:\github\nfl-eval\src\config\defaults\skills\article-discussion.md:33-141`
[^27]: `C:\github\nfl-eval\src\config\defaults\skills\panel-composition.md:15-57`
[^28]: `C:\github\nfl-eval\src\pipeline\actions.ts:451-468,1012-1225`
[^29]: `C:\github\nfl-eval\src\pipeline\actions.ts:1076-1111,1122-1209`
[^30]: `C:\github\nfl-eval\src\config\defaults\charters\nfl\writer.md:12-145`
[^31]: `C:\github\nfl-eval\src\config\defaults\skills\substack-article.md:19-32,91-107,191-259`
[^32]: `C:\github\nfl-eval\src\config\defaults\skills\writer-fact-check.md:15-96`
[^33]: `C:\github\nfl-eval\src\pipeline\actions.ts:1236-1314`
[^34]: `C:\github\nfl-eval\src\config\defaults\charters\nfl\editor.md:12-159`
[^35]: `C:\github\nfl-eval\src\config\defaults\skills\editor-review.md:11-71`
[^36]: `C:\github\nfl-eval\src\pipeline\actions.ts:1374-1412`
[^37]: `C:\github\nfl-eval\src\dashboard\views\publish.ts:198-320,337-502`
[^38]: `C:\github\nfl-eval\src\config\defaults\charters\nfl\publisher.md:12-36`
[^39]: `C:\github\nfl-eval\src\config\defaults\skills\publisher.md:15-39,110-176,192-216`
[^40]: `C:\github\nfl-eval\src\dashboard\views\article.ts:193-215,542-724`; `C:\github\nfl-eval\src\dashboard\public\styles.css:479-483,569-570,614-618,1416-1432`
[^41]: `C:\github\nfl-eval\src\dashboard\views\layout.ts:32-83`
[^42]: `C:\github\nfl-eval\src\dashboard\public\styles.css:143-150,826-835,89-120`
[^43]: `C:\github\nfl-eval\src\dashboard\views\publish.ts:299-323,337-410,415-502`
[^44]: `C:\github\nfl-eval\src\dashboard\views\preview.ts:103-170`; `C:\github\nfl-eval\src\dashboard\public\styles.css:1713-1777`
