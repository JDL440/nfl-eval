# Writer unboxing and revision-loop fixes

## Problem

Research on the Packers article showed the revision loop was bottlenecked by evidence gaps. The editor repeatedly asked for usage, contract, and roster support that the prompt artifacts did not supply, while the writer charter discouraged independent verification. We need to turn those findings into a prioritized backlog and GitHub issues, with special focus on whether Writer should be allowed to do targeted research/fact-checking.

## Proposed approach

Prioritize the recommendations from fastest / highest-leverage operational wins to longer-term workflow changes. Open a GitHub issue for each meaningful fix so implementation can be sequenced independently. Recommend "unboxing" Writer for targeted evidence retrieval with guardrails rather than keeping Writer fully blocked from research.

## Todos

1. Summarize and prioritize the research findings into quick wins, medium-term changes, and longer-term workflow work.
2. Open a GitHub issue for each prioritized fix, checking for obvious duplicates first.
3. Answer the policy question on Writer fact-checking/research with a recommendation and rationale.
4. Return the prioritized backlog and issue links to the user, with a suggested first implementation slice.

## Notes

- Treat issue `#119` as the already-opened model-provenance / UX-badge item.
- Prefer splitting issues by implementable surface, not by abstract recommendation wording.
- Keep the backlog opinionated: quick wins first, architectural changes later.
