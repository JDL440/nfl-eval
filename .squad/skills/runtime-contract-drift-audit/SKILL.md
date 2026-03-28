---
name: Runtime Contract Drift Audit
domain: pipeline-architecture
confidence: high
tools: [view, rg, powershell]
---

# Runtime Contract Drift Audit

## When to use

- A workflow simplification appears correct in source but live behavior still looks old
- Charters, skills, prompts, or policy files are seeded into a persistent data directory
- An article or job is stuck in a way that contradicts the reviewed source contract

## Pattern

Source-code review is not enough when runtime agents load seeded knowledge from a data directory.

Audit both layers:

1. **Source defaults** — the files under the repo that define the intended contract
2. **Live seeded runtime copies** — the files the running server actually loads
3. **Persisted workflow evidence** — DB state, revision summaries, and artifacts for the stuck item

If source and runtime copies diverge, the live stall may be contract drift rather than surviving control-flow complexity.

## Audit checklist

### 1. Confirm where runtime knowledge is loaded from

- Find the active `dataDir`
- Verify where `chartersDir` and `skillsDir` resolve
- Confirm whether seeding is one-time bootstrap or ongoing sync

### 2. Compare source vs. live runtime contract files

- Charter files for the agent involved in the stall
- Skills/protocol files that define canonical output and blocker taxonomy
- Timestamps and contents for both copies

### 3. Inspect persisted workflow evidence

- Article/job stage and status
- Revision summaries
- Latest review artifact
- Any escalation artifact

### 4. Classify the stall correctly

- **Stage 5 deterministic guard stall** — malformed draft / placeholder / missing minimal shell
- **Stage 6 reviewer churn** — broad blocker taxonomy, repeated revisions, missing blocker metadata
- **Runtime drift stall** — live behavior still follows old charter/skill contract

## Guardrails

- Do not remove minimal malformed-input guards just because live behavior is stale
- Do not trust source prompts alone when runtime loads persistent seeded copies
- Preserve structured blocker metadata; without it, repeated-blocker escalation becomes revision-cap escalation

## NFL Lab example

- Source V3 Editor contract was simplified to accuracy-first review
- Live seeded files under `C:\Users\jdl44\.nfl-lab\agents\...` still used the older full-editor contract
- Seahawks JSN article therefore paused at Stage 6 after broad editor `REVISE` cycles, even though current source Stage 5 was already narrow

## Output

A good review should explicitly answer:

1. Is the stall happening in source behavior, live runtime behavior, or both?
2. Which guards are truly causing the pause?
3. Which minimal protections must remain untouched?
4. What sync/reseed/versioning gap allowed the drift?
