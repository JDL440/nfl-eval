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

