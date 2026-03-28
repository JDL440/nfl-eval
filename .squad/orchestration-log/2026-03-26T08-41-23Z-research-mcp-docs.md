# Research MCP Docs Audit — Orchestration Log

**Agent:** research-mcp-docs  
**Timestamp:** 2026-03-26T08:41:23Z  
**Status:** Complete

## Summary

Audited docs/config drift. Recommended README/config alignment around `mcp/server.mjs` as canonical operator-facing entrypoint. Identified config parity issues and wrapper-vs-shared-seam documentation gaps.

## Decision Output

**File:** `.squad/decisions/inbox/research-unified-local-mcp-rollout.md`

Use `mcp/server.mjs` as canonical operator-facing local MCP entrypoint. Consolidate source-of-truth in `src/mcp/server.ts`. Make `src/cli.ts mcp` a compatibility wrapper.

## Key Findings

- `.copilot/mcp-config.json`, `.mcp.json` already point to `mcp/server.mjs`
- `.github/extensions/README.md` teaches tool registration in `mcp/server.mjs`
- `mcp/smoke-test.mjs` validates only `mcp/server.mjs` surface
- Two different local MCP stories create drift across docs/config/scripts
- Test coverage fragmented: pipeline-only tests vs canonical-local coverage

## Documentation Gaps

- README describes "v2:mcp vs legacy mcp" split
- `.github/extensions` incomplete tool inventory
- No canonical-local MCP schema validation tests
- Smoke coverage missing prediction markets, roster queries

## Affected Files

- `README.md` — consolidate operator setup
- `.github/extensions/README.md` — tool registration guidance
- `.copilot/mcp-config.json`, `.mcp.json` — config parity
- `mcp/smoke-test.mjs` — complete coverage
- Test suite — canonical-local inventory validation

## Next Steps

Code to implement shared registration seam. DevOps to consolidate scripts/config. Research to expand operator docs with full tool inventory.
