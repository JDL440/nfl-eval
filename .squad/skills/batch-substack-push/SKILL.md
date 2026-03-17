---
name: "batch-substack-push"
description: "Standalone batch push of articles from pipeline.db to Substack production drafts"
domain: "content-production"
confidence: "high"
source: "validated 2026-07-25 — 20 articles pushed to nfllab.substack.com"
---

# Batch Substack Push — Skill

> **Confidence:** high — validated end-to-end on 2026-07-25 (20 articles, zero data loss)
> **Created:** 2026-07-25
> **Owned by:** Writer

## Purpose

Push multiple Stage 7 articles from staging (`nfllabstage.substack.com`) to production (`nfllab.substack.com`) as Substack drafts in a single batch operation, without requiring the Copilot CLI extension host.

## When to Use

- Multiple articles are at Stage 7 with staging draft URLs and need production drafts
- The `publish_to_substack` Copilot extension is unavailable (no extension host)
- Joe needs a batch of production draft URLs for Stage 8 review

## Approach

1. **Extract core functions** from `.github/extensions/substack-publisher/extension.mjs` — all are SDK-free (loadEnv, makeHeaders, markdownToProseMirror, createSubstackDraft, etc.)
2. **Query pipeline.db** for Stage 7 articles with `nfllabstage` in `substack_draft_url`
3. **For each article**, read `draft.md`, auto-extract title/subtitle, convert to ProseMirror, call `POST /api/v1/drafts`
4. **Write results** to `stage7-prod-manifest.json`
5. **Update pipeline.db** `substack_draft_url` to production URLs

## Rate Limiting

Substack returns HTTP 429 after ~4 rapid draft creates. Mitigations:
- **8 second delay** between requests (`--delay=8000`)
- **Retry on 429** with exponential backoff (10s, 20s, then fail)
- Use `--retry` flag to resume from a failed batch (reads previous manifest)

## Manifest Format

```json
{
  "timestamp": "2026-07-25T...",
  "target": "nfllab.substack.com",
  "total": 20,
  "success": 20,
  "failed": 0,
  "articles": [
    { "slug": "...", "status": "success", "draftId": "...", "draftUrl": "...", "title": "...", "tags": [] }
  ]
}
```

## Key Dependencies

- `SUBSTACK_TOKEN` and `SUBSTACK_PUBLICATION_URL` in `.env`
- Node.js 22+ (for `node:sqlite` DatabaseSync)
- `content/pipeline.db` with articles at Stage 7
- `content/articles/{slug}/draft.md` files with `# Title` and `*subtitle*` lines
