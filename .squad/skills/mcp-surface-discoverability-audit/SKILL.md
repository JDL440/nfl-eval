---
name: MCP Surface Discoverability Audit
domain: developer-infrastructure
confidence: high
tools: [view, rg, powershell]
---

# MCP Surface Discoverability Audit

## When to Use

- A repo has a canonical MCP server, but operators still rely on README/setup docs to know what tools exist.
- Tool schemas and examples appear easy to infer in code, but you need to know whether models/operators can discover them without reading implementation files.
- You are preparing a compatibility-safe MCP rollout and need to know which docs/tests must move together.

## Pattern

Treat the audit as a **model-facing contract review**, not just a code review.

1. **Inventory the runtime catalog**
   - Find the canonical MCP entrypoint.
   - Count the registered tools and group them by domain.
   - Note whether descriptions and schemas are composed directly from extension metadata or duplicated manually.
2. **Compare discoverability surfaces**
   - Main README / setup docs
   - Tool-author docs
   - Smoke tests and unit tests
   - Any legacy/compatibility MCP entrypoints that may confuse operators
3. **Classify each gap**
   - runtime-only discoverability
   - code-only schema knowledge
   - stale or partial docs
   - tests covering the wrong MCP surface
4. **Prefer additive rollout fixes**
   - document current tool names and shapes before changing them
   - add inventory/assertion tests before moving entrypoints
   - keep older MCP surfaces as explicit compatibility shims until clients are migrated

## Checklist

- One canonical local MCP server is clearly named in docs
- Tool inventory in docs matches runtime registration
- At least one test validates the canonical server inventory
- Smoke coverage touches every risky/side-effectful domain or explicitly explains omissions
- Legacy MCP surfaces are labeled as compatibility/debug-only

## Test Pattern

- Prefer a focused registry-layer test for discoverability contracts:
  - construct an in-memory `McpServer`
  - call the canonical registration function
  - exercise `tools/list` and `tools/call` handlers directly
- Use this layer to lock:
  - inventory parity between exported metadata and registered tools
  - category filters and per-tool help output
  - example inclusion/suppression behavior
  - read-only vs mutating annotations on representative tools
- Keep stdio smoke tests for boot/wrapper coverage, not as the only guard against metadata drift

## Common Gaps

- Main README names the MCP server but does not enumerate tools or examples.
- Extension README documents only early tools while new tools remain code-only.
- Tests validate helper services or a legacy MCP server, not the canonical aggregator path.
- Smoke tests check registration counts but omit newly added tools, allowing silent discoverability drift.

## Output

A good audit should answer:

1. What can a model/operator infer from docs alone?
2. What still requires reading code or calling listTools?
3. Which improvements are compatibility-safe for current MCP clients?
4. Exactly which docs/tests should update together?
