# Engineering System Implementation Plan
## Harness Design for Squad / Ralph Issue Workflow

**Objective:** Evolve the Squad AI team coordination system to enforce a planner→generator→evaluator harness with explicit issue contracts, role clarity, and retrospective-driven harness pruning.

**Owner:** Lead agent (planning and contracts), Code/other agents (generation), designated Reviewer/QA (evaluation)

---

## Scope

**In Scope:**
- Issue contract design and enforcement (before handoff to Code/Data/UX/DevOps)
- Explicit planner/generator/evaluator role documentation and workflow
- Issue handoff artifacts (scope statement, acceptance criteria, verification method)
- Code review strengthening (explicit QA criteria, threshold-based evaluation)
- Retrospective-driven harness audit (identify load-bearing vs ceremonial processes)
- Squad charter updates to codify new roles and contract requirements

**Out of Scope:**
- GitHub Actions workflow rewrite (existing .github/workflows/ stays as-is)
- Project board schema changes (existing status fields are sufficient)
- Ralph algorithm changes (work scheduling remains the same)
- Issue tracking or label system restructuring
- New tooling or integrations beyond current GitHub + Ralph stack

---

## Phased Implementation Plan

### Phase 1: Issue Contract and Role Clarity (Foundation)
**Weeks 1-2** | Dependency: None | Risk: Medium

#### 1.1 Define Issue Contract Requirements
- **Objective:** Establish a shared contract between Lead (planner) and Code (generator) before work starts.
- **Insertion point:** New document or template: `.squad/skills/issue-contract-template.md` or inline issue comment template
- **What the contract contains:**
  - **Scope this round** — what is in and out of scope for this issue
  - **Acceptance criteria** — 3-5 specific, testable things that must be true for DONE
  - **Out-of-scope items** — explicitly list what won't be addressed (to prevent scope creep)
  - **Verification method** — how will completion be validated? (tests, manual review, metrics)
  - **Who evaluates** — Lead or Code-Review agent, or specific reviewer
  - **Context for generator** — links to related issues, prior work, constraints
- **Implementation detail:**
  - Create a markdown template in `.squad/skills/issue-contract-template.md`
  - Make it a requirement in Lead's charter (see 1.2)
  - Post the contract as the first comment on every new issue, or require it in the issue body before assignment
  - Use GitHub issue templates to prompt for this structure (optional but recommended)
- **Validation:** Every new Squad issue includes a contract; contracts are unambiguous enough for both Lead and Code to agree
- **Complexity estimate:** 1 day (template design + charter update)

#### 1.2 Update Squad Agent Charters for Role Clarity
- **Objective:** Make planner/generator/evaluator roles explicit in each agent's charter.
- **Insertion point:** 
  - `.squad/agents/lead/charter.md` — emphasize planning/contracting responsibility
  - `.squad/agents/code/charter.md` — clarify that Code is the generator, not the evaluator
  - New or existing `.squad/agents/code-review/charter.md` (or Lead if no dedicated reviewer) — define evaluator role
  - `.squad/agents/data/charter.md`, `.squad/agents/ux/charter.md`, etc. — update all specialist charters similarly
- **What changes:**
  - Add a "Harness Role" section to each charter:
    - **Lead:** "Planner — Define scope, acceptance criteria, and success metrics before handing to generators"
    - **Code/Data/UX/etc.:** "Generator — Implement to contract; flag scope conflicts early; ask for clarity if contract is ambiguous"
    - **Code Review / Lead (evaluator):** "Evaluator — Grade against acceptance criteria; fail work that doesn't meet contract; give specific feedback"
  - Add a "Contract Protocol" section to Lead charter:
    - Every issue gets a contract before assignment
    - Contract must be explicit on scope, criteria, and who evaluates
    - Generators can ask for contract clarification in issue comments (not in code)
  - Add "Evaluation Criteria" to Code-Review charter:
    - Grade every PR against the issue contract, not just code style
    - Test coverage for new code
    - No scope creep (does it implement the contract, or did it drift?)
    - Architecture/style consistency
- **Validation:** Charters clearly define who does what; every agent understands their role
- **Complexity estimate:** 1 day (charter prose updates)

#### 1.3 Establish Lead-to-Generator Handoff Artifact Requirement
- **Objective:** Make handoffs explicit via issue comment + GitHub description, not implicit in email.
- **Insertion point:** Lead charter (see 1.2) + GitHub issue templates + `.squad/ceremonies.md`
- **Handoff checklist (to include in every issue):**
  - [ ] Contract posted and reviewed
  - [ ] Acceptance criteria are testable and specific
  - [ ] Acceptance criteria are ordered by priority (if partial completion is acceptable)
  - [ ] Evaluator (Code-Review / Lead) is named
  - [ ] Any known constraints or prior art are linked
  - [ ] Generator has asked clarifying questions (if any) and contract is updated
- **Implementation detail:**
  - Add this checklist to the issue template in `.github/ISSUE_TEMPLATE/`
  - Ralph should not schedule work on Squad issues until the checklist is complete
  - Lead should comment "Ready for Code" (or equivalent) once checklist is done
  - This becomes a ceremony: before any agent starts work, the planner has explicitly signed off
- **Validation:** No issue is "In Progress" without a completed contract; Ralph respects the checklist
- **Complexity estimate:** 0.5 days (checklist prose + ceremony doc)

---

### Phase 2: Evaluator Strengthening (Code Review + QA)
**Weeks 3-4** | Dependency: Phase 1 complete (so Code knows the contract) | Risk: Medium

#### 2.1 Define Code Review Evaluation Rubric
- **Objective:** Make code review a harness evaluator, not just a style checker.
- **Insertion point:** `.squad/agents/code-review/charter.md` or new `.squad/skills/code-review-rubric.md`
- **Evaluation categories:**
  - **Contract fulfillment** (0-30 points): Does the PR implement the issue contract? Any scope creep or shortcuts?
  - **Test coverage** (0-20 points): Are new code paths tested? Do tests reflect acceptance criteria?
  - **Quality** (0-20 points): Code clarity, consistency with codebase style, no obviously brittle patterns
  - **Delivery readiness** (0-30 points): Does it merge cleanly? Are tests passing? Are docs updated? Any known bugs or TODOs?
- **Verdict rules:**
  - Score ≥75: Approve
  - Score 50-75: Request changes (specific feedback required)
  - Score <50: Reject (return to Code with specific unmet criteria)
- **Implementation detail:**
  - Create a rubric document with examples of what each score band looks like
  - Code-Review agent should structure feedback with scores: `[CONTRACT: 25/30] [TESTS: 18/20] [QUALITY: 18/20] [DELIVERY: 28/30] = 89/100`
  - Lead may override on special cases (e.g., docs-only PR) but should document the override
  - Record review score in GitHub as a custom field (GitHub labels or a workflow artifact)
- **Validation:** Every PR includes a structured review with contract reference and scoring; scores correlate with merge quality
- **Complexity estimate:** 1.5 days (rubric design + Code-Review charter update + example feedback)

#### 2.2 Strengthen Code Review Tool Setup
- **Objective:** Make code review easier and more consistent via tooling.
- **Insertion point:** GitHub Actions workflow for PR review automation (optional but recommended)
- **What it can do:**
  - Auto-run tests (already done, likely)
  - Flag test coverage gaps (use existing codecov integration)
  - Check for contract fulfillment (lint issue number + check if contract comment exists, then do basic NLP on diff)
  - Validate that docs/CHANGELOG/tests are updated alongside code
- **Implementation detail (optional):**
  - This is a nice-to-have, not a blocker
  - Could be a simple action that comments "Please review against contract #1234" on every PR
  - Or a more complex action that parses the issue contract and highlights scope drift
  - Start with manual rubric (2.1); add automation later if patterns emerge
- **Validation:** Code-Review feedback includes specific, actionable contract references
- **Complexity estimate:** 0.5-2 days (depending on automation depth; start with manual)

---

### Phase 3: Retrospective-Driven Harness Audit (Ongoing)
**Weeks 5+ (Quarterly Cadence)** | Dependency: Phases 1-2 complete | Risk: Low

#### 3.1 Run Retrospective Digest on Engineering Work
- **Objective:** Use existing retrospective infrastructure to identify which harness components are load-bearing.
- **Data source:** GitHub issues, PR review comments, and agent traces (from squad-heartbeat.yml runs)
- **Quarterly questions to answer:**
  - Are all issues being assigned and completed, or do some linger? (If many linger, is the contract process breaking down?)
  - Which code-review criteria actually catch bugs? Which are ceremonial? (Adjust rubric based on frequency of actual issues found)
  - Are Lead-to-Code handoffs smooth, or do generators frequently ask for contract clarification? (If frequent, tighten contract template)
  - Is Ralph's scheduling optimal, or are agents waiting? (Ralph may need tuning, not harness changes)
  - Which agent types (Code vs Data vs UX) tend to have more review iterations? (May indicate skill gaps, not harness issues)
- **Implementation detail:**
  - This is a manual analysis, not automated
  - Use GitHub's issue/PR data API to pull:
    - Issue creation date → close date (throughput)
    - Comment count per PR (iteration count)
    - Lead's first contract comment → Code's first commit (handoff delay)
    - Code-Review approval → merge (review duration)
  - Aggregate into a monthly/quarterly report
  - Share findings in `.squad/decisions.md` or `.squad/log/` with recommendations
- **Validation:** Squad holds a quarterly retrospective; decisions document captures learnings
- **Complexity estimate:** 2-3 hours per cycle (data analysis + writeup)

#### 3.2 Simplify Harness Based on Retrospective Findings
- **Objective:** Remove checklist items, evaluation criteria, or agent roles that aren't adding value.
- **Examples of things to stress-test:**
  - Are all four evaluation categories in the code-review rubric needed, or can two be dropped?
  - Does the handoff checklist have items nobody actually verifies? (Remove them)
  - Is Lead's role in planning still necessary, or could Code+Review handle it alone for simple issues?
  - Does Ralph need all its scheduling heuristics, or are some unnecessary?
- **Implementation detail:**
  - For each item, ask: "What would go wrong if we removed this?"
  - If nothing would go significantly wrong, remove it
  - Document the decision in `.squad/decisions.md`
  - Track the impact over the next quarter
- **Validation:** Harness stays lean; removed items don't reappear as bugs
- **Complexity estimate:** 1-2 hours per decision (analysis + prose)

---

### Phase 4: Ralph Integration and Ceremony Automation (Optional, For Next Iteration)
**Future** | Dependency: Phases 1-3 working well | Risk: Medium

#### 4.1 Ralph Enforces Issue Contracts
- **Objective:** Ralph should not assign work to Code until the contract is complete.
- **What Ralph checks:**
  - Issue has a contract comment with the required sections (scope, criteria, evaluator, etc.)
  - Handoff checklist is complete
  - Lead has posted a "Ready for Code" comment (or equivalent)
- **Implementation detail:**
  - Ralph already scans issues; add a check to `ralph-watch.ps1` or `.github/workflows/squad-heartbeat.yml`
  - If contract is incomplete, Ralph comments "Waiting for contract" and does not assign the issue
  - Once contract is ready, Ralph moves the issue to "In Progress" and assigns the generator
- **Validation:** No issue is assigned to Code without a complete contract; Lead has time to review before Ralph schedules work
- **Complexity estimate:** 1 day (workflow/script logic update)

#### 4.2 Ralph Reports on Code Review Scorecard
- **Objective:** Weekly (or on-demand) reporting on code-review rubric metrics.
- **What it reports:**
  - Average review score over last 4 weeks (by agent type if possible)
  - Distribution of scores (how many in 80-90, 70-80, etc.)
  - Slowest stages (where PRs spend most time)
  - Lead comment: "Code review quality is high / average / slipping"
- **Implementation detail:**
  - Could be a dashboard widget (optional) or a GitHub comment on a tracking issue
  - Use GitHub API to query PR review comments and extract scores
  - Post a monthly scorecard to `.squad/log/` or a pinned issue
- **Validation:** Squad has visibility into harness health; trends are trackable
- **Complexity estimate:** 1-2 days (metric aggregation + reporting)

---

## Exact Repo Insertion Points (Summary Table)

| Component | File | Action |
|-----------|------|--------|
| Issue contract template | `.squad/skills/issue-contract-template.md` | New file with scope, criteria, verification, evaluator structure |
| Lead charter updates | `.squad/agents/lead/charter.md` | Add "Harness Role: Planner" + "Contract Protocol" sections |
| Code charter updates | `.squad/agents/code/charter.md` | Add "Harness Role: Generator" + clarify expectations |
| Code-Review charter | `.squad/agents/code-review/charter.md` (or Lead) | Add "Harness Role: Evaluator" + "Evaluation Criteria" with rubric |
| Data/UX/DevOps charters | `.squad/agents/{data,ux,devops}/charter.md` | Add "Harness Role: Generator" (2-3 lines each) |
| Code review rubric | `.squad/skills/code-review-rubric.md` or charter | Detailed rubric: contract (30), tests (20), quality (20), delivery (30) |
| Ceremony docs | `.squad/ceremonies.md` | Add "Issue Contract Protocol" ceremony; mention checklist |
| GitHub issue template | `.github/ISSUE_TEMPLATE/squad.md` | Add handoff checklist with contract + evaluator + clarification box |
| Ralph integration | `ralph-watch.ps1` or `.github/workflows/squad-heartbeat.yml` | Check for contract before assigning work (optional Phase 4) |

---

## Validation Strategy

### Per-Phase Validation

**Phase 1:**
- [ ] `.squad/skills/issue-contract-template.md` exists and is well-written
- [ ] Every new issue created in the next week includes a contract comment
- [ ] Lead and Code agree on scope before Code starts work (visible in comments)
- [ ] No "surprise" scope changes mid-issue

**Phase 2:**
- [ ] Code-Review agent provides structured feedback with scores
- [ ] Scores reference the original issue contract
- [ ] Code makes sense of the feedback and either fixes it or debates the rubric (no confusion)
- [ ] Approved PRs merge successfully; rejected PRs are genuinely unready

**Phase 3:**
- [ ] Quarterly retrospective includes engineering metrics (throughput, review quality, handoff delay)
- [ ] Findings are actionable (e.g., "remove XYZ from the rubric because it never catches bugs")
- [ ] At least one harness component is simplified based on retrospective data

### Integration Validation

- Create a test issue with a contract; assign to Code; track through review
- Verify Lead → Code → Review → Merge flow is smooth and contract-driven
- Run Ralph on the test issue; confirm it respects the contract requirement
- Manually inspect 3-5 recent PRs to confirm review scores and feedback quality

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Contract overhead slows down simple issues | Medium | Start with a lightweight template; use abbreviated contracts for tiny bugs (1-line OK) |
| Code-Review rubric is too strict; PRs get rejected for minor issues | Medium | Start with gentle scoring (>50 = OK); adjust after 10 PRs to find the right tension |
| Lead becomes a bottleneck (every issue needs their contract) | Medium | Once established, Lead can delegate contract-writing to senior Code agents for their own issues |
| Retrospective analysis is too tedious; doesn't happen | Medium | Start with a simple quarterly check-in (2-3 hours); make it a Standing ceremony; automate later |
| Existing happy workflow gets disrupted | Medium | Roll out incrementally: Phase 1 (contracts) first, then Phase 2 (review rubric) with feedback |
| Ralph changes break existing issue scheduling | Low | Test Ralph changes on a dry-run branch before merging |

---

## Recommended First Slice

**Start here: Phase 1.1 + 1.2** (Weeks 1-2)

1. Write the issue contract template in `.squad/skills/issue-contract-template.md` (2-3 hours)
2. Update Lead charter with "Harness Role: Planner" and "Contract Protocol" (1-2 hours)
3. Update Code charter with "Harness Role: Generator" (30 minutes)
4. Post the template to `.squad/agents/lead/` as a new ceremony or skill
5. Test it: Create one new issue with a contract; have Lead post it; have Code implement against it; get feedback

This slice is low-risk, immediately visible, and sets the foundation for Phase 2. Once validated, add Code-Review rubric (Phase 2) so evaluation is explicit.

---

## Success Metrics

- **Contract coverage:** 100% of new Squad issues have a contract before Code starts work
- **Clarity:** Code-Review feedback references the contract; no "confused about scope" comments
- **Evaluation consistency:** Code-Review scores are reproducible; same PR gets similar scores from different reviewers
- **Handoff smoothness:** Lead → Code handoff delay <1 day (visible in first comment timestamp vs first commit timestamp)
- **Harness health:** Retrospective findings lead to at least 1 simplification per quarter
- **No regressions:** Throughput (issues completed per week) does not decrease; may increase due to clearer scope

---

## Relationship to App Implementation Plan

**How the two plans reinforce each other:**

1. **Contract-driven harness:** Both the app (article pipeline) and engineering system (Squad) use explicit contracts to bridge planning and evaluation
2. **Threshold-based evaluation:** Both Editor (for articles) and Code-Review (for code) use scoring rubrics with threshold verdicts
3. **Retrospective discipline:** Both harness implementations track metrics and periodically simplify based on what's actually load-bearing
4. **Handoff artifacts:** Both article (via handoff.md) and engineering (via issue contract) use structured handoffs for long-running coherence

The philosophy is identical: separate the doer from the judge, make "done" explicit, and let data drive simplification.

**Sequential dependency:**
- Implement the **app plan first** (Phases 1-2 of article harness) to prove the pattern works in a high-stakes, high-visibility context
- Then apply the same pattern to engineering (Squad phases 1-2) with confidence
- Use retrospective data from both to drive Phase 3+ simplifications across both systems

