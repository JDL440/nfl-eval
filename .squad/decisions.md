---

# Decision — Issue #93 article usage panels must use full per-article usage history

- **By:** UX (⚛️)
- **Date:** 2026-03-22
- **Issue:** #93

## Decision

For article detail and live usage panels, `usage_events` should be read as the full per-article history by default, not the newest 100 rows.

## Why

- The provider and pipeline layers already create Copilot CLI token usage: `src/llm/providers/copilot-cli.ts` returns estimated usage, `src/agents/runner.ts` maps it into `tokensUsed`, and `src/pipeline/actions.ts` persists it.
- The user-facing gap appeared later in the chain because `Repository.getUsageEvents()` capped article reads at 100 rows, which let early `copilot-cli` events disappear after many later panel/editor runs.
- The article usage UI in `src/dashboard/server.ts` and `src/dashboard/views/article.ts` is intended to summarize the article's durable usage record, so truncating history at the repository seam produced misleading provider/model breakdowns.

## Scope note

This decision is narrowly for article-level usage rendering. Callers that truly need a bounded history can still request an explicit limit.

---

# Decision: Keep Issue #93 narrow; track LLM trace transparency separately

**Submitted by:** Research / Code  
**Date:** 2026-03-22

## TLDR

Keep the article usage bug fix scoped to token-usage persistence and rendering. Track a separate dev-only trace framework for request/response envelopes, provider routing, correlation IDs, retention, and redaction.

## Decision

- Keep `#93` focused on article usage history and dashboard rendering.
- Open a separate dev-only transparency issue for full request/response traces.
- Continue using persisted thinking artifacts for artifact-level debug visibility; do not repurpose them as the raw prompt log.

## Why

- `usage_events` is enough for token/cost summaries, but not for postmortems.
- The dashboard debug surface should stay distinct from a lower-level LLM trace store.
- The new framework needs explicit retention and safety rules.

## Scope

- **In scope:** request/response trace capture, correlation IDs, storage, retention, dashboard trace view, redaction controls.
- **Out of scope:** shipping raw prompts in production UI, logging secrets, or replacing the thinking artifact mechanism.

---

# Decision: Dashboard debug visibility should read persisted thinking artifacts

**Issue:** Restore collapsible agent-thinking/debug visibility on article artifact pages
**Status:** IMPLEMENTED
**Submitted by:** Code (🔧 Dev)
**Date:** 2026-03-22

---

## TLDR

The article artifact viewer should populate its collapsible debug/thinking section from the persisted companion `*.thinking.md` artifact when one exists, and only fall back to inline `<think>`/`<reasoning>` extraction for legacy content.

## Decision

Use the saved thinking artifact as the primary data source for the main artifact view:

- `draft.md` reads from `draft.thinking.md`
- `editor-review.md` reads from `editor-review.thinking.md`
- same pattern for other persisted pipeline artifacts

The dedicated 💭 tab remains available for opening the raw thinking artifact directly, but the standard artifact tab should again show a collapsible debug section when persisted thinking exists.

## Why

- The pipeline now intentionally strips thinking from the main artifact output and persists it separately in `writeAgentResult()` (`src/pipeline/actions.ts`), so the old inline-only renderer no longer sees most thinking traces.
- These companion files are the authoritative persisted record for debugging and do not require reconstructing output from lossy secondary stores.
- Conversation history is not the right source because it stores cleaned assistant outputs for prompt continuity, not the full thinking trace.

## Safety / privacy rule

This debug section should render only the persisted thinking artifact already written for debugging. It should not expose system prompts, charters, or additional hidden context beyond that stored trace.

## Fallback behavior

If no persisted thinking artifact exists, the UI should still support legacy inline `<think>`, `<thinking>`, and `<reasoning>` blocks so older artifacts remain debuggable.

## Inbox merge note

- Discover visible artifact families dynamically from the repository so panel and publisher artifacts remain discoverable.
- If no `.thinking.md` exists, render a compact debug metadata block instead of leaving the section empty.

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
