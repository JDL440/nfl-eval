# Decision — Issue #85 Proof-of-Concept Structure

- **By:** Code (🔧 Dev)
- **Date:** 2026-03-22
- **Issue:** #85

## Decision

Use a shared glossary YAML schema built around `schema_version`, `id`, `glossary`, `description`, `entry_fields`, `refresh_guidance`, and `entries`, plus a fixed markdown section template for proof-of-concept team sheets in `content/data/team-sheets/`.

## Why

- The approved scope explicitly limits this work to phases 1-3 plus docs/testing support, so the seed schema needed to be explicit and durable without implying runtime loading already exists.
- The glossary structure makes term requirements explicit (`definition`, `source`, `verified_date`, `ttl_days`) while staying easy to validate in Vitest.
- Frontmatter plus a fixed heading structure on team sheets makes the proof of concept easy to validate without prematurely locking in runtime injection behavior.

## Scope Notes

- This decision covers only the seed artifact structure and test strategy.
- Runtime loading/injection and refresh automation remain deferred to the follow-up phases 4-5 issue.
