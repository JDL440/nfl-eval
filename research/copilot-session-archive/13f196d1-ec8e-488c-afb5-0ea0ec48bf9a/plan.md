Current focused plan: unify the local MCP server and improve tool discoverability for model clients

Problem:
- The repo currently exposes two different local MCP surfaces: `mcp/server.mjs` for local-tool aggregation and `src/cli.ts mcp` → `src/mcp/server.ts` for pipeline tools only.
- That split makes it harder for model clients to reliably know what tools exist, because the available tool set depends on which entrypoint they hit.
- The user wants implementation now, with special emphasis on making the tool surface obvious and easy for models to understand.

Approach:
- Converge on one canonical local MCP entrypoint while preserving compatibility for existing local config where practical.
- Improve model-facing tool contracts so the server clearly communicates what each tool is for and how to call it.
- Validate the rollout with build/test plus targeted MCP smoke coverage.

Execution lanes:
1. MCP infrastructure / entrypoint lane
   - Make one canonical local MCP server path for CLI + client config.
   - Keep a compatibility shim if needed for existing `mcp/server.mjs` users.
   - Update directly related scripts/config/docs.

2. MCP tool-contract lane
   - Sharpen tool descriptions and schemas.
   - Add a discoverability/help/catalog surface if it improves model understanding without breaking compatibility.
   - Keep current tool names unless a compatibility-safe improvement is clearly better.

3. Validation lane
   - Run `npm run v2:build`.
   - Run targeted MCP/local tool tests or smoke checks.
   - Confirm the canonical entrypoint and discoverability improvements work together.

Success criteria:
- Local MCP clients and CLI resolve to the same canonical server implementation.
- Model-facing tool descriptions are clearer and more self-explanatory than before.
- The rollout is validated with existing build/test commands and any targeted MCP smoke coverage already present in the repo.

---

Issue #102 follow-on: create a `V3` branch/worktree and aggressively simplify the article pipeline plus dashboard UX stage by stage.

Approach:
- Use the clean `C:\github\nfl-eval\worktrees\V3` worktree as the implementation target so the shared `main` tree is not disturbed.
- Simplify the pipeline in stage-sized slices, but batch implementation where file ownership overlaps to avoid thrashing.
- Keep the strongest deterministic gates, remove duplicated prompt/instruction sources, and make the dashboard more mobile-first for the core create / continue / publish flows.
- Validate with focused tests while changes land, then run the repo build and broader targeted tests before handoff.

Todos:
- Stage 1: unify idea creation and reduce idea-generation prompt/UI complexity.
- Stage 2: reduce duplicate discussion-prompt instructions.
- Stage 3: simplify panel composition toward deterministic defaults.
- Stage 4: constrain discussion orchestration / default panel size.
- Stage 5: trim Writer context and keep only high-value deterministic checks.
- Stage 6: collapse Editor instruction duplication while preserving approval gate.
- Stage 7: simplify publisher pass and separate required publish checks from optional promotion work.
- Stage 8 / Dashboard: make create, continue, and ready-to-publish flows mobile-friendlier while preserving advanced detail pages.
- Validation: run tests/build, fix integration issues, and summarize the resulting V3 branch state.

Notes:
- `V3` branch and `worktrees\V3` already exist off commit `1d1d7fd`.
- SQL todos are the operational source of truth for execution and status.
- Likely shared-touch files: `src\pipeline\actions.ts`, `src\pipeline\context-config.ts`, `src\dashboard\server.ts`, `src\dashboard\views\*.ts`, `src\config\defaults\skills\*.md`, `src\config\defaults\charters\**\*.md`, and related tests.

---

Current focused plan: reduce article stalls before publish without rearchitecting the pipeline

Problem:
- Articles are getting stuck mainly in the Stage 4→5 writer handoff because deterministic draft validation is failing on brittle evidence parsing and unsupported exact-claim checks.
- The Ravens / Isaiah Likely case showed two separate issues:
  - parser noise in writer-preflight / claim extraction created bogus blockers from markdown-formatted prose
  - the writer still lacks a simple structured source of truth for exact names and exact figures, so it has to infer too much from discussion prose
- Roster-truth checks are also not cleanly surfaced early enough, and one local 2026 roster query path is broken.

Proposed approach:
- Keep the current 8-stage process and deterministic gates.
- Fix the proven parser / preflight bugs first.
- Add one small structured support layer for Writer and preflight rather than inventing a new stage.
- Improve freshness / roster signaling just enough to prevent avoidable confusion.

Implementation slices:
1. Ship the validated writer-preflight / claim-extractor hardening.
   - Merge the clean worktree fix from `worktrees\writer-contract-precision-fix`.
   - Scope: markdown cleanup, sanitized claim snippets, sentence-opener name filtering, focused regressions.
   - Goal: remove bogus blockers like `If Flowers`, `Mention Zay Flowers`, and malformed ``$11M`` snippets.

2. Add a minimal structured writer support artifact.
   - Generate one compact artifact during `writeDraft()` from existing inputs, not a new stage.
   - Suggested shape:
     - canonical player names seen in roster / panel / fact-check artifacts
     - exact numeric claims that are supported
     - exact numeric claims that must be softened / omitted
     - optional `as_of` metadata for roster / fact-check context
   - Feed that artifact into both the writer context and `writer-preflight`.

3. Separate exact supported facts from analytical ranges.
   - Keep contract / cap “working lanes” out of the same support bucket as verified exact facts.
   - Reuse the existing `writer-factcheck.md` sections (`Verified`, `Attributed`, `Unverified/Omitted`) rather than inventing a second verification system.
   - Minimal change: make `writeDraft()` and writer-preflight consume those sections more deterministically.

4. Strengthen early roster / freshness context without moving the check to a new stage.
   - Add clearer `as_of` / freshness markers to `roster-context.md`.
   - Make writer instructions explicitly soften team-assignment prose when roster freshness is uncertain.
   - Preserve the existing editor rule: different-team is an error, missing-from-roster is caution if the feed may lag.

5. Fix the local roster query bug and related observability gaps.
   - Repair the 2026 roster query path used by local tooling so research/debugging is trustworthy.
   - Keep this scoped to the local data helper / query script, not a larger data-pipeline redesign.

6. Tighten validation and release criteria.
   - Add a live-style regression suite for known failure families:
     - markdown/code-span contract figures
     - sentence-opener pseudo-names
     - analytical contract ranges vs verified exact facts
     - stale / ambiguous roster context handling
   - Validate with focused pipeline tests, then `npm run v2:build`, then one or two runtime-style article reproductions.

Execution order:
- First: merge the validated writer-preflight / claim-extractor fix.
- Second: add the minimal structured writer-support artifact in `writeDraft()`.
- Third: wire that artifact into preflight and writer instructions.
- Fourth: fix the roster query helper and add freshness metadata.
- Fifth: run focused runtime reproductions on known stuck articles and only then consider any prompt copy cleanup.

Out of scope unless the above fails:
- adding a new pipeline stage
- replacing writer / editor / publisher roles
- building a new external research subsystem
- redesigning the dashboard as part of this stall-reduction work

Success criteria:
- Known live-style stalled articles no longer fail on parser noise.
- Stage 4→5 failures only happen for real unsupported exact claims.
- Writers get enough structured support to soften / attribute risky claims instead of inventing precision.
- Roster uncertainty is explicit and does not masquerade as a writer-preflight parser failure.

Recent observed follow-up:
- The active checkout can still raise sentence-opener false positives such as `Because San Francisco` because the current `src\pipeline\writer-preflight.ts` / `writer-support.ts` banned-token lists are narrower than the validated `worktrees\writer-contract-precision-fix` variant.
- When implementation resumes, treat this as a targeted writer-preflight hardening follow-up: prefer the broader opener filter set and add a focused regression for `Because <team/player>` phrasing.

Research update:
- Writer/editor churn research is complete and saved to `C:\Users\jdl44\.copilot\session-state\13f196d1-ec8e-488c-afb5-0ea0ec48bf9a\research\there-continues-to-be-too-much-churn-between-the-e.md`.
- Main recommendation: keep the V3 shape, but move more specificity and evidence framing into Writer, shrink Editor to obvious accuracy/blocker checks, and delete the current revision-cap / force-approve machinery instead of preserving it.
