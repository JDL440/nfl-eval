# Session: MCP Rollout Review & Decision Merge

**Timestamp:** 2026-03-26T08:41:23Z  
**Topic:** mcp-rollout-review  
**Agents:** devops-mcp-audit, research-mcp-docs, devops-mcp-review-2

## Overview

Three specialist audits of unified local MCP entrypoint rollout. All recommend `mcp/server.mjs` as canonical operator-facing surface. Identified integration gaps, docs drift, and incomplete validation.

## Key Decisions Merged

1. **devops-mcp-entrypoint.md** — Canonical local MCP entrypoint strategy
2. **research-unified-local-mcp-rollout.md** — Operator-facing docs/config alignment
3. **Code-provider-rollout.md** — Multi-provider runtime wiring (additive pass)
4. **research-mcp-rollout-audit.md** — Docs/test coverage audit
5. **devops-unified-local-mcp-rollout.md** — Implementation notes for source consolidation

## Critical Path

1. Code: Implement shared registration seam in `src/mcp/server.ts`
2. Code: Make `src/cli.ts mcp` delegation/wrapper
3. DevOps: Converge package.json scripts, config files
4. Research: Expand `.github/extensions/README.md` with full tool inventory
5. DevOps: Extend `mcp/smoke-test.mjs` coverage
6. All: Validate smoke/integration end-to-end on canonical path

## Inbox Files Processed

- Code-provider-rollout.md
- devops-mcp-entrypoint.md
- devops-unified-local-mcp-rollout.md
- research-mcp-rollout-audit.md
- research-unified-local-mcp-rollout.md

## Next

Decisions merged into .squad/decisions.md. Ready for implementation sprint.
