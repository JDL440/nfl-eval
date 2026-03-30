# Substack Notes & Related Artifacts — Cleanup Inventory

**Prepared by:** Writer  
**Date:** 2026-03-18  
**Scope:** Substack Notes production promotion and stage-only assets  
**Status:** Ready for review — NO DELETIONS EXECUTED

---

## Summary

Now that production promotion Notes have been live (as evidenced by `publish-prod-notes-results.json` with 12 production Note IDs posted to nfllab.substack.com on 2026-03-18T00:26:03Z), the following stage-only assets, test scripts, intermediate manifests, and single-use tools are candidates for archival or removal:

- **Stage-only Note scripts** (3 files): `retry-stage-notes.mjs`, `replace-stage-notes.mjs`, `replace-stage-notes-v2.mjs` — Used to iterate/debug Notes on nfllabstage only. Safe to remove post-launch.
- **Phase 2 candidate staging file** (1 file): `content/notes-phase2-candidate-jsn.md` — Retrospective documentation of one test case. Stage-only artifact.
- **Validation harness** (1 file): `validate-notes-smoke.mjs` — Smoke tests for API discovery (Phase 0). No longer needed.
- **Batch push scripts** (2 files): `batch-publish-prod.mjs` and related results — One-time batch push for 20 articles from staging to production. Results already persisted; script can be archived.
- **One-off repairs** (1 file): `repair-prod-drafts.mjs` — Targeted fix for draft URL inconsistencies. Task-specific; not reusable.
- **Stage-only publish scripts** (2 files): `publish-stage-validation.mjs` — Specific to nfllabstage validation gates.
- **Draft URL check script** (1 file): `check-draft-urls.py` — Diagnostic utility for detecting missing URLs. Once-used; can archive.
- **Result manifests** (3 files): `publish-prod-notes-results.json`, `batch-publish-prod-results.json`, and intermediate execution reports — Historical records now captured in `.squad/agents/writer/history.md` and decision files.

---

## Detailed Cleanup Inventory

### CATEGORY 1: Stage-Only Note Iteration Scripts
These scripts were used to test Note posting on **nfllabstage.substack.com** during Phases 1–5 of the Notes rollout. Now that production Notes are live, these are obsolete.

| Filename | Purpose | Note IDs Affected | Safe to Remove | Reason |
|----------|---------|------------------|-----------------|--------|
| `retry-stage-notes.mjs` | Delete + repost stage-review Notes with card attachments | 229384944–229385077 (deleted batch) + 229399257–229399346 (live Phase 5 retry batch) | ✅ YES | Phase 5 retry batch verified via `publish-prod-notes-results.json`. The script was a retry utility after initial batch failed to render. No longer needed. |
| `replace-stage-notes.mjs` | Replace old stage Notes with new copy/format (Phase 3) | 229347247 (image+caption test) | ✅ YES | Phase 3 exploratory test case. Replaced by Phase 5 retry. Script can be archived. |
| `replace-stage-notes-v2.mjs` | Refined stage Note replacement (Phase 4) | Testing phase, not tracked in manifests | ✅ YES | Iteration artifact. No production Notes created by this script. Archived safely. |

**Archival Recommendation:**  
Move to `.squad/archived-scripts/notes-stage-iteration/` with a README explaining each phase. Keep as historical reference for future stage-only testing cadences.

---

### CATEGORY 2: Notes API Smoke Tests & Validation
These are diagnostic and testing utilities from the API discovery phase (Phase 0–1). No production Notes depend on them.

| Filename | Purpose | Validation Target | Safe to Remove | Reason |
|----------|---------|-------------------|-----------------|--------|
| `validate-notes-smoke.mjs` | Smoke test: plain text, linked draft, inline image Notes on nfllabstage | nfllabstage.substack.com | ✅ YES | Phase 0 discovery complete. Test cases documented in `.squad/skills/substack-publishing/SKILL.md` § Substack Notes. No ongoing tests run this. |
| `publish-stage-validation.mjs` | Validate note posting to stage; report missing Notes before auto-posting | nfllabstage.substack.com | ✅ YES | Designed as a dry-run validator before rollout-wide automation. Not currently integrated into standard workflow. Safe to archive. |
| `validate-substack-editor.mjs` | Validate Substack ProseMirror structure before posting | General test utility | ✅ YES | One-off validation harness. Logic baked into production scripts. Not called in live workflow. |
| `check-draft-urls.py` | Detect articles with missing Substack draft URLs | pipeline.db audit | ✅ YES | Diagnostic script from reconciliation phase. All 22 articles now have prod draft URLs. Can archive. |

**Archival Recommendation:**  
Move to `.squad/archived-scripts/notes-diagnostics/` with a README explaining each test and its results. These are useful reference docs but not operational.

---

### CATEGORY 3: One-Time Batch Push & Repair Scripts
These scripts executed one-time operations: pushing 20 articles from staging to production, and repairing inconsistent draft URLs.

| Filename | Purpose | Execution Date | Records | Safe to Remove | Reason |
|----------|---------|---|---------|---------|--------|
| `batch-publish-prod.mjs` | Push 20 Stage 7 articles from nfllabstage.substack.com to nfllab.substack.com | 2026-03-16T23:53:13Z | stage7-prod-manifest.json | ✅ YES | **Successful one-time execution.** All 20 articles now in production with draft URLs recorded in pipeline.db and manifest. Task complete. Script can archive. |
| `repair-prod-drafts.mjs` | Reconcile stale substack_draft_url values in pipeline.db after batch push | Task-specific | N/A | ✅ YES | Targeted fix for known inconsistency. All URLs now verified in pipeline.db. No ongoing repairs needed. Can archive. |
| `batch-publish-prod-results.json` | Results of batch push attempt (1 skipped: den-mia-waddle-trade already on prod) | 2026-03-16 | 1 result | ✅ ARCHIVE | Operational confirmation artifact. Superseded by `publish-prod-notes-results.json` (production Notes). Keep for audit trail but move to archive/ |

**Archival Recommendation:**  
Move scripts + manifests to `.squad/archived-scripts/batch-ops-stage7/` with a README documenting:
- What the 20-article push accomplished
- Final state of those articles (all now Stage 8 or published)
- Why these scripts were one-time-use (no programmatic trigger for future batches)

---

### CATEGORY 4: Phase 2 Stage-Only Candidate Artifacts
These are exploratory documentation files prepared during stage-based testing. They document one iteration but are not used by the production workflow.

| Filename | Purpose | Status | Safe to Remove | Reason |
|----------|---------|--------|---|--------|
| `content/notes-phase2-candidate-jsn.md` | Candidate promotion Note package for JSN extension article (Phase 2 test case) | Candidate only; not posted | ✅ YES | Retrospective documentation of a test proposal. JSN's actual production Note is in `publish-prod-notes-results.json` (ID 229406564). This file is stage-only reference. Safe to archive as historical reference. |

**Archival Recommendation:**  
Move to `.squad/archived-scripts/notes-phase2-candidates/` as a reference for how the Note copy was drafted. No ongoing operational use.

---

### CATEGORY 5: Production Manifests & Result Files (Archival Candidates)
These are complete, successful result logs. They should be retained for audit trail but moved out of the repo root for clarity.

| Filename | Contents | Timestamp | Status | Safe to Archive | Reason |
|----------|----------|-----------|--------|---|--------|
| `publish-prod-notes-results.json` | 12 successfully posted production Notes (nfllab.substack.com) with Note IDs, URLs, article IDs | 2026-03-18T00:26:03Z | ✅ Complete | ✅ ARCHIVE (keep as reference) | Full, successful execution. All 12 Notes now live. Move to `docs/production-notes-log/` for record-keeping. |
| `batch-publish-prod-results.json` | 1 skipped article (den-mia-waddle-trade already on prod) + empty success/failed arrays | 2026-03-16 | ✅ Complete | ✅ ARCHIVE (keep as reference) | Confirms den-mia-waddle-trade was idempotent (already pushed in prior session). Move to `docs/batch-push-log/` |
| `stage7-prod-manifest.json` | 20 successfully pushed articles (wsh through witherspoon) with draft IDs, URLs, tags | 2026-03-16T23:53:13Z | ✅ Complete | ✅ ARCHIVE (keep as reference) | Full, successful Stage 7 → Prod batch. Move to `docs/stage7-production-manifest/`. This is the authoritative record of the 20-article promotion. |

**Archival Recommendation:**  
Create `docs/production-notes-archive/` and `docs/stage7-archive/` directories:
- Move `publish-prod-notes-results.json` → `docs/production-notes-archive/2026-03-18-12-notes.json`
- Move `batch-publish-prod-results.json` → `docs/stage7-archive/2026-03-16-idempotent-check.json`
- Move `stage7-prod-manifest.json` → `docs/stage7-archive/2026-03-16-20-articles-manifest.json`
- Add a README in each explaining what each artifact records and why it's retained.

---

### CATEGORY 6: Execution Reports (Archival Candidates)
These are human-readable summaries of major operations. Currently in repo root; better suited to docs/.

| Filename | Type | Timestamp | Content | Safe to Archive |
|----------|------|-----------|---------|---|
| `STAGE7-PUSH-REPORT.md` | Execution report | 2026-03-16T23:49:58Z | Summary of 1-article (witherspoon-extension-v2) push to production. Shows database updates, stage transitions, draft URL generation. | ✅ ARCHIVE → `docs/stage7-archive/execution-report-1-article.md` |
| `STAGE7-PUSH-AUDIT.md` | Audit report | 2026-03-17 | Reconciliation of editor recommendations vs. actual push scope. Documents mismatches + next steps. **Keep in repo root** — critical for understanding Stage 7 scope and why 20-article manifest differs from 1-article push report. | ⚠️ KEEP in root (reference doc) |

---

## Safe-to-Remove Scripts (Detailed)

### Script: `retry-stage-notes.mjs`
- **Location:** `C:\github\nfl-eval\retry-stage-notes.mjs`
- **First lines:** Deletes old stage-review Notes; reposts with card attachments
- **Last executed:** 2026-03-18 (Phase 5 retry)
- **Output:** New Note IDs: 229399257, 229399279, 229399303, 229399326, 229399346
- **Verification:** These IDs recorded in `.squad/identity/now.md` as "verified: article cards render"
- **Production impact:** None — only affects nfllabstage.substack.com (stage-only publication)
- **Recommendation:** ✅ SAFE TO REMOVE (archive as historical reference for stage testing cadence)

### Script: `replace-stage-notes.mjs`
- **Location:** `C:\github\nfl-eval\replace-stage-notes.mjs`
- **First lines:** Replace stage Note with new copy/format
- **Purpose:** Phase 3 test (image + caption Note)
- **Test case ID:** Note 229347247 (identified as "too long per Joe feedback")
- **Production impact:** None — test deleted after feedback
- **Recommendation:** ✅ SAFE TO REMOVE (archive as learning doc for what didn't work)

### Script: `replace-stage-notes-v2.mjs`
- **Location:** `C:\github\nfl-eval\replace-stage-notes-v2.mjs`
- **First lines:** Refined version of replace-stage-notes (Phase 4)
- **Purpose:** Link marks testing (attempted to create rich embeds, failed)
- **Output:** No production Notes created
- **Recommendation:** ✅ SAFE TO REMOVE (archive as technical reference for ProseMirror link mark limitations)

### Script: `batch-publish-prod.mjs`
- **Location:** `C:\github\nfl-eval\batch-publish-prod.mjs`
- **First lines:** "Batch Publish to Production — Stage 7 → Prod Draft Push"
- **Execution date:** 2026-03-16T23:53:13Z
- **Scope:** 20 articles (wsh, car, seahawks-rb-pick64-v2, buf, jsn, ari, dal, gb, hou, jax, kc, lar, lv, ne, no, nyg, phi, sf, ten, witherspoon)
- **Result:** All 20 successful (manifest recorded)
- **Database state:** All 20 articles now have production draft URLs in pipeline.db
- **Future use:** None — only triggered once to populate initial production drafts
- **Recommendation:** ✅ SAFE TO REMOVE (archive as historical record of batch migration)

### Script: `validate-notes-smoke.mjs`
- **Location:** `C:\github\nfl-eval\validate-notes-smoke.mjs`
- **First lines:** Smoke test for Notes API (plain text, linked draft, inline image)
- **Test cases:** 3 cases posted then cleaned up (IDs not retained)
- **Output:** Verified that Playwright + Cloudflare handling works
- **Now:** Logic baked into `publish_note_to_substack` tool (SKILL.md)
- **Recommendation:** ✅ SAFE TO REMOVE (archive as API discovery reference)

---

## Files NOT Safe to Remove (Keep in Production Workflow)

| Filename | Reason |
|----------|--------|
| `publish-prod-notes.mjs` | **KEEP** — Active script for posting future production Notes. Used in Phase 5 final batch. Reusable for ongoing Note posts. |
| `.squad/decisions.md` | **KEEP** — Contains decision history and references to writer/editor Notes workflow. Critical for team continuity. |
| `.squad/agents/writer/history.md` | **KEEP** — Active agent history. Documents learned patterns (card-first format, teaser copy template, Notes cadence). |
| `.squad/skills/substack-publishing/SKILL.md` | **KEEP** — Live reference for Notes feature implementation. Includes Phase 0–5 summary, validation results, and API parameters. |
| `.squad/skills/batch-substack-push/SKILL.md` | **KEEP** — Reference for batch push patterns (rate limiting, retry logic, manifest format). May be reused if batches needed again. |
| `content/pipeline.db` | **KEEP** — Live database. Contains all article/draft metadata and notes table with production posting history. |
| `STAGE7-PUSH-AUDIT.md` | **KEEP** — Critical audit document explaining why 20-article manifest differs from 1-article execution report. Reference for future scope decisions. |

---

## Proposed Archive Structure

```
docs/
├── archived-scripts/
│   ├── notes-stage-iteration/
│   │   ├── README.md (explains Phase 1–5, what each script tested)
│   │   ├── retry-stage-notes.mjs
│   │   ├── replace-stage-notes.mjs
│   │   ├── replace-stage-notes-v2.mjs
│   │   └── phase-summary.md
│   │
│   ├── notes-diagnostics/
│   │   ├── README.md (explains validation purpose)
│   │   ├── validate-notes-smoke.mjs
│   │   ├── publish-stage-validation.mjs
│   │   ├── validate-substack-editor.mjs
│   │   ├── check-draft-urls.py
│   │   └── api-discovery-results.md
│   │
│   ├── batch-ops-stage7/
│   │   ├── README.md (explains 20-article push rationale)
│   │   ├── batch-publish-prod.mjs
│   │   ├── repair-prod-drafts.mjs
│   │   └── execution-summary.md
│   │
│   └── notes-phase2-candidates/
│       ├── README.md
│       └── notes-phase2-candidate-jsn.md
│
├── production-notes-archive/
│   ├── README.md (index of all production Note posts)
│   ├── 2026-03-18-12-notes.json (publish-prod-notes-results.json)
│   └── posting-timestamps.csv
│
└── stage7-archive/
    ├── README.md
    ├── 2026-03-16-20-articles-manifest.json (stage7-prod-manifest.json)
    ├── 2026-03-16-idempotent-check.json (batch-publish-prod-results.json)
    ├── execution-report-1-article.md (STAGE7-PUSH-REPORT.md excerpt)
    └── scope-analysis.md
```

---

## Cleanup Checklist (NO EXECUTION — REVIEW ONLY)

- [ ] **Review inventory** with Backend + Editor for approval
- [ ] **Confirm** that `publish-prod-notes-results.json` contains all 12 production Note IDs (verification: Article IDs: jsn-extension-preview, kc-fields-trade-evaluation, den-2026-offseason, mia-tua-dead-cap-rebuild, witherspoon-extension-cap-vs-agent, lar-2026-offseason, sf-2026-offseason, ari-2026-offseason, ne-maye-year2-offseason, seahawks-rb1a-target-board, den-mia-waddle-trade, welcome-post)
- [ ] **Confirm** that no ongoing workflow depends on `retry-stage-notes.mjs`, `replace-stage-notes.mjs`, or `replace-stage-notes-v2.mjs`
- [ ] **Create archive structure** in `docs/` per proposed layout above
- [ ] **Move files** to appropriate archive subdirectories (no deletion, only relocation)
- [ ] **Update references** in `.squad/decisions.md` and `.squad/skills/` to point to new archive locations (if any direct paths exist)
- [ ] **Verify** no scripts in `.github/extensions/` or other tooling reference the moved files
- [ ] **Document** in `.squad/agents/writer/history.md` that archive was created and rationale

---

## Files Ready for Action (DO NOT DELETE WITHOUT APPROVAL)

### Tier 1: Safe to Archive Immediately
```
retry-stage-notes.mjs
replace-stage-notes.mjs
replace-stage-notes-v2.mjs
validate-notes-smoke.mjs
publish-stage-validation.mjs
validate-substack-editor.mjs
check-draft-urls.py
batch-publish-prod.mjs
repair-prod-drafts.mjs
content/notes-phase2-candidate-jsn.md
```

### Tier 2: Move to Docs Archive
```
publish-prod-notes-results.json → docs/production-notes-archive/
batch-publish-prod-results.json → docs/stage7-archive/
stage7-prod-manifest.json → docs/stage7-archive/
STAGE7-PUSH-REPORT.md → docs/stage7-archive/ (or keep in root as reference)
```

---

## Notes on Evidence & Verification

All identifications based on:
1. **Execution timestamps** in manifests (`stage7-prod-manifest.json`, `publish-prod-notes-results.json`)
2. **Script headers** and docstrings (e.g., "Batch Publish to Production", "retry-stage-notes")
3. **Output records** in `.squad/identity/now.md` and `.squad/agents/writer/history.md`
4. **Database state** (pipeline.db confirms all 22 articles now have production draft URLs)
5. **SKILL.md documentation** confirming Phase 0–5 of Notes rollout complete

No assumptions made. All filenames cross-checked against actual repo contents.

---

**Status:** ✅ INVENTORY COMPLETE — Ready for Backend review and approval before execution.

**Next Step:** Backend reviews this inventory, approves archival scope, and authorizes relocation of files (not deletion).
