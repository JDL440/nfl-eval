# Multi-provider LLM architecture research

## Request
Update the service so multiple LLM providers can be defined and swapped easily now (initially Copilot CLI and LM Studio local), while keeping the design extensible for more providers later. Longer term, allow provider selection per article run.

## Executive summary
The codebase is closer to this goal than it looks.

The good news:
- `src\llm\gateway.ts` already implements a real multi-provider gateway with provider registration, provider lookup, and model-policy-based routing.
- Provider attribution already flows through runtime results (`AgentRunner` returns both `model` and `provider`).
- Persistence already captures most of the telemetry you would want (`stage_runs.requested_model`, `usage_events.provider`, `usage_events.model_or_tool`, cost/tokens/rank).
- The article detail UI already has a clean per-article metadata editing path that can host a provider override without inventing a new UX pattern.

The current blocker is not the gateway abstraction. The blocker is startup wiring and policy shape:
- `src\dashboard\server.ts` currently registers providers through a mutually exclusive branch, so the process effectively runs with one LLM provider stack at a time.
- `src\llm\model-policy.ts` resolves models, but not provider preferences.
- `articles` / `Article` have no persisted provider-selection field.

So the smallest clean path is:
1. Make provider registration additive instead of mutually exclusive.
2. Add a provider-aware routing hint/override to the gateway request path.
3. Persist an optional article-level preferred provider.
4. Surface that override in the existing article metadata editor and new-idea flow.

This preserves the current V3 shape while making provider choice explicit, testable, and extensible.

## Current architecture: what already exists

### 1) Gateway already supports many providers
`src\llm\gateway.ts` is already the right seam.

It supports:
- registering providers by ID
- removing providers
- retrieving providers
- selecting a provider by asking which one `supportsModel(model)`
- deferring model selection to `ModelPolicy` when a request only specifies `stageKey` / `taskFamily`

In other words, the gateway itself is already multi-provider.

### 2) Providers are pluggable and already separated cleanly
Current provider classes include:
- `src\llm\providers\copilot-cli.ts`
- `src\llm\providers\copilot.ts`
- `src\llm\providers\lmstudio.ts`
- plus other providers exported from `src\llm\index.ts`

Each provider has a stable `id`, `name`, `listModels()`, `supportsModel()`, and `chat()`.

Important behavior differences already visible in code:
- `CopilotCLIProvider` is model-sensitive and maps canonical model names to CLI-compatible names.
- `CopilotProvider` is model-sensitive and maps to GitHub Models identifiers.
- `LMStudioProvider` currently accepts any model name, but then ignores the requested model and always uses its own configured local default model.

That last point matters: the gateway is model-first, but LM Studio is effectively provider-first today.

### 3) Runtime already exposes provider/model attribution
`src\agents\runner.ts` returns:
- `model`
- `provider`

That means every agent call already knows what provider actually handled the request.

### 4) Persistence already stores most telemetry needed
The schema in `src\db\schema.sql` already gives strong observability:

`stage_runs`
- `requested_model`
- `requested_model_tier`
- `precedence_rank`
- `output_budget_tokens`

`usage_events`
- `provider`
- `model_or_tool`
- token counts
- cost estimate
- metadata JSON

Repository write paths in `src\db\repository.ts` already insert this data.

This is excellent because a provider-selection rollout does **not** need a new telemetry subsystem.

### 5) Article metadata editing already has a natural override surface
The article detail page already supports inline metadata editing:
- `src\dashboard\views\article.ts` → `renderArticleMetaEditForm()`
- `src\dashboard\server.ts` → `/htmx/articles/:id/edit-meta`
- `src\db\repository.ts` → `updateArticle()`

Today that form edits title, subtitle, depth, and teams. Adding an optional provider field here is a very natural extension.

## Current limitation: why it still behaves like single-provider runtime
The biggest practical limitation is in startup wiring inside `src\dashboard\server.ts`.

The current logic is structured roughly like this:
- if `MOCK_LLM=1`: register mock only
- else if `LLM_PROVIDER=lmstudio` or `LMSTUDIO_URL`: register LM Studio
- else if `LLM_PROVIDER=copilot-api`: register Copilot API
- else: try Copilot CLI first, then API fallback

That means the process does **not** normally register all available providers together. The gateway could handle that, but startup prevents it.

So right now:
- provider choice is mostly decided once at boot
- article runs cannot truly choose among multiple registered backends
- model policy is acting as a model chooser inside a largely single-provider runtime

## Design goal
There are really two separate capabilities to add:

### Capability A: multi-provider runtime
The process can register several providers at once, and the gateway can route among them.

### Capability B: per-article provider preference
An article can optionally ask for a provider (for example `copilot-cli` vs `lmstudio`), while still letting model policy choose the best model within that provider or fall back according to policy.

These should be implemented in that order.

## Recommended target design

## Phase 1: make runtime provider registration additive

### Recommendation
Replace the mutually exclusive startup branch with additive provider registration.

Instead of “choose one provider path”, do this:
- build a list of configured/available providers
- register every provider that is both configured and healthy
- expose the registered provider set in config/status UI

Suggested startup behavior:
- `MOCK_LLM=1` remains special for tests/dev and can short-circuit to mock only
- otherwise:
  - if Copilot CLI verifies successfully, register `copilot-cli`
  - if GitHub Models auth is available, register `copilot`
  - if LM Studio health check passes, register `lmstudio`
  - later: Anthropic/OpenAI/Gemini/etc. can be added with the same pattern

### Why this is the right first step
- It unlocks the existing gateway instead of replacing it.
- It keeps runtime backward compatible for stages/tasks that only care about models.
- It makes provider selection possible without forcing an article-level override immediately.

### Config recommendation
Add a single env-driven allowlist like:
- `LLM_PROVIDERS=copilot-cli,copilot,lmstudio`

Optional provider-specific config stays separate:
- `LMSTUDIO_URL=...`
- `LMSTUDIO_MODEL=...`
- `GITHUB_TOKEN=...`
- etc.

If `LLM_PROVIDERS` is omitted, default to “discover what is configured and healthy”.

This is more extensible than the current `LLM_PROVIDER=<single>` model.

## Phase 2: add provider-aware routing hints to the gateway

### Current problem
`LLMGateway` picks a provider by finding one that supports the chosen model.
That works for model-centric routing, but it cannot represent:
- “use LM Studio for this article even if the stage default model is `gpt-5-mini`”
- “prefer Copilot CLI, but fall back to Copilot API if the requested model/provider combination is unavailable”

### Recommendation
Extend the gateway request with optional provider preference fields.

Suggested additions to `ChatRequest` / gateway request shape:
- `preferredProvider?: string`
- `allowedProviders?: string[]`
- `providerStrategy?: 'auto' | 'prefer' | 'require'`

Meaning:
- `auto`: current behavior, route by model/policy
- `prefer`: try preferred provider first, then normal fallback
- `require`: only use the preferred provider; fail clearly if unavailable

This preserves the current routing model but adds explicit provider intent.

### Suggested routing algorithm
1. Resolve the request model as today (unless a future provider-specific default changes that).
2. If `providerStrategy=require` and `preferredProvider` is set:
   - fetch that provider
   - if missing, fail
   - if it cannot satisfy the request, fail
3. If `providerStrategy=prefer` and `preferredProvider` is set:
   - try that provider first
   - if it fails provider-compatibility checks, fall back to standard routing
4. Otherwise use the current model-based routing path.

### Important LM Studio nuance
LM Studio currently ignores the requested model and always uses its configured local default model.

That means the gateway needs a provider-compatibility rule that distinguishes:
- model-aware providers (`copilot`, `copilot-cli`)
- provider-owned-model providers (`lmstudio` today)

Two good options:

Option 1: minimal change
- allow `LMStudioProvider` to continue ignoring requested models
- when `preferredProvider=lmstudio`, let it run even if the requested model is nominally different
- rely on recorded actual model/provider telemetry for truth

Option 2: cleaner long term
- teach `LMStudioProvider` to optionally honor `request.model` if that model is loaded locally
- otherwise fall back to its configured default model

I would start with Option 1 for speed, but document the behavior clearly.

## Phase 3: persist article-level provider preference

### Recommendation
Add an optional provider field on `articles`.

Suggested schema addition:
- `preferred_llm_provider TEXT NULL`

Optional future extension if you want more control later:
- `preferred_llm_model TEXT NULL`
- `provider_strategy TEXT NULL DEFAULT 'prefer'`

For the initial rollout, only `preferred_llm_provider` is necessary.

### Why article-level storage is the right layer
Provider choice is more editorial/operational than stage-specific logic.
Examples:
- “for this article, run locally in LM Studio because I’m experimenting”
- “for this sensitive article, use Copilot only”
- “default all normal runs to auto, but pin a few articles to local provider for cost/privacy reasons”

That belongs on the article, not hidden in transient server state.

### Required code changes
- `src\db\schema.sql`: add column to `articles`
- `src\types.ts`: extend `Article`
- `src\db\repository.ts`: support create/update/read for the new field
- optionally backfill migration guard if this repo uses live upgrade logic elsewhere

## Phase 4: thread provider preference through run creation

### Recommendation
When pipeline stages run for an article, pass the article’s provider preference into the gateway call path.

Likely flow:
- load article
- read `article.preferred_llm_provider`
- pass that into `AgentRunner.run(...)`
- `AgentRunner` forwards it into `LLMGateway.chat(...)`

This can be done with a small additive field on `AgentRunParams`, for example:
- `preferredProvider?: string`
- maybe `providerStrategy?: 'auto' | 'prefer' | 'require'`

This is cleaner than trying to have `AgentRunner` discover article provider state indirectly.

### Stage run telemetry
You already store `requested_model`, but not requested provider.
For observability I recommend adding one more optional field to `stage_runs`:
- `requested_provider TEXT NULL`

This is not strictly required, because `usage_events.provider` captures actual provider, but it is very useful for debugging intent vs outcome.

Example value story:
- article requested provider: `lmstudio`
- stage run requested model: `gpt-5-mini`
- actual usage event provider: `lmstudio`
- actual usage event model/tool: local model name returned by LM Studio

That would make fallback behavior and local-model substitution very clear.

## Phase 5: surface provider selection in the UI

### Recommended initial UX
Use the existing article metadata editor in `src\dashboard\views\article.ts`.

Add a select field like:
- Auto (default)
- Copilot CLI
- Copilot API
- LM Studio

Persist values as:
- `NULL` or `'auto'` for no override
- `copilot-cli`
- `copilot`
- `lmstudio`

### Why this is enough initially
- It is discoverable where users already edit article settings.
- It avoids creating a separate advanced settings page.
- It matches how editors already think about article-specific knobs like depth.

### Good follow-on UX
Also add provider choice to the new-idea/create flow so users can set it at article creation time.

Do **not** make this mandatory. Auto/default should remain the happy path.

### Config page improvement
The config page currently summarizes a single provider. That becomes misleading once multiple providers are active.

Update it to show:
- registered providers list
- each provider status / URL / default model / health
- active provider allowlist from env/config

This change is important because otherwise the system will look single-provider even after the backend is fixed.

## Suggested policy model evolution

### Current state
`ModelPolicy` resolves:
- selected model
- candidate models
- tier
- precedence rank
- output budget

It does not resolve provider identity.

### Recommendation
Do **not** immediately rewrite `ModelPolicy` into a provider-policy engine.
That would be a larger and riskier redesign than needed.

Instead, keep `ModelPolicy` focused on model selection and layer provider preference on top.

A practical evolution path:

#### Step 1: leave `models.json` mostly as-is
Keep existing stage/task-family → model assignments.

#### Step 2: add optional provider defaults later if needed
If you later want global defaults like “writer prefers copilot-cli, panel prefers lmstudio”, add an optional parallel block such as:

```json
"provider_preferences": {
  "writer": ["copilot-cli", "copilot"],
  "panel": ["lmstudio", "copilot-cli"],
  "editor": ["copilot-cli", "copilot"]
}
```

But I would not start here.

#### Step 3: keep article override stronger than stage preference
Priority order should be:
1. explicit run override
2. article preferred provider
3. optional stage/provider preference from policy
4. automatic model-based routing

This keeps the system understandable.

## Concrete implementation plan

### Slice 1: enable true multi-provider startup
Files:
- `src\dashboard\server.ts`
- possibly `src\dashboard\views\config.ts`

Changes:
- replace mutually exclusive provider branch with additive registration
- build a provider registry summary object for config UI
- keep mock-only path for tests/dev

### Slice 2: gateway/provider hint support
Files:
- `src\llm\gateway.ts`
- `src\agents\runner.ts`
- tests in `tests\llm\gateway.test.ts`, `tests\agents\runner.test.ts`

Changes:
- add `preferredProvider` / `providerStrategy` request options
- implement prefer/require behavior
- keep existing auto behavior as default

### Slice 3: article schema and repository plumbing
Files:
- `src\db\schema.sql`
- `src\types.ts`
- `src\db\repository.ts`

Changes:
- add `articles.preferred_llm_provider`
- optionally add `stage_runs.requested_provider`
- thread read/update/create support

### Slice 4: dashboard UX
Files:
- `src\dashboard\views\article.ts`
- `src\dashboard\server.ts`
- maybe new-idea/create view if desired

Changes:
- add provider select to article metadata edit form
- parse and validate provider values in htmx and JSON update routes
- show selected provider in article metadata display / advanced section if set

### Slice 5: pipeline wiring
Likely files:
- `src\pipeline\actions.ts`
- any other place that calls `runner.run(...)`

Changes:
- pass article provider preference into agent runs
- record requested provider in stage runs if you add that column

## Test plan

### Existing suites that should be extended
- `tests\llm\gateway.test.ts`
- `tests\llm\model-policy.test.ts` if policy shape changes
- `tests\agents\runner.test.ts`
- `tests\dashboard\config.test.ts`
- dashboard article-detail tests if metadata form rendering is covered elsewhere
- focused pipeline tests in `tests\pipeline\actions.test.ts`

### Specific cases worth adding
1. Multi-provider registration at startup
- both Copilot CLI and LM Studio register when available
- config view shows both

2. Gateway provider preference
- `preferredProvider=lmstudio, strategy=prefer` uses LM Studio when available
- same request falls back correctly when preferred provider is unavailable
- `strategy=require` fails loudly if provider missing

3. Article-level override propagation
- article metadata save persists provider override
- a subsequent stage run uses the requested provider
- usage/stage run telemetry reflects requested vs actual provider/model

4. LM Studio special behavior
- requested canonical model with preferred LM Studio still succeeds
- actual response records LM Studio’s returned local model

5. Backward compatibility
- no provider override still follows current model-policy-driven routing

## What I would delete or avoid
To keep this realistic and low-risk, I would **not** do any of the following in the first pass:
- do not replace `ModelPolicy` with a provider-first rules engine
- do not invent a new provider orchestration subsystem
- do not require users to choose provider for every article
- do not create stage-specific provider override UI before article-level override proves useful
- do not try to normalize local-model names across LM Studio and remote providers yet

## Recommended rollout order

### Rollout A: backend unlock
Goal: the runtime can truly host multiple providers at once.

Deliverables:
- additive provider registration
- config page shows all registered providers
- no article-level selection yet

This alone gives operational flexibility and validates the startup design.

### Rollout B: article-level override
Goal: individual articles can prefer LM Studio vs Copilot.

Deliverables:
- `preferred_llm_provider` on `articles`
- metadata editor select
- gateway preferred-provider routing

This is the main user-visible feature.

### Rollout C: richer policy/fallback
Only after real usage:
- optional provider preferences in `models.json`
- requested-provider telemetry in `stage_runs`
- better LM Studio requested-model handling

## Recommended defaults for your immediate use case
Given your stated near-term providers, I would ship the first version with exactly these IDs and semantics:
- `copilot-cli`: preferred for normal cloud-backed article generation
- `copilot`: secondary cloud fallback when CLI is unavailable or unsuitable
- `lmstudio`: explicit local override / experiment path

Default behavior:
- no override = current auto behavior
- article override = `prefer`, not `require`

Why `prefer` first:
- it is friendlier operationally
- it avoids surprising hard failures when the local server is down
- it still allows testing the UX and data model safely

You can always add a stricter “require local provider” toggle later if you need it.

## Bottom line
You do **not** need a major rearchitecture.

The smallest clean path is:
- stop registering providers mutually exclusively
- add provider preference as an additive routing hint
- persist an optional article-level provider override
- surface that override in the existing metadata editor

That gives you multi-provider support quickly, keeps the current V3 shape intact, and leaves room for more providers without painting the system into a corner.

## File map referenced during research
- `src\llm\gateway.ts`
- `src\llm\model-policy.ts`
- `src\llm\providers\copilot-cli.ts`
- `src\llm\providers\copilot.ts`
- `src\llm\providers\lmstudio.ts`
- `src\agents\runner.ts`
- `src\db\schema.sql`
- `src\db\repository.ts`
- `src\types.ts`
- `src\dashboard\server.ts`
- `src\dashboard\views\article.ts`
- `src\dashboard\views\config.ts`
- `src\config\defaults\models.json`
- `tests\llm\gateway.test.ts`
- `tests\llm\model-policy.test.ts`
- `tests\agents\runner.test.ts`
