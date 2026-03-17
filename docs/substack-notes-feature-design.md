# Substack Notes Feature — Design Document

> **Status:** In Progress — Phase 0 scaffolding shipped; final POST is GATED pending browser interception
> **Author:** Lead (orchestrator)
> **Requested by:** Joe Robinson
> **Date:** 2025-07-26
> **Last updated:** 2025-07-27
> **Repo:** `nfl-eval`

---

## Table of Contents

1. [Problem Statement & Goals](#1-problem-statement--goals)
2. [What to Build](#2-what-to-build)
3. [Where the Code Lives](#3-where-the-code-lives)
4. [How Notes Fit Into the Article Pipeline](#4-how-notes-fit-into-the-article-pipeline)
5. [Data Model & State Implications](#5-data-model--state-implications)
6. [API & Tool Surface Changes](#6-api--tool-surface-changes)
7. [Staging & Production Behavior](#7-staging--production-behavior)
8. [Testing Plan](#8-testing-plan)
9. [AI Validation Plan](#9-ai-validation-plan)
10. [Human / User Validation Plan](#10-human--user-validation-plan)
11. [Rollout Plan](#11-rollout-plan)
12. [Risks, Rollback & Success Metrics](#12-risks-rollback--success-metrics)

---

## 1. Problem Statement & Goals

### Problem

NFL Lab publishes long-form articles via Substack posts, but has **zero presence on Substack Notes** — the platform's microblogging / engagement layer. Notes are Substack's answer to Twitter/X: short-form, public, feed-visible, and designed to drive discovery and subscriber acquisition between newsletter editions.

Today:
- Articles ship, then go silent until the next one.
- No automated teasers, follow-ups, or audience engagement between posts.
- Substack's Notes feed (which all subscribers see) is empty — wasted real estate.
- No link-back from Notes to published posts, missing the discoverability loop.

### Goals

1. **Automate article-linked Notes** — every published article gets at least one Note (teaser, highlight, or follow-up) without manual effort.
2. **Enable standalone Notes** — quick takes, breaking-news reactions, hot takes from agents — things that don't warrant a full article.
3. **Fit cleanly into the existing pipeline** — Notes should be a natural extension of the Stage 7→8 workflow, not a parallel system.
4. **Same auth, same safety guards, same staging-first policy** as the current publisher extension.
5. **Preserve Joe's editorial control** — Joe approves Notes before they go live on prod, just like articles.

### Non-Goals (out of scope)

- Notes scheduling/calendar system (future work).
- Notes analytics or engagement tracking (Substack provides this natively).
- Bidirectional sync (reading Notes back into the pipeline).
- Paid-only Notes gating (Notes are public by design on Substack).

---

## 2. What to Build

### 2a. New Copilot CLI Tool: `publish_note_to_substack`

A new tool in the existing `substack-publisher` extension that creates a Note on a target Substack publication. Mirrors the design of `publish_to_substack` (same auth, same env config, same `target` parameter).

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | ✅ | The Note body text. Internally converted to ProseMirror `bodyJson` (same schema family as article drafts). Plain text input is accepted — the tool handles the ProseMirror assembly automatically. |
| `image_path` | string | ❌ | Optional local image path to attach (uploaded to Substack CDN). Up to 1 image per Note recommended for initial version. |
| `article_slug` | string | ❌ | If this Note promotes a published article, the slug. Used to look up the Substack post URL for linking and to record the Note in pipeline.db. |
| `target` | string | ❌ | `"prod"` (default) or `"stage"`. Same semantics as `publish_to_substack`. |

**Behavior:**

1. Load auth from `.env` (same `SUBSTACK_TOKEN`).
2. Resolve target publication URL (`SUBSTACK_PUBLICATION_URL` or `SUBSTACK_STAGE_URL`).
3. If `article_slug` is provided, look up the article's `substack_url` from `pipeline.db` and auto-append a link to the Note body (unless the content already contains the URL).
4. If `image_path` is provided and is a local file, upload it via the existing `uploadImageToSubstack()` function.
5. Assemble ProseMirror `bodyJson` from the resolved content text (via `noteTextToProseMirror()`).
6. **⛔ GATED:** The final `POST` to the Notes endpoint is intentionally disabled until Phase 0 browser interception confirms the exact endpoint path and payload shape. Currently returns a dry-run summary showing the validated inputs and assembled ProseMirror body.
7. Once ungated: `POST` to the confirmed endpoint on the target subdomain with the Note payload and return the Note URL and metadata.

### 2b. Note Generation Helpers

**`generateArticleTeaser(slug)`** — a reusable function (in the extension or callable by agents) that reads an article's `draft.md` and produces a short teaser Note. This can be AI-generated at call time by the calling agent (Lead/Writer) or use a template:

```
Template: "{hook_from_subtitle}\n\nFull breakdown: {substack_post_url}"
```

**`generateQuickTake(topic, take)`** — for standalone Notes not tied to an article. Just wraps the content and posts it.

### 2c. Pipeline Integration

- New optional stage action at Stage 8 (post-publish): "Create promotion Note."
- A `notes` table in `pipeline.db` to track which Notes have been posted for which articles.
- `article_board.py` awareness: surface whether an article has a linked Note in the board output.

---

## 3. Where the Code Lives

```
.github/extensions/substack-publisher/
├── extension.mjs              ← ADD: publish_note_to_substack tool registration
│                                 ADD: createSubstackNote() API function
│                                 ADD: uploadImageToSubstack() already exists (reuse)
│
batch-publish-prod.mjs         ← ADD: batch-note mode (future — not in v1)
│
content/
├── schema.sql                 ← ADD: notes table
├── pipeline_state.py          ← ADD: record_note() and get_notes_for_article() methods
├── article_board.py           ← ADD: note_count column in board output (informational)
│
.squad/skills/
├── substack-publishing/SKILL.md   ← UPDATE: document Notes syntax and tool
├── publisher/SKILL.md             ← UPDATE: add optional "Create promotion Note" step
├── article-lifecycle/SKILL.md     ← UPDATE: mention Notes as post-publish action
│
docs/
├── substack-notes-feature-design.md  ← THIS FILE
```

### Key Principle: Same Extension, New Tool

Notes live in the **same** `substack-publisher` extension — not a separate extension. Rationale:
- Same auth mechanism (cookie-based `SUBSTACK_TOKEN`).
- Same subdomain resolution logic.
- Reuses `makeHeaders()`, `extractSubdomain()`, `uploadImageToSubstack()`.
- Keeps the API surface in one place for maintenance.

---

## 4. How Notes Fit Into the Article Pipeline

### Current Pipeline (Stages 1–8)

```
Idea → Discussion → Panel → Draft → Editor → Publisher → Approval → Published
  1        2          3       4        5         6          7          8
```

### Extended Pipeline with Notes

Notes are a **post-publish action**, not a new stage. They attach to Stage 8 as an optional follow-up:

```
Stage 8 (Published)
  └── 8a: Create promotion Note (optional, recommended)
  └── 8b: Create follow-up Note (optional, days later)
```

**Why not a new Stage 9?**
- Notes are supplementary, not required for an article to be "done."
- Adding a stage would break the existing 8-stage model that the entire pipeline, DB schema, and agent charters assume.
- Some Notes are standalone (no article connection at all).

### Workflow Integration

**Article-linked Notes (automatic prompt):**

After `publish_to_substack` succeeds and Joe publishes the article (Stage 8), Lead or Publisher should prompt:

```
"Article '{title}' is now live. Would you like to create a promotion Note?
Suggested teaser: '{subtitle} — Full breakdown: {url}'"
```

Joe can approve, edit, or skip. If approved, Lead calls `publish_note_to_substack`.

**Standalone Notes (manual trigger):**

Any agent (Lead, Writer, Media) can call `publish_note_to_substack` directly for quick takes, breaking news reactions, or engagement content — no article pipeline stage required.

---

## 5. Data Model & State Implications

### New Table: `notes`

```sql
CREATE TABLE IF NOT EXISTS notes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id      TEXT REFERENCES articles(id),  -- NULL for standalone Notes
    note_type       TEXT NOT NULL DEFAULT 'promotion',
                    -- 'promotion' = teaser for a published article
                    -- 'follow_up' = post-publish engagement
                    -- 'standalone' = not tied to any article
    content         TEXT NOT NULL,                   -- Note body text
    image_path      TEXT,                            -- local path if image was attached
    substack_note_url TEXT,                          -- URL of the published Note
    target          TEXT NOT NULL DEFAULT 'prod',    -- 'prod' or 'stage'
    created_by      TEXT,                            -- agent name or 'Joe'
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Pipeline State Changes

**`pipeline_state.py` additions:**

```python
def record_note(self, article_id, note_type, content, note_url, target='prod', agent=None, image_path=None):
    """Record a published Note in the notes table."""
    self._conn.execute(
        """INSERT INTO notes (article_id, note_type, content, substack_note_url, target, created_by, image_path)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (article_id, note_type, content, note_url, target, agent, image_path)
    )
    self._conn.commit()

def get_notes_for_article(self, article_id):
    """Return all Notes linked to an article."""
    rows = self._conn.execute(
        "SELECT * FROM notes WHERE article_id = ? ORDER BY created_at DESC",
        (article_id,)
    ).fetchall()
    return [dict(r) for r in rows]

def get_all_notes(self):
    """Return all Notes, newest first."""
    rows = self._conn.execute(
        "SELECT * FROM notes ORDER BY created_at DESC"
    ).fetchall()
    return [dict(r) for r in rows]
```

**`article_board.py` changes:**

Add a `notes_count` field to the board output that shows how many Notes exist for each article. This is informational only — it doesn't affect stage inference.

### No Schema Migration Needed

The `notes` table is additive — `CREATE TABLE IF NOT EXISTS` in `schema.sql`. No existing tables are modified. `pipeline.db` schema stays backward-compatible.

---

## 6. API & Tool Surface Changes

### New Tool: `publish_note_to_substack`

Registered in `extension.mjs` alongside the existing `publish_to_substack` tool:

```javascript
{
    name: "publish_note_to_substack",
    description:
        "Creates a Note (short-form post) on the target Substack publication. " +
        "Notes appear in the Substack Notes feed and subscriber home feeds. " +
        "Use for article teasers, quick takes, or engagement content. " +
        "Same auth as publish_to_substack (SUBSTACK_TOKEN in .env). " +
        "If article_slug is provided, auto-links to the published article.",
    parameters: {
        type: "object",
        properties: {
            content: {
                type: "string",
                description: "Note body text. Plain text, URLs auto-linked. Keep concise."
            },
            image_path: {
                type: "string",
                description: "Optional path to a local image to attach."
            },
            article_slug: {
                type: "string",
                description: "Optional article slug to link this Note to."
            },
            target: {
                type: "string",
                description: '"prod" (default) or "stage".',
                enum: ["stage", "prod"]
            }
        },
        required: ["content"]
    },
    handler: async (args) => { /* ... */ }
}
```

### New API Function: `createSubstackNote()` — ⛔ GATED

```javascript
// CURRENT STATE: intentionally throws — the endpoint and payload are UNVERIFIED.
// The function signature accepts ProseMirror bodyJson, not a plain string.
async function createSubstackNote({ headers, bodyJson }) {
    // ⛔ GATED — no-op until Phase 0 browser capture confirms:
    //   1. The exact POST endpoint (likely NOT /api/v1/notes — may be /api/v1/comment or similar)
    //   2. The required fields (bodyJson vs body, tabId, replyMinimumRole, etc.)
    throw new Error("Notes POST is gated — Phase 0 capture required");
}
```

> **Why gated?** The Notes POST endpoint is undocumented. Early investigation
> suggests Notes use ProseMirror `bodyJson` (same schema family as article
> drafts), but the exact URL path and required fields are unconfirmed.
> Everything upstream of the POST (auth, article URL lookup, image upload,
> ProseMirror assembly) is implemented and validated via dry-run.
```

> **⚠️ Important:** The Notes API endpoint is **unofficial / reverse-engineered** and the URL path (`/api/v1/notes`) shown in earlier drafts is a PLACEHOLDER — the real path has not been confirmed. The exact payload format must be validated by intercepting a browser request during Phase 0 (see Section 8 and `docs/notes-api-discovery.md`). The `can3p/substack-api-notes` repo is the canonical reference for Substack's private API surface.
>
> **Critical correction (2025-07-27):** Notes appear to use ProseMirror `bodyJson`, not a plain-text `content` string. The shipped implementation already assembles ProseMirror via `noteTextToProseMirror()` and passes `bodyJson` to `createSubstackNote()`. Phase 0 must confirm whether `bodyJson` is the correct field name and whether additional fields are required.

### Existing Functions Reused (No Changes)

- `loadEnv()` — env loading
- `makeHeaders()` — auth cookie formatting
- `extractSubdomain()` — URL → subdomain extraction
- `uploadImageToSubstack()` — image upload to S3 CDN
- `lookupArticleStateFromDb()` — pipeline.db lookups

---

## 7. Staging & Production Behavior

### Stage Environment (`nfllabstage.substack.com`)

- Notes posted to the staging publication are visible only to stage subscribers (test accounts).
- All development and testing happens here first.
- No risk to real subscribers.

### Production Environment (`nfllab.substack.com`)

- Notes posted to prod appear in the real subscriber feed.
- Requires Joe's explicit approval before posting.
- `target: "prod"` is the default (consistent with article publishing behavior).

### Environment Variables

No new env vars needed. Notes reuse:

| Variable | Used For |
|----------|----------|
| `SUBSTACK_TOKEN` | Auth (same cookie) |
| `SUBSTACK_PUBLICATION_URL` | Prod target |
| `SUBSTACK_STAGE_URL` | Stage target |

---

## 8. Testing Plan

### Phase 1: API Discovery & Validation (Manual, Pre-Code)

Before writing any implementation code:

1. **Intercept a real Notes POST** — Open `nfllabstage.substack.com/notes`, post a Note manually, capture the request in browser DevTools (Network tab).
2. **Document the exact payload** — Record the URL, method, headers, and JSON body.
3. **Test with `curl`** — Replay the request with the `SUBSTACK_TOKEN` cookie to confirm the endpoint works outside the browser.
4. **Test image attachment** — Post a Note with an image, capture the payload format.
5. **Confirm response format** — Document what the API returns (Note ID, URL, etc.).

**Exit criteria:** We have a validated `curl` command that creates a Note on `nfllabstage` and returns a parseable response.

### Phase 2: Unit-Level Code Validation

After implementation:

1. **`createSubstackNote()` function** — Call directly from a test script against `nfllabstage`.
2. **Image upload + Note** — Verify image upload → Note with image works end-to-end.
3. **Auth failure handling** — Confirm graceful error when `SUBSTACK_TOKEN` is invalid/expired.
4. **Missing content handling** — Confirm the tool rejects empty `content` with a clear error.
5. **Article slug linking** — Verify that providing `article_slug` auto-appends the post URL.

### Phase 3: Integration Testing

1. **Full tool call via Copilot CLI** — Call `publish_note_to_substack` as a Copilot tool (not just a function).
2. **Pipeline DB recording** — Verify `pipeline_state.record_note()` writes correctly.
3. **Board output** — Verify `article_board.py` shows note count.
4. **Target switching** — Test `target: "stage"` and `target: "prod"` both resolve correctly.

### Phase 4: Regression Testing

1. **Existing `publish_to_substack`** — Confirm no regressions. Run a full article publish to `nfllabstage`.
2. **Extension load** — Confirm the extension loads without errors after adding the new tool.
3. **Auth sharing** — Confirm both tools use the same token successfully in the same session.

---

## 9. AI Validation Plan

AI validation ensures the Note content meets quality and brand standards before posting.

### Content Quality Gates

Before `publish_note_to_substack` is called, the generating agent (Lead or Writer) must verify:

| Check | Rule | Enforcement |
|-------|------|-------------|
| **Length** | 50–500 characters recommended (no hard limit, but Notes are short-form) | Soft warning if outside range |
| **No stale data** | Cap figures, trade details must be current | Agent responsibility (same as articles) |
| **Brand voice** | Conversational, expert-but-approachable, "War Room" tone | Agent prompt includes Notes voice guidelines |
| **Link validity** | If article_slug provided, confirm the article is actually published (Stage 8) | Hard gate in tool handler |
| **No duplicate** | Check `notes` table — don't post the same promotion Note twice for an article | Soft warning (allow override) |

### AI-Generated Note Templates

The generating agent should use one of these templates as a starting point:

**Article Promotion:**
```
{one_sentence_hook}

{key_insight_or_data_point}

Full breakdown → {post_url}
```

**Quick Take / Breaking News:**
```
{reaction_to_event}

{one_expert_perspective}

{optional_link_or_cta}
```

**Follow-Up / Engagement:**
```
Readers are asking about {topic_from_comments}.

{quick_answer_or_tease}

We'll go deeper in {next_article_tease}.
```

### Validation Prompt for Agents

When generating a Note, the agent's prompt should include:

```
You are writing a Substack Note for NFL Lab. Notes are short-form (think tweet-length),
public, and designed to drive engagement. Voice: confident, expert, slightly provocative.
Input is plain text — the tool assembles ProseMirror internally. URLs will auto-link.
Keep it under 300 characters for maximum engagement.
```

---

## 10. Human / User Validation Plan

### Joe's Review Process

Notes follow the same approval model as articles: **Joe sees it before it goes live on prod.**

**Workflow:**

1. Agent generates Note content and presents it to Joe:
   ```
   📝 Proposed Note for "{article_title}":

   "{note_content}"

   [Approve] [Edit] [Skip]
   ```
2. Joe approves → agent calls `publish_note_to_substack(content: "...", target: "prod")`.
3. Joe edits → agent incorporates edits, re-presents for approval.
4. Joe skips → no Note posted, no record in DB.

**For stage testing:** Joe's approval is not required for `target: "stage"`. Agents can post freely to `nfllabstage` for validation.

### Acceptance Criteria (Joe)

Before signing off on the Notes feature for production:

- [ ] **Saw at least 3 Notes on nfllabstage** — confirms the tool works.
- [ ] **One Note with an image** — confirms image upload works.
- [ ] **One Note linked to a real article** — confirms the URL linking works.
- [ ] **Reviewed the Note in the Substack Notes feed** — confirms formatting looks right on web and mobile.
- [ ] **Approved the brand voice** — confirms the AI-generated templates meet NFL Lab's tone.
- [ ] **Confirmed the approval workflow** — comfortable with the "present → approve → post" flow.

---

## 11. Rollout Plan

### Phase 0: API Discovery (Pre-Implementation) — ⏳ SCAFFOLDING SHIPPED, CAPTURE PENDING

**Duration:** 1 session
**Target:** Browser + curl
**Scope:**
- Manually post a Note on `nfllabstage.substack.com` from the browser.
- Intercept the API call, document the endpoint and payload.
- Replay with `curl` using `SUBSTACK_TOKEN`.
- Document the exact request/response format in this design doc (append to Section 6).

**Shipped scaffolding (2025-07-27):**
- `validate-notes-smoke.mjs` — stage-only smoke harness that validates auth, builds a ProseMirror body, and (once ungated) fires the captured POST. Supports `--dry-run` for pre-capture validation.
- `docs/notes-api-discovery.md` — step-by-step browser capture checklist for Joe/Lead.
- `publish_note_to_substack` tool registered in `extension.mjs` — fully functional up to the POST, which is intentionally gated.
- `noteTextToProseMirror()` helper — converts plain text to ProseMirror doc nodes.
- DB scaffolding: `notes` table in `schema.sql` and `pipeline.db`; `PipelineState.record_note()`, `.get_notes_for_article()`, `.get_all_notes()`; `article_board.py` note-count awareness.

**Still required (Phase 0 capture):**
- Joe or Lead must perform the browser interception on `nfllabstage` per `docs/notes-api-discovery.md`.
- Captured values (`NOTES_ENDPOINT_PATH`, `NOTES_PAYLOAD_SHAPE`, any extra fields) must be recorded in `.env` and this design doc before the tool can be ungated.

**Exit criteria:** Validated `curl` command that creates a Note on `nfllabstage`.

---

### Phase 1: `nfllabstage` — Generic Test Notes

**Duration:** 1–2 sessions
**Target:** `nfllabstage.substack.com`
**Pre-requisite:** Phase 0 capture complete (endpoint + payload confirmed).
**Scope:**

1. ~~Implement `createSubstackNote()` function in `extension.mjs`.~~ ✅ Shipped (gated).
2. ~~Register `publish_note_to_substack` tool in the extension.~~ ✅ Shipped.
3. ~~Add `notes` table to `schema.sql`.~~ ✅ Shipped.
4. ~~Add `record_note()` and `get_notes_for_article()` to `pipeline_state.py`.~~ ✅ Shipped.
5. **Ungate** `createSubstackNote()` with the Phase 0 captured endpoint and payload fields.
5. **Test with 3 generic Notes:**
   - A plain-text Note ("Testing NFL Lab Notes integration — ignore this.")
   - A Note with an attached image.
   - A Note linking to any existing draft on `nfllabstage`.

**Exit criteria:**
- All 3 Notes appear on `nfllabstage.substack.com/notes`.
- Notes are recorded in `pipeline.db` `notes` table.
- No regressions in `publish_to_substack`.

---

### Phase 2: `nfllabstage` — Structured NFL Lab Article

**Duration:** 1 session
**Target:** `nfllabstage.substack.com`
**Scope:**

1. Take an existing Stage 7+ article (e.g., `kc-fields-trade-evaluation`).
2. Publish it to `nfllabstage` using `publish_to_substack(target: "stage")`.
3. Generate a real promotion Note using the article teaser template.
4. Post the Note to `nfllabstage` using `publish_note_to_substack(target: "stage", article_slug: "kc-fields-trade-evaluation")`.
5. Verify the Note appears in the `nfllabstage` Notes feed with the correct link.
6. Generate a standalone "quick take" Note (not article-linked).
7. Verify both Notes render correctly on web and mobile.

**Exit criteria:**
- Article-linked Note with correct post URL appears on `nfllabstage`.
- Standalone Note appears on `nfllabstage`.
- Joe reviews both on `nfllabstage` and approves the format/voice.
- `article_board.py` output shows note count for the linked article.

---

### Phase 3: Production Updates

**Duration:** 1 session
**Target:** `nfllab.substack.com` (production)
**Scope:**

1. Update `schema.sql` in production DB (add `notes` table).
2. Deploy updated `extension.mjs` with both tools.
3. **First prod Note:** Generate a promotion Note for the most recently published article on `nfllab`.
4. Present to Joe for approval.
5. On Joe's approval, post to prod.
6. Verify the Note appears in the real `nfllab.substack.com/notes` feed.

**Exit criteria:**
- First prod Note is live and looks correct.
- Joe approves the workflow.
- Pipeline DB records the Note.
- No impact on existing article publishing.

---

### Phase 4: Documentation & Skill Updates

**Duration:** 1 session
**Scope:**

1. Update `substack-publishing/SKILL.md` with Notes documentation.
2. Update `publisher/SKILL.md` with optional "Create promotion Note" step after Stage 8.
3. Update `article-lifecycle/SKILL.md` to mention Notes as a post-publish action.
4. Create a `Notes voice guide` section in the publishing skill.
5. Update Lead charter to include Notes orchestration.

---

### Phase 5: Ongoing Operation

Once rolled out:
- Lead prompts Note creation after every article publish (Stage 8).
- Joe approves or skips.
- Media agent can trigger standalone Notes for breaking news.
- Notes table provides an audit trail.
- Future: batch Notes, scheduling, analytics integration.

---

## 12. Risks, Rollback & Success Metrics

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Notes API changes** (unofficial endpoint) | Medium | High — tool breaks silently | Phase 0 captures the exact API. Monitor `can3p/substack-api-notes` for changes. Wrap API call with clear error handling. |
| **Auth differences** | Low | Medium — Notes might need different auth | Validate in Phase 0 that the same `substack.sid` cookie works for Notes. |
| **Rate limiting** | Low | Low — we post ~2–5 Notes per week | No batch mode in v1. If Substack adds rate limits, add delays. |
| **Brand voice miss** | Medium | Medium — Notes sound robotic or off-brand | AI validation templates + Joe approval gate. Iterate on templates in Phase 2. |
| **Subscriber confusion** | Low | Low — Notes are a native Substack feature | Notes are expected by the platform. Brief subscribers if needed via a regular post. |
| **Duplicate Notes** | Low | Low — messy but not harmful | Soft duplicate check in the tool handler via `notes` table. |

### Rollback Plan

The Notes feature is fully additive and isolated:

1. **Code rollback:** Remove the `publish_note_to_substack` tool from the extension's `tools[]` array. The extension continues to work with only `publish_to_substack`.
2. **DB rollback:** The `notes` table is standalone — drop it or leave it. No other tables reference it.
3. **Published Notes:** Cannot be un-published via API (same as Substack posts). Delete manually from the Substack web UI if needed.
4. **Pipeline impact:** Zero. Notes don't affect article stages, status, or any existing workflow.

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Notes posted per article** | ≥ 1 promotion Note per published article | `SELECT COUNT(*) FROM notes WHERE note_type = 'promotion'` vs `SELECT COUNT(*) FROM articles WHERE status = 'published'` |
| **Time to first Note** | < 1 hour after article publish | `notes.created_at - articles.published_at` |
| **Joe approval rate** | > 80% of proposed Notes approved on first pass | Track in conversation logs |
| **No regressions** | Zero `publish_to_substack` failures after Notes deployment | Monitor extension error output |
| **Subscriber engagement** | Notes get ≥ 5 likes/restacks within 24h (once audience grows) | Substack analytics dashboard |

---

## Appendix A: Reference API Payloads

> **To be filled in during Phase 0 (API Discovery).**
> Capture the exact request/response from browser DevTools when posting a Note on `nfllabstage`.
> See `docs/notes-api-discovery.md` for the step-by-step capture checklist.

### Request (placeholder — endpoint path is UNCONFIRMED)

```
POST https://nfllabstage.substack.com/<CAPTURED_ENDPOINT_PATH>
Cookie: substack.sid=<token>
Content-Type: application/json

{
    "bodyJson": {                          ← ProseMirror document (likely, unconfirmed)
        "type": "doc",
        "content": [
            { "type": "paragraph", "content": [{ "type": "text", "text": "..." }] }
        ]
    },
    "...": "..."                           ← additional fields TBD from Phase 0 capture
}
```

> **Note:** Earlier drafts of this doc showed a plain `{ "content": "..." }` payload.
> That was a guess. The shipped implementation already assembles ProseMirror `bodyJson`
> based on the pattern used for article drafts and third-party Notes API references.
> Phase 0 must confirm the exact field names and any additional required fields.

### Response (placeholder)

```json
{
    "id": 12345,
    "url": "https://substack.com/@nfllabstage/note/c-12345",
    "...": "..."
}
```

---

## Appendix B: ProseMirror Note Format

Notes are **strongly expected** to use ProseMirror `bodyJson` — the same schema family as article drafts. This is based on:
- Third-party reverse-engineering (`can3p/substack-api-notes`).
- Substack's internal use of ProseMirror across the editor surface.
- The shipped `noteTextToProseMirror()` function already produces valid ProseMirror doc nodes.

The exact top-level field name (`bodyJson` vs `body` vs something else) and any required companion fields (e.g., `tabId`, `replyMinimumRole`) must be confirmed during Phase 0. Until then, the tool operates in dry-run mode and returns the assembled ProseMirror body for inspection without posting.

---

## Appendix C: Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-07-26 | Notes are a post-publish action, not a new pipeline stage | Avoids breaking the 8-stage model; Notes are supplementary |
| 2025-07-26 | Same extension, new tool (not a separate extension) | Shared auth, shared helpers, single maintenance surface |
| 2025-07-26 | Joe approval required for prod Notes | Consistent with article publishing; maintains editorial control |
| 2025-07-26 | `notes` table is standalone with optional FK to `articles` | Supports both article-linked and standalone Notes cleanly |
| 2025-07-26 | Rollout: `nfllabstage` generic → `nfllabstage` structured → prod | Mirrors the proven staging-first pattern from article publishing |
| 2025-07-27 | Notes use ProseMirror `bodyJson`, not plain-text content | Consistent with article draft format; confirmed via third-party API references |
| 2025-07-27 | Final POST gated until Phase 0 browser interception | Avoids shipping a tool that calls an unverified endpoint; all scaffolding except the POST is validated |
| 2025-07-27 | Shipped dry-run tool + smoke harness + DB support ahead of Phase 0 | De-risks Phase 1 — once the endpoint is captured, only the gate needs to be lifted |
