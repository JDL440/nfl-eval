---
name: Deferred Phase Follow-Up Issue Split
domain: workflow
confidence: high
tools: [gh]
---

# Deferred Phase Follow-Up Issue Split

## When to Use

- An issue contains multiple phases and the owner explicitly approves only an initial subset.
- The remaining phases are deferred, not cancelled.
- Future implementers need a clean boundary between "build now" and "build later."

## Workflow

1. Inspect the parent issue body and comments to capture the exact retained scope.
2. Summarize the deferred phases in concrete implementation terms, including likely file paths or systems touched.
3. Create a new issue that explicitly says the parent issue is intentionally limited to the approved phases.
4. Label the new issue for squad intake plus the likely implementation owner (`squad`, `squad:lead`, and usually `squad:code`).
5. Comment on the parent issue with a short TL;DR that links the new follow-up issue.
6. Record the split in `.squad/agents/{role}/history.md` and `.squad/decisions/inbox/` so the scoping decision is durable.

## Must-Haves

- State both what stays in the parent issue and what moves out.
- Cross-link the parent and follow-up issues.
- Use "intentionally limited" language on the parent scope to prevent scope creep.
- Give the follow-up issue acceptance criteria so it can be implemented later without re-discovery.

## Example

- Parent issue `#85` kept Phases 1-3 plus docs/testing.
- Follow-up issue `#91` captured:
  - runtime glossary and team-sheet injection (`src/agents/runner.ts`, `src/pipeline/actions.ts`, `src/pipeline/context-config.ts`)
  - monthly refresh automation (`scripts/refresh-domain-knowledge.ts`, workflow scheduling, audit logging)
