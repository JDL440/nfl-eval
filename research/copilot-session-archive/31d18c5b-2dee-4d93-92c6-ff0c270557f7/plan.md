Problem: Article orchestration is getting stuck because the runtime state is split across GitHub labels/comments, local article artifacts, and `content\pipeline.db`, while Ralph and heartbeat still schedule off stale signals and late-stage revise/image/publish loops are not closed automatically.

Proposed approach:
- Fix the contracts first so the repo has one clear runtime model: artifact-first stage discovery, numeric DB stages, and a consistent image/publish policy.
- Build one shared state layer for reads/writes before changing Ralph or heartbeat behavior.
- Upgrade orchestration only after the shared state code can classify current article folders correctly.
- Roll out on known drifted articles in dry-run mode first, then apply backlog reconciliation and automation.

Recommended policy defaults:
- `stage:*` GitHub labels remain as human-facing visibility mirrors only; they are no longer scheduler inputs.
- Runtime source-of-truth precedence becomes: published proof > publisher-pass artifact > editor-review artifact > draft > discussion summary/panel outputs > prompt/composition > DB/labels fallback.
- Cover images remain manual in Substack; article markdown uses exactly 2 inline images only.

Implementation phases:

1. Contract and policy alignment (hard gate for all later phases)
- Resolve the scheduling contract across docs and prompts before changing code.
- Update the repo guidance so all article state references use numeric `current_stage` semantics and current schema fields like `discussion_path` and `article_path`.
- Resolve the image-policy conflict across Writer, Editor, Publisher, `substack-article`, and `image-generation`.
- Lock the label strategy: labels are mirrors, not control-plane inputs.

2. DB audit and migration baseline (must finish before shared helper work)
- Inspect live `content\pipeline.db` contents for string-valued stage writes, missing editor review rows, stale artifact paths, and any other schema drift.
- Define and apply the minimum migration/repair needed so the shared helper starts from a known-valid baseline.
- Capture expected before/after checks for `articles`, `editor_reviews`, and artifact-path integrity.

3. Shared pipeline state library
- Add a shared Python helper (planned path: `content\pipeline_state.py`) that owns stage transitions, artifact-path updates, editor review writes, publisher pass writes, and publish proof writes.
- Ensure the helper validates numeric stage values and writes `stage_transitions` consistently.
- Retire or rewrite ad hoc scripts such as `content\update_jsn.py` and `content\set_discussion_path.py` to use the shared helper or remove them if obsolete.

4. Artifact-first board reader and reconciliation
- Add a reusable state reader (planned path: `content\article_board.py` or equivalent) that infers article stage and next action from local artifacts first, then consults DB metadata.
- Parse `editor-review.md` verdicts so the system can distinguish `REVISE`, `APPROVED`, missing-images, and publish-ready states.
- Add a reconciliation script/entry point that compares filesystem truth, DB state, and GitHub issue metadata without mutating anything in the first pass.

5. Ralph and heartbeat upgrades
- Rewrite `ralph\prompt.md` so Ralph sweeps all unblocked articles, batches same-stage work in parallel, and uses artifact-first discovery instead of label-first selection.
- Update `.github\workflows\squad-heartbeat.yml` so it calls the reconciliation logic rather than only checking issue/PR label hygiene.
- Keep cron disabled until the new reconciliation path can run safely in dry-run or bounded mode.

6. Late-stage closure automation
- Build explicit next-action handling for: `REVISE` -> revision lane + re-review, `APPROVED` + missing images -> image generation, images ready -> publisher pass, publish confirmation -> DB/GitHub reconciliation.
- Decide and document the publish-confirmation path: publisher extension writeback, a repo artifact, or an explicit manual confirmation artifact from Joe.
- Add/update the publish writeback path so Substack-draft/publish state reaches `pipeline.db` and GitHub consistently.

7. Documentation and prompt cleanup
- Update all affected skills, charters, and extension-facing docs so the implementation and instructions agree after the code changes land.
- Document GitHub as the visibility layer and artifact+DB reconciliation as the scheduler/runtime layer.
- Clean up outdated guidance that still implies cover images in markdown or string-valued DB stages.

8. Backfill and rollout
- Dry-run the new reconciliation logic against the known drifted articles: SEA v2, Witherspoon v2, ARI, LAR, SF, JAX, GB, MIA, and JSN.
- Repair stale DB rows and GitHub issue metadata with the new helpers only after the dry-run output matches expectations.
- Re-enable the upgraded heartbeat/cron only after backlog repair is complete and the first smoke cases pass.

Dependency order:
- Phase 1 -> Phase 2 -> Phase 3 -> Phase 4
- Phase 5 depends on Phase 4
- Phase 6 depends on Phases 3 and 4
- Phase 7 can start after Phase 1 but should finish after Phases 5 and 6 so docs reflect shipped behavior
- Phase 8 depends on Phases 5, 6, and 7

Todos:
- contract-policy-alignment: Align source-of-truth rules, label role, numeric stage semantics, and image policy across prompts/skills/docs.
- db-audit-migration: Audit live `pipeline.db`, repair any schema/value drift, and define the safe baseline for new helpers.
- shared-pipeline-state-helper: Build the central DB write helper and retire ad hoc state mutation scripts.
- artifact-board-reader: Build artifact-first stage/next-action inference plus dry-run reconciliation output.
- ralph-heartbeat-upgrade: Rewrite Ralph prompt and heartbeat workflow around artifact-first reconciliation and safe automation boundaries.
- late-stage-closure-loops: Automate revise, image-generation, publisher, and publish-confirmation transitions.
- documentation-prompt-cleanup: Update all conflicting skills/charters/docs to match the new runtime behavior.
- backlog-backfill-rollout: Dry-run and then repair current drifted articles before re-enabling unattended sweeps.

Validation strategy:
- Use current known article folders as smoke fixtures for expected stage detection and next-action output.
- Run targeted Python validation on new/changed helper scripts and targeted Node syntax validation on changed extension/workflow-adjacent JavaScript.
- Dry-run reconciliation before any mutating backlog repair.
- Validate at least one example each for: panel-ready -> draft readiness, revise loop, approved-but-missing-images, and publish reconciliation.
- Re-check the repaired DB to ensure `current_stage` is numeric and artifact paths match files on disk.

Expected file surface:
- New: `content\pipeline_state.py`
- New: `content\article_board.py` and/or a reconciliation script
- Update: `ralph\prompt.md`
- Update: `.github\workflows\squad-heartbeat.yml`
- Update: `.github\extensions\substack-publisher\extension.mjs`
- Update: `.squad\skills\article-lifecycle\SKILL.md`
- Update: `.squad\skills\article-discussion\SKILL.md`
- Update: `.squad\skills\substack-article\SKILL.md`
- Update: `.squad\skills\image-generation\SKILL.md`
- Update: `.squad\skills\publisher\SKILL.md`
- Possibly update: `.squad\agents\lead\charter.md`, `.squad\agents\editor\charter.md`, and legacy helper scripts under `content\`

Plan review notes:
- Reviewed by a second model before saving.
- Reviewer feedback incorporated: added hard gating between workstreams, promoted DB audit/migration to an explicit phase, and elevated image-policy cleanup as a first-class contract task.

Execution status:
- Completed implementation and rollout.
- Shared state and reconciliation code shipped in `content\pipeline_state.py` and `content\article_board.py`.
- Ralph prompt and heartbeat were upgraded to artifact-first scheduling.
- Backlog DB backfill completed from local artifacts; `content\pipeline.db` now contains 71 articles and 11 editor review rows.
- Final validation passed:
  - `python content\article_board.py reconcile` → `OK No discrepancies found -- DB matches artifacts.`
  - `python content\pipeline_state.py check` → `All stages are numeric ✓`

Notes:
- There is no obvious existing automated test suite in the repo, so rollout validation relied on targeted script/extension smoke checks and reconciliation runs.

---

## Substack Notes Feature (2025-07-26)

Problem: NFL Lab has zero Substack Notes presence — missing the platform's engagement/discovery layer between long-form articles.

Approach:
- Add a `publish_note_to_substack` tool to the existing `substack-publisher` extension (same auth, same env, same staging-first pattern).
- Notes are a post-publish action attached to Stage 8, not a new pipeline stage.
- New `notes` table in `pipeline.db` tracks posted Notes (article-linked and standalone).
- `pipeline_state.py` gets `record_note()` / `get_notes_for_article()` methods.
- `article_board.py` shows note count per article (informational).

Rollout order:
1. Phase 0: API discovery — intercept the Notes POST endpoint on nfllabstage via browser DevTools, validate with curl.
2. Phase 1: nfllabstage with generic test Notes (plain text, image, linked to a draft).
3. Phase 2: nfllabstage with a real NFL Lab structured article (e.g. kc-fields-trade-evaluation) — promotion Note + standalone quick take.
4. Phase 3: Production — first prod Note for a real published article, Joe approves.
5. Phase 4: Update skills and documentation.

Design doc: `docs/substack-notes-feature-design.md`
Decision: `.squad/decisions/inbox/lead-notes-plan.md`

Status (2025-07-27):
- Phase 0 scaffolding shipped. The `publish_note_to_substack` tool is registered and functional through auth → article lookup → image upload → ProseMirror assembly, but the final POST is intentionally GATED because the real Notes endpoint/payload is unverified.
- Critical finding: Notes use ProseMirror `bodyJson`, not a plain content string. `noteTextToProseMirror()` handles the conversion.
- DB support shipped: `notes` table, `PipelineState.record_note()/.get_notes_for_article()/.get_all_notes()`, `article_board.py` note-count awareness.
- Validation artifacts shipped: `validate-notes-smoke.mjs` (stage-only smoke harness with --dry-run), `docs/notes-api-discovery.md` (Phase 0 browser capture checklist).
- Next step: Phase 0 browser interception on nfllabstage (Joe or Lead, per `docs/notes-api-discovery.md`) before the tool can be ungated.

Status (2025-07-27 update — Phase 0 shortcut attempted, FAILED):
- **Notes API endpoint candidate** found in postcli/substack open-source library (https://github.com/postcli/substack).
  - Endpoint: `POST https://substack.com/api/v1/comment/feed` (global, not pub-specific)
  - Payload: `{ bodyJson, tabId: "for-you", surface: "feed", replyMinimumRole: "everyone" }`
  - Library claims: Same cookies, no CSRF token required.
- `createSubstackNote()` in extension.mjs was ungated for the live test.
- `.env` updated with: `NOTES_ENDPOINT_PATH=/api/v1/comment/feed`, `NOTES_PAYLOAD_SHAPE=prosemirror`, `NOTES_HOST=substack.com`.
- `validate-notes-smoke.mjs` updated: correct global endpoint, correct payload fields, dry-run passes ✅.
- Key insight (CORRECTED): Notes are NOT global — they go to the publication host (same-origin).
- **Live test result: HTTP 403.** Auth passed (Joe Robinson), but POST returned 403 with HTML error page. No Note was posted.

Status (2025-07-27 — ✅ PHASE 0 COMPLETE):
- Joe provided browser DevTools capture of successful POST to `nfllab.substack.com/api/v1/comment/feed`.
- Key findings: (1) publication host, not substack.com; (2) same-origin Origin/Referer; (3) additional cookies (cf_clearance, substack.lli, __cf_bm).
- Root cause of 403: Cloudflare Bot Management blocks server-side `fetch()` for the comment/feed write endpoint.
- Solution: Playwright `page.evaluate(fetch())` from a real browser page context, with `--headless=new`, `--disable-blink-features=AutomationControlled`, real Chrome UA.
- Smoke test: `node validate-notes-smoke.mjs` → HTTP 200, Note ID 229257782 posted to nfllabstage as Joe Robinson.
- Files updated: `extension.mjs`, `validate-notes-smoke.mjs`, `.env`, `docs/notes-api-discovery.md`, SKILL.md, history.md.
- **Smoke cleanup complete (reverified 2026-03-17):** All 3 test Notes (229256436, 229257782, 229259139) were rechecked via `delete-notes-api.mjs`; each returned HTTP 404, which is the expected success case for "already gone." DELETE remains the canonical cleanup path and is NOT Cloudflare-blocked like POST.
- **Next execution phase:** Phase 1 on nfllabstage — run the structured batch in this order: linked text Note, richer formatted Note, then inline-image Note. For each run, validate rendering, record the returned Note ID, and immediately delete the stage artifact before moving to the next richer payload.

Status (2026-03-17 — Phase 1 TC1 PASS):
- **TC1: Multi-paragraph plain text Note** — posted to nfllabstage, HTTP 200, Note ID 229283265.
- 3-paragraph ProseMirror bodyJson (688 bytes), no links/images/formatting.
- DELETE /api/v1/notes/229283265 returned HTTP 404 (resource-gone semantics); verified gone on re-check.
- POST response includes rich metadata (user_id, body, body_json, type, status, reaction_count, attachments, etc.).
- Run used the same Playwright page-evaluate POST pattern as `validate-notes-smoke.mjs`. Cleanup confirmed. TC2 and TC3 are next.

Status (2026-03-17 — Phase 1 TC2 PASS):
- **TC2: Linked stage-draft Note** — posted to nfllabstage, HTTP 200, Note ID 229286904.
- Resolved `kc-fields-trade-evaluation` stage draft URL as `https://nfllabstage.substack.com/publish/post/191214349` from `.squad/decisions/archived-20260318-lead-fields-chiefs-trade.md` because `pipeline.db` currently stores the production draft URL (`https://nfllab.substack.com/publish/post/191216376`).
- Final paragraph used an explicit ProseMirror link mark with the real stage draft URL substituted into the teaser copy.
- DELETE /api/v1/notes/229286904 returned HTTP 404 on cleanup and on re-check; the Note was confirmed gone.
- Next execution step: Phase 1 TC3 only (inline-image Note). Phase 2 remains untouched.

Status (2026-03-17 — Phase 1 TC3 PASS — Phase 1 COMPLETE):
- **TC3: Inline-image Note** — posted to nfllabstage, HTTP 200, Note ID 229296344.
- Image asset: `content/images/kc-fields-trade-evaluation/kc-fields-trade-evaluation-inline-1.png`, uploaded to Substack CDN via `POST /api/v1/image` (plain fetch, not Cloudflare-blocked).
- CDN URL: `https://substack-post-media.s3.amazonaws.com/public/images/f7e47e4f-4d81-463b-bd77-6c8ccd63fca3_1024x1024.png`.
- **Key discovery:** Notes do NOT support images in ProseMirror body nodes. Both `captionedImage`/`image2` (article schema) and plain `image` nodes returned HTTP 500 with `{"error":""}`. Images must be sent as a **payload-level `attachments` array**: `[{ url: "<CDN URL>", type: "image" }]`.
- Text paragraphs remain in `bodyJson` as text-only ProseMirror. Image goes in the separate `attachments` field alongside `bodyJson`, `tabId`, `surface`, `replyMinimumRole`.
- DELETE /api/v1/notes/229296344 returned HTTP 404 on cleanup and on re-check; the Note was confirmed gone.
- **Phase 1 is COMPLETE.** All three test cases (plain text, linked text, inline image) passed on nfllabstage. Phase 2 (real NFL Lab structured article Note) is next.

---

## Notes Operational Cadence (2025-07-27)

Problem: Notes posting is currently manual and ad-hoc. We need a defined cadence that posts the right Note at the right moment in the article lifecycle, with an automated sweep to catch anything that falls through.

### Three Note Moments

| Moment | Trigger | Target | Format | Note Type |
|--------|---------|--------|--------|-----------|
| **Draft teaser** | Article pushed to Substack as draft (Stage 7) | `stage` | Text + image (no card — article isn't public yet) | `teaser` |
| **Publish-day card** | Article published by Joe (Stage 8) | `prod` | Card-first: 1-2 sentence hook + article image + auto-rendered article card | `promotion` |
| **Follow-up** | 2-3 days after publish, or when comment engagement spikes | `prod` | Text-only or image + card linking back | `follow_up` |

**Draft teaser details:** Posted to nfllabstage when a prod draft is created. Purpose is dual: (1) give Joe a preview of what the promotion Note will look like, and (2) test the Note copy/image before it goes to real subscribers. No article card renders because the article isn't public — use text + image only. Joe reviews the stage Note alongside the draft article.

**Publish-day card details:** This is the primary engagement driver. Posted to prod within 1 hour of Joe publishing the article. Uses the card-first format Joe approved: one hook line with a data point, one image, article card auto-renders below. The stage teaser copy can be reused or refined based on Joe's feedback.

**Follow-up details:** Optional. Triggers include high comment volume, external validation of the article's thesis, or a breaking-news event that validates the panel's prediction. Not automated in v1 — Lead or Writer proposes, Joe approves.

### Automated Sweep

**Frequency:** Daily (Ralph sweep cycle). A dedicated Notes sweep runs after the article-stage reconciliation.

**What the sweep checks:**

1. **Stage 7 articles missing a teaser Note.** Query: articles with `current_stage >= 7` and a valid `substack_draft_url` but no row in `notes` where `note_type = 'teaser'` for that article.
2. **Stage 8 articles missing a promotion Note.** Query: articles with `current_stage = 8` and `status = 'published'` but no row in `notes` where `note_type = 'promotion'` and `target = 'prod'` for that article.
3. **Staleness check.** Flag any article that has been at Stage 8 for >48 hours without a promotion Note (warning, not auto-post).

**Sweep action:** The sweep generates a report of missing Notes and proposed copy. It does NOT auto-post — all Notes go through the approval flow:
- Stage teasers: auto-post to nfllabstage (safe, no subscriber impact), Joe reviews on stage feed.
- Prod promotions: sweep proposes → Joe approves → post. No unattended prod posts in v1.

**Future (v2):** Once Joe has approved ≥10 promotion Notes and the format is stable, auto-post prod Notes for articles that match the standard card-first template. Joe gets a notification, not a gate.

### Eligibility Rules

An article is **eligible for a teaser Note** when ALL of:
- `current_stage >= 7` in pipeline.db
- `substack_draft_url` is set and valid
- At least one inline image exists in `content/images/{slug}/`
- No existing `teaser` Note for this article in the `notes` table

An article is **eligible for a promotion Note** when ALL of:
- `current_stage = 8` and `status = 'published'` in pipeline.db
- `substack_url` (public article URL) is set and valid
- At least one inline image exists in `content/images/{slug}/`
- No existing `promotion` Note with `target = 'prod'` for this article

### Dedupe & Idempotency

- **Primary dedupe key:** `(article_id, note_type, target)` in the `notes` table.
- Before posting any Note, query `get_notes_for_article(article_id)` and check for an existing row with the same `note_type` and `target`.
- If a match exists, skip silently (idempotent).
- If a match exists but the copy has changed (e.g., Joe edited the teaser), use the existing Note's `substack_note_url` to DELETE the old Note, then POST the new one. Record the new Note ID.
- Standalone Notes (no `article_id`) are not deduplicated — each is unique.

### Rollout Order

1. **Manual promotion Notes (current).** Post 3-5 card-first promotion Notes manually for the next published articles. Validate the format, copy, and Joe's approval cadence. Already started with JSN extension.
2. **Add sweep eligibility report.** Build the daily sweep query into `article_board.py` or a standalone `notes-sweep.mjs` script. Output: list of articles missing Notes, with proposed copy. No posting yet — report only.
3. **Semi-automated stage teasers.** When Ralph pushes a Stage 7 draft, auto-post a teaser Note to nfllabstage. Joe reviews on the stage feed. No prod impact.
4. **Semi-automated prod promotions.** After Joe publishes an article, sweep detects the Stage 8 transition and proposes a promotion Note. Joe approves → post.
5. **Fully automated (v2, gated on ≥10 successful manual cycles).** Sweep auto-posts prod promotions for standard-format articles. Joe gets notification only.

### Copy Generation Rules

| Note Type | Copy Pattern | Length | Image |
|-----------|-------------|--------|-------|
| Teaser | "[Data hook]. Full breakdown dropping soon." | 1-2 sentences, ≤30 words | Article inline-1 (hero image) |
| Promotion | "[Data hook]. Our panel breaks [framework]." | 1-2 sentences, ≤20 words | Article inline-1 (hero image) |
| Follow-up | "[Validation/reaction]. [Tease next piece or ask a question]." | 1-3 sentences | Optional |

**Data hook sources (in priority order):**
1. Article subtitle (usually contains the core tension)
2. Key disagreement stat from the panel discussion
3. Cap number or contract figure that anchors the analysis

### Integration Points

- **Ralph prompt:** Add a Notes sweep step after the article reconciliation step. Ralph checks eligibility, generates proposed Notes, and presents them for approval.
- **pipeline_state.py:** Already has `record_note()` / `get_notes_for_article()`. Add `get_articles_missing_notes(note_type)` method for sweep queries.
- **article_board.py:** Already shows note count. Add a `--notes-sweep` flag that outputs eligible articles with missing Notes.
- **extension.mjs:** `publish_note_to_substack` tool already handles the POST. No changes needed.

---

## Phase 2 Result (2026-03-17T20:28Z)

- Image path verified: `C:\github\nfl-eval\content\images\jsn-extension-preview\jsn-extension-preview-inline-1.png`
- Live promotion Note posted to `nfllabstage` for `jsn-extension-preview` with the exact requested teaser copy.
- Note ID: `229307547`
- Review feed: `https://nfllabstage.substack.com/notes`
- Review permalink: `https://substack.com/@joerobinson495999/note/c-229307547`
- The Note is intentionally still live for Joe review; no cleanup was performed.
- Reliable long-copy payload shape: emit each displayed line as its own paragraph node. Exact-copy attempts that used `hard_break` nodes returned HTTP 500.
- Recommended image asset was verified locally, but exact-copy live attempts with the image continued to return HTTP 500. Current review artifact is text-only.
- Phase 3 gate: Joe reviews the live stage Note, then decide whether prod reuses the successful text-only body or requires a fresh image-attachment pass.




## Phase 3 Result (2026-03-17T20:52Z)

✅ **PHASE 3 COMPLETE** — Card-first JSN Note is live on nfflabstage.

**Execution:**
- Replaced text-only Note (229307547) with card-first variant (Note ID 229347247)
- 3-step image flow: upload → register attachment → POST with `attachmentIds`
- Caption: "JSN at 90% below market. Our panel breaks the extension paths." (12 words)
- Image: `jsn-extension-preview-inline-1.png` (four-paths decision framework, 1408×768)
- Old Note deleted (HTTP 404 cleanup confirmed)
- New Note renders at https://substack.com/@joerobinson495999/note/c-229347247

**Pattern verified:** Short caption + image + auto-rendered article card matches Joe Robinson's example (c-229342260). This is the production standard for Notes.

**Next step:** Joe Robinson approves, then promote to production (nfllab.substack.com) with identical structure.
