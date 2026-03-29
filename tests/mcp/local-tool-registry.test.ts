import { describe, it, expect } from 'vitest';

describe('local tool registry', () => {
  it('exports the approved read-only tool allowlist', async () => {
    const registry = await import('../../mcp/tool-registry.mjs');
    expect(registry.SAFE_READ_ONLY_TOOL_NAMES).toContain('local_tool_catalog');
    expect(registry.SAFE_READ_ONLY_TOOL_NAMES).toContain('query_prediction_markets');
    expect(registry.SAFE_READ_ONLY_TOOL_NAMES).not.toContain('publish_to_substack');
    expect(registry.BLOCKED_TOOL_NAMES).toContain('publish_to_substack');
  });

  it('includes local_tool_catalog plus query tools in the local registry', async () => {
    const registry = await import('../../mcp/tool-registry.mjs');
    const entries = registry.getLocalToolEntries();
    const names = entries.map((entry: { name: string }) => entry.name);
    expect(names).toContain('local_tool_catalog');
    expect(names).toContain('query_player_stats');
    expect(names).toContain('refresh_nflverse_cache');
  });

  it('defaults local_tool_catalog to the safe read-only subset', async () => {
    const registry = await import('../../mcp/tool-registry.mjs');
    const entry = registry.getLocalToolEntries().find((candidate: { name: string }) => candidate.name === 'local_tool_catalog');
    const result = await entry.handler({});
    const rendered = registry.renderToolResultText(result);
    expect(rendered.text).toContain('query_player_stats');
    expect(rendered.text).not.toContain('publish_to_substack');
    expect(rendered.text).not.toContain('refresh_nflverse_cache');
  });
});
