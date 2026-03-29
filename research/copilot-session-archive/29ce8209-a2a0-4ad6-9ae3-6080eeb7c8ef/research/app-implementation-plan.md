# Article Pipeline Implementation Plan
## Harness Design for nfl-eval Article Generation

**Objective:** Evolve the article generation pipeline (Stages 1-8) to enforce a planner→generator→evaluator harness with explicit contracts, threshold-based evaluation, and long-running coherence mechanics.

**Owner:** Code agent (implementation), Lead (planning coordination)

---

## Scope

**In Scope:**
- Article contract artifact design and generation
- Editor evaluation rule enhancement with threshold categories
- Pre-publish render/QA validation pass
- Context reset and handoff mechanics for long revision chains
- Integration of contract throughout artifact gather pipeline
- Usage tracking for harness quality metrics

**Out of Scope:**
- Changes to the 32-team agent charters or NFL domain knowledge
- Dashboard UI redesign (contract viewing is read-only via traces)
- Substack publishing workflow changes
- Image generation or external service integrations
- Memory system overhaul (use current empty state as baseline)

---

## Phased Implementation Plan

### Phase 1: Contract-First Article Harness (Foundation)
**Weeks 1-2** | Dependency: None | Risk: Medium

#### 1.1 Design and Implement article-contract.md Artifact
- **Objective:** Create a negotiated contract that bridges planning and evaluation.
- **Insertion point:** `src/pipeline/actions.ts` after `runDiscussion` synthesis (around line 1049)
- **What it produces:** An artifact capturing:
  - Article thesis / core question
  - Required evidence anchors (3-5 load-bearing facts that must be supported)
  - Required disagreement to preserve (tensions/expert differences that matter)
  - Mandatory sections (structure requirements)
  - Acceptable uncertainty / caveats (where vagueness is okay)
  - Explicit fail conditions for Editor (REJECT reasons)
  - Publish-readiness checks (Substack/content-specific requirements)
- **Implementation detail:** Call a new agent function `generateArticleContract()` that:
  - Takes the panel discussion summary and discussion prompt as input
  - Outputs markdown with the structure above
  - Stores it in the existing `artifacts` table with `type: 'article-contract'`
- **Validation:** The contract must be readable to both Writer and Editor without ambiguity
- **Complexity estimate:** 1-2 days (prompt design + integration)

#### 1.2 Feed Contract into Stage 5 and Stage 6 Context
- **Objective:** Make article-contract.md automatically available to Writer and Editor.
- **Insertion point:** `src/pipeline/context-config.ts` in `gatherContext()` (around line 698-767)
- **What changes:** When fetching context for `writeDraft` or `runEditor`, automatically append the contract artifact to the context bundle
- **Implementation detail:**
  - Query `artifacts` table for `type: 'article-contract'` for the current article
  - If found, prepend it to the context with a clear section label
  - If not found, fail gracefully (contract is optional in fallback mode)
- **Validation:** Both Writer and Editor traces must show the contract in their context
- **Complexity estimate:** 0.5 days (straightforward context path amendment)

#### 1.3 Update Editor Evaluation Rules with Thresholds
- **Objective:** Make Editor a true evaluator that grades against explicit contract criteria.
- **Insertion point:** `src/config/defaults/skills/editor-review.md` (lines 15-72) and `src/pipeline/actions.ts` in `runEditor` (lines 1286-1462)
- **What changes:**
  - Add a new section to editor-review.md: "Contract-Based Evaluation Rubric"
  - Define four threshold categories Editor must grade against:
    - **Evidence completeness** (0-25 points): Are load-bearing claims actually supported?
    - **Disagreement fidelity** (0-25 points): Is interesting tension preserved or averaged away?
    - **Reader usefulness** (0-25 points): Does it answer the franchise question with a clear verdict?
    - **Publishability** (0-25 points): Does it satisfy the contract + Substack formatting?
  - Editor should emit a score block before the verdict (APPROVED/REVISE/REJECT)
  - Score <75 → force REVISE; <60 → REJECT
- **Implementation detail:**
  - Modify the Editor prompt in `runEditor` to reference the contract
  - Ask Editor to structure the response: `[SCORES: Evidence:X Disagreement:Y Reader:Z Pub:W]` then `[VERDICT: ...]`
  - Parse the score block from Editor's response and store it in the trace
  - Record scores as usage events for retrospective analysis
- **Validation:** Editor traces must include structured score blocks; scores must correlate with REVISE/REJECT verdicts
- **Complexity estimate:** 1.5 days (prompt design, parsing logic, trace integration)

---

### Phase 2: Evaluator Strengthening and Delivery QA
**Weeks 3-4** | Dependency: Phase 1 complete | Risk: Medium

#### 2.1 Add Pre-Publish Render/QA Pass
- **Objective:** Validate rendered article output before Stage 7/8, not just the markdown draft.
- **Insertion point:** `src/pipeline/actions.ts` as a new action between `runEditor` and `publisherPass`, or folded into `publisherPass` as a stricter gate
- **What it does:** 
  - Takes the approved draft markdown from Stage 6
  - Calls the existing `buildPublishPresentation()` from `src/dashboard/server.ts` (lines 326-559)
  - Validates:
    - TLDR present and well-formed (top section, 2-3 sentences)
    - Subscribe widget injected in footer
    - Footer blurb present and not stale
    - All image references resolve and embed correctly
    - ProseMirror payload builds without errors
    - Substack article structure matches contract (sections, emphasis, links)
  - Fails the article if any check fails, returning a machine-readable error list
  - Records the validation result as a usage event
- **Implementation detail:**
  - Create a new function `validatePublishPreview()` in `src/pipeline/actions.ts`
  - Call `enrichSubstackDoc()` to generate the ProseMirror document
  - Run deterministic checks on the payload (no agent needed)
  - For layout issues (if screenshots are wanted), defer to Phase 2b as optional
  - On failure, emit structured JSON with failed checks; on success, proceed to Stage 7
- **Validation:** All approved articles must pass render QA before publishing; failures must be actionable (specific field or section)
- **Complexity estimate:** 1.5-2 days (integration with publish path + validation logic)

#### 2.2 Record Failures and Track Metrics
- **Objective:** Build observability for the harness so you can optimize later.
- **Insertion point:** `src/db/schema.sql` (no schema change needed) + `src/pipeline/actions.ts` + `src/services/repository.ts`
- **What changes:**
  - When Editor scores or render QA fails, store the structured result as a usage event
  - Use existing `usage_events` table with `event_type: 'harness-score'` or `'harness-qa-fail'`
  - Record: article ID, stage, metric name, value, timestamp
  - Tag with article retroactive metadata (team, topic, model used) for later cohort analysis
- **Implementation detail:**
  - No schema change; reuse existing `usage_events` table
  - Create helper function `recordHarnessMetric(articleId, category, score, details)`
  - Call it from Editor prompt parsing and render QA validation
- **Validation:** Metrics appear in usage_events with queryable fields; retrospective digest can aggregate them
- **Complexity estimate:** 0.5 days (straightforward logging)

---

### Phase 3: Long-Running Harness Hygiene
**Weeks 5-6** | Dependency: Phase 1 complete | Risk: Lower

#### 3.1 Add handoff.md Artifacts for Long Revision Chains
- **Objective:** Preserve coherence when revision count is high or context budget is tight.
- **Insertion point:** `src/agents/runner.ts` near context assembly (lines 795-980)
- **When triggered:**
  - Revision count > 3 (3+ Writer or Editor loops)
  - Estimated token usage for context > 70% of provider budget
  - Provider session is explicitly reset (flagged in copilot-cli provider state)
- **What it contains:**
  - Current article state (current draft, latest feedback)
  - Latest contract (if different from original)
  - Unresolved editor blockers (extracted from latest REVISE verdict)
  - Evidence still missing (extracted from score details)
  - Next exact task (e.g., "Tighten evidence for cap hit claim in Section 3")
- **Implementation detail:**
  - Create function `generateHandoffArtifact()` that synthesizes the current state
  - Store in `artifacts` table with `type: 'handoff'`
  - Before the next Writer call, prepend the handoff to context instead of raw accumulated conversation
  - Flag in trace metadata that handoff was used
- **Validation:** Long-revision articles should include handoff artifacts; handoffs must contain enough detail to resume without conversation loss
- **Complexity estimate:** 1-2 days (synthesis logic + context assembly integration)

#### 3.2 Introduce Context-Budget Heuristics
- **Objective:** Prevent context bloat from degrading model behavior over long chains.
- **Insertion point:** `src/llm/providers/copilot-cli.ts` (lines 224-352) and `src/agents/runner.ts`
- **What changes:**
  - Track cumulative token usage across revision loops (use trace metadata)
  - If context budget is exceeded or approaching limit:
    - Trigger a reset signal
    - Compose a fresh context bundle using the handoff artifact (not raw conversation)
    - Log the reset as a trace event
  - This is a heuristic; it should not hard-fail
- **Implementation detail:**
  - Add a method `shouldResetContext(articleId, revisionCount, tokenUsage)` to runner
  - Check: `tokenUsage > 0.7 * BUDGET || revisionCount > 4`
  - If true, call `generateHandoffArtifact()` and rebuild context from it
  - Record reset in trace with reason and handoff artifact ID
- **Validation:** Long articles should show context resets in traces; reset-based context should be smaller than accumulated context
- **Complexity estimate:** 1 day (heuristic logic + logging)

---

### Phase 4: Measurement and Harness Simplification (Optional, For Next Iteration)
**Future** | Dependency: Phases 1-3 complete | Risk: Medium

#### 4.1 Analyze Harness Component Load-Bearing Weight
- **Objective:** Use retrospective data to identify which stages/loops still add quality.
- **Data source:** `usage_events`, `llm_traces`, `article_retrospectives` (already populated)
- **Questions to answer (via the retrospective-digest CLI):**
  - Which stages contribute most to final quality? (E.g., does Editor catch errors that would otherwise ship?)
  - Do simple articles (low disagreement, clear data) still need Stage 2-4 planning?
  - Is the retry loop in Stage 5 sufficient, or do long revision chains signal bad planning?
  - Which editor thresholds (Evidence vs Disagreement vs Reader) actually predict published success?
- **Not an implementation task**, but a data-analysis task for quarterly review
- **Complexity estimate:** 2-3 hours per retrospective cycle

---

## Exact Repo Insertion Points (Summary Table)

| Component | File | Lines | Action |
|-----------|------|-------|--------|
| Contract generation | `src/pipeline/actions.ts` | ~1049 | Add `generateArticleContract()` call after `runDiscussion` |
| Contract context | `src/pipeline/context-config.ts` | 698-767 | Append contract to context bundle in `gatherContext()` |
| Editor rubric | `src/config/defaults/skills/editor-review.md` | 15-72 | Add "Contract-Based Evaluation Rubric" section |
| Editor scoring | `src/pipeline/actions.ts` | 1286-1462 | Modify `runEditor` prompt; parse scores; emit structured response |
| Render QA | `src/pipeline/actions.ts` | ~1393 | New `validatePublishPreview()` between Editor and Publisher |
| Publish integration | `src/dashboard/server.ts` | 326-559 | Reference existing `buildPublishPresentation()` / `enrichSubstackDoc()` |
| Metrics logging | `src/pipeline/actions.ts` | Various | Call `recordHarnessMetric()` after Editor scores + render QA |
| Handoff generation | `src/agents/runner.ts` | 795-980 | New `generateHandoffArtifact()` before context reset |
| Context budget | `src/agents/runner.ts` | + provider | Add `shouldResetContext()` heuristic; integrate with runner loop |

---

## Validation Strategy

### Per-Phase Validation

**Phase 1:**
- [ ] New articles generate a contract artifact (visible in traces)
- [ ] Writer and Editor both receive the contract in their context
- [ ] Editor traces include structured score blocks before verdict
- [ ] Scores correlate with verdict (scores <75 → REVISE; ≥75 → APPROVED)

**Phase 2:**
- [ ] All approved articles pass render QA before Stage 7
- [ ] Render QA failures are specific and actionable (e.g., "TLDR missing" or "image ref broken")
- [ ] Usage events record editor scores and QA results
- [ ] No articles ship with missing TLDRs, broken images, or format violations

**Phase 3:**
- [ ] Articles with 3+ revisions generate handoff artifacts
- [ ] Handoff artifacts appear in traces and are compact (<1000 tokens)
- [ ] Context resets are logged when budget threshold is exceeded
- [ ] Post-reset contexts are smaller and still coherent (manually review 1-2 examples)

### Integration Validation

- Run existing `npm run v2:test` suite; all should pass
- Run a live article through all 8 stages with contract enabled; verify no regressions
- Manually inspect 2-3 article traces to confirm contract, scoring, and handoff mechanics work end-to-end

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Contract generation is too rigid; Writer finds it constraining | Medium | Design contract as "guard rails" not "mandate"; allow Writer to note deviations and Editor to accept them |
| Editor thresholds are miscalibrated on first pass | Medium | Expect to tune threshold values (60→65, etc.) after 5-10 articles; collect feedback in traces |
| Render QA is too strict; false positives block otherwise good articles | Medium | Start with soft warnings, not hard blocks; use feedback to refine rules |
| Context resets lose important state | Medium | Invest in handoff design; test with 1-2 long articles before rolling out |
| Schema changes or conflicts with concurrent work | Low | No schema changes needed; all data fits existing `artifacts`, `traces`, `usage_events` tables |
| Retrospective digest isn't ready for Phase 4 analysis | Low | CLI already exists; output format is stable; any analysis is manual review only |

---

## Recommended First Slice

**Start here: Phases 1.1 + 1.3** (Weeks 1-2)

1. Design the contract artifact schema in a markdown spec (1-2 hours)
2. Write the `generateArticleContract()` prompt and integrate it after `runDiscussion` (1 day)
3. Update `editor-review.md` with explicit thresholds and add scoring parse logic to `runEditor` (1.5 days)
4. Run 2-3 test articles end-to-end with contract and scoring enabled
5. Collect feedback and tune prompt/thresholds

This slice is self-contained, adds measurable quality signal (thresholds), and fits existing code paths. Once validated, proceed to Phase 1.2 + Phase 2 (context integration + render QA).

---

## Success Metrics

- **Contract coverage:** 100% of new articles generate contracts
- **Editor scoring accuracy:** Scores correlate with manual quality assessment (audit 10 articles)
- **No regressions:** All existing tests pass; article throughput unchanged
- **Quality lift:** Editor-caught issues increase by 20%+ (tracked via retrospective findings)
- **Harness clarity:** Traces are readable; contract + score + verdict tell a coherent story

