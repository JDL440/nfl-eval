---
name: "image-review"
description: "How Editor reviews inline images in NFL Lab articles — model requirements, what to check, verdict format"
domain: "content-production"
confidence: "medium"
source: "established 2026-03-15 — discovered Haiku cannot review images; vision model required"
---

# Image Review — Skill

> **Confidence:** medium — pattern established 2026-03-15 after discovering that non-vision models (Haiku) cannot actually evaluate image content.
> **Owned by:** Editor (reviews), Writer (generates), Joe (final approval in Substack editor)

## Critical Requirement: Vision Model

**Editor MUST use `claude-opus-4.5` (or another vision-capable model) when reviewing images.**

Non-vision models (Haiku, Sonnet without vision) cannot see image file contents. They can only check:
- Whether image files exist on disk
- Alt text accuracy (text-only)
- Filename conventions

This is insufficient for a real image review. **Always spawn Editor with `model: "claude-opus-4.5"` for any review that includes images.**

---

## What to Review

### Per Article: 2 inline images
Per the NFL Lab standard (directive 2026-03-15), articles contain **exactly 2 inline images — no cover/banner**. Editor reviews both inline images.

### Evaluation Criteria

**Relevance**
- Does the image match the section it's placed in? An abstract stadium shot dropped next to a cap table is misleading.
- Does the alt text accurately describe what's in the image? Mismatched alt text is a fact error.

**Visual quality**
- Is the image sharp and publication-quality? (blurry, pixelated = 🔴)
- Does the composition work in a 1:1 square crop on mobile?
- Does it look like editorial sports content — not a stock photo or AI-garbage?

**Tone alignment**
- Does the image feel consistent with NFL Lab's voice — analytical, premium, "The Ringer meets OverTheCap"?
- Does it break up text effectively for a mobile reader scrolling through a long article?
- Player likenesses (when present): is it recognizable and editorial-quality, or off-model/uncanny?

**Technical flags**
- Visible text, numbers, or watermarks embedded in the image (Gemini sometimes generates these)
- Aspect ratio issues that would look broken on Substack (inline should be 1:1)
- Duplicate check: Are all inline images visually distinct from each other? If two images look the same or nearly the same, reject both and require regeneration. (See also: Uniqueness Check in image-generation skill.)

---

## How to View Images

Images live at `content/images/{slug}/`. Use the `view` tool with the image path — vision-capable models can render and evaluate the image inline.

```
view("content/images/jsn-extension-preview/jsn-extension-preview-inline.png")
```

View each image file directly. Do not rely on filenames alone.

---

## Verdict Format

Image review appears as a subsection of the standard Editor report:

```markdown
## 🖼️ IMAGE REVIEW

| # | File | Placement in Article | Status | Note |
|---|------|----------------------|--------|------|
| 1 | jsn-extension-preview-inline.png | After intro, before section 2 | ✅ | JSN in stride, editorial quality, breaks text well |
| 2 | jsn-extension-preview-inline-3-cap.png | After cap table | 🟡 | Abstract/generic — acceptable but not great |

**Overall image verdict:** 🟡 REVISE — Inline 2 should be regenerated if time allows
```

Status values:
- ✅ **Keep** — image works for the placement, no issues
- 🟡 **Flag** — usable but suboptimal; document the concern, don't block publish
- 🔴 **Replace** — blocks publish; must be regenerated before article goes live

---

## Known AI Failure Patterns — Always 🔴 REPLACE

These are not style issues. These are **credibility failures** that must block publish:

### 1. Fabricated data visualizations
AI-generated "charts" and "graphs" frequently contain:
- Numbers that are impossible or internally inconsistent (e.g., cap percentages that sum to 180%)
- Axis labels that don't match the data being shown
- Team stats, player stats, or contract figures that are made up and contradict the article
- Bar charts, line graphs, or tables rendered as image text that cannot be verified

**🔴 REPLACE any image that contains a chart, graph, or numeric data visualization.** The data in the image can't be verified and is likely fabricated.

### 2. Fake player identity (jersey numbers and names)
When AI generates images of players in uniform, it often invents:
- Player numbers that don't belong to any real player on the team
- Player names on the back of jerseys that are misspelled or entirely fabricated
- The wrong team colors on what appears to be a real player

**🔴 REPLACE any image that shows an NFL jersey with a visible player name or number.** If the number or name can't be verified against the actual team roster, it's a fact error embedded in the image.

### 3. Embedded text that contradicts the article
AI images sometimes contain paragraph-length captions, headlines, or stats overlaid as text:
- Contract figures that differ from the article's figures
- Player names spelled wrong
- Dates or team names that are wrong

**🔴 REPLACE any image that contains text overlay with specific facts (names, numbers, dates) unless every word and figure has been verified.**

---

## When to Flag for Regeneration

Always flag 🔴 if:
- Visible text/watermarks in the image (unless fully verified)
- Image contains any chart, graph, or numeric data visualization
- Image shows an NFL jersey with a player name or number visible
- Image is obviously off-topic (wrong sport, wrong context)
- Image is blurry or broken

Flag 🟡 if:
- Image is generic but not misleading (acceptable, note it)
- Player likeness is recognizable but slightly off (no jersey numbers/names visible)
- Good image but slightly wrong placement in the article

---

## Validated On

- ✅ JSN extension preview article (2026-03-15) — 7 images reviewed with claude-opus-4.5
- ❌ Do NOT use Haiku or Sonnet for image review — they cannot see image content
- ❌ Do NOT rely on filenames to infer image quality — always view the actual file
