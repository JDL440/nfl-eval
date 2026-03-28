---
name: Writer Editor Preflight
domain: pipeline
confidence: high
tools: [typescript, vitest]
---

# Writer Editor Preflight

## When to use

- Writer drafts are repeatedly reaching Editor with the same obvious blockers.
- The real issue is **prompt/runtime alignment**, not missing analysis depth.
- You want a quality win that stays deterministic, bounded, and cheap.

## Pattern

1. Put a **short Editor-derived checklist** into Writer runtime through a shared skill or prompt seam.
2. Keep that checklist focused on a handful of high-signal expectations, not the whole editor role.
3. Add a **deterministic pre-editor blocker inspector** in the existing draft-validation path.
4. Limit the blocker set to things code can check reliably:
   - required structure
   - required ending/boilerplate hooks
   - obvious placeholder leakage
5. Reuse the existing self-heal / send-back flow so the article revises the current draft instead of inventing a new recovery path.

## Why this works

- Prompt alignment reduces avoidable churn before the draft ever reaches Editor.
- Deterministic guards catch the cheapest failures faster than another model pass.
- Keeping the blocker set small prevents the lint from pretending to replace editorial judgment.

## NFL Lab example

- **Runtime seam:** `src/pipeline/actions.ts` already injects Writer task text, revision context, and self-heal instructions.
- **Guard seam:** `src/pipeline/engine.ts` already enforces the TLDR contract through `inspectDraftStructure()` and `requireDraft()`.
- **Best next slice:** add a shared Writer preflight skill plus a broader Stage 5 blocker inspector for TLDR, `Next from the panel`, and placeholder/TODO leakage.

## Validation slice

- `tests/pipeline/actions.test.ts`
- `tests/pipeline/engine.test.ts`
- `tests/pipeline/writer-factcheck.test.ts`
- `npm run v2:build`
