# Code Decision — Wire Substack Startup

**Date:** 2026-03-25  
**Owner:** Code  
**Status:** ✅ IMPLEMENTED  

## Decision

Treat `SubstackService` as an optional dashboard runtime dependency that is resolved during normal startup from environment variables and then injected into `createApp(...)`.

## Why

- Publish routes already guard on dependency presence, so startup needs to own service construction instead of forcing route-level env lookups.
- This preserves the improved HTMX recovery UI while fixing the real production path that previously never supplied `substackService`.
- Explicitly injected services must still win so tests and alternate bootstraps remain deterministic.

## Implementation Notes

- `src/dashboard/server.ts` now exposes `createSubstackServiceFromEnv(...)` and `resolveDashboardDependencies(...)`.
- `createApp(...)` uses the shared resolver, and `startServer()` logs whether Substack publishing is available after dependency resolution.
- Focused regression coverage lives in `tests/dashboard/publish.test.ts`.

---

# Code Decision — Issue #118 Retrospective Finding Promotion (Revised)

**Date:** 2026-03-23 (Revised 2026-03-25)  
**Owner:** Code + Lead (replacement implementer)  
**Status:** ✅ IMPLEMENTED  
**Related:** Issue #117 (Retrospective Digest CLI), Issue #118 (Promotion logic)

## Decision

Extended the manual retrospective digest CLI to deterministically promote retrospective findings into two classes:
1. **Issue-Ready (Process Improvement):** Findings where the evidence clearly supports actionable process improvement AND the finding is lead-authored OR appears across 2+ articles
2. **Learning Update:** Broader-audience findings where the evidence is recent/high-priority OR appears across 3+ articles (lower threshold for team awareness)

Both candidate types include evidence, reason, and source fields for human review before GitHub issue creation.

## Why

- Early promotion thresholds prevent retrospective findings from being lost in the digest
- Separating process improvements (immediate team action) from learning updates (awareness) prioritizes effort
- Evidence fields enable human judgment before any auto-issue creation in future phases
- Clear, deterministic rules prevent ambiguity about which findings are promotion-ready

## Implementation (Original + Revision)

### Original (Issue #118 v1)
- `src/cli.ts`: Added `promoteIssueCandidates()` and `promoteLearningUpdates()` functions with evidence collection
- `src/types.ts`: New shared types `IssueCandidate` and `LearningUpdate` with structured evidence/reason fields
- `tests/cli.test.ts`: Focused coverage for both promotion pathways
- Validation: `npm run v2:test` and `npm run v2:build` passing

### Revision (Issue #118 fix — Lead implementation)
- **Bug fixed:** Repeated `process_improvement` findings were not auto-promoting to issue-ready when author was non-Lead and priority was non-high.
- **Root cause:** The approved rule uses "lead-authored OR repeated across 2+ articles" as a promotion signal, but implementation only applied repetition check to `churn_cause`/`repeated_issue` groups.
- **Fix:** Added explicit repeated-`process_improvement` promotion check in `src/cli.ts` with clear reason string.
- **Test coverage:** Focused regression test added for repeated writer-authored `process_improvement` across 2 articles with non-high priorities.
- **Validation:** `npm run v2:test` (147/147) and `npm run v2:build` passing.

**Key Files:** src/cli.ts, src/types.ts, tests/cli.test.ts, .squad/skills/manual-retro-digest-first/SKILL.md

---

# Code Decision — Issue #107 TLDR Contract Enforcement


**Date:** 2026-03-23  
**Owner:** Code  
**Status:** ✅ IMPLEMENTED  

## Decision

Treat `src/config/defaults/skills/substack-article.md` as the single canonical article skeleton contract for TLDR placement/order, and have Writer, Editor, Publisher, pipeline guards, and mocks reference that contract instead of duplicating competing structure rules.

## Why

- Stage 5 drafts were able to drift from the intended top-of-article structure because the contract lived in multiple places with inconsistent wording.
- A single canonical source lets prompt composition, deterministic validation, and editorial review all enforce the same rule.
- Synthetic send-back behavior at Stage 5 gives the writer a precise repair target without letting malformed drafts silently reach Editor.

## Implementation

- `src/pipeline/engine.ts` enforces the TLDR contract before Stage 5→6 advances via `inspectDraftStructure()`
- `src/pipeline/actions.ts` retries malformed drafts once, then uses a synthetic `editor-review.md` send-back during auto-advance when structure is still invalid
- Writer, Editor, and Publisher charter/skill docs now reference the canonical `substack-article` contract
- Test coverage: 145/145 passing in engine, actions, and mock provider tests

**Key Files:** src/config/defaults/skills/substack-article.md, src/pipeline/engine.ts, src/pipeline/actions.ts, src/config/defaults/charters/nfl/{writer,editor,publisher}.md, src/config/defaults/skills/{editor-review,publisher}.md, tests/pipeline/{engine,actions}.test.ts, tests/llm/provider-mock.test.ts

---

# UX Review: Stage 7 Publish Flow Wording & Mental Models

**Reviewer:** UX  
**Date:** 2026-03-24  
**Status:** FINDINGS — Ready for team review

## Summary

Stage 7 publish flow uses ambiguous wording ("publish workspace") and weak status copy that confuses the two-step workflow (Create Draft → Publish). Users lack clear mental model for:
1. Where to create a Substack draft
2. When draft is ready vs. when publishing goes live
3. What "publish workspace" refers to

## Key Findings

### 1. "Publish Workspace" Is Ambiguous
- **Location:** `src/dashboard/views/article.ts:513` (tooltip when no draft exists)
- **Problem:** Term only used once; conflates article detail page with `/articles/:id/publish` page; feels like jargon
- **Current workflow:** Article → Publish Workspace button → `/articles/:id/publish` → Create Draft button

### 2. Warning Copy Conflicts with Intended Flow
- **Article detail:** "Create a Substack draft in the publish workspace before publishing"
- **Publish page:** "Publish to Substack, then optionally post a Note and Tweet"
- **Issue:** First message implies drafting is a blocker; second makes publishing sound optional
- **Reality:** Two-step flow IS required: Create Draft → Then Publish

### 3. Success State Copy Is Weak
- Needs stronger language confirming draft creation success
- "Draft ready" is vague; should clarify "ready to publish"

## Recommended Actions

1. **Rename/clarify "Publish Workspace"** → "Publish Preview" or "Draft Preview"
2. **Strengthen warning copy** on article detail page to match two-step requirement
3. **Clarify publish page hints** so users understand Create Draft is mandatory, then Publish is the publication action
4. **Upgrade publish page preview** to match richer `/articles/:id/preview` rendering
5. **Add draft status indicator** (no draft yet / draft ready / published) prominently visible

---

# Decision Inbox — Create-Draft Implementation Issue

**From:** Code Investigation Team  
**Date:** 2026-03-23T02:23:29Z  
**Type:** Bug Report / Implementation Fix  
**Priority:** HIGH  
**Status:** Routed to Code team  

## Summary

Create-draft function in `publishToSubstack` action appears broken or incomplete. Draft URL creation/storage logic needs immediate validation and fix.

## Probable Root Causes

1. **API Integration Gap**: Draft creation endpoint not properly wired to Substack API
2. **Return/State Logic**: Draft URL not being returned or persisted to `pipeline.db`
3. **Error Handling**: Failures not surfaced to user for recovery

## Recommended Action

1. Validate `publishToSubstack.ts` create-draft implementation against current Substack API docs
2. Add comprehensive test coverage for draft creation/update/publish lifecycle
3. Improve error messaging and logging for debugging

## Related Files

- `src/actions/publishToSubstack.ts` — Main implementation
- `src/server.ts` — Server integration point
- `tests/**/*.test.ts` — Test coverage gaps

## Team Impact

- **Code:** Implementation fix + test updates required

---

# Code Decision — Publish HTMX Config Errors

**Date:** 2026-03-25  
**Owner:** Code  
**Status:** 📋 Proposed

## Decision

For HTMX requests targeting the publish panel, return a normal HTML fragment from `renderPublishWorkflow()` with setup guidance instead of an HTMX-blocking 500. Keep non-HTMX callers on JSON 500 responses.

## Why

- HTMX does not swap the publish panel on a 500 response, so operators only saw a raw failure instead of a usable recovery message.
- This keeps API semantics intact while fixing the dashboard UX with the smallest scoped change.

## Operator Guidance

Set `SUBSTACK_PUBLICATION_URL` and `SUBSTACK_TOKEN` in `.env`, restart the dashboard, and confirm the values on `/config`.

---

# Decision Inbox — Dashboard Substack Service Runtime Wiring

**Date:** 2026-03-25  
**Owner:** Code + Publisher  
**Status:** 📋 Proposed  
**Type:** Runtime wiring + UX semantics

## Consensus Position

Treat dashboard publishing integrations as **startup-wired optional services**, not as route-level environment lookups.

If a route declares a service "not configured," startup must have already attempted to construct that service from env and injected it into `createApp(...)`.

## Problem Statement

- `createApp()` expects optional `substackService` dependency (`src/dashboard/server.ts:167-177`)
- Draft/publish routes hard-stop with 500 when dependency missing (`src/dashboard/server.ts:1366-1381, 1415-1429`)
- `startServer()` initializes `imageService` but never wires `SubstackService` (`src/dashboard/server.ts:2455-2495`)
- Route tests pass because they inject mock `substackService` directly instead of exercising startup wiring
- Result: Current UI message conflates "missing env" with "startup DI gap," sending operators to wrong fix

## Implications

1. Optional integrations should follow one shared seam:
   - Load env in `loadConfig()` / startup
   - Instantiate service if required vars exist
   - Inject into `createApp(...)`
   - Log unavailable state without crashing startup

2. Route-level config errors should distinguish:
   - Missing/invalid credentials
   - Service not wired at startup
   - Upstream API failure after service exists

3. For user-facing UX, this state is predictable and recoverable; a clearer "publishing unavailable" state is preferable to a generic 500.

## Immediate Operator Guidance

Until Code wires `SubstackService` into startup, treat dashboard draft/publish as blocked. Use the existing non-dashboard publishing path (MCP/CLI) with the same `.env` credentials if publication must happen now.

---

# Lead Decision — Retrospective Digest Issue Chain

**Date:** 2026-03-23  
**Owner:** Lead  
**Status:** ✅ APPROVED

## Decision

Treat **#114** as resolved reconcile/verification work, not an active runtime-port issue.

Execution order is now:
1. **#115** remains the parent umbrella
2. **#117** is the next executable implementation issue and should stay unblocked
3. **#118** stays blocked only on **#117** landing the digest scaffold
4. **#116** remains closed as the completed heuristic/spec input

## Why

- The retrospective runtime seam is already present on mainline, so keeping **#114** alive as a port task would misstate the remaining work.
- Research for **#116** is complete, which is enough to let Code start the read-only manual digest in **#117**.
- Promotion logic in **#118** should layer on top of the scaffold from **#117**, not wait on stale runtime assumptions.

## Backlog Effect

- Close/narrow **#114** around verification evidence only
- Keep **#117** marked ready
- Keep **#118** blocked, but only by **#117**

---

# Lead Review — Issue #117 Retrospective Digest CLI

**Date:** 2026-03-23  
**Reviewer:** Lead (🏗️)  
**Status:** ✅ APPROVED

## Verdict

Approve the current #117 slice in this checkout.

## Evidence

- `src\db\repository.ts` keeps the data seam read-only for the digest via one joined `listRetrospectiveDigestFindings(limit)` query over structured retrospective tables plus article metadata.
- `src\cli.ts` implements the new `retrospective-digest` / `retro-digest` command, validates `--limit`, supports optional `--json`, dedupes repeated findings with normalized text, and bounds both candidate sections and per-category examples for human review.
- `src\types.ts`, `tests\cli.test.ts`, and `tests\db\repository.test.ts` cover the new row shape, CLI output, JSON mode, and repository query ordering/limit behavior.
- Validation confirmed the targeted retrospective CLI/repository Vitest suite passes, and the repository TypeScript build passes via `npm run v2:build`.

## Follow-on Impact

- From Lead review, #117 no longer blocks the next slice.
- **#118 should now be unblocked** if no separate product/scope gate remains open.
- **UX:** May depend on fixed create-draft to show draft state
- **Publisher:** Needed for draft management workflows

---

# Decision Inbox — Publish Error Handling & UX

**From:** Publisher + UX Investigation Teams  
**Date:** 2026-03-23T02:23:29Z  
**Type:** Enhancement / User Experience  
**Priority:** MEDIUM  

## Summary

Publish pipeline lacks robust error messaging and user feedback mechanisms. Draft state visibility is unclear in UI. Need coordinated improvements across error handling and user-facing UI.

## Key Issues

1. **Error Messaging**: API failures don't provide actionable user guidance
2. **Draft State**: UI doesn't clearly show draft vs. published status
3. **Draft Recovery**: Users can't easily re-edit or recover from failed drafts
4. **API Validation**: Test mocks may not match actual Substack API behavior

## Recommended Improvements

### Code Team
- Add structured error handling for Substack API responses
- Log API failures with user-actionable messages
- Return draft URL/state from all publish operations

### UX Team
- Add draft status indicator (draft, publishing, published, error)
- Show draft URL for editing workflow
- Provide clear error messaging with recovery options

## Related Components

- `src/actions/publishToSubstack.ts` — Error handling layer
- `src/components/` — UI components for draft state
- `content/articles/` — Article metadata/state storage

## Dependencies

Depends on Code team fixing create-draft logic.

---

# Decision Inbox — Publisher publish overhaul

**From:** Publisher Team  
**Date:** 2026-03-23  
**Type:** Workflow / Product Design  
**Status:** Design approved, pending implementation  

## Recommendation

Adopt a **draft-first publish model** on `/articles/:id/publish`:

1. **Save / Create Draft**
   - If no Substack draft exists, create one.
   - If a draft already exists, update that same draft.
   - Never publish on this action.

2. **Publish Now**
   - Publish the existing linked Substack draft.
   - If no linked draft exists, stop and explain that the editor must save/update a draft first.
   - Do not introduce a separate direct-publish-from-markdown path.

## Why

- Current server behavior and tests already model Stage 7 as a manual two-step flow: create draft, then publish draft.
- The Substack service already exposes both `createDraft` and `updateDraft`, so a safe "save draft" action can be made idempotent without changing the overall product model.
- Using one draft-first lifecycle avoids divergence between "what editor reviewed" and "what got published."

## Preview Expectations

The publish page should move closer to **high-fidelity published preview**, ideally reusing the richer preview frame/presentation already used on `/articles/:id/preview`:

- title/subtitle/byline/date
- cover image
- inline image placement
- subscribe CTA / footer treatment
- mobile + desktop viewport checks

Editorial expectation: close enough for final read-through and layout QA; Substack remains the final source of truth for exact rendering.

## UX / Error-Handling Implications

Surface these states clearly:

- no article draft markdown exists
- Substack service is not configured
- draft save failed upstream
- draft URL is malformed/stale and must be recreated
- publish failed upstream after draft save
- page state is stale after draft creation and needs a full section refresh

## Related Evidence

- `src/dashboard/server.ts:1292-1458`
- `src/dashboard/views/publish.ts`
- `src/dashboard/views/preview.ts`
- `src/dashboard/views/article.ts:575-628`
- `src/pipeline/actions.ts:964-979`
- `tests/dashboard/publish.test.ts`

---

# UX Decision Inbox — Publish Flow Overhaul

**Author:** UX  
**Date:** 2026-03-24  
**Status:** Proposed for team review  

## TL;DR

Treat Stage 7 as an explicit two-step publishing flow:

1. **Create Draft in Substack**
2. **Publish Draft Live**

The publish page should become the place where users verify final appearance and choose the next publishing action, while the article detail page should become a cleaner status hub that routes users into the right next step.

## Why

- The current create-draft interaction is hard to trust because the HTMX swap path changes containers between the first and second actions.
- The publish page preview is weaker than the existing richer preview route, so users do not see something close to the actual published article.
- "Preview" and "publish" are overloaded across the dashboard and external Substack links, which makes the mental model blurry.

## Proposed UX Model

### Article Detail Page
- Show a single **Publishing** status card.
- Status states:
  - **No draft yet**
  - **Draft ready in Substack**
  - **Published live**
- Actions should route clearly:
  - **Open Publish Preview**
  - **Open Substack Draft**
  - **Publish Draft**
  - **View Live Article**

### Publish Page
- Show one clear status row at the top:
  - Draft status
  - Last available destination link
  - What the next action will do
- Provide two separate primary actions:
  - **Create Draft**
  - **Publish Now**
- Keep Note/Tweet actions visibly secondary and clearly post-publication.
- Replace the lightweight HTML block preview with the richer Substack-style rendering already used by `/articles/:id/preview`, ideally embedded or reused directly on the publish page.

## Copy Direction

- Prefer action-first copy:
  - "No Substack draft yet — create one to continue."
  - "Draft ready in Substack."
  - "Publishing makes this article live to readers."
  - "We couldn't publish this draft. Try again or open it in Substack."
- Avoid vague labels like:
  - "Open Publish Workspace"
  - "Preview" when the destination is actually Substack

## Minimal First Implementation

1. Fix the Stage 7 publish action layout so draft creation and publish-now stay in one shared result/action container.
2. Upgrade the publish-page preview to reuse the richer article preview model.
3. Rename ambiguous buttons/links on home, article detail, and publish pages so users can distinguish:
   - local preview
   - Substack draft
   - publish/go live
4. Normalize error and success messages around next-step guidance.

---

# Decision — Publish-Overhaul Isolation Strategy

**Lead Recommendation**  
**Date:** 2026-03-24  
**Status:** Ready for Backend execution

## Summary

The publish-overhaul code changes live **exclusively in the working tree** (not yet committed). The decision framework was committed in `991c66b` ("chore: squad orchestration & decision merge"), but all implementation code changes are staged in the current working directory.

## Execution Plan: Safest Isolation Strategy

### Phase 1: Create Clean Branch from origin/main

1. **Create and push a new isolation branch** rooted at origin/main (not HEAD):
   ```
   git fetch origin
   git checkout -b feature/publish-overhaul origin/main
   ```

2. **This ensures:** New branch starts clean at origin/main, upstream consensus point, zero risk of picking up local-main commits or unrelated work.

### Phase 2: Selective Cherry-Pick of Publish Changes Only

3. **Stash working-tree changes** that you want to keep for now:
   ```
   git stash push -m "temp: non-publish work (pipeline, config, squad)" \
     .squad/agents/code/history.md \
     .squad/agents/lead/history.md \
     .squad/agents/publisher/history.md \
     src/agents/runner.ts \
     src/config/defaults/ \
     src/db/repository.ts \
     src/db/schema.sql \
     src/llm/providers/mock.ts \
     src/pipeline/ \
     src/types.ts \
     tests/db/ \
     tests/llm/ \
     tests/pipeline/
   ```

4. **Verify only publish changes remain** in working tree:
   ```
   git status
   # Should show ONLY: src/dashboard/** and tests/dashboard/{publish,server}.test.ts
   ```

5. **Stage and commit publish-only changes** on the new branch:
   ```
   git add src/dashboard/ tests/dashboard/publish.test.ts tests/dashboard/server.test.ts
   git commit -m "feat: publish-overhaul — draft-first UX, shared preview, unified workflow"
   ```

6. **Include in commit message:**
   - Reference the publish-decision record in `.squad/decisions.md`
   - Mention the related issues (#106, #107, #109 if applicable)
   - Note that this commit matches the decisions from the publish-overhaul session (2026-03-24)

7. **Push to remote** and create PR for review:
   ```
   git push -u origin feature/publish-overhaul
   ```

### Phase 3: Restore Unrelated Work on Local Main

8. **Return to main** and restore the stashed changes:
   ```
   git checkout main
   git stash pop
   ```

9. **Local main remains ahead of origin/main** by 13 commits (prior orchestration work) + your new non-publish work (unstaged), keeping your working branch clean for future publish-related work.

## Key Architecture Insights

### What's in the working tree (publish-overhaul):
- **Code changes:** `src/dashboard/` (server.ts, views/publish.ts, views/article.ts, views/preview.ts, public/styles.css)
- **Test changes:** `tests/dashboard/publish.test.ts`, `tests/dashboard/server.test.ts`
- **Size:** 435 net insertions across 7 files (22 CSS lines, 209 server, 112 article, 38 preview, 154 publish, 66+52 tests)

### What stays on local main (NOT publish-overhaul):
- **Retrospective automation:** `src/pipeline/`, `src/db/`, `src/types.ts`, retrospective tests
- **TLDR contract enforcement:** Already shipped in commit `74d87b2` (Issue #107)
- **Agent/config updates:** `.squad/agents/`, `src/agents/`, `src/config/defaults/charters/`, `src/config/defaults/skills/`
- **Squad metadata:** `.squad/agents/{code,lead,publisher}/history.md`

### Committed history context (for reference):
- `991c66b` (2026-03-22): Publish-overhaul *decisions* merged into `.squad/decisions.md`, no code changes
- `74d87b2` (2026-03-22): Retrospective session logging + orchestration merges
- No commits since origin/main touch the dashboard publish views

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Accidentally including unrelated commits on PR | Use new branch from origin/main, cherry-pick only publish files |
| Losing non-publish work on main | Stash and restore; local main remains unchanged except for stash pop |
| Breaking existing tests | New branch has no retrospective changes; publish tests already designed for draft-first model |
| Dashboard regression if merged incomplete | All 7 dashboard files should move together; single atomic commit |

## Verification Checklist

Before pushing `feature/publish-overhaul`:

- [ ] Branch starts at `origin/main` (zero local-main commits)
- [ ] Status shows only dashboard files modified
- [ ] All 7 dashboard files present (server.ts, views/publish.ts, views/article.ts, views/preview.ts, public/styles.css, publish.test.ts, server.test.ts)
- [ ] Commit message references decisions and related issues
- [ ] `npm run build && npm run test` passes on new branch
- [ ] Stashed work restored on local main and nothing lost

## Co-authored-by

This decision reflects team investigation findings from the publish-overhaul session (2026-03-24). Code, UX, Publisher, and Coordinator agents contributed.

**Team:** Code (@agent/code), UX (@agent/ux), Publisher (@agent/publisher), Coordinator (@agent/coordinator)

---

# Decision: retrospective follow-up should start as a manual digest

**By:** Lead (🏗️)  
**Date:** 2026-03-23  
**Related issues:** #115, #114, #116, #117, #118

## Decision

Implement the missing learning-update / process-improvement follow-up as a **manual CLI digest** first.

- **Trigger surface:** manual CLI only in v1
- **Data source:** structured retrospective rows in `article_retrospectives` and `article_retrospective_findings`, plus article metadata
- **Output:** bounded markdown digest for human review, with optional JSON if cheap
- **Explicitly out of scope for v1:** scheduled jobs, cron workflows, and automatic GitHub issue creation

## Why

The retrospective system already generates structured article-local findings in the branch implementation, so the highest-value missing seam is cross-article synthesis, not more automation. A manual digest keeps Lead/Research in the review loop while the signal quality, grouping heuristics, and operator cadence are still being proven.

## Dependency note

Implementation work stays downstream of **#114**, which tracks landing the base retrospective runtime into mainline.

---

# Lead Decision — Retrospective Port Boundary

**Date:** 2026-03-24
**Status:** APPROVED for smallest coherent slice

## Decision

Port only the **base post-revision retrospective runtime** from the `issue-108-retrospectives` worktree into mainline now:

1. Add structured retrospective persistence (`article_retrospectives`, `article_retrospective_findings`)
2. Add repository read/write APIs for those tables
3. Generate and persist a synthesized `revision-retrospective-rN.md` artifact when a revisioned article reaches Stage 7 through `autoAdvanceArticle()`
4. Add focused repository and pipeline-action tests

## Explicitly Out of Scope

- Dashboard surfacing
- CLI digest/reporting
- Scheduled jobs / workflow automation
- Backfilling old articles
- Triggering retrospectives from every manual one-off stage change in this first pass

## Why this slice

- It is the smallest slice that is still architecturally coherent: artifact generation without durable structured storage would conflict with the already-approved direction for #115 follow-up work.
- Mainline already has the prerequisite revision-history seam (`revision_summaries` plus compact revision handoff helpers), so this slice can land without broader conversation/dashboard rewiring.
- It avoids dragging in the worktree's larger conversation-context divergence, which is unrelated to the core retrospective capability.

## Risks to watch

- Current mainline only guarantees automation through `autoAdvanceArticle()`; manual stage advancement paths may not emit retrospectives yet unless a separate hook is added intentionally.
- The worktree stores `participant_roles` as sorted JSON and upserts by `(article_id, completion_stage, revision_count)`; preserve that idempotency contract so reruns do not duplicate rows.
- The worktree heuristic infers force-approval from `editor-review.md` text. Keep that heuristic narrow and covered by tests so wording drift does not silently break the flag.

---

# Decision — Issue #107 Revision: Publisher Skill Deduplication

**Date:** 2026-03-24  
**Owner:** Publisher (Squad Agent)  
**Status:** ✅ COMPLETED  
**Related:** Issue #107, Code rejection feedback, `.squad/decisions.md` #Code Decision — Issue #107 TLDR Contract Enforcement

## Decision

Removed all duplicated normative image-policy text from `src/config/defaults/skills/publisher.md` Step 2 and replaced it with a concise reference to the canonical source: `../substack-article.md` **Phase 4b: Image policy (updated)**.

The Publisher skill now focuses exclusively on **verification** (syntax, paths, file existence, alt text) rather than **policy statement** (count, placement, hero-safety, naming).

## What Changed

### Before (duplicated policy):
- Enumerated "exactly 2 inline images"
- Stated "cover image is hero-safe — not a chart, table, or data visualization"
- Dictated "if story is player-centric, cover image is player-centric too"
- Required "images do not use visible markdown captions"
- Named inline images `{slug}-inline-1.png` and `{slug}-inline-2.png`

### After (policy reference + verification only):
- Line 51: "The canonical image policy (count, placement, hero-safety, naming, alt text) is documented in `../substack-article.md` **Phase 4b: Image policy (updated)** — refer to that section as the source of truth."
- Lines 55–59: Retained only technical Publisher checks (syntax, naming, existence, alt text quality, broken links)

## Why

Following the Code team's Issue #107 decision: **Single canonical source prevents policy drift.**

- **Before:** Writer charter, Editor skill, Publisher skill all potentially restated the same rules → divergence risk
- **After:** One policy source (substack-article.md) is referenced by all three roles → consistent enforcement

**Division of labor:**
- `substack-article.md`: Defines image contract (what must be true)
- `publisher.md`: Verifies contract compliance (did this article meet it?)

## Implementation Notes

- **File modified:** `src/config/defaults/skills/publisher.md`
- **Lines changed:** 49–64 (Step 2 section)
- **Scope:** Documentation only; no code changes
- **Testing:** Markdown change does not impact runtime behavior or tests
- **Validation:** Cross-verified reference path (`../substack-article.md` exists in same directory); confirmed section title "Phase 4b: Image policy (updated)" exists in target file

## Related Files

- `src/config/defaults/skills/substack-article.md` — Canonical image policy (Phase 4b, lines 207–215)
- `src/config/defaults/charters/nfl/writer.md` — Writer charter (should reference canonical source)
- `src/config/defaults/charters/nfl/editor.md` — Editor charter (should reference canonical source)
- `src/config/defaults/skills/publisher.md` — Updated with reference-only Step 2

## Next Steps (if any)

None required for this revision. Coordinated team documentation updates may follow per Issue #107 scope (Writer and Editor charters), but those are owned by respective teams.

---

# Scribe Routing Log — Issue #107 Completion & Orchestration

**From:** Scribe  
**Date:** 2026-03-24T03:25:00Z  
**Topic:** Issue #107 TLDR contract enforcement completion, orchestration consolidation, and merge readiness

## Summary

Issue #107 TLDR contract enforcement is complete and approved. Code agent delivered all guardrails; Lead reviewed and approved with non-blocking caveats. Scribe has consolidated all session logs, orchestration records, and decision documentation.

### Orchestration Complete

- ✅ Orchestration logs written: Code and Lead agents
- ✅ Session log written: Issue #107 TLDR contract enforcement
- ✅ Decision inbox merged and deduplicated into `decisions.md`
- ✅ Agent history updated with session learnings
- ✅ Git commit staged for `.squad/` state

### Core Deliverables (Approved)

1. **Canonical TLDR contract:** `src/config/defaults/skills/substack-article.md` with YAML frontmatter
2. **Stage 5→6 enforcement:** `inspectDraftStructure()` validates structure before advance
3. **Writer self-healing:** Malformed drafts retry once, then auto-regress with synthetic send-back
4. **Test coverage:** 145/145 regression tests passing
5. **Charter alignment:** All agent charters reference single canonical contract

### Lead Review Status

✅ **APPROVED** — All guardrails validated, test coverage verified  
⚠️ **Non-blocking notes:** Diagnostic cleanup opportunity, redundant clearArtifacts call (noted for future tech debt)

### Next Steps

1. **Lead agent to proceed** with final code review if needed
2. **Code agent to validate** idempotent behavior and full integration
3. **Final build/test pass** (`npm run v2:build`) before merge
4. **Merge main → origin/main** and close Issue #107

---

**Related Documents:**
- `.squad/orchestration-log/2026-03-24T03-25-00Z-code.md` — Code agent orchestration
- `.squad/orchestration-log/2026-03-24T03-25-00Z-lead.md` — Lead agent orchestration
- `.squad/log/2026-03-24T03-25-00Z-issue-107-tldr-contract.md` — Session summary

---

# Scribe Inbox Merge Notice — 2026-03-24T02-40-39Z

**Inbox file:** `.squad/decisions/inbox/code-issue-107.md` (MERGED)

**Status:** Deduplicated. The inbox contained an exact match of the primary **"Code Decision — Issue #107 TLDR Contract Enforcement"** record already present at line 1. No new information; inbox file deleted per merge completion.

---

# Lead Decision — Retrospective Digest Execution Order

**By:** Lead (🏗️)  
**Date:** 2026-03-24  
**Related issues:** #114, #115, #116, #117, #118

## Decision

Treat the retrospective digest chain as:

1. **#114** — already reconciled and closed as verification only; no new runtime port work remains.
2. **#116** — research/spec complete and ready to close.
3. **#117** — active next implementation slice for the manual CLI digest/query scaffold.
4. **#118** — remains blocked only on **#117** landing the digest scaffold, while consuming the accepted heuristic/spec from **#116**.

## Why

The mainline retrospective runtime seam is already present, so the backlog should not keep pointing at a stale port dependency. With the heuristics/spec complete, the remaining architectural dependency is implementation order: establish the digest surface first, then layer promotion logic onto that surface.

## Backlog effects

- Parent issue **#115** should no longer carry a `go:needs-research` state.
- **#117** is the executable code issue now.
- **#118** should stay clearly blocked, but on scaffold sequencing rather than on closed research or a non-existent port task.

---

# DevOps Decision — Publish Overhaul Ship

**By:** DevOps  
**Date:** 2026-03-24  
**Related:** Feature branch eature/publish-overhaul-ship

## Decision

When local `main` is dirty and ahead of `origin/main`, isolate ship-ready dashboard changes in a fresh worktree created from `origin/main`, then validate and push a dedicated feature branch instead of pushing `main`.

## Why

- Prevents unrelated local commits and workspace edits from leaking into the pushed branch.
- Keeps shipping work non-destructive when the primary worktree has many in-flight changes.
- Makes it easy to validate exactly the isolated diff before opening a PR.

## Strategy

- Branch: `feature/publish-overhaul-ship`
- Validation: `npm run v2:build` and `npx vitest run tests/dashboard/publish.test.ts tests/dashboard/server.test.ts`
- Worktree isolation prevents workspace pollution during active development.

---

# Decision: Substack Service Initialization Gap

**Date:** 2026-03-25  
**Initiator:** DevOps (investigation of issue #XXX)  
**Status:** Awaiting Code team action  
**Type:** Bug analysis + architecture recommendation

## Problem Statement

Users encounter HTTP 500 error "Substack publishing is not configured for this environment" when attempting to create drafts or publish articles, despite having all required environment variables correctly configured:
- `SUBSTACK_TOKEN` ✅ present (base64-encoded)
- `SUBSTACK_PUBLICATION_URL` ✅ present (nfllab.substack.com)
- `SUBSTACK_STAGE_URL` ✅ present (nfllabstage.substack.com)

## Root Cause

**Code bug in `src/dashboard/server.ts` — `startServer()` function (lines 2342–2499)**

The application has proper architecture to support optional services via dependency injection:
```typescript
createApp(repo, config, { 
  actionContext,      // ✅ created (lines 2374–2449)
  imageService,       // ✅ created (lines 2456–2471)
  memory,             // ✅ created (line 2439)
  substackService     // ❌ MISSING — never created or passed
})
```

The `ImageService` pattern (lines 2455–2471) shows the correct approach:
1. Check for `GEMINI_API_KEY`
2. Instantiate service (with fallback provider)
3. Pass to `createApp()`
4. Log outcome

**SubstackService is never instantiated.** The handlers (`/api/articles/:id/draft` and `/api/articles/:id/publish`, lines 1366–1459) check:
```typescript
if (!substackService) {
  return c.json({ error: 'Substack publishing is not configured for this environment.' }, 500);
}
```

Since `substackService` is `undefined` (never created), publishing always fails.

## Investigation Summary

| Check | Result | Evidence |
|-------|--------|----------|
| Is SubstackService class available? | ✅ Yes | `src/services/substack.ts` (391 lines, fully implemented) |
| Do env vars exist? | ✅ Yes | `.env` file verified |
| Are env vars used elsewhere? | ✅ Yes | `src/dashboard/server.ts:513–514` shows them in config page |
| Is dependency injection wired? | ✅ Partial | `createApp()` accepts `substackService` param, but startup never passes it |
| Is similar service working? | ✅ Yes | `imageService` follows same pattern and works |

## Recommendation

**Add SubstackService initialization to `startServer()` at line 2455 (before `imageService`):**

```typescript
// Build SubstackService if publishing credentials available
let substackService: SubstackService | undefined;
try {
  const token = process.env['SUBSTACK_TOKEN'];
  const pubUrl = process.env['SUBSTACK_PUBLICATION_URL'];
  const stageUrl = process.env['SUBSTACK_STAGE_URL'] || undefined;

  if (!token || !pubUrl) {
    console.log('Substack publishing credentials not set — publishing unavailable');
  } else {
    const SubstackServiceClass = (await import('../services/substack.js')).SubstackService;
    substackService = new SubstackServiceClass({
      publicationUrl: pubUrl,
      stageUrl,
      token,
      notesEndpoint: process.env['NOTES_ENDPOINT_PATH'],
    });
    console.log('Substack service initialized (pub: nfllab.substack.com)');
  }
} catch (err) {
  console.log(`Substack service not available: ${err instanceof Error ? err.message : err}`);
}

// Then pass to createApp:
const app = createApp(repo, config, { substackService, actionContext, imageService, memory });
```

**Rationale:**
- Mirrors existing `imageService` pattern (proven working)
- Non-fatal initialization (logs warning, doesn't crash server if env missing)
- Enables publishing workflow without user env changes
- Unblocks Stage 7→8 transition in pipeline

## Timeline

**Awaiting:** Code team action to implement SubstackService initialization  
**Not blocked by:** Any DevOps, CI/CD, or environment changes  
**User-facing:** Once deployed, publishing will work with current .env config

## Out of Scope

- MCP tool integration (separate concern)
- Token refresh automation (UX, not DevOps)
- GitHub Actions CI/CD (no changes needed)

---

# Publisher — Substack Dashboard Config UX

**Date:** 2026-03-23  
**Owner:** Publisher  
**Status:** ✅ DECISION MERGED  

## Recommendation

Treat Substack dashboard publishing failures as two different product states:
1. **Missing configuration** — `SUBSTACK_TOKEN` and/or `SUBSTACK_PUBLICATION_URL` absent.
2. **Service unavailable despite config** — startup failed to instantiate or inject `SubstackService`.

## Why

Current publish UI collapses both states into one message telling the user to set env vars and restart. That is misleading when the environment is already configured and the real problem is server startup wiring.

## Product Guidance

- Detect service availability before rendering publish actions.
- Disable or replace Draft/Publish controls when unavailable.
- Keep the Config-page hint for true missing-env cases only.
- Use editor-language copy like "Publishing is unavailable in this dashboard session" when service wiring/startup failed.

---

# UX Decision — Publish Missing Config Copy

**Date:** 2026-03-23  
**Owner:** UX  
**Status:** ✅ DECISION MERGED  

## Context

The Stage 7 publish workflow already treats missing Substack configuration as an operator-fixable state on HTMX requests: the server returns the refreshed publish workflow fragment and the UI shows recovery guidance instead of a broken-page failure.

## Decision

Use a short primary alert on the publish page:

**"Substack publishing is not configured."**

Keep the actionable recovery detail outside the alert, in the existing hint that names `SUBSTACK_PUBLICATION_URL`, `SUBSTACK_TOKEN`, restart, and the `/config` page.

## Why

- Matches adjacent dashboard patterns that favor short error labels.
- Keeps the publish panel scannable under repeated retries.
- Avoids changing backend/API semantics while still improving the human-facing copy.

## Files

- `src/dashboard/views/publish.ts`
- `src/dashboard/server.ts`
- `src/dashboard/views/config.ts`
- `tests/dashboard/publish.test.ts`
---

# Scribe Inbox Dedupe — 2026-03-23T04:18:42Z

- Inbox records for `publisher-substack-config.md` and `ux-publish-500.md` matched existing decision entries in `decisions.md`.
- No duplicate decision text was appended.
- Inbox files were deleted after verification.


---

# Code Decision Inbox — Publish 500 Wiring

**Date:** 2026-03-23T04:17:39Z
**Owner:** Code
**Status:** 📋 Proposed

## Decision

Treat dashboard draft/publish "Substack publishing is not configured" failures as a startup wiring bug first, and only as a user config problem after confirming the service is actually instantiated and injected.

## Why

- `createApp()` only checks whether `substackService` exists.
- `loadConfig()` already loads env from repo-root `.env` and `~/.nfl-lab/config/.env`.
- Before the fix, `startServer()` never created or passed `SubstackService`, so the routes failed even when the required env vars were present.

## Implementation

- Add `createSubstackServiceFromEnv()` in `src/dashboard/server.ts`.
- Build the service during `startServer()` when `SUBSTACK_TOKEN` and `SUBSTACK_PUBLICATION_URL` exist.
- Pass it into `createApp(...)`.
- Keep the existing HTMX publish-panel guidance for the true missing-config path.

---

# Lead Review — dashboard publish missing-config fix

**Date:** 2026-03-25
**Owner:** Lead
**Status:** Rejected for scope, behavior approved

## Outcome

Approve the operator-facing HTMX behavior, but reject the change as a narrow scoped fix because it is bundled with broader publish-flow and test changes.

## Why

- HTMX draft/publish requests now receive a swapped `renderPublishWorkflow()` fragment with recovery guidance when `substackService` is missing.
- JSON callers still receive 500 responses, so API semantics remain intact.
- The diff also bundles broader publish-overhaul behavior and lacks a direct startup-wiring regression for `createSubstackServiceFromEnv()` / `startServer()`.

## Required next step

Split or restack the missing-config fix so it can be approved independently from the broader publish-overhaul work.

---

# Decision Inbox — Code wire Substack startup

**Date:** 2026-03-25
**Owner:** Code
**Status:** Proposed

## Decision

Resolve optional dashboard services at the app seam, with explicit injections taking precedence over env fallback.

For Substack specifically:

1. `createApp(...)` should auto-resolve `substackService` from env when callers do not inject one.
2. `startServer()` should use the same resolver instead of carrying a parallel one-off wiring path.
3. Route-level publish/draft handlers should keep treating a missing service as an unavailable integration and preserve the current HTMX recovery panel behavior.

## Why

- The real failure mode was not the publish handlers themselves; it was that app startup paths could build the dashboard without a Substack dependency even when env existed.
- Centralizing resolution at the app seam closes the DI gap for both production startup and test/programmatic startup.
- Preserving explicit dependency precedence keeps tests and future alternate runtimes deterministic.

## Consequences

- Env-configured publish actions work without every caller having to manually thread `substackService`.
- Existing mock-injection tests remain stable because an explicit mock still wins over env fallback.
- Missing or invalid env still degrades safely into the existing “not configured” UX instead of crashing publish routes.

---

# Lead Review — dashboard publish missing-config fix

**Date:** 2026-03-25
**Owner:** Lead
**Status:** Rejected for scope, behavior approved

## Outcome

Approve the operator-facing HTMX behavior, but reject the change as a narrow scoped fix because it is bundled with broader publish-flow and test changes.

## Why

- The exact failure path is the early `!substackService` guard in `POST /api/articles/:id/draft` and `POST /api/articles/:id/publish`: HTMX callers previously hit a 500 before the publish panel could swap to guidance.
- The new HTMX behavior is clear and actionable: it renders `renderPublishWorkflow()` with `SUBSTACK_PUBLICATION_URL`, `SUBSTACK_TOKEN`, restart instructions, and a `/config` verification link, while JSON callers still receive 500 JSON errors.
- The diff is not tightly scoped. It also carries broader publish-workflow, revision-history, artifact-rendering, and test churn beyond the missing-config UX fix.
- Coverage is improved but still misses a direct startup DI regression that proves the dashboard service wiring path cannot silently break again.

## Required next step

Restack the missing-config fix so it only includes:

1. the HTMX missing-config fragment behavior,
2. the minimum startup wiring/helper change needed for `SubstackService`, and
3. focused regressions for HTMX vs JSON behavior plus direct env-to-service/dashboard wiring coverage.

---

# Lead Review — Issue #118

**Date:** 2026-03-25  
**Reviewer:** Lead  
**Status:** APPROVE

## Decision

Approve Issue #118 in current repo state.

## Evidence relied on

- src/cli.ts
  - isRepeatedProcessImprovement() returns true for process_improvement findings with rticleCount >= 2.
  - uildProcessImprovementReasons() adds process-improvement finding repeated across 2+ articles, and uildRetrospectiveDigest() promotes any group with process-improvement reasons into candidates.processImprovements.
  - handleRetrospectiveDigest() only reads via epo.listRetrospectiveDigestFindings(limit), builds the report, and prints markdown/JSON; it does not write digest, backlog, issue, or team-memory state.
- src/db/repository.ts
  - listRetrospectiveDigestFindings(limit) is a read-only query over rticle_retrospectives, rticles, and rticle_retrospective_findings.
- 	ests/cli.test.ts
  - prints a bounded markdown digest for manual review
  - supports json output through the command dispatcher
  - promotes repeated non-lead process improvements to issue-ready candidates

## Review scope

Reviewed only:

- .squad/agents/lead/history.md
- .squad/decisions.md
- .squad/identity/now.md
- .squad/skills/manual-retro-digest-first/SKILL.md
- .squad/skills/post-stage-retrospective-artifact/SKILL.md
- src/cli.ts
- 	ests/cli.test.ts
- src/db/repository.ts

 .squad/identity/wisdom.md was not present.

## Validation

- Ran focused existing coverage: 
px vitest run tests/cli.test.ts -t "retrospective digest command" — passed.
