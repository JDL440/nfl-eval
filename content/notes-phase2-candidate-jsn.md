# Phase 2 Promotion Note Package — Jaxon Smith-Njigba Extension

> **Status:** Candidate package ready for nfllabstage posting (NOT posted)
> **Article:** jsn-extension-preview  
> **Stage Draft URL:** https://nfllabstage.substack.com/publish/post/{DRAFT_ID}  
> **Author:** Writer (NFL Lab)  
> **Date Prepared:** 2026-03-18  
> **Target:** nfllabstage validation before production

---

## Executive Summary

A structured promotion Note that drives traffic to a real NFL Lab article (JSN extension decision) on nfllabstage. This is Phase 2 of the Notes rollout — moving from smoke tests to production-like Note patterns on stage.

**Key learning from Phase 1:** Notes must be short, punchy, and link-complete. Image is optional but recommended for feed visibility.

---

## Note Copy — Primary Variant

### Headline (teaser text)

**JSN's $3.4M. Lamb's $34M. Shaheed's $17M.**

Jaxon Smith-Njigba is three years into his deal and 90% below market. His agent just got a gift from Seattle's own front office.

Our panel breaks the four extension paths — and why waiting costs $33 million more than you think.

---

## Note Details

| Field | Value |
|-------|-------|
| **Type** | Article promotion Note (linked to draft) |
| **Content Length** | ~120 words (ProseMirror body text) |
| **Image Attachment** | Recommended — see below |
| **Link Target** | `https://nfllabstage.substack.com/publish/post/{jsn_draft_id}` |
| **Link Placement** | Final paragraph as inline link |
| **Target Audience** | Seahawks fans, cap nerds, extension strategists |
| **Tone** | Urgent, competitive, data-forward |
| **Posting Platform** | nfllabstage.substack.com |
| **Posting Status** | 🟢 Ready for manual post; NOT auto-posted |

---

## Exact Note Body (ProseMirror Assembly)

This is the plain-text input that will be converted to ProseMirror `bodyJson` by the `publish_note_to_substack` tool:

```
JSN's $3.4M. Lamb's $34M. Shaheed's $17M.

Jaxon Smith-Njigba is three years into his deal earning 90% below market value. 
Seattle just signed Rashid Shaheed (WR2) for $17M/year. JSN's agent noticed.

Our panel breaks the four extension paths: extend now? 5th-year option? Franchise tag? 
The $30M trap: why waiting costs $33 million more in total contract value through 2030.

Cap expert says the Shaheed deal is JSN's best negotiating weapon. PlayerRep says 
guaranteed cash today is the only real money. SEA says sequence the defense first. 
Offense says he's system-amplified, not elite-independent.

Four experts. One clock ticking.

Read the full breakdown: [full article link]
```

---

## Image Recommendation

**Image:** `content/images/jsn-extension-preview/jsn-extension-preview-inline-1.png` (1024×1024)

**Why this image:**
- **Editorial asset:** Already generated and approved for the article; same image appears in the published piece
- **Visual hook:** Clean chart/graphic (shows the four extension paths) — highly scannable in Notes feed
- **Aspect ratio:** 1:1 square format (optimal for Substack Notes social rendering)
- **Reusability:** Generic enough to work as a standalone "JSN decision" graphic; no context-specific narrative

**Image attachment format (API payload):**
```json
{
  "url": "https://substack-post-media.s3.amazonaws.com/public/images/{UPLOADED_CDN_HASH}.png",
  "type": "image"
}
```

**Upload workflow:**
1. Source image: `content/images/jsn-extension-preview/jsn-extension-preview-inline-1.png`
2. Upload via `POST /api/v1/image` (standard Substack image endpoint, not Cloudflare-blocked)
3. Receive CDN URL from response
4. Include in Note payload as part of `attachments: [{ url: "...", type: "image" }]`

---

## Link Details

**Stage Draft URL Format:**
```
https://nfllabstage.substack.com/publish/post/{DRAFT_ID}
```

**How to find DRAFT_ID:**
```sql
SELECT substack_draft_url FROM articles WHERE id='jsn-extension-preview';
```

**Expected value from pipeline.db:**
The jsn-extension-preview article should have a draft URL in the format above. If null, the article hasn't been pushed to stage yet; check `publisher-pass.md` in the article folder for status.

**Link text suggestion (inline):**
> Read the full breakdown: [The 4 Paths to JSN's Extension](https://nfllabstage.substack.com/publish/post/...)

---

## Assumptions & Notes

1. **Article readiness:** jsn-extension-preview is at Stage 6-7 (Editor review complete or ready for publish). Draft has been pushed to nfllabstage.substack.com via the publisher extension.

2. **Image asset:**  The inline-1.png image exists and is publication-approved (from the article's own inline images). No new image generation needed; reuse existing asset.

3. **ProseMirror conversion:** The plain-text Note body will be assembled into ProseMirror `bodyJson` format automatically by the `publish_note_to_substack` tool's `noteTextToProseMirror()` function. Writer does not construct ProseMirror JSON manually.

4. **Cloudflare workaround:** Image upload (POST /api/v1/image) is NOT blocked by Cloudflare Bot Management. The final Note POST is blocked for server-side fetch — must use Playwright `page.evaluate(fetch())` pattern (same as Phase 1).

5. **Posting location:** This Note will be posted to **nfllabstage.substack.com** only. No production post until Phase 3. Dry-run validation with `--dry-run` flag will show the assembled ProseMirror and image URL without posting.

6. **Manual confirmation:** Joe Robinson must review the rendered Note on nfllabstage (after posting) before Phase 3 production post is approved.

---

## Voice & Style Notes

**Why this Note works:**
- **Urgency:** "One clock ticking" — forces decision-making narrative
- **Data hooks:** Specific dollar amounts ($3.4M, $34M, $17M, $33M) make the stakes concrete
- **Panelist personality:** Each expert's voice surfaces (Cap's financial precision, PlayerRep's guarantee-cash argument, Offense's system read)
- **Tension:** Contradictory expert positions make the reader want to read the full piece
- **Call-to-action:** Implicit (link to the full breakdown) — not a generic "drop it in the comments"

**Tone consistency with Writer charter:**
- ✅ Informed but not academic (dollar amounts, not financial jargon)
- ✅ Narrative-driven (the four paths as a story, not a list)
- ✅ Confident opinion (cap expert says "it's a trap" — not "it might be")
- ✅ Dry humor (Shaheed gifting JSN's agent ammunition)
- ✅ Data-backed (specific contract comps: Lamb, Jefferson)

---

## Decision Inbox Note

**Title:** Reusable voice pattern — Financial urgency + panelist disagreement

**Finding:** The JSN Note surfaces a reusable pattern for contract/extension articles:
- Lead with the absurd gap (current pay vs. market comps)
- Surface one unexpected variable (Shaheed's deal as negotiating weapon)
- Name each expert's position in telegraphic language
- End with implicit call-to-action (read the breakdown)

This pattern works for any player extension or salary decision. The "clock ticking" frame and the "expert disagreement as the product" positioning are generalizable.

**Recorded in:** Writer history as "Extension negotiation Note template" (2026-03-18)

---

## Validation Checklist — Phase 2

- [ ] **Article status verified:** jsn-extension-preview has substack_draft_url in pipeline.db
- [ ] **Image asset confirmed:** inline-1.png exists at content/images/jsn-extension-preview/
- [ ] **Dry-run test:** `node validate-notes-smoke.mjs --dry-run --target=stage --article=jsn-extension-preview --image=inline-1.png`
  - Expected output: ProseMirror bodyJson assembled, image URL resolved, link substituted, no errors
- [ ] **Rendering check:** After posting to nfllabstage, verify Note appears in the feed
  - Visual check: text readable, image renders, link clickable
  - No corruption of ProseMirror body or image attachment
- [ ] **Link validation:** Click the link in the Note; confirm it navigates to the correct stage draft
- [ ] **Cleanup:** Record Note ID in `content/notes-phase2-results.md` for audit trail
- [ ] **Joe review:** Joe Robinson reviews rendered Note on nfllabstage before proceeding to Phase 3

---

## Next Steps

1. **Pre-posting validation:** Run dry-run smoke test to confirm ProseMirror assembly and image upload path
2. **Manual post:** Post the Note to nfllabstage.substack.com (via Playwright `page.evaluate(fetch())`)
3. **Rendering check:** Verify the Note appears in the nfllabstage feed with correct text, image, and link
4. **Joe approval:** Joe reviews and approves the rendered Note
5. **Cleanup:** Delete the test Note from nfllabstage (HTTP DELETE /api/v1/notes/{id})
6. **Phase 3 prep:** Draft production Note for nfllab.substack.com using the same structure

---

## Files & References

- **Article draft:** `content/articles/jsn-extension-preview/draft.md`
- **Publisher pass artifact:** `content/articles/jsn-extension-preview/publisher-pass.md`
- **Image asset:** `content/images/jsn-extension-preview/jsn-extension-preview-inline-1.png`
- **Validation tool:** `validate-notes-smoke.mjs` (updated for real articles in Phase 2)
- **Notes feature design:** `docs/substack-notes-feature-design.md`
- **API discovery:** `docs/notes-api-discovery.md`
- **Writer history:** `.squad/agents/writer/history.md` (Notes learnings recorded here)

