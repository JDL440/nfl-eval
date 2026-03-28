# DevOps MCP Compatibility Review — Orchestration Log

**Agent:** devops-mcp-review-2  
**Timestamp:** 2026-03-26T08:41:23Z  
**Status:** Complete

## Summary

Audited compatibility and operator drift. Called out missing smoke coverage for unified canonical path and docs inconsistency between config, scripts, and extension guidance.

## Decision Output

**File:** `.squad/decisions/inbox/Code-provider-rollout.md`

Multi-provider runtime wiring as additive pass. Register all providers at startup. Model policy remains model-first. Carry article/provider intent as routing hint (`prefer` by default). Persist requested vs actual provider separately.

## Key Findings

- Unified canonical entrypoint (`mcp/server.mjs`) not fully validated
- Smoke test coverage gaps: missing prediction markets, rosters, other local tools
- Operator docs incomplete for canonical-local tool inventory
- Config/script inconsistency (v2:mcp vs mcp-pipeline naming)
- `mcp-config.json` and `.mcp.json` may have diverged

## Smoke/Integration Gaps

- Canonical `mcp/server.mjs` path not covered end-to-end
- Safe/stage-only side-effect validation missing
- Tool inventory parity checks absent
- Schema validation for all registered tools incomplete

## Validation Issues

- Current validation (smoke, integration, unit) not complete for unified surface
- No guarantee CLI and repo config expose same tool catalog post-unification
- Backward-compatibility shim untested

## Next Steps

Code to ensure shared bootstrap registration. DevOps to write comprehensive smoke covering both tool families. Research to validate operator-facing docs match actual tool inventory.
