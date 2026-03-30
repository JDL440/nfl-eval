# Engineering system plan — Squad / Ralph / team workflow

## Objective

Apply the same Anthropic harness principles to the engineering system so Squad work becomes explicitly planner -> generator -> evaluator, with contract-first issue execution, better Ralph gating, and retrospectives that continuously remove workflow steps that no longer add value.

## Scope

### In scope

- Issue-contract workflow before implementation starts
- Clear planner / generator / evaluator role boundaries for Squad
- Ralph and heartbeat changes that enforce handoff discipline and reviewer gating
- Ceremony and documentation updates that make the workflow durable
- Validation loops for whether process steps are still load-bearing

### Out of scope

- Changes to the article production pipeline itself
- General GitHub project-board redesign
- Replacing Ralph with a different orchestrator
- New external services for work tracking

## Phases and dependencies

### Phase 1 — Contract-first issue kickoff
**Depends on:** none

Require Lead to create a bounded issue contract before handoff to Code / UX / Data / DevOps.

Deliverables:
- standard contract fields:
  - scope for this round
  - acceptance criteria
  - out of scope
  - verification method
  - evaluator / reviewer owner
- contract can live in issue comments first; a file artifact can come later if needed

### Phase 2 — Explicit planner / generator / evaluator workflow
**Depends on:** Phase 1

Make the role split explicit:
- Lead plans / scopes
- domain agent implements
- reviewer gate (Lead and/or review agent) evaluates completion

Deliverables:
- handoff rules documented in charters and Squad coordinator instructions
- rejected work cannot bounce directly back without a new scoped handoff

### Phase 3 — Ralph enforcement and workflow automation
**Depends on:** Phases 1-2

Teach Ralph and the heartbeat automation to look for missing contracts, missing evaluator assignment, and stale review states instead of only labels/assignees.

Deliverables:
- Ralph prompt and heartbeat checks for contract presence
- better state transitions for blocked / pending user / for review
- explicit escalation path when issues lack a planner verdict

### Phase 4 — Retrospective-driven pruning
**Depends on:** Phases 1-3 operating long enough to produce evidence

Use retrospectives and process audits to remove review or ceremony steps that no longer catch meaningful defects.

Deliverables:
- recurring review of which handoffs, comments, or review loops still catch real problems
- lightweight path for tiny, low-risk issues if the full harness is overkill

## Exact repo insertion points

### Lead planning / contract rules
- `.squad\agents\lead\charter.md`
  - add explicit requirement that Lead produces an issue contract before implementation handoff on non-trivial work
  - define minimum contract contents and evaluator ownership

### Ralph monitoring rules
- `.squad\agents\ralph\charter.md`
  - extend responsibilities from queue scanning to contract presence, reviewer assignment, and stale evaluator loops
  - clarify when Ralph escalates to Lead versus directly routing work

### Team ceremonies
- `.squad\ceremonies.md`
  - strengthen `Pre-Flight Check` into the official trigger for multi-domain contract alignment
  - add a lightweight engineering-retro expectation tied to process pruning
  - optionally define when design review is required before a contract is considered complete

### Project board operating skill
- `.squad\skills\github-project-board\SKILL.md`
  - extend rules so "In Progress" requires a contract-ready issue, not just a label change
  - document when evaluator-ready work moves to `For Review`
  - add expectations for `Blocked` / `Pending User` comments when the contract is incomplete

### Squad coordinator behavior
- `.github\agents\squad.agent.md`
  - `Coordinator Identity` / `Team Mode`
  - add contract-first spawn behavior:
    - before spawning a domain agent, ensure Lead planning exists for ambiguous or non-trivial work
    - require evaluator identification before work starts
  - reinforce that the coordinator owns assembled artifacts and reviewer gating, not direct domain work

### Local Ralph runner
- `ralph-watch.ps1`
  - update the embedded `$prompt`
    - require contract checks before spawn
    - require reviewer/evaluator designation
    - escalate contractless issues to Lead instead of starting implementation immediately
  - optional future seam: log counts of issues missing contracts or stuck in review

### GitHub heartbeat automation
- `.github\workflows\squad-heartbeat.yml`
  - in the `Ralph — Check for squad work` script:
    - detect issues missing planner verdict / contract markers
    - distinguish "triaged" from "ready for implementation"
    - comment/escalate when a `squad:{member}` issue lacks contract criteria or reviewer ownership
  - existing auto-triage and PR monitoring are the natural places to add this logic

## Risks

- **Process drag:** contracts can become overhead if required for tiny fixes.
- **Ambiguous source of truth:** if the contract lives partly in charters and partly in comments, enforcement can get fuzzy.
- **Ralph overreach:** automation may spam or churn labels/comments if checks are too rigid.
- **Reviewer bottleneck:** explicit evaluator gating can increase queue time if reviewer capacity is not planned.
- **Documentation drift:** if coordinator instructions, charters, and skills diverge, agents will behave inconsistently.

## Validation strategy

### Contract-first validation
- Spot-check several real squad issues:
  - can an outside reader tell scope, acceptance criteria, and evaluator from the kickoff artifact?
- Confirm ambiguous issues now route through Lead before domain implementation starts

### Workflow validation
- For a sample of implementation issues, verify the path is visible:
  - planner named
  - implementer named
  - evaluator named
  - board state changed appropriately

### Ralph / automation validation
- Dry-run heartbeat logic against representative issue states
- Ensure missing-contract issues are escalated, not silently started
- Ensure ready issues still move without extra manual work

### Pruning validation
- Use retrospectives or issue-review evidence to ask:
  - which steps caught real defects?
  - which comments were ceremonial only?
  - which issue classes can skip the heavier path?

## Recommended first slice

Implement a **documentation-and-prompt slice before any workflow code**:

1. update `.squad\agents\lead\charter.md` with the issue-contract requirement
2. update `.github\agents\squad.agent.md` so Squad will not start non-trivial implementation without a contract/evaluator
3. update `ralph-watch.ps1` prompt so Ralph escalates contractless issues to Lead instead of spawning implementers immediately

Why this first:
- it changes behavior quickly without needing GitHub API redesign
- it aligns Lead, Squad, and Ralph before adding automation checks
- it gives the team a single contract language to test on real issues
