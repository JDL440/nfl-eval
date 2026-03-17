---
name: "publisher"
description: "Stage 7 Publisher agent role — final article prep, metadata, image placement verification, and Substack upload"
domain: "content-production"
confidence: "medium"
source: "designed 2026-03-15 — based on validated substack-publishing skill and article-lifecycle Stage 7"
---

# Publisher — Skill

> **Confidence:** medium — role designed 2026-03-15; individual components (publish_to_substack, image upload) are validated
> **Created:** 2026-03-15
> **Owned by:** Publisher agent (or Lead standing in) at Stage 7

## Purpose

The Publisher agent takes an Editor-approved article with images and prepares it for Substack publication. This is **not** editorial review (that's Stage 6 — Editor's job). The Publisher focuses on formatting, metadata, image placement, and calling the publishing tool to produce a Substack draft URL for Joe's final approval.

---

## When to Run

Stage 7 — after Editor issues a ✅ APPROVED verdict and all 🔴 errors are resolved.

```
Editor: ✅ APPROVED → Publisher: prep + publish → Joe: draft URL review + one-click publish
```

---

## Publisher Checklist

Run this in order. Each step is a gate before the next.

### Step 1 — Article File Verification

Open `content/articles/{slug}.md` and verify:

- [ ] **First line** is `# The Headline` — no blank lines before it
- [ ] **Second non-blank line** is `*The subtitle in italics*` (single asterisks)
- [ ] No `TODO`, `[PLACEHOLDER]`, `{FIXME}`, or `...fill in...` markers remain
- [ ] No stale date references (e.g., "upcoming Draft" when it already happened)
- [ ] Author line present: `**By: The NFL Lab Expert Panel**`
- [ ] Boilerplate footer present: "War Room" brand footer (virtual front office + human editor + War Room) + CTA + next article tease
- [ ] "Next from the panel" tease references a real upcoming article idea and reads like a cliffhanger

### Step 2 — Image Placement Verification

**Image policy (current):**
- **Exactly 2 inline images** in article markdown body
- **NO cover image** in article markdown — Substack post cover is set manually in the Substack editor by Joe at Stage 8
- **inline-1 MUST be a hero/atmospheric image** — it drives the social share thumbnail. NOT a chart, table, or dense data image.
- **inline-2** can be analytical or data-adjacent
- Images rendered at `imageSize: "normal"` (text column width), NOT full-bleed

**Checklist:**

- [ ] **No cover image** in the article markdown body — cover is NOT rendered inline; it's set in Substack editor
- [ ] **Exactly 2 inline images** present in the article body
- [ ] **First image (inline-1) is hero-safe** — not a chart, table, or data visualization (the publisher extension will warn/swap if not, but it's better to get this right)
- [ ] Both inline images use correct syntax: `![alt text](../../images/{slug}/filename.png)`
- [ ] Both inline images are named `{slug}-inline-1.png` and `{slug}-inline-2.png`
- [ ] Both inline images have descriptive alt text (no empty `![]()`)
- [ ] Both image files exist: verify `content/images/{slug}/` contains the referenced filenames
- [ ] No broken image references (paths with typos, wrong extensions, missing files)

**Inline image placement guidelines:**
- Place first inline image after the first major data table or argument (~line 35–40)
- Place second inline image at a natural tension point in the middle section (~line 85–95)
- Do NOT place images in the closing section or after the verdict

### Step 2b — Subscribe Button Verification

**Subscribe button policy:** Every published article includes **2 subscribe-with-caption widgets** — one after the opening hook and one near the closing.

**The publisher extension auto-injects these at publish time**, so manual placement is optional. However, for precise control, add `::subscribe` markers in the article markdown where you want the buttons:

```markdown
{Opening paragraphs}

::subscribe

---

## Section 1
...

{Closing paragraph}

::subscribe

---
```

- [ ] **Two `::subscribe` markers** in the article body (optional — auto-injected if missing)
- [ ] First `::subscribe` is after the opening hook, before the first section heading
- [ ] Second `::subscribe` is near the end, before boilerplate / "Next from the panel"

### Step 3 — Final Content Read-Through

A fast pass — Editor already did the deep review. Publisher checks for issues that slip through:

- [ ] All player names spelled correctly (one last check — these are brand reputation items)
- [ ] All cap figures and contract numbers are current (these move fast)
- [ ] No orphaned section headings with no content below them
- [ ] Tables are properly formatted (pipes aligned, header row separator present)
- [ ] All `> blockquote` expert quotes have attribution (`— Expert Name`)
- [ ] All `::youtube VIDEO_ID` embeds use valid 11-character IDs (if present)

### Step 4 — Metadata Preparation

Prepare the Substack metadata before calling the tool:

| Field | Source | Example |
|-------|--------|---------|
| **title** | First `# heading` in article (may refine) | "Our Cap Expert Says $27M. His Agent Wants $33M." |
| **subtitle** | First `*italic*` line (may refine) | "Devon Witherspoon's extension: inside the gap" |
| **audience** | Per editorial calendar | `"everyone"` (default) or `"only_paid"` |

**Title refinement:** The working title is set by Writer, but Publisher can suggest a final refinement for email open rate. Keep it substantive — don't clickbait.

### Step 5 — Call publish_to_substack

**Prod-first:** Target `"prod"` by default. Only use `"stage"` when explicitly testing new functionality (e.g. table rendering, mobile layout).

```
publish_to_substack(
  file_path: "content/articles/{slug}.md",
  target: "prod",                    ← "prod" (default) or "stage" (opt-in for testing)
  title: "{final headline}",
  subtitle: "{1-line hook for email preview}",
  audience: "everyone",
  team: "{Team Name}"              ← auto-tags the draft with this team (+ specialist agents)
)
```

The tool returns a direct Substack editor URL. If a stored draft URL exists in `pipeline.db` for this article, the tool **updates the existing draft** instead of creating a new one.

**Published-article guard:** The tool will refuse to operate on articles that are already published (Stage 8 / status `published`). This is a hard safety guard — there is no override.

**Manual override:** To update a specific draft, pass `draft_url` explicitly:
```
publish_to_substack(
  file_path: "content/articles/{slug}.md",
  target: "prod",
  draft_url: "https://nfllab.substack.com/publish/post/{DRAFT_ID}"
)
```

### Step 5b — Record Stage 7 + Draft URL in Pipeline DB

After `publish_to_substack` returns successfully, record the publisher pass, stage transition, **and draft URL**:

```python
from content.pipeline_state import PipelineState

with PipelineState() as ps:
    # For NEW drafts (first publish from Stage 6):
    ps.advance_stage('{slug}', from_stage=6, to_stage=7, agent='Publisher',
                     notes='Publisher pass complete. Draft URL: {url}')
    ps.set_draft_url('{slug}', '{url}')
    ps.record_publisher_pass('{slug}',
        title_final=1, subtitle_final=1, body_clean=1,
        section_assigned=1, tags_set=1, url_slug_set=1,
        names_verified=1, numbers_current=1, no_stale_refs=1)

    # For UPDATES (article already at Stage 7):
    # ps.set_draft_url('{slug}', '{url}')   # just refresh the URL — no stage transition needed
```

**Note:** The `publish_to_substack` extension does NOT write back to pipeline.db. The calling agent (Lead or Publisher) is responsible for this step using the shared helper.

**Note:** `set_draft_url()` includes the published-article guard — it will raise `ValueError` if the article is Stage 8 or status `published`.

### Step 6 — Hand Off to Joe

Post the following to the article thread:

```markdown
## 🚀 Publisher Pass Complete — {Article Title}

**Substack Draft URL:** {URL returned by tool}

**Pre-publish checklist for Joe (Stage 8):**
- [ ] Cover image: select in Substack editor (generated image is in article body; also set as post thumbnail)
- [ ] URL slug: verify it's clean and SEO-friendly
- [ ] Section/tags: tags are auto-applied by the tool (team + specialist agents); add any extras manually
- [ ] Paywall setting: free / paid-only / preview paywall
- [ ] Publish date/time: per editorial calendar (default: Tuesday 10 AM PT)
- [ ] Email send: yes/no (default: yes)
- [ ] Follow-on idea issue: create or confirm the teased next-article GitHub issue for Thursday of the publication week

**Images generated:**
{list image filenames and types from content/images/{slug}/}

**Article stats:**
- Word count: ~{N} words
- Sections: {N}
- Expert quotes: {N}
- Tables: {N}
- Images: {N} (cover: {N}, inline: {N})
```

---

## Common Issues and Fixes

| Issue | Fix |
|-------|-----|
| Image file missing | Re-run `generate_article_images` for that image type |
| Broken image path | Fix path in article markdown — check `./images/{slug}/` directory |
| Title too long for email | Shorten to ~60 characters for email subject preview |
| `publish_to_substack` returns auth error | `SUBSTACK_TOKEN` expired — see `.env.example` for refresh instructions |
| Article body contains raw HTML | Convert to markdown equivalent |
| Table formatting broken | Verify pipe-separated format with `---` separator row |

---

## Publisher vs. Editor — Role Distinction

| | Editor (Stage 6) | Publisher (Stage 7) |
|---|---|---|
| **Focus** | Accuracy + editorial quality | Formatting + publish readiness |
| **Checks** | Facts, stats, structure, style | Images, metadata, syntax, file paths |
| **Output** | Verdict (APPROVED/REVISE/REJECT) | Draft URL + handoff checklist |
| **Can reject?** | Yes — sends back to Writer | No — escalates to Joe or back to Editor |
| **Mindset** | "Is this article good?" | "Is this article ready to ship?" |

Publisher does **not** re-evaluate editorial quality. If Publisher finds a new factual error, they flag it to Editor (not fix it themselves).

### Post-Publish Follow-On Rule

Once Joe publishes the article live, Lead (or the publishing owner) should create or confirm the next teased article as a GitHub idea issue. Default scheduling rule for now: target **Thursday of the same publication week** so the cliffhanger at the bottom of one article immediately feeds the next article in the pipeline.

---

## Relationship to Other Skills

- **Before Publisher:** [`article-lifecycle`](../article-lifecycle/SKILL.md) Stage 6 (Editor must be ✅ APPROVED)
- **Image source:** [`image-generation`](../image-generation/SKILL.md) — images should already exist from Stage 5
- **Publishing mechanics:** [`substack-publishing`](../substack-publishing/SKILL.md) — full syntax reference
- **After Publisher:** Joe runs Stage 8 (Approval / Publish)
