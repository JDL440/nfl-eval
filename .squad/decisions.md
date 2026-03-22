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

# Decision: Issue #92 charter isolation should move to a hybrid context model

**Issue:** #92 — Research: Validate charter isolation in shared article conversation context
**Status:** PROPOSED
**Submitted by:** Lead (🏗️)
**Date:** 2026-03-22

---

## TLDR

Keep the current per-agent fresh system-prompt model, but stop treating the full shared per-article transcript as the default cross-agent context surface. The safest next implementation step is a **hybrid** design: agent-local detailed history plus a compact shared revision summary / handoff log.

## Recommendation

Adopt a hybrid context contract for article revision loops:

- **Keep:** fresh per-agent system prompt composition in `src/agents/runner.ts`
- **Keep:** article-level revision continuity as a product goal
- **Change:** cross-agent visibility from raw transcript sharing to structured handoff summaries by default
- **Limit:** full prior-review exposure to the agent that actually needs it

## Why

### 1. Formal charter isolation is currently intact

The implementation does **not** run Writer, Editor, and Publisher inside one provider-native chat thread. Each run rebuilds a fresh agent-specific system prompt from charter, skills, memory, and optional roster context, then prepends conversation history as markdown inside the user message.

That means charter/system precedence still exists structurally.

### 2. Practical role bleed is still a real risk

Even with correct formal precedence, prior agent outputs are injected at high salience ahead of the active task. In realistic revision loops, that creates three avoidable risks:

1. **Writer drift:** Writer starts mirroring Editor phrasing/checklist language instead of staying in the craft/house-voice role.
2. **Editor anchoring:** Editor sees its own past reviews in both the shared history and the explicit `Your Previous Reviews` block, which increases the risk of repetitive or over-anchored review behavior.
3. **Publisher relapse:** Publisher sees more editorial journey than it needs and may begin re-running editorial judgment instead of staying in publication-readiness mode.

### 3. Full per-agent isolation is safer but too lossy

Per-agent-per-article threads would reduce bleed the most, but they also throw away valuable revision continuity unless the system immediately rebuilds that continuity through explicit handoff artifacts. That means the product would pay orchestration cost without actually escaping the need for shared summaries.

## Decision

Use a **hybrid summary model** as the target architecture for the next implementation pass:

### Shared article-level data

Every downstream agent may see a compact, structured article summary containing only:

- latest revision iteration and verdict
- key must-fix items still open
- what changed since the previous draft
- publish-readiness state
- explicit handoff notes intended for downstream roles

### Agent-local detailed history

- **Writer:** may keep Writer-local draft/revision continuity plus a distilled editor handoff
- **Editor:** may keep Editor-local review history, but should avoid duplicated self-history blocks unless proven necessary
- **Publisher:** should receive only the compact shared summary plus the current publish task/artifacts, not the full editorial transcript by default

## Proposed next step

Open a Code implementation pass that defines the minimum shared summary schema and prompt contract for Writer, Editor, and Publisher, then updates the pipeline so raw shared transcript injection becomes opt-in/debug-oriented rather than the normal runtime path.

## Label/status implication

Issue #92 can move from `go:needs-research` to **`go:yes`** once the recommendation comment is posted, because the design question is sufficiently narrowed for an implementation issue or PR.

---

# Decision — Issue #93 article usage panels must use full per-article usage history

- **By:** Lead / Code / UX
- **Date:** 2026-03-22
- **Issue:** #93

## Decision

Treat issue #93 as a repository/query hydration bug on the dashboard surfaces. `copilot-cli` usage emission, runner forwarding, and pipeline persistence already work; the failure is that article detail and live-sidebar usage panels were reading a capped history instead of the full per-article `usage_events` stream.

## Why

- `src/llm/providers/copilot-cli.ts` already emits estimated usage.
- `src/agents/runner.ts` forwards that usage into `tokensUsed`.
- `src/pipeline/actions.ts` persists `usage_events` whenever `tokensUsed` exists.
- `src/dashboard/server.ts` and `src/dashboard/views/article.ts` hydrate article usage from `repo.getUsageEvents(articleId)`.
- The default repository cap dropped older rows once later dashboard activity accumulated, so early Copilot CLI events disappeared from article views.

## Validation

- `tests/db/repository.test.ts` reproduces the cap-driven disappearance of an older usage row.
- `tests/dashboard/server.test.ts` confirms the dashboard surfaces recover the missing history once the default limit is removed.
- The repository still keeps an explicit `limit` parameter available for callers that truly need bounded history.

## Scope note

The separate artifact-thinking UI change (companion `*.thinking.md` loading in `src/dashboard/server.ts` and `src/dashboard/views/article.ts`) is not required to explain or fix the token-usage bug. These are distinct concerns.

### 2026-03-22T19:10:20Z: Issue #93 decision inbox sync

- Merged the remaining Code, Lead, and UX inbox notes into the canonical #93 record.
- Kept the issue summary aligned on the repository hydration default: article detail and live sidebar should read full per-article usage history unless a caller passes an explicit limit.
- No extra provider, runner, or persistence changes were needed for the article-page regression.
### 2026-03-22T19:13:43Z: Issue #93 regression safeguard

- Keep the regression anchored on the real persistence chain: `copilot-cli` provider → runner → `recordAgentUsage()` → repository → article/live-sidebar.
- Prefer a stage-action test that proves an older `usage_events` row survives hydration, rather than a seeded rendering-only check.
- The debug/thinking renderer path remains out of scope for the token-usage bug.