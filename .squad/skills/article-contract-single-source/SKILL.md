---
name: Article Contract Single Source
domain: pipeline
confidence: high
tools: [view, rg, vitest]
---

# Article Contract Single Source

## When to Use

- Multiple prompts or charters repeat the same article structure rules.
- One role is allowed to author the structure, while another only checks it.
- Downstream stages keep drifting because the canonical article skeleton is duplicated.

## Workflow

1. Put the canonical article skeleton in one skill or template file.
2. Have writer/editor/publisher charters reference that canonical source instead of restating it.
3. Keep review checklists focused on validation, not re-authoring structure policy.
4. Add tests that assert the canonical block is present or parsed correctly.

## Must-Haves

- One source of truth for article section order and required callouts.
- Include TLDR/executive-summary requirements in that canonical skeleton instead of restating them in role charters.
- Review roles should verify the contract, not redefine it.
- If a contract changes, update the canonical template first, then the referencing charters.
