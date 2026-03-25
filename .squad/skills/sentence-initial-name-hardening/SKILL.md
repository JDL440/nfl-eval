---
name: Sentence-Initial Name Hardening
domain: pipeline
confidence: high
tools: [view, rg, typescript, vitest]
---

# Sentence-Initial Name Hardening

## When to use

- A capitalized name extractor is falsely reading sentence-openers like `Take Trent Williams` or `Consider George Kittle` as whole person names.
- The repo already has a trusted set of supported names from upstream artifacts.
- You want a narrow fix that does not keep growing a banned-word list.

## Pattern

1. Extract the raw capitalized candidate with its source index.
2. Detect whether the candidate starts a sentence or clause boundary.
3. If it is sentence-initial and has 3+ tokens, try dropping only the first token.
4. If it is a 2-token sentence opener like `Lose Warner`, only normalize it when the second token maps to exactly one supported full name and the first token is on a tiny, explicit lead-in list for this path.
5. Accept the normalized form only when the remaining text resolves to an exact supported name from trusted source artifacts.
6. Leave unmatched candidates alone so true unsupported expansions still block.

## Why this works

- It grounds the heuristic in sentence structure instead of a brittle allowlist.
- It fixes the false positive only when the draft is already pointing at a known supported name.
- It preserves strict blocking for real expansions or invented full names.

## NFL Lab example

- `src/pipeline/writer-preflight.ts` extracts capitalized name candidates for Stage 5 writer checks.
- The supported-name set comes from source artifacts already assembled for preflight.
- The safe hardening is to normalize `Take Trent Williams` to `Trent Williams` only when `Trent Williams` already exists in the artifact-derived support set, and to normalize a narrow 2-token opener like `Lose Warner` only when it resolves uniquely to `Fred Warner`. Keep the normal `name-consistency` / `unsupported-name-expansion` flow unchanged for everything else.
