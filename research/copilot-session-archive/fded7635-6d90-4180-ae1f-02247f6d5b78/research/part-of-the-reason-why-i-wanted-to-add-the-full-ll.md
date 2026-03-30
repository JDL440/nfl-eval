# Audit: true scope of instruction/context pollution in the in-app agent runtime

## Executive summary

Yes, there is real prompt pollution.

The biggest issue is not just "old wording." The live runtime instructions in `C:\Users\jdl44\.nfl-lab\agents\...` still contain multiple **pre-v2 `.squad` assumptions**, **GitHub issue workflow instructions**, **Joe/dashboard-specific handoff text**, and at least one **role/persona leak** (`Lead Ocean`) that are being loaded into the actual in-app prompts today.

The most important root cause is structural:

1. **The app does not read repo prompt defaults at runtime.** It reads the external data dir under `~/.nfl-lab`.  
2. **The runtime is single-shot and text-only.** There is no tool loop, no file access loop, and no agent-side execution environment in `AgentRunner`.  
3. Several live charters/skills still instruct agents to do things that are impossible in this runtime: read `.squad` files, use tools, post GitHub comments, update labels, write files, or publish.

So the scope is broader than "a few stale phrases." There is a real mismatch between:

- the **current runtime contract**,
- the **live prompt files**,
- and the **actual product workflow**.

## What the runner actually sends to the model

`AgentRunner` builds prompts in a very plain way:

- **System prompt** = charter identity + responsibilities + full loaded skill bodies + recalled memory entries + optional roster context + charter boundaries.  
  Source: `src/agents/runner.ts:282-331`
- **User message** = task + optional article metadata + gathered article content + optional revision/conversation context.  
  Source: `src/agents/runner.ts:367-389`
- **LLM call** = one `system` message and one `user` message, routed through `LLMGateway.chat()`.  
  Source: `src/agents/runner.ts:385-402`

That means stale content inside a live charter or loaded skill is not "reference docs on disk" — it becomes prompt text.

## Where runtime instructions really come from

The app loads live instructions from the external data dir, not from `src/config/defaults/...`:

- `chartersDir = join(dataDir, 'agents', 'charters', league)`
- `skillsDir = join(dataDir, 'agents', 'skills')`

Source: `src/config/index.ts:238-275`

In this environment, that means the effective runtime prompt files are under:

- `C:\Users\jdl44\.nfl-lab\agents\charters\nfl`
- `C:\Users\jdl44\.nfl-lab\agents\skills`

This matters because the repo defaults are only part of the story. The real audit target is the live `~/.nfl-lab` data.

## Why old `.squad` concepts are still present

The migration path explicitly copied v1 `.squad` content into the v2 data dir:

- `.squad/config/models.json` -> `dataDir\config\models.json`
- `.squad/agents/*/charter.md` -> `dataDir\agents\charters\{league}\*.md`
- `.squad/skills/*/SKILL.md` -> `dataDir\agents\skills\*.md`
- `.squad/agents/*/history.md` -> converted into `memory.db`

Source: `src/migration/migrate.ts:260-370`

So the live prompt set is not just "inspired by" old `.squad` content. It was materially seeded from it.

## What context gets injected around those instructions

The stage actions add article artifacts on top of the charter/skills:

| Stage action | Agent | Skills loaded | Main injected article context |
|---|---|---|---|
| `generatePrompt` | `lead` | `discussion-prompt` | `idea.md` (+ roster in rich preset) |
| `composePanel` | `lead` | `panel-composition` | `discussion-prompt.md`, `idea.md` |
| `runDiscussion` | panelists / `panel-moderator` | `article-discussion` | `discussion-prompt.md`, `panel-composition.md`, roster |
| `writeDraft` | `writer` | `substack-article`, `writer-factcheck` | `discussion-summary.md` plus upstream artifacts |
| `runEditor` | `editor` | `editor-review` | `draft.md` plus upstream artifacts + editor review history |
| `runPublisherPass` | `publisher` | `publisher` | `draft.md`, `editor-review.md`, roster |

Primary sources:

- `src/pipeline/actions.ts:773-798`
- `src/pipeline/actions.ts:811-872`
- `src/pipeline/actions.ts:883-999`
- `src/pipeline/actions.ts:1011-1160`
- `src/pipeline/actions.ts:1236-1281`
- `src/pipeline/actions.ts:1342-1372`
- `src/pipeline/context-config.ts:26-45`

So the effective prompt is:

1. live charter,
2. selected live skill(s),
3. memory snippets,
4. stage-specific artifacts,
5. optional revision/conversation handoff.

This is exactly why tracing would be valuable: the real prompt is assembled from many layers.

## Findings by severity

### High severity: live instructions that are actively incompatible with the runtime

These are not harmless old notes. They tell the model to do things the app runtime does not support.

#### 1) Lead charter still contains a legacy operator script

The live `lead.md` currently includes:

- `Lead Ocean` persona framing
- GitHub issue lifecycle instructions
- instructions to read `.squad/...` skill files
- instructions to use `web_fetch` / `web_search`
- instructions to post issue comments, update issue labels, and manage pipeline progression
- explicit file save paths under `content/articles/...`

Source: `C:\Users\jdl44\.nfl-lab\agents\charters\nfl\lead.md:1-143`

Why this is severe:

- `AgentRunner` does **not** expose a tool loop.
- The model does **not** actually get file access.
- The model does **not** actually post GitHub comments or labels.

So a meaningful portion of the live Lead charter is operational fiction in the current in-app runtime.

This is likely the single biggest source of "incorrect instructions" in the system.

#### 2) Writer and Editor still carry obsolete image/publication rules

Live `writer.md` says:

- follow `.squad/skills/substack-article/SKILL.md`
- "Exactly 2 inline images per article. NO cover image in markdown."
- "Substack post cover is set manually by Joe in the Substack editor at Stage 8"

Source: `C:\Users\jdl44\.nfl-lab\agents\charters\nfl\writer.md:14-18,34-45,126-130`

Live `editor.md` repeats the same older policy:

- exactly 2 inline images
- no cover in markdown
- cover set manually by Joe
- "if approved -> publish to content/articles/ and commit"

Source: `C:\Users\jdl44\.nfl-lab\agents\charters\nfl\editor.md:117-120,143-150`

But newer live publisher-related skills now expect a different contract:

- cover image in article body above TLDR
- Stage 7 stops at dashboard handoff
- dashboard publish flow handles live publish / note

Source:

- `C:\Users\jdl44\.nfl-lab\agents\skills\publisher.md:15-18,124-182`
- `C:\Users\jdl44\.nfl-lab\agents\skills\substack-publishing.md:21-44,145-185`

This is a real cross-role contradiction, not just stale prose.

#### 3) `substack-article.md` is stale in ways that directly affect prompts

The live skill still says things like:

- panel spawns should "read their charter.md and history.md"
- writer model is always `claude-opus-4.6`
- model/budget comes from `.squad/config/models.json`
- publisher pass calls `publish_to_substack`

Source: `C:\Users\jdl44\.nfl-lab\agents\skills\substack-article.md:34-42,75-83,213-280`

But the live config file says the current model policy is GPT-5 / GPT-5-mini centered:

- `writer`, `editor`, `lead`, `panel_deep_dive` = `gpt-5`
- `panel_casual`, `lightweight`, `scribe` = `gpt-5-mini`

Source: `C:\Users\jdl44\.nfl-lab\config\models.json:1-106`

So this skill embeds outdated model assumptions and an outdated publication flow.

### Medium severity: live references that are stale but partly advisory

#### 4) `article-discussion.md` still assumes `.squad` and direct file workflows

The live skill references:

- `.squad/config/models.json`
- `.squad/agents/[agent]/charter.md and history.md`
- `.squad/decisions.md`
- direct save paths into `content/articles/...`

Source: `C:\Users\jdl44\.nfl-lab\agents\skills\article-discussion.md:19-22,79-103,224-250`

Not every line is harmful. Some are just old operator guidance. But this file is still loaded into real prompts for:

- panel moderator fallback
- synthesis
- panelist discussions

So any `.squad` or shell/file language here still pollutes the effective prompt.

#### 5) Live analytics/media skills reference `.squad` skill paths

Examples:

- analytics charter points at `.squad/skills/nflverse-data/SKILL.md`
- media charter points at `.squad/skills/nfl-roster-research/SKILL.md`

Source:

- `C:\Users\jdl44\.nfl-lab\agents\charters\nfl\analytics.md:91-92`
- `C:\Users\jdl44\.nfl-lab\agents\charters\nfl\media.md:82`

These are milder than the Lead problem, but still signs that the live prompt set was not fully normalized for v2.

### Low severity / informational: legacy mentions that do not necessarily pollute current runs

#### 6) Knowledge docs sometimes reference v1 only as historical contrast

Example:

- `knowledge-propagation.md` explicitly contrasts v1 `.squad` patterns with v2 `memory.store()` / `memory.recall()`

Source: `C:\Users\jdl44\.nfl-lab\agents\skills\knowledge-propagation.md:127-137`

This is not great prompt hygiene, but it is less dangerous because it is explanatory rather than instructing the agent to perform obsolete actions.

## Scribe is a special case

`scribe.md` is the strongest example of cross-era contamination:

- it is entirely about `.squad/` files,
- manual log merging,
- decision inboxes,
- git commits,
- and `history.md` propagation.

Source: `C:\Users\jdl44\.nfl-lab\agents\charters\nfl\scribe.md:1-140`

This is massively incompatible with the current in-app runtime.

However, the production article pipeline appears centered on:

- `lead`
- `panel-moderator`
- `writer`
- `editor`
- `publisher`

and not on `scribe`.

So:

- **Scribe is not the main cause of current article-stage prompt pollution**
- but it is strong evidence that the live charter set still contains large chunks of old operational worldview

## Is the "Lead / Lead Ocean" confusion real?

Yes, but it is narrower than the broader prompt hygiene problem.

### What is actually wrong

The live Lead charter explicitly says:

- "Every heist needs a Lead Ocean"
- `Persona: Lead Ocean`

Source: `C:\Users\jdl44\.nfl-lab\agents\charters\nfl\lead.md:1-10`

This is a real role/persona leak because:

- the user-facing/runtime role is `Lead`
- the charter embeds a different mythos/persona label
- it makes the role sound like a cinematic coordinator archetype rather than a precise pipeline orchestrator

### What is not wrong

I did **not** find the same type of confusion in `panel-moderator.md`.

`panel-moderator.md` is comparatively clean:

- clear neutral facilitator identity
- clear boundaries
- no obvious `.squad` confusion
- no role-name collision

Source: `src/config/defaults/charters/nfl/panel-moderator.md:1-35` and matching live file inspection

So the role confusion is mostly centered on `Lead`, not on the moderator role.

## The bigger role confusion is actually operational

The deeper confusion is not "Lead vs Lead Ocean."

It is this:

- the charter describes Lead as an autonomous issue/pipeline/tool orchestrator,
- but the runtime executes Lead as a single-shot text generator.

That means Lead is currently being prompted as if it were:

- an agent with tool use,
- file access,
- GitHub issue access,
- publish orchestration authority,
- and long-running control-plane state.

But in practice it is only:

- a prompt composer that returns text.

That mismatch is likely a major source of strange or outdated behavior.

## What is likely reaching the model today vs. what is just legacy residue

### Definitely reaches the model today

When those stages run, the following stale or contradictory instructions are likely in the prompt:

- `lead.md` legacy issue/tool workflow
- `writer.md` no-cover-image rule
- `editor.md` no-cover-image + direct-publish framing
- `substack-article.md` `.squad/history.md` + old model/publish guidance
- `article-discussion.md` `.squad` / shell / file workflow assumptions

### Present in the live data dir but lower active impact

- `scribe.md`
- historical v1-v2 comparison notes in memory skills
- some specialist charters that point at `.squad/.../SKILL.md`

## My best assessment of the true scope

### Scope statement

This is **not** just a minor naming cleanup.

It is a **prompt-source hygiene problem across the live runtime data dir**, with three layers:

1. **Legacy migration residue** from `.squad`
2. **Workflow drift** between old Substack/publish assumptions and the newer dashboard-centered flow
3. **Runtime-contract mismatch** because the prompt set still assumes tool-capable agents, while the in-app runtime is prompt-only

### Most important concrete issues

| Issue | Scope | Why it matters |
|---|---|---|
| Lead charter contains impossible operational instructions | High | Can directly mislead the orchestrator prompt |
| Writer/Editor image and publish rules conflict with Publisher skills | High | Causes cross-stage inconsistency |
| `substack-article` hardcodes old model/publish behavior | High | Affects writer prompt quality and expectations |
| `.squad` references across active skills | Medium | Creates irrelevant or misleading context |
| `Lead Ocean` persona leak | Medium | Muddies role identity and tone |
| `scribe` still lives in a different world | Low-to-medium active impact | Signals incomplete migration even if rarely used |

## Recommendations

### 1) Add full prompt tracing first-class

You were right to want this.

Without prompt tracing, it is too easy for the system to assemble bad prompts from:

- live charter text,
- loaded skills,
- memories,
- gathered artifacts,
- and conversation handoff

without anyone seeing the final envelope.

At minimum, capture for every run:

- agent name
- stage/action
- resolved charter source path
- resolved skill names and source paths
- full system prompt
- full user prompt
- memories injected
- upstream artifact names included
- final model/provider
- raw response + stripped thinking

### 2) Treat `~/.nfl-lab` as the real cleanup target

Do not only edit `src/config/defaults/...` and assume the problem is solved.

The runtime uses `~/.nfl-lab`, so that is the prompt set that must be audited, normalized, and either:

- rewritten in place,
- re-seeded from clean defaults,
- or versioned/migrated with explicit prompt schema upgrades.

### 3) Split "operator playbooks" from runtime charters/skills

A large portion of the pollution comes from mixing:

- human/operator workflow docs
- tool-oriented autonomous agent scripts
- and actual in-app prompt contracts

into the same files.

Recommendation:

- keep runtime charters/skills limited to what the in-app agent can truly do
- move GitHub issue workflow, publishing ops, and human-review protocol into separate operator docs/UI help

### 4) Normalize canonical article policy in one place

Right now the image/publication contract is inconsistent across Writer, Editor, Publisher, and Substack skills.

Pick one canonical source of truth and update all other runtime files to point to it.

The highest-risk contradictions to fix first:

- cover image in markdown vs no cover image
- Stage 7 dashboard handoff vs direct `publish_to_substack`
- live model policy vs hardcoded `claude-opus-4.6`

### 5) Clean up Lead specifically

Lead needs the most urgent rewrite.

Suggested direction:

- remove `Lead Ocean`
- remove impossible tool/file/GitHub instructions from the runtime charter
- keep only orchestration, synthesis, panel selection, revision steering, and article-stage reasoning responsibilities

### 6) Either retire Scribe from the app runtime or fully rewrite it

Right now `scribe.md` describes a different product/runtime.

If Scribe is not part of the current in-app flow, disable it from the active roster. If it is intended to remain, rewrite it around current memory and app primitives only.

## Bottom line

Your suspicion was correct.

There is real prompt/context pollution, and it is not limited to one file or one naming issue. The core problem is that the live runtime prompt set still carries old `.squad` and operator-era assumptions, while the actual app runtime is a much narrower prompt-only system.

If I were prioritizing next steps, I would do them in this order:

1. add full LLM trace visibility,
2. clean the live `~/.nfl-lab` prompt set,
3. rewrite Lead,
4. reconcile Writer/Editor/Publisher/Substack policy into one canonical contract,
5. retire or rewrite Scribe.

## Key source files

- `src/agents/runner.ts`
- `src/config/index.ts`
- `src/pipeline/actions.ts`
- `src/pipeline/context-config.ts`
- `src/pipeline/conversation.ts`
- `src/migration/migrate.ts`
- `C:\Users\jdl44\.nfl-lab\agents\charters\nfl\lead.md`
- `C:\Users\jdl44\.nfl-lab\agents\charters\nfl\writer.md`
- `C:\Users\jdl44\.nfl-lab\agents\charters\nfl\editor.md`
- `C:\Users\jdl44\.nfl-lab\agents\charters\nfl\scribe.md`
- `C:\Users\jdl44\.nfl-lab\agents\skills\substack-article.md`
- `C:\Users\jdl44\.nfl-lab\agents\skills\article-discussion.md`
- `C:\Users\jdl44\.nfl-lab\agents\skills\publisher.md`
- `C:\Users\jdl44\.nfl-lab\agents\skills\substack-publishing.md`
- `C:\Users\jdl44\.nfl-lab\agents\skills\knowledge-propagation.md`
