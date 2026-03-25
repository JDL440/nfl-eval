## Core Context

### V3 Workflow Architecture Work (2026-03-22 to 2026-03-27)

Lead has completed three interconnected reviews on V3 workflow simplification and preflight hardening:

1. **Sentence-Starter Name Consistency** (2026-03-25): Recommended BANNED_FIRST_TOKENS expansion (Take, Hit, Draft, etc.) to filter draft-common action verbs from name extraction. This bridges until writer-support.md canonical-names allowlist is implemented. Current NAME_PATTERN regex is greedy but deterministic validation needs finite verb list.

2. **Warner Last-Name Heuristic Boundary** (2026-03-27): Confirmed that sentence-opening action verbs are NOT name parts and should be filtered deterministically, not heuristically. Scope creep risk in heuristic last-name matching across multi-player surnames. Decision: Add "Lose" + other release-context verbs to BANNED_FIRST_TOKENS; do NOT expand heuristics.

3. **V3 Workflow Simplification Architecture** (2026-03-25–27): Diagnosed churn as structural (overlapping Writer/runtime/Editor validation). Approved surgical simplification: six phases, no pipeline redesign, keep escalation machinery, preserve dirty baseline (article.ts UX + mobile fix). Eight friction sources identified; six simplification levers defined. Implementation checklist with rollback triggers delivered.

### Key Learnings & Principles

- **Structural contracts over prompt rhetoric:** Churn is not AI quality; it's overlapping validation boundaries. Solution: narrow role ownership, keep minimal deterministic guards, remove force-approve.
- **Blocker-type taxonomy is strict:** Editor emits only accuracy blockers (wrong-name, unsupported-stat, stale-claim, fabricated-quote). Any structure blocker signals implementation error.
- **Name consistency strategy:** BANNED_FIRST_TOKENS (finite list) until writer-support.md canonical-names allowlist replaces fuzzy NAME_PATTERN matching.
- **Escalation vs. force-approve:** Existing Lead escalation infrastructure + findConsecutiveRepeatedRevisionBlocker() logic reused. Change: cap revisions at 2, escalate on 3rd (not auto-approve).
- **Preserve current V3 baseline:** Sentence-initial hardening (writer-preflight.ts) + mobile width fix (article.ts) are independent, valid, and should NOT be reverted.

---

## Recent Work

## 2026-03-25T07:12:44Z — V3 Workflow Simplification Review & Implementation Approval

**Orchestration log:** .squad/orchestration-log/2026-03-25T07-12-44Z-lead.md  
**Session log:** .squad/log/2026-03-25T07-12-44Z-v3-review.md

**Status:** ✓ Completed — Approved surgical simplification pass with protected guardrails

**Key Decisions:**
1. **V3 Workflow Simplification — Implementation-Pass Checklist** — Six-phase roadmap (writer support artifact, minimize preflight, editor accuracy-only, cap revisions, reduce context, UX alignment)
2. **Lead Review Scope & Guardrails** — Approved changes and forbidden scope (no pipeline redesign, preserve escalation, keep dirty baseline)
3. **Research Report: Churn Loop Analysis** — Eight friction sources mapped; six simplification levers defined

**Protected Behaviors:** Editor blocker metadata, verdict parsing, stage regression (6→4), repeated blocker escalation, minimal structure guards

**Rollback Triggers:** Editor emits structure blockers, warnings block advancement, force-approve reachable, regression broken, baseline diluted, escalation metadata degraded

**Next:** Code implements Phases 1–6 per checklist; monitor first 20 articles post-Phase 2

---

## 2026-03-27T06-46-06Z — Warner Last-Name Heuristic Boundary Review & Sentence-Starter Hardening

**Orchestration log:** .squad/orchestration-log/2026-03-27T06-46-06Z-lead.md  
**Session log:** .squad/log/2026-03-27T06-46-06Z-warner-preflight-hardening.md

**Status:** ✓ Completed — Recommendation finalized: Add "Lose" to BANNED_FIRST_TOKENS; do NOT extend last-name heuristics

**Failure case:** Draft "Lose Warner" vs Artifacts "Fred Warner"  
**Root cause:** "Lose" not in action-verb blocklist  
**Decision:** Extend BANNED_FIRST_TOKENS with release-context verbs (Lose, Cut, Release, Drop, etc.)

**Why NOT expand last-name heuristics:**
- Ambiguity across multi-player surnames (Smith, Johnson, Williams, Davis, etc.)
- Scope creep risk: "last-name match when exactly one candidate" fails when multiple articles mention same surname
- Violates deterministic principle: the Sentence-Starter policy established that filtered extraction with explicit lists is deterministic; heuristic last-name matching is not

**Key decision:** Sentence-opening action verbs are **not part of person's names** and should be filtered deterministically, not heuristically. This bridges until writer-support.md canonical-names allowlist is implemented.

**Decision documented in:** [Warner Last-Name Heuristic Boundary Review](../../decisions.md)

---

## 2026-03-27T[HH:MM:SS]Z — Warner Last-Name Heuristic Boundary Review

**Status:** ✓ Completed — Recommendation: Add "Lose" to BANNED_FIRST_TOKENS; do NOT extend last-name heuristics

**Failure case:** Draft "Lose Warner" vs Artifacts "Fred Warner"  
**Root cause:** "Lose" not in action-verb blocklist  
**Recommendation:** Extend BANNED_FIRST_TOKENS with release-context verbs (Lose, Cut, etc.)  
**Why NOT expand last-name heuristics:** Ambiguity across multi-player surnames; scope creep into fuzzy matching; violates deterministic principle.

**Decision:** [Warner Last-Name Heuristic Boundary Review](../../decisions.md)

---

## 2026-03-25T06:26:29Z — Sentence-Starter Preflight Policy Reassessment

**Orchestration log:** .squad/orchestration-log/2026-03-25T06-26-29Z-lead.md  
**Session log:** .squad/log/2026-03-25T06-26-29Z-mobile-and-preflight-hardening.md

**Status:** ✓ Completed — Blocker policy reviewed and hardening recommendation issued

**Assessment:**
- Sentence-opener NAME_PATTERN extraction too greedy; captures "Take Trent Williams" as full name.
- Current BANNED_FIRST_TOKENS insufficient for draft-common verbs.
- Blocker **should remain hard**, but heuristic must shift from greedy regex to explicit verb list.

**Recommended Action Verbs to Blocklist:**
- Draft context: Take, Hit, Draft, Grab, Pick, Select, Land
- Contract context: Sign, Ink, Re-sign
- Acquisition: Target, Pursue, Add, Trade
- General: Watch, Build, Keep, Leave, Get

**Medium-term Path:** Once writer-support.md canonical-names allowlist implemented, preflight will parse that first instead of NAME_PATTERN fuzzy matching, eventually allowing downgrade from hard blocker to warning.

**Decision:** [Sentence-Starter Name Consistency Policy](../../decisions.md)

---
## 2026-03-27T[HH:MM:SS]Z — Writer-Editor Churn Reduction Architecture Plan

**Orchestration log:** .squad/orchestration-log/[timestamp]-lead.md  
**Decision document:** .squad/decisions/inbox/lead-writer-editor-plan.md

**Status:** ✓ Completed — Realistic simplification plan delivered

**Problem diagnosed:**
- Writer preflight is a hard blocker but catches deterministic/mechanical issues (names, placeholders) that are writer responsibility
- Editor carries dual burden: fact-check + editorial approval, making feedback wide-spectrum
- Revision loop symmetric and unclear about priorities (writer sees blocking + advisory, doesn't know what matters)
- Current max revisions (5–10) with auto-approve at limit = token waste + weak signal to Lead

**Proposed solution:**
1. **Shift writer responsibility:** Explicit charter with canonical names, fact-check scope, article contract upfront
2. **Downgrade preflight:** Informational artifact only; no pipeline blocker (writer self-check instead)
3. **Editor as lightweight gate:** Only accuracy blockers (name, date, sourcing), max 3 per REVISE, no "suggestions"
4. **Cap revisions at 3:** After 3 REVISE, escalate to Lead (not force-approve) — signals real gap, not loop exhaustion
5. **Simplified context:** Editor sees draft + revision summary only (no prior reviews, no preflight status)

**Rollout sequence:** 6 phases, 4 days:
- Phase 1: Writer charter simplification (Day 1)
- Phase 2: Editor skill/format update (Day 1)
- Phase 3: Revision cap logic (Day 2)
- Phase 4: Remove preflight blocker (Day 2)
- Phase 5: Editor context reduction (Day 3)
- Phase 6: Code cleanup (Day 3)

**Expected outcomes:**
- Revision cycles: 2.5–3.5 → 1.5–2.0 (clearer writer direction)
- Lead escalations: ~5% → ~10% (better quality, not loop exhaustion)
- Code reduction: 500+ lines deleted
- Editor review time: Stable or slightly faster (no suggestions section)

**Key decision:** Remove writer preflight as control point. Preflight catches real issues, but they're mechanical (writer's job). Editor is now the full accuracy gate and must catch what preflight would have flagged.

**Risks mitigation:** Start with small batch (20–30 articles); monitor draft quality reaching editor; revert editor blockers list if drift detected.

---

## 2026-03-27T15:30:00Z — V3 Workflow Simplification Architecture Review

**Request:** Review planned V3 workflow simplification (churn reduction) and return implementation checklist.  
**Basis:** Backend research memo + in-flight V3 baseline (sentence-initial hardening + mobile width fix)  
**Status:** ✓ Completed — Architecture approved, checklist delivered with rollback guardrails  
**Output:** `.squad/decisions/inbox/lead-v3-review.md` (14.3 KB) — Detailed phase-by-phase guardrails, test protection matrix, risk table, blocker-type standardization.

**Key findings:**
1. **Churn root cause is structural, not prompting.** Writer, runtime, and Editor all police overlapping article contract. The fix is contract simplification, not smarter AI.
2. **In-flight baseline is independent and valid.** Sentence-initial name hardening (writer-preflight.ts) + mobile width fix (article.ts) are independent of churn simplification. Do not revert.
3. **V3 already has escalation machinery.** Current design auto-approves after max revisions; the cleaner answer is to cap at 2 revisions and escalate to Lead on 3rd. This reuses existing infrastructure instead of adding new control flow.
4. **Blocker-type taxonomy must be strict.** Editor can only emit accuracy blockers (name, stat, quote, attribution, staleness). Any structure blocker signals implementation error and should trigger rollback.
5. **Six phases are clear and independent.** Phase 1 (Writer support artifact) → Phase 2 (minify preflight) → Phase 3 (Editor accuracy-only) → Phase 4 (cap revisions) → Phase 5 (reduce context) → Phase 6 (UX alignment).

**Critical protected behaviors (must not regress):**
- Stage 6 REVISE regresses to Stage 4 (not Stage 5) — Writer context is start of revision
- Lead escalation metadata tracked via structured blockers — prevents silent failure loops
- Minimal structure validation remains in engine.ts — empty draft, recognizable TLDR block required

**Rollback triggers:** If Editor emits structure blockers, if preflight warnings appear as stage blocks, if force-approve returns, if Editor receives prior-review accumulation.

---

## Learnings

### Workflow Simplification Review Pattern
- For V3 workflow simplification, treat active dirty worktree changes as baseline when they are independent of the contract rewrite. In this pass that means preserving article-page revision UX (`src/dashboard/views/article.ts`, `src/dashboard/public/styles.css`) and sentence-initial preflight hardening (`src/pipeline/writer-preflight.ts`) while simplifying Writer/Editor boundaries elsewhere.
- The safe simplification pattern is: narrow role ownership, keep minimal deterministic structure guards, remove force-approve, and preserve structured Lead escalation. This keeps the existing state machine honest without rewriting the 8-stage pipeline.
- Reviewer focus should stay on runtime truth, not prompt rhetoric: warnings must stop behaving like blockers, Editor must stop emitting structure policing, and Stage 6 `REVISE` must still regress to Stage 4 with structured blocker metadata intact.

### V3 Workflow Contract Simplification

- **Structural insight:** Current churn comes from symmetric revision model where Writer, runtime, and Editor all validate the article contract. The solution is to simplify the boundary:
  - Writer owns draft quality (with better support artifact)
  - Runtime enforces only deterministic safety (empty draft, TLDR block exists, no obvious placeholders)
  - Editor enforces only accuracy (names, stats, quotes, staleness)
  - Lead escalation catches genuinely hard articles (not force-approved churn loops)
- **Critical principle:** Blocker types must have strict taxonomy. Accuracy types (wrong-name, unsupported-stat, stale-claim, fabricated-quote) are the **only** types Editor should emit. Any structure blocker signals implementation error.
- **In-flight V3 context:** Sentence-initial name hardening (BANNED_FIRST_TOKENS expansion) is a valid interim step before writer-support.md allowlist. Mobile width fix in article.ts is independent UX work.
- **Escalation vs. force-approve:** Existing `findConsecutiveRepeatedRevisionBlocker()` logic + Lead escalation infrastructure is already in place. The change is to remove force-approve and cap revisions at 2, making escalation the honest resolution path.

### Name Consistency Strategy
- The NAME_PATTERN regex in writer-preflight.ts is intentionally greedy to capture full names across 2-4 word variations.
- Filtering happens in two stages: **extraction** (regex + markdown stripping) and **validation** (BANNED_FIRST_TOKENS + BANNED_LAST_TOKENS).
- Current validation uses a banned-list approach, which doesn't scale for infinite language variation (e.g., action verbs opening sentences).
- **Principle:** Sentence-opening action verbs (Take, Hit, Draft, etc.) are not name parts and should be filtered deterministically, not heuristically.
- **Bridge solution:** Expand BANNED_FIRST_TOKENS with draft-common verbs (small, finite list) until writer-support.md canonical-names allowlist is implemented.
- Once writer-support.md exists, the preflight should parse that artifact first and rely on explicit allowlist, not NAME_PATTERN fuzzy matching.

### Writer Preflight Architecture
- Blocker classes: placeholder-leakage, name-consistency, unsupported-name-expansion, unsourced-contract-claim, unsourced-stat-claim, unsourced-draft-claim, unsourced-date-claim.
- The preflight dedupes issues and caps blocking-issues at 3 per run to avoid overwhelming the writer.
- Name consistency is a hard blocker to catch serious mismatches (e.g., "Jackson" vs "Jaxon"), but the current regex-based extraction makes it sensitive to prose variation.
- Unsupported-name-expansion is triggered when the draft has a full name (e.g., "Pat Freiermuth") but artifacts only support a last-name reference (e.g., "Freiermuth").

### Writer Support Artifact Direction
- writer-support.md (decided, not yet implemented) will be the canonical source for exact names, facts, claims, and roster guidance.
- It will be produced in writeDraft() after writer-factcheck.md and before writerPreflightSources finalization.
- The preflight will parse writer-support.md first as an allowlist before falling back to fuzzy matching.
- This will eventually allow name-consistency blocker to be downgraded to warning or absorbed into allowlist validation.

---

## 2026-03-25T05-51-20Z — Option B Article-Page Scope & Risk Review

**Orchestration log:** .squad/orchestration-log/2026-03-25T05-51-20Z-lead.md  
**Session log:** .squad/log/2026-03-25T05-51-20Z-option-b-article-plan.md

**Status:** ✓ Completed — Scope/risk review approved

**Decision:**
- Approved smallest-safe article-page-only pass.
- Advised against route/type/SSE rewrites.
- Option B implementation proceeding.

## 2026-03-25T03:30:39Z — Dashboard Mobile Audit Session (Lead Architecture Synthesis)

**Orchestration log:** .squad/orchestration-log/2026-03-25T03-30-39Z-lead.md  
**Session log:** .squad/log/2026-03-25T03-30-39Z-dashboard-mobile-audit.md

**Status:** ✓ Completed — corroborated UX findings, shared primitives approach

**Three-agent audit findings (Lead architecture):**
- Shared failures confirmed: Header nav overflow, missing detail-grid collapse, desktop-first tables/forms, missing/assertion-only mobile tests
- Root cause: Dashboard views emit fragments without explicit mobile-aware wrappers; shared CSS primitives missing for <640px breakpoints
- Fragment inheritance gap: HTMX swaps inherit parent shell mobile behavior unpredictably
- Class scoping conflicts: .agent-grid used in two different contexts with no mobile override strategy

**Recommended strategy:** Establish shared system contract
1. shared shell/navigation contract
2. shared responsive data-surface contract
3. shared detail/preview stacking contract
4. page-specific selector-density cleanup
5. targeted mobile regression coverage

