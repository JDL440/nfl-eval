# Anthropic Harness Research — Engineering System Plan

## Objective

Apply the same Anthropic harness ideas to the **Squad / Ralph / team workflow** so engineering work becomes contract-driven, easier to route, easier to review, and easier to prune when a coordination step stops adding value.

## Scope

### In scope
- Squad intake, planning, handoff, review, and retrospective workflow
- Lead / Ralph / coordinator instructions and workflow docs
- GitHub issue / board automation behavior that reflects planner -> generator -> evaluator roles
- Lightweight workflow artifacts such as issue contracts and handoff summaries

### Out of scope
- Article pipeline runtime behavior
- Writer / Editor / Publisher article prompts
- Provider routing, app dashboard behavior, or publication payload changes
- Replacing GitHub Issues / Projects as the team task system

## Phases and dependencies

### Phase 1 — Require an issue contract before execution
**Depends on:** none  
**Goal:** make multi-step engineering work start from an explicit contract instead of loose issue text alone.

**What to add**
- A compact `issue-contract` format with: objective, in-scope, out-of-scope, acceptance checks, evaluator, and follow-up triggers.
- Lead should create or confirm that contract before handing work to Code / UX / Data / DevOps on non-trivial issues.
- Ralph should not mark work truly in motion until the contract exists for work that spans multiple files or agents.

**Exact repo insertion points**
- `.squad\agents\lead\charter.md`
  - add a responsibility that Lead defines or confirms an issue contract before delegating multi-step work
- `.squad\ceremonies.md`
  - extend **Pre-Flight Check** so its output becomes the contract artifact for the round
- `.github\agents\squad.agent.md`
  - add the contract requirement to the coordinator workflow, not just to Lead's charter
- `README.md` -> Squad section (`### Talking With Your Squad`, `### Creating Tasks`)
  - document the operator-visible expectation once the behavior is stable

**Why this phase first**
- It is the engineering equivalent of Anthropic's sprint contract.
- It sharpens handoffs without needing automation changes first.

---

### Phase 2 — Make evaluator ownership explicit in Squad flow
**Depends on:** Phase 1  
**Goal:** separate planner, generator, and evaluator roles instead of assuming the implementer can self-certify.

**What to change**
- Make review ownership explicit per issue: who evaluates completion, what counts as proof, and what evidence must exist before moving to `For Review` or `Done`.
- Distinguish implementation comments from acceptance comments.

**Exact repo insertion points**
- `.github\agents\squad.agent.md`
  - in the coordinator flow and Ralph sections, spell out planner -> generator -> evaluator as a first-class loop
- `.squad\skills\github-project-board\SKILL.md`
  - update the state guidance so `For Review` implies evaluator-ready evidence, not just "agent says it's done"
- `.squad\agents\ralph\charter.md`
  - add that Ralph checks for contract + evaluator evidence before advancing state
- `.squad\routing.md`
  - if needed, add explicit review-routing guidance for artifacts that need Lead / UX / Data / DevOps review

**Suggested operating pattern**
- Planner: Lead
- Generator: Code / UX / Data / DevOps / Publisher / Research as applicable
- Evaluator: Lead, code-review, domain reviewer, or named owner in the issue contract

---

### Phase 3 — Teach Ralph and automation to enforce the new harness lightly
**Depends on:** Phases 1-2  
**Goal:** move from doc-only expectations to consistent workflow behavior.

**What to change**
- Ralph should look for contract completeness, stale handoffs, and missing evaluators.
- Heartbeat automation should flag or template missing contract/evaluator fields instead of only labels and assignees.
- Keep enforcement light at first: comment + warn before hard-blocking.

**Exact repo insertion points**
- `ralph-watch.ps1`
  - update the embedded prompt so each round expects issue-contract discipline and explicit evaluator ownership
- `.github\workflows\squad-heartbeat.yml`
  - extend the current issue scan to detect issues missing contract / acceptance / evaluator structure
  - update Ralph's auto-triage comment template to mention the expected contract shape
- `.squad\agents\ralph\charter.md`
  - document the new checks so the watchdog and the charter agree
- `.squad\team.md`
  - only if needed to document evaluator roles or special reviewer responsibilities; otherwise leave untouched

**Why not automate first**
- If the team has not agreed on the contract shape, automation will just amplify noise.

---

### Phase 4 — Add handoff artifacts and retrospective-based pruning
**Depends on:** Phases 1-3  
**Goal:** make long-running team work resumable and prevent stale coordination rituals from surviving forever.

**What to add**
- A compact handoff summary for work that changes owners, waits on review, or resumes after idle time.
- A recurring "load-bearing or ceremony?" check in retrospectives to decide which workflow steps still earn their keep.

**Exact repo insertion points**
- `.squad\ceremonies.md`
  - extend **Retrospective** so it explicitly asks which coordination steps caught real problems vs. just added latency
- `.github\agents\squad.agent.md`
  - add a handoff-summary expectation when work bounces between agents or between rounds of Ralph monitoring
- `.squad\decisions.md` and `.squad\decisions\inbox\`
  - use these as the durable destination for workflow learnings that should outlive a single issue thread
- `README.md` -> Squad section
  - only after the workflow proves stable; keep operator docs trailing the actual team behavior

## Risks

- **Ceremony creep:** issue contracts can become busywork if required for every tiny task.
- **Duplicate source-of-truth risk:** if README, charters, `squad.agent.md`, and Ralph prompts diverge, the team will follow whichever doc they hit first.
- **Noisy automation:** heartbeat comments that fire too often will get ignored.
- **Review bottlenecks:** explicit evaluator ownership can slow throughput if everything routes back to Lead.
- **Human-unfriendly issue threads:** too much template structure can make real discussion harder.

## Validation strategy

### Pilot approach
- Start with one medium-complexity implementation issue that needs planning, coding, and review.
- Run the full issue through contract -> implementation -> evaluation -> retrospective and inspect where the extra structure helped or hurt.

### Validation questions
- Did the issue contract reduce ambiguity for the implementing agent?
- Did evaluator ownership catch a real miss that would otherwise have slipped through?
- Did Ralph's checks improve board hygiene without adding spam?
- Which workflow step created real signal vs. ceremony?

### Evidence sources
- Issue comments and board transitions
- Ralph local loop behavior in `ralph-watch.ps1`
- heartbeat auto-triage output in `.github\workflows\squad-heartbeat.yml`
- retrospective learnings captured in `.squad\decisions.md` / inbox notes

## Recommended first slice

**Start with docs + prompt enforcement, not automation.**

Specifically:
1. define the issue-contract requirement in `.squad\agents\lead\charter.md` and `.github\agents\squad.agent.md`
2. update `.squad\ceremonies.md` so Pre-Flight emits that contract
3. update `ralph-watch.ps1` so Ralph asks for contract + evaluator ownership in active rounds
4. defer heartbeat automation and board hard-blocks until one or two real issues prove the shape

That first slice gives the team a shared operating model quickly, avoids over-automating an unproven ritual, and cleanly separates engineering-system work from the app/runtime plan.
