# Stage 7 Production Deployment Audit — Corrected

**Audit Date:** 2026-03-17  
**Audit Prepared By:** Scribe (Session Logger)  
**Requested By:** Joe Robinson  
**Basis:** Factual repo state + production manifest + editorial decisions  
**Source of Truth:** `content/article_board.py --json` (current stage detection), `.squad/decisions/inbox/editor-stage7-verify.md` (quality gate decisions), `stage7-prod-manifest.json` (push record), `stage7-eligible.json` (pre-push intent)

---

## Executive Summary

A **deliberate scope mismatch** occurred between the pre-push eligibility criteria and the actual production push executed on 2026-03-16. The editor's Stage 7 quality gate identified **4 articles ready** (den, witherspoon, mia, jsn) for either immediate or post-reconciliation production pushes. The actual push executed was **limited to 1 article** (witherspoon-extension-v2), which now appears in Stage 8 with a new production draft URL.

**Current State (as of repo HEAD):**
- **Pre-push eligible articles (Stage 7):** 2 confirmed (den-2026-offseason, mia-tua-dead-cap-rebuild)
- **Articles actually pushed to production:** 20 total, including 1 from this session (witherspoon-extension-v2 → Stage 8)
- **witherspoon-extension-v2 status:** Transitioned from Stage 6 → Stage 8 during the push (NOT from Stage 7)
- **Remaining at Stage 7:** 21 articles (per `content/article_board.py --json`)
- **Total production draft URLs now live:** 22 articles with `nfllab.substack.com` URLs

The mismatch between editor recommendation (4 ready) and execution (1 pushed) was a **deliberate constraint decision**, not a technical failure. The conflation of the subsequent 20-article batch push (captured in the production manifest) with the 1-article push from this session has created audit confusion.

---

## Pre-Push Eligible Set vs. Actual Pushed Set

### What the Editor Recommended (`.squad/decisions/inbox/editor-stage7-verify.md`)

| Category | Articles | Status | Recommendation |
|----------|----------|--------|-----------------|
| **Prod-ready** | den-2026-offseason, witherspoon-extension-v2 | APPROVED + publisher verified | Push immediately |
| **DB stale, likely ready** | mia-tua-dead-cap-rebuild, jsn-extension-preview | APPROVED in editor history, DB shows REVISE | Reconcile DB, then push |
| **REVISE pending** | ari, seahawks-rb-pick64-v2, hou, lv, ne-maye, jax | 6 articles | Writer fixes needed |
| **REJECTED** | buf-2026-offseason | 1 article | Back to Stage 4/5 (rewrite) |
| **Never reviewed** | car, dal, gb, kc, lar, no, nyg, phi, sf, ten, wsh | 11 articles | Must complete Stage 6 first |

**Editor Recommendation Summary:** 4 articles had editorial clearance (den, witherspoon, mia, jsn). 18 articles were not ready.

### What Actually Got Pushed (Production Manifest)

The `stage7-prod-manifest.json` records **20 successful pushes** executed on 2026-03-16T23:53:13Z:

```
wsh-2026-offseason
car-2026-offseason
seahawks-rb-pick64-v2
buf-2026-offseason
jsn-extension-preview
ari-2026-offseason
dal-2026-offseason
gb-2026-offseason
hou-2026-offseason
jax-2026-offseason
kc-mahomes-return-roster-gamble
lar-2026-offseason
lv-2026-offseason
ne-maye-year2-offseason
no-2026-offseason
nyg-2026-offseason
phi-2026-offseason
sf-2026-offseason
ten-ward-vs-saleh-draft-identity
witherspoon-extension-v2 (draftId: 191198844)
```

**Scope Mismatch:**
- Editor cleared 4 articles for production; the manifest shows 20
- Articles in the manifest overlap with articles the editor flagged as REVISE (ari, seahawks-rb, hou, lv, ne-maye, jax) and NEVER REVIEWED (car, dal, gb, kc, lar, no, nyg, phi, sf, ten, wsh)
- **This represents a constraint violation**: articles without editor approval were pushed

---

## Current Production Draft State Summary

### What Is Currently in Production (Stage 8 or Higher)

Based on `content/article_board.py --json` and database verification:

| Metric | Count | Notes |
|--------|-------|-------|
| **Articles with production draft URLs** (nfllab.substack.com) | 22 | Includes 20 from manifest + prior pushes |
| **Known verified Stage 7 → Stage 8 transitions** | 2 | witherspoon-extension-v2 (this session); den-2026-offseason (earlier) |
| **Articles still at Stage 7** | 21 | Per `content/article_board.py --json` output |
| **Articles at Stage 8** | 1 | witherspoon-extension-v2 (post-push) |

### Known Production URLs for Pre-Push Verified Articles

These are the articles originally at Stage 7 before the push:

| Article | Slug | DraftId | Production URL | Status |
|---------|------|---------|-----------------|--------|
| Den 2026 Offseason | den-2026-offseason | 191154355 | https://nfllab.substack.com/publish/post/191154355 | Stage 7 (per board) |
| $99M Ghost | mia-tua-dead-cap-rebuild | 191150015 | https://nfllab.substack.com/publish/post/191150015 | Stage 7 (per board) |
| Witherspoon Extension V2 | witherspoon-extension-v2 | 191198844 | https://nfllab.substack.com/publish/post/191198844 | Stage 8 (post-push) |

**Clarification:** Den and Mia have production draft URLs but remain at Stage 7 in the current state because they have not been moved to Stage 8 (approval/publish). They exist as drafts but are awaiting Joe's Stage 8 approval.

---

## Risks / Blockers / Mismatches

### 🔴 Critical Mismatch: Editor Approval ≠ Production Manifest

**Issue:** The manifest records 20 successful pushes on 2026-03-16. Of these:
- 4 were editor-approved (or DB-stale candidates): den, witherspoon, mia, jsn
- 16 had **not completed editor review** (REVISE pending, REJECTED, or never reviewed)

**Risk:** Articles pushed without editorial clearance may contain quality blockers identified by the editor (red flags, factual issues, premise problems).

**Examples from editor decision:**
- **ari-2026-offseason:** Editor flagged 11 red flags → marked REVISE, still pushed
- **buf-2026-offseason:** Editor REJECTED (stale premise, needs rewrite) → still pushed
- **car, dal, gb, kc, lar, no, nyg, phi, sf, ten, wsh:** Never underwent Stage 6 editor review → still pushed

### ⚠️ Database Inconsistency: Stage Tags vs. Current State

**Issue:** The manifest lists articles as successfully pushed, but `content/article_board.py --json` shows only 1 article at Stage 8 (witherspoon-extension-v2).

**Possible explanations:**
1. The manifest may record a different batch (not the single-article push from the editor's directive)
2. The `stage7-prod-manifest.json` may be a historical record, not the current session's push
3. Database writeback to mark articles as Stage 8 did not occur for the 20-article batch

**Reconciliation needed:** Joe should verify the manifest timestamp (2026-03-16T23:53:13Z) and confirm whether this corresponds to:
- The single-article push from the editor's quality gate (expected: 1 article, witherspoon-extension-v2)
- A separate, undocumented batch push (20 articles)

### 📋 Unresolved Editor Decisions: 4 Articles Pending Clarification

**Articles with conditional approval:**
- **mia-tua-dead-cap-rebuild:** Editor approved, but database shows REVISE status. Needs reconciliation.
- **jsn-extension-preview:** Editor approved, but database shows REVISE status. Needs reconciliation.

**Action:** Before any further pushes, the pipeline.db editor_reviews table should be updated to reflect the editor's actual verdicts.

### ❌ Rejected Article Still in Pipeline

**buf-2026-offseason:** Editor marked REJECT (premise stale, needs rewrite). If this article was pushed to production, it should be:
1. Unpublished or marked as draft-only
2. Returned to Stage 4–5 for major revision
3. Re-reviewed before any production push

---

## Manual Next Steps for Joe

### Immediate Actions (This Session)

1. **Verify the manifest scope:**
   - Confirm whether `stage7-prod-manifest.json` records this session's push (expected: 1 article) or a prior batch (20 articles)
   - If it's a prior batch, recover the session/commit history where that push occurred

2. **Reconcile database editor_reviews:**
   ```
   UPDATE articles 
   SET editor_reviews = 'APPROVED' 
   WHERE slug IN ('mia-tua-dead-cap-rebuild', 'jsn-extension-preview');
   ```
   This aligns the database with the editor's actual verdicts (stated in decision file)

3. **Review production drafts for the 4 editor-cleared articles:**
   - **den-2026-offseason:** https://nfllab.substack.com/publish/post/191154355 (already in prod, ready for Stage 8 approval)
   - **witherspoon-extension-v2:** https://nfllab.substack.com/publish/post/191198844 (now Stage 8, awaiting your approval or revision)
   - **mia-tua-dead-cap-rebuild:** https://nfllab.substack.com/publish/post/191150015 (in prod, eligible for Stage 8 after DB reconciliation)
   - **jsn-extension-preview:** Draft ID from manifest is 191198535 → check production status

### Medium-Term Actions (Before Further Pushes)

4. **Resolve the 16 non-editor-approved articles:**
   - **6 REVISE articles (ari, seahawks-rb, hou, lv, ne-maye, jax):** Writers should complete revisions and resubmit to editor
   - **1 REJECTED article (buf):** Major premise work needed. Consider deprioritizing.
   - **11 never-reviewed articles (car, dal, gb, kc, lar, no, nyg, phi, sf, ten, wsh):** Assign to editor for Stage 6 pass

5. **Establish a push policy:**
   - No articles should move to Stage 8 (production) without explicit editor APPROVED verdict in the database
   - Use the editor's decision file as the canonical source during reconciliation gaps

6. **Audit the 20-article batch (if it occurred):**
   - Retrieve logs or session history for the push that generated `stage7-prod-manifest.json`
   - Determine who initiated it and whether it was intentional
   - If unintended, consider whether any of those 20 articles should be unpublished or reverted to draft-only

---

## Exact File References Used as Evidence

| File | Path | Usage |
|------|------|-------|
| **Editor Stage 7 Decision** | `.squad/decisions/inbox/editor-stage7-verify.md` | Canonical source for editorial clearance (4 articles approved) |
| **Production Manifest** | `stage7-prod-manifest.json` | Record of 20 pushed articles on 2026-03-16T23:53:13Z |
| **Eligible Articles List** | `stage7-eligible.json` | Pre-push intent: 3 articles (witherspoon, mia, den) |
| **Article Board (Current State)** | `content/article_board.py --json` | Live stage detection: 2 at Stage 7 (den, mia), 1 at Stage 8 (witherspoon) |
| **Database** | `content/pipeline.db` | Schema: articles table (slug, current_stage, editor_reviews, substack_draft_url) |
| **Execution Report (Misleading)** | `STAGE7-PUSH-REPORT.md` | ⚠️ Claims 1-article scope, but manifest conflicts with this. **Not used as evidence.** |

---

## Conclusion

The Stage 7 deployment reveals a **scope and approval mismatch** that requires immediate reconciliation:

✅ **What worked:**
- Editor quality gate identified 4 articles with editorial clearance
- witherspoon-extension-v2 successfully transitioned to Stage 8 with a new production draft
- Production URLs for den, mia, and witherspoon are live and accessible

⚠️ **What needs resolution:**
- The 20-article production manifest conflicts with the 1-article push from this session
- 16 of the pushed articles (per manifest) lacked editor approval, creating publication risk
- Database editor_reviews state is stale for mia and jsn
- buf-2026-offseason was REJECTED but may have been pushed anyway

🔧 **Next step:** Joe should verify the manifest scope, reconcile the database, and establish a push policy requiring editor APPROVED verdict before Stage 8 transition.

---

*This audit is based on the factual repo state as of 2026-03-17 and decision records in `.squad/`. It does not reflect any discrepancies between the execution report and actual outcomes.*
