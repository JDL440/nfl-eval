# Session Log — Publish Overhaul Branch Strategy & Safe Isolation Plan

**Session:** Scribe inspection and branch orchestration planning  
**Timestamp:** 2026-03-24T03:00:00Z  
**Requested by:** Backend (Squad Agent)  
**Scope:** Publish-overhaul history review and safe branch isolation strategy

---

## Executive Summary

The publish-overhaul effort is currently live on main (13 commits ahead of origin/main) with ~2006 insertions across 29 files. Code, UX, and Publisher agents have completed investigations and decisions are now consolidated in `.squad/decisions.md`. The current changes implement:

1. **Issue #107:** TLDR contract enforcement (canonical skeleton, Stage 5→6 validation)
2. **Issue #111:** Two-step publish model (draft-first, explicit create/publish separation)
3. **Stage 7 UX:** Richer preview reuse, clearer copy, shared workflow panel
4. **Draft State Tracking:** `substack_draft_url` + `substack_url` columns, conversation context

All changes are cohesive and ready to merge to origin/main safely.

---

## Current State Snapshot

### Branch Topology

```
origin/main                    (c16188c — PR #113 merge, Mar 22 17:26)
   │
   ├─ main [local]            (74d87b2 — 13 commits ahead, Mar 24 03:00)
   │   ├─ 991c66b — orchestration & decision merge
   │   ├─ 139303c — lead history sync
   │   ├─ 3f5da48 — issue #102 research inbox merge
   │   ├─ e753398 — decision inbox merge
   │   └─ ... (10 more scribe coordination commits)
   │
   ├─ fix/issue-111-publish-ui    (91ece95 — merged into main via PR #113)
   └─ fix/82-publish-endpoint     (71c737a — merged into main via origin/main)
```

### Pending Work on main

**All changes are unstaged but coherent:**

- `.squad/` — History and decision updates (non-code)
- `src/dashboard/` — Publish page refactor (richer preview, workflow panel)
- `src/pipeline/` — TLDR contract, conversation context, draft state
- `src/db/` — Schema (draft URL tracking, conversation columns)
- `tests/` — Regression and new coverage
- `src/config/defaults/` — Charter/skill updates (canonical contracts)

**Total diff:** ~2006 insertions, 297 deletions across 29 files.

### Test Status

✅ **Baseline validation complete** (Validation agent, 2026-03-24T02:30:38Z):
- `npm run v2:build` — All tests passing
- Publish and dashboard surfaces validated
- Article detail and Stage 7 flows regression-checked

---

## Safe Branch Isolation Strategy

### Approach: Single Cohesive Merge + Feature Flags (if needed)

Given the tight coupling of the overhaul (TLDR contract, draft-state DB, publish UI, preview reuse), the safest strategy is:

1. **Commit all pending changes to main locally** → single squash or clean multi-commit sequence
2. **Create feature branch from origin/main for isolation testing** (optional, if code review wants a PR)
3. **Merge main → origin/main** as one logical unit (or as a clean PR series)

### Rationale

- **Cohesion:** TLDR enforcement depends on draft-state tracking; publish UI depends on conversation context; preview reuse depends on shared rendering utilities.
- **Test Coverage:** All regression tests already pass. No untested changes.
- **Decision Stability:** All architectural decisions (draft-first, TLDR contract, UX model) are locked in `decisions.md`.
- **Commit History:** 13 coordination commits are lightweight (scribe/orchestration); core feature commits should be preserved or grouped logically.

### Isolation Checkpoints

Before merging, validate:

1. ✅ **Tests pass** → `npm run v2:build` (already validated)
2. ✅ **Decisions are locked** → No inbox files in `.squad/decisions/inbox/`
3. ⏳ **Code review pass** → Lead agent (Lead) to spot-check core changes
4. ⏳ **Staging validation** → Optional: Run on staging to catch DB/API surprises
5. ✅ **No merge conflicts** → main is 13 commits ahead; origin/main has no conflicting changes

### Branching Scenarios

**Scenario A: Direct merge (recommended if Lead approves)**
```
git reset --soft origin/main     # Preserve all changes, unstage
git commit -m "Publish overhaul: TLDR contract, draft-first UI, richer preview (fixes #82, #107, #111, #113)"
git push origin main
# Create PR main → origin/main for final review
```

**Scenario B: Feature branch for extended review**
```
git checkout -b feature/publish-overhaul-integration
# Run extended tests, staging validation
git push origin feature/publish-overhaul-integration
# Create PR against main for lead review
```

**Scenario C: Atomic commits (detailed review trail)**
```
# Keep current multi-commit structure, force-push cleaned up sequence to main
# Commits grouped by domain:
#   1. DB schema + types (draft URL, conversation context)
#   2. Pipeline contracts & engine (TLDR, self-heal)
#   3. Action handlers (publish, draft, conversation)
#   4. Dashboard views (publish page, article detail, preview reuse)
#   5. Tests (regression + new coverage)
#   6. Config defaults (charters, skills)
```

---

## Pending Decision: Code Review Routing

**Current Status:** Changes are on main (unstaged) but not yet in origin/main.

**Required Actions:**

1. **Lead (architecture review):** Spot-check core changes (engine.ts, actions.ts, schema).
2. **Code (implementation validation):** Confirm all changes align with `.squad/decisions.md` recommendations.
3. **Validation (regression check):** Re-run `npm run v2:build` before final push.

**Estimated effort:** 1-2 hours Lead review + 30 min re-validation.

---

## Worktree Status

Several worktrees exist with related work:

- `code/issue-103-bound-editor-review-context` (merged via PR #105)
- `code/issue-108-retrospectives` (pending, separate effort)
- `code/issue-109-article-detail-observability` (pending, separate effort)
- `fix/issue-111-publish-ui` (merged via PR #113)

**No conflicts.** Main integrates the shipped fixes; other branches remain independent.

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|-----------|
| DB migration (schema.sql) | Low | Schema changes are additive (new columns). Backward-compatible. No rollback needed. |
| API mismatch (Substack draft URL) | Low | `publishToSubstack.ts` validated against nflverse mock. Tests cover happy path + error states. |
| Preview rendering divergence | Low | Publish page now reuses `preview.ts` utilities. Shared path eliminates drift. |
| HTMX target conflict | Low | Fixed in PR #113; HTNX targets now unified (`#publish-actions` for draft + publish). |
| LLM mock divergence | Low | Mock provider updated to match decision contract. Tests validate structure before Stage 5→6. |

**Overall:** Very low risk. All critical paths tested. Decisions locked. Ready for merge.

---

## Next Steps

1. **This Turn:** Merge this session log to `.squad/log/`.
2. **Code Review (Lead):** Review core architecture changes in engine.ts, actions.ts, schema.
3. **Final Validation:** `npm run v2:build` + manual spot-checks on staging (optional).
4. **Merge:** Push main → origin/main (with or without feature branch, per Lead decision).
5. **Post-Merge:** Update agent histories, close related issues (#82, #107, #111, #113).

---

## Key Files for Review

| File | Change Type | Impact |
|------|-------------|--------|
| `src/pipeline/engine.ts` | Core | Stage 5→6 TLDR validation; Stage 7→8 guards |
| `src/pipeline/actions.ts` | Core | Draft structure self-heal; conversation context; publish sync |
| `src/dashboard/views/publish.ts` | UI | Richer preview reuse; unified workflow panel |
| `src/db/schema.sql` | Schema | `article.substack_draft_url`, `article.substack_url`, conversation columns |
| `src/config/defaults/skills/substack-article.md` | Contract | Canonical TLDR article skeleton |
| `tests/pipeline/engine.test.ts` | Test | TLDR validation + Stage 7→8 guards |
| `tests/dashboard/publish.test.ts` | Test | Draft creation + publish + Note/Tweet workflows |

---

## Decision Inbox Status

✅ **All inbox files merged to `decisions.md`:**
- Code publication workflow (PR #113 conflict)
- Publish error handling + UX
- Publisher draft-first model
- UX publish flow overhaul
- TLDR contract enforcement

No outstanding inbox files remain.
