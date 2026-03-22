---
name: Structured Knowledge Seed Validation
domain: workflow
confidence: high
tools: [vitest]
---

# Structured Knowledge Seed Validation

## When to Use

- You are adding repo-owned knowledge seed files that are not wired into runtime yet.
- The immediate goal is to make the artifact schema explicit and testable before any loader or injection work exists.
- Future runtime work will need stable metadata and repeatable section layout.

## Workflow

1. Define a shared schema block for the seed type (`schema_version`, `glossary`, `description`, `entry_fields`, `refresh_guidance`, `entries`).
2. Keep every entry explicit about `definition`, `source`, `verified_date`, and TTL expectations.
3. Add tests that enforce schema markers, entry counts, and required content fields.
4. Use frontmatter plus a fixed markdown heading layout for related narrative artifacts like team sheets.
5. Record the structure decision in squad history and decisions so later runtime work does not have to rediscover it.

## Must-Haves

- Keep the schema visible in the file contents, not just implied by docs.
- Tests should verify required markers and meaningful content density, not just file existence.
- The decision should be recorded so future implementers know the structure is intentional.
