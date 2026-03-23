# UX Review: Stage 7 Publish Flow Wording & Mental Models

**Reviewer:** UX  
**Date:** 2026-03-24  
**Status:** FINDINGS — Ready for team review  
**Input artifacts:** src/dashboard/views/publish.ts, article.ts, home.ts; tests/dashboard/publish.test.ts

---

## Summary

The Stage 7 "Publisher Pass" UI uses the term **"publish workspace"** exactly once, in a tooltip/disabled-state message. The phrase is vague and conflates the **article detail page** (Stage 7 view) with the **separate publish page** (`/articles/:id/publish`). Additionally, warning/status copy about draft creation has weak language that may confuse users about the two-step workflow (Draft → Publish).

---

## Findings

### 1. **"Publish Workspace" Is Ambiguous**

**Evidence:**
- `src/dashboard/views/article.ts:513`
  ```typescript
  : 'Create a Substack draft in the publish workspace before publishing';
  ```
  This appears as a tooltip/disabled-state message on the "Publish to Substack" button when no draft exists.

**Issue:**  
- **Mental model mismatch:** Users don't have a clear referent for "publish workspace."
  - Is it the `/articles/:id/publish` page (Publish Preview view)?
  - Is it the Stage 7 action panel on `/articles/:id`?
  - Is it some external tool?
- The term is used nowhere else in the UI, making it feel like jargon.

**Current workflow:**
1. Article reaches Stage 7 (Publisher Pass)
2. User clicks **"Open Publish Workspace"** → navigates to `/articles/:id/publish`
3. Inside the Publish Preview, user clicks **"Create Draft"** → calls `POST /api/articles/:id/draft`
4. Back on `/articles/:id`, user can now click **"Publish to Substack"** → calls `POST /api/articles/:id/publish`

---

### 2. **Warning Copy Doesn't Match Intended Workflow**

**Evidence:**
- `src/dashboard/views/article.ts:511–513` (Stage 7 action panel, Article Detail page)
  ```typescript
  const publishStatus = hasDraft
    ? 'Substack draft ready for manual publish'
    : 'Create a Substack draft in the publish workspace before publishing';
  ```
- `src/dashboard/views/publish.ts:349`
  ```typescript
  <p class="hint">Publish to Substack, then optionally post a Note and Tweet in sequence.</p>
  ```

**Issue:**  
The two messages tell conflicting stories:
1. Article detail says: *"Create a draft first"* — implies drafting is a blocker
2. Publish page says: *"Then optionally post"* — implies publishing is the main event, social is optional

**Reality (from code & tests):**
- **Two-step workflow is required:** `POST /draft` → `POST /publish`
- User must:
  1. Create a **Substack draft** (saves to their account, editable)
  2. Then publish that draft (makes it live)
- The warning is correct *in isolation*, but the Publish Preview "Publish All" section (lines 347–425) makes it sound like publishing is already done and Notes/Tweets are bonus actions.

---

### 3. **Weak Language in Success States**

**Evidence:**
- `src/dashboard/views/publish.ts:212–214` (when draft is created)
  ```typescript
  return `
    <p class="status-info">Draft created: <a href="${escapeHtml(draftUrl)}" target="_blank">View on Substack ↗</a></p>
    ...
  ```
- Button still says **"Publish to Substack"** — ambiguous whether this publishes the draft or creates a new one
- Test verifies this behavior: `tests/dashboard/publish.test.ts:177–189`
  - Checklist no longer shown on publish page (good)
  - But button label remains static

---

### 4. **Implementation vs. Mental Model: Where Do Publishers Expect To Be?**

**Evidence from navigation:**

| Page | User's mental model | What happens | Risk |
|------|-------------------|---|---|
| `/articles/:id` (Stage 7 Detail) | "I'm reviewing my article" | Can see draft link + "Open Publish Workspace" button | User may not realize publish page is *separate* |
| `/articles/:id/publish` (Publish Preview) | "I'm in the publish workspace" | Preview + Draft/Publish buttons + Note/Tweet composers | User may expect publish page to be a Substack-connected editor, not a local form |
| Substack editor (via link) | "I'm in Substack" | Draft is editable in Substack | User may try to modify article there, then come back to lab expecting sync |

**Finding:** Publishers don't have clear **separation of concerns**:
1. **Lab publish page** = local pre-flight checklist (preview, composer, multi-channel posting)
2. **Substack editor** = live draft editor (syncs directly to Substack account)

---

## Recommendations (For Team Review)

### A. Rename "Publish Workspace" → "Publish Preview" or "Publication Settings"
- Aligns with actual page route
- Clearer intent (preview content before committing)

### B. Clarify Two-Step Workflow in UI Copy
**Current:**
```
"Create a Substack draft in the publish workspace before publishing"
```

**Better:**
```
"Create a draft on Substack, then publish it live from here"
```
or
```
"Create a Substack draft first, then you can publish"
```

### C. Update Button Labels to Reflect State
- Keep **"Create Draft"** (current, clear)
- Change **"Publish to Substack"** → **"Publish Draft to Substack"** or **"Go Live"**
- Adds clarity that this *publishes an existing draft*, not creates a new one

### D. Add Explicit Messaging About Substack Account
In the Publish Preview, surface:
```
📌 Your draft is saved to your Substack account. 
You can edit it in Substack and publish from here when ready.
```

---

## Files to Review for Implementation

1. **article.ts:511–513** — Warning message for Stage 7 disabled state
2. **article.ts:532** — "Open Publish Workspace" button label  
3. **publish.ts:349** — "Publish All" hint text
4. **publish.ts:161** — Button label "Publish to Substack"
5. **publish.ts:219** — Button label in draft-created state

---

### 5. **"Publish All" Flow Doesn't Reflect Pre-Draft Gate** (publish.ts:359–361)

**Evidence:**
- `src/dashboard/views/publish.ts:348–364` (Publish Preview page)
  ```typescript
  <button class="btn btn-publish btn-lg" id="publish-all-btn"
    onclick="publishAll('${id}')"
    ${publishEnabled ? '' : 'disabled title="Create a draft first"'}>
    🚀 Publish All
  </button>
  ```

**Issue:**  
- The "Publish All" section appears on the Publish Preview page, which is *only reachable after creating a draft*.
- Yet the button disabled state still says *"Create a draft first"*
- This is technically correct but suggests the button might be clickable before draft creation—it won't be, because the page itself gates access to non-draft articles.
- Creates redundant information: the page already prevents access if no draft; the button tooltip is noise.

**Better pattern:**  
Remove the disabled state check—the button is only rendered when `publishEnabled` is true. Simplify to:
```typescript
<button class="btn btn-publish btn-lg" id="publish-all-btn" onclick="publishAll('${id}')">
  🚀 Publish All
</button>
```

---

## Test Coverage Notes

- `tests/dashboard/publish.test.ts:142–189` — Publish preview page rendering
- `tests/dashboard/publish.test.ts:217–250` — Draft creation workflow
- Tests verify correct *behavior* (draft creation, publish POST), but don't validate *copy clarity*
- Add test for disabled-state tooltip message once copy is updated
- Note: "Publish All" orchestration uses inline JavaScript (lines 365–425); consider whether SSE/HTMX alternatives better fit dashboard's real-time event model as features evolve

---

## Charter Alignment

This review is scoped entirely within **UX responsibilities**:
- ✅ Dashboard UI design and implementation (wording clarity, labeling)
- ✅ User experience flows and interaction patterns (two-step draft/publish workflow)
- ✅ Responsive interaction patterns (button states, form flows)
- ✅ Hono view rendering (template text clarity)

**Out of scope:**
- ❌ Backend business logic (Code team)
- ❌ Data persistence (Data team)

---

# Decision: repo-root v2 dashboard launcher

**By:** Code (🔧 Dev)
**Date:** 2026-03-23
**Status:** ACCEPTED
**Commit:** 696ddbe81868af2569ce4eace6b082292e85388a

## TLDR

The repo-root `dev.ps1` should launch `npm run v2:serve`, not `v2:dev`, and should not set extra runtime env vars. The v2 startup path already derives config from `.env` plus defaults and initializes the data directory during `serve`.

## Basis

- `package.json` defines both `v2:dev` (`tsx watch src/cli.ts serve`) and `v2:serve` (`tsx src/cli.ts serve`).
- `README.md` explicitly documents using `npm run v2:serve` for source-mode development.
- `src/cli.ts` routes `serve` to `startServer()`.
- `src/config/index.ts` loads `.env` from repo root and data dir config.
- `src/dashboard/server.ts` calls `initDataDir()` during startup.

## Implementation

PowerShell wrapper is thin: resolves repo root from script location, prints the exact npm command being run, and passes port override through to `serve` when needed for local validation.

---

### 2026-03-22T18:05:59Z: User directive
**By:** Joe Robinson (via Copilot)
**What:** Update Squad agent model preferences so Squad coding agents use `gpt-5.4`, with Scribe pinned to `gpt-5.4-mini`.
**Why:** User request — captured for team memory


---

# Decision: Split Issue #85 Into Active Build Scope and Deferred Follow-Up

**Issue:** #85 — K6a │ Structured domain knowledge
**Follow-up:** #91 — K6b │ Structured domain knowledge follow-up — runtime integration + refresh automation
**Status:** ACCEPTED
**Submitted by:** Lead (🏗️)
**Date:** 2026-03-22

---

## TLDR

Issue `#85` is intentionally limited to Phases 1-3 plus docs/testing (Phase 6). Deferred Phases 4-5 are now tracked separately in `#91` so runtime integration and monthly refresh automation do not expand the first implementation pass.

## Decision

Keep `#85` focused on foundational asset creation:
- glossary schemas/examples and authored glossary files
- team identity sheet content/templates
- domain knowledge index/bootstrap organization
- documentation and testing for that first pass

Move the remaining cross-cutting runtime work into `#91`:
- glossary loading/injection in `src/agents/runner.ts`
- team-sheet artifact generation and routing in `src/pipeline/actions.ts` and `src/pipeline/context-config.ts`
- monthly refresh automation, workflow scheduling, and audit logging

## Rationale

Phases 4-5 touch runtime prompt assembly, article context routing, scripts, and CI/workflow automation. Splitting them out keeps the first delivery focused on defining and authoring the structured knowledge assets, while preserving a clear backlog item for the deeper integration and freshness machinery.

## Operational Rule

When owner feedback narrows a multi-phase issue, the Lead should:
1. restate the retained scope on the parent issue,
2. create a linked follow-up for deferred phases with explicit in/out-of-scope language,
3. leave a TL;DR comment on the parent issue to prevent scope drift.


---

# Decision: Issue #85 Scope Lock for Structured Domain Knowledge

**Issue:** #85 — K6a │ Structured domain knowledge
**Status:** APPROVED (Phases 1-3 + docs/testing only)
**Submitted by:** Lead (🏗️)
**Date:** 2026-03-22

---

## TLDR

Code should treat #85 as a **static knowledge-asset proof of concept**, not a runtime integration project. Deliver the new glossary and team-sheet content structure, add focused validation/tests, update docs, and leave prompt injection plus refresh automation to follow-up issue **#91**.

## Scope Boundaries

### In scope for #85

1. **Glossary asset scaffolding**
   - Create `src/config/defaults/glossaries/`
   - Add the first four glossary files:
     - `analytics-metrics.yaml`
     - `cap-mechanics.yaml`
     - `defense-schemes.yaml`
     - `personnel-groupings.yaml`

2. **Team-sheet asset scaffolding**
   - Create `content/data/team-sheets/`
   - Add initial exemplar team sheets for the proof of concept:
     - `SEA.md`
     - `KC.md`
     - `BUF.md`

3. **Validation/tests for this slice only**
   - Verify glossary YAML files are parseable and contain the agreed required fields
   - Verify the initial team sheets exist and contain the expected markdown sections
   - Prefer a dedicated config/static-asset test file under `tests/config/` rather than pipeline/runtime tests

4. **Docs/light references**
   - Update `docs/knowledge-system.md`
   - Update only lightweight references that help explain or validate the new structure

### Explicitly out of scope for #85

- Loading glossaries in `src/agents/runner.ts`
- Injecting team sheets in `src/pipeline/actions.ts`
- Routing new artifacts through `src/pipeline/context-config.ts`
- Monthly refresh jobs, cron workflows, or audit logging
- Reworking `src/config/defaults/bootstrap-memory.json` into a new runtime index

## Structure Decision

For this proof of concept, **do not require all 32 team sheets**. Three authored exemplars (`SEA`, `KC`, `BUF`) are sufficient to validate structure, document the pattern, and keep scope aligned with Joe's “Phases 1-3 plus docs/testing” instruction.

## Testing Decision

The repo does **not** currently include a YAML parsing dependency. Keep the glossary format to a simple, consistent YAML subset and validate it with lightweight test-only parsing/shape checks instead of adding runtime glossary-loading code as part of #85.

## Likely File Set for Code

- `src/config/defaults/glossaries/analytics-metrics.yaml`
- `src/config/defaults/glossaries/cap-mechanics.yaml`
- `src/config/defaults/glossaries/defense-schemes.yaml`
- `src/config/defaults/glossaries/personnel-groupings.yaml`
- `content/data/team-sheets/SEA.md`
- `content/data/team-sheets/KC.md`
- `content/data/team-sheets/BUF.md`
- `tests/config/structured-domain-knowledge.test.ts` (or equivalent focused static-asset test)
- `docs/knowledge-system.md`

## Follow-up

Deferred runtime integration and refresh automation already exist as **issue #91**:
- Phase 4 — runner/pipeline integration
- Phase 5 — refresh automation


---

# Decision: Issue #85 Phase 1–3 asset layout and planning guardrails

**Issue:** #85 — K6a │ Structured domain knowledge
**Status:** PROPOSED
**Submitted by:** Research (🔍)
**Date:** 2026-03-22

---

## TLDR

For the approved Phase 1–3 implementation, keep the work focused on authoring structured knowledge assets and documentation. Store glossary YAML and team identity markdown under `src/config/defaults/knowledge/`, and defer any runtime loading, artifact injection, or refresh automation to follow-up issue `#91`.

## Proposed Working Layout

- `src/config/defaults/knowledge/glossaries/analytics-metrics.yaml`
- `src/config/defaults/knowledge/glossaries/cap-mechanics.yaml`
- `src/config/defaults/knowledge/glossaries/defense-schemes.yaml`
- `src/config/defaults/knowledge/glossaries/personnel-groupings.yaml`
- `src/config/defaults/knowledge/team-identities/SEA.md`
- `src/config/defaults/knowledge/team-identities/KC.md`
- `src/config/defaults/knowledge/team-identities/BUF.md`
- `docs/knowledge-system.md`

## Why this layout

`docs/knowledge-system.md` already frames seeded defaults under `src/config/defaults/` and runtime knowledge under the data directory. Keeping Phase 1–3 assets in the defaults tree preserves that architecture, avoids mixing authored knowledge with executable/query assets in `content/data/`, and gives Phase 4 a clean future path for seeding or runtime copying.

## Guardrails for implementers

1. **Do not pull Phases 4–5 back in.** No `runner.ts`, `actions.ts`, `context-config.ts`, cron, or refresh-job work belongs in this pass.
2. **Normalize team keys before future lookup work.** `primary_team` values are inconsistent across the repo (`SEA` vs `seahawks` vs display names), so future runtime integration should use a single team-abbreviation mapper.
3. **Keep team sheets stable.** Identity sheets should describe coaching, scheme identity, terminology, and organizational tendencies — not volatile roster snapshots already covered by `roster-context.ts`.
4. **Prefer schema/content validation tests.** Phase 1–3 tests should verify file presence and structural integrity, not prompt-injection behavior.

---

# Code planning note — Issue #85

- **By:** Code (🔧 Dev)
- **Date:** 2026-03-22
- **Issue:** #85
- **Scope:** Phases 1–3 plus docs/testing only

## Planning Decision

Treat the new glossary files and team sheets as **validated static knowledge assets**, not runtime-integrated prompt inputs, for issue #85.

## Recommended structure

- Keep glossary seeds in `src/config/defaults/glossaries/*.yaml`
- Keep the current **JSON-compatible YAML** shape for phase 1–3 so Vitest can validate with zero new parser dependency
- Keep proof-of-concept team sheets in `content/data/team-sheets/{BUF,KC,SEA}.md`
- Use a fixed markdown section layout for team sheets:
  - `## Snapshot`
  - `## Leadership`
  - `## Offensive Identity`
  - `## Defensive Identity`
  - `## Roster Pillars`
  - `## Data Anchors`
  - `## Editorial Angles`

## Source and test touchpoints

- `src/config/index.ts` / `tests/config/bootstrap.test.ts` are the seeding seam if these assets are ever copied into the user data dir
- `src/agents/runner.ts` currently composes only charter + skills + memory + optional roster context
- `src/pipeline/context-config.ts` and `src/pipeline/actions.ts` currently know about `roster-context.md`, not team-sheet artifacts
- `tests/config/domain-knowledge.test.ts` is the right validation seam for phase 1–3 asset coverage

## Docs boundary

`docs/knowledge-system.md` should be updated to describe:

1. current runtime behavior
2. the new hierarchical KB asset layout introduced by phases 1–3
3. that runtime glossary/team-sheet injection and refresh automation were intentionally deferred to #91

## Pitfalls

- Do not imply the YAML or team sheets are already loaded by the runner
- Do not introduce a real YAML parser unless scope expands beyond docs/testing support
- Keep bootstrap-memory compatibility intact; phases 1–3 should coexist with `bootstrap-memory.json`, not replace it

---

# Decision — Issue #85 Proof-of-Concept Structure

- **By:** Code (🔧 Dev)
- **Date:** 2026-03-22
- **Issue:** #85

## Decision

Use **JSON-compatible YAML** for the initial glossary seeds in `src/config/defaults/glossaries/` and a fixed markdown section template for proof-of-concept team sheets in `content/data/team-sheets/`.

## Why

- The repo does not currently ship a YAML parser dependency, and the approved scope explicitly limits this work to phases 1-3 plus docs/testing support.
- JSON-compatible YAML keeps the file format valid for future YAML-aware runtime loading while allowing zero-dependency validation in Vitest today.
- A fixed heading structure on team sheets makes the proof of concept easy to validate without prematurely locking in runtime injection behavior.

## Scope Notes

- This decision covers only the seed artifact structure and test strategy.
- Runtime loading/injection and refresh automation remain deferred to the follow-up issue for phases 4-5.

---

# Data decision — Issue #85 factual content schema

**By:** Data (📊)  
**Date:** 2026-03-22  
**Issue:** #85  
**Scope:** Phases 1–3 only

## Decision

Use a simple, auditable YAML schema for glossary files and markdown frontmatter for team sheets.

### Glossary file shape

Each glossary file should contain:

- `schema_version`
- `glossary`
- `description`
- `entry_fields`
- `refresh_guidance`
- `entries`

Each glossary entry should contain:

- `term` — canonical label to reference in prompts and downstream rendering
- `definition` — one durable, plain-English definition
- `source.refs` — one or more citations; prefer official or internal canonical sources
- `verified_date` — date of human review in `YYYY-MM-DD`
- `ttl_days` — freshness window for that specific fact

Optional entry fields:

- `notes` — interpretation rules, edge cases, or caveats
- `examples` — short usage examples that future automation can surface directly

### Team-sheet shape

Team sheets should stay markdown-first, with frontmatter for:

- `team`
- `team_name`
- `verified_date`
- `ttl_days`
- `sources`
- `volatility`

The body should only include slow-changing identity facts plus explicit source guidance for anything seasonal or coaching-dependent.

## Reasoning

- The YAML glossary schema is strict enough for future validation, but small enough to author by hand without introducing a new parser contract during phases 1–3.
- Per-entry `verified_date` and `ttl_days` matter more than file-level freshness because analytics definitions, cap rules, and scheme language age at different speeds.
- Team sheets stay in markdown so humans can read and edit them easily, while frontmatter still gives future automation a stable hook for validation and refresh jobs.

## Source hierarchy

1. Official league or team site
2. OTC / nflverse / current query output
3. Existing internal canonical knowledge (`bootstrap-memory.json`, agent charters, skills)

If a fact is materially volatile and cannot be verified from tier 1 or 2, omit it instead of stretching TTL.

---

# Decision: Issue #85 Phase 1–3 content formats

**Issue:** #85 — K6a │ Structured domain knowledge
**Status:** PROPOSED
**Submitted by:** Research (🔍)
**Date:** 2026-03-22

---

## TLDR

For the approved Phase 1–3 pass, use two lightweight, testable content formats:

- **Glossaries:** YAML files in `src/config/defaults/glossaries/`
- **Team identity sheets:** Markdown files in `content/data/team-sheets/`

This keeps the work squarely in the content/documentation layer while staying easy for Code and Data to validate later.

## Glossary Format

Each glossary should use:

```yaml
schema_version: 1
glossary: analytics-metrics
description: ...
entry_fields:
  required:
    - term
    - definition
    - source
    - verified_date
    - ttl_days
  optional:
    - notes
    - examples
refresh_guidance:
  - ...
entries:
  - term: ...
    definition: ...
    notes: []
    examples: []
    source:
      refs: []
    verified_date: YYYY-MM-DD
    ttl_days: 365
```

### Why

1. It is structured enough for deterministic tests without adding a YAML parser dependency.
2. It bakes source and freshness fields directly into each entry.
3. It leaves room for future indexing or runtime loading without changing the authoring format.

## Team Sheet Format

Each team identity sheet should use:

```markdown
---
team: SEA
team_name: Seattle Seahawks
verified_date: YYYY-MM-DD
ttl_days: 30
sources:
  - ...
volatility:
  leadership: 30
  team_identity: 120
  venue_and_division: 365
---

# Seattle Seahawks

## Durable snapshot
## Identity anchors
### Offense
### Defense
## Roster-building and cap framing
## Source guidance
```

### Why

1. It produces stable, scannable briefs for writers and editors.
2. It separates freshness metadata from the actual narrative guidance.
3. It is straightforward to validate with frontmatter and section-header tests.

## Phase Boundary

This decision covers only Phases 1–3 content authoring. It does **not** imply runtime loading, artifact injection, refresh automation, or source-provenance indexing; those remain follow-up implementation work.
---

# Decision: Issue #103 bounded editor review context

**Issue:** #103
**Status:** IMPLEMENTED
**Submitted by:** Code (🔧 Dev)
**Date:** 2026-03-23

## Decision

Bound editor self-history at 10 prior reviews, prefer newest reviews deterministically, and enforce newest-first ordering when applying limits.

## Why

This keeps runtime editor prompts predictable without changing the existing adv-stage/context-config behavior introduced by PR #97. Bounding only in the formatter would still let the runtime load an unnecessarily large editor turn set before formatting.

## Validation

- `npm run v2:test -- tests/pipeline/conversation.test.ts tests/pipeline/actions.test.ts`
- `npm run v2:build`

## Follow-up

Existing PR #105 already references issue #103 as a PR #97 follow-up.

---

# Decision: Issue #92 should use summary-only shared handoffs at runtime

**Issue:** #92 — charter isolation in shared article conversation context
**Status:** IMPLEMENTED
**Submitted by:** Code (🔧 Dev)
**Date:** 2026-03-22

## TLDR

Keep storing full per-article conversation history, but stop injecting that raw shared transcript into Writer, Editor, and Publisher by default. Runtime handoffs should use a compact revision-summary block, with Editor additionally receiving only its own previous reviews and Writer revisions still receiving the current `editor-review.md` artifact as an explicit handoff.

## Decision

Use `buildRevisionSummaryContext()` in `src/pipeline/conversation.ts` as the default shared cross-role prompt surface.

- Writer: shared revision summary only
- Writer revisions: explicit current `editor-review.md` handoff + previous draft + shared revision summary
- Editor: shared revision summary + `buildEditorPreviousReviews()`
- Publisher: shared revision summary only

## Why

The practical bleed risk came from `src/pipeline/actions.ts` prepending the full raw writer/editor/publisher transcript to later user messages. `revision_summaries` already contain the lowest-risk cross-agent continuity data we need, so no schema migration was necessary.

## Scope boundary

Keep `article_conversations` and `buildConversationContext()` for storage, debugging, and any future explicit full-history surfaces.

---

# Decision: Article usage summaries must read full per-article history

**Issue:** #93 — article page missing token usage for Copilot CLI provider
**Status:** IMPLEMENTED
**Submitted by:** Code (🔧 Dev)
**Date:** 2026-03-22

## TLDR

When the dashboard renders an article-level token usage summary, it must aggregate from the full `usage_events` history for that article, not an arbitrary recent-row cap.

## Decision

Change `Repository.getUsageEvents(articleId)` so the default call returns all usage rows for the article. Keep the `limit` parameter only for explicit callers that truly want truncation.

## Why

Article detail and live-sidebar routes hydrate their summary panels with `repo.getUsageEvents(articleId)`, and the old default limit of 100 rows silently dropped early-stage usage once later panel/editor events accumulated.

## Guardrail

Any UI or report that presents article-wide token totals, provider breakdowns, or cost summaries must read the full per-article usage history unless it also performs a correctness-preserving aggregate query in the database.

---

# Decision: Issue #110 article timing totals

**Status:** ACCEPTED
**Issue:** #110 — stage runs should show a total of time spent on an article
**Date:** 2026-03-23

## TLDR

Treat #110 as a dashboard aggregation/presentation task over existing `stage_runs` rows. The work should surface article-level totals from the current stage-run data, not add schema or repository persistence.

## Decision

- Remove `go:needs-research`.
- Keep the scope focused on an article-level total-time summary for stage runs.
- Route implementation to UX after #109 lands.

## Why

`stage_runs` already stores `article_id`, `stage`, `surface`, `status`, `started_at`, and `completed_at`, and the article page already hydrates those rows. Current UI only renders per-row durations, so the missing work is aggregation and presentation.

## Boundary

Any deeper split for retry/self-heal timing inside a stage action remains a separate persistence enhancement.

## Next step for Ralph

After #109 lands, queue #110 as the next article-detail follow-up and hand it to UX for implementation.

---

# Decision: Rebase PR #113 to replay only the Stage 7 publish fix

- **Issue:** #111 / PR #113
- **Context:** PR #113 was opened from a branch still stacked on `ux/issue-93-copilot-usage`, so after PR #112 landed the PR still carried unrelated history and showed a dirty merge state against `main`.
- **Decision:** Rebase `fix/issue-111-publish-ui` directly onto `origin/main` and keep only the Stage 7 manual publish action-panel change plus its focused regression.
- **Why:** The actual bug is local to the article detail action panel: Stage 7 manual publish should be enabled when `substack_draft_url` exists, even though the pipeline advance guard still expects `substack_url` for Stage 7→8 advancement.
- **Implementation paths:** `src/dashboard/views/article.ts`, `tests/dashboard/server.test.ts`.

---

# Code decision — repo-root v2 dashboard launcher

- **By:** Code (🔧 Dev)
- **Date:** 2026-03-23

## TLDR

The repo-root `dev.ps1` should launch `npm run v2:serve`, not `v2:dev`, and it should not set extra runtime env vars. The current v2 startup path already derives config from `.env` plus defaults and initializes the data directory during `serve`.

## Basis

- `package.json` defines both `v2:dev` (`tsx watch src/cli.ts serve`) and `v2:serve` (`tsx src/cli.ts serve`).
- `README.md` explicitly says to use `npm run v2:serve` for source-mode development.
- `src/cli.ts` routes `serve` to `startServer()`.
- `src/config/index.ts` loads `.env` from the repo root and data dir config.
- `src/dashboard/server.ts` calls `initDataDir()` during startup.

## Implementation note

Keep the PowerShell wrapper thin: resolve the repo root from the script location, print the exact npm command being run, and pass a port override through to `serve` when needed for local validation.


---

### 2026-03-23T00:00:00Z: Dashboard auth direction
**By:** Code (via Copilot)
**What:** Adopt a minimum-viable long-term dashboard auth layer built around Hono middleware, login/logout routes, an opaque `httpOnly` session cookie, and a SQLite-backed `dashboard_sessions` table. Avoid a client-only password flag or a full multi-user account system for the first pass.
**Why:** Current dashboard routing in `src/dashboard/server.ts` has no auth middleware, no cookie/session handling, and no auth-related repository/schema support, yet it exposes article editing, publishing, memory, and config surfaces. This recommendation fits the existing Hono + `loadConfig()` + Repository architecture with the least churn and gives a stable seam for future multi-user expansion.

---

# Publisher publish-flow review

## Proposed team decision

Treat Stage 7 publishing as an explicitly **manual two-step dashboard workflow**:

1. open `/articles/:id/publish`
2. create the Substack draft
3. publish the draft to advance to Stage 8

## Why this matters

Current implementation already works this way:

- `src/pipeline/actions.ts:896-919` shows Stage 7→8 is not an automated pipeline action; it requires `substack_url` to already exist from dashboard publishing.
- `src/dashboard/server.ts:1318-1438` separates draft creation from final publish.
- `src/dashboard/views/article.ts:508-563` disables the publish button until a draft exists and routes users to `/articles/:id/publish`.

## UX implication

If the team keeps the current implementation, product copy should describe `/articles/:id/publish` consistently as either:

- **Publish page**
- **Publish console**
- **Publish workspace**

Using multiple labels for the same surface creates avoidable editor confusion.

---

# Research proposal — Issue #102 dashboard auth direction

**Issue:** `#102` — Dashboard auth hardening: replace shared password gate with proper login controls  
**Status:** Research recommendation for Lead/PO review  
**Date:** 2026-03-23

## Context

- Issue `#102` asks for a durable replacement for the current shared-password dashboard protection.
- Joe's issue comment sets the product direction for now: **"We can use simple local login control mechanism with user and password control for now."**
- The current v2 app is a Hono + HTMX dashboard backed by SQLite, with no existing auth/session subsystem in the runtime config or repository schema.

## Grounded findings

1. **The dashboard is effectively open at the app layer today.**
   - `src/dashboard/server.ts` registers `/`, `/articles/:id`, `/config`, `/agents`, `/memory`, `/runs`, many `htmx/*` routes, and `api/*` routes directly from `createApp()`.
   - `src/dashboard/sse.ts` exposes `/events` without any auth seam.
   - `src/dashboard/server.ts` also serves `/images/:slug/:file`, which can reveal unpublished article assets.

2. **There is no existing auth/session persistence seam.**
   - `src/db/repository.ts` has no user or session methods.
   - `src/db/schema.sql` has no auth/session tables.

3. **The config surface is still small and can absorb a minimal auth mode cleanly.**
   - `src/config/index.ts` currently centralizes env-driven runtime config and is the natural place for dashboard-auth settings.

4. **Tests assume unauthenticated direct route access today.**
   - `tests/dashboard/server.test.ts`
   - `tests/dashboard/publish.test.ts`
   - `tests/dashboard/config.test.ts`
   - `tests/e2e/live-server.test.ts`

## Recommended direction

Adopt a **single-operator local login** design as the repo's long-term baseline for issue `#102`, implemented later through the existing Hono + SQLite seams:

### 1) Auth model

- Start with **local username + password login only**.
- Treat this as a **single-operator / small-admin dashboard**, not a general multi-user product.
- Do **not** introduce OAuth, GitHub login, or role-heavy RBAC in the first pass.

### 2) Enforcement seam

- Add **server-enforced Hono middleware** in `src/dashboard/server.ts`.
- Protect:
  - HTML dashboard pages
  - HTMX endpoints
  - JSON API endpoints
  - SSE stream at `src/dashboard/sse.ts` (`/events`)
  - unpublished image route `/images/:slug/:file`
- Leave open only:
  - `/static/*`
  - explicit login/logout endpoints
  - any future health check route if one is added intentionally

### 3) Session design

- Use an **opaque session id** in an `httpOnly` cookie.
- Back sessions with a small SQLite table (for example `dashboard_sessions`) rather than a client-side boolean flag.
- Session rows should support:
  - session id
  - username or operator identifier
  - created/updated timestamps
  - expiration / revocation
- Cookie defaults should be secure-by-default for public deployment:
  - `HttpOnly`
  - `SameSite=Lax` (or stricter if compatible)
  - `Secure` in production
  - explicit max age / expiry

### 4) Config shape

- Keep auth **config-driven** from `src/config/index.ts`.
- Recommended direction is a small auth mode surface, e.g.:
  - auth mode (`off|local`)
  - admin username
  - password hash
  - session secret
- Keep auth **off by default in tests/dev unless explicitly enabled**, because current tests construct `createApp(repo, config)` and call routes immediately.

### 5) Scope boundary

- This issue should deliver a durable **local login/session foundation**.
- Defer until later unless product needs change:
  - OAuth / SSO
  - multiple user roles
  - fine-grained authorization matrices
  - external identity providers

## Why this direction fits the repo

- It matches the owner's stated preference for a simple local login for now.
- It fits the current architecture: Hono middleware for request gating, SQLite for durable state, and env/config loading through `src/config/index.ts`.
- It avoids overbuilding a public SaaS-style auth system for what is currently an internal/editorial workstation.

## Key file paths

- `src/dashboard/server.ts`
- `src/dashboard/sse.ts`
- `src/config/index.ts`
- `src/db/repository.ts`
- `src/db/schema.sql`
- `tests/dashboard/server.test.ts`
- `tests/dashboard/publish.test.ts`
- `tests/dashboard/config.test.ts`
- `tests/e2e/live-server.test.ts`

---

# Decision: Dashboard auth direction — Issue #102

**By:** Research (via Copilot)  
**Date:** 2026-03-23  
**Issue:** #102  

## TLDR

Adopt a **single-operator local login** design as the repo's long-term baseline for issue #102:
- Server-enforced Hono middleware protecting all dashboard surfaces except login/logout and static assets
- Opaque session id in `httpOnly` cookie
- SQLite-backed `dashboard_sessions` table
- Config-driven auth mode (off by default in tests/dev)

Defer OAuth, multi-user RBAC, and external identity providers to future issues.

## Why

Current dashboard has no auth middleware or session persistence seam. The architecture is Hono + HTMX + SQLite, which naturally accommodates a minimal local-login foundation. This recommendation fits the owner's stated preference ("simple local login for now") and avoids overbuilding SaaS-style auth for an internal editorial workstation.

## Scope

This decision defines the direction; implementation is deferred for Code team. Key files:
- `src/dashboard/server.ts` — middleware enforcement
- `src/config/index.ts` — auth config shape
- `src/db/schema.sql`, `src/db/repository.ts` — session persistence
- `tests/` — auth-aware test helpers and disable-by-default fixtures

---

# Decision: Code auth seam implementation — Issue #102

**By:** Code (via Copilot)  
**Date:** 2026-03-23  
**Issue:** #102  

## TLDR

Implement a minimum-viable long-term dashboard auth layer:
- Hono middleware protecting all dashboard + API routes
- Login/logout endpoints with session cookie
- SQLite `dashboard_sessions` table (id, username, created/updated/expires)
- Config-driven enable/disable from `src/config/index.ts`
- Secure cookie defaults: `HttpOnly`, `SameSite=Lax`, `Secure` in production

Avoid client-only password flag or multi-user account system in the first pass.

## Why

Current dashboard routing in `src/dashboard/server.ts` has no auth middleware, no cookie/session handling, and no auth-related repository/schema support, yet it exposes article editing, publishing, memory, and config surfaces. This design fits the existing Hono + `loadConfig()` + Repository architecture with the least churn and gives a stable seam for future multi-user expansion.

---

# Decision: Publisher publish-flow review — Stage 7 mental models

**By:** Publisher  
**Date:** 2026-03-23  

## TLDR

Treat Stage 7 publishing as an explicitly **manual two-step dashboard workflow**:

1. Open `/articles/:id/publish`
2. Create the Substack draft
3. Publish the draft to advance to Stage 8

Current implementation already works this way. Product copy should use consistent terminology for the publish page (`/articles/:id/publish`) — either "Publish Page", "Publish Console", or "Publish Workspace" — to avoid editor confusion.

## Why

- Stage 7→8 transition in `src/pipeline/actions.ts:896-919` is not automated; it requires `substack_url` to already exist from dashboard publishing.
- Dashboard separates draft creation (`POST /api/articles/:id/draft`) from final publish (`POST /api/articles/:id/publish`).
- Tests verify the two-step behavior.

Using multiple labels for the same surface creates avoidable confusion. Standardize on one term.

---

# Decision: Research direction — Issue #102 dashboard auth

**By:** Research (🔍)  
**Date:** 2026-03-23  
**Issue:** #102 — Dashboard auth hardening

## TLDR

Issue #102 should move toward a **single-operator local login** model matching current repo architecture: Hono dashboard, HTMX interactions, and SQLite persistence. Server-enforced session-based auth, not shared-password stopgap or OAuth.

## Why

- Owner guidance: **"We can use simple local login control mechanism with user and password control for now."**
- `src/dashboard/server.ts` exposes HTML, HTMX, API, SSE, image routes from one Hono app → auth should be centralized middleware
- `src/config/index.ts` natural seam for auth mode/session secret
- `src/db/repository.ts` and `src/db/schema.sql` natural persistence seam
- `README.md` describes small Hono + HTMX + SQLite workstation, not multi-tenant SaaS

## Proposal

1. **Local username/password login** as approved first auth mode
2. **Hono auth middleware** protecting dashboard HTML, HTMX, API, SSE, unpublished images
3. **Opaque `httpOnly` cookie session** with secure defaults
4. **SQLite-backed session persistence** via small dashboard session seam
5. **Config-driven enable/disable** for lightweight tests/dev

## Non-goals for first pass

- OAuth / SSO
- Multi-role RBAC
- Generalized account-management system

---

# Decision: Lead recommendation — Issue #102 dashboard auth hardening

**By:** Lead  
**Date:** 2026-03-23  
**Issue:** #102 — Dashboard auth hardening

## TLDR

Current repo has **no durable app-layer auth seam**. Minimum viable long-term fix: **single-operator local login** via existing Hono + SQLite:

- Hono auth middleware in `src/dashboard/server.ts`
- Explicit login/logout routes
- Opaque `httpOnly` session cookie
- SQLite-backed `dashboard_sessions` persistence
- Config-driven auth mode in `src/config/index.ts`

Defer OAuth, multi-user roles, external identity providers.

## Grounded findings

1. `src/dashboard/server.ts` registers `/`, article pages, HTMX, API, `/images/:slug/:file`, SSE without auth middleware or login/session handling
2. `src/dashboard/sse.ts` exposes `/events` directly → must be covered by auth seam
3. `src/config/index.ts` has no dashboard-auth config yet → natural place for `off|local` mode, username, password-hash, session-secret
4. `src/db/schema.sql` and `src/db/repository.ts` have no user/session tables → SQLite cleanest durable seam
5. Current tests hit routes directly with no login → auth must stay disabled by default unless explicitly enabled
6. Joe's issue comment: **"We can use simple local login control mechanism with user and password control for now."**

## In scope

- Local username/password login
- Durable server-side session storage
- Secure cookie defaults for internet-facing deployment
- Protection for HTML, HTMX, JSON API, SSE, unpublished image routes
- Regression coverage for login, logout, protected-route behavior

## Out of scope for first pass

- OAuth / GitHub login / SSO
- Multi-user role matrices
- Fine-grained authorization beyond "authenticated operator"
- External auth providers

## Suggested routing

- **Code:** middleware seam, login/logout handlers, config wiring, DB schema/repository changes, auth tests
- **UX:** login page/form UX, auth error copy, unauthenticated redirects
- **DevOps:** env-secret documentation, secure deployment defaults, cookie/security review
- **Lead:** architectural review and scope control

## Risk notes

- Issue body references temporary shared-password gate, but not present in current `src/` → implementation should avoid preserving client-only/shared-secret stopgap
- `/events` and `/images/:slug/:file` easy to miss → should be protected dashboard surfaces by default
---

# Decision: Dashboard auth hardening — single-operator local login

**Issue:** #102  
**Status:** RECOMMENDED (locked, ready for team routing)  
**Submitted by:** Lead + Research (🏗️ 🔍)  
**Date:** 2026-03-23

## Summary

Issue #102 seeks to harden dashboard auth by replacing an ad-hoc shared-password gate with proper login controls. Current analysis shows the dashboard in `src/dashboard/server.ts` has no durable app-layer auth seam. Recommendation: implement **single-operator local login** using Hono middleware, opaque `httpOnly` session cookie, and SQLite persistence.

This direction aligns with Joe's product guidance ("simple local login for now"), fits the existing Hono + SQLite architecture with minimal churn, and defers OAuth/RBAC to a future issue.

## TLDR

Implement single-operator local login via:
- Hono auth middleware protecting all dashboard + API routes
- explicit login/logout endpoints with session cookie
- SQLite `dashboard_sessions` table for durable persistence
- config-driven auth mode (`off|local`) in `src/config/index.ts`
- secure cookie defaults (`HttpOnly`, `SameSite=Lax`, `Secure` in production)

Out of scope for first pass: OAuth, multi-user RBAC, external auth providers.

## Why

1. **No current auth seam:** `src/dashboard/server.ts` registers `/`, article pages, HTMX routes, API routes, `/images/:slug/:file`, and SSE without auth middleware or session handling.
2. **Exposure scope:** All surfaces (HTML, HTMX, JSON API, SSE, unpublished images) must be protected by default.
3. **Architecture fit:** Hono middleware + SQLite persistence aligns with existing editorial workstation design, not multi-tenant SaaS.
4. **Product direction:** Joe's comment directs toward "simple local login"—not a generalized account system.
5. **Test compatibility:** Current tests assume open access. Auth must stay disabled by default in tests/dev.

## Grounded findings

- `src/dashboard/server.ts` — no auth middleware, login routes, or cookie/session parsing
- `src/dashboard/sse.ts` exposes `/events` directly, must be covered by same auth gate
- `src/config/index.ts` — natural seam for auth mode, username, password-hash, session-secret settings
- `src/db/schema.sql` + `src/db/repository.ts` — no user/session tables yet; SQLite is the cleanest durable seam
- Tests (`tests/dashboard/server.test.ts`, `tests/dashboard/publish.test.ts`, `tests/dashboard/config.test.ts`, `tests/e2e/live-server.test.ts`) hit routes directly with no login setup
- Issue comment references a temporary shared-password gate, but that seam is not present in current checked-in `src/` runtime

## Scope boundary

### In scope
- Local username/password login
- Durable server-side session storage (SQLite)
- Secure cookie defaults suitable for internet-facing deployment
- Protection for HTML, HTMX, JSON API, SSE, and unpublished image routes
- Regression coverage for login, logout, and protected-route behavior

### Out of scope for first pass
- OAuth / GitHub login / SSO
- multi-user role matrices
- fine-grained authorization beyond "authenticated operator"
- external auth providers

## Suggested team routing

- **Code (🔧):** Middleware seam, login/logout handlers, config wiring, DB schema/repository changes, auth tests
- **UX (🎨):** Login page/form UX, auth error copy, unauthenticated redirects
- **DevOps (⚙️):** Env-secret documentation, secure deployment defaults, cookie/security review
- **Lead (🏗️):** Architectural review and scope control

## Key files to touch

- `src/dashboard/server.ts` — auth middleware
- `src/dashboard/sse.ts` — SSE protection
- `src/config/index.ts` — auth mode config
- `src/db/schema.sql`, `src/db/repository.ts` — session persistence
- `tests/` — auth-aware test helpers and disable-by-default fixtures
