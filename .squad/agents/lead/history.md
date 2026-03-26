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

## 2026-03-27T07:30:00Z — V3 Workflow Simplification Pass Completion & Documentation

**Orchestration log:** .squad/orchestration-log/2026-03-27T07-30-00Z-lead.md  
**Session log:** .squad/log/2026-03-27T07-30-00Z-v3-workflow-simplify.md

**Status:** ✓ Completed — Four-agent team delivered first V3 simplification pass with Phase 1 shipped

**Session Summary:**
Research, Code, and UX agents completed V3 workflow simplification pass under Lead oversight. Churn diagnosed as structural overlap; six-phase roadmap with protected guardrails delivered. Phase 1 (Warner preflight hardening) shipped and validated.

**Team Deliverables:**
1. **Lead:** Validated guardrails, approved six-phase checklist, protected behaviors and rollback triggers
2. **Code:** Implemented Phase 1 (BANNED_FIRST_TOKENS + "Lose"), validated pipeline, guarded rollback triggers
3. **UX:** Implemented revision UX simplification, mobile width fix, dashboard alignment
4. **Research:** Mapped eight friction sources, defined six levers, provided guidance framework

**Protected Behaviors:** Editor blocker metadata (accuracy-only), verdict parsing (stage regression 6→4), repeated blocker escalation, minimal structure guards (BANNED_FIRST_TOKENS deterministic only)

**Rollback Triggers:** Structure blockers, warnings blocking advancement, force-approve reachable, regression broken, baseline diluted, escalation metadata degraded

**Files Modified (worktrees/V3):**
- src/pipeline/writer-preflight.ts (BANNED_FIRST_TOKENS + "Lose")
- src/pipeline/writer-support.ts (artifact scaffolding)
- src/dashboard/views/article.ts (mobile CSS, revision display)
- src/dashboard/public/styles.css (grid overflow handling)
- tests/pipeline/writer-preflight.test.ts (release-context verb test)
- tests/dashboard/wave2.test.ts (mobile viewport validation)

**Validation:** npm run v2:build, Vitest tests, mobile viewport tests (320px–1024px) — all passing

**Next:** Code implements Phases 2–6 per checklist; monitor first 20 articles post-Phase 2; escalate revised-3x articles to Lead hold

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

## Learnings

### 2026-03-28 — Canonical local MCP closeout: config parity is part of the contract

- The repo is effectively at a one-entrypoint MCP shape now: `mcp/server.mjs` is the canonical local server, `src\cli.ts mcp` is only a wrapper to that same file, and the pipeline server is clearly demoted to `mcp-pipeline` debug/compat usage.
- Discoverability is strong enough to rely on because `local_tool_catalog` exposes categories, side-effect notes, required arguments, and example payloads from the same registration table the server uses. That keeps “what tools exist?” and “what is actually registered?” on one seam.
- The remaining drift risk is config parity, not server code. `.copilot\mcp-config.json` and `.mcp.json` must keep matching command/args/cwd semantics or operators can hit repo-root-dependent wrapper failures even when the canonical entrypoint is correct.

### 2026-03-28 — Multi-provider review: treat this as wiring completion, not a fresh re-architecture

- The repo is in a **partially landed** state already: `articles.llm_provider` exists in `src\db\schema.sql`, `src\types.ts`, and `src\db\repository.ts`, and `src\dashboard\views\article.ts` already renders provider display/edit UI. The unsafe part is the seam mismatch: startup in `src\dashboard\server.ts` still registers providers mutually exclusively, `AgentRunner` / `executeTransition()` do not thread article provider intent into runtime calls, and stage-run intent telemetry is still model-only.
- Smallest-safe rollout order is now even narrower than a greenfield proposal: finish startup/provider wiring first, then gateway/runner provider hints, then pipeline threading, and only then any richer policy work. Do **not** rename `llm_provider` or redesign `ModelPolicy` in the same pass; current code and tests already expect the existing field name.
- Review the rollout as a requested-vs-actual truth problem. `usage_events.provider` and `model_or_tool` already capture actual execution, but there is still no matching requested-provider column on `stage_runs`, so fallback/debug behavior will be opaque until intent is persisted alongside the existing requested-model fields.
- `src\dashboard\views\config.ts` is already structured for a multi-provider summary (`providers`, `providerModeLabel`, `defaultModel`), but `src\dashboard\server.ts` is still the gating seam that determines whether the dashboard reflects reality. If server-side provider discovery lags behind startup registration, operators will see stale “single provider” semantics even after backend routing works.
- Lockout concern remains unchanged but is now easier to miss because article/provider UI exists: LM Studio still claims universal model support and ignores `request.model`, always sending its configured local default. Any implementation that treats `supportsModel()` as proof of model fidelity, or backfills requested values over actual LM Studio telemetry, should be rejected on review.

### 2026-03-28 — Multi-provider rollout: keep provider preference additive and intent-visible

- The smallest safe rollout is **not** a provider-policy rewrite. `src\llm\gateway.ts` is already the right abstraction; the real unlock is replacing mutually exclusive provider boot wiring in `src\dashboard\server.ts` with additive registration so one runtime can host Copilot CLI, Copilot API, and LM Studio together.
- Provider choice should layer on top of the existing model policy, not replace it. Keep `src\llm\model-policy.ts` model-first for now, add an optional provider preference/strategy in the gateway + runner seam, and let article-level preference override auto-routing without inventing stage-specific provider rules yet.
- Persistence/UI drift is the main implementation risk. If `articles` gains a provider override, the same field must be threaded through `src\types.ts`, `src\db\repository.ts`, dashboard PATCH + HTMX edit handlers in `src\dashboard\server.ts`, article metadata rendering in `src\dashboard\views\article.ts`, and config visibility in `src\dashboard\views\config.ts`; otherwise the system will look single-provider even if the backend routes correctly.
- Observability must preserve **requested vs actual** truth. Existing `usage_events.provider` and `model_or_tool` already capture actual execution, but rollout debugging gets materially easier if `stage_runs` also records requested provider intent. Do not collapse LM Studio's actual local model name into the requested canonical cloud model — that mismatch is expected and should stay visible.
- Lockout-worthy concern: LM Studio currently returns `supportsModel() === true` for every model and ignores `request.model`, always using its configured local default. Any implementation that treats provider support as equivalent to model fidelity, or silently rewrites telemetry to hide that substitution, will create routing lies and make regressions impossible to diagnose.

### 2026-03-25 — Seahawks stall review: runtime-contract drift is a first-class workflow risk

- The live V3 server on `localhost:3456` can be up while still running an old workflow contract. In this case, source defaults in `worktrees/V3/src/config/defaults/charters/nfl/editor.md` and `.../skills/editor-review.md` were simplified on 2026-03-25, but the runtime was loading older seeded files from `C:\Users\jdl44\.nfl-lab\agents\...` last written on 2026-03-20. That means source review alone can misdiagnose stalls unless the seeded runtime knowledge is checked too.
- `seedKnowledge()` is bootstrap-only: it copies charters/skills only when missing, and `AgentRunner` reads directly from `config.chartersDir` / `config.skillsDir` under the data dir. Architectural implication: prompt/contract simplification needs a sync/versioning/reseed path, or live behavior will drift from reviewed source.
- For the Seahawks JSN article (`did-the-seahawks-pay-jaxon-smith-njigba-at-exactly-the-right`), the real stall was Stage 6 evidence churn around a timing/value thesis with missing contract facts, amplified by the stale runtime Editor contract. `panel-factcheck.md` explicitly marked contract figures as unsourced, while live editor reviews still emitted old `ERRORS/SUGGESTIONS/NOTES` structure and broad non-accuracy blockers, so the article hit revision-limit escalation instead of repeated-blocker escalation.
- Further loosening must preserve the minimal Stage 5 shell, Stage 6 `REVISE` → Stage 4 regression, and structured blocker metadata. If blocker metadata goes null in `revision_summaries`, repeated-blocker escalation is effectively disabled even when the same issue is recurring.

### 2026-03-28 — Seahawks stall review: distinguish live stall class from source-code intent

- The Seahawks JSN article in `C:\Users\jdl44\.nfl-lab\pipeline.db` is paused at Stage 6 with `needs_lead_review`, but the revision history shows three editor `REVISE` cycles driven by missing contract facts and broad editorial asks, not a surviving Stage 5 shell blocker.
- Current source in `worktrees/V3/src/pipeline/engine.ts` and `writer-preflight.ts` already keeps Stage 5 narrow: short draft, missing headline/subtitle/TLDR, and placeholder leakage are the only hard stops worth protecting during further loosening.
- A reusable review pattern emerged: whenever workflow simplification touches charters/skills, audit both source defaults and the live seeded runtime files under the active data dir before diagnosing churn. Otherwise stale runtime contracts can make the product appear unsimplified even when source code is correct.

---

### 2026-03-27 — Second-pass Seahawks stall guardrails

- The remaining stall class is **post-approval advisory churn**, not a Stage 5 deterministic-blocker problem. The Seahawks JSN article already reached `editor-review-2.md` with an `APPROVED` verdict, then received a third targeted pass (`editor-review-3.md`) that only cleaned up yellow suggestions and inserted an HTML TODO comment into the live draft.
- Current Stage 5 is already narrow in code: `requireDraft()` only hard-blocks very short drafts plus missing headline, italic subtitle, or recognizable TLDR, while `writer-preflight.ts` blocks only placeholder leakage and downgrades name/claim/date issues to warnings. That means the next cut should protect this minimal shell and focus on preventing downstream roles from reopening approved drafts for non-blocking cleanup.
- Acceptance for any further loosening must preserve: writer revises the existing draft, Stage 6 `REVISE` still regresses to Stage 4, repeated blocker escalation still works, editor remains accuracy-only, and approved/advisory comments never create another automatic revision or publish-visible TODO leakage.

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


## 2026-03-28T06-46-06Z — Second-Pass Guardrails for Stage 6 Blockerless Revise Loop

**Orchestration log:** .squad/orchestration-log/2026-03-28T06-46-06Z-lead.md  
**Session log:** .squad/log/2026-03-28T06-46-06Z-second-pass-workflow-fix.md

**Status:** ✓ Completed — Direction validated with explicit guardrails and rollback triggers

**Diagnosis Validated:**
- Seahawks JSN article stall is post-approval advisory churn at Stage 6, not Stage 5 shell gate
- Article already cleared blocking factual review, kept looping for non-blocking cleanup
- Editor-review-3.md pass exists only for yellow items and HTML TODO placeholder

**Approved Implementation:**
- Runtime normalization seam in worktrees\V3\src\pipeline\actions.ts
- If Editor REVISE has no canonical blockers, force blocker-only retry then treat as APPROVED
- Does not weaken Stage 5 hard guards or placeholder detection

**Protected Behaviors (Strict):**
1. Minimal Stage 5 shell (headline, subtitle, TLDR, empty draft guard)
2. Placeholder leakage hard blocker (TODO/TBD/TK must not pass)
3. Warnings remain advisory (don't block advancement)
4. Writer revises in place (no draft restarts)
5. APPROVED is terminal (only true REVISE/REJECT reopens)
6. Escalation machinery intact (repeated blocker fingerprinting, needs_lead_review hold)
7. Editor accuracy gate only (name, stat, quote, staleness)

**Rollback Triggers (Reject/Revert If):**
1. Minimal shell guard weakened
2. Placeholder leakage becomes publish-safe
3. APPROVED still triggers required revision
4. Editor blocker taxonomy widens
5. Escalation contract breaks
6. Advisory findings become hidden blockers

**Key Principle:** Not a return to force-approve-after-cap churn. Downgrade only when Editor cannot name canonical blocker after blocker-only retry.


## 2026-03-26T05:56:52Z — Multi-provider LLM Rollout Guardrails

**Orchestration log:** .squad/orchestration-log/2026-03-26T05-56-52Z-lead.md
**Session log:** .squad/log/2026-03-26T05-56-52Z-multi-provider-llm-review.md

**Status:** ✓ Complete — Architecture review guardrails approved

**Decision:**
Approve the rollout only as a **small additive pass**:
1. Make provider registration additive at startup
2. Add provider preference as an optional gateway/runner hint
3. Persist an optional article-level preferred provider
4. Surface that override in existing article metadata UI
5. Keep requested vs actual provider/model telemetry visible

**Key Guardrails:**
- Keep \ModelPolicy\ model-first in this pass
- Article override should default to **prefer**, not **require**
- \uto\ / unset must preserve current routing behavior
- LM Studio provider-owned model behavior is acceptable initially, but explicit in telemetry and UI
- JSON and HTMX metadata paths must stay aligned

**Lockout Conditions:**
- Provider rollout also rewrites \ModelPolicy\ into a provider-first engine
- Startup still effectively exposes one provider at a time after the change
- Article/provider UI persists intent but runner/gateway never receives it
- Usage events provider or returned model values are rewritten to match requested intent
- LM Studio universal \supportsModel()\ is used as proof that requested model fidelity was preserved
- JSON and HTMX metadata paths diverge on accepted/validated provider values

**Exact Seams:**
- \src\dashboard\server.ts\ — additive provider registration at startup, /config reflects real provider set
- \src\llm\gateway.ts\ — optional provider hint semantics without breaking auto
- \src\agents\runner.ts\ — accept and forward provider intent
- \src\pipeline\actions.ts\ — read article.llm_provider and pass to runner/gateway
- \src\db\schema.sql\ — add stage_runs.requested_provider if needed
- \src\db\repository.ts\ — persist/read requested-provider stage-run data
- \src\types.ts\ — extend Article and StageRun types

**Minimum Tests:**
- Gateway: auto / prefer / require provider routing
- Runner: provider hint propagation
- Pipeline: article \llm_provider\ reaches execution path
- Repository: \llm_provider\ round-trip and requested-provider stage-run round-trip if added
- Dashboard: config page shows multiple providers; JSON + HTMX metadata editing both round-trip provider selection

**Related Decisions:**
- Code — Multi-provider LLM review (confirmed seams)
- UX — Multi-provider article controls (UI contract confirmed)
