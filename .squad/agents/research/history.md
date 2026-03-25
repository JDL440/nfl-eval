# History — Research

## Project Context

- **Project:** NFL Lab (nfl-eval) — AI-powered NFL analytics and content platform
- **Stack:** TypeScript, Node.js, Hono, HTMX, SQLite
- **Owner:** Joe Robinson
- **Repo:** JDL440/nfl-eval
- **Key paths:** `docs/`, `VISION.md`, `README.md`, `src/config/`

## Core Context

- **Issue #85**: structured domain knowledge is intentionally scoped to static assets (glossaries + team sheets) and docs/testing; runtime loading and refresh automation were deferred.
- **Issue #102**: dashboard auth should start as a lightweight local login control with Hono middleware, secure cookies, and SQLite sessions; OAuth/SSO is deferred.
- **Issue #116/#117/#118**: retrospective follow-up should start as a manual, read-only digest grouped by role + finding_type with normalized-text dedupe.
- Publish-related research established that the dashboard publish flow is split across startup wiring, publish routes, and the Substack service boundary.
- The repository uses seeded defaults under `src/config/defaults/`; team-key normalization is important when mapping article or dashboard values to team sheets.

## Recent Learnings

- 2026-03-28 — V3 workflow simplification research complete. Delivered guidance on writer-support.md implementation, single claim authority, lightweight Editor gate, and Lead-escalation policy. Orchestration log: .squad/orchestration-log/2026-03-28T06-46-06Z-research.md.
- 2026-03-24 — Issue #85 implementation layout: keep the structured knowledge assets aligned with `src/config/defaults/` patterns and normalize team keys through a shared mapper.
- 2026-03-23 — Issue #102 research confirmed the dashboard has no auth/session seam yet in `server.ts`, `repository.ts`, or `schema.sql`.
- 2026-03-24 — Issue #116 digest heuristics: role + finding_type grouping, normalized-text dedupe, and bounded outputs were defined for Code.

## Learnings

- 2026-03-27 — Writer/Editor churn root-cause analysis complete. Eight major sources identified: (1) heavyweight writer-preflight gates running post-draft causing self-repair loops; (2) reverse-flow editor-review artifact injection on revisions; (3–4) 4x claim validation redundancy (panel fact-check + writer fact-check + writer-preflight + editor), split between agent and deterministic passes; (5) implicit writer self-validation without explicit checklist; (6) asymmetric editor feedback (fixed verdict structure, unstructured revision prose); (7) no writer-specific support artifact (writer-support.md designed but not implemented); (8) revision blocker metadata scattered between conversation tables and inline text parsing. Key simplification levers: implement writer-support.md (already designed in decisions.md), make writer-factcheck the sole claim authority, reduce editor scope to lightweight structural/tone gate, delete redundant panel-factcheck pass, use structured blocker JSON instead of prose parsing. Detailed analysis written to .squad/decisions/inbox/research-writer-editor-churn.md with full file/line citations.
- 2026-03-27 — Issue `#124` is now actionable without reopening `#120`/`#123`: `src/pipeline/conversation.ts` already fingerprints repeated structured blockers, `src/pipeline/actions.ts` already pauses Stage 6 in `needs_lead_review` with `lead-review.md`, and `src/dashboard/views/article.ts` plus `src/dashboard/server.ts` already expose that Lead-review seam.
- 2026-03-27 — The narrowest safe `#124` implementation is to layer a Lead-approved fallback/article-mode signal on top of the existing Stage 6 hold, then branch `writeDraft()` into a dedicated reframe prompt and show durable mode disclosure in operator/publish surfaces; do not reopen blocker detection or escalation mechanics.
- 2026-03-25 — Issue `#125` design: Writer should get bounded Stage 5 verification access via a source ladder (local/runtime artifacts → official primary sources → trusted references), a small external-check budget, and a durable `writer-factcheck.md` artifact; avoid giving Writer raw web-search autonomy.
- 2026-03-25 — Existing seams already support `#125` without new architecture: `src/pipeline/actions.ts` injects `panel-factcheck.md`, `roster-context.md`, and `fact-check-context.md`, while `recordAgentUsage()` plus `src/types.ts` usage/stage types can capture verification telemetry.
- 2026-03-25 — Issue `#115` already has a strong v1 structured surface: `src/db/schema.sql` persists `article_retrospectives` + `article_retrospective_findings`, `src/db/repository.ts` exposes `listRetrospectiveDigestFindings(limit)`, `src/cli.ts` ships `retrospective-digest` / `retro-digest`, and `src/types.ts` defines the bounded digest report/candidate/category contracts.
- 2026-03-25 — Retrospective findings are synthesized from revision-loop state, not markdown scraping: `src/pipeline/actions.ts` builds writer/editor/lead findings from `revision_summaries`, revision issue history, and force-approval detection, then stores both a markdown artifact and normalized DB rows.
- 2026-03-25 — The current digest shape is intentionally bounded and manual-review-first: `src/cli.ts` dedupes by normalized finding text within `role + finding_type`, limits promoted candidates to 5 process-improvement items and 5 learning updates, and caps category examples at 3.
- 2026-03-25 — Tests already codify the intended operator loop for `#115`: `tests/db/repository.test.ts` covers joined digest rows and retrospective upserts, `tests/cli.test.ts` covers markdown/JSON digest output plus promotion reasons, and `tests/pipeline/actions.test.ts` covers post-revision retrospective generation/idempotence.
- 2026-03-25 — Slug-history investigation: the exact slug `the-packers-next-big-move-might-be-trading-a-young-receiver` was not found in repo files, hidden state, worktrees, or `.copilot`; the closest live Packers artifact set is `content/articles/gb-2026-offseason/`.
- 2026-03-25 — For article history, first-draft and thinking traces persist as filesystem artifacts (`content/articles/{slug}/*.md` plus optional `*.thinking.md`), while edit/revision loop context is designed to persist in SQLite tables `article_conversations` and `revision_summaries` (`src/db/schema.sql`, `src/pipeline/conversation.ts`).
- 2026-03-25 — The local runtime scratch database at `.test-debug-retro/pipeline.db` currently has no schema or rows (4096-byte empty SQLite file), so it cannot recover draft/edit history for Packers investigations.
- 2026-03-25 — Runtime article state can live outside the repo under `~/.nfl-lab/`; by default `src/config/index.ts` resolves `pipeline.db`, article/image directories, and logs there rather than under `content/`.
- 2026-03-25 — For slug `the-packers-next-big-move-might-be-trading-a-young-receiver`, the real local history is in `C:\Users\jdl44\.nfl-lab\pipeline.db`: `artifacts` keeps the latest named files, while `article_conversations`, `revision_summaries`, `stage_transitions`, and `audit-*.jsonl` preserve revision-loop chronology.
- 2026-03-25 — `src\db\artifact-store.ts` upserts by `(article_id, name)`, so repeated `draft.md` or `editor-review.md` writes overwrite the current artifact; earlier draft/edit iterations survive only via conversation/history tables, not separate per-revision artifact rows unless a distinct filename is used.

### 2026-03-23T15-13-57Z: Lead board cleanup follow-up
- `#115` is now unblocked and assigned `go:yes` + `squad:research`, with `#117/#118` already landed.
- Next research work should continue mining retrospectives into learning updates and process-improvement candidates.

### 2026-03-25T21-30Z: Issue #119 duplication audit for research-driven issues
- Issue #119 **fully covers artifact-level model provenance + UX badge**, spanning schema design, pipeline threading, artifact finalization, backfill strategy, and UI presentation.
- Comprehensive searches across 8 open issues found **zero overlapping duplicates** for:
  - Writer research/fact-checking routing
  - Editor blockers/unresolved issues
  - Evidence-deficit routing
  - Claim mode/fallback handling
  - Model routing/stage metadata beyond #119
- All requested research-driven issues are **safe to create** with no duplication risk.
- Recommended new issues include: Writer fact-check integration, Editor unresolved-issue gate, evidence-deficit routing, claim mode/fallback defaults, and stage metadata population.

### 2026-03-25T17:58:41Z: Scribe consolidation of duplicate audit (Inbox merge)
- Duplication audit decision merged into .squad/decisions.md from inbox.
- Confirmed zero duplicates across 8 open issues for all 5 research-driven topic areas.
- Coordination points documented: #119 artifact provenance ↔ stage routing rules, Writer research ↔ claim mode, Editor gate ↔ evidence-deficit routing.
- Orchestration log written to .squad/orchestration-log/2026-03-25T17-58-41Z-research.md.

### 2026-03-23T18:18:11Z: Issue #115 structured surface validation (Research proposal)
- Validated Issue #115 already has strong v1 surfaces: manual CLI (`retrospective-digest`), structured DB layer (`article_retrospectives` + `article_retrospective_findings`), bounded digest output with promotion rules.
- Confirmed operator workflow: manual on-demand trigger, two promoted candidate sections (process improvements + learning updates), grouped evidence section, manual approval into issues/decisions.
- Recommended bounded output shape with deduping, limits, and promotion reasons.
- Proposed limiting scope to docs and refinements, not new stages or automation.
- Decision merged to decisions.md. Orchestration log written.
- 2026-03-24T02-58-58Z — Issue #124 routing remains blocked behind #120 structured blocker tracking and #123 repeated-blocker escalation; once unblocked, Research should define the fallback/claim-mode entry criteria, Lead handoff, Writer reframe contract, and disclosure requirements.
- 2026-03-26 — Issue `#124` is now actionable without reopening `#120/#123`: the repo already has structured blocker metadata plus repeated-blocker escalation into Stage 6 `needs_lead_review` with `lead-review.md`.
- 2026-03-26 — The narrowest safe seam for `#124` is a Lead-approved post-escalation fallback policy for repeated evidence blockers: reuse the existing Stage 6 hold, add the smallest durable article-mode signal, rerun Writer with a dedicated reframe contract, and expose explicit disclosure in operator/reader views.
- 2026-03-26 — Issue `#124` handoff to Code ready: implementation as bounded policy/runtime slice reuses Stage 6 needs_lead_review seam, requires explicit Lead approval, includes dedicated Writer reframe contract, keeps non-evidence blockers on original revision path, and surfaces disclosure in reader/operator views. Acceptance criteria locked in decisions.md.

## 2026-03-25T07:15:45Z — Draft-First Revision Wording & Smallest Test Surface Guidance

**Orchestration log:** .squad/orchestration-log/2026-03-25T07-15-45Z-research.md  
**Session log:** .squad/log/2026-03-25T07-15-45Z-v3-revision-ux-plan.md

**Status:** ✓ Completed — Memo guidance extracted and delivered

**Deliverables:**
- Draft-first revision wording recommendations
- Smallest test surface recommendations for implementation phase

**Distribution:** Shared with UX and Code teams for V3 implementation.

