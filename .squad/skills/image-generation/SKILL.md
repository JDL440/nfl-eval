---
name: "image-generation"
description: "How to generate editorial images for NFL Lab articles using Gemini Imagen 3"
domain: "content-production"
confidence: "medium"
source: "designed 2026-03-15 — Gemini API docs + NFL Lab editorial standards"
---

# Image Generation — Skill

> **Confidence:** medium — API validated, NFL editorial prompting strategy designed but not yet batch-tested
> **Created:** 2026-03-15
> **Owned by:** Writer (triggers generation after draft), Editor (reviews images), Joe (selects cover in Substack)

## Purpose

Generate high-quality editorial images for NFL Lab articles using Google Imagen 3 via the `generate_article_images` Copilot extension. Images are generated **after the Writer produces a draft** so they are available for the Editor to review alongside the text.

**Requires:** `GEMINI_API_KEY` set in `.env` (see `.env.example`). Get a key at https://ai.google.dev/gemini-api/docs/get-api-key

---

## When to Generate Images

Images are generated at **Stage 5 — end of Article Drafting**, immediately after Writer saves the article to `content/articles/{slug}.md`.

```
Writer saves draft → generate_article_images → Editor reviews text + images → Publisher pass
```

Generate at minimum:
- **1–2 cover images** (16:9, for article header) — give Joe options
- **0–2 inline images** (1:1 or 4:3, for body placement) — only when content benefits

---

## How to Call the Tool

```
generate_article_images(
  article_slug: "witherspoon-extension-analysis",
  article_title: "Our Cap Expert Says $27M. His Agent Wants $33M. Here's Who's Right.",
  article_summary: "Devon Witherspoon's contract extension negotiation analyzed by Cap, PlayerRep, and SEA agents — they disagree on value by $6M/year.",
  team: "Seattle Seahawks",
  players: ["Devon Witherspoon"],
  image_types: ["cover", "inline"],
  count_per_type: 2
)
```

The tool:
1. Builds optimized prompts for each image type
2. Calls Imagen 3 (falls back to Gemini Flash if unavailable)
3. Saves images to `content/images/{slug}/`
4. Returns markdown references ready to paste into the article

### Inline image placement

Insert inline images at natural content breaks — between major sections or to illustrate a key data point. A 3,000-word article typically benefits from 1–2 inline images.

```markdown
## Section Heading

{paragraph...}

![Devon Witherspoon extension analysis — inline image 1|Seahawks cornerback market analysis](./images/witherspoon-extension-analysis/witherspoon-extension-analysis-inline-1.png)

{next paragraph...}
```

---

## Image Types and When to Use Them

| Type | Aspect Ratio | Use for | Placement |
|------|-------------|---------|-----------|
| `cover` | 16:9 | Article header, Substack cover | After subtitle line |
| `inline` | 1:1 | Body illustration, section break | Between paragraphs/sections |

---

## Prompt Strategy for NFL Editorial Images

The tool auto-builds prompts, but you can override with `custom_prompts` for specific needs.

### What works well (Imagen 3 strengths)

| Topic | Effective approach |
|-------|--------------------|
| Contract analysis | Abstract money/negotiation imagery — briefcases, handshakes, contract documents, city skylines |
| Roster construction | Puzzle pieces, chessboard, depth chart visualization |
| Draft analysis | Podium spotlight, prospect silhouette, combine imagery |
| Injury analysis | Medical/recovery imagery, sideline scenes |
| Trade evaluation | Two team color palettes, exchange imagery |
| Season preview | Stadium atmosphere, crowd energy, field overhead |
| Cover art (general) | Dramatic stadium lighting, team colors, atmospheric weather |

### Important limitations

⚠️ **Imagen 3 does not generate realistic NFL player likenesses.** Do not expect photorealistic portraits of specific players. Instead:
- Use player names in prompts to provide *context* for the scene/atmosphere
- Lean into abstract, atmospheric, or symbolic interpretations
- The tool includes `personGeneration: "dont_allow"` to keep images on-brand (atmospheric > literal)

### Custom prompt override example

When you need something specific that the auto-prompt won't capture:

```
generate_article_images(
  article_slug: "seahawks-rb-depth-chart",
  article_title: "...",
  custom_prompts: {
    "cover": "Aerial view of an NFL stadium at golden hour, Seattle skyline visible in background, dramatic storm clouds, moody cinematic lighting. No text or logos. Editorial sports photography style.",
    "inline": "Chess pieces on a football field, strategic positioning, shallow depth of field, team colors of navy blue and neon green. No text. Abstract editorial image."
  }
)
```

---

## Output Structure

Images are saved to `content/images/{slug}/`:

```
content/
  articles/
    witherspoon-extension-analysis.md
  images/
    witherspoon-extension-analysis/
      witherspoon-extension-analysis-cover-1.png
      witherspoon-extension-analysis-cover-2.png
      witherspoon-extension-analysis-inline-1.png
```

The tool returns markdown references for each image:

```markdown
![Cover image: Our Cap Expert Says $27M...|Cover image: Our Cap Expert Says $27M...](./images/witherspoon-extension-analysis/witherspoon-extension-analysis-cover-1.png)
```

---

## Cover Image vs. Substack Cover

There are **two** cover image concepts — don't confuse them:

| | What it is | Where it lives | Who sets it |
|---|---|---|---|
| **Article body cover** | Image embedded at top of article body | In the markdown, after the subtitle | Writer (via tool) |
| **Substack post cover** | The thumbnail shown in email/feed | Set in Substack editor, not in markdown | Joe at Stage 8 |

**Best practice:** Generate 2 cover images. Use the best one in the article body. Joe selects one (same or different) as the Substack post cover during the final editor review.

---

## Editor Review of Images

Editor reviews images at Stage 6 alongside the text:

### What Editor checks for images

- [ ] Images are visually appropriate for the article topic
- [ ] No misleading, offensive, or inappropriate content
- [ ] Cover image has strong visual impact (would a reader click on this?)
- [ ] Inline images add value — they're not just filler
- [ ] Alt text is descriptive and accurate (screenreader / SEO)
- [ ] Captions (if used) are accurate and add context
- [ ] Image files exist and paths resolve correctly

### Editor image verdict format

```
🖼️ IMAGES: ✅ APPROVED / 🟡 REVISE / 🔴 REJECT
- Cover 1: [verdict + note]
- Cover 2: [verdict + note]
- Inline 1: [verdict + note]
```

If images are rejected (🔴), Writer calls `generate_article_images` again with a refined prompt.

---

## Models

| Model | Quality | Speed | Use case |
|-------|---------|-------|----------|
| `imagen-4.0-generate-001` | ⭐⭐⭐⭐⭐ | Medium | Default — best quality for editorial headers (requires billing) |
| `gemini-3.1-flash-image-preview` | ⭐⭐⭐⭐ | Fast | Fallback / fast drafts (also requires billing) |
| `gemini-3-pro-image-preview` | ⭐⭐⭐⭐ | Medium | Alternative — "Nano Banana Pro" (the model Joe used manually) |

The tool tries Imagen 3 first and falls back automatically. Override with `use_model: "gemini-flash"` for speed.

---

## Anti-Patterns

- ❌ Don't generate images before the article draft exists — prompts need the article context
- ❌ Don't expect photorealistic player portraits — use atmospheric/editorial prompts instead
- ❌ Don't skip Editor image review — images can be off-brand or inappropriate
- ❌ Don't generate 5+ images per article — 2 covers + 1–2 inline is the right ceiling
- ❌ Don't leave `players: []` empty if the article is player-specific — names help guide atmosphere even if no literal likeness is generated

---

## Cost Reference

- **Imagen 3:** ~$0.03–0.04 per image (varies by account tier)
- **Gemini Flash:** Lower cost, included in some Gemini subscription tiers
- **Typical article:** 3–4 images = ~$0.10–0.16 per article
- Check current pricing at https://ai.google.dev/gemini-api/docs/pricing
