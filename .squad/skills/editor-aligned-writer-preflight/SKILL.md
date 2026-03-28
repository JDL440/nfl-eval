---
name: Editor-Aligned Writer Preflight
domain: pipeline
confidence: high
tools: [typescript, vitest]
---

# Editor-Aligned Writer Preflight

## When to use

- A Writer stage keeps producing preventable Editor feedback on the first pass.
- The repo already has clear Editor expectations in charter/skill text.
- You want a bounded quality lift before the Editor handoff without creating an open-ended second review pass.

## Pattern

1. Extract the highest-signal Editor expectations into a **short checklist** that Writer sees every run.
2. Keep the checklist in a **shared helper/runtime seam**, not duplicated across multiple prompt strings.
3. After Writer returns, run a **deterministic Stage 5 linter** on the draft for a small set of common blockers.
4. Reuse the existing retry/self-heal path once with precise repair instructions built from the linter findings.
5. Persist the result as a lightweight artifact or prompt block only if it helps downstream visibility; keep it bounded and deterministic.
6. If you persist an artifact, make the helper own both the artifact name and markdown format so the action layer only passes initial/final state plus whether repair triggered.

## NFL Lab example

- `src/pipeline/actions.ts` `writeDraft()` is the natural insertion point because it already assembles Writer context, runs `writer-factcheck.md`, and performs one repair retry for structural misses.
- `src/agents/runner.ts` should stay generic; the Writer/Editor alignment logic belongs in pipeline code or a small shared helper under `src/pipeline/`.
- Good first checks are the ones already emphasized in `src/config/defaults/charters/nfl/writer.md` and `src/config/defaults/skills/editor-review.md`: TLDR contract, quote discipline, unsupported absolutes, and other simple high-signal blockers.
- If downstream visibility matters, persist a bounded `writer-preflight.md` artifact from the helper layer and let tests assert both clean-pass persistence and repair-trigger persistence.

## Why this works

- Writer gets explicit, Editor-shaped expectations before drafting, reducing first-pass churn.
- Deterministic linting catches cheap misses without pretending to replace editorial judgment.
- A shared seam keeps policy synchronized and makes focused tests straightforward.
