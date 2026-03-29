import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { unlinkSync } from 'node:fs';

import { Repository } from '../../src/db/repository.js';
import { PipelineEngine } from '../../src/pipeline/engine.js';
import { buildToolCatalogPrompt, executeToolCall, listAvailableTools } from '../../src/agents/local-tools.js';

describe('local tool executor', () => {
  it('filters pipeline tools by alias and read/write policy', async () => {
    const tools = await listAvailableTools({
      enabled: true,
      includePipelineTools: true,
      allowWriteTools: false,
      requestedTools: ['pipeline-read'],
    });

    const names = tools.map((tool) => tool.manifest.name).sort();
    expect(names).toEqual([
      'article_get',
      'article_list',
      'pipeline_drift',
      'pipeline_status',
    ]);
  });

  it('validates arguments before executing a tool', async () => {
    const [tool] = await listAvailableTools({
      enabled: true,
      includePipelineTools: true,
      requestedTools: ['article_get'],
      allowWriteTools: false,
    });

    const result = await executeToolCall(tool, {});
    expect(result.isError).toBe(true);
    expect(result.text).toContain('failed validation');
    expect(result.text).toContain('article_id');
    expect(result.text).toContain('expectedArgs');
    expect(result.text).toContain('required');
  });

  it('includes parameter descriptions in the tool catalog prompt', async () => {
    const [tool] = await listAvailableTools({
      enabled: true,
      includeLocalExtensions: true,
      requestedTools: ['query_team_efficiency'],
      allowWriteTools: false,
    });

    const prompt = buildToolCatalogPrompt([tool]);
    expect(prompt).toContain('query_team_efficiency');
    expect(prompt).toContain('3-letter team abbreviation');
    expect(prompt).toContain('Season year (e.g., 2025)');
    expect(prompt).toContain('team: string');
    expect(prompt).toContain('season: integer');
  });

  it('executes pipeline tools with repository context', async () => {
    const dbPath = join(tmpdir(), `local-tools-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    const repo = new Repository(dbPath);
    const engine = new PipelineEngine(repo);
    repo.createArticle({ id: 'tool-article', title: 'Tool Article' });

    try {
      const [tool] = await listAvailableTools({
        enabled: true,
        includePipelineTools: true,
        requestedTools: ['article_get'],
        allowWriteTools: false,
        context: { repo, engine, surface: 'test-surface', agentName: 'tester' },
      });

      const result = await executeToolCall(tool, { article_id: 'tool-article' }, { repo, engine });
      expect(result.isError).not.toBe(true);
      expect(result.text).toContain('tool-article');
      expect(result.text).toContain('Idea Generation');
    } finally {
      repo.close();
      try { unlinkSync(dbPath); } catch {}
    }
  });
});
