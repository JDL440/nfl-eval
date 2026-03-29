# App implementation plan — article pipeline / runtime / product

## Objective

Turn the Anthropic-inspired harness ideas into a product-facing article runtime plan that improves article quality, makes "done" explicit before drafting, adds deterministic delivery QA, and keeps long revision chains coherent without over-expanding prompt complexity.

## Scope

### In scope

- Contract-first article generation for Stages 4-7
- Explicit evaluator thresholds for Writer and Editor
- Pre-publish render/QA against the real Substack payload path
- Long-running handoff and trace metadata needed for resets/resume
- Instrumentation needed to measure whether the added harness pieces are worth their cost

### Out of scope

- New provider integrations or a provider swap
- Rewriting the eight-stage pipeline from scratch
- Public-facing product copy changes beyond artifacts and validation surfaces
- General Squad/Ralph orchestration changes (covered in the engineering-system plan)
- Broad schema redesign; use existing artifacts, conversations, traces, and usage tables where possible

## Phases and dependencies

### Phase 1 — Contract artifact before drafting
**Depends on:** current Stage 4 synthesis output only

Create `article-contract.md` immediately after Stage 4 synthesis so Writer and Editor share the same contract.

Deliverables:
- `article-contract.md` artifact
- stable contract shape:
  - thesis / franchise question
  - required evidence anchors
  - required disagreement to preserve
  - mandatory sections
  - acceptable uncertainty / caveats
  - explicit editor fail conditions
  - publish-readiness checks

### Phase 2 — Contract-aware drafting and evaluation
**Depends on:** Phase 1

Feed the contract into Stage 5 and Stage 6 automatically, then tighten evaluation around explicit thresholds instead of implicit "good article" judgment.

Deliverables:
- Writer receives contract in upstream context
- Editor prompt and skill explicitly grade against contract thresholds
- editor output optionally includes a structured score block plus existing verdict

### Phase 3 — Render-truth QA before publisher handoff
**Depends on:** Phase 2

Add a deterministic preview/QA pass on the same code path that produces the Substack payload, so the system evaluates what readers will actually receive.

Deliverables:
- preview artifact or validation artifact (for example `publish-preview.md` or `publish-qa.md`)
- checks for TLDR, subscribe widget, footer blurb, payload validity, and image embedding
- fail-closed gate before or within publisher handoff

### Phase 4 — Long-running handoff / reset hygiene
**Depends on:** Phase 2; benefits increase after Phase 3

Introduce structured handoff artifacts and trace metadata for long revision chains, provider-session resets, or context-budget pressure.

Deliverables:
- `handoff.md` artifact written when revision/context thresholds trip
- trace metadata capturing reset reason, handoff presence, and resume lineage
- provider/runtime hooks that can intentionally reset while preserving the exact next task

### Phase 5 — Measure and prune harness complexity
**Depends on:** Phases 1-4 instrumented

Use traces, usage, and retrospectives to determine which harness additions are actually load-bearing.

Deliverables:
- review loop for contract efficacy, editor strictness, render-QA failure modes, and reset frequency
- evidence-based decision on whether some article classes can use a lighter path

## Exact repo insertion points

### Stage 4 contract creation
- `src\pipeline\actions.ts`
  - `runDiscussion(...)`
    - immediately after `runDiscussion-synthesis` succeeds and before returning
    - write `article-contract.md` from `discussion-summary.md` plus panel artifacts
- helper seam nearby:
  - add a dedicated builder such as `buildArticleContract(...)` or `writeArticleContract(...)`

### Context propagation
- `src\pipeline\context-config.ts`
  - `CONTEXT_CONFIG.writeDraft.include`
  - `CONTEXT_CONFIG.runEditor.include`
  - `CONTEXT_CONFIG_PRESETS.rich.writeDraft.include`
  - `CONTEXT_CONFIG_PRESETS.rich.runEditor.include`
  - include `article-contract.md` so `gatherContext(...)` passes it automatically

### Writer contract execution
- `src\pipeline\actions.ts`
  - `writeDraft(...)`
    - before `buildWriterTask(...)` / `runAgent(...)`, ensure the contract is present in gathered context
    - if preflight remains deterministic, treat contract misses as repair reasons in the existing self-heal branch

### Editor as evaluator
- `src\pipeline\actions.ts`
  - `runEditor(...)`
    - update the `task` passed to `runAgent(...)` so review explicitly grades against contract thresholds
    - optionally persist a structured score block artifact before/alongside `editor-review.md`
- `src\config\defaults\skills\editor-review.md`
  - define threshold language for evidence completeness, disagreement fidelity, reader usefulness, and publishability

### Render-truth publish QA
- `src\dashboard\server.ts`
  - `buildPublishPresentation(...)`
    - use as the source of truth for draft-to-render transformation
  - `enrichSubstackDoc(...)`
    - use as the source of truth for publish-only chrome and payload validation
  - `saveOrUpdateSubstackDraft(...)`
    - natural seam if QA remains part of Stage 7 instead of becoming a new pipeline step
- `src\pipeline\actions.ts`
  - `runPublisherPass(...)`
    - best place to enforce render/payload QA before moving into publish
- `src\pipeline\engine.ts`
  - `TRANSITION_MAP`
    - only needed if preview/QA becomes an explicit new stage/action rather than a stricter Stage 7 gate

### Handoff / reset mechanics
- `src\agents\runner.ts`
  - `AgentRunner.run(...)`
    - near trace assembly and context composition around `startLlmTrace(...)`
    - capture handoff metadata and reset triggers
- `src\db\repository.ts`
  - `startLlmTrace(...)`
  - `completeLlmTrace(...)`
    - store additional metadata for reset reason, parent trace, handoff artifact version, and resume status
- `src\llm\providers\copilot-cli.ts`
  - `buildExecutionPlan(...)`
  - resumed vs one-shot execution path in `chat(...)`
    - use existing resumed/one-shot distinction for intentional reset lineage rather than opaque fallback only

## Risks

- **Contract bloat:** a verbose contract could become just another context dump.
- **Evaluator over-strictness:** Editor could block throughput if thresholds are too brittle.
- **False confidence from deterministic QA:** payload validation can pass while article usefulness is still weak.
- **Reset complexity:** resume/handoff metadata can become hard to reason about if not normalized.
- **Harness creep:** adding more artifacts and gates may increase latency/cost without quality lift.

## Validation strategy

### Contract phase validation
- Unit/integration tests around artifact creation and context inclusion
- Snapshot a representative `article-contract.md` from seeded article fixtures
- Verify `writeDraft` and `runEditor` both receive the contract via gathered context

### Evaluator validation
- Update tests that cover editor verdict extraction and revision loops
- Add fixtures where Editor should:
  - approve a compliant draft
  - request revision for missing evidence
  - reject a clearly broken draft

### Render-QA validation
- Add tests around the publish path using the existing ProseMirror transformation seams
- Confirm failures for missing subscribe/footer/payload issues are caught before publish
- Verify valid drafts still publish unchanged

### Long-running validation
- Exercise at least one forced reset/resume path
- Confirm trace metadata records one-shot vs resumed lineage and handoff presence
- Confirm a revision chain can resume from handoff without losing the latest blockers

### Pruning validation
- Compare latency, revision count, and approval rate before/after
- Use `usage_events`, `llm_traces`, and article retrospectives to decide if each added harness piece earns its keep

## Recommended first slice

Implement **Phase 1 + the minimum Phase 2 hook**:

1. write `article-contract.md` at the end of `runDiscussion(...)`
2. include it in `context-config.ts` for `writeDraft` and `runEditor`
3. update `editor-review.md` plus `runEditor(...)` task wording so Editor explicitly judges against that contract

Why this first:
- it is the smallest slice that changes behavior at both generation and evaluation time
- it uses existing artifact/context machinery
- it creates a clear baseline before adding render QA or reset logic
