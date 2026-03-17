# Editor Image Review: den-mia-waddle-trade

**Reviewer:** Editor
**Article:** `content/articles/den-mia-waddle-trade/draft.md`
**Review type:** Image policy verification (post-repair)
**Date:** 2026 Offseason

---

## 🖼️ IMAGE REVIEW

### Policy Check: Exactly 2 inline images, no cover in markdown

| Check | Status | Detail |
|-------|--------|--------|
| Inline image count | ✅ | Exactly 2 — line 23 and line 125 |
| Cover image in markdown | ✅ | None embedded (cover set by Joe at Stage 8) |
| Image files exist on disk | ✅ | Both `.jpg` files present in `content/images/den-mia-waddle-trade/` |
| Markdown paths resolve | ✅ | Both use `../../images/den-mia-waddle-trade/` — correct relative path |

### Individual Image Assessment

| Placement | File | Status | Note |
|-----------|------|--------|------|
| After opening hook (line 23) | `den-mia-waddle-trade-inline-1.jpg` | ✅ Keep | Empower Field at Mile High — empty stadium, dramatic sky, Broncos orange/blue color scheme. Strong editorial atmosphere. No text, logos, charts, or jersey numbers. |
| Before "The $5 Million Mirage" (line 125) | `den-mia-waddle-trade-inline-2.jpg` | ✅ Keep | Front-office analysis scene — NFL football, Broncos jacket, open book, scattered documents on desk. Evokes the analytical/cap-study tone of the section it precedes. Wilson/NFL branding on football is real product marking, not AI-fabricated text. |

### AI Failure Pattern Scan

| Pattern | Image 1 | Image 2 |
|---------|---------|---------|
| Fabricated charts/graphs | ✅ None | ✅ None — papers in background are atmospheric props, no legible fabricated data |
| Fake jersey numbers/names | ✅ None | ✅ None — no players or jerseys visible |
| Embedded text with claims | ✅ None | ✅ None — book text is not legible/specific; jacket text consistent with real Broncos merchandise |
| Duplicate images | ✅ Two distinct images | — |

### Alt Text Review

| Image | Alt Text | Status |
|-------|----------|--------|
| Inline 1 | "Denver Broncos trade atmosphere — editorial image" | ✅ Accurately describes the stadium scene |
| Inline 2 | "Waddle trade analysis — editorial image" | ✅ Accurately describes the analysis/desk scene |

### Placement Assessment

- **Image 1** sits after the `::subscribe` marker and before "The Deal" section — serves as a visual reset between the narrative hook and the trade details. Good placement.
- **Image 2** sits between the 2025 season dip analysis and the cap warning section — provides a visual transition into the numbers-heavy back half. Good placement.

---

## What Was Verified

1. ✅ Exactly 2 inline images in markdown (lines 23 and 125)
2. ✅ No cover image embedded in markdown
3. ✅ Both image files exist at the expected paths on disk
4. ✅ Both images visually inspected — no fabricated charts, fake jersey numbers, or problematic embedded text
5. ✅ Alt text is accurate for both images
6. ✅ Placement is contextually appropriate for both images
7. ✅ No structural regressions introduced — article text unchanged from editor-review-2 approval

## What Was NOT Verified

- ❓ Substack draft rendering (prod URL `https://nfllab.substack.com/publish/post/191309007`) — cannot verify whether images render correctly in the Substack editor from this environment. Joe should confirm images display at the expected positions during Stage 8 review.

---

## Verdict: ✅ APPROVED

**Rationale:** The repaired draft satisfies all image policy requirements. Two inline images are present in markdown at appropriate locations, both image files exist on disk, neither contains AI failure patterns (no fabricated charts, fake jerseys, or misleading embedded text), and no cover image is embedded in the markdown. The article text remains unchanged from the previously approved editor-review-2. The only unverified item is Substack-side rendering, which falls under Joe's Stage 8 review scope.

**This article is cleared for publish from an image-policy standpoint.**
