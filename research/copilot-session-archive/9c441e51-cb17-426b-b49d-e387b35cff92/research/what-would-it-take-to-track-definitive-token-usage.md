# What it would take to track definitive token usage for full article creation

## Executive Summary

`nfl-eval` does **not** currently have a definitive per-article usage ledger. The repo has good stage/state tracking through `pipeline.db`, `PipelineState`, and artifact-based stage inference, but it does not persist per-run token, premium-request, model, or tool-usage telemetry.[^1][^2][^3] The current model map lives in `.squad/config/models.json`, yet I did not find runtime JS/PY code in the repo that loads and enforces that file; in practice, model choices are still largely procedural and documentation-driven.[^4][^5][^6][^7][^8]

For **monthly quota and billing truth**, GitHub already provides two useful surfaces: premium-request tracking/analytics and enterprise Copilot usage metrics. Premium-request analytics answer “how much of our monthly Copilot allowance are we using,” while enterprise Copilot usage metrics add daily CLI request/session counts plus CLI prompt/output token totals.[^9][^10][^11][^12][^13] However, those GitHub surfaces are **not article-aware**; they are reported at billing, enterprise, organization, or user scope, not at `article_id` / `stage` scope.[^11][^12][^13]

Because of that, the practical solution is a **two-layer system**: provider-of-record telemetry for GitHub and Google billing, plus a repo-local attribution layer keyed by article, stage, model, and tool. That will let you answer optimization and regression questions by article/stage while still reconciling to the official monthly quota counters. If you ever need truly exact per-article Copilot token counts rather than reconciled attribution, you would need to move the core text-generation calls from opaque Copilot agent execution to APIs you control directly.[^11][^12][^14][^15]

## Architecture / system overview

```text
                              ┌─────────────────────────────┐
                              │ GitHub Copilot billing truth │
                              │ - premium requests          │
                              │ - CLI token totals          │
                              └──────────────┬──────────────┘
                                             │ reconcile
                                             ▼
┌────────────────────┐   stage/model/tool   ┌─────────────────────────────┐
│ Article orchestration│────────────────────▶│ Local attribution ledger    │
│ Lead / Writer /     │                     │ article_id / stage / model  │
│ Editor / panelists  │                     │ tool / timestamps / costs   │
└─────────┬───────────┘                     └──────────────┬──────────────┘
          │                                                │
          │ artifacts + DB writes                          │ separate provider spend
          ▼                                                ▼
┌────────────────────┐                            ┌─────────────────────────────┐
│ pipeline.db        │                            │ Google billing truth        │
│ articles           │                            │ - Gemini/Imagen usage       │
│ stage_transitions  │                            │ - AI Studio usage dashboard │
│ editor_reviews     │                            │ - spend caps / reports      │
│ publisher_pass     │                            └─────────────────────────────┘
└────────────────────┘
          │
          ├───────── publish_to_substack (non-LLM tool)
          ├───────── render_table_image (non-LLM local tool)
          └───────── generate_article_images (Gemini / Imagen)
```

The key design point is that **GitHub remains the quota/billing source of truth for Copilot**, while the repo becomes the **attribution source of truth** for article runs. The local layer does not replace provider metrics; it makes them useful for this workflow.[^1][^2][^11][^12][^16]

## Current state in `nfl-eval`

### 1. The pipeline already has strong stage semantics, but no usage semantics

`PipelineState` is the shared DB write layer for the article pipeline and defines the numeric stage model (1–8) used throughout the workflow.[^1] The database schema already tracks articles, stage transitions, article panels, discussion prompts, editor reviews, publisher pass state, and notes.[^2] Separately, `content/article_board.py` can infer an article’s stage from on-disk artifacts such as `discussion-prompt.md`, `draft.md`, `editor-review*.md`, and `publisher-pass.md`, so the repo already treats article artifacts as a second stage signal.[^3]

That means you already have a strong place to attach telemetry: the pipeline knows **which article** is in **which stage** and when it advances. What it lacks is a first-class notion of **which model/tool invocation created that stage output**, how many requests it took, or how much quota/spend it consumed.[^1][^2][^3]

### 2. Model selection is documented centrally, but not obviously enforced centrally

`.squad/config/models.json` is the cleanest statement of intended article-pipeline model policy: Writer, Editor, Lead, and Beat/Deep-Dive panels all map to `claude-opus-4.6`; casual panels map to `claude-sonnet-4.5`; lightweight tasks map to `gpt-5-mini`; and target output budgets are declared under `max_output_tokens`.[^4] The skills and charters point back to that file for panel sizing, Writer/Editor budgets, and lightweight-task routing.[^5][^6][^7][^8]

However, the repo also contains conflicting procedural guidance: `team.md` still says “all agents” use `claude-opus-4.6` except Scribe.[^17] More importantly, the runtime JS/PY surfaces I inspected (`content/pipeline_state.py`, `content/article_board.py`, and the extensions) do not load `models.json`; they manage DB state, artifact inference, publishing, or image generation, but not model selection enforcement.[^1][^3][^16][^18][^19]

That gap matters because **you cannot optimize or audit model usage reliably until model selection is executable, not just documented**. Right now, `models.json` is a policy file, not an authoritative runtime controller.[^4][^5][^17]

### 3. The repo’s extensions split cleanly into LLM-backed vs non-LLM-backed surfaces

The Substack publisher is a pure transformation/publishing tool: it converts markdown to Substack’s ProseMirror shape, creates or updates a draft, and explicitly tells the caller to perform DB writeback through `PipelineState` rather than direct JS-side SQL.[^16] The table renderer is a deterministic local rendering tool that wraps `renderer-core.mjs`; it is not an AI call surface.[^19]

The image generator is different. `generate_article_images` directly calls Google models, defaults to Gemini, can fall back to or explicitly select Imagen 4, returns the model used in tool output, and writes image files to `content/images/{slug}/`.[^18] That makes image generation the easiest place to get **definitive provider-side telemetry** quickly: the extension itself already knows `article_slug`, prompt, chosen model, output files, and image count.[^18]

### 4. The repo itself admits cost tracking is unfinished

The public README still lists “Cost tracking — API spend per article, unit economics at 32-team scale” as planned rather than built, and `VISION.md` explicitly calls out “Measure cost” as a next-session priority.[^20][^21] The manual `TOKEN_USAGE_ANALYSIS.md` gives rough stage estimates, but it is a hand-maintained analysis artifact rather than live telemetry, and it even says no token-limiting logic was found — which now conflicts with the later introduction of `models.json` token-budget guidance.[^22][^23][^4]

So the repo is already aware of the problem; it just has not crossed the line from **estimation** to **instrumentation**.[^20][^21][^22]

## What you can measure definitively today

### GitHub Copilot: monthly quota and daily CLI usage

GitHub already gives you definitive **premium-request** accounting. Premium requests are tracked monthly, reset on the first of each month at `00:00:00 UTC`, can be viewed in the IDE or on GitHub.com, and detailed analytics/downloads are available for supported roles.[^9][^10] Premium requests also separate billing by SKU (for example, general Copilot premium requests vs Spark vs Copilot coding agent), which is useful for overall monthly budget control.[^9]

GitHub also now exposes **enterprise Copilot usage metrics** and documents CLI-specific fields in the usage-metrics exports/API. Those fields include daily active CLI users, CLI session count, CLI request count, CLI prompt-token sum, CLI output-token sum, and average tokens per request.[^11][^12][^13] That is the best authoritative answer to “how much text-model usage is our CLI generating overall?”

There are three important limitations, though:

1. The usage metrics are **daily** reports/exports, not live per-request hooks.[^12][^13]
2. GitHub documents a **two-full-day freshness lag** for usage metrics data.[^11]
3. GitHub’s CLI metrics are **not article-aware**. They are enterprise/user scoped; they do not know what `article_id` or `stage` generated the requests.[^11][^12][^13]

There is another subtle limitation: GitHub’s documented dashboard model-usage charts are for Copilot chat activity, while CLI usage is documented through the separate `totals_by_cli` object. The docs I found do **not** document a CLI-per-model breakdown equivalent to the article pipeline’s stage/model needs.[^12] So GitHub can tell you **how much CLI usage happened**, but not cleanly “this article’s Writer pass on Opus cost X tokens.”[^12][^13]

### Google Gemini / Imagen: direct usage and separate spend controls

On the Google side, the situation is better because you own the API calls in the extension. Gemini’s token docs state that you can preflight input size with `countTokens` and read `usageMetadata` after `generateContent`, including prompt, output, and total token counts; Google also documents multimodal token counting, and CountTokens is not billed.[^14][^24][^25] Google’s billing guide adds that usage can be monitored in AI Studio, that spend caps can be set at the project level, and that billing is attached to the Google Cloud billing account/project rather than to the API key itself.[^25]

For image generation specifically, the repo uses two paths:

- Gemini native image generation (`gemini-3-pro-image-preview`) via `generateContent`.[^18]
- Imagen 4 Ultra (`imagen-4.0-ultra-generate-001`) via the REST `:predict` endpoint.[^18][^26]

Google’s pricing docs show that image-capable Gemini models have explicit image-output pricing, and the Imagen docs define the model IDs, max images per prompt, aspect-ratio support, and quotas for Imagen 4 variants.[^24][^26][^27] Practically, that means you can get definitive local telemetry for Gemini/Imagen **today** if you log the extension inputs/outputs and reconcile them against AI Studio / Cloud billing. Even where a specific response lacks token fields (for example, raw Imagen predict responses), you still control the request count, sample count, chosen model, and resulting image outputs.[^18][^25][^26][^27]

### Anthropic direct API: future option if you move away from opaque Copilot execution

If you decide later that you need exact per-request token accounting on the text-generation side, Anthropic’s direct APIs are a viable future state. Anthropic documents the Messages API as the primary call surface and separately documents prompt caching, including model-specific prices for base input, cache writes, cache hits, and output tokens.[^15][^28] In other words, direct Anthropic usage can be metered precisely at the request layer.

That option is important because it defines the ceiling: **exact per-article text-model accounting is straightforward when you own the API call**, but much harder when the work is happening inside Copilot’s agent runtime and only surfaces later as enterprise/day/user metrics.[^11][^12][^15][^28]

## What it would take in this repo

## 1. Turn on provider-of-record reporting first

Before changing repo code, enable the upstream reports that answer the monthly-budget question directly:

- GitHub premium-request analytics and usage reports for Copilot billing/quota.[^9][^10]
- GitHub enterprise Copilot usage metrics API/export for daily CLI token totals and request/session counts.[^11][^12][^13]
- Google AI Studio usage dashboard plus project/billing-account spend caps for Gemini/Imagen.[^25]

This step gives you immediate operational visibility even before article-level attribution exists.

## 2. Add a repo-local attribution ledger to `pipeline.db`

The schema currently has no usage table; it stops at pipeline state and publishing metadata.[^2] Add a new telemetry table rather than overloading `stage_transitions.notes` forever. A practical starting design would be:

| Table | Purpose | Key fields |
| --- | --- | --- |
| `article_runs` | One logical end-to-end article execution | `run_id`, `article_id`, `trigger`, `started_at`, `ended_at`, `status` |
| `stage_runs` | One execution of a pipeline stage | `stage_run_id`, `run_id`, `article_id`, `stage`, `actor`, `started_at`, `ended_at`, `status` |
| `usage_events` | Fine-grained model/tool/billing events | `stage_run_id`, `surface`, `provider`, `model_or_tool`, `request_count`, `prompt_tokens`, `output_tokens`, `premium_requests`, `cached_tokens`, `image_count`, `cost_usd_estimate`, `metadata_json`, `created_at` |
| `provider_daily_reconciliation` | Imported provider truth | `provider`, `day`, `scope`, `prompt_tokens`, `output_tokens`, `premium_requests`, `cost_usd`, `source_file` |

If you want to keep the first cut smaller, a single `usage_events` table is enough. The important thing is that every row includes `article_id`, `stage`, `surface`, and `provider`.

## 3. Put instrumentation at the existing control points

The lowest-risk instrumentation points are already present:

- `PipelineState.advance_stage()` and companion helpers are the cleanest place to write article-scoped events because they already govern stage changes.[^1]
- Lead stage orchestration is where the repo chooses panel size, stage flow, and intended model policy, so it should emit “planned run” and “completed run” events for panel composition, panel execution, Writer, and Editor passes.[^6][^7][^8]
- `generate_article_images` should persist the chosen image model, prompt hash, output count, and output file paths because it already has those values in memory.[^18]
- `render_table_image` should log table-render events, since those are deterministic local costs with no provider spend.[^19]
- `publish_to_substack` should log publish/create/update events and draft URLs, but continue deferring actual DB mutations to `PipelineState` as the extension already intends.[^16]

This gives you definitive answers to **which model/tool ran where** even before you have perfect provider-token correlation.

## 4. Make `models.json` executable

Today, the cost-sensitive model policy exists mostly in markdown and JSON guidance.[^4][^5][^17] To make optimization safe, introduce a single runtime wrapper for article-stage spawns that:

- reads `.squad/config/models.json`,
- resolves `requested_model` and `output_budget`,
- emits a `usage_event` before the call,
- emits a completion event after the call,
- stores `requested_model` even when provider-side model confirmation is unavailable.

Until you do this, editing `models.json` does not reliably change runtime behavior, so per-model optimization remains partly aspirational.[^4][^5][^17]

## 5. Reconcile local attribution to provider truth nightly

Because GitHub’s Copilot exports are daily and article-agnostic, a nightly reconciliation job is the right operating model.[^11][^12][^13] Import the previous day’s GitHub premium-request and CLI token totals into `provider_daily_reconciliation`, then compare them with the repo’s locally logged `usage_events`.

That lets you answer two different questions:

- **Billing / quota truth:** “How much of the monthly allowance did we burn yesterday / this month?”
- **Operational attribution:** “Which articles, stages, or model choices likely drove that usage?”

For Google, do the same using AI Studio / Cloud billing totals and the locally logged Gemini/Imagen events.[^24][^25][^26]

## 6. If exact per-article Copilot token counts become mandatory, change the architecture

If “definitive” means **not reconciled, not estimated, but exact at the per-article/per-stage request level**, then the Copilot-based article-generation path is the hard constraint. GitHub’s current documented metrics are strong for enterprise governance, but they do not expose article-level correlation IDs or request-level hooks tied to your `article_id`.[^11][^12][^13]

So the architectural answer is:

- keep Copilot for orchestration, editing, and repo automation, **or**
- move core text-generation stages (Lead / panelists / Writer / Editor) to APIs you call directly and meter yourself.

That is the only way to turn per-article text usage from “reconciled attribution” into “provider-exact accounting.”[^11][^12][^15][^28]

## Model / cost optimization implications

The repo’s intended policy already tells you where the premium pressure is concentrated. Beat and Deep-Dive panels, Lead, Writer, and Editor all point at `claude-opus-4.6`; only casual panels use Sonnet, and lightweight tasks are assigned to `gpt-5-mini`.[^4] On a paid Copilot plan, `gpt-5-mini`, `GPT-4.1`, and `GPT-4o` are included models that do not consume premium requests, while premium models consume allowance according to multipliers.[^9]

That means the biggest near-term optimization lever is **not** Substack or table rendering — those are non-LLM surfaces in repo code.[^16][^19] The biggest lever is turning more low-reasoning tasks into explicitly lightweight tasks and then enforcing that choice at runtime. Good candidates include:

- Stage-1 idea viability triage (already documented as lightweight in the lifecycle skill).[^7]
- Stage-3 panel composition and metadata extraction (already documented as `gpt-5-mini`).[^7][^8]
- Other slot-filling / summarization tasks that do not need Opus-quality reasoning.[^7]

I would **not** start by downgrading Writer or final Editor blindly. First make model choice executable and measurable, then run controlled comparisons using revise rates, editor red-flag counts, and publish success as guardrails.[^4][^6]

For image generation, keep it as a separate cost center. It is already isolated in the extension and separate from Copilot billing.[^18][^24][^25]

## Recommended rollout order

1. **Enable upstream reporting**: GitHub premium analytics, GitHub enterprise Copilot usage metrics, Google AI Studio usage/spend caps.[^9][^10][^11][^25]
2. **Fix obvious schema drift**: the runtime expects `substack_draft_url`, while `content/schema.sql` still only shows `substack_url` in the `articles` table; bring the schema in line before adding more telemetry.[^2][^1][^29]
3. **Add `usage_events` (or equivalent)** to `pipeline.db` and a `PipelineState.record_usage_event()` helper.[^1][^2]
4. **Instrument extensions first** (`generate_article_images`, `render_table_image`, `publish_to_substack`) because those surfaces are easiest to make definitive.[^16][^18][^19]
5. **Wrap article-stage spawns** so model selection and run events are logged through one runtime path.[^4][^5][^6][^7]
6. **Add nightly reconciliation** against GitHub and Google provider exports.[^10][^11][^25]
7. **Only if required**, migrate text-generation stages to direct APIs for fully exact per-article accounting.[^15][^28]

## Confidence Assessment

**High confidence**

- The repo has strong pipeline-state tracking but no first-class usage ledger.[^1][^2][^3]
- The current model policy is documented in `.squad/config/models.json` and related skills, but is not obviously enforced by inspected runtime JS/PY surfaces.[^4][^5][^6][^7][^8][^16][^18][^19]
- GitHub can provide premium-request billing truth and daily CLI token totals, but those reports are not article-scoped.[^9][^10][^11][^12][^13]
- Gemini/Imagen usage is the easiest surface to instrument definitively because the repo directly owns those HTTP calls.[^18][^24][^25][^26]

**Moderate confidence / inference**

- GitHub’s current docs do not appear to expose a CLI-per-model breakdown analogous to the repo’s desired per-stage/per-model reporting, so local model logging is still necessary.[^12][^13]
- Exact per-article Copilot token accounting is unlikely to be achievable without architectural changes, because the documented GitHub metrics are daily and enterprise/user oriented rather than request/article oriented.[^11][^12][^13]

## Footnotes

[^1]: `C:\github\nfl-eval\content\pipeline_state.py:1-13`, `C:\github\nfl-eval\content\pipeline_state.py:21-34`, `C:\github\nfl-eval\content\pipeline_state.py:134-185`.
[^2]: `C:\github\nfl-eval\content\schema.sql:10-29`, `C:\github\nfl-eval\content\schema.sql:35-129`.
[^3]: `C:\github\nfl-eval\content\article_board.py:202-351`.
[^4]: `C:\github\nfl-eval\.squad\config\models.json:1-31`.
[^5]: `C:\github\nfl-eval\.squad\skills\article-discussion\SKILL.md:166-185`.
[^6]: `C:\github\nfl-eval\.squad\skills\substack-article\SKILL.md:73-80`.
[^7]: `C:\github\nfl-eval\.squad\skills\article-lifecycle\SKILL.md:214-223`, `C:\github\nfl-eval\.squad\skills\article-lifecycle\SKILL.md:497-509`.
[^8]: `C:\github\nfl-eval\.squad\agents\lead\charter.md:91-98`.
[^9]: https://docs.github.com/en/billing/concepts/product-billing/github-copilot-premium-requests
[^10]: https://docs.github.com/en/copilot/how-tos/manage-and-track-spending/monitor-premium-requests
[^11]: https://docs.github.com/en/copilot/concepts/copilot-usage-metrics/copilot-metrics
[^12]: https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/copilot-usage-metrics/copilot-usage-metrics
[^13]: https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-usage-metrics and https://github.blog/changelog/2026-02-27-copilot-usage-metrics-now-includes-enterprise-level-github-copilot-cli-activity/
[^14]: https://ai.google.dev/gemini-api/docs/tokens
[^15]: https://docs.anthropic.com/en/api/messages and https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
[^16]: `C:\github\nfl-eval\.github\extensions\substack-publisher\extension.mjs:1535-1810`.
[^17]: `C:\github\nfl-eval\.squad\team.md:113-121`.
[^18]: `C:\github\nfl-eval\.github\extensions\gemini-imagegen\extension.mjs:46-57`, `C:\github\nfl-eval\.github\extensions\gemini-imagegen\extension.mjs:196-216`, `C:\github\nfl-eval\.github\extensions\gemini-imagegen\extension.mjs:240-306`, `C:\github\nfl-eval\.github\extensions\gemini-imagegen\extension.mjs:311-391`.
[^19]: `C:\github\nfl-eval\.github\extensions\table-image-renderer\extension.mjs:1-80`.
[^20]: `C:\github\nfl-eval\README.md:138-146`.
[^21]: `C:\github\nfl-eval\VISION.md:154-158`.
[^22]: `C:\github\nfl-eval\TOKEN_USAGE_ANALYSIS.md:35-63`, `C:\github\nfl-eval\TOKEN_USAGE_ANALYSIS.md:116-128`.
[^23]: `C:\github\nfl-eval\TOKEN_USAGE_ANALYSIS.md:92-108`.
[^24]: https://ai.google.dev/gemini-api/docs/pricing and https://ai.google.dev/gemini-api/docs/image-generation
[^25]: https://ai.google.dev/gemini-api/docs/billing and https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/count-tokens
[^26]: https://ai.google.dev/gemini-api/docs/imagen
[^27]: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/imagen/4-0-generate
[^28]: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
[^29]: `C:\github\nfl-eval\check-stage7-eligibility.mjs:25-45`.
