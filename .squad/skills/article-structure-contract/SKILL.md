---
name: Article Structure Contract
domain: pipeline
confidence: high
tools: [view, rg, vitest, gh]
---

# Article Structure Contract

## When to Use

- Writer, Editor, and Publisher all depend on the same article skeleton.
- A formatting element like TLDR, subtitle, author line, or image ordering is "required" in prompts but still gets missed in practice.
- Tests keep passing because fixtures do not encode the real structure contract.

## Pattern

1. Find the canonical shared template first — in this repo that is usually `src/config/defaults/skills/substack-article.md`.
2. Compare downstream role charters/skills (`writer.md`, `editor.md`, `publisher.md`) and remove or minimize duplicate policy text that can drift.
3. Trace the actual runtime gate in `src/pipeline/engine.ts` and the stage action in `src/pipeline/actions.ts`; if the structure rule is not machine-checked there, it is not truly enforced.
4. Check fixtures and mocks (`src/llm/providers/mock.ts`, e2e tests, pipeline tests). If they allow malformed drafts, they will hide regressions.
5. Encode the contract in layered form:
   - canonical prompt/template
   - stage validation
   - targeted retry/send-back behavior
   - regression tests and realistic mock output

## Must-Haves

- Prefer one source of truth for article skeleton requirements.
- Enforce required structure before downstream stages rely on it.
- Update mock outputs and tests together with the rule so CI reflects production expectations.
- Keep UI rendering concerns separate from editorial/pipeline validation.

## Example

- TLDR drift investigation on 2026-03-22 found:
  - canonical requirement in `src/config/defaults/skills/substack-article.md`
  - downstream expectation in `src/config/defaults/charters/nfl/editor.md` and `src/config/defaults/skills/publisher.md`
  - missing runtime gate in `src/pipeline/engine.ts`
  - permissive fixtures in `src/llm/providers/mock.ts`
- Follow-up issue: #107, with Code assigned to align prompts, add draft-structure enforcement, and update tests.
