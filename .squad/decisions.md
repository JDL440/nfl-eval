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
