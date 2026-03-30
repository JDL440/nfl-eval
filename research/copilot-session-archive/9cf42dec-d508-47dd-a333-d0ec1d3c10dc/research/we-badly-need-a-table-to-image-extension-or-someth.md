# Research Report: Substack Table Options for the NFL Lab Publishing Workflow

Date: 2026-03-16

## Executive Summary

The evidence now points to a stable **two-lane system** for tables in the NFL Lab Substack workflow.

- **Lane A: inline conversion** for short ranking, checklist, or label-value tables. In the current publisher, markdown tables are intentionally converted into ordered or bullet lists because there is **no reliable native HTML-table path** in this workflow.[^publisher-table][^skill-tables]
- **Lane B: deterministic rendered images** for dense or layout-dependent tables. The repo now includes a local `render_table_image` extension that renders markdown tables to branded PNGs, saves them under `content/images/{article-slug}`, and returns ready-to-paste image markdown; the publisher already converts local images into Substack `captionedImage` blocks and uploads them to Substack's image endpoint.[^renderer-overview][^renderer-output][^publisher-images][^publisher-upload]
- The New England proof of concept supports the split approach: the priority table works reasonably well as inline list conversion, while the denser cap table is a better fit for image rendering.[^poc]
- **Datawrapper should remain optional, not primary.** Datawrapper is strong for hosted interactive visuals and it does provide PNG export, but its core embed paths are script/iframe-based and email clients broadly block those mechanisms. For a newsletter-first workflow, that makes interactive Datawrapper a secondary path rather than the default investment.[^dw-embed][^dw-features][^dw-png][^ghost-embeds][^mailchimp-html]

## Bottom-Line Recommendation

Adopt this default policy:

1. **Use inline conversion by default for short tables** where the reader mainly needs ordered priorities, simple comparisons, or a compact checklist.
2. **Use the deterministic local renderer by default for dense tables** where scanning columns, preserving alignment, or maintaining visual hierarchy matters.
3. **Treat Datawrapper as a secondary option** only when a hosted interactive/web-first companion is genuinely useful. If Datawrapper is used, prefer exporting a PNG for the email/Substack path rather than relying on live embeds inside the newsletter.

This recommendation is fully aligned with the updated direction: **raw HTML tables are not the path; dense tables need deterministic images; Datawrapper is useful but de-prioritized because email is the primary distribution channel.**

## What the Repo Evidence Says

### 1) The current Substack publisher already rejects a native table strategy

The strongest evidence is in the publisher itself. `substack-publisher/extension.mjs` explicitly states that "Substack has no reliable HTML-table path for this workflow" and therefore transforms markdown tables into structured lists instead of preserving table markup.[^publisher-table]

The publishing skill says the same thing at the workflow level: standard markdown tables do **not** survive as native HTML tables here, so the tool converts them into structured lists to keep the content readable inside Substack.[^skill-tables] The skill's node-type reference reinforces that markdown table blocks become ordered/bullet lists, not native table nodes.[^skill-node-types]

That means the repo's current, validated publishing path is already built around this assumption:

- **do not depend on HTML tables surviving**
- **preserve meaning with list conversion when possible**
- **switch to images when the table's layout itself carries meaning**

### 2) The repo already has the dense-table solution we need

The `table-image-renderer` extension exists specifically to solve the missing piece: it renders a markdown table to a branded PNG using a local headless browser, and the file header says it is intended for "Substack-safe illustrative tables that need to survive email rendering without relying on HTML table support."[^renderer-overview]

Operationally, the renderer:

- accepts either inline markdown or a source markdown file/table index
- parses the markdown table locally
- renders deterministic HTML/CSS to a PNG
- saves the output in `content/images/{article-slug}`
- returns markdown image syntax with alt text and optional caption for direct article insertion[^renderer-output]

This is important because it is not a speculative workaround; it is already a local, deterministic, repo-native path.

### 3) Local image publishing is already supported end-to-end

The Substack publisher already knows how to turn markdown images into Substack-native image blocks. When it sees markdown image syntax, it builds a `captionedImage` containing an `image2` node.[^publisher-images]

It also auto-uploads local files to Substack by POSTing them to `https://{subdomain}.substack.com/api/v1/image`, then uses the returned remote URL in the draft.[^publisher-upload] The publishing skill documents the same behavior: local images are automatically uploaded to Substack's CDN and captions are supported in markdown.[^skill-images]

So the dense-table image path is not just "generate a PNG"; it is already integrated into draft creation.

### 4) The proof of concept supports a split recommendation, not a single universal format

The New England POC is useful because it tests both kinds of tables in both formats.

- The **priority table** is presented as inline conversion and as a rendered image. The draft's own takeaway says the list treatment may be good enough for rank-order tables because it preserves reading flow and makes labels like `Current State` and `Severity` clearer.[^poc]
- The **cap table** is explicitly described as denser and as the clearest test of whether image-backed tables are worth the extra workflow; the draft notes that inline conversion may be acceptable, but a rendered image carries more editorial impact for dense financial summaries.[^poc]

That is exactly the behavior we want from the policy: do not over-render simple tables, but do not force dense tables through a lossy inline treatment.

## Option Comparison

| Option | What it gives us | Strengths | Weaknesses | Recommendation |
|---|---|---|---|---|
| Raw HTML / native table preservation | Try to keep tables as tables in Substack | In theory preserves tabular structure | Conflicts with current publisher design; workflow evidence says no reliable HTML-table path; not validated in repo | **Reject** |
| Inline conversion (current publisher behavior) | Markdown table becomes ordered/bullet list | Fast, repo-native, readable in email, zero extra asset workflow | Loses grid scanning, alignment, and some visual hierarchy | **Use for short/simple tables** |
| Deterministic local PNG renderer | Markdown table becomes branded image plus caption/alt text | Predictable, email-safe, preserves layout, already integrated with image upload | Adds an asset-generation step; image text is less flexible than live text | **Primary answer for dense/layout-sensitive tables** |
| Datawrapper interactive embed | Hosted interactive chart/table | Strong for web sharing, sorting/filtering, public hosted viz | Core value depends on embeds/hosted interactivity; not newsletter-first; email clients block iframe/JS embeds | **Secondary only** |
| Datawrapper PNG export | Static export from Datawrapper | Email-safe fallback; polished visuals; official export path exists | Requires an extra external tool/service; duplicates much of what local renderer now covers | **Optional fallback, not core path** |

## Why Raw HTML Is Still the Wrong Bet

Even without revisiting earlier experiments, the current repo evidence is decisive: the publisher's own source code and its corresponding skill both encode the assumption that raw/native table preservation is unreliable in this Substack workflow.[^publisher-table][^skill-tables]

That matters more than a generic platform rumor because it reflects the exact pipeline we run:

`markdown article -> publish_to_substack -> ProseMirror draft`

If the code path deliberately converts tables into lists before draft creation, then a "maybe raw HTML will survive" strategy would require bypassing or redesigning the validated publisher, and it would still leave us exposed to email rendering constraints. That is too much risk for too little upside.

## Why the Deterministic Renderer Is the Right Dense-Table Default

The renderer solves the real requirement: **keep dense information visually legible across both web and email without depending on native table support.**

Its advantages are practical:

1. **Deterministic output.** The HTML/CSS and screenshot process are local and predictable.[^renderer-output]
2. **Repo-native workflow.** No extra SaaS dependency is required to produce the image.[^renderer-overview]
3. **Publishing compatibility.** The generated PNG plugs directly into the already-supported markdown image path, which the publisher uploads and converts into a Substack image block.[^publisher-images][^publisher-upload]
4. **Editorial control.** Dense tables can preserve headers, spacing, contrast, and framing rather than collapsing into prose-like list items.
5. **Email safety.** Static images are a known-safe delivery mechanism when dynamic embeds are not viable.[^ghost-embeds][^mailchimp-html]

The main tradeoff is that images are less inherently accessible than live text tables. That can be mitigated operationally by:

- using descriptive alt text
- including a concise caption
- adding a one-paragraph takeaway directly under the image
- reserving images for the tables that genuinely need them

That mitigation pattern is already visible in the POC draft, which pairs each rendered image with a short explanation of why the image form matters.[^poc]

## Why Datawrapper Is Useful but Not the Main Path

Datawrapper remains a legitimate tool, but the current decision should be about **default workflow**, not theoretical capability.

### What Datawrapper does well

Datawrapper's product is explicitly built for **interactive, responsive, accessible** charts, maps, and tables, and its table product supports features such as search, pagination, and sorting.[^dw-features] Its publishing options are clearly split between:

- **embed code** (`script`, `responsive iframe`, `iframe`) for websites[^dw-embed]
- **static export** such as PNG for contexts where embeds are not suitable[^dw-png]

That makes Datawrapper attractive for a web-first or interactivity-first story.

### Why it is not the default here

Our channel is newsletter-first. That changes the calculus.

Ghost's email guidance states plainly that modern email clients disable embeds, including iframes and anything using JavaScript, and recommends a screenshot-plus-link workaround instead.[^ghost-embeds] Mailchimp says the same thing: JavaScript and `<iframe>` are in the "do not use" category for HTML email, and the majority of email clients do not support complex web content.[^mailchimp-html]

So for our actual Substack email workflow:

- Datawrapper **interactive embed value is mostly lost in inboxes**
- Datawrapper **PNG export is viable**, but once we choose static-image delivery, its advantage over the repo's local deterministic renderer becomes much smaller
- adopting Datawrapper as the default would add an external publishing surface even though our repo already has a native image-rendering path that targets the same end state

That is why the right posture is **not "never use Datawrapper"**; it is **"do not make Datawrapper the core table solution when email-safe static delivery is what we primarily need."**

## Recommended Operating Rule

Use this simple rule for editors and agents:

### Lane A — Inline conversion
Choose inline conversion when most of the following are true:

- 2-4 meaningful columns
- short cells
- ordering/checklist semantics matter more than grid scanning
- the takeaway can be understood row-by-row
- losing strict column alignment does not distort meaning

Examples: rankings, priority boards, short need lists, simple pros/cons matrices.

### Lane B — Deterministic rendered image
Choose image rendering when most of the following are true:

- 4+ columns or dense numeric data
- readers need to scan across rows/columns
- headers, spacing, or emphasis carry editorial meaning
- mobile/email presentation quality matters
- the table should look like a designed artifact, not just transformed prose

Examples: cap tables, contract scenarios, multi-column comparisons, budget breakdowns, dense free-agent boards.

### Optional lane — Datawrapper
Use only when at least one of these is true:

- we want a hosted interactive companion on the web
- search/sort/filtering adds meaningful reader value outside email
- the visual is part of a broader web presentation, and a static PNG in email is acceptable as the newsletter representation

## Confidence Assessment

**Overall confidence: High** on the main recommendation, **Medium** on the exact boundaries between lanes.

### High confidence

- Raw/native HTML tables are not the right default for this workflow.[^publisher-table][^skill-tables]
- Inline conversion is the right lightweight path for short scannable tables.[^skill-quickref][^poc]
- Deterministic image rendering is the right default for dense tables.[^renderer-overview][^renderer-output][^poc]
- Datawrapper should be secondary in a newsletter-first workflow because email clients block the mechanisms that power interactive embeds.[^dw-embed][^ghost-embeds][^mailchimp-html]

### Medium confidence

- The exact threshold between "short enough for inline" and "dense enough for image" will still require editorial judgment. The POC strongly suggests the shape of the rule, but not an immutable numerical cutoff.[^poc]
- Datawrapper may still prove useful for select public web packages, especially if we later want a linked interactive companion alongside the email-safe PNG.

## Final Recommendation

**Proceed with the two-lane system and make the deterministic local renderer the standard answer for dense tables.**

That gives us the best balance of:

- reliability in Substack and email
- speed for simple tables
- design control for dense tables
- minimal dependence on external tooling

In short:

- **Raw HTML tables:** no
- **Inline conversion:** yes, for short tables
- **Local deterministic PNG renderer:** yes, for dense tables
- **Datawrapper:** optional/secondary, mainly for web-first or hosted-interactive use cases

## Footnotes / Citations

[^publisher-table]: `C:\github\nfl-eval\.github\extensions\substack-publisher\extension.mjs:661-703` explicitly says there is "no reliable HTML-table path" in this workflow and converts markdown tables into `ordered_list` or `bullet_list` output.
[^skill-tables]: `C:\github\nfl-eval\.squad\skills\substack-publishing\SKILL.md:77-88` says standard markdown tables do not survive as native HTML tables in this workflow and are converted into structured lists.
[^skill-node-types]: `C:\github\nfl-eval\.squad\skills\substack-publishing\SKILL.md:202-236` documents that markdown table blocks become ordered/bullet lists and tells writers to use `render_table_image` when layout carries editorial meaning.
[^skill-quickref]: `C:\github\nfl-eval\.squad\skills\substack-publishing\SKILL.md:228-236` tells writers to use markdown tables for short scannable inline conversions and `render_table_image` for stronger visual impact.
[^renderer-overview]: `C:\github\nfl-eval\.github\extensions\table-image-renderer\extension.mjs:1-7` describes the extension as rendering markdown tables to branded PNGs for "Substack-safe" use that survives email rendering without relying on HTML table support.
[^renderer-output]: `C:\github\nfl-eval\.github\extensions\table-image-renderer\extension.mjs:263-313` shows the renderer extracting/parsing a table, saving a PNG in `content\images\{articleSlug}`, and returning markdown image syntax with alt text/caption.
[^publisher-images]: `C:\github\nfl-eval\.github\extensions\substack-publisher\extension.mjs:347-365` and `:487-512` show markdown images being converted into Substack `captionedImage` / `image2` nodes, with local files auto-uploaded when possible.
[^publisher-upload]: `C:\github\nfl-eval\.github\extensions\substack-publisher\extension.mjs:139-180` and `:871-875` show local image upload to Substack's `/api/v1/image` endpoint during draft creation.
[^skill-images]: `C:\github\nfl-eval\.squad\skills\substack-publishing\SKILL.md:90-113` documents that local images are automatically uploaded to Substack's CDN and that captions are supported in markdown image syntax.
[^poc]: `C:\github\nfl-eval\content\articles\ne-substack-table-poc\draft.md:13-75` compares inline and rendered-image treatments for both a priority table and a denser cap table, concluding that the likely long-term answer is mixed.
[^dw-features]: Datawrapper features page: "Charts, maps, and tables" are interactive/responsive, tables support search/pagination/sort, and publishing includes both embeds and static PNG export. https://www.datawrapper.de/features (fetched 2026-03-16).
[^dw-embed]: Datawrapper Academy, "How to share and embed visualizations," documents website-oriented embed options: script embed, responsive iframe, and iframe. https://academy.datawrapper.de/article/180-how-to-embed-charts (fetched 2026-03-16).
[^dw-png]: Datawrapper Academy, "How to download your visualization as a PNG," says PNG is a good option when a CMS does not allow HTML embeds and is suitable for import/upload in other tools. https://academy.datawrapper.de/article/204-how-to-download-your-chart-as-a-png (fetched 2026-03-16).
[^ghost-embeds]: Ghost Help, "Can I use embeds in email newsletters?" says modern email clients disable embeds, including iframes and JavaScript-based embeds, and recommends screenshot-plus-link as the workaround. https://ghost.org/help/can-i-use-embeds-in-email-newsletters/ (fetched 2026-03-16).
[^mailchimp-html]: Mailchimp, "Limitations of HTML Email," says the majority of email clients do not support complex web content and specifically lists JavaScript and `<iframe>` under "Do not use." https://mailchimp.com/help/limitations-of-html-email/ (fetched 2026-03-16).
