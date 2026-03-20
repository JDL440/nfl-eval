/**
 * MCP Server — v2 pipeline tools over Model Context Protocol.
 *
 * Exposes pipeline operations (status, create, advance, list, drift)
 * as MCP tools that call the v2 PipelineEngine and Repository directly.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type {
  CallToolRequest,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import type { Repository } from '../db/repository.js';
import type { PipelineEngine } from '../pipeline/engine.js';
import type { AppConfig } from '../config/index.js';
import { STAGE_NAMES, VALID_STAGES } from '../types.js';
import type { Article, Stage } from '../types.js';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ── Tool definitions ────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: 'pipeline_status',
    description:
      'Get pipeline summary: article counts per stage, list of articles ready to advance.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'article_get',
    description:
      'Get full details for a single article by ID, including stage history and validation.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        article_id: { type: 'string', description: 'Article slug / ID' },
      },
      required: ['article_id'],
    },
  },
  {
    name: 'article_create',
    description:
      'Create a new article (idea submission). Returns the created article.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'Slug-style article ID (e.g. "mahomes-deep-dive")',
        },
        title: { type: 'string', description: 'Article headline' },
        primary_team: {
          type: 'string',
          description: 'Primary team (optional)',
        },
        league: {
          type: 'string',
          description: 'League code, defaults to "nfl"',
        },
        depth_level: {
          type: 'number',
          description: 'Depth 1–3, defaults to 2',
        },
      },
      required: ['id', 'title'],
    },
  },
  {
    name: 'article_advance',
    description:
      'Advance an article to the next pipeline stage. Validates guard conditions first.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        article_id: { type: 'string', description: 'Article slug / ID' },
        agent: {
          type: 'string',
          description: 'Agent name performing the advance (default: "mcp")',
        },
      },
      required: ['article_id'],
    },
  },
  {
    name: 'article_list',
    description:
      'List articles with optional stage/status filters.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        stage: {
          type: 'number',
          description: 'Filter by pipeline stage (1–8)',
        },
        status: {
          type: 'string',
          description:
            'Filter by status: proposed, approved, in_production, in_discussion, published, archived',
        },
        limit: { type: 'number', description: 'Max results (default: 50)' },
      },
      required: [],
    },
  },
  {
    name: 'pipeline_batch',
    description:
      'Check which articles at a given stage can advance and optionally advance them all.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        stage: {
          type: 'number',
          description: 'Pipeline stage to batch-check (1–7)',
        },
        execute: {
          type: 'boolean',
          description: 'If true, actually advance eligible articles (default: false — dry run)',
        },
      },
      required: ['stage'],
    },
  },
  {
    name: 'pipeline_drift',
    description:
      'Check for drift between pipeline DB state and on-disk artifacts for one or all articles.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        article_id: {
          type: 'string',
          description:
            'Article ID to check. If omitted, checks all articles.',
        },
      },
      required: [],
    },
  },
];

// ── Tool-name type guard ────────────────────────────────────────────────────

type ToolName = typeof TOOLS[number]['name'];

// ── Helpers ─────────────────────────────────────────────────────────────────

function textResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

function summariseArticle(a: Article) {
  return {
    id: a.id,
    title: a.title,
    stage: a.current_stage,
    stage_name: STAGE_NAMES[a.current_stage],
    status: a.status,
    primary_team: a.primary_team,
    updated_at: a.updated_at,
  };
}

// ── Artifact expectation per stage ──────────────────────────────────────────

const EXPECTED_ARTIFACTS: Record<number, string[]> = {
  2: ['idea.md'],
  3: ['idea.md', 'discussion-prompt.md'],
  4: ['idea.md', 'discussion-prompt.md', 'panel-composition.md'],
  5: ['idea.md', 'discussion-prompt.md', 'panel-composition.md', 'discussion-summary.md'],
  6: ['idea.md', 'discussion-prompt.md', 'panel-composition.md', 'discussion-summary.md', 'draft.md'],
  7: ['idea.md', 'discussion-prompt.md', 'panel-composition.md', 'discussion-summary.md', 'draft.md'],
  8: ['idea.md', 'discussion-prompt.md', 'panel-composition.md', 'discussion-summary.md', 'draft.md'],
};

// ── Factory ─────────────────────────────────────────────────────────────────

export function createMCPServer(options: {
  repo: Repository;
  engine: PipelineEngine;
  config: AppConfig;
}): Server {
  const { repo, engine, config } = options;

  const server = new Server(
    { name: 'nfl-eval-pipeline', version: '2.0.0' },
    { capabilities: { tools: {} } },
  );

  // ── list_tools handler ──────────────────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // ── call_tool handler ───────────────────────────────────────────────────

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const { name, arguments: args = {} } = request.params;

    try {
      switch (name as ToolName) {
        // ── pipeline_status ───────────────────────────────────────────────
        case 'pipeline_status': {
          const all = repo.getAllArticles();
          const stageCounts: Record<string, number> = {};
          for (const s of VALID_STAGES) {
            stageCounts[`${s}_${STAGE_NAMES[s]}`] = 0;
          }
          for (const a of all) {
            const key = `${a.current_stage}_${STAGE_NAMES[a.current_stage]}`;
            stageCounts[key] = (stageCounts[key] ?? 0) + 1;
          }

          const ready: Array<{ id: string; title: string; stage: number; nextAction: string }> = [];
          for (const a of all) {
            const actions = engine.getAvailableActions(a.id);
            for (const act of actions) {
              ready.push({
                id: a.id,
                title: a.title,
                stage: a.current_stage,
                nextAction: act.action,
              });
            }
          }

          return textResult({
            total_articles: all.length,
            stage_counts: stageCounts,
            ready_to_advance: ready,
          });
        }

        // ── article_get ───────────────────────────────────────────────────
        case 'article_get': {
          const articleId = args.article_id as string;
          if (!articleId) return errorResult('article_id is required');

          const article = repo.getArticle(articleId);
          if (!article) return errorResult(`Article '${articleId}' not found`);

          const transitions = repo.getStageTransitions(articleId);
          const validation = engine.validateArticle(articleId);
          const availableActions = engine.getAvailableActions(articleId);

          return textResult({
            article: summariseArticle(article),
            full: article,
            transitions,
            validation,
            available_actions: availableActions.map((a) => a.action),
          });
        }

        // ── article_create ────────────────────────────────────────────────
        case 'article_create': {
          const id = args.id as string;
          const title = args.title as string;
          if (!id || !title) return errorResult('id and title are required');

          const created = repo.createArticle({
            id,
            title,
            primary_team: (args.primary_team as string) ?? undefined,
            league: (args.league as string) ?? undefined,
            depth_level: (args.depth_level as number) ?? undefined,
          });

          return textResult({
            created: true,
            article: summariseArticle(created),
          });
        }

        // ── article_advance ───────────────────────────────────────────────
        case 'article_advance': {
          const articleId = args.article_id as string;
          if (!articleId) return errorResult('article_id is required');

          const article = repo.getArticle(articleId);
          if (!article) return errorResult(`Article '${articleId}' not found`);

          const fromStage = article.current_stage;
          const check = engine.canAdvance(articleId, fromStage);
          if (!check.allowed) {
            return errorResult(
              `Cannot advance '${articleId}' from stage ${fromStage} ` +
              `(${STAGE_NAMES[fromStage]}): ${check.reason}`,
            );
          }

          const agent = (args.agent as string) ?? 'mcp';
          const newStage = engine.advance(articleId, fromStage, agent);
          return textResult({
            advanced: true,
            article_id: articleId,
            from_stage: fromStage,
            to_stage: newStage,
            from_name: STAGE_NAMES[fromStage],
            to_name: STAGE_NAMES[newStage],
          });
        }

        // ── article_list ──────────────────────────────────────────────────
        case 'article_list': {
          const filters: { stage?: number; status?: string; limit?: number } = {};
          if (args.stage != null) filters.stage = args.stage as number;
          if (args.status != null) filters.status = args.status as string;
          filters.limit = (args.limit as number) ?? 50;

          const articles = repo.listArticles(filters);
          return textResult({
            count: articles.length,
            articles: articles.map(summariseArticle),
          });
        }

        // ── pipeline_batch ────────────────────────────────────────────────
        case 'pipeline_batch': {
          const stage = args.stage as number;
          if (stage == null) return errorResult('stage is required');
          const execute = (args.execute as boolean) ?? false;

          const candidates = repo.listArticles({ stage });
          const results: Array<{
            id: string;
            title: string;
            canAdvance: boolean;
            reason: string;
            advanced?: boolean;
          }> = [];

          for (const a of candidates) {
            const check = engine.canAdvance(a.id, a.current_stage);
            const entry: (typeof results)[number] = {
              id: a.id,
              title: a.title,
              canAdvance: check.allowed,
              reason: check.reason,
            };

            if (execute && check.allowed) {
              engine.advance(a.id, a.current_stage, 'mcp-batch');
              entry.advanced = true;
            }

            results.push(entry);
          }

          return textResult({
            stage,
            stage_name: STAGE_NAMES[stage as Stage] ?? `Unknown (${stage})`,
            total: candidates.length,
            eligible: results.filter((r) => r.canAdvance).length,
            executed: execute,
            results,
          });
        }

        // ── pipeline_drift ────────────────────────────────────────────────
        case 'pipeline_drift': {
          const articleId = args.article_id as string | undefined;
          const articlesToCheck = articleId
            ? [repo.getArticle(articleId)].filter(Boolean) as Article[]
            : repo.getAllArticles();

          if (articleId && articlesToCheck.length === 0) {
            return errorResult(`Article '${articleId}' not found`);
          }

          const driftItems: Array<{
            id: string;
            stage: number;
            missing_artifacts: string[];
            has_drift: boolean;
          }> = [];

          for (const a of articlesToCheck) {
            const expected = EXPECTED_ARTIFACTS[a.current_stage] ?? [];
            const dir = join(config.articlesDir, a.id);
            const missing: string[] = [];

            for (const artifact of expected) {
              if (!existsSync(join(dir, artifact))) {
                missing.push(artifact);
              }
            }

            if (missing.length > 0) {
              driftItems.push({
                id: a.id,
                stage: a.current_stage,
                missing_artifacts: missing,
                has_drift: true,
              });
            }
          }

          return textResult({
            checked: articlesToCheck.length,
            drift_count: driftItems.length,
            items: driftItems,
          });
        }

        default:
          return errorResult(`Unknown tool: ${name}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(message);
    }
  });

  return server;
}

// ── Standalone entry point ──────────────────────────────────────────────────

export async function startMCPServer(config: AppConfig, repo: Repository, engine: PipelineEngine): Promise<void> {
  const server = createMCPServer({ repo, engine, config });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('nfl-eval v2 pipeline MCP server running on stdio');
}
