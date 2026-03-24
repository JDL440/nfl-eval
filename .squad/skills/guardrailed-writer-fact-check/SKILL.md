---
name: Guardrailed Writer Fact-Check
domain: pipeline
confidence: high
tools: [view, rg, typescript, vitest]
---

# Guardrailed Writer Fact-Check

## When to use

- A drafting-stage agent would benefit from limited verification access, but you do not want it to become a second unrestricted research/editor pass.
- The repo already has deterministic local evidence or telemetry seams that can be reused.
- The real problem is revision churn from a few risky claims, not a lack of open-ended research.

## Pattern

1. **Start from supplied/local evidence first.**
   - Reuse existing artifacts, query helpers, and cached datasets before any external lookup.
2. **Define a source ladder.**
   - Deterministic local/runtime sources first, official primary sources second, trusted references third, everything else blocked or escalation-only.
3. **Expose a narrow helper, not raw browsing.**
   - Give the drafting agent an allowlisted resolver/fetch helper rather than generic web search.
4. **Budget by checks and time, not just tokens.**
   - Cap the number of external checks and the wall-clock time for the verification pass; capture tokens/cost as telemetry when available.
5. **Require a durable artifact.**
   - Persist which claims were verified, attributed, softened, or dropped, plus the sources and budget summary.
6. **Keep Editor as final authority.**
   - The drafting-stage verification pass reduces churn; it does not replace the editor/fact-check gate.
7. **Defer escalation logic if blocker foundations are still moving.**
   - If evidence-deficit routing or repeated-blocker handling is being designed elsewhere, keep v1 to the initial draft stage.

## Why this works

- It captures most of the quality win from targeted verification without opening an unbounded research surface.
- It keeps policy enforceable in code instead of relying on prompt wording alone.
- It makes uncertainty visible: unsupported claims get softened or omitted instead of being laundered into confident prose.

## NFL Lab example

- `src/pipeline/actions.ts` already injects `panel-factcheck.md`, `roster-context.md`, and `fact-check-context.md` before Writer/Editor stages.
- `recordAgentUsage()` plus `UsageEvent` / `StageRun` already provide a telemetry seam for check counts, tokens, and cost estimates.
- The right v1 move for issue `#125` is a Stage 5-only Writer verification pass with:
  - allowlisted source classes
  - a small external-check budget
  - a `writer-factcheck.md` artifact
  - Editor still consuming the final result as advisory evidence

## Implementation notes

- Prefer a helper such as `resolveApprovedFactSources()` / `fetchApprovedSource()` over handing Writer generic search access.
- Treat local deterministic checks as “free first pass” and budget only the incremental external fetches.
- Require inline attribution for volatile facts that come from reference sources.
- On budget exhaustion or source conflict, force Writer to soften, attribute cautiously, omit, or defer to Editor rather than invent certainty.
