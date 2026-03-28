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

- 2026-03-28 — **MCP Rollout Decision Merged:** Three independent audits (DevOps-MCP-Audit, Research-MCP-Docs, Code-Provider-Rollout) converged on unified local MCP entrypoint strategy. Decision merged to decisions.md: canonical operator path is `mcp/server.mjs`, source-of-truth seam is `src/mcp/server.ts` + helpers. Implementation scope: Code refactors bootstrap helpers + multi-provider wiring, DevOps converges scripts/configs/docs, Research expands tool inventory docs (`.github/extensions/README.md` to include complete local tool inventory table with purpose/required-args/examples; `mcp/smoke-test.mjs` to validate prediction-market/roster/publishing tools; dedicated canonical-local MCP tests for tool registration/schema parity). Validation: `npm run v2:build`, `npx vitest run tests/mcp/server.test.ts tests/cli.test.ts`, `npm run mcp:smoke`.
- 2026-03-28 — V3 workflow simplification research complete. Delivered guidance on writer-support.md implementation, single claim authority, lightweight Editor gate, and Lead-escalation policy. Orchestration log: .squad/orchestration-log/2026-03-28T06-46-06Z-research.md.
- 2026-03-24 — Issue #85 implementation layout: keep the structured knowledge assets aligned with `src/config/defaults/` patterns and normalize team keys through a shared mapper.
- 2026-03-23 — Issue #102 research confirmed the dashboard has no auth/session seam yet in `server.ts`, `repository.ts`, or `schema.sql`.
- 2026-03-24 — Issue #116 digest heuristics: role + finding_type grouping, normalized-text dedupe, and bounded outputs were defined for Code.

## Learnings

- 2026-03-28 — Panel construction audit: beat-level article composition is still policy-by-prompt, not typed config. Core seams are `src/pipeline/actions.ts:843-1033` (`composePanel` + `runDiscussion`), `src/config/defaults/skills/panel-composition.md:15-43`, `src/config/defaults/skills/article-discussion.md:98-127`, `src/pipeline/context-config.ts:26-43`, and pinned-agent persistence in `src/db/schema.sql:188-199` / `src/db/repository.ts:1631-1656`. Current constraints are depth-based list sizes (2 / 3-4 / 4-5), required team-agent + specialist inclusion, dashboard-only specialist pinning, and a depth-4/Feature mismatch where UI accepts level 4 but composition prompts collapse it into the 4-5 agent deep-dive branch.
- 2026-03-28 — Unified local MCP rollout audit: the canonical repo-local MCP surface is `mcp/server.mjs`, but model/operator discoverability is still split across sparse README copy and code. `README.md` correctly points operators to `npm run mcp:server` / `npm run v2:mcp` and distinguishes the older pipeline-only MCP surface, while `.github/extensions/README.md` only documents a subset of local tools and omits the nflverse, prediction-market, and `publish_tweet` surfaces; tests currently cover legacy pipeline MCP (`tests/mcp/server.test.ts`, `tests/e2e/pipeline.test.ts`) plus CLI launch wiring (`tests/cli.test.ts`), but not the canonical local server’s full tool inventory, schema parity, or smoke coverage for `query_prediction_markets` / `query_rosters`.
- 2026-03-28 — Read-only MCP clarity audit: current model-facing discoverability is strongest in code (`mcp/server.mjs`, `.github/extensions/nflverse-query/tool.mjs`, `.github/extensions/prediction-market-query/tool.mjs`) and weakest in operator docs. `README.md` names the canonical local entrypoint and commands, but does not enumerate local tools or examples; `.github/extensions/README.md` still documents only a subset of tools; `mcp/smoke-test.mjs` and `tests/services/data.test.ts` provide partial confidence for registration/argument plumbing, while no dedicated test currently asserts the full `mcp/server.mjs` local tool inventory, schema descriptions/examples, or prediction-market/roster discoverability end-to-end.
- 2026-03-27 — Seahawks second-pass stall review: the remaining acceptance risk splits into two classes. Live runtime stall evidence for slug `did-the-seahawks-pay-jaxon-smith-njigba-at-exactly-the-right` is still a Stage 6 evidence-deficit + stale-runtime-contract loop (`C:\Users\jdl44\.nfl-lab\agents\charters\nfl\editor.md`, `...\skills\editor-review.md`, `worktrees\V3\src\config\index.ts`, `worktrees\V3\src\agents\runner.ts`), while the source-side guardrail review in `.squad/decisions.md:5046-5144` correctly identifies the next cut as preventing post-approval advisory churn. Preserve `worktrees\V3\src\pipeline\engine.ts` minimal Stage 5 shell, `worktrees\V3\src\pipeline\writer-preflight.ts` placeholder-only hard blocker, `worktrees\V3\src\pipeline\actions.ts` revise-in-place + Stage 6→4 regression + blocker normalization, and reject any loosening that lets approved drafts reopen or TODO scaffolding leak into publish-visible artifacts.
- 2026-03-25 — Seahawks JSN article stall in `worktrees\V3` was an evidence-deficit Stage 6 loop, not a surviving Stage 5 shell gate: runtime state in `C:\Users\jdl44\.nfl-lab\pipeline.db` shows slug `did-the-seahawks-pay-jaxon-smith-njigba-at-exactly-the-right` parked at Stage 6 / `needs_lead_review` after three editor `REVISE` outcomes, while `writer-factcheck.md` recorded zero verified claims and no external checks, `writer-support.md` was absent from both code and runtime artifacts, and editor blocker metadata stayed null so repeated-blocker escalation could not classify the loop.
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

## 2026-03-27T07:30:00Z — V3 Workflow Simplification Pass (Research Guidance)

**Orchestration log:** .squad/orchestration-log/2026-03-27T07-30-00Z-research.md  
**Session log:** .squad/log/2026-03-27T07-30-00Z-v3-workflow-simplify.md

**Status:** ✓ Completed — Churn analysis delivered; six-lever simplification roadmap finalized

**Deliverables:**
- **Churn Root Cause Analysis:** Eight friction sources mapped; structural overlap identified (not prompt quality)
- **Simplification Roadmap:** Six levers with rollback triggers and protected behaviors
- **Blocker Taxonomy Guidance:** Editor accuracy-only (wrong-name, unsupported-stat, stale-claim, fabricated-quote); no structure blockers
- **Name Consistency Strategy:** BANNED_FIRST_TOKENS (finite, deterministic) as interim guard; writer-support.md as target

**Key Learnings:**
- Structural contracts beat prompt rhetoric in addressing churn
- Blocker taxonomy must remain strict (accuracy-only, no structure blockers)
- Finite BANNED_FIRST_TOKENS list preferred over fuzzy NAME_PATTERN matching
- Escalation infrastructure reused; force-approve removed; revision cap enforced at 2→escalate on 3rd

**Distribution:** Guidance shared with Lead (approval), Code (implementation), UX (UX alignment).

---

## 2026-03-25T07:15:45Z — Draft-First Revision Wording & Smallest Test Surface Guidance

**Orchestration log:** .squad/orchestration-log/2026-03-25T07-15-45Z-research.md  
**Session log:** .squad/log/2026-03-25T07-15-45Z-v3-revision-ux-plan.md

**Status:** ✓ Completed — Memo guidance extracted and delivered

**Deliverables:**
- Draft-first revision wording recommendations
- Smallest test surface recommendations for implementation phase

**Distribution:** Shared with UX and Code teams for V3 implementation.


## 2026-03-28T06-46-06Z — Second-Pass Confirmation: Seahawks JSN Stall Diagnosis

**Orchestration log:** .squad/orchestration-log/2026-03-28T06-46-06Z-research.md  
**Session log:** .squad/log/2026-03-28T06-46-06Z-second-pass-workflow-fix.md

**Status:** ✓ Completed — Issue class confirmed; runtime seam validated

**Diagnosis Confirmation:**
- Seahawks JSN stall is evidence-deficit/editorial churn at Stage 6, NOT Stage 5 failure
- Runtime state: C:\Users\jdl44\.nfl-lab\pipeline.db shows Stage 6 / needs_lead_review
- Artifact chain: pass 1 = blockers+suggestions; pass 2 = APPROVED; pass 3 = yellow cleanup only
- Supporting evidence: writer-factcheck.md zero verified claims, writer-support.md absent, blocker metadata null

**Validation:**
- Stage 5 in code is already narrow (requireDraft, writer-preflight blocks only hard guards)
- Remaining issue is post-approval advisory churn, not shell gate failure
- Runtime seam in actions.ts is appropriate for blockerless REVISE → blocker-only retry → APPROVED
- Preserves Stage 5 hard guards, placeholder detection, escalation machinery

**Guardrails Confirmed:**
- Minimal Stage 5 shell stays hard (headline, subtitle, TLDR, empty draft)
- Placeholder leakage stays hard (TODO/TBD/TK must not pass)
- Approval is terminal (only true REVISE/REJECT reopens)
- Escalation intact (repeated blocker fingerprinting, needs_lead_review hold)
- Does not weaken deterministic guards or reintroduce force-approve

**Next:**
- Code implements runtime seam in actions.ts
- Monitor first 20 articles post-fix for advisory approval downgrade
- Validate no Stage 5 regression or placeholder leakage


## 2026-03-28T08-11-46Z — Seahawks JSN Stall Confirmation: Runtime Contract Drift as Architecture Risk

**Orchestration log:** .squad/orchestration-log/2026-03-25T08-11-46Z-research.md

**Status:** ✓ Completed — Decision merged into decisions.md; runtime seam validated

**Confirmation:**
- Seahawks JSN stall confirmed as Stage 6 evidence-deficit + runtime contract drift, not Stage 5 regression
- Live runtime charters (C:\Users\jdl44\.nfl-lab\agents\...) dated 2026-03-20 (5+ days stale)
- Source defaults in worktrees\V3\src\config\defaults\... aligned with code contracts
- Stage 6 hold functional; blocker metadata properly structured

**Key Insight:**
Runtime contract drift is a first-class workflow architecture risk. When workflow relies on seeded charters/skills in persistent data dir, both source defaults and live runtime copies must stay in sync. Stale runtime can mask code-side fixes.

**Acceptance Guardrails Documented:**
- Minimal Stage 5 shell (headline, subtitle, TLDR, empty-draft guard) stays hard
- Placeholder leakage (TODO/TBD/TK) stays hard
- Stage 6 REVISE → Stage 4 regression preserved
- Blocker metadata structured; no silent losses
- Advisory churn must not reopen approved articles

**Next Steps:**
1. Code resync runtime charters/skills from source defaults
2. Code validate no Stage 5 regression post-fix
3. Monitor first 20 articles post-fix for advisory-only approval rates
4. Enforce all acceptance blockers in decisions.md for any follow-up simplification passes

- 2026-03-28 — MCP infrastructure audit: the repo currently has two local MCP surfaces with drift risk. `src/cli.ts` → `src/mcp/server.ts` starts the v2 pipeline MCP server, while `.copilot/mcp-config.json`, `.mcp.json`, `package.json` (`mcp:server`, `mcp:smoke`), and `.github/extensions/README.md` all point to `mcp/server.mjs` for extension/local tools; `README.md` still presents `npm run v2:mcp` as the main path while calling `mcp/` legacy. For unified rollout, keep one operator-facing entrypoint, keep compatibility shims for the other path, and update smoke/docs/config together. Baseline: `npm run v2:build` passed on 2026-03-28.

