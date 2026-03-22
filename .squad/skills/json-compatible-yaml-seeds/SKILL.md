---
name: JSON-Compatible YAML Seeds
domain: workflow
confidence: high
tools: [vitest]
---

# JSON-Compatible YAML Seeds

## When to Use

- You need YAML seed files in the repository, but the approved scope does not justify adding a parser dependency yet.
- The immediate requirement is validation/testing of file structure rather than runtime YAML ingestion.
- You want a future-compatible path to richer YAML without blocking current repo constraints.

## Workflow

1. Store the seed file with a `.yaml` extension using JSON object syntax.
2. Keep the schema explicit and consistent so `JSON.parse()` can validate it in tests.
3. Document the choice in squad decisions/history so future runtime work understands the temporary constraint.
4. Add tests that enforce required fields and file presence, not just existence.
5. When runtime YAML loading is approved later, swap in a real parser without having to redesign the seed schema.

## Must-Haves

- The file must remain valid YAML syntax, not just valid JSON.
- Tests should verify both parseability and domain-specific required fields.
- The decision should be recorded so future implementers know the format is intentional, not accidental.
