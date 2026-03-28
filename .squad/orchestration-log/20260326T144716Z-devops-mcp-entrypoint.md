# Orchestration Log — DevOps / devops-mcp-entrypoint

**Date:** 2026-03-26  
**Agent:** DevOps  
**Task:** Unified canonical local MCP entrypoint  

## Summary

Unified the canonical local MCP surface into a single operator-facing entrypoint (`mcp/server.mjs`) and shared source-of-truth seam (`src/mcp/server.ts` and helpers). 

## Work Completed

- Consolidated `mcp/server.mjs` as the single canonical operator-facing entrypoint for all repo-local MCP clients
- All configs (`.copilot/mcp-config.json`, `.mcp.json`) now point to this unified path
- `mcp/smoke-test.mjs` validates the entrypoint surface
- `src/cli.ts mcp` delegates to the canonical bootstrap (not separate pipeline server)
- Aligned CLI wrapper and direct server script to converge on same runtime
- Compatibility wrappers in place so existing configs do not break
- Unset provider defaults to current auto-routing behavior

## Validation

- Build passed
- CLI tests passed  
- MCP smoke tests validated

## Status

✅ Completed — No ship blockers
