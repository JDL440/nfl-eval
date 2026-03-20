# Investigation Context: Substack Draft Visibility Gap

**Timestamp:** 2026-03-17  
**Agent:** Scribe  
**Trigger:** Coordinator report — Substack drafts not visible despite Stage 7 transitions  

---

## Problem Statement

Drafts previously reported as created via Stage 7 cleanup are not appearing in Substack publish interface or history. This creates a discrepancy between:
- **Expected State:** Draft persists post-Stage-7 in Substack
- **Observed State:** Draft URL or draft entries missing/inaccessible

---

## Known Context from Prior Sessions

### Recent Stage 7 Transitions
- **MIA Tua Dead Cap Article** (2026-03-16)
  - Draft created: https://nfllab.substack.com/publish/post/191150015 (reported as not published)
  - PNG table image rendered and saved
  - Markdown updated with image reference
  - **Status:** Marked as "ready for publication (on user signal)"
  - **Note:** DB stage transition was deferred (JS → Python layer gap)

### Related Decision Context
- **lead-tua-publish-retro.md** (merged 2026-03-16T16:59:13Z)
  - URL persistence flagged as priority #1 in Publisher skill
  - Pre-flight table density audit recommended
  
### Publishing Infrastructure Issues (Recent)
- Dense table density checks blocking direct Substack publish
- Workaround: PNG rendering via `renderer-core.mjs`
- Data layer (Python) vs. JS context gap for stage updates

---

## Investigation Scope

**Not Merged Yet** — Awaiting inbox files before decision closure:
- [ ] Confirm whether draft URLs actually exist in Substack interface
- [ ] Check if URLs were invalidated post-creation
- [ ] Verify whether DB stage *was* updated (despite JS/Python gap)
- [ ] Determine if draft visibility is a Substack API issue vs. local context issue

---

## Next Steps for Coordinator

1. **Verify Draft Accessibility**
   - Check Substack dashboard for draft(s) matching known URLs
   - Confirm whether URLs are still active

2. **Trace Stage Transitions**
   - Check pipeline DB for actual stage values on affected articles
   - Compare reported vs. actual transition status

3. **Review Python Layer Logic**
   - Confirm DB updates are properly persisted when deferred
   - Check for any async update failures post-Stage-7

---

## References
- Log: `.squad/log/2026-03-16-mia-tua-substack-draft.md`
- Decision: `lead-tua-publish-retro.md` (merged)
- Orchestration: `2026-03-16T16-59-13Z-Scribe.md`
