---
name: Article Team Angle Audit
domain: runtime-forensics
confidence: high
tools: [sqlite, powershell, ripgrep]
---

# Article Team Angle Audit

## When to use

- A teammate needs to avoid repeating a recent team-specific article angle.
- You need to explain where article history actually lives before trusting repo-local files.
- You need a fast “what have we already said about this team lately?” brief for ideation.

## Pattern

1. Resolve the active runtime data directory first.
   - In NFL Lab, `src/config/index.ts` points `dbPath` at `~/.nfl-lab/pipeline.db`, so repo-local `content/pipeline.db` may be a stale migration artifact.
2. Inspect the runtime history model before reading article files.
   - Check `articles` for team, title, stage, and timestamps.
   - Check `artifacts`, `article_conversations`, `revision_summaries`, and retrospective tables for the durable history behind one slug.
3. If runtime rows are missing or empty, fall back to the repo file mirror.
   - Review `content/articles/**` slugs, draft titles, and file timestamps.
   - Use `src/pipeline/artifact-scanner.ts` as the source for how filesystem artifacts can backfill missing DB rows.
4. Trace the app’s nearest “recent related article” seams.
   - `Repository.listArticles()` is the same-team / title-search seam.
   - `/htmx/published` in `src/dashboard/server.ts` is the recent-published seam (30-day window).
   - If no dedicated related-article lookup exists, say so explicitly.
5. Summarize themes, not just slugs.
   - Group recent articles by repeated thesis (coverage weakness, roster allocation, extension economics, rookie validation, etc.).
   - Flag duplication risk by audience/depth, especially when multiple depth variants reuse the same core angle.

## NFL Lab example

- Repo-local `content/pipeline.db` was zero bytes, while the configured runtime model still pointed to `~/.nfl-lab/pipeline.db`.
- The runtime DB had schema tables but no article rows, so the practical audit shifted to `content/articles/**` plus the artifact-scanner backfill seam.
- Seattle’s recent repo cluster showed three obvious repeat lanes:
  - `puka-nacua-seahawks-2025-casual`, `-breakdown`, and `-deep-dive` all revisit the same Puka-vs-Seattle structural weakness.
  - `sea-emmanwori-rookie-eval` centers on whether Emmanwori’s rookie usage proves real building-block value.
  - `seahawks-rb-pick64-v2` and `seahawks-rb1a-target-board.md` both live in the RB / draft-resource-allocation lane.

## Why this works

- It prevents a false assumption that repo-local files or `content/pipeline.db` are always the live source of truth.
- It gives the team a repeatable fallback when runtime DB state is sparse but article artifacts still exist in the repo mirror.
- It also makes duplication risk concrete by combining storage architecture, retrieval seams, and actual recent team themes in one pass.
