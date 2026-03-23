---
name: Article Slug History Audit
domain: runtime-forensics
confidence: high
tools: [sqlite, powershell, ripgrep]
---

# Article Slug History Audit

## When to use
- A teammate asks whether a specific article slug has durable local history.
- You need to distinguish repo files from runtime state under the user data directory.
- You need to answer whether first draft, edit request, later drafts, or publish artifacts are actually recoverable.

## Pattern
1. Resolve the active runtime data directory first; in NFL Lab, `src/config/index.ts` defaults to `~/.nfl-lab/`.
2. Check `pipeline.db` in that data dir before assuming `content/` or repo-local files are authoritative.
3. Query `articles` for the slug, then inspect:
   - `artifacts` for the latest named artifacts (`idea.md`, `draft.md`, `editor-review.md`, `publisher-pass.md`, etc.)
   - `article_conversations` for per-turn writer/editor/publisher history
   - `revision_summaries` for iteration-level edit requests
   - `stage_transitions` and `stage_runs` for lifecycle timing
   - `article_retrospectives` / `article_retrospective_findings` for postmortem summaries
4. Check `~/.nfl-lab/logs/audit-YYYY-MM-DD.jsonl` for timestamped stage-advance lines tied to the slug.
5. Check filesystem mirrors separately:
   - `~/.nfl-lab/leagues/{league}/articles/{slug}` for materialized article files
   - `~/.nfl-lab/leagues/{league}/images/{slug}` for generated images
6. Explain the overwrite seam: `artifacts` is the latest-value store, so repeated writes to `draft.md` or `editor-review.md` replace the current artifact; historical revisions are recoverable from conversation/history tables instead.

## NFL Lab example
- Slug `the-packers-next-big-move-might-be-trading-a-young-receiver` existed in `C:\Users\jdl44\.nfl-lab\pipeline.db` even though no repo file or materialized article directory matched it.
- `artifacts` held the latest `draft.md`, `editor-review.md`, `publisher-pass.md`, and `revision-retrospective-r4.md`.
- `article_conversations` preserved ten turns, including the first draft plus three later writer revisions and four editor edit requests.
- `revision_summaries` recorded four `REVISE` iterations.
- `audit-2026-03-23.jsonl` preserved the stage-advance timestamps for each loop.

## Why this works
- It matches the actual persistence model in `src/db/schema.sql`, `src/db/artifact-store.ts`, and `src/pipeline/actions.ts`.
- It prevents a false negative when repo-local `content/articles/` is empty but the real runtime history lives in `~/.nfl-lab/`.
- It also prevents a false positive about “separate second draft files” when the system only keeps the latest artifact body and stores earlier revisions in conversation/history tables.
