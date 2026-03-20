import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { Repository } from '../../src/db/repository.js';
import { PipelineEngine } from '../../src/pipeline/engine.js';
import { createMCPServer } from '../../src/mcp/server.js';
import type { AppConfig } from '../../src/config/index.js';
import type { Stage } from '../../src/types.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function longText(words: number): string {
  return Array.from({ length: words }, (_, i) => `word${i}`).join(' ');
}

/**
 * Call a tool on the MCP server by directly invoking the request handler.
 */
async function callTool(
  server: Server,
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const handler = (server as any)._requestHandlers?.get(CallToolRequestSchema.shape?.method?.value ?? 'tools/call')
    ?? (server as any)._requestHandlers?.get('tools/call');

  // Use the server's internal dispatch mechanism
  const result = await (server as any).handleRequest(
    { method: 'tools/call', params: { name, arguments: args } },
    {} as any,
  );
  return result as any;
}

// ── Test suite ──────────────────────────────────────────────────────────────

describe('MCP Server', () => {
  let dbPath: string;
  let repo: Repository;
  let engine: PipelineEngine;
  let server: Server;

  const fakeConfig: AppConfig = {
    dataDir: '',
    league: 'nfl',
    leagueConfig: {
      name: 'NFL Lab',
      panelName: 'The NFL Lab Expert Panel',
      dataSource: 'nflverse',
      positions: [],
      substackConfig: {
        labName: 'NFL Lab',
        subscribeCaption: '',
        footerPatterns: [],
      },
    },
    dbPath: '',
    articlesDir: '',
    imagesDir: '',
    chartersDir: '',
    skillsDir: '',
    memoryDbPath: '',
    logsDir: '',
    port: 3456,
    env: 'development',
  };

  beforeEach(() => {
    dbPath = join(tmpdir(), `nfl-mcp-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    repo = new Repository(dbPath);
    engine = new PipelineEngine(repo);
    const cfg = { ...fakeConfig, dbPath };
    server = createMCPServer({ repo, engine, config: cfg });
  });

  afterEach(() => {
    repo.close();
    try { unlinkSync(dbPath); } catch {}
  });

  // ── Wrapper to invoke tool handlers directly ────────────────────────────

  async function invokeTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<{ parsed: any; isError?: boolean }> {
    // Access the request handler registered on the server for tools/call.
    // The Server stores handlers by method string in a Map.
    const handlersMap = (server as any)._requestHandlers as Map<string, Function>;
    const handler = handlersMap?.get('tools/call');
    if (!handler) {
      throw new Error('No tools/call handler registered on server');
    }
    const result = await handler(
      { method: 'tools/call', params: { name, arguments: args } },
      {},
    );
    const text = result?.content?.[0]?.text;
    return {
      parsed: text ? JSON.parse(text) : null,
      isError: result?.isError,
    };
  }

  async function invokeListTools(): Promise<{ tools: any[] }> {
    const handlersMap = (server as any)._requestHandlers as Map<string, Function>;
    const handler = handlersMap?.get('tools/list');
    if (!handler) throw new Error('No tools/list handler registered');
    return handler({ method: 'tools/list', params: {} }, {}) as Promise<any>;
  }

  // ── Server creation ─────────────────────────────────────────────────────

  describe('server creation', () => {
    it('creates a Server instance', () => {
      expect(server).toBeInstanceOf(Server);
    });

    it('registers all expected tools', async () => {
      const result = await invokeListTools();
      const names = result.tools.map((t: any) => t.name).sort();
      expect(names).toEqual([
        'article_advance',
        'article_create',
        'article_get',
        'article_list',
        'pipeline_batch',
        'pipeline_drift',
        'pipeline_status',
      ]);
    });

    it('tools have correct inputSchema types', async () => {
      const result = await invokeListTools();
      for (const tool of result.tools) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
      }
    });

    it('article_create schema requires id and title', async () => {
      const result = await invokeListTools();
      const createTool = result.tools.find((t: any) => t.name === 'article_create');
      expect(createTool.inputSchema.required).toContain('id');
      expect(createTool.inputSchema.required).toContain('title');
    });
  });

  // ── pipeline_status ─────────────────────────────────────────────────────

  describe('pipeline_status', () => {
    it('returns correct format with no articles', async () => {
      const { parsed } = await invokeTool('pipeline_status');
      expect(parsed.total_articles).toBe(0);
      expect(parsed.stage_counts).toBeDefined();
      expect(parsed.ready_to_advance).toEqual([]);
    });

    it('counts articles per stage', async () => {
      repo.createArticle({ id: 'a1', title: 'A1' });
      repo.createArticle({ id: 'a2', title: 'A2' });

      const { parsed } = await invokeTool('pipeline_status');
      expect(parsed.total_articles).toBe(2);
      expect(parsed.stage_counts['1_Idea Generation']).toBe(2);
    });

    it('identifies articles ready to advance', async () => {
      repo.createArticle({ id: 'ready-one', title: 'Ready One' });
      repo.artifacts.put('ready-one', 'idea.md', 'This is an idea.');

      const { parsed } = await invokeTool('pipeline_status');
      const readyIds = parsed.ready_to_advance.map((r: any) => r.id);
      expect(readyIds).toContain('ready-one');
    });
  });

  // ── article_get ─────────────────────────────────────────────────────────

  describe('article_get', () => {
    it('returns article details', async () => {
      repo.createArticle({ id: 'det-1', title: 'Detail Test' });

      const { parsed } = await invokeTool('article_get', { article_id: 'det-1' });
      expect(parsed.article.id).toBe('det-1');
      expect(parsed.article.stage).toBe(1);
      expect(parsed.article.stage_name).toBe('Idea Generation');
      expect(parsed.transitions).toBeDefined();
      expect(parsed.validation).toBeDefined();
    });

    it('returns error for missing article', async () => {
      const { parsed, isError } = await invokeTool('article_get', {
        article_id: 'nonexistent',
      });
      expect(isError).toBe(true);
      expect(parsed.error).toContain('not found');
    });

    it('returns error when article_id is missing', async () => {
      const { parsed, isError } = await invokeTool('article_get', {});
      expect(isError).toBe(true);
      expect(parsed.error).toContain('required');
    });
  });

  // ── article_create ──────────────────────────────────────────────────────

  describe('article_create', () => {
    it('creates an article through MCP', async () => {
      const { parsed, isError } = await invokeTool('article_create', {
        id: 'mcp-idea',
        title: 'MCP Test Idea',
        primary_team: 'seahawks',
      });

      expect(isError).toBeUndefined();
      expect(parsed.created).toBe(true);
      expect(parsed.article.id).toBe('mcp-idea');
      expect(parsed.article.stage).toBe(1);

      // Verify it's in the DB
      const dbArticle = repo.getArticle('mcp-idea');
      expect(dbArticle).toBeDefined();
      expect(dbArticle!.title).toBe('MCP Test Idea');
      expect(dbArticle!.primary_team).toBe('seahawks');
    });

    it('returns error for missing required fields', async () => {
      const { parsed, isError } = await invokeTool('article_create', {
        id: 'no-title',
      });
      expect(isError).toBe(true);
      expect(parsed.error).toContain('required');
    });

    it('returns error for duplicate id', async () => {
      repo.createArticle({ id: 'existing', title: 'Existing' });

      const { parsed, isError } = await invokeTool('article_create', {
        id: 'existing',
        title: 'Duplicate',
      });
      expect(isError).toBe(true);
      expect(parsed.error).toContain('already exists');
    });
  });

  // ── article_advance ─────────────────────────────────────────────────────

  describe('article_advance', () => {
    it('advances article when guard passes', async () => {
      repo.createArticle({ id: 'adv-1', title: 'Advance Test' });
      repo.artifacts.put('adv-1', 'idea.md', 'A valid idea for testing.');

      const { parsed, isError } = await invokeTool('article_advance', {
        article_id: 'adv-1',
      });

      expect(isError).toBeUndefined();
      expect(parsed.advanced).toBe(true);
      expect(parsed.from_stage).toBe(1);
      expect(parsed.to_stage).toBe(2);

      const updated = repo.getArticle('adv-1');
      expect(updated!.current_stage).toBe(2);
    });

    it('returns error when guard fails', async () => {
      repo.createArticle({ id: 'no-idea', title: 'No Idea' });
      // No idea.md created on disk

      const { parsed, isError } = await invokeTool('article_advance', {
        article_id: 'no-idea',
      });
      expect(isError).toBe(true);
      expect(parsed.error).toContain('Cannot advance');
    });

    it('returns error for missing article', async () => {
      const { parsed, isError } = await invokeTool('article_advance', {
        article_id: 'ghost',
      });
      expect(isError).toBe(true);
      expect(parsed.error).toContain('not found');
    });

    it('uses custom agent name when provided', async () => {
      repo.createArticle({ id: 'agnt', title: 'Agent Test' });
      repo.artifacts.put('agnt', 'idea.md', 'An idea.');

      await invokeTool('article_advance', {
        article_id: 'agnt',
        agent: 'test-agent',
      });

      const transitions = repo.getStageTransitions('agnt');
      const lastTransition = transitions[transitions.length - 1];
      expect(lastTransition.agent).toBe('test-agent');
    });
  });

  // ── article_list ────────────────────────────────────────────────────────

  describe('article_list', () => {
    it('lists all articles', async () => {
      repo.createArticle({ id: 'l1', title: 'L1' });
      repo.createArticle({ id: 'l2', title: 'L2' });

      const { parsed } = await invokeTool('article_list');
      expect(parsed.count).toBe(2);
      expect(parsed.articles).toHaveLength(2);
    });

    it('filters by stage', async () => {
      repo.createArticle({ id: 'f1', title: 'F1' });
      repo.createArticle({ id: 'f2', title: 'F2' });
      // Advance f1 to stage 2
      repo.artifacts.put('f1', 'idea.md', 'Idea content');
      engine.advance('f1', 1 as Stage);

      const { parsed } = await invokeTool('article_list', { stage: 2 });
      expect(parsed.count).toBe(1);
      expect(parsed.articles[0].id).toBe('f1');
    });

    it('respects limit', async () => {
      for (let i = 0; i < 5; i++) {
        repo.createArticle({ id: `lim-${i}`, title: `Limit ${i}` });
      }

      const { parsed } = await invokeTool('article_list', { limit: 3 });
      expect(parsed.count).toBe(3);
    });
  });

  // ── pipeline_batch ──────────────────────────────────────────────────────

  describe('pipeline_batch', () => {
    it('reports eligible articles in dry-run mode', async () => {
      repo.createArticle({ id: 'b1', title: 'Batch 1' });
      repo.createArticle({ id: 'b2', title: 'Batch 2' });
      repo.artifacts.put('b1', 'idea.md', 'Idea 1');
      // b2 has no idea.md

      const { parsed } = await invokeTool('pipeline_batch', { stage: 1 });
      expect(parsed.total).toBe(2);
      expect(parsed.eligible).toBe(1);
      expect(parsed.executed).toBe(false);

      // b1 should still be at stage 1 (dry run)
      expect(repo.getArticle('b1')!.current_stage).toBe(1);
    });

    it('advances eligible articles when execute=true', async () => {
      repo.createArticle({ id: 'bx1', title: 'Batch Exec 1' });
      repo.artifacts.put('bx1', 'idea.md', 'Idea content');

      const { parsed } = await invokeTool('pipeline_batch', {
        stage: 1,
        execute: true,
      });
      expect(parsed.eligible).toBe(1);
      expect(parsed.executed).toBe(true);
      expect(parsed.results[0].advanced).toBe(true);

      expect(repo.getArticle('bx1')!.current_stage).toBe(2);
    });
  });

  // ── pipeline_drift ──────────────────────────────────────────────────────

  describe('pipeline_drift', () => {
    it('detects missing artifacts', async () => {
      repo.createArticle({ id: 'd1', title: 'Drift Test' });
      // Manually advance in DB to stage 3 (bypassing guards for drift test)
      repo.advanceStage('d1', 1, 2, 'test');
      repo.advanceStage('d1', 2, 3, 'test');
      // Create article dir but with missing artifacts
      repo.artifacts.put('d1', 'idea.md', 'An idea');

      const { parsed } = await invokeTool('pipeline_drift', {
        article_id: 'd1',
      });
      expect(parsed.drift_count).toBe(1);
      expect(parsed.items[0].missing_artifacts).toContain('discussion-prompt.md');
    });

    it('reports no drift when artifacts match', async () => {
      repo.createArticle({ id: 'ok1', title: 'OK' });
      // Stage 1 has no expected artifacts in the map
      const { parsed } = await invokeTool('pipeline_drift', {
        article_id: 'ok1',
      });
      expect(parsed.drift_count).toBe(0);
    });

    it('checks all articles when no article_id given', async () => {
      repo.createArticle({ id: 'all1', title: 'All 1' });
      repo.createArticle({ id: 'all2', title: 'All 2' });

      const { parsed } = await invokeTool('pipeline_drift');
      expect(parsed.checked).toBe(2);
    });

    it('returns error for nonexistent article', async () => {
      const { parsed, isError } = await invokeTool('pipeline_drift', {
        article_id: 'nope',
      });
      expect(isError).toBe(true);
      expect(parsed.error).toContain('not found');
    });
  });

  // ── unknown tool ────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns error for unknown tool name', async () => {
      const { parsed, isError } = await invokeTool('nonexistent_tool');
      expect(isError).toBe(true);
      expect(parsed.error).toContain('Unknown tool');
    });
  });
});
