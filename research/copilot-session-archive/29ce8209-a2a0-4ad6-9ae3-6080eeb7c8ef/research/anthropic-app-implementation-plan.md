# Anthropic Harness Research — App Implementation Plan

## Objective

Apply the Anthropic planner -> generator -> evaluator harness ideas to the **article pipeline, runtime, and shipped reader experience** so article production becomes more contract-driven, easier to recover on long runs, and stricter at the rendered publish surface.

## Scope

### In scope
- Stage 2-7 article runtime changes inside the app pipeline
- New or revised article artifacts such as `article-contract.md`, `publish-preview.md`, or `handoff.md`
- Writer / Editor / Publisher contract flow
- Render-time and publish-time QA tied to the real Substack payload path
- Trace / handoff metadata that supports long-running or restarted article runs

### Out of scope
- Squad issue routing, Ralph backlog behavior, or team operating model
- General GitHub issue workflow changes
- Replacing the provider stack or changing the fundamental 8-stage pipeline for a first pass
- Public content strategy or editorial calendar decisions

## Phases and dependencies

### Phase 1 — Add an article contract artifact
**Depends on:** none  
**Goal:** make "done" explicit before drafting starts.

**What to add**
- Create an `article-contract.md` artifact after discussion synthesis.
- Keep it compact and operational: thesis, must-cover evidence, required disagreement, mandatory sections, caveats, editor fail conditions, publish-specific checks.
- Treat it as the shared contract for Writer, Editor, and Publisher rather than scattering the same requirements across prompts.

**Exact repo insertion points**
- `src\pipeline\actions.ts` -> `runDiscussion()`
  - immediately after `runDiscussion-synthesis` produces `discussion-summary.md`
  - add a follow-up contract-generation step or helper that writes `article-contract.md`
- `src\pipeline\context-config.ts`
  - add `article-contract.md` to the include lists for `writeDraft`, `runEditor`, and `runPublisherPass`
- `src\pipeline\engine.ts`
  - add a new `requireArticleContract()` guard, or extend the stage 4 -> 5 guard so Stage 5 cannot run with only `discussion-summary.md`
- `src\config\defaults\skills\article-discussion.md`
  - extend the synthesis section so the stage explicitly emits both summary and contract outputs

**Why this phase first**
- It is the cleanest translation of Anthropic's negotiated sprint-contract idea.
- It improves later stages without forcing a stage-model redesign up front.

---

### Phase 2 — Make Writer and Editor execute against the same contract
**Depends on:** Phase 1  
**Goal:** turn Stage 5 and Stage 6 into a true generator/evaluator pair.

**What to change**
- Writer should draft against `article-contract.md`, not just a broad summary bundle.
- Editor should score the draft against explicit thresholds tied to that contract.
- The evaluator output should surface both prose feedback and a structured scorecard or checklist.

**Exact repo insertion points**
- `src\pipeline\actions.ts` -> `writeDraft()`
  - include `article-contract.md` in `content`
  - strengthen `buildWriterTask()` or the Stage 5 task text so revision loops say "repair to contract" rather than "rewrite"
- `src\pipeline\actions.ts` -> `runEditor()`
  - inject `article-contract.md` into the editor task bundle
  - add an explicit evaluator rubric before the existing `APPROVED | REVISE | REJECT` verdict
- `src\config\defaults\skills\substack-article.md`
  - declare the contract artifact as required upstream input alongside `discussion-summary.md`
- `src\config\defaults\skills\editor-review.md`
  - add threshold categories such as evidence completeness, disagreement fidelity, reader usefulness, and publishability
- `src\pipeline\engine.ts`
  - optionally tighten `requireEditorApproval()` later so approval can require both verdict + completed evaluator fields if a structured scorecard is introduced

**Notes on sequencing**
- Do not add a new stage yet; keep this as a stronger Stage 5/6 handshake first.
- Keep the existing revision loop behavior, but make the retry prompt contract-specific.

---

### Phase 3 — Add publish-preview QA on the rendered output
**Depends on:** Phases 1-2  
**Goal:** evaluate the thing readers actually consume, not only raw markdown.

**What to add**
- A deterministic or hybrid QA pass that checks the generated publish payload before live publish.
- Validation should cover TLDR placement, subscribe widgets, footer blurb, image placement, payload validity, and other Substack-shape rules.

**Exact repo insertion points**
- `src\dashboard\server.ts` -> `buildPublishPresentation()`
  - use this as the canonical source for markdown -> ProseMirror preview truth
- `src\dashboard\server.ts` -> `enrichSubstackDoc()`
  - use this as the canonical publish-only chrome and payload validation seam
- `src\pipeline\actions.ts` -> `runPublisherPass()`
  - add or call a deterministic `publish-preview` / `publish-validation` step before writing `publisher-pass.md`
- `src\pipeline\engine.ts`
  - if the preview becomes a first-class artifact, require it before Stage 7 -> 8 publish
- `src\config\defaults\skills\publisher.md`
  - update the checklist so Publisher consumes the same preview validation artifact the app generated

**Sequencing recommendation**
- First implementation should fold this into `runPublisherPass()` rather than inserting a ninth stage.
- Only promote it to a separate stage if failure modes and operator value justify the extra state.

---

### Phase 4 — Add long-running handoff / restart hygiene
**Depends on:** Phases 1-2; can overlap Phase 3  
**Goal:** make long revision chains and provider resets resumable instead of context-bloated.

**What to add**
- Create a compact `handoff.md` artifact whenever revision depth, context size, or provider reset conditions cross a threshold.
- Persist enough trace metadata to distinguish one-shot, resumed, and handoff-driven runs.
- Prefer fresh-context restarts with good handoffs over endlessly accumulated prompts.

**Exact repo insertion points**
- `src\agents\runner.ts`
  - around system prompt assembly and `startLlmTrace()` metadata creation
  - capture handoff usage and resumed-run metadata near the existing trace payload build
- `src\db\repository.ts` -> `startLlmTrace()`, `completeLlmTrace()`, `failLlmTrace()`
  - persist any added handoff / resume metadata using existing trace JSON columns
- `src\pipeline\actions.ts` -> `writeDraft()` and `runEditor()`
  - emit `handoff.md` when revision loops exceed a configured threshold
- `src\pipeline\conversation.ts` and revision-summary flow
  - use the existing compact revision context as the seed for the handoff artifact instead of inventing a second summary system

**Why later**
- This only pays off after contract-driven drafting and evaluation exist.
- Otherwise the system just restarts a fuzzy workflow faster.

## Risks

- **Contract duplication risk:** `article-contract.md` could drift from skills and prompt text if ownership is unclear.
- **Evaluation over-strictness:** a stricter Editor can create endless revise loops if thresholds are not staged in.
- **False-positive publish QA:** deterministic checks can block good drafts if validation is too brittle.
- **Latency / cost creep:** extra generation and validation steps add tokens and runtime.
- **Operator confusion:** if preview artifacts and publisher-pass artifacts overlap unclearly, the dashboard story gets muddier instead of clearer.

## Validation strategy

### Before broad rollout
- Pilot on one article type with high factual risk (contract / draft / cap story), not every article type at once.
- Compare pre/post behavior on revision count, publish failures, and article defect classes caught.

### Repo-level validation targets
- `tests\pipeline\` for new guard behavior and stage transition rules
- `tests\dashboard\` for publish-preview / ProseMirror payload validation behavior
- `tests\e2e\` for one full article path that exercises contract -> draft -> editor -> publisher
- trace inspection in the dashboard / DB to confirm new artifacts and metadata show up where operators expect

### Success criteria
- Writer and Editor clearly consume the same article contract
- publish-preview catches format / payload issues before live publish
- long revision chains become shorter or at least easier to resume cleanly

## Recommended first slice

**Do Phase 1 plus the lightest part of Phase 2.**

Specifically:
1. generate `article-contract.md` after `runDiscussion-synthesis`
2. include it in `writeDraft` and `runEditor` context bundles
3. update `editor-review.md` so Editor explicitly grades against the contract
4. leave publish-preview and handoff mechanics for later slices

That first slice keeps the current stage model intact, gives immediate product/runtime leverage, and creates the shared artifact every later Anthropic-style improvement needs.
