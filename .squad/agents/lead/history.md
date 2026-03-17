# Lead — Lead / GM Analyst History

## Core Context
- **Project:** NFL Roster Evaluation — 2026 Offseason
- **User:** Joe Robinson
- **Data Sources:** overthecap.com, spotrac.com, ESPN/NFL.com, PFR (blocked), PFF, The Athletic, mock draft sites
- **Rumor Mode:** Dual-track (⚠️ RUMOR inline + separate track)
- **2026 cap:** $301.2M
- **Pipeline:** 8-stage article lifecycle (Idea → Discussion → Panel → Draft → Editor → Publisher → Stage/Prod → Published)
- **Key tools:** `article_board.py` (artifact-first truth), `pipeline_state.py` (DB writes), `batch-publish-prod.mjs` (Substack publishing), `audit-tables.mjs` / `fix-dense-tables.mjs` (table pipeline)
- **Agents created:** Media, Analytics, CollegeScout, PlayerRep + 4 data skills (OTC, Spotrac, NFL roster, knowledge format)
- **Ralph loop:** Autonomous pipeline driver — sweeps all unblocked lanes, max parallel throughput, artifact-first discovery

## Summarized History (2026-03-12 through 2026-03-17)

> Condensed by Scribe on 2026-03-16T20:51Z. Full details in session logs under `.squad/log/`.

**Infrastructure & Pipeline (2026-03-12–16):**
- Built `pipeline_state.py` (shared DB write gateway) and `article_board.py` (artifact-first reconciliation with `--repair` mode)
- Retargeted Ralph loop from .NET demo to NFL article pipeline driver; later upgraded to max-parallel-throughput mode
- Built dense table pipeline: `audit-tables.mjs` + `fix-dense-tables.mjs` — pre-publish threshold 5.5 density, 60 table PNGs rendered
- Migrated Substack publishing from sections to tags; deleted all 32 unused NFL team sections from prod
- Fixed `.env` token format (URL-encoded → base64 JSON)

**Substack Publisher Fixes (2026-03-17):**
- **imageCaption bug** (2 rounds): `buildCaptionedImage()` produced incomplete ProseMirror nodes. Round 1 added `imageCaption` child node. Round 2 discovered correct type name is `"caption"`, not `"imageCaption"`. Fixed in both `extension.mjs` and `batch-publish-prod.mjs`. Added `validateProseMirrorBody()` pre-publish gate.
- **Key lesson:** API acceptance ≠ editor compatibility. Only browser editor validates ProseMirror schema. `can3p/substack-api-notes` is canonical reference.
- **article_board.py bugs fixed:** editor-review sort (unnumbered file → oldest, not newest), image count path (check `content/images/{slug}/`), missing `_expected_status_for_stage` helper, STATUS_DRIFT reconciliation added.

**Article Production Batches (2026-03-15–17):**
- JSN panel discussion: 4 agents parallel, AAV synthesis $31-33M, WA tax window insight, Shaheed leverage signal
- Witherspoon v2 refresh: reconstructed pipeline artifacts from pre-pipeline published article, removed WA tax refs per content constraint
- NFC West parallel panel: 8 agents, ~4 min, zero quality loss
- AFC North batch: BAL/CIN/CLE/PIT ideas generated; BAL pushed to Stage 2
- AFC East batch: BUF/MIA/NYJ advanced
- Batch image fix: generated 34 inline images for 17 articles via Gemini 3 Pro Image (confirmed better than Imagen 4 for editorial style)
- 28 generic article issues created (#43–#69) for remaining divisions

**Stage 7 Production Push (2026-03-16–17):**
- Initial batch push of 22 articles ROLLED BACK — DB stage inflation discovered (only DEN + MIA truly Stage 7)
- `article_board.py --repair` corrected 20 inflated stages
- Witherspoon v2 + JSN pushed to prod after editor approval, publisher-pass artifacts created, bugs fixed
- Final board: DEN, MIA, witherspoon-v2, JSN at Stage 7 with prod draft URLs
- 20 batch-published stage 7 articles (all 22 relevant) positioned for publication phase
- Orphan draft cleanup documented (39 invisible drafts on nfllab.substack.com)

**Durable Learnings (carry forward):**
- `article_board.py` is authoritative; `pipeline.db` is coordination state only. Always cross-check before deployment.
- Substack `captionedImage` requires exactly `[image2, caption]` children. `"caption"` not `"imageCaption"`.
- `subscribeWidget` ProseMirror: `{ type: "subscribeWidget", attrs: { url: "%%checkout_url%%", text: "Subscribe", language: "en" }, content: [{ type: "ctaCaption", ... }] }`
- Chart/table hero-safety regex: `[-_](table|chart|data|decision|priority|comparison|breakdown|salary|contract|depth-chart|cap-|roster-|engram|cap\b)`
- Dense table threshold: density ≥ 5.5 = render to PNG. Pipeline position: pre-publish batch step, publisher extension as final backstop.
- `batch-publish-prod.mjs stage <slug>` for single-article stage publishes; stage mode requires manual `substack_draft_url` writeback.
- Parallel execution is cost-neutral (same tokens) but 3-4× faster wall-clock. Only real serialization: intra-article stage ordering.
- Substack subtitle limit ~256 chars (HTTP 400 if exceeded).
- Multiple batch pushes create URL drift — always use highest draft ID (most recent).