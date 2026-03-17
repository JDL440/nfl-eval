# Decisions

> Active decisions for the NFL 2026 Offseason project. Entries are organized by date (newest first). Older entries (30+ days) are archived in decisions-archive.md.

---

### 2026-07-28: Stage-Review Notes — Copy Pattern
**Date:** 2026-07-28
**By:** Writer
**Status:** PROPOSED — awaiting Lead / Joe approval
**Affects:** All future promotion Notes (stage and prod)

## Context
Two prod-published articles have no promotion Notes (flagged `STALE_PROMOTION` by `article_board.py notes-sweep`). Joe requested stage Notes using the prod-published articles so he can review the copy before they go live. The same sweep also highlighted that some legacy published articles in `pipeline.db` are missing `substack_url` values; the publisher or Lead should confirm each slug before posting.

## Pattern: Card-First Caption
Adopted from Phase 3 learning (docs/notes-api-discovery.md §Phase 3):
1. **Caption ≤ 20 words.** One punchy line that surfaces the article's non-obvious insight or sharpest tension.
2. **Markdown link on a second line** pointing to the published `/p/` URL. Substack auto-renders the article card (thumbnail + headline + publication name) from this link — the card does the heavy lifting.
3. **No body paragraphs.** The card IS the content. Extra text competes with the card preview.
4. **Image attachment optional.** Only attach an image when the article's hero or a key chart adds context the card thumbnail doesn't provide.

### Template
```
{caption — ≤ 20 words, ends with period or question mark}
[Read the full breakdown →](https://nfllab.substack.com/p/{slug})
```

## Copy Rules (durable)
- **Lead with tension, not summary.** The caption should make the reader feel they're missing something, not that they already got the point.
- **Use numbers when they surprise.** "$22M apart" hits harder than "they disagree on money."
- **No hashtags, no emojis.** NFL Lab voice is clean and direct.
- **One caption per Note.** Don't stack multiple hooks — pick the sharpest one.
- **CTA is the link, not a sentence.** "Read the full breakdown →" is the only CTA needed; the card does the rest.

## Stage-Review Note: Published URL Caveat
For stage Notes targeting articles published on prod, the card link must point to the **prod** published URL (`nfllab.substack.com/p/...`), not a stage draft URL. Stage draft URLs do not trigger card rendering. The Note itself is posted to stage for review, but the link inside it points to the live prod article.

If the prod `/p/` URL is unknown (as with the two legacy articles below), the publisher or Lead should confirm the live URL before posting. Substack's default slug pattern is the article title, lowercased and hyphenated.
### 2026-07-27: Issue #78 — Stage 8 Closeout (Waddle Trade Article Published)
**By:** Lead (Lead / GM Analyst)
**Status:** ✅ EXECUTED — Article live, issue closed, follow-on created
**Affects:** Issue #78, pipeline.db, article-ideas.md, Issue #79

**What:**
Joe confirmed the Waddle trade article is live on Substack. Lead executed the Stage 8 closeout:

1. **Pipeline DB:** `den-mia-waddle-trade` updated from Stage 7 → Stage 8, status `published`, `published_at` timestamp set. Stage transition record inserted.
2. **Issue #78:** Closing comment posted, `stage:published` label applied, `go:needs-research` removed, issue closed as completed.
3. **article-ideas.md:** T1 entry updated to "✅ Stage 8 — Published".
4. **Follow-on issue #79:** Created for the NYJ two-firsts QB-decision piece teased in the article footer. Already at Stage 3 in pipeline.db. Target: Thursday of this publication week.

**Reusable pattern:**
Stage 8 closeout checklist:
- [ ] Update pipeline.db: `current_stage=8`, `status='published'`, `published_at`
- [ ] Insert `stage_transitions` record (agent=Joe)
- [ ] Post closing comment on GitHub issue
- [ ] Add `stage:published` label, remove stale labels
- [ ] Close the issue
- [ ] Create or confirm follow-on issue for teased article
- [ ] Update `article-ideas.md` pipeline table

---

### 2026-07-26: Issue #78 — Waddle Trade AFCCG Framing Final Approval
**By:** Editor
**Status:** ✅ APPROVED — AFCCG framing corrected, article cleared for publish
**Affects:** `content/articles/den-mia-waddle-trade/draft.md`, Substack prod draft 191309007

**What:**
Human editor flagged that the Waddle trade article anchored its receiver-room thesis to the AFC Championship Game — a game Bo Nix didn't play (fractured ankle; Stidham started). Editor re-review (review-3) issued 🟡 REVISE with 2 errors and 5 deliverables. Writer applied all 5 fixes. Editor final pass (review-4) issued ✅ APPROVED. Coordinator updated the prod Substack draft.

**Fixes applied:**
1. Line 57: No longer says logic "starts with the AFCCG loss" — pivots to regular-season tape
2. Line 208: Ankle carries causal weight for Super Bowl exit; receiver room = structural ceiling
3. TLDR: Two-sentence split — QB injury (acute) vs. receiver room (structural)
4. Opening: Stidham called "the biggest reason Denver's season ended" — no hedging
5. Table: Defensive-shell analysis explicitly labeled as regular-season data

**Reusable pattern:**
When an article uses a game as its narrative hook but the analytical argument covers a different timeframe, use **Disclaim → Anchor → Reframe**: (1) disclaim the hook event as evidence, (2) anchor to the correct timeframe, (3) reframe the closing to match. Verify the starting QB actually played the anchor game.

---

### 2026-07-26: Issue #78 — Waddle Trade Article Pipeline Execution
**By:** Lead
**Status:** ✅ EXECUTED — Article published to prod Substack
**Affects:** `content/articles/den-mia-waddle-trade/`, pipeline.db, issue #78

**What:**
Ran the full article pipeline (Stages 2→7) for issue #78 — "DEN/MIA — The Jaylen Waddle Trade." 4-agent panel (Cap, DEN, MIA, Offense) on `claude-opus-4.6`. Writer produced ~3,100 words. Editor caught two factual errors; both fixed. Published to `https://nfllab.substack.com/publish/post/191309007`.

**Key decisions:**
1. **Panel composition:** Cap + DEN + MIA + Offense — Panel Composition Matrix recommendation for trade evaluations. Produced genuine disagreement on valuation and cap sustainability.
2. **Dense table simplification:** Three tables exceeded inline density threshold — simplified from 4-6 columns to 2-3 columns each (chose simplification over PNG rendering).
3. **NYJ tease validation:** "Next from the panel" tease references NYJ two-firsts article, confirmed in pipeline.db at Stage 3.

**Reusable patterns:**
- For trade-reaction articles, the 4-agent panel (Cap + acquiring team + trading team + scheme) produces excellent structured disagreement. Recommend as default.
- Dense table avoidance: tables matching `isDenseTableHeader()` patterns plus 2+ numeric columns will trigger blocker. Pre-simplify during drafting.
- `.env` must be explicitly copied to git worktrees.

---

### 2026-07-26: Waddle Trade Article — Image Policy Verified
**By:** Editor
**Status:** ✅ APPROVED — images pass policy
**Affects:** `content/articles/den-mia-waddle-trade/draft.md`, Stage 7→8 readiness

**What:**
Verified the repaired Waddle trade article satisfies the 2-inline-image / no-cover-in-markdown policy. Both image files exist on disk and were visually inspected for AI failure patterns (fabricated charts, fake jerseys, embedded text). No issues found.

**Detail:**
- **Inline 1** (`den-mia-waddle-trade-inline-1.jpg`): Stadium shot — Empower Field, dramatic sky, Broncos colors. Clean.
- **Inline 2** (`den-mia-waddle-trade-inline-2.jpg`): Front-office desk — NFL football, Broncos jacket, open book. Clean.
- **Not verified:** Substack draft rendering at the prod URL. Joe should confirm images render correctly during Stage 8 review.

**Rationale:** Article text was already ✅ APPROVED in `editor-review-2.md`. This pass confirms the image repair is complete and introduces no new blockers. Article is clear for handoff.

---

### 2026-07-26: Waddle Trade Article — Issue #78 Created
**By:** Lead (issue creator)
**Status:** ✅ ACCEPTED — Issue created, pipeline queued at Stage 2
**Affects:** DEN agent, MIA agent, Cap agent, Offense agent, article pipeline

**What:**
Created issue #78 as a dual-team trade reaction article for the confirmed Jaylen Waddle trade (MIA → DEN). Used specific, fact-checked angle rather than generic "IDEA GENERATION REQUIRED" template.

**Trade Details (verified):**
- **To DEN:** WR Jaylen Waddle + MIA 2026 4th (No. 111)
- **To MIA:** DEN 2026 1st (No. 30), 3rd (No. 94), 4th (No. 130)
- **Contract:** 3yr/$84.75M extension (2024). Cap: $5M → $27M → $30M

**Rationale:**
Trade confirmed across ESPN, CBS Sports, SI, Pro Football Network. For confirmed events, write a specific angle immediately — saves one pipeline step. Expected panel: DEN, MIA, Cap, Offense.

**Pattern:** For confirmed transactions (trades, signings, extensions), skip "IDEA GENERATION REQUIRED" template and write a specific angle with verified facts. Reserve the generic template for team-overview issues.

---

### 2026-07-25: Article Footer Boilerplate — "War Room" Brand (Option A)
**By:** Lead; approved by Joe Robinson
**Status:** ✅ APPROVED + IMPLEMENTED — Forward-looking rollout
**Affects:** `.squad/skills/substack-article/SKILL.md`, `.squad/agents/writer/charter.md`, `.squad/skills/substack-publishing/SKILL.md`, `.squad/skills/publisher/SKILL.md`, `extension.mjs`, `batch-publish-prod.mjs`
### 2026-07-25: Production-Default Publishing (Prod-First Workflow)
**Date:** 2026-07-25
**Decided by:** Lead, at Joe Robinson's direction
**Status:** ACCEPTED
**Affects:** `extension.mjs`, `batch-publish-prod.mjs`, all future article publishes

**Context:** The original stage-first workflow was a safety measure during early pipeline validation. Now that the publisher extension is stable and validated across 20+ articles, sending articles directly to production by default reduces friction without sacrificing safety.

**Decision:** Normal article drafts go **directly to prod by default**. Stage is preserved as an explicit opt-in for testing new functionality.

**What changed:**
1. Extension default: `args.target || "prod"` (was `"stage"`)
2. Extension tool description updated
3. Publisher skill documentation updated (Stage-First → Prod-First Workflow)
4. Substack-publishing skill documentation updated

**How to request stage/testing:** Pass `target: "stage"` explicitly to `publish_to_substack()`, or run `node batch-publish-prod.mjs stage <slug>`.

**Safety preserved:**
- Published-article guard still blocks Stage 8/published articles
- ProseMirror validation gate still fires before draft creation
- Hero-safe image check still runs
- Dense table blocker still fires
- DB writeback required after every publish

---

### 2026-07-26: Mass Document Update Feature — Batch Article Content Changes (Issue #76)
**Date:** 2026-07-26
**Author:** Lead
**Status:** Proposed (unassigned)
**Affects:** Backlog for future implementation

**Context:** The footer rollout (War Room copy) highlighted a gap — we have no tooling to apply a single content change across all articles. Footer updates touched 4 templates but left ~18 existing drafts untouched because there was no batch-update mechanism.

**Decision:** Filed GitHub issue #76 with a 4-phase design:
1. **Inventory** — full manifest of nfllab articles classified as published, draft, local-only, or Substack-only
2. **Local-only updates** — apply changes to in-progress repo articles (stages 1–7) with no Substack API writes
3. **Substack draft updates** — write to Substack drafts with mandatory dry-run gate
4. **Published merge** — full read-merge-write cycle for live articles; Substack version wins on conflict

**Safety rails:** dry-run mode, git snapshot before writes, per-article status log, rate limiting, idempotency.

**Rationale:** Footer rollout is concrete precedent — this tooling would have saved manual work. Substack-first conflict resolution protects Joe's manual edits.

**Impact:** No code changes yet — issue unassigned, awaiting prioritization. When implemented, will integrate with `pipeline_state.py`, `article_board.py`, and Substack publisher extension.

---

### 2026-07-25: Article Footer Boilerplate Copy
**Date:** 2026-07-25
**By:** Lead
**Status:** ✅ APPROVED — Joe picked Option A on 2026-07-25
**Affects:** `.squad/skills/substack-article/SKILL.md`, existing article `draft.md` files, `.squad/skills/substack-publishing/SKILL.md`

**Problem:**
The current footer reads like a spec sheet and misses the welcome article's virtual-front-office tone.

**Decision:**
- Default Option A ("The War Room"):
  > *The NFL Lab is a virtual front office — specialized AI analysts who debate every angle of every move, moderated and fact-checked by a human editor. When they disagree, that disagreement is the analysis. Welcome to the War Room.*
  >
  > *Got a trade, signing, or draft scenario you want us to break down? Drop it in the comments.*
- Breaking-news variant Option E (short form):
  > *NFL Lab — AI-powered analysis, human-edited. Multiple experts. Real disagreements.*
- CTA line stays "Drop it in the comments."

**Impact:**
- New articles adopt Option A via `.squad/skills/substack-article/SKILL.md`.
- Existing published drafts remain untouched unless manually updated.
- Quick-hit posts keep Option E when the full footer is too heavy.

---

### 2026-07-25: Footer Boilerplate Rollout — War Room Brand
**Date:** 2026-07-25
**Author:** Lead
**Status:** ✅ IMPLEMENTED
**Affects:** All future articles on nfllab.substack.com

**Decision:** Joe approved **Option A ("The War Room")** as the default article footer. This is a forward-looking rollout — new articles use the new footer; existing drafts and published articles are not batch-rewritten.

**New Default Footer:**
> *The NFL Lab is a virtual front office — specialized AI analysts who debate every angle of every move, moderated and fact-checked by a human editor. When they disagree, that disagreement is the analysis. Welcome to the War Room.*
>
> *Got a trade, signing, or draft scenario you want us to break down? Drop it in the comments.*

**Files changed:**
| File | What changed |
|------|-------------|
| `.squad/skills/substack-article/SKILL.md` | Structure template boilerplate + Style Guide reference updated |
| `.squad/agents/writer/charter.md` | Boilerplate section updated to new copy |
| `.squad/skills/substack-publishing/SKILL.md` | Article file conventions example updated |
| `.squad/skills/publisher/SKILL.md` | Publisher checklist item updated |
| `.github/extensions/substack-publisher/extension.mjs` | `FOOTER_PARAGRAPH_PATTERNS` — added 3 new regex patterns for War Room brand |
| `batch-publish-prod.mjs` | `FOOTER_PARAGRAPH_PATTERNS` — same 3 new regex patterns added |

**Backward compatibility:** Old footer patterns are preserved in detection regex arrays. Subscribe widget placement and footer detection work with both old and new footer copy.

**Existing articles:** 18 existing articles still use the old footer. They do not need manual retrofit — already published articles can be edited in Substack editor if desired. Unpublished drafts will naturally pick up the new footer if Writer revises them through the pipeline.

---

### 2026-03-17: Re-gate Notes POST After Live 403
**By:** Lead (GM Analyst)
**Status:** ACTIVE — Implementation required
**Affects:** `extension.mjs` (`createSubstackNote()`), `validate-notes-smoke.mjs`, Notes Phase 0 timeline

**What:**
The Notes API endpoint candidate (`POST https://substack.com/api/v1/comment/feed`) discovered from the `postcli/substack` open-source library was ungated in `createSubstackNote()` based on the belief that open-source discovery replaced manual DevTools capture. Live smoke test authenticated successfully as Joe Robinson but the POST returned **HTTP 403 with an HTML error page**. No Note was posted.

**Decision:**
1. **Re-gate `createSubstackNote()` in `extension.mjs`** — restore unconditional throw until browser capture provides the missing request context
2. **Reinstate browser DevTools capture as the required Phase 0 unblock** — the open-source discovery narrows what to look for (most probable endpoint, payload shape, host) but does not replace the capture
3. **Do not speculate about the 403 cause in code** — wait for browser capture to reveal the actual difference between what the browser sends and what Node `fetch()` sends (likely: CSRF token, Origin/Referer validation, cookie scope, or endpoint deprecation)

**Why:**
Leaving `createSubstackNote()` ungated means any agent or tool call silently fails with 403 — bad UX and misleading pipeline state. Reverting to the original capture plan is low-cost (Joe knows the DevTools checklist) and high-certainty.

**Key Findings from 403:**
- Auth cookies are valid for publication subdomain (profile lookup succeeded)
- HTTP 403 from global `substack.com` endpoint suggests missing browser-level context
- Most likely blockers: CSRF token, Origin validation, cookie domain scope, or endpoint change

**Next Step:**
Joe performs browser DevTools capture per `docs/notes-api-discovery.md`. Focus on: CSRF headers, exact cookie string to `substack.com`, any `X-Substack-*` headers, and the response status when posting from the browser.

**Files changed:**
- `.github/extensions/substack-publisher/extension.mjs` — `createSubstackNote()` re-gated
- `validate-notes-smoke.mjs` — help text updated
- `docs/notes-api-discovery.md` — "Live Test Results: HTTP 403" section added; capture required again

---

### 2026-03-17: Notes API Endpoint Discovery (Phase 0 Shortcut)
**By:** Lead (GM Analyst)
**Status:** ATTEMPTED — Live 403 requires browser capture (see decision above)
**Affects:** `extension.mjs` (`createSubstackNote()`), `validate-notes-smoke.mjs`, Notes Phase 0 timeline

**Discovery (2025-07-27):**
The exact Notes API endpoint was found in the `postcli/substack` open-source library (`src/lib/substack.ts`, `publishNote()`):

- **Endpoint:** `POST https://substack.com/api/v1/comment/feed`
- **Host:** `substack.com` (global, not publication-specific)
- **Payload:** `{ bodyJson: {ProseMirror doc}, tabId: "for-you", surface: "feed", replyMinimumRole: "everyone" }`
- **Auth:** Same `substack.sid` / `connect.sid` cookies
- **CSRF:** Claimed not required by open-source library (incorrect — see 403 re-gate decision)

**Key Insight:**
Notes are **global**, not publication-scoped. The POST goes to `substack.com`, not to `{subdomain}.substack.com`. This means there is no "stage publication" isolation for Notes (unlike article drafts) — the auth token determines which user the Note is from.

**Rationale for Shortcut:**
The manual DevTools capture flow (originally Phase 0) was blocking all Notes progress. The open-source shortcut aimed to ungate implementation immediately, with the assumption that the captured endpoint format would match browser behavior.

**Status Update (after 403):**
The shortcut **did not work**. See "Re-gate Notes POST After Live 403" decision above for resolution path.

---

### 2026-03-17: Substack Notes Feature — Architecture & Rollout (Phase 0)
**By:** Lead (GM Analyst)
**Status:** ACTIVE — Phase 0 blocked on browser capture; Phase 1 ungated once capture completes
**Design doc:** `docs/substack-notes-feature-design.md`

**What:**
NFL Lab publishes long-form articles but has zero Substack Notes presence. Notes are Substack's microblogging / engagement layer — public, feed-visible, not emailed. They drive subscriber discovery between newsletter editions.

**Decisions Made:**

1. **Same extension, new tool (not a separate extension)**
   - `publish_note_to_substack` lives in `.github/extensions/substack-publisher/extension.mjs` alongside `publish_to_substack`
   - Rationale: shared auth, shared helpers, single maintenance surface

2. **Post-publish action, not a new pipeline stage**
   - Notes attach to Stage 8 as optional follow-up (8a: promotion, 8b: follow-up)
   - Adding a Stage 9 would break the 8-stage model embedded in DB schema and tooling

3. **`notes` table with optional FK to `articles`**
   - Supports both article-linked Notes (promotion, follow-up) and standalone Notes (quick takes)
   - FK nullable — standalone Notes have `article_id = NULL`

4. **Joe approval required for prod Notes**
   - Same editorial control model as articles
   - Agents post freely to `nfllabstage` for testing; prod requires explicit approval

5. **Rollout order: nfllabstage generic → nfllabstage structured → prod**
   - Mirrors the proven staging-first pattern used for article publishing

6. **API discovery as Phase 0 (hard gate)**
   - The Notes API endpoint is unofficial and reverse-engineered
   - Exact payload format MUST be validated by browser request capture before writing implementation code
   - **Status Update (2025-07-27):** Live test returned 403; browser capture reinstate as mandatory

**Files Affected (When Implemented):**
- `extension.mjs` — new tool registration + `createSubstackNote()` function
- `content/schema.sql` — new `notes` table
- `content/pipeline_state.py` — `record_note()`, `get_notes_for_article()` methods
- `content/article_board.py` — informational note count in board output
- `.squad/skills/substack-publishing/SKILL.md` — Notes documentation
- `.squad/skills/publisher/SKILL.md` — optional post-publish Note step
- `.squad/skills/article-lifecycle/SKILL.md` — mention Notes as post-publish action

**Current Status:**
Phase 0 browser capture is **BLOCKED** awaiting Joe's DevTools capture. Once capture is complete and validated, Phase 1 implementation can proceed immediately (infrastructure decisions already made).

---

### 2026-03-17: Writer — Substack Notes Phase 1 Voice & Content Decisions
**Date:** 2026-03-17
**Status:** Proposal stage (awaiting Joe Robinson approval)
**Owner:** Writer
**Requested by:** Joe Robinson
**Related:** `docs/substack-notes-feature-design.md`, `pipeline.db`

**Decisions:**
1. Notes are independent editorial voices rather than mere article abstracts; post a roughly 50/50 mix of article-linked teasers and standalone observations.
2. Every Note ends with an open question CTA so readers are invited to reply instead of being pointed to “read more.”
3. Images are optional but limited to one editorial/atmospheric photo; charts, headshots, memes, and low-resolution assets are prohibited.
4. Phase 1 Notes stay generic and stage-safe—no unpublished panels or proprietary analysis.
5. Notes use pure NFL Lab (Writer) voice; Phase 1 is not the place for expert quotes.
6. Phase 1 runs daily for validation; Phase 2 ties Notes to article publications (1 teaser per article + 1–2 standalone Notes per week).

**Implementation:**
- Record each Note in `pipeline.db` with a `note_type` flag (`teaser` vs `standalone`) so analytics track the mix.
- `publish_note_to_substack()` accepts an optional `image_path` and uploads the asset via `uploadImageToSubstack()`; Writer/Lead vet images for editorial tone.
- Editor or Lead spot-checks CTAs to ensure they are genuine questions.
- Writer flags any Note that risks spoiling unpublished material so the Lead can redirect the plan.

---

### 2026-03-17: Notes Phase 0 Complete — Playwright Required for POST
**Date:** 2026-03-17
**By:** Lead
**Status:** Applied
**Affects:** `.github/extensions/substack-publisher/extension.mjs` (`createSubstackNote()`), `validate-notes-smoke.mjs`, `.env`

**What:**
Joe's DevTools capture of `nfllab.substack.com/api/v1/comment/feed` succeeded with HTTP 200, proving the POST must originate from the publication host inside a real browser context.

**Key Findings:**
1. The POST targets the publication subdomain, not `substack.com`.
2. Cloudflare enforces same-origin headers, so server-side `fetch()` is blocked.
3. A Playwright page context (with `--headless=new`, `--disable-blink-features=AutomationControlled`, a real Chrome user-agent, navigation to `/publish/home`, and `fetch` with `credentials: "same-origin"`) is the reliable path.
4. No CSRF token is required; the `substack.sid` cookie carries the auth.

**Decision:**
- `createSubstackNote()` and `validate-notes-smoke.mjs` now use Playwright with the above settings.
- Remove `NOTES_HOST` from `.env` (defaults to the publication subdomain).
- No new dependency needed—the existing Playwright devDependency is reused.

**Impact:**
- Phase 0 is complete, unlocking Phase 1.
- Playwright adds 5–10 seconds per POST; direct fetch remains blocked until Cloudflare changes its bot detection.

**Files changed:**
- `.github/extensions/substack-publisher/extension.mjs`
- `validate-notes-smoke.mjs`
- `.env`
- `docs/notes-api-discovery.md`
- `.squad/skills/substack-publishing/SKILL.md`
- `.squad/agents/lead/history.md`

---

### 2026-03-17: Advance Notes Integration to Phase 1
**Date:** 2026-03-17
**Decided by:** Lead
**Status:** Accepted
**Affects:** Notes roadmap, `extension.mjs`, nfllabstage testing

**Context:**
Phase 0 (API discovery, Playwright POST, and test note cleanup) is complete. `delete-notes-api.mjs` now removes nfllabstage test Notes via Node `fetch()`.

**Decision:**
- Phase 1 (Structured Notes on nfllabstage) is now current.
- Phase 1 goals:
  1. Post a structured Note with an article link.
  2. Post a Note that includes an inline image.
  3. Validate ProseMirror rich text (bold, links, multiple paragraphs).
  4. Keep testing limited to nfllabstage; no production writes.

**Key Learnings:**
- Notes POST requires Playwright; DELETE works via Node `fetch()`.
- Always clean up test artifacts before advancing phases.

---

### 2026-03-17: Notes Sweep Report Implementation
**By:** Lead
**Status:** ✅ SHIPPED
**Affects:** `content/article_board.py`, `docs/substack-notes-feature-design.md`

**Context:**
The Notes cadence (Phase 5 of the Notes feature design) specifies a daily sweep that detects articles missing expected Notes. Step 2 called for "Add sweep eligibility report to `article_board.py` (report only)."

**Decision:**
Implemented `notes-sweep` as a report-only CLI command under `content/article_board.py`. The command emits gap counts on the console and via `--json`, wiring its output back into the existing reconciliation surface so `reconcile` references note-gap counts without posting anything to Substack. The detection rules flag Stage 7+ and Stage 8 articles that lack teasers or promotions, and urgent stale promotions that have gone 48+ hours without a prod Note.

**Detection rules:**

| Gap Type | Trigger | Severity |
|----------|---------|----------|
| `MISSING_TEASER` | Stage 7+ article with no teaser or promotion Note | info |
| `MISSING_PROMOTION` | Stage 8 published article with no prod promotion Note | warning |
| `STALE_PROMOTION` | Published >48h with no prod promotion Note | urgent |

**Why `article_board.py` (not a new file):**
- `article_board.py` is the existing operator reconciliation surface — all pipeline health checks already live there.
- It already has note-count awareness and `PipelineState` integration, so the new command can reuse those helpers.
- Operators already run `reconcile` and `board`; adding `notes-sweep` to the same CLI is zero onboarding cost.
- The `reconcile` output now cross-references the note-gap counts automatically.

**Why report-only:**
- Production Note posting still requires Joe’s approval; auto-posting would bypass that editorial gate.
- Report-only lets the instrumentation run safely while surfacing the gaps for human review.
- This phase is strictly observability; no automated writes are permitted until the follow-up slice.

**Alternatives considered**
1. **Standalone `notes-sweep.py`** — rejected; it would fragment the operator surface.
2. **Inline in `reconcile` output** — rejected; note gaps are semantically different from DB drift and would clutter reconciliation.
3. **Full auto-post with dry-run flag** — rejected; premature for this phase.

**Follow-up**
- Next slice (Step 3): semi-auto Stage 7 teaser workflow — auto-post teasers to nfllabstage while keeping prod writes report-only.


# Editor Review: JSN Note Trim & Image-Led Rewrite

**Date:** 2026-03-18  
**Note ID (stage):** 229307547  
**Current body word count:** ~370 words  
**Requested action:** Identify what MUST stay vs. what can cut with an image present  
**Requested by:** Joe Robinson  
**Editor:** Editor (Editor team)

---

## Executive Summary

The current live JSN Note (posted to nfllabstage) is **text-rich but image-optional**. With a 1:1 chart showing the four extension paths, the body text can drop to **150–180 words** while preserving all critical facts and narrative tension. The image carries the structural overhead; text should carry only the story and urgency.

---

## Must-Keep Facts (3 bullets)

1. **The absurd gap:** "JSN earning $3.4M — 90% below market" — this is the *only* fact that justifies why-now. It explains why we're talking about this extension *today*, not next year.

2. **The $33M cost of waiting:** This is the insight. One number. One sentence. It's the whole story: delay = inflation = cost. This is the thing that makes a reader click instead of scroll.

3. **The extension clock is ticking:** Urgency. Injury risk. Market inflation. The Note doesn't name these—the image + card will show them—but the *frame* has to signal "this is urgent *now*."

---

## Safe Cuts / Compressions (5 bullets)

1. **Delete the entire first paragraph** (~90 words on "JSN earning $3.4M, Shaheed $17M, Cap says $34M..."). The article card will show the headline and preview. Your text adds zero new information.

2. **Cut the four paths explanation entirely.** The image shows them. The article explains them. The Note doesn't need to describe the structure—it needs to explain *why it matters right now*.

3. **Remove all expert debate details** (Cap vs. Offense on $32M vs. $34M). The article has the full debate. The Note's job is to *interrupt the scroll*—not to preview the argument.

4. **Cut PlayerRep injury language** (OBJ, Thomas, DK examples). Save this for the article. The Note's job is "why-now," not "here's the risk."

5. **Delete the Shaheed deal paragraph entirely** (~50 words on negotiating leverage). The image and article will show the strategic moment. The Note only needs to signal urgency, not explain the move.

---

## Target Word-Count Range for Image-Led Version

**Single headline + image + card.** Current pattern on Joe's account (Note c-228989056): "Check out my new post!" + image + auto-rendered article card. **No body text at all.**

**Word target: 15–20 words MAX** (current: ~370)

**Why:** Substack's article card auto-generates the headline, byline, and publication thumbnail. The Note's only job is to draw the eye and establish urgency. The image does the visual work. The card does the credibility/preview work. Text only needs to *frame* why-now.

**The simplest pattern that works:**
> One sentence (15–20 words) that answers: "Why should I stop scrolling *right now*?" + image + article card (auto-rendered).

**Examples from Joe's feed:**
- "Check out my new post!" (4 words) + image + card ✅
- For JSN: Could be "JSN's extension clock just started ticking. 4 paths. $33M at stake." (13 words) + image + card

---

## Factual Traps to Avoid in Shorter Rewrite

⚠️ **Trap 1: "JSN is earning $3.4M"** vs. **"JSN earned $3.4M in 2025"**  
> The body text uses present tense ("is earning"), which implies ongoing 2026 salary. Verify with Cap expert: is the $3.4M the 2026 salary or the 2025 carry-forward? If unclear, use "came into 2026 earning" to be precise.

⚠️ **Trap 2: "$33M more" vs. "$33M additional cost"**  
> The current body says "waiting costs $33 million more in total contract value through 2030." Shorter version might compress to "$33M more" — but more *than what, exactly?* More than extending now. More than the 5th-year option. Make sure the comparison is explicit even in one sentence.

⚠️ **Trap 3: Shaheed's $17M is "fully guaranteed"**  
> The draft says "$17M AAV, $34.7M fully guaranteed." The Note teaser uses just "$17M/year" — confirm that's the relevant number for the pitch, not the total guarantee. If PlayerRep's argument hinges on "Seattle has cap space," then AAV is correct. If it's about intent-to-commit, maybe the $51M total matters. Current Note uses $17M — **keep it that way** (it's the per-year burden, which is the comp).

⚠️ **Trap 4: "Cap consensus is $34M AAV"**  
> The article text says Cap's starting point is Lamb's $34M, but Cap also acknowledges Jefferson's $35M and notes "anything below $32M is a laugh-out-loud." The Note currently says "$34M with front-loaded structure." In the trim, if you compress Cap's position to one sentence, make sure you're not overstating certainty. "Cap targets $34M" is defensible; "Cap says $34M" might be too narrow.

---

## Rewrite Recommendation (untested — for Joe's review)

**Proposed pattern matching Joe's live Notes (c-228989056):**

> JSN's extension clock just started. 4 paths. $33M at stake if Seattle waits.

**Word count:** 13 words  
**What the image does:** Shows the four paths, the timing/cost table, and gives the feed a visual hook.  
**What the card does:** Auto-renders the article headline, byline, pub image, and date.  
**What your text does:** Answer only "why should I care right now?"—not "here's the whole story."

**Alternative framings (13–18 words):**
- "JSN earns $3.4M. Waits 12 months? Cost goes up $33M. Here's why." (13 words)
- "The Shaheed deal just set JSN's extension price. Now Seattle has to move." (14 words)
- "Four experts. One clock. $33M on the table if the Seahawks blink." (13 words)

---

## Team Decision

**Decision:** Proceed with **image-first Note design** using the target 150–180 word range. The current text-heavy Note works on-page (where readers have scrolling room), but Substack Notes feed is mobile-first and scan-hungry. An image front-and-center with 150-word supporting copy will outperform 370 words of text in social discovery.

**Next step:** Joe reviews this editorial recommendation. If approved, rewrite the Note to the trim target, re-validate on nfllabstage with the image attachment, and capture the final Note ID for the Phase 3 production pass.

---

## Learnings for Editor History

- **Substack Notes with an image + article card are *ultra-brief* interrupts.** The live pattern on Joe's account (Note c-228989056) uses just 4 words ("Check out my new post!") + image + auto-card. This eliminates everything except the hook. The 145-word version I recommended was *still* 10x too long.
- **The image carries all structural complexity.** Don't describe the four paths, the timing table, or the expert positions in text. The image should do that. The article card preview should do that. Text only needs to answer: "Why am I reading this *right now* instead of later?"
- **The "$33M at stake" framing is the keeper.** It's the only fact that creates urgency. Everything else (expert names, Shaheed comp, specific AAV targets) lives in the article preview or the full read. The Note's job is to signal *now, not later*.
- **Lead with the absurd gap, signal the clock.** "JSN earns $3.4M" + image showing the market gap + one-sentence urgency frame ("clock just started," "Seattle has to move," "waits 12 months, cost goes up $33M"). That's the formula.
- **Cut ruthlessly when both image and card are present.** If readers can see the article headline, byline, and preview in the card, your text adds zero value except emotional frame. Every word better explain *why now*.
---

# Editor's Review: Phase 2 JSN Promotion Note

**Reviewer:** Editor (Article Editor & Fact-Checker)  
**Date:** 2026-03-18  
**Note Package:** Phase 2 Promotion Note — Jaxon Smith-Njigba Extension  
**Status:** ✅ APPROVED

---

## Fact-Check Summary

All substantive claims in the promotion note copy have been verified against the published article (jsn-extension-preview/draft.md) and the supporting expert position files. No factual errors found.

### Verified Claims

| Claim | Source | Status |
|-------|--------|--------|
| **JSN's $3.4M** | Article L14, Cap position | ✅ Confirmed (rookie deal year 3) |
| **Lamb's $34M** | Article L40, Cap position (Lamb 4yr/$136M) | ✅ Confirmed (AAV) |
| **Shaheed's $17M/year** | Article L93, Cap position | ✅ Confirmed (3yr/$51M deal in Feb 2026) |
| **90% below market value** | Article L14, Cap position | ✅ Confirmed (market floor $32M+) |
| **Four extension paths** | Article heading and "The Four Paths" section | ✅ Confirmed (extend now, 5th-year option, franchise tag, let him walk) |
| **Waiting costs $33 million more** | Article L71, Cap position section | ✅ Confirmed ($33M more through 2030 vs. extending now) |
| **Shaheed as negotiating weapon** | Article L91-98, PlayerRep quote | ✅ Confirmed (exact section title: "The Thing Nobody Outside the Building Is Talking About") |

---

## Tone & Voice Assessment

The promotion note successfully captures the article's core tension and urgency:

- ✅ **Data-forward opening** — Dollar figures ($3.4M vs $34M vs $17M) create immediate stakes
- ✅ **Competitive tone** — "His agent just got a gift" reflects the PlayerRep position (Shaheed as unexpected leverage)
- ✅ **Expert disagreement as the hook** — Each panelist's view surfaces in telegraphic language (Cap's financial precision, PlayerRep's guarantee-cash argument, SEA's defense-sequencing priority, Offense's system-amplified read)
- ✅ **Urgency framing** — "One clock ticking" matches the article's injury-risk narrative
- ✅ **Call-to-action alignment** — "Read the full breakdown" is implicit (not a generic "drop it in the comments"), consistent with NFL Lab's thought-leadership positioning

**Tone consistency:** Matches Writer charter — informed but accessible, data-heavy, narrative-driven, no jargon.

---

## Structural & Flow Notes

- ✅ **Opening hook works** — The three dollar figures immediately create curiosity: why is JSN's number so small relative to Lamb and Shaheed?
- ✅ **Middle section builds tension** — Four extension paths + the $33M cost-of-waiting trap + the Shaheed variable = a reading experience that escalates
- ✅ **Closing lands clean** — "Four experts. One clock ticking" is punchy and positions the reader to click through
- ✅ **Link integration** — Implicit CTA (not aggressive) suits a Notes feed where readers expect discovery, not hard sell

---

## Image Consideration

The note references `jsn-extension-preview-inline-1.png` (1024×1024 square format). This is appropriate:
- **Source:** Article-approved inline image (already published-ready per article draft)
- **Content:** Chart/graphic of the four extension paths (scannable, actionable)
- **Aspect ratio:** 1:1 square format (optimal for Substack Notes social rendering and feed visibility)
- **Relevance:** Directly supports the "four paths" teaser — visual reinforcement without added context needed

---

## 🟢 Minor Notes (Optional Polish)

### Grammar/Flow
- Line 55: "earning 90% below market value" — slightly awkward phrasing (typical phrasing is "earning 90% of market value" or "90% below market"). Current phrasing is defensible but could read as "earning, minus 90% of market" = slightly confusing. **Not a blocker** (article uses same phrasing on L14).
- Line 56: "Seattle just signed Rashid Shaheed (WR2) for $17M/year." — The notation "(WR2)" is correct context but uncommon in Notes format. Acceptable but slightly formal. Alternative: "Seattle just signed Rashid Shaheed (deep threat) for $17M/year" to match the article's description on L93. **Optional refinement.**

### Alignment with Published Article Voice
- The note uses "PlayerRep says guaranteed cash today is the only real money" — this is a strong paraphrase of the full quote on Article L77. The exact quote is longer and more emphatic. However, the paraphrase is factually accurate and fits the Note's space constraints. **No change needed.**

---

## ✅ APPROVED — READY FOR PHASE 2 POSTING

**Verdict:** The promotion note is factually safe, tonally consistent with the article, and reads as a compelling NFL Lab entry point. All key claims verify clean against published source material. The voice is urgent without being clickbait, data-driven without academic jargon, and the expert disagreement frames the reader's motivation to click through.

**Go-ahead:** Proceed with dry-run smoke test and manual posting to nfllabstage.substack.com per Phase 2 validation checklist.

---

## Decision Recorded

**Title:** Phase 2 JSN Note — Voice & Positioning Validated

**Finding:** The promotion note demonstrates a reusable pattern for short-form teasers:
1. Lead with the data absurdity (pay gap between JSN and comps)
2. Surface one unexpected variable (Shaheed's deal as leverage)
3. Signal expert disagreement in telegraphic form
4. Close with urgency frame + implicit CTA

This pattern is generalizable to any high-stakes decision article (trades, free agency, playoff scenarios) where multiple experts hold conflicting positions. The "one clock ticking" frame is especially effective for time-sensitive decisions.

---

*Editor — 2026-03-18*
---

---
date: 2026-03-18T14:30Z
decision_owner: Lead
title: JSN Phase 2 Note Reframing — Text-First Review + Image-Backed Revision
phase: Phase 2 Review → Phase 3 Prep
---

## Decision

The JSN Phase 2 Note currently live on nfflabstage (Note ID 229307547) is **kept as-is for Joe review**. The revision to a shorter, image-led format will be staged and tested separately before Phase 3 production post.

## Reasoning

### Current Note Structure (Text-Only, ~120 Words)
- ✅ **Strength:** Successfully posted (HTTP 200), readable, contains all expert voices and the critical $33M frame
- ✅ **Proof:** This is the first real article-promotion Note from our panel system — validates ProseMirror assembly and link insertion at scale
- ❌ **Gap:** Reads like compressed article summary, not a teaser. Too much narrative density for a Note feed where readers scan in 3 seconds

### Recommended Revision: MUCH SHORTER + Image + Article Card
**Reference example:** Joe Robinson's actual published Note (c-228989056) on the KC Fields article uses this minimal structure:
- 1-line lead: "Check out my new post!"
- 1 strong image (hero visual from the article)
- Article card auto-renders below (Substack displays headline, subtitle, publication, pub date)
- **Total user-visible text: 4 words** (image + article metadata do 95% of the work)

**For JSN, apply the same pattern:**
- **Lead (1 line, ~10–15 words max):** "Four paths. Four experts. One decision JSN can't delay."
- **Image (1 required):** The four-paths chart (jsn-extension-preview-the-four-paths.png)
- **Article link:** Substack card auto-renders with JSN headline, subtitle, cover, pub date
- **Total visible text: ~15 words** (image + article card carry all context)

**Why this pattern crushes longer versions:**
- Readers see image first (decision chart is the hook, not text)
- Headline + subtitle + card preview answer "why should I click?" before readers finish scanning
- The article card already displays JSN's compelling subtitle ("Here Are the 4 Paths — and the $33 Million Mistake Seattle Must Avoid")
- Text-first approach was inefficient — you had to read 120 words to understand four expert positions; image-first shows them instantly

### Risk Mitigation
- **Keep current Note live** during revision work — it's valid proof-of-concept
- **Test image attachment separately** — HTTP 500 on image failures means we validate image upload/attachment before bundling into full Note POST
- **Delete current Note cleanly** when image+text revision is ready (do not try in-place replacement)

## Affected Workflows

1. **Phase 2 Joe Review:** Review rendered Note on nfflabstage.substack.com/notes (current text-only version is the approved baseline for assessment)
2. **Phase 2.5 Revision (New):** Craft shorter copy, validate image attachment via separate smoke test, then post new version to nfflabstage
3. **Phase 3:** Use the approved short+image format for prod post to nfllab.substack.com

## Files Changed
- None (this is a staging decision; code changes recorded separately in Phase 2.5 execution)

## Next Steps
1. Joe reviews rendered Note on nfflabstage using the current text-only version
2. Lead coordinates Phase 2.5 revision: 60-word copy + image attachment validation
3. After Phase 2.5 approval, delete current Note and post revised version
4. Phase 3 production uses the short+image approved format

---

## Note Template (Phase 2.5 Candidate)

**Lead (1 line, ~10–15 words):**
"Four paths. Four experts. One decision JSN can't delay."

**Image (1 required):**
jsn-extension-preview-the-four-paths.png (or inline-1.png if chart is simpler)

**Article link (auto-renders):**
https://nfflabstage.substack.com/publish/post/191168255

Substack card will auto-display:
- Headline: "Jaxon Smith-Njigba's Extension Is Coming. Here Are the 4 Paths — and the $33 Million Mistake Seattle Must Avoid."
- Subtitle: "*Our expert panel disagrees on the number. They all agree on the clock.*"
- Cover image & pub date

**Total visible text: ~15 words** (vs. current ~120 words + 0 images + 1 link)
Image + article card handle 95% of the communication work.
---

# Decision: Notes Branch Cleanup & Push

> **Date:** 2026-03-18
> **Author:** Lead
> **Status:** Executed

## Context

After completing Notes Phases 0–3 (API discovery, smoke tests, JSN card-first Note on nfllabstage), the working tree accumulated 6 scratch scripts and a test screenshot alongside durable code, docs, and content changes. Local main had diverged from origin/main by 6/8 commits due to concurrent PR #77 (mobiletable) merges.

## Decision

1. **Scratch artifacts deleted:** `phase1-notes-test.mjs`, `phase1-test-results.txt`, `delete-notes-api.mjs`, `check-jsn-notes.mjs`, `replace-jsn-note.mjs`, `tc3-notes-page.png` — all one-off validation scripts whose learnings are fully captured in `docs/notes-api-discovery.md`.
2. **Durable content kept:** `content/notes-phase2-candidate-jsn.md` — structured Note copy template referenced by Writer history. All modified tracked files (extension.mjs, agent histories, now.md, pipeline.db, notes-api-discovery.md) committed.
3. **Reconciliation:** Rebased 7 local commits onto origin/main (no conflicts), pushed cleanly.

## Rationale

- Scratch scripts should be cleaned up once their learnings are captured in permanent docs. Leaving them creates branch noise and merge risk.
- The durable-vs-disposable heuristic: files referenced by agent histories or encoding reusable patterns are durable; standalone one-off scripts with no references are disposable.
- Rebasing (not merging) keeps the commit history linear and readable.

## Impact

- Branch is clean and up-to-date with origin/main
- Notes Phase 1–3 learnings preserved in docs and agent histories
- No work lost — all scratch script learnings are in `docs/notes-api-discovery.md`
---

# Decision: Reusable Template for Extension/Contract Notes

> **Date:** 2026-03-18  
> **Author:** Writer  
> **Status:** 🟢 Approved for use in Phase 2+ Notes  
> **Applies to:** JSN Note (phase-2-candidate-jsn.md) and future salary/contract-decision articles

---

## Finding

The JSN extension Note reveals a generalizable structure for contract negotiation articles. This template can be reused for any player extension, free agency decision, or salary cap pivot.

---

## Template Structure

### Opening Hook (1-2 sentences)
Present the absurd gap or central tension in dollar amounts.

**Example:** JSN's $3.4M. Lamb's $34M. Shaheed's $17M.

**Generalizable to:** Any contract comparison (current pay vs. market, vs. comparable signings, vs. ask)

### Variable Introduction (1 sentence)
Surface one non-obvious leverage point or context shift.

**Example:** Seattle just signed Rashid Shaheed (WR2) for $17M/year. JSN's agent noticed.

**Generalizable to:** Unexpected signings, coaching changes, front office moves, injury updates, or market events that shift leverage

### Expert Positions (3-4 sentences, one per expert max)
Thread each panelist's view into the narrative without quotes.

**Example:** Cap says "trap." PlayerRep says "guaranteed cash." Offense says "system-amplified."

**Generalizable to:** Any multi-expert article where disagreement is the product

### Call-to-Action Frame (implicit)
End with the decision or urgency that makes readers want the full analysis.

**Example:** "One clock ticking." / "Four paths, one window." / "The choice determines everything."

**Generalizable to:** Any frame that puts the decision front-and-center without generic "read more"

---

## Why This Works

1. **Visual scanning:** Dollar amounts and proper nouns anchor the eye; readers latch onto numbers before reading full sentences
2. **Panelist voice:** Threading expert positions (not quotes) maintains personality without dialogue heavy-lifting
3. **Implicit urgency:** The decision frame (not an explicit CTA) creates pull; readers want to understand the stakes
4. **Narrative arc:** The Note has a beginning (gap), middle (variable), and end (urgency) — it's a micro-essay, not a teaser

---

## Application Rules

- **Use when:** Article is about salary/contract decisions, free agency, roster moves, or cap strategy where expert disagreement surfaces the core tension
- **Image pairing:** Prefer charts/comparison tables from the article itself (already approved, reusable, scannable in feed)
- **Expert count:** Best with 3-4 expert voices (more gets cluttered; fewer loses the "disagreement is the product" frame)
- **Length:** 120-150 words (Note body, not headline) — longer than Phase 1 smoke tests but shorter than article snippets

---

## Files & References

- **Phase 2 candidate (example):** `content/notes-phase2-candidate-jsn.md`
- **Article:** `content/articles/jsn-extension-preview/draft.md`
- **Writer history:** `.squad/agents/writer/history.md` (Phase 2 learnings recorded)

---

## Next Iterations

Future contract/extension Notes (e.g., Seahawks RB evaluation, trade deadline decisions) can use this template. Adapt the opening gap, variable, and expert positions; keep the structure.
---

# JSN Extension Note — Reusable Decision: Feed-Native Image-Led Model

**Date:** 2026-03-18  
**Requester:** Joe Robinson  
**Decision Type:** Voice pattern, structure optimization  
**Update:** Revised toward feed-native model per Joe's example (https://substack.com/@joerobinson495999/note/c-228989056)

---

## Finding

Joe clarified the target model: Notes should be **one short line + strong image + article card**. The article card (auto-rendered by Substack from the linked article) carries the headline, subtitle, publication date, and preview. Text should be 1-2 sentences max; image does the visual hook; card does the detail.

This is fundamentally different from traditional teasers. It's feed-native: scroll, see image, read one-liner, card auto-expands with full article preview, click through.

### Reusable Pattern

- **Text:** 1-2 sentences (hook or CTA, not explanation)
- **Image:** Strong visual (chart, comparison, visual anchor)
- **Card:** Auto-rendered article metadata (headline, subtitle, date, preview)

The **card carries all narrative detail**. Text just nudges.

---

## Three Options Generated (Revised)

### Option A: Short — One Line (Pure CTA)

**Check out my new post!**

[Image + Article Card]

---

### Option B: Medium — One Hook Line (Data Point)

**JSN's extension decision just changed. Check out my new post.**

[Image + Article Card]

---

### Option C: Best-Balanced — Two Lines (Hook + Urgency)

**JSN at 90% below market. Our panel breaks the extension paths.**

[Image + Article Card]

---

## Recommendation

**Use Option C (Best-Balanced).**

**Why:**
- Retains the data hook (90% below market) — makes the reader want to know more
- Signals panelist disagreement without explaining it ("breaks the extension paths" = tension exists, go read)
- Two lines is the maximum before it stops feeling like a Note and starts reading like a teaser
- The article card will render the full headline, subtitle, and preview — that's where the panelist names and paths detail lives
- Image (four-paths chart) provides visual context; card provides narrative detail; text provides urgency

**Why not A or B:**
- **A** is too generic. Loses the hook that makes JSN interesting vs. any other "check out my post" Note
- **B** is closer, but "extension decision just changed" is vague. The data point (90% below market) is what makes a reader stop scrolling
- **C** gives just enough to create click curiosity while letting the card do the heavy lifting

---

## Reusable Insights

1. **Feed-native Notes = one-liner + visual + card.** The card is the real product (article preview). Text is the thumb-stop moment. Don't write article teasers in Notes; write feed hooks.

2. **Data points are better thumb-stops than narrative.** "JSN at 90% below market" stops scrolling. "Extension decision changed" is abstract. Use one specific number + one implication.

3. **"Our panel" + framework reference signals disagreement without detailing it.** Readers know what "breaks the paths" means in context (there are multiple options, and the experts don't align). No need to name each expert—the card will show they're quoted.

4. **Image should be the visual decision-maker.** The four-paths chart tells the "what are we choosing between" story. Text just nudges toward clicking.

5. **Article card auto-renders headline, subtitle, date, and publication preview.** That's the real teaser. Notes text is 1-2 sentences; everything else is visual (image) + card (metadata + excerpt).

---

## Model Reference

Joe's example: https://substack.com/@joerobinson495999/note/c-228989056

Pattern observed:
- Text: One short sentence ("Check out my new post!")
- Image: Strong visual that anchors the topic
- Card: Article preview auto-renders below (title, subtitle, date, excerpt)

This is the target format. JSN Note should follow the same structure.

---

## Related Patterns

- **Feed-native Note formula** (new, 2026-03-18) — One-liner + image + card. Text is the hook, image is the visual anchor, card is the detail layer.

- **Extension negotiation Note template** (2026-03-18, evolved) — Data point + framework signal. Let the card show the full headline and panel positions.

---

## Recorded In

- Writer history: "Feed-native Notes model + JSN revision" (2026-03-18)
- Team decisions: This file, for reuse on all future Notes
---

### 2026-03-18: Stage Review Notes with Prod Published URLs
**Date:** 2026-03-18
**Author:** Lead
**Status:** Executed

## Context
Phase 3 investigation confirmed article cards require links to production published `/p/` URLs. Previous stage Notes used draft URLs which don't trigger card rendering. Joe requested stage review Notes using real prod URLs so the Lead could confirm the copy before Joe's review.

## Decision
Posted 5 card-first stage review Notes on nfllabstage linking to production published article URLs. Used the "card-first body" pattern: teaser paragraph + ProseMirror link mark paragraph pointing to the prod `/p/` URL.

## Articles Used
| Pipeline Slug | Prod URL | Note ID |
|---|---|---|
| jsn-extension-preview | https://nfllab.substack.com/p/jaxon-smith-njigbas-extension-is | 229372212 |
| kc-fields-trade-evaluation | https://nfllab.substack.com/p/justin-fields-to-kansas-city-the | 229372239 |
| den-2026-offseason | https://nfllab.substack.com/p/the-broncos-missing-joker-why-denvers | 229372275 |
| mia-tua-dead-cap-rebuild | https://nfllab.substack.com/p/99-million-ghost-how-miami-rebuilds | 229372305 |
| witherspoon-extension-cap-vs-agent | https://nfllab.substack.com/p/cap-says-27m-the-agent-demands-33m-d00 | 229372344 |

## Technical Pattern
```javascript
{
  type: "doc",
  attrs: { schemaVersion: "v1" },
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Teaser hook..." }] },
    { type: "paragraph", content: [{
      type: "text", text: "Read the full analysis →",
      marks: [{ type: "link", attrs: { href: "https://nfllab.substack.com/p/slug" } }]
    }] }
  ]
}
```

## Key Finding
- `noteTextToProseMirror()` creates plain text paragraphs with NO link marks — insufficient for cards
- Explicit link marks to `/p/` URLs are required for card rendering
- Prod archive API (`GET /api/v1/archive`) is a reliable source for published article URL discovery

## Cleanup
After Joe's review, use `delete-notes-api.mjs` to remove the stage review Notes. Note IDs: 229372212, 229372239, 229372275, 229372305, 229372344.

---

### 2026-03-17T21:37:00Z: User directive
**By:** Joe Robinson (via Copilot)
**What:** For article promotion Notes, we just want a card for the article; the note should be card-first and not text-heavy.
**Why:** User request — captured for team memory
---

### 2026-03-17T21:32:40Z: User directive
**By:** Joe Robinson (via Copilot)
**What:** The JSN Phase 2 note should be shorter and should use an image; keep iterating on the image-backed version.
**Why:** User request — captured for team memory
---

### 2026-03-17T14:57:15.7699594-07:00: User directive
**By:** Joe Robinson (via Copilot)
**What:** For Notes, tease articles as coming soon when the draft is published, follow up with Notes when the article is publicly published, and consider a daily or more frequent sweep to post Notes automatically.
**Why:** User request — captured for team memory
---

---
Date: 2026-03-17T13:24Z
Agent: Lead
---

# Decision: Phase 2 Target = jsn-extension-preview

## Selection

**Article Slug:** `jsn-extension-preview`
**Full Title:** Jaxon Smith-Njigba's Extension Is Coming. Here Are the 4 Paths — and the $33 Million Mistake Seattle Must Avoid.

**Current State:**
- Pipeline DB Stage: 7 (Publisher Pass)
- Publisher-pass artifact: COMPLETE (`content/articles/jsn-extension-preview/publisher-pass.md`)
- Stage draft URL: `https://nfllabstage.substack.com/publish/post/191168255`
- Published URL: NONE (not yet live to prod)

## Why This Target

1. **Highest production value** among Stage 7 candidates:
   - 9 total images (2 inline, 5 tables, 2 decision matrices)
   - Expert panel across 4 domains (Cap, PlayerRep, SEA offense specialist)
   - Structured multi-path analysis (4 contract paths, 4 expert recommendations)

2. **Ideal Note teaser structure:**
   - Strong subtitle hook: "extension timing clock ticking"
   - Clear stakeholder conflict (Cap's $34M vs PlayerRep's $36M, vs SEA's defense-first strategy)
   - Built for promotion: each expert quote is standalone quotable

3. **No URL drift:** Article is Stage 7 draft-only. No prod URL yet to conflict with stage URL, unlike `kc-fields-trade-evaluation` (which was crossed up with prod URL).

4. **Publisher-pass ready:** All metadata locked, image count verified (2 inline), no revision lane — ready to promote.

## URL Decision

**Use stage draft URL:** `https://nfllabstage.substack.com/publish/post/191168255`

- Phase 2 is nfflabstage-only; Note will link to stage draft
- When article publishes to prod later, jsn will get a prod URL
- **Caveat:** pipeline.db currently overwrites stage draft URL with prod URL. Phase 2 execution will reveal this as a pain point; recommend separate `substack_stage_draft_url` field for future stage-only workflows

## Caveats & Notes

1. **Stage-vs-prod URL tracking:** After Phase 2 execution, Lead should file a cleanup decision about persisting both stage and prod draft URLs in DB (see `lead-stage-draft-url-provenance.md` decision inbox entry from 2026-03-17).

2. **Review timing:** The successful Phase 2 artifact should stay live on nfllabstage for Joe review. Do **not** delete a good Phase 2 Note unless it posts with an obviously bad artifact or a hard failure state.

3. **Next execution:** Phase 2 is ready to execute immediately. Create teaser Note with promotion copy (headline + clock tension) + 1 inline image from jsn assets.

---

## Outcome

- **Posted live:** 2026-03-17
- **Note ID:** `229307547`
- **Review feed:** `https://nfllabstage.substack.com/notes`
- **Review permalink:** `https://substack.com/@joerobinson495999/note/c-229307547`
- **Body shape that worked:** exact requested copy, emitted as line-by-line paragraphs
- **Image note:** recommended asset was verified locally, but the live review artifact is text-only after exact-copy image attempts kept returning HTTP 500

**Decision Status:** EXECUTED
**Next Action:** Joe reviews the live nfllabstage Note, then Lead decides whether Phase 3 should reuse the text-only body or retry image attachment.
---

# Decision Inbox: Preserve stage draft URLs separately from prod draft URLs

**Date:** 2026-03-17
**Agent:** Lead

## Context

While running Notes Phase 1 TC2 on `nfllabstage`, the linked article (`kc-fields-trade-evaluation`) needed its real **stage** draft URL. The current `pipeline.db` row still exists and is Stage 7 / `in_production`, but `articles.substack_draft_url` now points to the **production** draft URL (`https://nfllab.substack.com/publish/post/191216376`), not the original stage draft.

Lead recovered the stage URL (`https://nfllabstage.substack.com/publish/post/191214349`) from `.squad/decisions/archived-20260318-lead-fields-chiefs-trade.md` and completed the test successfully, but the lookup required historical grep rather than a canonical runtime source.

## Proposed decision

Persist stage and production draft URLs separately instead of overwriting the stage URL when a prod push happens. A dedicated `substack_stage_draft_url` field or an equivalent durable artifact/writeback would keep stage-only QA, Notes linking, and rollback/debug tasks from depending on decision-history recovery.

## Why this matters

- Stage-only Notes tests need a real stage draft link even after a prod push.
- Historical grep is workable once, but brittle as an operational pattern.
- Keeping both URLs would make draft provenance explicit and reduce future Lead friction.
---

# Decision Inbox: Use payload attachments for Substack Note images

**Date:** 2026-03-17
**Agent:** Lead

## Context

While running Notes Phase 1 TC3 on `nfllabstage`, Lead validated the final
inline-image smoke case using the approved asset
`content/images/kc-fields-trade-evaluation/kc-fields-trade-evaluation-inline-1.png`.

The article-style approach — embedding the uploaded image inside Note
`bodyJson` as `captionedImage` / `image2` content — returned **HTTP 500**
(`{"error":""}`) from `POST /api/v1/comment/feed`.

The successful payload kept `bodyJson` text-only and sent the uploaded image at
the top level as:

```json
"attachments": [
  { "url": "https://substack-post-media.s3.amazonaws.com/...", "type": "image" }
]
```

That request succeeded with **HTTP 200**, created Note **229296344**, and
cleanup was confirmed immediately via `DELETE /api/v1/notes/229296344` returning
HTTP 404 on delete and re-check.

## Proposed decision

Treat Substack **Notes** image handling as a separate payload shape from
Substack **articles**:

1. Upload the asset with `POST /api/v1/image`
2. Keep Note `bodyJson` text/richtext only
3. Send images via payload-level `attachments`
4. Do **not** reuse article `captionedImage` / `image2` nodes for Notes

## Why this matters

- Prevents future Lead/Writer/Publisher work from retrying the known-bad
  `captionedImage` path and burning time on opaque HTTP 500s.
- Clarifies that article ProseMirror rules do not transfer directly to Notes.
- Gives the eventual `publish_note_to_substack` image implementation a precise,
  validated contract from Phase 1 instead of an inferred one.
### 2026-03-17T05:35:20Z: Copilot Directive — Notes rollout staging order
**By:** Joe Robinson (via Copilot)
**What:** Roll out Substack Notes in stages: generic tests on nfllabstage, then structured NFL Lab-style Notes, and only after that make production updates.
**Why:** Joe wants explicit staged validation with AI checks, human validation, and production gating before any prod rollout.

---

### 2026-03-17T05:23:28Z: Copilot Directive — Article footer
**By:** Joe Robinson (via Copilot)
**What:** Use the War Room footer copy and follow it with the CTA asking readers to drop trade, signing, or draft scenarios in the comments.
**Why:** It aligns with the welcome article and the NFL Lab identity.

---

### 2026-03-17: Scribe Model Trial — gpt-5.1-codex-mini
**Date:** 2026-03-17
**By:** Scribe
**Status:** Approved

**Decision:** Default Scribe model switches to gpt-5.1-codex-mini after the verified double-write trial.
**Why:**
- Trial logs `.squad/log/20260317T105753Z-scribe-model-trial-codex-mini.md` and `.squad/log/_model-trial/20260317T105753Z-scribe-model-trial-verification.md` confirmed stability.
- Double-write verification proves the logging workflow works with gpt-5.1-codex-mini.
- gpt-5.1-codex-mini delivers the requested bandwidth for Scribe's logging and decision role.

**Next Steps:**
- Source gpt-5.1-codex-mini in future orchestration runs.
- Monitor the model trial logs for regressions before making the change permanent.

---

### 2026-03-17: Publish Article Drafts to Production by Default
**By:** Joe Robinson (user directive via Copilot)
**Status:** ACTIVE — Enforced in workflow
**Affects:** All article publishing; batch-publish-prod.mjs, squad orchestration, Lead routing

**What:**
Replaced misaligned footer boilerplate ("powered by a 46-agent AI expert panel...consensus view") with brand-aligned copy from the welcome article. New default:

> *The NFL Lab is a virtual front office — specialized AI analysts who debate every angle of every move, moderated and fact-checked by a human editor. When they disagree, that disagreement is the analysis. Welcome to the War Room.*
>
> *Got a trade, signing, or draft scenario you want us to break down? Drop it in the comments.*

**Rollout:** Forward-looking only. 18 existing articles retain old footer (not batch-rewritten). Old footer regex patterns preserved in `FOOTER_PARAGRAPH_PATTERNS` for backward compatibility. 4 skill/charter templates + 2 publisher scripts updated.

---

### 2026-07-25: Prod-Default Publishing
**By:** Joe Robinson (directive), Lead (implementation)
**Status:** ✅ ACCEPTED — Enforced in workflow
**Affects:** All article publishing; extension.mjs, batch-publish-prod.mjs, squad orchestration, Lead routing

**What:**
Normal article drafts go directly to prod (`nfllab.substack.com`) by default. Extension default changed from `"stage"` to `"prod"` (`args.target || "prod"`). Stage is preserved as explicit opt-in via `target: "stage"` or `node batch-publish-prod.mjs stage <slug>` — use when testing new publisher/rendering functionality.

**Safety preserved:** Published-article guard, ProseMirror validation, hero-safe image check, dense table blocker, DB writeback requirement all still active.

**Related todo:** prod-default-publishing

---

### 2026-03-17: Mobile Renderer Height/Width Estimation Must Be Font-Size-Aware
**By:** Analytics (revision cycle owner, issue #75)
**Status:** ✅ IMPLEMENTED — Revision complete
**Affects:** `.github/extensions/table-image-renderer/renderer-core.mjs`, `fix-dense-tables.mjs`

**What:**
Issue #75 revision revealed that the mobile table renderer's pixel-based estimation constants (character widths, header heights) were calibrated at 17px desktop font but used unscaled at 22px mobile font. This caused canvas underestimation → content clipping.

**Rules established:**
1. All pixel-based estimation constants must scale with font size — use `layout.tableCellFontSize / 17` as multiplier.
2. Header row height must be dynamically estimated via `estimateHeaderRowHeight()`, not a fixed pixel value.
3. Always overestimate canvas dimensions — prefer generous `heightSafety` (150px) and rely on `trimBottomWhitespace` to crop. Underestimation is irrecoverable; overestimation costs trivial whitespace-trimming compute.
4. Header CSS must include `overflow-wrap: anywhere` — `table-layout: fixed` forces column widths but without wrapping, text overflows boundaries.

**Commits:** c3a3243, 907bfa4

---

### 2026-03-17: Dense Table Images Illegible on Mobile — Dual-Render Implemented
**By:** Lead (Team Lead Specialist)
**Status:** ✅ IMPLEMENTED + REVISED — Clipping/collision defects fixed by Analytics (see above)
**Affects:** `.github/extensions/table-image-renderer/renderer-core.mjs`, `fix-dense-tables.mjs`, `audit-tables.mjs`, `validate-mobile-tables.mjs`

**What:**
Table/chart images rendered at 960–1160px width were shrunk to ~375px on mobile, making text ~36% of intended size. Alternative A (dual-render) implemented: every dense/borderline table now produces two PNGs — desktop at 960–1160px and mobile at 500–660px with 20px body / 16px header fonts. Mobile variant embedded by default.

**Validation:**
- Mobile PNGs at 375px viewport: 10.4–12.3px effective font ✅
- Desktop PNGs at 375px viewport: 5.0–5.6px effective font ❌
- Playwright validation passed; nfllabstage draft: https://nfllabstage.substack.com/publish/post/191225023

**Open Items for Human Review:**
1. 6–7 column mobile renders hit 10.4px effective font — borderline on low-DPR Android devices
2. Email rendering untested — mobile PNGs should scale better but needs real email validation
3. Future: Alternative E (text summaries) for low-complexity tables could complement this

---

### 2026-03-17: Produce Justin Fields Trade Evaluation as Breaking News
**By:** Lead (Team Lead Specialist)
**Status:** EXECUTED
**Article:** kc-fields-trade-evaluation
**GitHub Issue:** #74

**What:**
Breaking-news trade evaluation: Justin Fields traded from Jets to Chiefs for 2027 6th-round pick (Jets eat $7M of $10M salary). Produced at Depth Level 2 ("The Beat"), skipping Stage 1 ideation since the trade itself defines the angle.

**Panel Composition:**
KC, NYJ, Cap, Offense — 4 agents covering both sides of the trade plus financial and schematic analysis.

**Outcome:**
- Full pipeline Stages 2-7 completed in single session
- 2,875-word article with 7 expert quotes, 6 tables, 2 images
- Editor found and fixed 2 name errors (recurring Writer pattern)
- Substack draft pushed to stage: https://nfllabstage.substack.com/publish/post/191214349
- Awaiting Joe's Stage 8 review and publish

**Key Insight:**
$3M cost is below backup QB market floor ($5-12M). Real value is avoided cascading restructures + Rashee Rice suspension insurance.

---

### 2026-03-17: Durable Article Publish Rules — Subscribe Widgets & Hero Images
**By:** Lead (Team Lead Specialist) / Joe Robinson (direction)
**Status:** ACTIVE — Enforced in workflow
**Affects:** All articles at publish time; batch-publish-prod.mjs, future article publishers

**What:**
Every article published must include:
1. **Two subscribe-with-caption buttons** — one after the first opening paragraph, one near the end before closing notes. Writers may place explicit `::subscribe` markers; publisher injects missing widgets automatically at publish time.
2. **First image must be hero-safe** — No charts, tables, or ambiguous placeholder content. First image becomes the social-share preview image and must be a genuine article image.

**Why:**
User request to durably enforce article growth UX (subscribe placement) and social-preview safety (hero image selection) in the workflow itself, not left to memory or manual review.

**Implementation:**
- Publisher-level validation at push time
- Pre-publish schema check ensures compliance
- Future batch publishes inherit these rules automatically

---

### 2026-03-17: Production Substack Section Cleanup — Complete
**By:** Lead (Team Lead Specialist)
**Status:** EXECUTED
**Affects:** nfllab.substack.com (production)

**What:**
Removed all 32 unused NFL team sections from nfllab.substack.com. Sections were created early in the project but publishing has since moved to tags-based routing. Cleanup removes orphaned infrastructure.

**Execution:**
- Fixed `.env` token format mismatch: converted from URL-encoded to base64-encoded JSON per `.squad/skills/substack-publishing/SKILL.md` spec
- Ran: `node create-nfl-sections.mjs --delete`
- Result: All 32 sections deleted successfully (HTTP 200 on each)
- Verified: Subsequent dry-run shows 0 sections on nfllab.substack.com

**Sections removed:** Arizona Cardinals through Washington Commanders (all 32 NFL teams with custom team colors).

---

### 2026-03-17: imageCaption Parse Error — Root Cause & Fix
**By:** Lead (Team Lead Specialist)
**Status:** EXECUTED
**Affects:** substack-publisher extension, batch-publish-prod.mjs, all 4 prod drafts (witherspoon-v2, jsn-preview, den, mia)

**Root Cause:**
`buildCaptionedImage()` in the Substack publisher produced a `captionedImage` ProseMirror node containing only an `image2` child. Substack's editor schema requires `captionedImage` to contain both `image2` AND `imageCaption` children (content expression: `image2 imageCaption`). The missing `imageCaption` node caused `RangeError: Unknown node type: imageCaption` when the Substack editor tried to validate the document structure on draft open.

**Fix Applied:**
1. **extension.mjs** — `buildCaptionedImage()` now emits an `imageCaption` node as the second child of every `captionedImage`. If a caption exists, it contains the caption text; otherwise it has an empty content array.
2. **batch-publish-prod.mjs** — Same fix applied to the duplicated `buildCaptionedImage()`.
3. **Pre-publish validation** — Added `validateProseMirrorBody()` to the extension handler. Before any draft is created or updated, the converter's output is checked against a known-good set of Substack node types. If unknown types are found, the publish is blocked with a clear error message.
4. **All 4 prod drafts repaired** via `repair-prod-drafts.mjs`:
   - witherspoon-extension-v2 (draft 191200944): 6 images — fixed
   - jsn-extension-preview (draft 191200952): 7 images — fixed
   - den-2026-offseason (draft 191154355): 6 images — fixed
   - mia-tua-dead-cap-rebuild (draft 191150015): 4 images — fixed
5. All 4 drafts verified via authenticated API read-back: every `captionedImage` has correct `image2 + imageCaption` structure.

**Scope Check:**
- The ~20 other articles from the earlier rolled-back batch will use the fixed conversion on next push.

**Files changed:**
- `.github/extensions/substack-publisher/extension.mjs` (imageCaption fix + validation)
- `batch-publish-prod.mjs` (imageCaption fix)
- `.squad/skills/substack-publishing/SKILL.md` (docs updated)
- `repair-prod-drafts.mjs` (one-time repair script, can be deleted after verification)

---

### 2026-03-17: Witherspoon + JSN Publisher Pass and Prod Push
**By:** Lead (Team Lead Specialist)
**Status:** EXECUTED
**Affects:** witherspoon-extension-v2, jsn-extension-preview articles; article_board.py module; pipeline.db; nfllab.substack.com production

**What:**
After the overbroad Stage 7 prod push was rolled back (only DEN and MIA confirmed safe), reconciliation identified `witherspoon-extension-v2` and `jsn-extension-preview` as the next safe targets. Fixed three critical bugs in `article_board.py` and promoted both articles to production Substack:

1. **`article_board.py` sort bug** — `_parse_editor_verdict` sorted editor-review files by ASCII, causing `editor-review.md` (original REVISE) to sort above `editor-review-3.md` (latest APPROVED) for JSN. Fixed by sorting on extracted numeric suffix.
2. **`article_board.py` image-path bug** — `_count_images` only checked article directory, not `content/images/{slug}/` where generated images live. Fixed to check both locations.
3. **Missing `_expected_status_for_stage` helper** — Called in `reconcile()` repair mode but never defined. Added the function.
4. **Witherspoon inline image alt text** — Contained "Placeholder for generated art:" production notes. Cleaned to descriptive captions.

**Prod Draft URLs:**
- witherspoon-extension-v2: https://nfllab.substack.com/publish/post/191200944
- jsn-extension-preview: https://nfllab.substack.com/publish/post/191200952

**Why:** Both articles blocked on article_board.py repair-mode bugs and needed prod draft promotion to move to Stage 8 (Joe's final review). The fixes are foundational for all future article_board.py operations and needed shipping before any further pipeline work.

**Known cleanup:** ~39 orphan drafts from earlier overbroad push remain on nfllab.substack.com (non-destructive; bulk-delete from Substack dashboard when convenient).

---

### 2026-03-17: JSN & Witherspoon Production Draft Finalization
**By:** Lead (Team Lead Specialist)
**Date:** 2026-03-17
**Status:** Implemented
**Affects:** jsn-extension-preview, witherspoon-extension-v2; article_board.py

**What:**
Both `jsn-extension-preview` and `witherspoon-extension-v2` had oscillating DB state — bouncing between stage 6 and 7 across reconciliation runs. JSN also had stale status of "in_discussion" despite being well past discussion phase (editor-approved after 3 review passes).

1. **article_board.py status reconciliation added** — New STATUS_DRIFT check flags articles where status is inconsistent with current_stage. Conservative rules: only flags `in_discussion` at stage 5+ (should be `in_production`) and `proposed` at stage 2+. Does NOT downgrade `in_production` at early stages.
2. **Production draft URLs restored to most recent push** — Both articles had three different production draft IDs from successive batches. Highest draft IDs (191200944 / 191200952) represent most recent push and were restored as canonical `substack_draft_url`.
3. **Both articles confirmed at Stage 7** — Both have: editor ✅ APPROVED, publisher-pass.md artifact, production draft URLs on nfllab.substack.com, 2+ inline images, all paths reconciled.

**Why:** article_board.py now catches status/stage inconsistencies that previously went undetected. JSN status corrected from "in_discussion" → "in_production". Both articles unblocked for Joe's final review and publish.

---

### 2026-03-16: Stage 7 → Prod Draft Promotion — ROLLED BACK + RECONCILED
**By:** Lead (Team Lead Specialist)
**Date:** 2026-03-16
**Status:** ✅ RECONCILED — DB repaired, Editor verdict incorporated
**Affects:** All 22 Stage 7 articles; pipeline.db; nfllab.substack.com drafts

**What:**
Batch-published all 22 DB-Stage-7 articles to nfllab.substack.com as prod drafts, based on pipeline.db stating all 22 were Stage 7. Post-audit via `article_board.py` artifact scan revealed **only DEN and MIA are truly Stage 7.** The other 20 have inflated DB stages — artifacts show they are actually at Stage 5 (12 articles) or Stage 6 (8 articles).

**Cleanup performed:**
1. DB restored — 20 incorrect articles' `substack_draft_url` fields reverted to original nfllabstage staging URLs.
2. DEN and MIA untouched — prod draft URLs remain correct.
3. witherspoon-extension-v2 restored to staging URL (was independently at Stage 6 per artifact truth).
4. Ran `article_board.py --repair` — 20 inflated DB stages corrected to match artifact truth.

**Orphan prod drafts on nfllab.substack.com:** ~39 orphan drafts exist from two independent batch pushes (20 from writer-stage7-transform, 19 from Lead batch). All invisible to readers (unpublished drafts only). Joe can bulk-delete from Substack dashboard or leave them (no public impact).

**Root cause:** pipeline.db `current_stage` was inflated for 20 articles, likely from bulk stage transitions outrunning artifact production.

**Lesson for future:** Never batch-promote to prod based solely on pipeline.db stage. Run `article_board.py` first and use its output as gate. DB is coordination aid; artifacts are ground truth.

---

### 2026-03-16: Stage 7 Production-Readiness — Editor Quality Gate Results
**By:** Editor (Article Editor & Fact-Checker)
**Date:** 2026-03-16
**Status:** Proposed
**Affects:** Lead, Ralph pipeline, all Stage 7 articles, Joe (publication decisions)

**What:**
Stage 7 final draft push verification: confirm image/table fixes present in staging-ready artifacts and identify remaining quality blockers before production Substack drafts.

**Findings:**
- ✅ Image Fixes: COMPLETE — 94/94 image references valid, 0 broken references
- ✅ Table Fixes: COMPLETE — 0 blocked/borderline tables, 60 table-image PNGs rendered, 108 inline-safe
- ⚠️ Quality Blockers:
  | Tier | Count | Status | Action |
  |------|-------|--------|--------|
  | Production-ready | 2 | den, witherspoon — APPROVED | Push to prod |
  | DB stale | 2 | mia, jsn — APPROVED in history, DB shows REVISE | Reconcile DB, then push |
  | REVISE pending | 6 | ari, seahawks-rb, hou, lv, ne-maye, jax | Writer fixes → re-review |
  | REJECTED | 1 | buf — stale premise | Back to Stage 4/5 |
  | Never reviewed | 11 | car, dal, gb, kc, lar, no, nyg, phi, sf, ten, wsh | Complete Stage 6 first |

**Decision (Proposed):**
1. Push to prod: den and witherspoon (clear).
2. Reconcile + push: mia and jsn (DB updates needed).
3. Do NOT push 18 others until editor review loop completes.
4. Reconcile pipeline.db — editor_reviews table stale for mia/jsn at minimum.

---

### 2026-03-17: Witherspoon Extension v2 — Editor Review Verdict
**By:** Editor (Article Editor & Fact-Checker)
**Date:** 2026-03-17
**Article:** content/articles/witherspoon-extension-v2/draft.md
**Status:** ✅ APPROVED for publication (pending image generation)

**What:**
- Draft ready for Phase 4b (image generation) and Phase 7 (publisher pass)
- Zero factual errors across 70+ verified data points
- 4 🟡 suggestions filed (Cap quote attribution, one-fifth precision, Woolen/Bryant sourcing, image placeholders) — none are publication blockers
- v2 article supersedes v1 Witherspoon extension — Lead should confirm v1 archival

**Pattern to watch:** Polished-synthesis quote pattern (Cap quote at line 122 is Writer-crafted, not verbatim). Same issue flagged in JSN review. Team should decide house rule: (a) all blockquotes verbatim from position files, or (b) editorial paraphrasing acceptable with disclosure.

---

### 2026-03-17: Extension writeback stays Python-side
**By:** Lead (Team Lead Specialist)
**Date:** 2026-03-17
**Scope:** `.github/extensions/substack-publisher/extension.mjs` stage-7 writeback

**What:**
Substack publisher extension (Node.js/MCP) creates drafts but needs to update `pipeline.db` for stage-7 transition. Decision: Option 2 — extension returns article slug and concrete `PipelineState` code block. Calling agent (Lead/Ralph) executes writeback in Python.

**Rationale:**
- `PipelineState` is single source of truth for DB writes
- Extension opens DB read-only for team lookup only
- Mixing JS writes with Python's WAL-mode connection risks journal conflicts
- Writeback instruction is machine-parseable by calling LLM agent

---

### 2026-03-12: User directive — Model override
**By:** Joe Robinson (via Copilot)
**What:** All agents should use claude-opus-4.6 model. No exceptions.
**Why:** User request — premium tier for maximum quality on NFL domain analysis.

### 2026-03-12: User directive — Role-based agent names
**By:** Joe Robinson (via Copilot)
**What:** Rename specialist agents from Ocean's Eleven cast names to role-based names: Danny→Lead, Rusty→Cap, Livingston→Injury, Linus→Draft, Basher→Offense, Turk→Defense, Virgil→SpecialTeams. Easier to remember.
**Why:** User request — role-based names are more intuitive for an NFL domain team.

### 2026-03-12: User directive — 1M context fallback
**By:** Joe Robinson (via Copilot)
**What:** If agents hit context window limits or compaction, switch them to claude-opus-4.6-1m (1M context) model.
**Why:** User request — agents doing heavy research may need larger context windows to avoid data loss.

### 2026-03-12: NFC West 2026 Cap Landscape — Strategic Findings
**By:** Cap (Salary Cap Specialist)
**Status:** Proposed
**Affects:** ARI, LAR, SF, SEA team agents; Draft agent; Trade agent

**What:**
1. **SF faces a cap crisis** — $16.1M effective space, $36.2M dead money, projected $13.7M OVER the 2027 cap. Worst multi-year position in the NFC West. Purdy's $24.4M cap hit is SF's one structural advantage.
2. **SEA has cap ammo but lost key starters** — Cleanest cap in NFL ($483K dead money), $40.5M space. Lost Mafe, Walker III, Bryant in free agency. Can make 2-3 more signings or trade up in draft.
3. **ARI is best positioned for sustained competitiveness** — $41.7M raw space (7th in NFL), healthy 2027 outlook (~$17.2M projected). Buying window.
4. **LAR is cap-constrained with aging core** — $20.5M space (17th), 63% of cap on offense. Stafford ($48.3M) and Adams ($28M at 34) create aging-core risk. Only ~$3.2M projected for 2027.
5. **Edge rusher market diverged** — Elite tier now $40M+ AAV. Bosa's $34M AAV aging well relative to market. SEA's Nwosu at $9.76M is below market.

**Why:** Based on OTC and Spotrac data, cross-verified with ✅ confidence tags. 2027 projections from OTC multi-year models.

### 2026-03-12: 2026 NFL Draft Class — NFC West Implications
**By:** Draft (Draft Expert Specialist)
**Status:** Proposed
**Affects:** ARI, LAR, SF, SEA team agents

**What:**
1. **ARI holds pick #3** — Elite EDGE available (Bain Jr., Bailey). Full 7-round capital.
2. **LAR at #13** (acquired from ATL) — Access to top WR, OT, or CB talent.
3. **SF at #27** — Missing R3 pick (sent to DAL). Late first-round BPA approach likely.
4. **SEA at #32** — Mostly intact capital through R1-R3. Classic BPA spot.
5. **Defense-heavy class** — EDGE, LB, S, CB dominate top 15. Only consensus R1 QB is Mendoza (#1 to LV).
6. **Combine risers:** Sadiq (TE, Oregon), Styles (LB, Ohio State), Iheanachor (OT, Arizona State).

**Why:** Draft is April 23–25, 2026. Team agents need prospect-to-need mapping at their respective draft positions.

### 2026-03-12: Data Source Strategy for Web Research
**By:** Lead (Team Lead Specialist)
**Status:** Proposed
**Affects:** All 32 team agents, all 7 specialists

**What:**
- **Primary sources:** OTC for salary cap, Spotrac for free agents/contracts, ESPN for rosters/depth/transactions, NFL.com for UFA/RFA/ERFA tags.
- **Blocked:** Pro Football Reference returns 403 on all URLs — do NOT attempt PFR fetches.
- **Constraints:** OTC free agency page is JS-rendered (use Spotrac). OTC player IDs can't be guessed. Use `max_length=10000+` for cap/roster pages.

**Why:** Probed 15+ URLs across 5 data sources on 2026-03-12. PFR blocks automated access. Documented in `.squad/skills/`.

### 2026-03-13: User directive — Verify FA availability before recommending
**By:** Joe Robinson (via Copilot)
**What:** When trades/signings are reported by multiple outlets, consider them high confidence (🟢 Likely). Agents should check availability before recommending FA targets — don't suggest players who are already signed or traded.
**Why:** User request — avoid recommending unavailable players. Accuracy over speculation.

### 2026-03-13: FA Availability Alert — Seahawks targets revised
**By:** Media (NFL Media & Rumors Specialist)
**Status:** Proposed
**Priority:** HIGH
**Affects:** SEA team agent, Lead, all specialists who contributed to Seahawks FA analysis

**What:**
Of 20 players recommended in Seahawks FA analysis, 7 are confirmed unavailable (signed or traded). Key removals: Hendrickson (BAL), Koonce (LV re-sign), Awuzie (BAL), T. Johnson (traded LV), Kohou (KC), R. White (WSH), Deebo Samuel (contract voided — now UFA again). Still available: Bosa, Clowney, Von Miller, Calais Campbell, Lattimore, Douglas, Hobbs, Tre'Davious White, Najee Harris, Bobby Wagner, D.J. Reader, Jauan Jennings. EDGE, CB, and RB groups need revision.
**Why:** FA market moves fast. Several recommendations were outdated within hours of publication. All future target boards must verify current availability.

### 2026-03-13: Washington State Millionaires Tax changes Seattle's tax advantage
**By:** PlayerRep (Player Advocate & CBA Expert)
**Status:** Proposed
**Priority:** HIGH
**Affects:** SEA team agent, Cap, Lead, all specialists who referenced Seattle's "zero income tax" advantage

**What:**
WA passed SB 6346 on 2026-03-12 — 9.9% income tax on all personal income over $1M/yr, effective 2028-01-01. Applies to W-2 salary and visiting-athlete jock tax. Constitutional challenge likely (40–60% chance struck down). For 2026–2027, Seattle retains zero-tax advantage. For 2028+, a $20M/yr SEA contract loses ~$1.88M/yr to state tax — dropping the "$20M in SEA = $23M in SF" narrative to approximately "$20M in SEA ≈ $20.8M in SF." Short-term deals unaffected; multi-year deals need front-loading. Rookie contracts under $1M/yr unaffected regardless.
**Why:** Fundamentally changes Seattle's FA recruiting pitch for contracts extending past 2027. All prior analyses claiming zero-tax advantage need asterisks. TX/FL/TN/NV teams now have unambiguous tax edge over SEA.

### 2026-03-13: Media Daily Sweep — FA Wave 1 (22+ signings, Crosby trade voided, Tua to ATL)
**By:** Media (NFL Media & Rumors Specialist)
**Status:** Proposed
**Priority:** HIGH
**Affects:** ATL, PIT, IND, LV, BAL, SF, BUF, NYG, DAL, PHI, CAR, WSH, ARI, MIA, KC, SEA, LAR, MIN team agents; Cap, Draft, Injury, Offense, Defense, Lead specialists

**What:**
Full 24-hour sweep (March 12-13) during FA Wave 1. 22+ confirmed signings, 2 trades (1 voided), 2 releases, 1 retirement. Key moves:
- Tua Tagovailoa → ATL (1yr/$1.3M vet min). Kirk Cousins released outright by ATL.
- Maxx Crosby → BAL trade **VOIDED** (failed physical). LV keeps Crosby + #1 pick.
- Alec Pierce extended by IND (4yr/$116M). Michael Pittman Jr. traded to PIT (3yr/$59M ext).
- PIT also signed Dean (3yr/$36.75M), Dowdle (2yr/$12.5M), Brisker (1yr/$5.5M). Major win-now build.
- Rumor resolutions: Tua confirmed, Crosby voided, Cousins released (not traded), Garrett Wilson trade debunked, ARI #3 pick trade cooling, Minshew to ARI (not KC).

**Why:** Comprehensive free agency tracking ensures all agents have accurate, current roster data. 7 rumor resolutions prevent recommending unavailable players. Dashboard updated at `.squad/agents/media/history.md`.

### 2026-03-14: Media Daily Sweep — FA Day 3 (24+ new moves, Rodgers downgrade, mega-deals)
**By:** Media (NFL Media & Rumors Specialist)
**Status:** Proposed
**Priority:** HIGH
**Affects:** CAR, WSH, LV, NE, CIN, CHI, CLE, DAL, DEN, TB, NYJ, MIA, DET, SF, PHI, NYG, LAC, BUF, PIT, ARI team agents; Cap, Draft, Injury, Offense, Defense, Lead specialists

**What:**
Comprehensive 48-hour sweep (March 13-14) covering Day 2-3 of free agency. 24+ new confirmed transactions:
- Jaelan Phillips → CAR (EDGE, 4yr/$120M). Odafe Oweh → WSH (EDGE, 4yr/$100M). EDGE market now $25-30M AAV.
- Tyler Linderbaum → LV (C, 3yr/$81M). Romeo Doubs → NE (WR, 4yr/$68-80M).
- Bryan Cook → CIN (S, 3yr/$40.25M). Devin Bush → CHI (LB, 3yr/$30M). Jedrick Wills → CHI (OT, 1yr).
- Elgton Jenkins → CLE (OL, 2yr/$24M). Rashan Gary → DAL (DE, 2yr/$32M). Javonte Williams → DAL (RB, 3yr/$24M).
- J.K. Dobbins re-signed by DEN (RB, 2yr/$20M). Kenneth Gainwell → TB (RB, 2yr/$14M).
- NYJ acquired Geno Smith (trade from LV) + Minkah Fitzpatrick (trade from MIA, 3yr/$40M ext).
- MIA traded Fitzpatrick to NYJ. Full rebuild mode ($67M dead cap).
- Rodgers return to PIT DOWNGRADED to 🟡 Possible (was 🟢 Likely). Retirement probable. No contract offer.
- ARI #3 pick trade buzz UPGRADED to 🟡 Active. ESPN mocks show EDGE at #3, possible trade back for Ty Simpson.
- Total confirmed FA transactions tracked: 65+. Active rumors: 14.

**Why:** Day 3 FA sweep ensures all agents have accurate rosters. Rodgers downgrade is biggest strategic shift — PIT win-now plan at risk. EDGE market ($120M Phillips, $100M Oweh) resets benchmarks. NYJ becoming dark horse via trades. MIA in full rebuild.

### 2026-03-14: Article Lifecycle Skill — Architectural Decisions

**By:** Lead  
**Status:** Proposed  
**Affects:** Lead, Writer, Editor, future Publisher agent, all panel-eligible agents

**Decision 1: Discussion Prompt as a Required Pre-Panel Artifact**
- Every article must have a completed Discussion Prompt (Stage 2) before panel composition begins
- The prompt defines the central question, the tension/conflict, and what makes the article worth reading
- Forces the angle up front, cascading to better panel selection and stronger articles

**Decision 2: Publisher Pass (Stage 7) as a Distinct Stage**
- New stage between Editor approval and Substack publish
- Covers final formatting, metadata (title, subtitle, tags, URL slug, section, cover image), scheduling, and distribution planning
- Previously invisible work now codified as a checklist, manually usable today and parseable by future Publisher agent

**Decision 3: Panel Composition Rules (2–5 Agents, Selection Matrix)**
- Formalized panel composition: always include relevant team agent(s), always include at least one specialist, 2–4 is sweet spot, 5 is maximum
- Selection matrix maps article types to recommended panels
- RB article used 6 agents successfully, but that's near the upper limit

**Decision 4: Lifecycle Skill Wraps (Does Not Replace) Substack-Article Skill**
- Article-lifecycle skill is coordinator-level orchestration
- Substack-article skill remains authoritative for drafting mechanics (template, formulas, style guide, editorial protocol)
- Both skills maintained in parallel to avoid duplication

**Decision 5: Confidence Level — Low (Needs End-to-End Validation)**
- Skill starts at confidence `low` despite incorporating proven patterns
- Stages 4–6 validated (two published articles)
- Stages 2, 3, 7 are new and untested
- Promote to `medium` after one article passes through all 8 stages, to `high` after 3+ articles

### 2026-03-15: Media Daily Sweep — FA Day 4 (50+ new moves, Rodgers upgraded, TEN $270M spree)
**By:** Media (NFL Media & Rumors Specialist)
**Status:** Proposed
**Priority:** HIGH
**Affects:** SEA, TEN, LV, NYG, NE, WSH, HOU, CLE, LAR, CAR, CHI, LAC, DAL, IND, KC, NO, NYJ, BAL, DET, PHI, BUF, TB, SF, ARI, CIN team agents; Cap, Draft, Injury, Offense, Defense, Lead specialists

**What:**
Comprehensive Day 3-4 sweep (March 14-15) during FA Wave 1. 50+ new confirmed transactions, 1 trade, 2 restructures. Key moves:
- TEN spending spree: Robinson ($78M), Franklin-Myers ($63M), Taylor ($58M), Flott ($45M), Bellinger ($24M) = $270M+ total. Biggest FA spender in the league.
- SEA re-signed Shaheed ($51M WR) and Jobe ($24M CB) but lost Coby Bryant to CHI ($40M S). $44M cap remains.
- LV defensive overhaul: Paye ($48M), Walker ($40.5M), Dean ($36M), Stokes ($30M) = $154M+ on defense around Mendoza (draft).
- NYG building under Harbaugh: Likely ($40M TE), Eluemunor ($39M RT), Mooney ($10M WR), Newsome ($8M CB).
- NE adds Vera-Tucker ($42M OL) + Dre'Mont Jones ($36.5M EDGE) to protect Maye.
- LAR adds Watson ($51M CB) — NFC West secondary upgrade.
- SF restructures Nick Bosa (cleared $17.172M) — signals imminent Joey Bosa signing.
- David Montgomery traded DET→HOU with new 2yr/$16.5M deal.
- Rodgers → PIT UPGRADED to 🟢 Likely (insiders "near-certain" of return, decision before draft).
- Diggs market: BAL now consensus frontrunner. No deal.
- Total confirmed FA transactions tracked: 115+. Active rumors: 15.

**Why:** Day 4 FA sweep ensures all agents have accurate rosters. Rodgers upgrade is biggest strategic shift — PIT win-now plan back on track. TEN $270M spree creates new AFC contender. NFC West arms race intensifying (Watson→LAR, Bosa restructure→SF, Shaheed/Jobe→SEA). 3 article candidates identified (TEN spree, SEA window, Rodgers decision).

### 2026-03-15: README.md Structure and Tone

**By:** Writer  
**Status:** Delivered

**Structural Choices:**
1. Agent roster as condensed table (14 rows) instead of listing all 47; full roster in `.squad/team.md`
2. Pipeline section uses text flowchart (numbered steps, not Mermaid) — readable without dependencies
3. "What's Next" is a checklist — Joe can tick off as capabilities ship
4. No VISION.md content leaks — revenue projections stay there, README references it but doesn't quote
5. Tone: Direct, energetic, zero fluff — internal engineering docs, not marketing copy

**Rationale:** Joe needs a doc answering "what is this, how do I use it" in under 2 minutes. Everything else is noise.

### 2026-03-15: Add `discussion_path` Field to Articles Table
**By:** Lead  
**Status:** Proposed  
**Affects:** pipeline.db schema, article lifecycle tooling, Scribe, Writer, Lead

**What:**
Add a `discussion_path` field (TEXT, nullable) to the `articles` table in `pipeline.db`. After any article's panel discussion phase completes, populate this field with the relative path to the discussion directory (e.g., `'content/articles/jsn-extension-preview/'`). This enables:
1. **Traceability** — Any agent can query the DB and immediately find discussion artifacts
2. **Automation readiness** — Writer agent reads `discussion_path` to know where discussion summary and position statements live
3. **Future flexibility** — Handles non-standard locations (e.g., imported external research)
4. **Alignment with existing pattern** — Table already has `article_path` and `substack_url`; `discussion_path` is the logical companion

**Schema change:**
```sql
ALTER TABLE articles ADD COLUMN discussion_path TEXT;
UPDATE articles SET discussion_path = 'content/articles/jsn-extension-preview/' WHERE id = 'jsn-extension-preview';
```

Also update `content/schema.sql` to include this column in the `CREATE TABLE articles` definition for future `init_db.py` runs.

**Why:** Needed before the next article reaches `panel_discussion` stage at scale. Currently manageable with path convention inference, but should be added before Phase 2 automation is built. Enables Writer agent to operate independently.

**Priority:** Medium — non-blocking but foundational for automation.

### 2026-03-15: Lead Intel Brief — Editorial Priority Changes
**By:** Lead  
**Status:** Proposed  
**Priority:** HIGH  
**Affects:** Writer, Editor, SEA, Cap, Defense, Draft, Media

**What:**
Based on the March 14-15 Media sweep (50+ new transactions, 115+ total tracked), the following editorial priority changes are proposed:

1. **Priority #1 ("Seattle Lost Half Its Defense") — CONFIRMED ON SCHEDULE (Mar 17).** Bryant loss to CHI ($40M) is the 4th major departure. Shaheed ($51M) and Jobe ($24M) re-signs provide counterbalance. This article is now more urgent and richer with new data.

2. **Priority #2 ("The Free Agent Nobody's Talking About") — CONFIRMED ON SCHEDULE (Mar 18).** Jennings (WR, ESPN projects SEA) and Asante Samuel Jr. (CB, injury discount) are the strongest candidates. Bryant departure makes the CB angle especially compelling.

3. **NEW — "Tennessee's $270M Spending Spree" — ADD TO PIPELINE (Mar 19-20).** Media scored 5/5 significance. First non-SEA article. Massive audience potential. Panel: TEN, Cap, Offense, Defense, Draft.

4. **NEW — "The Rodgers Decision" — ADD TO PIPELINE (preview Mar 21, or reactive publish when decision drops).** Media scored 4/5. Time-sensitive — decision expected before draft. Panel: PIT, Cap, Offense, Lead.

5. **"NFC West Power Rankings" (Evergreen) — PROMOTE TO MARCH WINDOW.** All 4 NFC West teams made significant moves this week. Could publish as an NFC West FA recap. Panel: ARI, LAR, SF, SEA.

6. **Media's "Seattle Championship Window" candidate — MERGE with Priority #1** rather than a separate article. The "retention vs. exodus" angle strengthens the defensive departures piece.

**Why:** The news cycle is moving fast. Three new article candidates emerged from today's sweep alone. TEN and Rodgers pieces expand beyond SEA-only coverage (growth play). NFC West recap leverages our division expertise. All existing pipeline items remain on schedule — this is additive, not disruptive.

**Decision requested:** Approve adding TEN spree + Rodgers decision to the pipeline, and promoting NFC West Power Rankings to March.

---

### 2026-03-15: Article Candidates from Daily News Sweep
**By:** Media  
**Status:** Proposed  
**Affects:** Lead, Writer, Editor

**What:**
Five article candidates identified from March 14-15 news sweep, scored by significance:

**Score 5 — Must-Write:**
- "Tennessee's $270M Spending Spree: Are the Titans Instant AFC Contenders?" — TEN signed Robinson ($78M), Franklin-Myers ($63M), Taylor ($58M), Flott ($45M), Bellinger ($24M). Biggest FA spender in NFL. Panel: TEN, Cap, Offense, Defense, Draft.

**Score 4 — Strong Candidates:**
- "Seattle's Championship Window: Retention Strategy vs. Free Agent Exodus" — Re-signed Shaheed/Jobe while losing Walker III, Mafe, Bryant. $44M cap, pick #32. Panel: SEA, Cap, Defense, Draft.
- "Las Vegas' Defensive Masterclass" — Paye, Walker, Dean, Stokes ($154M+ on D) around rookie Mendoza. Panel: LV, Cap, Defense, Draft.
- "The Rodgers Decision" — Status upgraded to 🟢 Likely. Decision before draft. PIT's entire win-now plan depends on this. Panel: PIT, Cap, Offense, Lead.

**Score 3 — Monitor:**
- "Harbaugh's Giants" — Likely, Eluemunor, Mooney signings. Early patterns; monitor 1 more week.
- "NFC West Arms Race Update" — All 4 teams moved (Watson→LAR, Bosa restructure→SF, Shaheed/Jobe→SEA). Best as section in broader FA recap.
- "The Free Agent Dead Zone" — Elite FAs still unsigned (Diggs, Bosa, Jennings). Best at Day 7-10 when patterns clear.

**Recommendation:** Articles #1 (Titans), #2 (Seahawks), and #4 (Rodgers) are strongest for immediate publication. #2 is highest priority given Seahawks focus.

**Why:** Comprehensive news tracking ensures article pipeline reflects current, high-impact topics. Titans and Rodgers pieces expand beyond SEA-only coverage (audience growth). Timing critical — Rodgers decision expected within 2 weeks.

---

### 2026-03-15: Media Intel Drop — League-Wide (50+ New Transactions)
**By:** Media  
**Status:** Proposed  
**Priority:** HIGH  
**Affects:** All 32 team agents, all specialists

**What:**
Comprehensive Day 3-4 free agency sweep (March 14-15). 50+ new confirmed transactions documented in detail:

**Headline Moves:**
- **TEN:** Robinson ($78M WR), Franklin-Myers ($63M DL), Taylor ($58M CB), Flott ($45M CB), Bellinger ($24M TE) = $270M+ spree
- **LV:** Paye ($48M EDGE), Walker ($40.5M LB), Dean ($36M LB), Stokes ($30M CB) = $154M+ defensive overhaul
- **NYG:** Likely ($40M TE), Eluemunor ($39M RT), Mooney ($10M WR), Newsome ($8M CB) building under Harbaugh
- **NE:** Vera-Tucker ($42M OL), Dre'Mont Jones ($36.5M EDGE) protecting Maye
- **LAR:** Watson ($51M CB) — NFC West secondary upgrade
- **SF:** Bosa restructure cleared $17.172M — signals Joey Bosa signing
- **Rodgers → PIT:** UPGRADED to 🟢 Likely (insiders "near-certain")
- Plus 40+ additional confirmed FA signings and depth moves

**Database Update:**
- Total confirmed FA transactions tracked: 115+
- Active rumors: 15
- All moves verified via Spotrac, OTC, ESPN, NFL.com

**Why:** Comprehensive tracking ensures all agents have current roster data. Day 4 sweep reveals biggest strategic shifts: TEN building new contender, LV defensive pivot, Rodgers likely returns to PIT. Three article candidates identified (TEN spree, SEA retention, Rodgers decision). All team agents should update roster knowledge with current moves and cap impacts.

---

### 2026-03-15: Media Intel Drop — SEA (Priority)
**By:** Media  
**Status:** Proposed  
**Priority:** HIGH  
**Affects:** SEA team agent, Cap, Defense, Draft, Lead

**What:**
Seahawks-focused intel from Day 3-4 sweep (March 14-15):

**Confirmed Moves:**
- ✅ Rashid Shaheed RE-SIGNED — WR, 3yr/$51M ($34.735M gtd, $23M at signing). Explosive deep threat + return specialist locked in as WR2/3. $17M AAV.
- ✅ Josh Jobe RE-SIGNED — CB, 3yr/$24M ($14.25M gtd, $9.5M at signing). Press-man specialist, 15/16 starts in 2025, 54 tackles, 12 PDs. CB2 alongside Witherspoon. $8M AAV.
- ❌ Coby Bryant LOST to CHI — S, 3yr/$40M ($25.75M gtd). Fourth significant departure (Walker III→KC, Mafe→CIN, Bryant→CHI). Secondary now thin at safety.
- ✅ Depth: Brady Russell (TE), Emanuel Wilson (RB) signed. Tyler Hall (DB) released. D'Anthony Bell (DB) re-signed.

**NFC West Context:**
- Nick Bosa restructure (SF) cleared $17.172M — signals imminent Joey Bosa signing, NFC West EDGE arms race escalates
- Jaylen Watson → LAR ($51M CB). Rams adding McDuffie (trade) + Watson in secondary
- Jalen Thompson → DAL ($33M S, from ARI). NFC West rival loses key safety

**SEA Situation:**
- **Cap Space:** $44.08M remaining — 6th most in NFL. Room for 1-2 more significant signings.
- **Safety Need (CRITICAL):** Bryant loss leaves safety group thin. Draft intel has SEA mocked for Notre Dame RB at #32.
- **FA Targets Still Available:** Jauan Jennings (WR, ESPN projects SEA, ~$12-16M AAV); Najee Harris (RB, post-Achilles); Bobby Wagner (LB); Asante Samuel Jr. (CB, injury discount).

**Confidence:**
- ✅ Shaheed re-sign — CONFIRMED (Spotrac verified, Tier 1-2 sources)
- ✅ Jobe re-sign — CONFIRMED (Spotrac verified, Tier 1-2 sources)
- ✅ Bryant departure — CONFIRMED (Spotrac, CHI announcement)
- 🟢 Bosa → SF — Likely (restructure + Tier 1-2 reports)
- 🟡 Jennings → SEA — Possible (ESPN projection)
- 🟡 Harris → SEA — Possible (projected landing spot)

**Why:** SEA-specific intel enables team agent to update roster knowledge and identify priority signings. Bryant loss creates urgent safety need alongside RB (post-Walker III). $44M cap space provides signing room. Jennings/Harris are high-value FA targets still available. Draft RB need aligns with #32 pick in current mocks.

---

### 2026-03-15: User directive — Avoid politically divisive topics
**By:** Joe Robinson (via Copilot)  
**Status:** Proposed  
**Priority:** CRITICAL  
**Affects:** All agents, all content tracks

**What:** Avoid politically divisive topics in all content. Specifically: do NOT reference or analyze state/federal tax legislation (e.g., WA SB 6346 millionaires tax), political bills, or any content that could be construed as taking a political stance. This applies to all article ideas, discussion prompts, panel discussions, article drafts, and agent analyses.

**Why:** User request — captured for team memory. The WA tax angle surfaced in the JSN contract panel discussion and was flagged as inappropriate for the platform.

**Scope:** All agents — Lead, Media, Writer, Editor, Publisher, panel participants, and any future agents.

**⚠️ BLOCKING NOTE (Scribe):**
JSN panel discussion completed on 2026-03-15 before this directive was filed. Discussion summary and panelist positions reference WA SB 6346 tax mechanics as a key finding. **Action Required:** Lead or Editor must revise `content/articles/jsn-extension-preview/discussion-summary.md` and related position files to remove tax references before article proceeds to Writer stage (Stage 5). This should not block the log/decision merge, but must be resolved before draft production.

---

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction


Decision: All article content must avoid politically divisive topics. No tax legislation, political bills, or political angles. Applies to all stages: ideas, discussion prompts, panel positions, drafts, editor/publisher passes.

### Editor Verdict: JSN Extension Preview — Re-Review


# Editor Verdict: JSN Extension Preview — Re-Review

**From:** Editor  
**Date:** 2026-03-15  
**Article:** "Jaxon Smith-Njigba's Extension Is Coming. Here Are the 4 Paths — and the $33 Million Mistake Seattle Must Avoid."  
**Review:** Re-review (2nd pass) after Writer addressed 🟡 REVISE feedback

---

## Verdict: ✅ APPROVED

All three 🔴 errors from the first review are fixed correctly:

1. **Rob Havenstein** — "Ryan" corrected to "Rob" on line 120. ✅
2. **Cap/PlayerRep quote attribution** — Blended quote properly split into two quotes with correct panelist attribution (Cap: comps, PlayerRep: draft-slot argument). ✅
3. **Shanahan-tree superlative** — Now reads "since Cooper Kupp's 1,947-yard outlier in 2021," properly qualifying the claim. ✅

**Additional findings:**
- Full 8-quote attribution audit: all clean. No misattributions remain.
- No new factual errors on full re-read.
- 4 carried-forward 🟡 suggestions (stat specifics, vague record claim, table footnote, "rebuilding" wording) remain as recommendations for future updates. None are publish-blockers.

**The article is publish-ready.**

---

*Full review saved to: `content/articles/jsn-extension-preview/editor-review-2.md`*

### Editor Verdict: JSN Extension Preview Article


# Editor Verdict: JSN Extension Preview Article

**Article:** "Jaxon Smith-Njigba's Extension Is Coming. Here Are the 4 Paths — and the $33 Million Mistake Seattle Must Avoid."  
**Date:** 2026-03-15  
**Full review:** `content/articles/jsn-extension-preview/editor-review.md`

---

## Verdict: 🟡 REVISE



# Decision: JSN Extension Article Draft Complete — Ready for Editor Review

**Date:** 2026-03-15  
**Decider:** Writer  
**Status:** ✅ Completed  

---

## What Was Decided

The JSN extension preview article draft is complete and saved to `content/articles/jsn-extension-preview/draft.md`. The article synthesizes the four-expert panel discussion (Cap, PlayerRep, SEA, Offense) into a narrative-driven piece following the NFL Lab house style.

**Article specs:**
- **Headline:** "Jaxon Smith-Njigba's Extension Is Coming. Here Are the 4 Paths — and the $33 Million Mistake Seattle Must Avoid."
- **Length:** ~3,200 words
- **Structure:** Hook → 4 paths framework → AAV debate → cost-of-waiting math → Shaheed leverage point → front-loaded structure → verdict ($32–33M, extend now)
- **Tables:** 5 major tables (paths, panel positions, comps, cost-of-waiting, cap structure)
- **Image placeholders:** 4 (cover + 3 section headers)
- **Voice:** Expert disagreement format, data-backed, clear position taken in verdict

---

## Rationale

The panel discussion surfaced genuine tension on the central question: is JSN a Jefferson/Lamb-tier WR ($34–36M) or a tier below ($28–32M)? The article presents both sides (PlayerRep/Cap arguing for full market, Offense arguing for system-amplified discount, SEA prioritizing defense) and lands on a synthesis: $32–33M AAV, front-loaded, extend now.

**Key narrative choices:**
1. **The tier question is the article's core.** Four experts, four AAV ranges. I didn't artificially smooth this into consensus — the disagreement IS the product.
2. **PlayerRep's "Shaheed tipped their hand" insight is positioned as the non-obvious reveal.** Per charter, each expert should surface something readers won't find elsewhere. Shaheed's $17M AAV as JSN's negotiating floor is that hook.
3. **Cap's cost-of-waiting math ($33M more over deal life if you use the option) is the counter-intuitive data point.** It's the reason "extend now" wins despite SEA's defense-first concerns.
4. **Took a clear position in the verdict.** $32–33M AAV, $90M+ guaranteed, front-loaded structure. No hedging. This is what the charter demands.

---

## Open Questions Flagged for Editor

The draft includes a writer note section flagging 7 open questions that need fact-checking:
1. JSN's actual 2025 production numbers (yards, TDs, target share, YAC)
2. Fleury's system context — how much is scheme vs. JSN's skill?
3. Public quotes from Macdonald/front office about JSN's role
4. DK Metcalf's Pittsburgh contract specifics (~$24M/yr claim)
5. WR market 2027 projection (Cap's $36–38M AAV estimate)
6. 5th-year option exact figure for 2027 ($21–23M range given)
7. Shaheed contract structure verification (3yr/$51M, $17M AAV, $34.7M gtd)

These are verification tasks for Editor, not Writer.

---

## Next Steps

1. **Editor reviews the draft** — fact-check open questions, evaluate structure/voice, provide 🔴🟡🟢 feedback.
2. **Revisions if needed** based on Editor's verdict.
3. **Publish pipeline** once approved.

The draft is ready for editorial review.

---

**Recorded by:** Writer  
**File location:** `content/articles/jsn-extension-preview/draft.md`  
**Editor handoff:** Ready now

### Writer → Editor: JSN Extension Article — Revision Complete


# Writer → Editor: JSN Extension Article — Revision Complete

**From:** Writer  
**To:** Editor  
**Date:** 2026-03-15  
**Re:** `content/articles/jsn-extension-preview/draft.md` — Revision pass complete, ready for re-review

---

## Summary

All 3 🔴 must-fix errors have been corrected. Four 🟡 suggestions were addressed. The article's structure, argument, and conclusion are unchanged.

---

## 🔴 Fixes Made



# Decision: JSN Yellow-Item Fixes — Editorial Standards

**By:** Editor  
**Date:** 2026-03-15  
**Affects:** Writer, Lead, all future articles

## What

When source material explicitly flags a data gap (e.g., "we don't have the specific stats"), the editorial standard is:

1. **Narrow vague claims** to the most defensible specific version supported by available data (e.g., "franchise-record receiving numbers" → "franchise-record receiving yardage" when all evidence points to yards).
2. **Add HTML comment placeholders** for missing data rather than inventing or omitting the claim entirely: `<!-- TODO: Add [specific data] when verified -->`.
3. **Use precise competitive descriptors** per project data — "retooling" vs "rebuilding" when a team has significant cap space and draft capital.

## Why

The JSN article's 🟡 items all stemmed from the same root cause: the expert panel worked with "breakout season" as a given without nailing down the underlying numbers. This is likely to recur in future articles where panel discussions outpace verified stat availability. The placeholder pattern lets us publish on time while ensuring nothing falls through the cracks.


---

### 2026-03-16: Batch-Create Generic Article Issues for Remaining Divisions
**By:** Lead (GM/Lead Specialist)
**Status:** Completed
**Affects:** All remaining 28 NFL teams (AFC/NFC divisions)

**What:**
Created 28 GitHub issues (#43–#69) covering every remaining team except NE and SEA, using the same generic template as NFC West batch (#40–#42: ARI, LAR, SF).

**Decision:**
- **Skipped NE** — Joe confirmed already generated; skip to avoid duplicate
- **Skipped SEA** — Home team; not included in NFC West batch either; gets dedicated, non-generic treatment
- **Template:** Generic `IDEA GENERATION REQUIRED` at Depth Level 2 (matches #40–#42 pattern)
- **Labels:** All issues tagged `squad`, `squad:lead`, `article`
- **Issue map by division:**
  - AFC East: BUF #43, MIA #44, NYJ #45
  - AFC North: BAL #46, CIN #47, CLE #48, PIT #49
  - AFC South: HOU #50, IND #51, JAX #52, TEN #53
  - AFC West: DEN #54, KC #55, LAC #56, LV #57
  - NFC East: DAL #58, NYG #59, PHI #60, WAS #61
  - NFC North: CHI #62, DET #63, GB #64, MIN #65
  - NFC South: ATL #66, CAR #67, NO #68, TB #69

**Why:**
Batch issue creation is stable at 28 items (0.5s delay, template loop). Generic template + mandatory idea generation upfront shifts responsibility to runtime (when issue is claimed) instead of creation time. All old-format issues (#9–#39) now superseded by generic pipeline starters. Skipping NE and SEA maintains design consistency.

**Pattern Established:**
Batch issue creation works cleanly for 28+ teams. Generic template enforces idea generation at claim time (Step 1b of Lead's pipeline) rather than creation time, preventing staleness.

---

### 2026-03-16: NFC West Parallel Panel Execution Pattern
**By:** Lead
**Status:** Approved
**Affects:** Article pipeline, batch processing strategy

**What:**
Run NFC West articles in parallel batches (2 articles × 4 agents = 8 simultaneous panel agents) when:
- Both articles are at the same pipeline stage
- Both are Depth Level 2 (same model/token budget)
- No dependency exists between the two articles

**Outcome:**
- Total wall time for 8 agents: ~4 minutes (same as running 4 agents for one article)
- All 8 positions produced were high quality — no degradation from parallelism
- Both syntheses completed with actionable writer briefs

**Reusable Pattern:**
When multiple articles in the same division are at the same pipeline stage, batch them:
1. Create all discussion prompts first
2. Spawn all panel agents simultaneously (up to 8 tested successfully)
3. Wait for all to complete
4. Write syntheses sequentially (Lead needs to read all positions for each synthesis)

**Why:**
Parallel execution is cost-neutral (no token discount) but saves wall-clock time significantly. Division-specific batching leverages shared domain context (all agents understand NFC West landscape). No context window pressure — agents are stateless and independent.

---

### 2026-03-16: Idea Generation Must Use Top Model + Current Data
**By:** Lead
**Status:** Implemented
**Critical:** Yes

**What:**
Issues must be generic triggers. Idea generation must happen as the FIRST STEP of the pipeline using a top model with real research.

**Root Cause of Old Problem:**
1. Batch issue creation asked Lead to generate 30 ideas all at once
2. Lead used cheaper model to save tokens without fetching current data
3. Model relied on training data (last updated mid-2025 at best)
4. Stale angles got committed to GitHub issues, locking in wrong assumptions
5. Example failures: QB situations referenced wrong year, cap figures from wrong offseason, "Year N" framing for Year N+1 players

**Implementation:**
1. **Model Requirement:** ALWAYS use `claude-opus-4.6` for idea generation (non-negotiable)
2. **Current Data Requirement:** MUST fetch current data (OTC, ESPN, web_search) before generating any angle
3. **Year Accuracy Gate:** Confirm 2026 offseason context, 2025 season stats, 2026 cap year
4. **Process Integration:** New generic issue template (`.squad/templates/team-article-issue.md`), issue says "IDEA GENERATION REQUIRED", Lead runs Step 1b (read skill → fetch data → generate → post comment → continue)

**Files Updated:**
- `.squad/skills/idea-generation/SKILL.md` — Mandates top model + current context
- `.squad/agents/lead/charter.md` — Added Step 1b to pipeline protocol
- `.squad/templates/team-article-issue.md` — New generic template
- `.squad/skills/article-lifecycle/SKILL.md` — Documented GitHub Issue-Triggered idea generation

**Pattern Established:**
**Idea generation is NOT a bulk batch task.** It's a research-intensive, current-data-dependent task that must happen just-in-time before each article starts. Never: "Generate 30 team ideas up front". Always: "Trigger 30 issues with 'IDEA GENERATION REQUIRED' and let Lead research each individually as Step 1 of pipeline".

---

### 2026-03-16: Article Process Guards — Temporal Accuracy + TLDR Requirement
**By:** Lead (Joe Robinson directive)
**Status:** Implemented
**Critical:** Yes

**What:**
Add three accuracy gates to the article lifecycle:

**Gate 1: Temporal Accuracy**
- All panel agent spawns MUST include season context block: current NFL year (2026), most recent completed season (2025), upcoming season (2026)
- All stats cited = 2025 season unless noted as historical
- All cap figures = 2026 cap year
- Coaching staff = who is actually coaching in 2026
- Year N framing accurate (e.g., QB drafted 2024 = entering Year 3 in 2026)

**Gate 2: TLDR Present**
- Article structure template MUST include TLDR callout block after subtitle
- TLDR format: 4 bullets (situation, assets, verdict, debate)
- Editor MUST verify presence and accuracy before approval

**Gate 3: Player/Staff Name Accuracy**
- All player/coach names verified against current rosters
- Draft prospects verified as real 2026 prospects
- Contract figures sourced (OTC/Spotrac citation required)

**Root Cause:**
Drake Maye article ("Year 2 Decision Time") shipped with:
1. Temporal accuracy failure — framed Maye as Year 2 entering Year 3, panel used wrong season context
2. Missing TLDR — 3,500+ word article published without quick-scan summary

**Files Updated:**
- `.squad/skills/substack-article/SKILL.md` — Added TLDR to structure + Temporal Accuracy subsection
- `.squad/skills/article-lifecycle/SKILL.md` — Added "Accuracy Gates" section (stages 6-7)
- `.squad/agents/editor/charter.md` — Added "Temporal Accuracy Checklist" to fact-checking

**Why:**
Temporal accuracy is non-negotiable. Readers who follow NFL closely will catch "Year 2" for a Year 3 player instantly. TLDRs drive engagement — busy readers scanning the site need 15-second answer to "Is this article for me?". Name accuracy protects credibility — one invented name undermines trust in everything else (contract projections, scheme analysis, etc.).

**Expected Impact:**
- Zero temporal accuracy errors (panel agents work from current context)
- 100% TLDR presence (Editor gate enforces before publish)
- Name verification as routine checklist

---

### 2026-03-16: Substack Section Routing Fix — `section_chosen: true`
**By:** Lead (debugging task from Joe Robinson)
**Status:** Implemented
**Affects:** `.github/extensions/substack-publisher/extension.mjs`

**What:**
Fixed Substack publisher extension's section assignment for drafts. Root cause: missing `section_chosen: true` field in PUT request.

**Changes:**
1. PUT body minimized: Changed from spreading full draft payload to minimal body with only section fields: `{ section_id, draft_section_id, section_chosen: true }`
2. Verification GET added: After PUT, fetch persisted draft to confirm `draft_section_id` and `section_chosen` saved
3. Integer coercion added for `sectionId` safety
4. Output enhanced to show GET verification results including `section_chosen` status

**Key API Finding:**
Substack's draft editor checks `section_chosen === true` before displaying section in UI dropdown. Without this flag, `draft_section_id` is stored but editor treats it as unset. Old code never sent `section_chosen`, so every draft appeared to have no section despite API confirming ID.

**Verification:**
Test draft 191082679 (NE Patriots, section 355520) confirmed via GET: `draft_section_id: 355520, section_chosen: true`.

---

### 2026-03-16: Drake Maye Article Fact Corrections — Year 3 Reframe
**By:** NE (New England Patriots Expert)
**Status:** Completed
**Affects:** `content/articles/ne-maye-year2-offseason/draft.md`

**What:**
Comprehensive fact-check and rewrite of Drake Maye offseason article. Article was written using 2024 (Year 1) data but Maye just finished his 2nd season (2025). All content updated to reflect Year 3 framing (2026 offseason).

**Critical Corrections:**
- "just finished a rookie season" → "just finished his sophomore campaign"
- 66.6% comp, 2,276 yds, 15 TDs → 72.0% comp, 4,394 yds, 31 TDs, 8 INTs
- PFF OL graded "worst in NFL" → improved from 32nd to ~6th after additions
- "#4 overall pick" → "#31 overall pick" (14-3 record, Super Bowl runner-up)
- "new head coach in Mike Vrabel" → "coaching staff entering Year 2"
- All "Year 2" references for upcoming season → "Year 3"
- $73.5M cap projection → $92M (per OTC)

**Major Rewrites:**
1. Intro/Hook — reframed from "unproven rookie" to "MVP-caliber sophomore post-SB loss"
2. The Situation — OL from "worst" to "dramatically improved", WR from "bare cupboard" to "partially addressed"
3. Cap Math — acknowledged completed FA moves (Doubs, AVT, Jones, Byard), updated remaining scenarios
4. Draft Board — complete rewrite from #4 pick logic to #31 pick logic, trade-down to trade-up math
5. Debate sections — WR debate (Doubs already signed), pick debate (#31 context), Year 3 framing
6. Verdict Blueprint — updated targets for #31 context

**Added Content:**
- TLDR callout box (4 bullets)
- Maye's 113.5 passer rating, 77.1 QBR, 2nd-team All-Pro, MVP consideration
- 14-3 record, Super Bowl LX loss to Seattle 29-13
- Post-FA spending breakdown with cap hits
- 11 total draft picks context
- Updated AFC East: MIA released Tua, NYJ 3-14, BUF fired McDermott

**Verified As Correct:**
- ~$44M cap space (OTC: $43.9M)
- $301.2M salary cap
- $10M Maye cap hit
- $33.7M dead money total
- Dugger ($12.2M), Diggs ($9.7M), Peppers ($3M)
- Mike Vrabel HC, Josh McDaniels OC
- All 4 draft prospects are real 2026 prospects

**Impact:**
Article title remains accurate. Slug (`ne-maye-year2-offseason`) unchanged per instructions.

---

### 2026-03-16: Cardinals Article Draft Structure
**By:** Writer
**Article:** Arizona Cardinals 2026 Offseason (#40)
**Status:** Draft complete, pending Editor review

**What:**
Structured the Cardinals article around the QB timing disagreement as central tension rather than dead-cap or #3 pick evaluation. Cap's "dead cap as receipt" reframe and Offense's "Lamborghini on regular unleaded" urgency create narrative engine. Verdict endorses Draft's two-step plan (Bain at #3 + trade back for Simpson) with Offense's shorter leash on Brissett as modifier.

**Rationale:**
- Dead-cap angle is obvious but one-section story
- QB timing gives every expert distinct lane
- ARI's trade-down dissent preserved as honest outlier
- Cap's Path D (wait until 2027) presented as strongest counterargument

**Editor Watch Items:**
LaFleur's title chain (OC → HC), Simpson's start count, 2027 QB class eligibility, Harrison Jr. CBA extension timeline. Eight items flagged in writer notes.

---

### 2026-03-16: Substack publishing — sections removed, tags adopted

**By:** Lead (on behalf of Joe Robinson)
**Status:** Implemented

**Decision:** Stop assigning Substack sections during publish. Stop sending `draft_bylines` (was breaking). Instead, tag each post with:
1. The team name (full, e.g. "San Francisco 49ers")
2. Any specialist agents who contributed artifacts (e.g. "Cap", "Offense", "Defense")

**Rationale:**
- Per-team sections are not the correct Substack taxonomy for this publication
- `draft_bylines` payload was causing publish failures
- Tags provide flexible, additive categorization without the rigidity of sections

**Tag convention:**
- Team tag: full NFL team name as provided or auto-detected from `pipeline.db`
- Specialist tags: derived from article directory filenames (`{role}-position.md`, `{role}-panel.md`, etc.), title-cased
- Team agent files (identified by NFL abbreviation prefix) are excluded from specialist tags

**Implementation:**
- `getSectionId()`, section PUT/verify, and `draft_bylines` removed from extension
- `postTags` array added to draft creation payload
- `deriveTagsFromArticleDir()` scans article directory for specialist artifacts
- Success output now reports tags instead of section status
- All related skill docs updated

**Affects:** Publisher extension, substack-publishing skill, publisher skill, substack-article skill, article-lifecycle skill

### 2026-03-17: README.md Documentation Update — Publishing Behavior

**Date:** 2026-03-17  
**Decision Maker:** Lead (Joe Robinson directive)  
**Category:** Documentation Accuracy

**Problem:**
README.md lines 139–141 contained stale language describing automated Substack publishing behavior:
- "routed to the correct team section" — implied automatic per-team section assignment
- Missing description of actual tag-based publishing
- No mention of specialist agent tags

These descriptions no longer matched the operational publishing model after the sections→tags migration (2026-03-16).

**What Changed:**

Old language (L139–L141):
\\\
- [x] **Automated publishing** — `publish_to_substack` Copilot extension creates Substack drafts directly from article markdown files, routed to the correct team section
- [x] **MCP servers / extensions** — `publish_to_substack` Copilot extension (`.github/extensions/substack-publisher/`) enables automated Substack publishing
- [x] **32-team sections** — All NFL teams have dedicated Substack sections with official brand colors on both `nfllab` and `nfllabstage`
\\\

New language (L139–L141):
\\\
- [x] **Automated publishing** — `publish_to_substack` Copilot extension creates Substack drafts directly from article markdown files, tagged with team + specialist tags for categorization
- [x] **MCP servers / extensions** — `publish_to_substack` Copilot extension (`.github/extensions/substack-publisher/`) enables automated Substack publishing with tag-based routing
- [x] **32-team sections** — All NFL teams have dedicated Substack sections with official brand colors on both `nfllab` and `nfllabstage`
\\\

**Rationale:**
1. **Section routing removed:** The publisher extension no longer assigns drafts to per-team sections. Tags are the organizing mechanism.
2. **Tag-based categorization:** Drafts now carry two types of tags:
   - Team tag (full team name, e.g. "San Francisco 49ers")
   - Specialist tags (agent roles from panel, e.g. "Cap", "Offense", "Defense")
3. **No bylines:** Old code had broken `draft_bylines` logic. This is now cleared entirely.
4. **Accuracy:** README is team-facing documentation. Stale language misleads future contributors about the actual publishing behavior.

**Impact:**
- **Low risk:** These are documentation lines only. No code changes. README describes behavior that already changed.
- **High value:** Prevents future confusion about publishing workflow.
- **Scope:** Minimal edit (3 lines, same section, no roadmap/status changes elsewhere).

**Files Changed:**
- `README.md` — lines 139–141 updated

**Decision:**
✅ **APPROVED** — Update README to reflect current tag-based publishing behavior. Minimal, surgical change with high accuracy impact.

### 2026-03-16: AFC East Batch Progress — Issues #43, #44, #45
**By:** Lead (Danny)
**Status:** In-progress
**What:** Processed the AFC East batch (BUF, MIA, NYJ) using the idea-generation-first workflow. Advanced MIA (#44) as the strongest article (12/12 score) through to panel-ready stage. BUF (#43) and NYJ (#45) remain at `stage:idea`. Added `stage:idea`, `stage:discussion-prompt`, `stage:panel-ready` labels to the repo.
**Why:** MIA's $99.2M dead cap story is a historic NFL event — unprecedented financial constraints, new regime, full roster teardown. It has natural tension and broad appeal. BUF and NYJ are strong but more conventional; they benefit from waiting for MIA to validate the pipeline. 3-agent panel (Cap + MIA + Draft) is tight and non-overlapping.

### 2026-03-17: Fix draft_bylines in Substack publisher extension
**By:** Lead (Danny)
**What:** Add `draft_bylines: []` to the POST payload in `createSubstackDraft()` in `.github/extensions/substack-publisher/extension.mjs`. The API requires this field to be present — omitting it entirely triggers an HTTP 400 validation error.
**Why:** Discovered during republishing of NE Patriots / Drake Maye article. No functional change to draft behavior (empty bylines = Substack uses account default).

### 2026-03-17: Social Link Image — Backlog Tracking (Issue #70)
**By:** Lead (Danny)
**Status:** Recorded
**Affects:** Writer, Editor, image generation pipeline
**What:** Created GitHub issue #70 to track future work on social link image (Open Graph / `og:image`) generation and consistency across Substack articles. No `squad` labels — backlog only, unassigned. Joe identified the Witherspoon v2 social link preview image as the preferred style reference.
**Why:** Social link previews (Twitter/X cards, LinkedIn, iMessage, Slack) are the first visual impression for shared articles. Consistent, high-quality social image style improves click-through and brand consistency. Future work — no immediate action required.

### 2026-03-17: Witherspoon Article Refresh — Process & Artifact Structure
**By:** Lead (Danny)
**Status:** Informational
**What:** Regenerated the Witherspoon extension article (Article #2, originally published 2026-03-14) using the full current pipeline. Reconstructed discussion prompt from original article, spawned 3-agent panel (Cap, PlayerRep, SEA) with fresh positions, produced complete v2 draft. All 6 artifacts saved to `content/articles/witherspoon-extension-v2/`. Original article preserved as archive. Removed all WA tax legislation references per post-v1 content constraint; replaced with football/business arguments. Panel convergence tighter than v1 ($30.5–32.5M range vs. original $27–33M).
**Why:** Pre-pipeline articles can be retroactively structured. The published article serves as the source artifact when no pipeline files exist. Pattern established for future retroactive pipeline runs.

### 2026-03-16: Houston Interior DL — Dual-Role Draft Strategy
**By:** Defense (Defensive Scheme Expert)
**Status:** Proposed
**Priority:** Medium
**Affects:** HOU team agent, Draft agent, Cap agent, Lead

**What:**
Houston's 2026 DT crisis requires drafting for **two distinct scheme roles**, not just "best available DT":

1. **1-tech anchor** (295-315 lbs): Two-gap nose who absorbs doubles, keeps linebackers clean, allows light boxes. Fatukasi departure is structural crisis.
2. **Attacking 3-tech** (290-305 lbs): B-gap penetrator who collapses pockets, wins on stunts, generates interior pressure in low-blitz scheme.

**The constraint:** Cannot draft both roles in Round 1. Must prioritize.

**Recommendation:** Draft 1-tech anchor at pick 28 (Deone Walker if available, Alfred Collins if not), then target attacking 3-tech at pick 38/59 (Christen Miller, Peter Woods). Rationale: Anderson/Hunter can carry pass rush; they cannot carry run defense without a nose.

**Why:**
DeMeco Ryans' 4-3 under scheme *requires* a true 1-tech to function. Houston's No. 1 defense in 2025 succeeded because Fatukasi did unglamorous work that let the scheme stay structurally sound. Missing this role forces Houston to add safety to box → breaks preferred two-high shell → exposes Stingley/Lassiter on islands more often.

**Decision Point:**
When evaluating defensive needs, always map prospects to **specific scheme roles**, not just positional labels. "DT" is too broad — 1-tech and 3-tech are different positions with different production profiles and draft target pools. This applies league-wide, not just Houston.

**Follow-Up:**
Draft agent should build scheme-role-specific target boards for all teams with interior DL needs (not just generic "DT prospects"). Cap agent should model cost differential between drafting vs. FA patching for 1-tech anchors (rare and expensive in FA).


# Defense Panel Position — Detroit Lions EDGE at #17

**Date:** 2026-03-16  
**Agent:** Defense  
**Article:** Detroit Lions 2026 Offseason  
**Position Type:** Scheme Fit Analysis

---

## Core Position

Detroit should prioritize **EDGE at #17** over OT, with **Keldric Faulk (Auburn)** as the preferred target.

## Reasoning

### 4. Branch/Joseph Uncertainty — Defensive Function Impact

Branch's Achilles (targeting midseason return) and Joseph's chronic knee create schematic constraints:

- Without Branch, Detroit loses coverage flexibility; man-heavy looks become predictable
- Without Joseph's range, underneath aggression must be tempered
- Both uncertain = the defense cannot mask pass-rush weakness through coverage

This elevates EDGE priority. The pass rush must be reliable if the secondary starts compromised.

## Verdict

**EDGE at #17 (Faulk) > OT + EDGE later.**

The margin for error is too thin. Detroit's window is still open, but the path through it runs directly through Hutchinson's ability to function without absorbing constant doubles. Faulk solves this. OT is addressable via FA or Round 2 OT prospects; starting-caliber EDGE opposite Hutchinson is not.

---

**Confidence:** High  
**Dependencies:** Faulk available at #17; no major FA EDGE signing before draft

---
date: 2026-03-16
agent: DEN
article: den-2026-offseason (issue #54)
stage: panel-discussion
decision_type: panel-position-stance
status: filed
---



# Decision: DET Article Angle for Issue #63

## What
DET agent generated the article angle for issue #63 (Detroit Lions 2026 Offseason):

**Working Title:** "The Lions Have $200 Million in Elite Talent. They're One Pick Away From Wasting All of It."

**Angle:** Championship window framing — elite core locked up on megadeals, but 9-8 regression exposed structural gaps (EDGE, LT, coordinator turnover). Pick #17 (EDGE vs. OT) is the fulcrum that determines whether the window reopens or closes.

## Why This Angle
- EDGE need is consensus #1, but the "one pick from wasting $200M" framing is fresh and visceral
- Connects coordinator brain drain (3 OCs in 3 years), roster holes, and injuries into one strategic narrative
- Ben Johnson coaching rival CHI adds unique NFC North tension
- Scored 11/12 on idea-generation rubric

## Artifacts Created
- `content/articles/det-2026-offseason/idea.md`
- `content/articles/det-2026-offseason/discussion-prompt.md`

## Stage Progression
- Stage 1 (Idea Generation): ✅ Complete
- Stage 2 (Discussion Prompt): ✅ Complete
- Stage 3 (Panel Composition): Ready — suggested DET, Cap, Defense, Draft (4 agents)

## For Lead
Panel composition is drafted in the discussion prompt. Ready for Lead to finalize and spawn agents for Stage 4.


# Decision Record: HOU Panel Position — DT Talent Cliff Strategy

**Date:** 2026-03-16  
**By:** Draft (NFL Draft Expert)  
**Article:** HOU - Houston Texans — 2026 Offseason  
**Status:** Proposed  
**Affects:** HOU team agent, Cap, Defense, Writer  

---

## What

Houston's 2026 draft strategy must account for a **DT talent cliff after pick 30**. Peter Woods (Clemson) and Caleb Banks (Florida) are consensus top-2 DTs, both projected picks 15-25. Christen Miller (Georgia) is the next tier, but he's 10-15 picks below Woods/Banks in value. If both Woods and Banks are gone at pick 28, Houston faces:

1. **Reach for Miller at 28** — overdraft by ~10 picks, but secure a safe Day 1 starter
2. **Wait until 38** — draft BPA (Sonny Styles, LB) at 28, hope Miller lasts to 38
3. **Trade up from 28 to 20-25** — costs pick 59 or 69, guarantees Woods or Banks

**Recommendation:** If Houston's DT board is Woods > Banks > 15-pick gap > Miller, **trade up** is the value play. Giving up pick 59 to jump from 28 to 23 and secure Banks is cheaper than paying $18M/yr for a veteran DT in 2027 free agency.

---

## Why

- **Extension window compression:** Stroud and Anderson's extensions hit in 2027-2028. Every position Houston doesn't address in the 2026 draft becomes a cap crisis when the QB/EDGE extensions consume 35%+ of the cap.
- **DT is crisis-level:** Lost Settle and Fatukasi in FA, Rankins is 31 and on a 2-year deal. If Houston doesn't draft a starting DT in 2026, they'll be shopping the 2027 FA market at premium prices.
- **Prospect quality cliff:** Woods and Banks are first-round talents. Miller is a late-1st/early-2nd talent. The gap is real. Waiting from 28 to 38 risks settling for a lesser player.
- **Trade-up cost-benefit:** A trade from 28 to 23 costs ~200 points (JJ chart). That's approximately pick 59 (310 points). But a veteran DT in 2027 FA costs $15-20M/yr. Over 3 years, that's $45-60M vs. a rookie DT on a 4-year/$15M deal. The draft capital cost is negligible compared to the cap savings.

---

## Team-Level Implications

- **HOU:** Must decide if DT is worth a trade-up. If yes, targets are picks 20-25 (where Woods/Banks likely land). If no, must accept either a reach at 28 (Miller) or risk waiting until 38.
- **Cap:** Trade-up scenario means fewer Day 2 picks to fill depth. But it secures a cost-controlled DT starter for 4 years, which is critical when extensions hit.
- **Defense:** DeMeco Ryans' 4-3 scheme needs both a 1-tech (run-stuffer) and a 3-tech (pass-rusher). Woods can do both. Banks leans 1-tech. Miller is pure 1-tech. The scheme fit matters.
- **Writer:** The trade-up framing is a strong narrative angle — "Houston is so desperate for DT help that they're willing to mortgage Day 2 picks to secure a franchise interior lineman."

---

## Next Steps

1. **Writer:** Verify Houston's OT depth chart (Tunsil/Howard starter status) to assess how critical pick 59 is for OT depth.
2. **Cap:** Model the "cost of waiting" — what's the 2027 FA market for 1-tech vs. 3-tech DTs? Is $18M/yr the floor or ceiling?
3. **Defense:** Confirm Ryans' 1-tech vs. 3-tech usage rate. Does he play two 1-techs (Rankins + rookie) or does he need a 3-tech pass-rusher?
4. **HOU:** Decide if trade-up is on the table. If yes, identify trade partners (teams at picks 20-25 willing to move back).

---

## Validation

- ✅ Woods and Banks are consensus DT1 and DT2 (verified via PFF, CBS, Athlon Sports, BNB Football)
- ✅ Miller is consensus late-1st/early-2nd (verified via same sources)
- ✅ Houston's picks are 28, 38, 59, 69 (verified via NFL Mock Draft Database, ESPN, Sporting News)
- ✅ Stroud/Anderson extension timeline is 2027-2028 (verified via Pro Football Rumors, Red94, CBS Sports)
- ✅ Settle/Fatukasi departures and Rankins re-sign confirmed (verified via Click2Houston, Clutch Points)

---

**Recommendation:** Publish this decision to `.squad/decisions.md` after panel synthesis. This is a high-stakes strategic call that affects Houston's 2026-2029 roster construction.

### 2026-03-16: Injury panel position — Seahawks RB Pick #64 v2
**By:** Injury (Injury Analysis Expert)
**Status:** Proposed
**Affects:** SEA team agent, CollegeScout, Offense, Writer, Lead
**Issue:** #71

**What:**
1. **Charbonnet Week 1 probability is ~35-45%** — late-season ACL (IR Jan 23) puts surgery-to-Week 1 at ~7.5-8 months, short of the 10-12 month RB-typical return window. Even if active, expect diminished burst through October.
2. **Price's Achilles is no longer an elevated risk** — 4 years post-surgery, 41 games, zero recurrence. Risk tier remains 🟡 MODERATE. The draft discount is shrinking as teams complete their own physicals — may be only 5-15 picks by draft day vs. 15-30 estimated in v1.
3. **Robinson >> Mostert for the veteran bridge** — Robinson (26, 🟢 LOW risk, 43/48 starts over 3 years) is the clear medical choice. Mostert (34, 🟠-🔴 risk, ACL history + multiple knee procedures) stacks injury risk on top of injury risk.
4. **Composite medical urgency for RB: 🟠 MODERATE-HIGH** — not a crisis, but a coin-flip Week 1 for your RB1 plus insufficient backup depth demands meaningful action (draft pick, veteran, or both).

**Why:** The entire v1 article thesis rests on two medical interpretations (Charbonnet urgency + Price discount). v2 must refresh both. The Charbonnet timeline is tighter than v1 implied; the Price discount is smaller than v1 assumed. Both adjustments sharpen the recommendation without changing it.

**Key disagreement flags:**
- SEA may deprioritize RB given CB/EDGE losses — Injury pushes back on underweighting a coin-flip RB1 timeline
- CollegeScout may say Price won't be available at #64 if discount compresses — Injury agrees this is plausible
- Offense may say Wilson/Holani can bridge — Injury says the insurance math doesn't support it for a defending champion



# Decision: JAX Panel Position — Hunter Workload Framework

**Agent:** JAX (Jacksonville Jaguars Expert)
**Date:** 2026-03-16
**Issue:** #52 — JAX 2026 Offseason Article
**Stage:** 4 (Panel Discussion)

---

## Decision Made

Recommended a **55/25 offense-heavy snap split** for Travis Hunter in Year 2, grounded in Year 1 workload data and injury causation analysis.

---

## Context

Panel question: "How should JAX deploy Hunter in Year 2 given his LCL recovery, the 13-4 baseline, and the roster holes? What's the realistic snap split?"

**Year 1 reality:**
- Hunter played 67% offensive snaps + 36% defensive snaps = **103% combined snap rate**
- LCL injury after 7 games ended his season
- Graded 82 PFF at WR, 71 PFF at CB — better at offense

---

## Rationale

1. **Workload sustainability:** 103% snap rate broke him. 80% total (55% offense + 25% defense) is sustainable.

2. **Skill allocation:** Hunter is currently a better WR than CB. Lean into strength while CB technique develops.

3. **Scheme fit:** Udinski's 3WR offense unlocks when Hunter plays WR2 opposite BTJ — creates single coverage opportunities.

4. **BTJ analysis:** Target share data shows Hunter reduced BTJ's targets by only 0.7/game. Slump is coverage adjustment, not cannibalization. Hunter helps BTJ by forcing defenses to respect both perimeters.

5. **Roster hole compensation:** Missing 2026 1st-round pick (#19) hurts, but Hunter's dual value compensates if he stays healthy. Round 2/3 picks (Benson at RB, Jacobs at LB) + bargain CB2 FA can fill gaps.

---

## Hardest Tradeoff Identified

**Hunter's workload ceiling vs. JAX's contention timeline.**

The two-way experiment only works if Hunter is available for 17 games. But keeping him healthy means accepting he'll never be a full-time All-Pro at either position — always part-time on both sides. The bet: "part-time elite at two positions" > "full-time elite at one position." The LCL injury proves the margin for error is razor-thin.

---

## Reusable Pattern

**Two-way player workload framework:**
1. Identify total sustainable snap % (typically 75–80% for injury prevention)
2. Grade player's current skill level at each position
3. Allocate snaps toward higher-graded position (offense-heavy or defense-heavy)
4. Monitor in-season snap creep — pull back if exceeding sustainable threshold
5. Role identity clarity: pick "WR who plays CB in sub-packages" vs. "CB who plays WR" — don't try to be 50/50

This framework applies to any future two-way player analysis (though Hunter is currently the only NFL example).

---

## Implications

- **For Writer:** The 55/25 split provides a concrete deployment plan to build article narrative around
- **For Defense panel:** They'll want more Hunter snaps on defense — this creates natural panel tension
- **For Offense panel:** They'll argue Hunter should play even more offense — also creates tension
- **For Cap panel:** They'll evaluate whether the trade cost (4 picks including 2026 1st) was worth a part-time player

---

## Files Created

- `content/articles/jax-2026-offseason/jax-position.md` — full panel position (10.5 KB)
- Discussion prompt and panel composition already existed (created by Lead agent in earlier stage)

---

## Next Steps

- Wait for Cap, Defense, and Offense panel positions
- Writer synthesizes all four positions into article draft
- Editor fact-checks and polishes

---

## Tags

`#panel-position` `#workload-management` `#two-way-player` `#hunter` `#jax` `#issue-52`

---
agent: KC
context: Panel position for "Mahomes Is Racing Back — But to What?" article
date: 2026-03-17
status: filed
---



# Decision: Three Coin Flips Framework for Roster Evaluation

## What I Decided

When evaluating roster construction with multiple interdependent variables, frame the analysis as "coin flips" — binary outcomes where the entire projection hinges on all flips landing favorably.

For KC's 2026 roster:
1. **Mahomes Week 1 at 90% mobility** (post-ACL recovery on schedule)
2. **Rashee Rice suspension ≤6 games** (not 10-12 game ban)
3. **Both first-round picks hit immediately** (WR at #9, CB at #29 start Week 1)

**If all three hit:** AFC Championship ceiling (11-6, wild card → divisional → AFCCG path)
**If one flips wrong:** Wild card exit (10-7)
**If two flip wrong:** No playoffs (9-8)

## Why This Matters

Traditional roster grading uses linear projections ("better at RB, worse at CB, net neutral"). But that obscures **cascading dependencies** where one failure triggers multiple position failures.

Examples from KC's 2026 roster:
- If Rice suspended 10+ games AND rookie WR doesn't start → bottom-5 receiving corps → Mahomes can't operate Reid's scheme → OL pressures increase → post-ACL knee at risk
- If CB pick doesn't start AND Mahomes mobility limited → defense gets exposed → offense must score 30+ per game → unsustainable

The coin flip framework forces you to:
1. Identify the 2-4 genuinely binary outcomes (not gradients)
2. Map the cascading consequences of each flip landing wrong
3. Give honest probabilities to each scenario
4. Avoid "most likely case" bias (averaging away the realistic extremes)

## When to Use This Again

- Any roster with a recovering star player + multiple draft-dependent positions
- Offseasons where cap constraints force "draft or bust" at 2+ positions
- Teams betting on aging veterans having "one more year" at multiple positions simultaneously

## When NOT to Use This

- Stable rosters with few question marks (nothing is truly binary)
- Articles where the uncertainty IS the story (don't resolve it with probabilities)
- Fan-facing content (Level 1) — coin flips are analyst framing, not casual fan framing

---
date: 2026-03-16
agent: LAC
context: issue-56-stage-advancement
status: implemented
---

### 2026-03-17: Ralph board reconciliation rule
**By:** Lead
**Status:** Proposed
**Affects:** Ralph, Lead, Writer, Editor

**What:**
- During Ralph board sweeps, treat local article artifacts under `content/articles/` and any editor/publish evidence as the source of truth over stale issue comments or `stage:*` labels.
- Do **not** close an article issue unless publish evidence exists (for example: published pipeline state, Substack URL, or equivalent local publish proof). A completed draft or even an approved editor review is not enough by itself.
- If the current label set cannot represent the true late-stage state, remove obviously stale stage labels and leave a reconciliation comment that names the exact local artifacts and the next concrete step.

**Why:**
The board is lagging behind the filesystem. Several article issues still read as panel-stage work even though local folders already contain drafts and editor reviews. Using repo artifacts as ground truth prevents duplicate work while keeping closure conservative and accurate.

### 2026-03-16: Article Versioning — Witherspoon v2 Published + RB v2 Tracked
**By:** Lead (Lead Orchestrator)
**Status:** Executed
**Affects:** Writer, Editor, SEA team agent, article pipeline

**What:**
1. **Witherspoon v2** published to Substack as a new draft (Draft ID: 191097519). The original v1 (`content/articles/witherspoon-extension-cap-vs-agent.md`, Draft ID 191061865) is preserved. v2 lives at `content/articles/witherspoon-extension-v2/draft.md` with updated panel positions and refined analysis.
2. **Seahawks RB Pick #64 v2** — GitHub issue #71 created to track regeneration of Article #1. The original (`content/articles/seahawks-rb1a-target-board.md`) was published 2026-03-14 without Editor review. v2 will re-run the panel with current data, apply Editor review, and publish as a separate Substack draft.

**Why:**
- Witherspoon v2 incorporates McDuffie comp, tighter synthesis, and current article conventions (TLDR block, no inline byline, tags).
- RB article is the only published piece that never went through Editor — quality gate compliance requires a v2.
- Versioning preserves originals (readers who bookmarked v1 links are unaffected) while allowing iterative improvement.

**Convention established:** Article regenerations get a `-v2` directory suffix and a GitHub issue with "v2 Regeneration" in the title. Original files are never overwritten.



# Decision: Issue #68 Panel Composition — Excluding Defense from Saints Bridge Year Article

**Date:** 2026-03-16  
**Agent:** NO (New Orleans Saints Expert)  
**Issue:** #68 — "Bridge Year or Burial? The Saints' $114M Dead Money Gamble on Tyler Shough"  
**Decision Type:** Panel composition (team-relevant)

## Context

Issue #68 is a Saints 2026 offseason article examining whether the team is building toward 2027 contention or just surviving 2026 under $114M dead money. The discussion prompt suggested a 3-4 agent panel: NO + Cap + Offense, with Draft as optional 4th.

The Saints have clear defensive needs (CB2 after losing Alontae Taylor, EDGE after Cameron Jordan's likely exit), and "Roster construction" articles typically include Defense according to the Panel Selection Matrix in `.squad/skills/article-lifecycle/SKILL.md`.

## Decision

**Exclude Defense from the core panel.** Panel composition: NO + Cap + Offense (3 core agents), with Draft as optional 4th.

## Rationale

1. **Defensive gaps are symptoms, not the core tension.** The article's central question is "Is the front office building a 2027 contender or just surviving 2026?" The CB2 and EDGE holes exist **because of the $114M dead money constraint**, not because of scheme failures or talent evaluation mistakes. Defense would tell us "CB2 is a hole" — which we already know from NO's depth chart analysis.

2. **Defense doesn't add a distinct angle.** The three critical questions for this article are:
   - Can the Saints build around Shough while cap-strapped? (Cap's angle)
   - What's the realistic ceiling for this roster in 2026? (NO's angle)
   - Does Kellen Moore's offense need a WR at #8, or can it win with current weapons? (Offense's angle)
   
   Defense doesn't answer any of these questions in a way that NO (depth chart gaps) or Draft (positional evaluation at #8) can't already cover.

3. **Depth Level 2 = 3-4 agents max.** Adding Defense would push us to 4 core agents, crowding out the optional Draft spot. Draft is more valuable than Defense for this article because the #8 pick decision (WR vs. CB vs. EDGE) is a key 2026 move that determines whether the bridge year succeeds.

4. **If defensive analysis is needed, NO can provide it.** NO owns the Saints' depth chart, knows the CB2 and EDGE gaps, and can evaluate whether the #8 pick should address defense. Defense's specialized expertise (scheme fit, coverage concepts, pass rush technique) isn't required for a bridge year roster construction article.

## Implications for Future Articles

This decision establishes a principle: **Don't add an agent just because the topic touches their domain. Add an agent when they bring a distinct angle that can't be covered by the existing panel.**

For Saints defensive-focused articles (e.g., "Can the Saints' 3-4 scheme survive without Demario Davis?"), Defense would absolutely be on the panel. But for this bridge year article, Defense is redundant.

## Validation

Panel composition follows established patterns:
- ✅ 3 core agents (NO + Cap + Offense) within Depth Level 2 limits (min 3, max 4)
- ✅ Team agent included (NO)
- ✅ At least one specialist (Cap + Offense)
- ✅ Each agent has a distinct question
- ✅ Coverage check confirms all article components are addressed

---

**Status:** Panel composition complete. Issue #68 advanced to `stage:panel-ready`.  
**Next step:** Lead spawns 3-agent panel for Stage 4 discussion.

---
type: "article-angle"
agent: "nyg"
issue: 59
article_id: "nyg-2026-offseason"
status: "approved-by-agent"
created: "2026-03-15"
---



# Decision: NYJ Panel Position — Two Bites at the Apple

**Date:** 2026-03-15
**By:** NYJ (New York Jets Expert)
**Article:** nyj-two-firsts-qb-decision
**Status:** Filed

## Recommendation

**Path 1 — Mendoza at #2, Best Defender at #16.**

Take the quarterback now. The Jets' 20-year QB drought is the franchise's defining failure. Waiting for the 2027 class is the NFL's most repeated mistake. Mendoza's pocket-passer profile fits Frank Reich's scheme, Geno Smith bridges Year 1, and #16 addresses the CB1 emergency created by the Sauce Gardner trade.

## Hardest Tradeoff

Spending #2 overall on a non-consensus QB in a "thin" class — with full knowledge that Bortles, Rosen, and Darnold were all early picks in similarly thin classes who busted. If Mendoza misses, the Jets have burned their best draft asset in a decade and validated the "wait for 2027" argument.

## Key Roster Findings

- Teardown is 80% coherent but the Hall franchise tag ($14.3M) and Fitzpatrick acquisition ($15.6M) contradict rebuild logic
- CB1 is a genuine scheme emergency — Glenn's press-man identity requires a corner the roster doesn't have

---

### 2026-03-16: Stage 7 → Prod Draft Promotion & Final Reconciliation
**By:** Lead (Production Specialist)
**Status:** Implemented
**Date:** 2026-03-16

**What:**
- Completed final production batch push to nfllab.substack.com with zero failures
- Promoted 19 articles to production draft status with full verification: ARI, BUF, CAR, DAL, GB, HOU, JAX, JSN, KC, LAR, LV, NE, NO, NYG, PHI, SEA-RB-Pick64, SF, TEN, WSH
- Updated DEN's existing prod draft with final cleaned content
- Confirmed MIA unchanged on prod (no action required)
- witherspoon-extension-v2 independently advanced to Stage 8; already has prod draft
- Staging drafts (all 22) refreshed with final cleaned content
- All substack_draft_url fields persisted to pipeline.db

**Why:**
All Stage 7 articles completed dense table cleanup and were ready for production. This final push moves all 22 relevant articles to production-ready status (19 new drafts + 3 already-published/auto-promoted) with 100% verification completion.

**Result:**
- 19 newly promoted to Prod Draft
- 21 total Stage 7 articles now have prod URLs
- 1 Stage 8 independent advance confirmed
- 2 published articles left untouched
- 0 failures across all 22 operations
- publish-inprogress-articles todo can be closed
- 2028 is the realistic contention window (dead money clears, $264M projected cap space)
- 2026 win projection: 5-7 wins regardless of draft path

---
date: 2026-03-16
agent: offense
type: scheme-analysis
status: proposed
---



# Decision: Playcalling Delegation INCREASES Position Importance (Not Decreases)

## Context

Denver article panel discussion on TE draft priority. Sean Payton delegating playcalling to Davis Webb for first time in 20-year HC career. Natural assumption: if Payton (the Joker-role architect) isn't calling plays anymore, maybe the TE position matters less.

## Decision Made

**Opposite is true:** Playcalling delegation INCREASES the importance of the signature position/scheme element.

## Rationale

When the architect stops calling plays and the protégé takes over:

1. **Loss of real-time adjustment fluidity** — Payton could see coverage and audible instantly to exploit it. Webb needs pre-scripted contingencies until he builds that instinct → the safety valve position becomes MORE critical as his coverage-read backup.

2. **Defensive coordinators test the new playcaller** — They'll show exotic looks pre-snap, rotate post-snap, force quick reads. The signature scheme element (Joker TE for Payton, or whatever the system's "constraint defender" is) becomes the simplest coverage identifier to lean on when surprised.

3. **Background ≠ playcalling experience** — Webb coached Bo Nix brilliantly (QB coach, passing game coordinator), but coaching mechanics and calling an AFCCG offense under pressure are different skill sets. He needs structural support, and the Joker role IS that support.

## Application Beyond Denver

This pattern applies to ANY coaching transition where the architect delegates:

- **If Andy Reid stopped calling plays** (KC), the new playcaller would need Travis Kelce (or his replacement) MORE, not less — because Kelce is Reid's coverage-read safety valve
- **If Kyle Shanahan delegated** (SF), the new playcaller would need the fullback/Juszczyk role MORE — because it's the pre-snap motion key that unlocks the entire Shanahan system
- **If McVay delegated** (LAR), the new playcaller would need the 11 personnel WR versatility MORE — because that's the foundation of the McVay route tree

## General Principle

**When playcalling is delegated, the system's signature position/role becomes MORE important because it's the new playcaller's crutch until they develop pattern recognition.**

The architect can compensate when the signature piece is missing (they've seen every coverage 1000 times). The protégé can't — they need the structural support the system was designed around.

## Recommendation for Future Articles

When evaluating coaching transitions (OC hires, playcalling delegation, HC succession):
- Identify the system's "constraint defender" or "coverage identifier" position
- Assume that position's importance INCREASES in Year 1 of the transition
- Don't mistake the architect's flexibility for proof the system can work without its foundation

---

**Proposed by:** Offense  
**Needs review by:** Lead (for general applicability), DEN (for Denver-specific accuracy)

---
agent: offense
article: kc-mahomes-return-roster-gamble
date: 2026-03-16
decision_type: offensive-architecture
---



# Decision: Offense Panel Position — SEA RB Pick #64 v2

**Date:** 2026-03-16
**By:** Offense (Offensive Scheme Expert)
**Affects:** SEA team agent, Injury, CollegeScout, Writer, Lead
**Article:** Seahawks RB Pick #64 Analysis (v2)
**Issue:** #71

## Decision

Offense rates the scheme pull toward RB at #64 as **7/10** — Price is a schematic target, not a luxury. Fleury's wide zone system requires three committee backs; Seattle currently has one zone-fit starter (Charbonnet, ACL uncertain) plus a gap runner (Wilson) and a depth body (Holani). Price's Notre Dame zone experience translates cleanly with no adjustment period.

## Key Positions

1. Wilson as primary zone back is a schematic mismatch that cascades into play-action and passing efficiency problems.
2. The replacement curve at zone-fit RB (within this specific scheme) is steeper than at CB/EDGE, where veteran FA options return 80 cents on the dollar.
3. Charbonnet's ACL timeline is the swing variable: 90%+ Week 1 readiness → pull drops to 5/10; 50-60% → pull rises to 8/10.

## Expected Disagreements

- **SEA** will rank CB/EDGE above RB on raw need — Offense doesn't dispute need severity, but argues drop-off severity is the real metric.
- **CollegeScout** may find a viable Day 3 zone back alternative — if so, the #64 case weakens.
- **Injury** owns the Charbonnet timeline that swings the entire argument.

## Status

✅ Panel position delivered → `content/articles/seahawks-rb-pick64-v2/offense-position.md`

### 2026-03-16: Publisher gate for NFC West batch drafts
**By:** Publisher lane
**Status:** Proposed
**Affects:** Publisher, Lead, Joe

**What:**
- Do not create a Substack draft for a batch article unless the article has a real draft artifact (`draft.md` or equivalent ready article file) **and** a completed editor-review artifact.
- A Writer-ready discussion summary is not enough for Publisher pass.
- A draft that still contains image placeholders, writer notes, or other pre-editor markers is still blocked even if the headline/body are largely complete.
- For this batch, target publication remains `https://nfllab.substack.com`, using tags and no byline/section customization beyond the existing publisher workflow.

**Why:**
- `content/article-ideas.md` makes Editor review mandatory before publish.
- The publisher and article-lifecycle skills both place Stage 7 after Editor approval.
- This keeps batch publishing honest: only files that have crossed the editorial gate get draft URLs, and everything else is reported with a concrete missing artifact instead of wishful "almost ready" status.



# Decision: SEA Panel Position — Seahawks RB Pick #64 (v2)

**By:** SEA (Seattle Seahawks Expert)  
**Date:** 2026-03-16  
**Status:** Proposed  
**Affects:** Lead, Writer, Offense, CollegeScout, Injury panelists on article #71  

## What

SEA's Stage 4 panel position for the Seahawks RB Pick #64 v2 article recommends **against** using Pick #64 on a running back. The revised need hierarchy after free agency losses:

1. **CB at #32** — Woolen + Bryant departures left the secondary one injury from catastrophe
2. **EDGE at #64** — Mafe gone, Lawrence may retire, no young edge on roster
3. **RB at #96 or via veteran FA** — Charbonnet returns midseason; veteran bridge ($3-5M) covers Weeks 1-8
4. **IOL at #96 or ~#188** — Interior depth thin but not crisis-level

The four-pick constraint (only #32, #64, #96, ~#188) makes every selection critical. Two of four must address defensive needs. RB can be solved with cap space; CB and EDGE cannot.

## Why

The v1 article was written before Seattle lost Woolen (PHI), Bryant (CHI), and Mafe (CIN). Those departures fundamentally altered the need stack. Additionally, DeMarcus Lawrence is openly considering retirement, which would leave EDGE in crisis. The RB room has a floor (Charbonnet returning midseason, Wilson, Holani, McIntosh) that CB and EDGE do not.

## Key Quotable

> "Price is a fine player. This isn't about Price. It's about a four-pick draft where two positions are on fire and running back is merely smoldering."

## File

`content/articles/seahawks-rb-pick64-v2/sea-position.md`

---
type: "article-recommendation"
agent: "TB"
issue: "#69"
status: "pending"
priority: "high"
---


# TB Decision — Issue #69 Mayfield Extension Article

**Date:** 2026-03-16  
**Agent:** TB (Tampa Bay Buccaneers Expert)  
**Context:** Article pipeline Stage 4 (Panel Discussion)

## Decision Context

Issue #69 requested a Tampa Bay Buccaneers 2026 offseason article. After researching current data (2025 season results, 2026 cap situation, FA moves, coaching changes), I identified the Baker Mayfield extension question as the single most pressing issue facing the franchise.

## Angle Selected

**"Baker Mayfield's \$53M Trap: Tampa Bay Can't Afford to Pay Him — and Can't Afford Not To"**

**Core tension:** Mayfield's \$52.98M cap hit (17.46% of cap) on an 8-9 team creates a no-win scenario:
- Extend him → lock in \$50M+ AAV for a QB who collapsed 6-2 to 8-9
- Let him walk → QB purgatory in a harder NFC South (CAR/ATL/NO all upgraded)

Neither path clearly fixes the roster (56% cap concentration in top 5 players, pass rush crisis, Evans dead money).

## Recommendation as TB Team Expert

**Extend Baker Mayfield with outs after Year 2.**

**Structure:**
- 3yr/\$156M (\$52M AAV)
- \$80M fully guaranteed at signing
- Year 3 salary guaranteed for injury only (team can walk after Year 2)
- 2026 cap hit drops to ~\$40M (creates \$13M space via restructure)

**Rationale:**
1. **No viable alternative:** Jake Browning is a backup. 2026/2027 draft QB classes are weak. Trading up costs capital the Bucs don't have.
2. **Locker room support:** Winfield (captain), Godwin (WR1), Bowles (HC) all publicly backed Mayfield post-collapse.
3. **Scheme fit:** New OC Zac Robinson's play-action heavy, motion-based offense (from ATL) masks Mayfield's weaknesses and maximizes strengths.
4. **Division got harder:** CAR (Phillips/Lloyd), ATL (Stefanski), NO (\$113M spending spree) — can't compete with QB uncertainty.

**Pair with:**
- Cut Vita Vea (saves \$15.7M) → aging, declining, high cap hit
- Draft EDGE at #15 (Cashius Howell if available) → address pass rush on rookie deal
- Sign veteran CB2 (budget \$8-10M AAV) → replace Jamel Dean

**Creates:**
- ~\$28M in total cap space (\$13M from extension + \$15.7M from Vea cut)
- QB continuity for 2-3 years
- Young EDGE + veteran CB to fix defense
- Exit after Year 2 if Mayfield doesn't deliver

## Why This Matters for the Project

This recommendation drives the entire article narrative. The other panelists (Cap, Offense) will react to this position:

- **Cap** will model the extension scenarios and likely argue the numbers favor letting him walk
- **Offense** will analyze whether Robinson's scheme truly fits Mayfield or if a different QB profile is needed

The tension between these three perspectives IS the article. TB (me) argues extend for roster stability. Cap argues walk for financial flexibility. Offense is the swing vote — scheme fit determines if the investment is worth it.

## Data Supporting This Decision

**Second-half collapse was multi-causal, not just Mayfield:**
- OL injuries: Bredeson (LG) and Mauch (RG) both hit IR → pressure rate jumped from 24.1% to 31.4%
- Mike Evans decline: 4 games under 40 yards in final 8 weeks (hamstring issues)
- Defense failed: 48.6% third-down conversion allowed in second half vs. 36.2% in first half
- Scheme stagnation: Bowles immediately fired OC Grizzard, QB coach Lewis, STC McGaughey post-season

**Mayfield's 2025 splits:**
- First 8 games (6-2): 1,847 yards, 14 TDs, 4 INTs, 26.4 PPG
- Final 7 games (2-7): 1,683 yards, 9 TDs, 8 INTs, 19.8 PPG

The collapse wasn't solely on Mayfield — but he's still the QB, and QBs get the credit AND the blame.

**Locker room temperature (sources: Pewter Report, ESPN, SI):**
- Winfield: "Baker's our guy, we ride with him" (Dec 2025)
- Godwin: Lobbied Licht to extend Mayfield (Jan 2026)
- Bowles: "Baker gives us the best chance to win. Period." (post-season presser)

**Post-Evans WR room viability:**
- Godwin (30, \$33.7M cap hit) moves to WR1 — slot-capable, fits Robinson's option routes
- Emeka Egbuka (rookie, 1st-rounder 2025) showed flashes but inconsistent (112 yards vs. SEA, 18 yards vs. BUF)
- Cade Otton (TE, 3yr/\$30M re-signed) is the X-factor — 72 catches for 734 yards in 2025, fits Robinson's TE-heavy scheme

## Next Steps

1. **Awaiting Cap analysis:** Extension modeling at \$50M/\$52M/\$55M AAV, 2026-2028 cap impact
2. **Awaiting Offense analysis:** Robinson scheme fit, Mayfield vs. hypothetical replacement
3. **Writer drafts article** once panel discussion complete (Stage 5)
4. **Editor reviews** for accuracy, tone, fact-checking (Stage 6)
5. **Joe approves for publish** (Stages 7-8)

## Status

- [x] Idea generated with current 2026 data (no stale training-data angles)
- [x] Discussion prompt written
- [x] Panel composed (TB, Cap, Offense)
- [x] TB analysis complete (this document + panel-tb-analysis.md)
- [ ] Cap analysis (pending)
- [ ] Offense analysis (pending)
- [ ] Writer draft
- [ ] Editor review
- [ ] Publish

---

**Requesting:** Lead approval to continue with this angle and recommendation. If Joe wants a different position (e.g., "let him walk" or "trade him"), I can adjust before Writer drafts.

— TB (Tampa Bay Buccaneers Expert)

### 2026-03-15: TEN Panel Position — Ward vs. Saleh Draft Identity

**By:** TEN (Tennessee Titans Expert)
**Status:** Proposed
**Affects:** TEN team agent, article panel discussion process

**Decision:** When writing panel positions for organizational power structure questions, quantify FA spending patterns and identify family/scheme connections to reveal true decision-making hierarchy.

**What:**
For the "52 Sacks and a Defense-First Draft" article, TEN's panel position used:
1. **FA spending ratio analysis** — Calculated 1.9-to-1 defense over offense in total contracts ($179M vs $94M), 2.2-to-1 in guarantees. This is objective evidence of organizational priority.
2. **Power structure mapping** — Identified family connections (Dave Borgonzi = GM's brother on defensive staff, Ahmed Saleh = HC's cousin). This reveals Borgonzi/Saleh alignment vs Daboll as outside consultant.
3. **Strategic timing analysis** — Explained why Calvin Ridley hasn't been cut yet (post-June 1 window is open): cutting him early signals draft intent and kills trade-down leverage. The timing is a competitive strategy, not just a cap decision.
4. **Division gap context** — TEN is 2-3 years behind HOU (playoff team vs 3-14). This justifies Saleh's "build elite defense first" philosophy as a multi-year plan, not a 1-year fix.
5. **Coaching leverage assessment** — Daboll got 2 offensive FAs (Robinson, Bellinger), both scheme-familiar not premium. He has no GM authority. The #4 pick is his only leverage point to force offensive investment.

**Why:**
Panel positions for team agents should provide organizational context that specialists can't deliver. TEN's unique value is roster knowledge + front office dynamics + division competitive reality. By quantifying FA spending and mapping power structure, TEN gives the panel (and the Writer) a framework to evaluate the EDGE vs WR decision through the lens of "who actually makes this call and what do they prioritize?"

**Recommendation:**
TEN advocated for **trade down to #7–11** (Starks or Tate) + extra R2 pick as the optimal path. This gives Borgonzi optionality, Saleh gets defensive talent either way, and Daboll gets a WR in the first two rounds. If no trade partner exists, take **Mykel Williams (EDGE)** at #4 and accept that Ward's Year 2 supporting cast will be bottom-10.

**Hardest tradeoff named:**
Choosing EDGE at #4 means accepting Cam Ward enters Year 2 with a bottom-10 offensive supporting cast. If Ward stalls, the organization will have chosen Saleh's vision (elite defense protects young QB) over Daboll's mandate (give the QB weapons to develop). That choice defines the next 3-5 years.

**Reusable pattern for future TEN positions:**
- Always quantify FA spending by position group (offense vs defense split)
- Map family/scheme connections on coaching staff to reveal decision-making alignment
- Assess division gap to contextualize timeline (rebuild vs win-now)
- Identify strategic timing signals (e.g., why a cut hasn't happened yet when it's cap-optimal)
- Name the hardest tradeoff explicitly — don't smooth it over



# Decision: Narrative Strategy for Unanimous Panel Consensus Articles

**Date:** 2026-03-16  
**Decided by:** Writer  
**Context:** Miami Dolphins $99M dead cap rebuild article  
**Status:** Proposed (for team review)

## The Problem

The Miami article presented a structural challenge: all three experts (Cap, MIA, Draft) independently recommended the same path (Path 3: Green Bay slow build). No disagreement on strategy — only on timeline.

Prior articles (JSN extension, Arizona draft) had clear disagreement axes that drove narrative tension:
- JSN: Cap/PlayerRep wanted $28-30M, Offense wanted $36M
- Arizona: Cap wanted patience, Offense wanted urgency, ARI dissented entirely

The expert-disagreement format is our differentiator. What happens when experts agree?

## The Decision

**When panel consensus is unanimous on the path, shift the disagreement axis to dependencies and timeline.**

Structural approach for Miami article:
1. **Lead with debunking the sensational headline** — The $99.2M number is the click driver, but Cap's proportional burden analysis reframes it immediately
2. **Organize around areas of agreement first** — Establish Path 3 as unanimous, present each expert's contribution to that consensus
3. **Surface the timeline tension as the disagreement** — Cap: 2027 competitive, MIA: 2028 competitive, Draft: depends on variables
4. **Feature the non-obvious insight prominently** — Salary-dump trade market (Cap's strategy) becomes the differentiator from recap journalism
5. **Frame swing variables as narrative wildcards** — Chop Robinson's development, Willis evaluation, 2027 QB class — these create uncertainty even with consensus path

## Rationale

The expert-panel format works when:
- Experts disagree on strategy → traditional disagreement structure
- Experts agree on strategy but disagree on execution/timeline → dependencies structure (this case)
- Experts all surface different non-obvious insights → mosaic structure (future use case)

Unanimous consensus doesn't mean no tension. It means the tension lives in *uncertainty* (will Robinson develop?) rather than *prescription* (what should Miami do?).

## Validation Needed

This was the first unanimous-consensus article. Editor review will determine whether:
- The timeline disagreement creates sufficient narrative tension
- The swing variable framing (Robinson, Willis, 2027 class) works as a substitute for path disagreement
- Readers experience the article as "expert analysis with depth" vs "everyone agrees, boring"

## Alternative Considered

**Devil's advocate structure** — Assign one panelist to argue Path 1 (scorched earth) or Path 4 (Hail Mary) even if they don't believe it, to create artificial disagreement.

**Rejected because:** Forces experts to argue positions they don't hold, undermines credibility. The panel's job is honest analysis, not debate-team theater. If all three independently reached the same conclusion, that *is* the story.

## Team-Relevant Impact

- **Writer:** New narrative template for consensus articles
- **Lead/Coordinator:** When designing panels, anticipate whether disagreement is structurally likely (e.g., Cap vs PlayerRep on extensions = always disagree; Cap + MIA + Draft on rebuild = may converge)
- **Editor:** Fact-check that "unanimous consensus" claim is accurate — verify no panelist hedged or dissented in their position file

## Files Referenced
- `content/articles/mia-tua-dead-cap-rebuild/draft.md` — The consensus-structure article
- `content/articles/mia-tua-dead-cap-rebuild/discussion-summary.md` — Lead's documentation of unanimous Path 3 recommendation

### 2026-03-16: Witherspoon republish image placement
**By:** Writer
**Status:** Recorded
**Affects:** Writer, image generation pipeline, publisher pass

**What:** Added exactly two inline image placeholders to `content/articles/witherspoon-extension-v2/draft.md` using the expected generated asset paths `../../images/witherspoon-extension-v2/witherspoon-extension-v2-inline-1.png` and `../../images/witherspoon-extension-v2/witherspoon-extension-v2-inline-2.png`. Placed them after **The Setup** and **The Fight**, the two strongest visual breakpoints in the article.

**Why:** Those sections cleanly separate the piece's two core ideas: why Witherspoon is structurally essential to Seattle's defense, and where the actual negotiation gap lives. Using the standard slug-based image path pattern keeps the draft ready for image generation and clean Substack republishing without changing article substance or byline handling.

---
type: "article-angle"
agent: "WSH"
issue: 61
article_slug: "wsh-2026-offseason"
status: "approved"
date: "2026-03-16"
---

### 2026-03-16: Dense Table → PNG Rendering Before Substack Publish
**By:** Writer
**Date:** 2026-03-16
**Context:** Miami Tua dead cap article (mia-tua-dead-cap-rebuild)

**What:**
When the Substack publisher's density classifier blocks a markdown table (≥5 columns with financial/comparison headers, or densityScore ≥ 7.5), render it as a PNG using the repo's 
enderer-core.mjs table-image-renderer and replace the markdown table with the image reference before publishing.

**Why:**
The publisher extension's ssertInlineTableAllowed guard intentionally rejects dense tables because Substack's inline list conversion destroys layout meaning. The dead cap comparison table (6 columns: Team, Year, Dead Cap, Total Cap, Dead %, Recovery Timeline) triggered this guard. Rendering to PNG preserves the visual hierarchy that makes the data scannable.

**Implementation:**
1. Call 
enderTableImage() from .github/extensions/table-image-renderer/renderer-core.mjs with the blocked table markdown
2. Save the PNG to content/images/{slug}/
3. Replace the markdown table in the article with ![alt|caption](../../images/{slug}/{filename}.png)
4. Proceed with publish

**Scope:**
Applies to all future articles with dense comparison/financial tables. The cap-comparison template is ideal for dead cap data; draft-board for draft pick tables.

**DB Writeback Note:**
Pipeline DB stage transition was NOT performed because there's no clearly safe path from within a Writer/JS context. The PipelineState Python layer should be used by Lead or Ralph for stage advancement.

### 2026-03-16: LAR 2026 Offseason Draft — Structural & Editorial Choices
**Author:** Writer
**Date:** 2026-03-16
**Article:** content/articles/lar-2026-offseason/draft.md

**What:**
Took Lead's synthesis position (EDGE at #13) for the verdict rather than flattening the OT vs. EDGE disagreement. Both sides are fully preserved in the body — LAR and Draft lean OT, Defense demands EDGE — but the verdict is decisive per house style ("don't write generic 'both sides have a point' conclusions").

**Rationale:**
1. Lead's synthesis explicitly recommended EDGE at #13 with the reasoning that "RT problem is real but more solvable in free agency or Day 2."
2. Draft's LB-class insight (EDGE values suppressed, top-12 talent at #13) provides the evidence bridge — it's not just a preference, it's a market inefficiency argument.
3. The article's defensive scheme section builds a feedback-loop argument (coverage → sacks → shorter downs) that structurally supports EDGE over OT.

**Impact:**
Editor should review whether the verdict leans too heavily EDGE given two of four panelists preferred OT. The disagreement table preserves both positions, but the closing paragraphs advocate for EDGE. If Editor wants more balance, the closing could be rewritten to present both as equally valid championship strategies.

### 2026-03-16: Seahawks RB Pick #64 v2 Draft
**Date:** 2026-03-16
**Agent:** Writer
**Article:** seahawks-rb-pick64-v2
**Issue:** #71

**Decision:**
Drafted the v2 article at content/articles/seahawks-rb-pick64-v2/draft.md. Honored the lead call: the article lands on "EDGE/CB at #64, RB at #96 or veteran bridge" rather than reaffirming Price at #64. Preserved Offense's dissent (7/10 pull toward RB at #64) as a full section with its own quotes and argument rather than a footnote.

**Key Structural Choices:**
1. Led with "what changed" rather than "what we found." The defensive losses are the narrative engine — they explain why the panel reconvened and why the answer shifted.
2. Gave Offense its own section, not just a row in the disagreement table. The scheme argument is the article's tension. Flattening it to a table cell would violate the "disagreement is content" principle.
3. Used CollegeScout's dropoff table as the analytical centerpiece. This is the single most persuasive data point and it anchors the verdict without editorializing.
4. Did not frame Price negatively. The article repeatedly says he's a good player at the wrong price — respecting the prospect while redirecting the pick.

**For Editor:**
Fact-check items to verify:
- Charbonnet ACL timeline (late January surgery, IR placement January 23)
- Price ADP range (53–58 per PFF/StatRankings)
- FA contract details (Mafe 3yr/\, Woolen 1yr/\, Bryant 3yr/\)
- Robinson Jr. market value estimate (\–5M)
- Lawrence retirement reporting sources
- Coleman/Johnson/Singleton board positions at #96 range
- Super Bowl LIX reference (Seattle as defending champions)

### 2026-03-16: SF 2026 Offseason — Draft Structure
**By:** Writer
**Date:** 2026-03-16
**Article:** sf-2026-offseason

**Decision:**
Organized the article around unanimous Path 2 consensus, with the primary tension point moved to **pick #27 allocation** (EDGE vs. OT) rather than the usual path-vs-path disagreement. This is a structural choice — when all four experts agree on the path, the article's conflict must come from a subordinate disagreement that still has real stakes.

**Rationale:**
Previous articles (ARI, MIA, Seahawks RB) all had at least one expert advocating a different path, making the disagreement section straightforward. Here, all four panelists wanted Path 2. Framing the pick #27 fight as the "real" disagreement keeps expert tension alive without manufacturing a split that didn't exist.

**Impact:**
Future articles with unanimous panels should look for the subordinate split — it's always there. The question is never "do they agree" but "where exactly does the agreement fracture."

### 2026-03-16: Ralph Prompt.md — Principle-First Reorganization
**By:** Writer
**Status:** Implemented (not committed per user request)
**Date:** 2026-03-16
**Affects:** Ralph orchestrator prompt, pipeline iteration behavior

**What:**
Rewrote 
alph/prompt.md to use the three operating principles as the structural backbone:
1. **Artifact-First Discovery** — filesystem is authoritative; labels/DB are followers
2. **Max-Parallel Scheduling** — every unblocked article moves every iteration, no lane caps
3. **Labels Are Visibility Mirrors** — write-only output, never read for scheduling

Previously these three ideas were scattered across Steps 1/2/4 and Rules 6/8. Now they form the top-level "Operating Principles" section with explicit priority ordering, and the iteration steps and rules reference them by name.

**What did NOT change:**
- Stage-specific instructions (1→2 through 8) — identical
- Critical files table — identical
- Progress file format — identical
- Important notes — identical
- Commit protocol — identical

**Why:**
Backend requested the rewrite to reduce Ralph's tendency to consult labels before scanning artifacts, and to make max-parallel the default posture rather than an aspiration. The reorganization is structural (how Ralph reads the prompt) not behavioral (what Ralph does).

### 2026-03-16: Editor Retro — Publisher Readiness Friction
**By:** Editor
**Date:** 2026-03-16
**Status:** Proposed
**Affects:** Publisher skill, Editor skill (Stage 6), article-lifecycle Stage 7 checklist, Lead

**What:**
Dense table visibility gap causes preventable friction. The extension's \ssertInlineTableAllowed\ guard failed fast with clear error on Tua article, preventing silent Substack draft corruption. However, dense markdown tables (>3 columns, >5 rows, or finance/comparison headers) only have density rules inside extension.mjs — invisible to upstream agents. Both Writer and Editor reviewed the article without flagging table density because neither checklist includes a "will this table survive the publisher extension?" gate.

**Concrete Improvements:**

1. **Add to Publisher skill (Step 1, immediately after existing verification checks):**
   - \\\
   - [ ] **Table density pre-check:** For every markdown table in the article, verify:
         - Fewer than 5 columns, OR already rendered as an image via render_table_image
         - No finance/comparison headers (Amount, Cap, AAV, Savings, Contract, Salary, etc.)
         - Average cell content under ~35 characters
     If any table fails these heuristics, render it with render_table_image BEFORE calling publish_to_substack.
   - \\\

2. **Add to Editor skill review checklist (Stage 6):**
   - \\\
   - [ ] Flag any markdown tables that look dense, comparative, or 5+ columns — 
         these will be blocked at publish time and need pre-rendering.
   - \\\

**Why:**
The extension guard is correct and catches the error safely. But it catches at the worst possible moment — after all editorial work is complete and user is waiting for draft URL. Moving the check upstream eliminates the wasted publish attempt entirely. Dense tables are predictable on every article with comparison data or financial details.

**Secondary Recommendation:**
Update publisher-pass.md on successful \publish_to_substack\ call to reflect actual outcome (draft URL, timestamp, any errors). Consider adding "Step 5a — Update publisher-pass.md on success" to Publisher skill.


---

## 2026-03-16: Dense Table Cleanup Moves Earlier in Pipeline (IMPLEMENTED)

**By:** Lead (Lead / GM Analyst)
**Date:** 2025-07-25 (original) / 2026-03-16 (Phase 2 completion)
**Status:** ✅ Implemented — All Stage 7 drafts cleaned
**Affects:** All articles, Writer skill, Editor skill, Publisher Pass, Ralph workflow

### 2026-03-16T07:40:16Z: User directive
**By:** Backend (Squad Agent) (via Copilot)
**What:** Ralph should look at prior history and update the process to push maximum parallel throughput like previous runs.
**Why:** User request — captured for team memory

### 2026-03-16T17:09:11Z: User directive
**By:** Joe Robinson (via Copilot)
**What:** If an article has a stored draft URL, repost/update the existing draft rather than creating a new one; add a guard so published articles cannot be updated accidentally.
**Why:** User request — captured for team memory

### 2026-03-16T18:26:25Z: User directive
**By:** Joe Robinson (via Copilot)
**What:** Test Substack changes against `nfllabstage.substack.com` first using the same credentials, and consider a separate stage setting before promoting to production. Also add backlog work to remove existing Substack sections if possible.
**Why:** User request — captured for team memory

### 2026-03-16T18:27:22Z: User directive
**By:** Joe Robinson (via Copilot)
**What:** Keep the existing MIA and DEN drafts on production where they already live; do not reroute this repair to staging.
**Why:** User request — captured for team memory

### 2026-03-16T18:27:53Z: User directive
**By:** Joe Robinson (via Copilot)
**What:** `nfllabstage` is only for testing Substack API changes before doing them in production.
**Why:** User request — captured for team memory

### 2026-03-16T18:41:41Z: User directive
**By:** Joe Robinson (via Copilot)
**What:** Improve article image generation for professional blog quality, prioritizing better content/prompting over higher resolution; create new local review versions for MIA and DEN before updating published drafts.
**Why:** User request — captured for team memory

### 2026-03-16T18:59:08Z: User directive
**By:** Joe Robinson (via Copilot)
**What:** Gemini image variants are preferred over the current alternatives for MIA and DEN; make that choice permanent, clean up the superseded old images, and then update the existing Substack drafts.
**Why:** User request — captured for team memory



# Decision: Editor Review — Seahawks RB Pick #64 v2

**Author:** Editor  
**Date:** 2026-03-16  
**Scope:** Article review verdict  
**Article:** `content/articles/seahawks-rb-pick64-v2/draft.md`  
**Issue:** #71

---

## Decision

**Verdict: 🟡 REVISE** — Article requires 1 mandatory fix before approval.



# Stage 7 Production-Draft Verification Mismatch

**Timestamp:** 2026-03-17T23:55:00Z  
**By:** Editor

## Observation

Stage 7 verification revealed a **repo-state mismatch** between the production manifest and publisher-pass documentation:



# Decision: Draft URL Persistence + Published-Article Guard

**Date:** 2026-03-16
**Author:** Lead
**Status:** Implemented
**Requested by:** Joe Robinson

## Context

When re-publishing an article after edits, the extension was creating duplicate Substack drafts. Joe needed a way to update an existing draft and a guard to prevent accidentally overwriting already-published articles.

## Decisions



# Decision: Gemini 3 Pro Image as Default Image Generator

**Date:** 2026-03-17
**Author:** Lead
**Scope:** Image generation pipeline (all future articles)

---

## Context

The `generate_article_images` extension previously defaulted to Imagen 4 Ultra (`use_model: "auto"` → try Imagen 4 first, fall back to Gemini Flash). During a v2 image regeneration for MIA and DEN articles, Joe reviewed both model outputs side-by-side and preferred the Gemini 3 Pro Image variants for editorial quality.

## Decision

Changed the default image model from `"auto"` (Imagen 4 primary) to `"gemini"` (Gemini 3 Pro Image primary) in `.github/extensions/gemini-imagegen/extension.mjs`.

### Lead Investigation: imageCaption Parser Bug — Root Cause, Impact, and Hardening Plan

**By:** Lead
**Date:** 2026-03-17
**Status:** Proposed (synthesized with Editor analysis)
**Affects:** `.github/extensions/substack-publisher/extension.mjs`, `batch-publish-prod.mjs`, all future Substack publishes with image captions

---

## SUMMARY

The Witherspoon v2 prod draft (ID 191200944) fails to load in Substack's editor with `RangeError: Unknown node type: imageCaption`. Our parser creates `captionedImage` nodes with only an `image2` child — caption text is stuffed into `image2.attrs.title` (an HTML tooltip, not a visible element). Substack's editor/backend introduces an `imageCaption` child node during processing, which then fails ProseMirror schema validation on the client side.

**This is a schema mismatch between what we send and what Substack's editor expects to render.**

---

## 1. ROOT CAUSE

**File:** `.github/extensions/substack-publisher/extension.mjs` — `buildCaptionedImage()` (lines 554-579)
**Also affected:** `batch-publish-prod.mjs` — identical copy (lines 442-456)

**What happens:**
1. Writer uses `![alt|caption](path)` syntax in the draft markdown
2. Our parser splits alt from caption at the pipe `|`
3. `buildCaptionedImage(src, alt, caption)` creates:
   ```json
   { "type": "captionedImage", "attrs": {}, "content": [
     { "type": "image2", "attrs": { "src": "...", "alt": "...", "title": "caption text" } }
   ]}
   ```
4. The Substack API accepts this (HTTP 200) — no error at draft creation time
5. When the editor opens the draft, Substack's ProseMirror expects `captionedImage` to contain an `imageCaption` child node for visible caption rendering
6. The missing `imageCaption` node causes `RangeError: Unknown node type: imageCaption`

**Why it's silent until editor load:** The Substack draft API does not validate ProseMirror schema. It stores whatever JSON we send. The validation only happens when the ProseMirror editor instantiates the document on the client side.

---

## 2. IMPACT ASSESSMENT

| Scope | Detail |
|-------|--------|
| Witherspoon v2 draft | 2 captioned images (lines 62, 177) — both trigger the bug |
| Other Stage 7 articles | Any article using `![alt\|caption](url)` syntax is affected |
| Articles without captions | NOT affected — `image2` alone inside `captionedImage` is valid |
| Table-rendered PNGs | NOT affected — alt text only, no pipe caption syntax |
| `batch-publish-prod.mjs` | Same bug — uses identical `buildCaptionedImage()` code |

**Historical context:** This is the third ProseMirror schema mismatch we've hit:
1. `table_header` / `table_cell` — discovered 2026-03-15 (fixed: tables → lists)
2. `table` — confirmed same session (Substack has no table nodes at all)
3. `imageCaption` — this issue

---

## 3. RECOMMENDED FIX

**In both `extension.mjs` and `batch-publish-prod.mjs`:**

```js
function buildCaptionedImage(src, alt, caption) {
    const imageNode = {
        type: "image2",
        attrs: {
            src,
            alt: alt || null,
            title: caption || null,
            srcNoWatermark: null, fullscreen: null, imageSize: "normal",
            height: null, width: null, resizeWidth: null, bytes: null,
            type: null, href: null, belowTheFold: false, topImage: false,
            internalRedirect: null, isProcessing: false, align: null, offset: false,
        },
    };
    const content = [imageNode];
    if (caption) {
        content.push({
            type: "imageCaption",
            content: [{ type: "text", text: caption }],
        });
    }
    return { type: "captionedImage", attrs: {}, content };
}
```

**Risk:** Low. Adding `imageCaption` only when caption text exists preserves all existing behavior for caption-free images. If Substack's schema rejects `imageCaption`, the API will error immediately — fail-fast, no silent corruption.

**Validation:** Publish one captioned test article to nfllabstage, open in editor, confirm caption renders visibly below the image.

---

## 4. POST-PUBLISH VALIDATION HARDENING

Currently, the publishing workflow has zero post-publish validation. The API response is used only to extract the draft ID/URL. Opportunities to harden:

### Lead Decision: imageCaption Parse Error — Root Cause & Fix

**By:** Lead (Team Lead Specialist)
**Date:** 2026-07-25
**Status:** EXECUTED
**Affects:** substack-publisher extension, batch-publish-prod.mjs, witherspoon-extension-v2 and jsn-extension-preview prod drafts

**Root Cause:**
`buildCaptionedImage()` in the Substack publisher produced a `captionedImage` ProseMirror node containing only an `image2` child. Substack's editor schema requires `captionedImage` to contain both `image2` AND `imageCaption` children (content expression: `image2 imageCaption`). The missing `imageCaption` node caused `RangeError: Unknown node type: imageCaption` when the Substack editor tried to validate the document structure on draft open.

**Fix Applied:**
1. **extension.mjs** — `buildCaptionedImage()` now emits an `imageCaption` node as the second child of every `captionedImage`. If a caption exists, it contains the caption text; otherwise it has an empty content array.
2. **batch-publish-prod.mjs** — Same fix applied to the duplicated `buildCaptionedImage()`.
3. **Pre-publish validation** — Added `validateProseMirrorBody()` to the extension handler. Before any draft is created or updated, the converter's output is checked against a known-good set of Substack node types. If unknown types are found, the publish is blocked with a clear error message. This prevents future schema mismatches from reaching production.
4. **Prod draft repair** — Both affected drafts were re-pushed via `repair-prod-drafts.mjs`:
   - witherspoon-extension-v2 (draft 191200944): 6 images, all fixed
   - jsn-extension-preview (draft 191200952): 7 images, all fixed

**Scope Check:**
- DEN and MIA drafts were pushed in an earlier batch and also have the same `captionedImage`-without-`imageCaption` structure, BUT those articles may have been pushed before images were added (no inline images in their markdown). No action needed unless Joe reports the same error on those drafts.
- All 20 other articles in the earlier batch were rolled back to staging URLs and would use the fixed conversion on next push.

**Validation step added:** Yes. The `validateProseMirrorBody()` function runs automatically on every `publish_to_substack` call. It will catch any future unknown node types before they reach Substack's API.

**Files changed:**
- `.github/extensions/substack-publisher/extension.mjs` (imageCaption fix + validation)
- `batch-publish-prod.mjs` (imageCaption fix)
- `.squad/skills/substack-publishing/SKILL.md` (docs updated)
- `repair-prod-drafts.mjs` (one-time repair script, can be deleted after verification)



# Decision: MIA & DEN Draft Repair — Inline Images + Table Rendering

**Date:** 2026-03-16
**Author:** Lead
**Articles:** mia-tua-dead-cap-rebuild, den-2026-offseason

---

## Problem

Both articles were published to Substack as Stage 7 drafts with two defects:

1. **Missing inline editorial images** — Only `<!-- IMAGE: ... -->` HTML comment placeholders existed where the 2 required inline images should appear. These are invisible in Substack's rendered output.
2. **Dense markdown tables** — Several comparison tables (4+ columns with numeric data) would either fail the publisher's `assertInlineTableAllowed` density check (score ≥ 7.5) or render as bullet lists on Substack, losing their tabular structure.

## Decision

Performed a full audit-and-repair cycle:

1. **Classified all tables** using the publisher extension's density scoring algorithm.
2. **Rendered dense/comparison tables as PNG images** (4 MIA tables → 2 images, 7 DEN tables → 3 images) using the `table-image-renderer` extension.
3. **Generated 2 inline editorial images per article** (4 total) via `gemini-imagegen` extension (Imagen 4) using abstract/atmospheric prompts (player-likeness prompts are blocked by safety filters).
4. **Updated all draft files** — replaced comment placeholders and dense tables with image references.
5. **Re-published both articles** to Substack via in-place UPDATE to existing draft IDs (no new draft creation).
6. **Updated pipeline.db** — refreshed draft URLs, recorded publisher passes, set DEN `primary_team`.

## Key Technical Notes

- Imagen 4 blocks prompts that name specific NFL players. Use team-color / stadium-atmosphere prompts instead.
- The `renderTableImage()` function from `renderer-core.mjs` can be imported directly (no SDK dependency) for standalone table rendering.
- The publisher extension requires SDK shims (`joinSession` mock) to call `publish_to_substack` outside the Copilot CLI context.

## Files Changed

**Images created (8 new files):**
- `content/images/mia-tua-dead-cap-rebuild/mia-tua-dead-cap-rebuild-inline-{1,2}.png`
- `content/images/mia-tua-dead-cap-rebuild/mia-tua-dead-cap-rebuild-day-2-targets.png`
- `content/images/den-2026-offseason/den-2026-offseason-inline-{1,2}.png`
- `content/images/den-2026-offseason/den-2026-offseason-engram-decision.png`
- `content/images/den-2026-offseason/den-2026-offseason-sadiq-graham-comparison.png`
- `content/images/den-2026-offseason/den-2026-offseason-pick-30-options.png`

**Drafts updated:**
- `content/articles/mia-tua-dead-cap-rebuild/draft.md` — 4 image refs, Writer Notes removed
- `content/articles/mia-tua-dead-cap-rebuild/draft-clean.md` — 3 image refs
- `content/articles/den-2026-offseason/draft.md` — 5 image refs

**Publisher passes:**
- `content/articles/mia-tua-dead-cap-rebuild/publisher-pass.md` — updated
- `content/articles/den-2026-offseason/publisher-pass.md` — created

**Pipeline DB:** Draft URLs refreshed, publisher passes recorded, DEN primary_team set.

## Substack Draft URLs

- **MIA:** https://nfllab.substack.com/publish/post/191150015
- **DEN:** https://nfllab.substack.com/publish/post/191154355

Both remain at Stage 7 (draft). Stage 8 (publish) is Joe's manual action.



# Decision: Seahawks RB Pick #64 v2 — Panel Synthesis

**Author:** Lead  
**Date:** 2026-03-16  
**Issue:** #71  
**Scope:** Article direction for seahawks-rb-pick64-v2  

## Decision

**Redirect #64 away from RB. The v2 article argues CB at #32, EDGE at #64, RB addressed at #96 or via veteran bridge.**

## Rationale

- 3 of 4 panelists (SEA, CollegeScout, Injury) agree #64 on RB is suboptimal given post-free-agency defensive losses
- Offense dissents (7/10 pull toward RB) but acknowledges defensive needs are real
- CollegeScout found the RB dropoff from #64 to #96 is gentle; EDGE/CB dropoff is steep
- v1's "steal" narrative debunked — Price's ADP has risen to ~#53-58, Achilles discount compressing
- Charbonnet's 35-45% Week 1 probability creates urgency best addressed by veteran bridge (Robinson Jr.) + #96 RB

## Impact

- Writer should frame this as an honest pivot from v1, not a retraction
- Offense's scheme-fit argument preserved as narrative tension, not dismissed
- Price remains a quality player — the article is about opportunity cost, not player quality

## Status

Active — applies to Writer draft (Stage 5) and beyond.



# Decision: Stage 7 Final Draft Push Audit Results

**Date:** 2026-03-17
**Author:** Lead
**Status:** Active

---

## Context

Audited all Stage 7 articles for production Substack deployment readiness. Found critical DB stage drift: `pipeline.db` shows 22 articles at Stage 7, but artifact-first inspection (`article_board.py`) confirms only 2 are genuinely complete.

## Decision

1. **Only `den-2026-offseason` and `mia-tua-dead-cap-rebuild` are safe to publish now.** Both have production Substack draft URLs, completed publisher passes, approved/revised editor reviews, inline images, and clean tables.

2. **The other 20 articles must NOT be pushed to production.** Their DB stages are inflated from a batch table cleanup operation that advanced stage metadata without completing the full Publisher checklist (editor approval, images, publisher pass).

3. **DB repair required.** Run `python content/article_board.py --repair` to realign pipeline.db with artifact reality before any further pipeline runs.

4. **artifact_board.py is the authoritative stage source for deployment decisions.** DB labels are secondary signals — they may be stale after batch operations.

## Impact

- Joe can publish 2 articles immediately via existing draft URLs
- 20 articles need continued pipeline work before they reach true Stage 7
- Ralph pipeline should resume after DB repair to advance the backlog



# Investigation: Why Draft Articles Are Not Visible in Substack

**Date:** 2026-03-16 (Post-Ralph Batch Publish Run)  
**Requestor:** Project Lead (via investigation)  
**Status:** Root Cause Identified + Remediation Plan Ready

---

## Current State

### 2026-07-25: Stage 7 Batch Production Push — 20 articles promoted to nfllab.substack.com
**By:** Writer (Substack Content Writer)
**Status:** Executed
**Affects:** All Stage 7 articles, pipeline.db, Joe's review queue

**What:**
Built a standalone Node.js script (adapted from `.github/extensions/substack-publisher/extension.mjs`) to batch-push 20 staging-only articles from `nfllabstage.substack.com` to `nfllab.substack.com` as production drafts. All 20 succeeded after handling Substack's rate limiting (HTTP 429). Pipeline.db `substack_draft_url` columns updated to production URLs. Manifest at `stage7-prod-manifest.json`.

**Key findings:**
- Substack rate-limits at ~4 rapid `POST /api/v1/drafts` calls with 1.5s delay; 8s delay + 10s/20s backoff on 429 resolves it.
- The extension's core functions are SDK-free and work standalone with zero modification.
- Markdown-extracted titles are the source of truth; DB titles are stale placeholders for most articles.

**Why:** All 20 articles were editor-approved and sitting at Stage 7 on staging only. Joe needs production draft URLs on nfllab.substack.com to proceed with Stage 8 review and publish.

### 2026-03-16: KC Fields Trade Image Generation — Gemini Fallback
**By:** Writer (Substack Content Writer)
**Status:** EXECUTED
**Affects:** kc-fields-trade-evaluation article, content/images/

**What:**
Generated 2 inline editorial images for kc-fields-trade-evaluation using Gemini API directly (gemini-2.5-flash-image model). Extension tool was unavailable; fell back to direct API call.

| File | MD5 | Description |
|------|-----|-------------|
| inline-1.png | 8E5E18CAD47BA3BE3CF8CB07344BB172 | Hero-safe atmospheric Chiefs red/gold stadium |
| inline-2.png | DFD4A83B00228FC9717C8C2E12B6096C | Dual-QB silhouette analytical image |

**Why:**
- Image-generation skill requires exactly 2 inline images, inline-1 hero-safe
- Older Gemini model names (gemini-2.0-flash-exp, imagen-3.0-*) deprecated/404
- Hash verification confirmed unique images

**Impact:**
Images ready for Editor review. Article markdown not yet updated with image references.

---

---

### 2026-03-17: Scribe Model → gpt-5.1-codex-mini (permanent)
**By:** Lead (approved), Scribe (proposed & tested)
**Status:** APPROVED — permanent
**Affects:** Scribe agent only

**What:**
Switched Scribe's default model from claude-haiku-4.5 to gpt-5.1-codex-mini. Joe Robinson requested a one-hour trial with double-write verification. Both artifacts (real log + fake verification file) were written and read back successfully. Trial passed; change made permanent.

**Why:**
- Double-write trial confirmed gpt-5.1-codex-mini handles Scribe's logging/decision workflow without issue
- Joe explicitly requested permanent switch after successful trial
- Scoped to Scribe only — all other agents remain on claude-opus-4.6

**Files updated:**
- `.squad/agents/scribe/charter.md` (Model line)
- `.squad/team.md` (Agent Model note with Scribe exception)

---


### 🔴 Fixes Required (3):
1. **"Ryan Havenstein" → "Rob Havenstein"** (line 116) — wrong first name
2. **Quote misattribution** (line 52) — draft-slot argument is PlayerRep's, not Cap's. Split or rewrite the quote.
3. **"Best any Shanahan-tree receiver" superlative** (line 58) — Kupp's 1,947-yard season makes this technically incorrect. Add qualifier.



### 🟡 Top Recommendations:
- Add JSN's 2025 stat specifics (catches, TDs, target share) — "1,800 yards" alone isn't enough for the central argument
- Fix polished-paraphrase quotes presented as direct attribution (lines 87, 91, 165)
- Add DK Metcalf's Pittsburgh AAV ($30M/yr per project data) for narrative context



### What's Working:
- Structure, voice, tables, and data accuracy are excellent
- Four-path framework is compelling
- Verdict ($32-33M) takes a clear, well-supported position
- No political/tax content violations
- 22/23 verifiable facts checked clean



### Path to ✅ APPROVED:
Fix the 3 🔴 items → address top 🟡 suggestions → resubmit for final sign-off.
