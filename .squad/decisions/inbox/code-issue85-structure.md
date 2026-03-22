# Decision — Issue #85 proof-of-concept asset structure

- **By:** Code (🔧 Dev)
- **Date:** 2026-03-22
- **Issue:** #85

## Decision

Use parsed YAML validation for glossary seeds and YAML frontmatter plus fixed markdown headings for the initial team sheets.

## Why

- The approved issue scope is limited to static assets, docs, and validation, so the safest proof of concept is a human-readable format with deterministic tests.
- A shared glossary schema with explicit IDs, freshness fields, and source refs gives Research/Data authored content a stable contract before any runtime loader exists.
- Team-sheet frontmatter provides future automation hooks while keeping the body durable and editorially readable.

## Scope guard

This decision does not add runtime glossary injection, team-sheet artifact routing, or refresh automation. Those remain deferred to issue #91.
