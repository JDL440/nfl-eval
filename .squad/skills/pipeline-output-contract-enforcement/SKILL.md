---
name: Pipeline Output Contract Enforcement
domain: pipeline
confidence: high
tools: [view, rg, vitest]
---

# Pipeline Output Contract Enforcement

## When to Use

- One pipeline role is expected to emit a specific artifact shape, but the next role only checks for it informally in prompt text.
- Writer/Editor/Publisher behavior is drifting because a required format lives only in charters or skills.
- You need a durable fix that survives model variance.

## Workflow

1. Inspect the full contract surface:
   - agent charter(s)
   - skill file(s)
   - stage action task text
   - deterministic guards / validators
   - regression tests
2. Identify whether the requirement is:
   - prompt-only
   - guard-only
   - or inconsistently described across files
3. Align the prompt assets first so upstream and downstream roles describe the same output contract.
4. Add one deterministic validator for the required shape and reuse it across:
   - the stage action self-heal / retry path
   - the pipeline guard that blocks advancement
5. Add regression tests that prove both:
   - the valid artifact passes
   - the missing/malformed artifact fails

## Must-Haves

- Do not rely on human reminders or downstream reviewer diligence as the only enforcement.
- Prefer a shared validator over copy-pasted regex checks in multiple files.
- Put enforcement at the producing stage and at the stage-transition boundary.
- Add negative tests for the exact omission that triggered the investigation.

## Example

- Writer receives `writer.md` + `substack-article.md`, while Editor receives `editor.md` + `editor-review.md`.
- Editor expects a TLDR block, but `src/pipeline/engine.ts` only checks draft word count and verdict status.
- Durable fix: align the prompt assets, add a shared TLDR validator in `src/pipeline/`, call it from `writeDraft` in `src/pipeline/actions.ts`, and block stage 5→6 in `src/pipeline/engine.ts` when TLDR is missing.
