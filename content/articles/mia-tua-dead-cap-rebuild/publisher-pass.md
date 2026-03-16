# Publisher Pass — $99 Million Ghost: How Miami Rebuilds With the Largest Dead Cap Hit in NFL History

**Article:** mia-tua-dead-cap-rebuild
**Date:** 2026-03-16
**Stage:** 7 — Publisher Pass Complete

---

## Content Verification (Lead confirms)

- ✅ **Title:** "$99 Million Ghost: How Miami Rebuilds With the Largest Dead Cap Hit in NFL History"
- ✅ **Subtitle:** "Our expert panel dissects the Dolphins' unprecedented dead money challenge — and why the record-breaking number might not matter as much as you think"
- ✅ **First line:** `# $99 Million Ghost...` (no blank lines before)
- ✅ **Second non-blank line:** `*Italic subtitle*` (present)
- ✅ **Author byline:** "**By: The NFL Lab Expert Panel**" (present, line 13)
- ✅ **No placeholders:** No TODO, PLACEHOLDER, FIXME markers remain
- ✅ **No stale dates:** All references are 2026 offseason / 2025 season stats
- ✅ **Boilerplate footer:** Expert panel description + CTA present (lines 230-232)
- ✅ **Next article tease:** "The Jets' Aaron Rodgers succession plan — and why the 2026 draft may force their hand earlier than they want." (line 236)

## Image Verification

- ✅ **No cover image in markdown** — cover set manually in Substack editor (Stage 8)
- ✅ **Exactly 2 inline image placeholders:**
  1. Line 64: Split-screen infographic comparing MIA dead cap to LAR/DEN precedents
  2. Line 103: Miami Dolphins 2026 roster building blocks visualization
- ✅ **Image format:** Both use `<!-- IMAGE: description -->` comment format
- ✅ **Placement:** First after cap math section (~line 64), second after roster section (~line 103)
- ⚠️ **Image files:** Images need to be generated separately (per lifecycle Stage 4b)
  - Target: `content/images/mia-tua-dead-cap-rebuild/mia-tua-dead-cap-rebuild-inline-1.png`
  - Target: `content/images/mia-tua-dead-cap-rebuild/mia-tua-dead-cap-rebuild-inline-2.png`

## Content Quality (Final read-through)

- ✅ **Player names:** All correctly spelled (Tua Tagovailoa, Malik Willis, De'Von Achane, Chop Robinson, etc.)
- ✅ **Cap figures:** All current and verified by Editor (LAR 12.1%, DEN 20.8%, MIA 18.4%)
- ✅ **Tables:** All properly formatted with pipe separators and header rows
- ✅ **Expert quotes:** All have attribution (`— Cap`, `— MIA`, `— Draft`)
- ✅ **No orphaned headings:** Every section has content below it

## Metadata for Substack

| Field | Value |
|-------|-------|
| **Title** | $99 Million Ghost: How Miami Rebuilds With the Largest Dead Cap Hit in NFL History |
| **Subtitle** | Our expert panel dissects the Dolphins' unprecedented dead money challenge — and why the record-breaking number might not matter as much as you think |
| **Audience** | everyone (free article) |
| **Primary Team** | Miami Dolphins |
| **Secondary Teams** | LAR (Rams), DEN (Broncos) — historical comp context |
| **Topic Tags** | salary-cap, rebuild, dead-money, quarterback, 2027-draft |
| **Specialist Tags** | Cap, Draft, MIA |

## Article Stats

- **Word count:** ~3,400 words
- **Sections:** 6 major sections
- **Expert quotes:** 7 blockquote attributions
- **Tables:** 4 data tables (dead cap comparison, cap math, roster building blocks, panel timeline projections)
- **Images:** 2 inline placeholders (images to be generated)
- **TLDR:** 4-bullet summary (lines 5-9)

---

## Status: READY FOR STAGE 8 (Joe's manual publish)

### Why tool call was skipped:
The `publish_to_substack` Copilot extension tool was not available in the current environment. Per article-lifecycle skill line 26 ("When Joe wants to manually shepherd an article through the Publisher pass"), this article is documented as ready for manual Substack draft creation.

### For Joe — Stage 8 Checklist:

1. **Create Substack draft manually:**
   - Copy content from `content/articles/mia-tua-dead-cap-rebuild/draft-clean.md` (lines 1-237, writer notes removed)
   - Title: "$99 Million Ghost: How Miami Rebuilds With the Largest Dead Cap Hit in NFL History"
   - Subtitle: (see above)
   - Audience: everyone

2. **Cover image:** Select or generate a cover image in Substack editor (not embedded in markdown)

3. **Tags:** Apply team + specialist tags:
   - Primary: `miami-dolphins`
   - Specialists: `salary-cap`, `draft-strategy`, `rebuild`

4. **URL slug:** Verify clean SEO-friendly slug (e.g., `miami-99m-dead-cap-rebuild`)

5. **Publish schedule:** Per editorial calendar (default: Tuesday 10 AM PT)

6. **Email send:** Yes (default for new articles)

7. **Follow-on issue:** Issue #45 (NYJ Aaron Rodgers succession) — verify exists and set target date to Thursday of publication week

---

## Next Steps After Publish

1. Create or confirm GitHub issue #45 for NYJ article (Aaron Rodgers succession plan)
2. Set target publish date to Thursday of the week MIA article goes live
3. Update `content/pipeline.db` with `published_at`, `substack_url`, `status='published'`
4. Update GitHub issue #44 label to `stage:published`

---

**Publisher:** Lead (automated stage)
**Date:** 2026-03-16
**Article status:** Stage 7 complete — ready for Stage 8 (Joe's manual publish)
