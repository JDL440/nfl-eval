# DevOps MCP Audit — Orchestration Log

**Agent:** devops-mcp-audit  
**Timestamp:** 2026-03-26T08:41:23Z  
**Status:** Complete

## Summary

Audited local MCP rollout. Identified canonical entrypoint as `mcp/server.mjs`. Recommended edits across package.json, src/cli.ts, src/mcp/server.ts, mcp/server.mjs, config/docs, and smoke test to unify server composition.

## Decision Output

**File:** `.squad/decisions/inbox/devops-mcp-entrypoint.md`

Canonical local MCP entrypoint: `mcp/server.mjs`. Make `src/cli.ts mcp` a wrapper. Preserve pipeline fallback as `mcp-pipeline`.

## Key Findings

- Repo-local client config already points to `mcp/server.mjs`
- `src/cli.ts mcp` drifted to separate pipeline-only MCP server
- CLI and configured clients see different tool inventories
- Baseline validation: `npm run v2:build`, smoke tests pass

## Affected Components

- `src/cli.ts` — wrapper pattern
- `src/mcp/server.ts` — shared bootstrap
- `mcp/server.mjs` — canonical entrypoint
- `package.json` — script convergence
- Docs, smoke tests, config files

## Next Steps

Code to implement wrapper/delegation. DevOps to validate smoke/integration. Research to audit docs/operator clarity post-impl.
