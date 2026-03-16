---
name: "substack-publishing"
description: "How to prepare and publish articles to Substack using the publish_to_substack tool"
domain: "content-production"
confidence: "high"
source: "validated via API exploration on 2026-03-15"
---

# Substack Publishing — Skill

> **Confidence:** high — validated end-to-end against nfllabstage.substack.com
> **Created:** 2026-03-15
> **Owned by:** Writer (formatting), Lead (triggers publish), Joe (final review + publish click)

## Purpose

How to prepare a markdown article file so it publishes cleanly to Substack — including images, tables, YouTube embeds, and all formatting. This is the reference for Writer, Editor, and Lead when preparing articles for Stage 7.

---

## How Publishing Works

```
content/articles/{slug}.md   →   publish_to_substack tool   →   Substack draft
                                                                        ↓
                                                               Joe reviews in editor
                                                                        ↓
                                                               Joe clicks Publish
```

The `publish_to_substack` Copilot extension converts the article markdown to Substack's native format (ProseMirror JSON) and creates a draft. Joe gets a direct editor URL — no copy-paste required.

**Requires:** `SUBSTACK_TOKEN` and `SUBSTACK_PUBLICATION_URL` in `.env` (see `.env.example` for one-time setup).

---

## Calling the Tool

```
publish_to_substack(
  file_path: "content/articles/{slug}.md",
  title: "Final headline",           ← optional: auto-extracted from first # heading
  subtitle: "One-line hook",         ← optional: auto-extracted from first *italic* line
  audience: "everyone"               ← "everyone" (default) or "only_paid"
  team: "Seattle Seahawks"           ← optional: auto-detected from pipeline.db; override only if needed
)
```

Title and subtitle are auto-extracted from the markdown if not provided:
- **Title** → first `# Heading` line
- **Subtitle** → first line that is `*wrapped in single asterisks*` (the standard subheadline format)

The `team` parameter accepts full or partial team names — `"Seahawks"` matches `"Seattle Seahawks"`. When provided (or auto-detected from `pipeline.db`), the team name is added as a tag on the draft. Specialist agents who contributed artifacts in the article directory are also auto-tagged.

---

## Supported Markdown Syntax

Everything here converts cleanly to Substack format.

### Text & Structure

| Markdown | Substack output |
|----------|----------------|
| `# Title` | H1 heading |
| `## Section` | H2 heading |
| `### Subsection` | H3 heading |
| `---` | Horizontal divider |
| `**bold**` | Bold text |
| `*italic*` or `_italic_` | Italic text |
| `***bold italic***` | Bold + italic |
| `[text](url)` | Hyperlink |
| `> blockquote text` | Indented quote block |
| `- item` or `* item` | Unordered (bullet) list |
| `1. item` | Ordered (numbered) list |

### Tables

Standard markdown tables do **not** survive as native HTML tables in this workflow. The publisher only converts short, scannable tables into structured lists so the content stays readable inside Substack:

```markdown
| Priority | Position | Current State | Severity |
|----------|----------|--------------|----------|
| 1 | OL — Left tackle, center | Worst-graded OL in 2024; LT and C are both critical needs | 🔴 HIGH |
| 2 | WR — No separator | Douglas (slot), thin boundary corps, no vertical threat | 🔴 HIGH |
```

Dense or layout-sensitive tables now fail at publish time instead of silently flattening into a bad inline list. When that happens, use the `render_table_image` extension to create a deterministic local PNG and embed that instead. This repo-native renderer is the core MVP path for dense tables because it preserves visual hierarchy and email fidelity without depending on interactive embeds. The renderer writes assets under `content/images/{slug}/`, and article references from `draft.md` should typically resolve as `../../images/{slug}/file.png`.

Datawrapper is a **secondary / optional** tool, not the default implementation path. It may still be useful for special hosted cases, but it is explicitly de-prioritized for MVP table publishing because interactivity is not required and dense tables now have a deterministic in-repo rendering path.

### Images

Use standard markdown image syntax. Both **local files** and **remote URLs** are supported:

```markdown
![Alt text](./images/my-chart.png)
![Alt text](https://example.com/image.jpg)
```

With a caption (two options — both work for local and remote):

```markdown
![Alt text|This caption appears below the image](./images/my-chart.png)

![Alt text](https://example.com/image.jpg "This caption appears below the image")
```

**Local images are automatically uploaded.** If the path doesn't start with `http://` or `https://`, the extension uploads the file to Substack's CDN (S3) before creating the draft. The image is replaced with a permanent `substack-post-media.s3.amazonaws.com` URL in the draft. Supported formats: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`.

Paths are resolved relative to the article file, so `./images/chart.png` means the `images/` folder next to the article.

**Remote URLs** are passed through as-is — no upload needed. Any publicly accessible URL works.

**Cover image:** Set in the Substack editor during Stage 8 — not set via the publishing tool.

### YouTube Embeds

Use the `::youtube` custom syntax (not standard markdown — Substack has a native embed):

```markdown
::youtube dQw4w9WgXcQ

::youtube https://youtu.be/dQw4w9WgXcQ

::youtube https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

All three formats resolve to the same embed. The video appears as a native player in Substack, not a link.

---

## What Gets Handled Manually (in Substack Editor)

A few things are best done by Joe during Stage 8 review — they don't need to be in the markdown:

| Element | How to handle |
|---------|--------------|
| **Cover image** | Upload/select in Substack editor |
| **URL slug** | Edit in Substack editor (default: auto-generated from title) |
| **Tags** | Auto-applied by the tool (team + specialist agents) |
| **Scheduled publish time** | Set in Substack editor |
| **Paywall placement** | Set in Substack editor |
| **Twitter/X embeds** | Paste tweet URL in Substack editor |
| **Spotify/SoundCloud embeds** | Paste URL in Substack editor |

---

## Article File Conventions (for Writer)

Follow these conventions so the tool extracts metadata correctly and the article looks great in Substack:

```markdown
# Article Headline Here

*Subheadline: one-line hook for the email preview*

---

**By: The NFL Lab Expert Panel**

[opening paragraphs...]

---

## Section Heading

Content...

> *"Expert quote goes here." — Expert Name*

| Col 1 | Col 2 | Col 3 |
|-------|-------|-------|
| data  | data  | data  |

---

## Another Section

![Descriptive alt text|Caption shown below image](./images/cap-chart.png)

::youtube VIDEO_ID_HERE

---

*About the NFL Lab Expert Panel: [boilerplate...]*

*Want us to evaluate a scenario? Drop it in the comments.*

---

**Next from the panel:** [tease next article]
```

**Key rules:**
- First line must be `# The Headline` (no blank lines before it)
- Second non-blank line should be `*The subtitle in single asterisks*`
- Every `---` becomes a visual divider (good for separating major sections)
- Image URLs must be publicly accessible — test by opening in a browser first
- YouTube: use `::youtube` syntax, not markdown links

---

## What Substack Supports (Full Node Type Reference)

Discovered by inspecting real Substack drafts via the API:

| Node Type | How to create | Notes |
|-----------|--------------|-------|
| `heading` | `# ## ###` | Levels 1–3 |
| `paragraph` | Normal text | |
| `horizontal_rule` | `---` | |
| `blockquote` | `> text` | |
| markdown table block | `\| col \| col \|` | Converted to ordered/bullet lists, not native tables |
| `bullet_list` / `list_item` | `- item` | |
| `ordered_list` / `list_item` | `1. item` | |
| `captionedImage` + `image2` | `![alt](./local.jpg)` or `![alt](https://url)` | Local files auto-uploaded to S3 |
| `youtube2` | `::youtube ID` | Native player embed |
| `twitter2` | Manual in editor | Paste tweet URL |
| `vimeo` | Manual in editor | Paste Vimeo URL |
| `spotify2` | Manual in editor | Paste Spotify URL |
| `soundcloud` | Manual in editor | Paste SoundCloud URL |

**Bold** uses `strong` mark; **italic** uses `em` mark internally (both render correctly).

---

## Quick Reference for Each Role

### Writer
- Use `# Title` as the very first line
- Use `*Subtitle*` as the second line (single asterisks)
- Use `![alt|caption](./images/file.jpg)` for local images — just drop the file next to the article or in an `images/` subfolder
- Use `![alt|caption](https://url)` for remote images — any public URL works
- Use `::youtube VIDEO_ID` for video embeds
- Use markdown tables for short ranking, checklist, or label/value tables only
- Use `render_table_image` when a table is dense, comparison-heavy, or its layout carries editorial meaning
- Treat Datawrapper as optional only; do not make it the default table workflow
- Don't worry about cover image — Joe handles that in the editor

### Editor
- Check that the first line is `# Title` with no leading blank line
- Check that image URLs actually load (open in browser to verify)
- Check `::youtube` IDs are valid (11-character IDs or full YouTube URLs)
- Flag any images that need to be sourced before publishing

### Lead
- After Editor approval, call `publish_to_substack(file_path: "content/articles/{slug}.md")`
- The tool **auto-detects the team** by looking up `primary_team` in `content/pipeline.db` — no `team` param needed
- Tags are applied automatically: the team name + any specialist agents whose artifacts are in the article directory
- Pass `team:` explicitly only if the DB lookup won't have the right value (rare)
- Pass explicit `title` and `subtitle` if you want to override the auto-extracted values
- Give Joe the returned draft URL — that's all that's needed for Stage 8
- Post the Publisher Pass checklist from `article-lifecycle` SKILL alongside the URL

---

## Auth Failure Recovery

If `publish_to_substack` returns `"Invalid SUBSTACK_TOKEN"` or an auth error:

1. **Generate a fresh token.** The `substack.sid` cookie expires or changes when you log out.
2. Open Edge → DevTools (F12) → Application → Cookies → `nfllabstage.substack.com` (or your publication domain)
3. Copy the value of `substack.sid`
4. Run in the repo root:
   ```
   node -e "console.log(Buffer.from(JSON.stringify({substack_sid:'PASTE_VALUE_HERE'})).toString('base64'))"
   ```
5. Paste the output into `.env` as `SUBSTACK_TOKEN=...`

**Only `substack_sid` is required.** `connect_sid` is NOT needed — the extension falls back to `substack_sid` automatically.

### Can Copilot fetch the cookie automatically?

**Short answer: no, not reliably on Windows with Edge running.**

Attempts made (2026-03-15):

| Method | Result |
|--------|--------|
| `browser_cookie3.edge()` (Python) | Fails — requires admin for Windows shadow copy |
| `Copy-Item` on Edge cookie SQLite file | Fails — Edge holds an exclusive lock while running |
| `CreateFileW` with `FILE_SHARE_READ\|WRITE\|DELETE` flags (ctypes) | Fails — handle returns -1, access denied |

**Root cause:** Edge on Windows 10/11 holds an exclusive lock on `%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Network\Cookies` while running. The lock cannot be bypassed without either (a) admin/shadow copy privileges, or (b) closing Edge first.

**If Edge is closed:** `browser_cookie3.edge()` would work. But Edge is typically running when Copilot is in use.

**Workaround:** Ask the user to paste `substack.sid` directly (as was done on 2026-03-15). This is the fastest path. Add fetching from user input as the first step in auth recovery.

---

## Validated On

- ✅ Full article draft: `jsn-extension-preview/draft.md` → Draft ID 191073429 (2026-03-15)
- ✅ Full article draft: `witherspoon-extension-cap-vs-agent.md` → Draft ID 191061865 (2026-03-15)
- ✅ Local image auto-upload: `./test-local.jpg` → `substack-post-media.s3.amazonaws.com` S3 URL (2026-03-15)
- ✅ Auth: cookie-based via `SUBSTACK_TOKEN` (base64 encoded `substack_sid` only — `connect_sid` not needed)
- ✅ Author ID resolution: `GET /api/v1/user/profile/self` on publication subdomain
