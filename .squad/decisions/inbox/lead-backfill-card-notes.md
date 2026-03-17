# Decision: Backfill Published URLs + Fix Note Card Rendering

**Date:** 2026-03-18
**Author:** Lead
**Status:** Executed

## Context

Phase 4 stage review Notes (5 total) were posted to nfllabstage with production article URLs, but rendered as plain links instead of article cards. Two Stage 8 published articles also had `substack_url = None` in pipeline.db.

## Root Cause

`noteTextToProseMirror()` in `extension.mjs` created plain text paragraphs — URLs were not wrapped in ProseMirror `link` marks. Substack requires explicit `marks: [{ type: "link", attrs: { href } }]` on URL text nodes to trigger article card rendering. Plain text URLs render as clickable links but do NOT generate the rich card preview (thumbnail + headline + publication name).

## Actions Taken

1. **Backfilled `substack_url`** for both Stage 8 articles:
   - `seahawks-rb1a-target-board` → `https://nfllab.substack.com/p/the-6-million-backfield-how-seattle`
   - `witherspoon-extension-cap-vs-agent` → `https://nfllab.substack.com/p/cap-says-27m-the-agent-demands-33m-d00`
   - Source: `GET /api/v1/archive` on nfllab.substack.com

2. **Fixed `noteTextToProseMirror()`** — added `parseNoteInline()` helper that auto-detects `https://` URLs in note text and wraps them in ProseMirror link marks. Future Notes posted through `publish_note_to_substack` will automatically get card-eligible link marks.

3. **Replaced 5 broken stage Notes** with corrected versions containing proper link marks:
   - JSN: c-229372212 → c-229378039
   - KC Fields: c-229372239 → c-229378074
   - Denver: c-229372275 → c-229378102
   - Miami: c-229372305 → c-229378151
   - Witherspoon: c-229372344 → c-229378200

4. **Cleaned up** Phase 2 learning artifact Note (c-229307547) from pipeline.db.

## Key Principle

ProseMirror link marks are the ONLY trigger for Substack article cards in Notes. Neither plain-text URLs, image attachments, nor draft URLs produce card previews. The extension's Note builder must always apply link marks to any embedded URL.
