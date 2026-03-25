## Core Context

### V3 Workflow Architecture Work (2026-03-22 to 2026-03-27)

Lead completed comprehensive V3 simplification reviews: (1) Sentence-Starter Name Consistency — BANNED_FIRST_TOKENS expanded to deterministic verb lists (Take, Hit, Draft, Grab, Pick, Select, Land, Sign, Ink, Re-sign, Target, Pursue, Add, Trade, Watch, Build, Keep, Leave, Get); (2) Warner Last-Name Heuristic Boundary — "Lose" + release-context verbs added, no fuzzy-matching expansion; (3) V3 Architecture — churn diagnosed as structural overlap (Writer/runtime/Editor); approved surgical simplification: six phases, no pipeline redesign, preserve escalation and mobile-safe baseline. Eight friction sources identified; six simplification levers defined. Implementation checklist with rollback triggers delivered in decisions.md.

### Key Learnings & Principles

- **Structural contracts over prompt rhetoric:** Churn is not AI quality; it's overlapping validation boundaries. Solution: narrow role ownership, keep minimal deterministic guards, remove force-approve.
- **Blocker-type taxonomy is strict:** Editor emits only accuracy blockers (wrong-name, unsupported-stat, stale-claim, fabricated-quote). Any structure blocker signals implementation error.
- **Name consistency strategy:** BANNED_FIRST_TOKENS (finite list) until writer-support.md canonical-names allowlist replaces fuzzy NAME_PATTERN matching.
- **Escalation vs. force-approve:** Existing Lead escalation infrastructure + findConsecutiveRepeatedRevisionBlocker() logic reused. Change: cap revisions at 2, escalate on 3rd (not auto-approve).
- **Preserve current V3 baseline:** Sentence-initial hardening (writer-preflight.ts) + mobile width fix (article.ts) are independent, valid, and should NOT be reverted.

### Archived: Option B & Dashboard Mobile (2026-03-25)

Lead completed article-page-only scope review (smallest-safe pass; no route/type/SSE rewrites) and dashboard mobile audit (shared system contract strategy). Detailed logs in .squad/log/.

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

## Historical Synthesis

### Workflow Contract Simplification Principles (archived from detailed learnings)

- **Structural contracts over prompt:** Churn is overlapping validation boundaries, not AI quality. Solution: narrow role ownership, keep minimal deterministic guards, remove force-approve.
- **Strict blocker taxonomy:** Editor emits only accuracy blockers (wrong-name, unsupported-stat, stale-claim, fabricated-quote). Structure blockers signal implementation error.
- **Name extraction strategy:** BANNED_FIRST_TOKENS (finite action-verb list) bridges until writer-support.md canonical-names allowlist replaces greedy NAME_PATTERN regex.
- **Escalation pattern:** Reuse existing Lead infrastructure + findConsecutiveRepeatedRevisionBlocker(). Change: cap at 2 revisions, escalate on 3rd (not force-approve).

### V3 Articles Page & Mobile Audit (2026-03-25)

Lead reviewed article-page scope and dashboard mobile audit findings. Approved smallest-safe article-page-only pass. Shared findings: header nav overflow, missing detail-grid collapse, desktop-first tables, missing mobile tests. Root cause: dashboard views emit fragments without mobile-aware wrappers; shared CSS primitives missing.

---

## 2026-03-27T15:30:00Z — V3 Workflow Simplification Architecture Review

**Status:** ✓ Completed — Architecture approved, checklist delivered with rollback guardrails

**Key findings:**
1. **Churn root cause is structural, not prompting.** Writer, runtime, and Editor all police overlapping article contract. The fix is contract simplification, not smarter AI.
2. **In-flight baseline is independent and valid.** Sentence-initial name hardening (writer-preflight.ts) + mobile width fix (article.ts) are independent of churn simplification. Do not revert.
3. **V3 already has escalation machinery.** Current design auto-approves after max revisions; cap at 2 revisions and escalate to Lead on 3rd. Reuses existing infrastructure instead of adding new control flow.
4. **Blocker-type taxonomy must be strict.** Editor can only emit accuracy blockers (name, stat, quote, attribution, staleness). Any structure blocker signals implementation error and should trigger rollback.
5. **Six phases are clear and independent.** Phase 1 (Writer support artifact) → Phase 2 (minify preflight) → Phase 3 (Editor accuracy-only) → Phase 4 (cap revisions) → Phase 5 (reduce context) → Phase 6 (UX alignment).

---

## 2026-03-25T06:26:29Z — Sentence-Starter Preflight Policy Reassessment

**Status:** ✓ Completed — Blocker policy reviewed and hardening recommendation issued

**Assessment:**
- Sentence-opener NAME_PATTERN extraction too greedy; captures "Take Trent Williams" as full name.
- Current BANNED_FIRST_TOKENS insufficient for draft-common verbs (Take, Hit, Draft, Grab, Pick, Select, Land, Sign, Ink, Target, Pursue, Add, Trade, Watch, Build, Keep, Leave, Get).
- Blocker should remain hard, but heuristic must shift from greedy regex to explicit verb list.
- **Bridge solution:** Expand BANNED_FIRST_TOKENS with draft-common verbs (small, finite list) until writer-support.md canonical-names allowlist is implemented.

