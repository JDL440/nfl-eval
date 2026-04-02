import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Article, Stage } from '../types.js';
import { STAGE_NAMES, VALID_STAGES } from '../types.js';
import {
  autoAdvanceArticle,
  getRepeatedBlockerEscalationReadModel,
} from '../pipeline/actions.js';
import type { ToolDefinition, ToolExecutionContext } from './catalog-types.js';

function textResult(data: unknown) {
  return { text: JSON.stringify(data, null, 2) };
}

function errorResult(message: string) {
  return { text: JSON.stringify({ error: message }), isError: true };
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

const EXPECTED_ARTIFACTS: Record<number, string[]> = {
  2: ['idea.md'],
  3: ['idea.md', 'discussion-prompt.md'],
  4: ['idea.md', 'discussion-prompt.md', 'panel-composition.md', 'discussion-summary.md', 'article-contract.md'],
  5: ['idea.md', 'discussion-prompt.md', 'panel-composition.md', 'discussion-summary.md', 'article-contract.md'],
  6: ['idea.md', 'discussion-prompt.md', 'panel-composition.md', 'discussion-summary.md', 'article-contract.md', 'draft.md'],
  7: ['idea.md', 'discussion-prompt.md', 'panel-composition.md', 'discussion-summary.md', 'article-contract.md', 'draft.md'],
  8: ['idea.md', 'discussion-prompt.md', 'panel-composition.md', 'discussion-summary.md', 'article-contract.md', 'draft.md'],
};

function requireRepo(context: ToolExecutionContext) {
  if (!context.repo) throw new Error('Tool execution requires repository context');
  return context.repo;
}

function requireEngine(context: ToolExecutionContext) {
  if (!context.engine) throw new Error('Tool execution requires pipeline engine context');
  return context.engine;
}

function requireConfig(context: ToolExecutionContext) {
  if (!context.config) throw new Error('Tool execution requires app config context');
  return context.config;
}

export const PIPELINE_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    manifest: {
      name: 'pipeline_status',
      description: 'Get pipeline summary: article counts per stage, list of articles ready to advance.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
    source: 'pipeline',
    aliases: ['pipeline', 'pipeline-read', 'pipeline-status'],
    safety: { readOnly: true, writesState: false, externalSideEffects: false },
    handler: async (_args, context) => {
      const repo = requireRepo(context);
      const engine = requireEngine(context);
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
          ready.push({ id: a.id, title: a.title, stage: a.current_stage, nextAction: act.action });
        }
      }
      return textResult({ total_articles: all.length, stage_counts: stageCounts, ready_to_advance: ready });
    },
  },
  {
    manifest: {
      name: 'article_get',
      description: 'Get full details for a single article by ID, including stage history and validation.',
      parameters: {
        type: 'object',
        properties: { article_id: { type: 'string', description: 'Article slug / ID' } },
        required: ['article_id'],
      },
    },
    source: 'pipeline',
    aliases: ['pipeline', 'pipeline-read', 'article'],
    safety: { readOnly: true, writesState: false, externalSideEffects: false },
    handler: async (args, context) => {
      const repo = requireRepo(context);
      const engine = requireEngine(context);
      const articleId = args['article_id'];
      if (typeof articleId !== 'string' || !articleId) return errorResult('article_id is required');
      const article = repo.getArticle(articleId);
      if (!article) return errorResult(`Article '${articleId}' not found`);
      return textResult({
        article: summariseArticle(article),
        full: article,
        transitions: repo.getStageTransitions(articleId),
        validation: engine.validateArticle(articleId),
        available_actions: engine.getAvailableActions(articleId).map((a) => a.action),
        repeated_blocker_escalation: getRepeatedBlockerEscalationReadModel(repo, articleId),
      });
    },
  },
  {
    manifest: {
      name: 'article_create',
      description: 'Create a new article (idea submission). Returns the created article.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Slug-style article ID (e.g. "mahomes-deep-dive")' },
          title: { type: 'string', description: 'Article headline' },
          primary_team: { type: 'string', description: 'Primary team (optional)' },
          league: { type: 'string', description: 'League code, defaults to "nfl"' },
          depth_level: { type: 'number', description: 'Legacy depth 1–4, kept for compatibility during editorial-controls migration' },
          preset_id: { type: 'string', description: 'Editorial preset ID (optional)' },
          reader_profile: { type: 'string', description: 'Reader profile override: casual, engaged, hardcore' },
          article_form: { type: 'string', description: 'Article form override: brief, standard, deep, feature' },
          panel_shape: { type: 'string', description: 'Panel shape override: auto, news_reaction, contract_eval, trade_eval, draft_eval, scheme_breakdown, cohort_rank, market_map' },
          analytics_mode: { type: 'string', description: 'Analytics mode override: explain_only, normal, metrics_forward' },
          panel_constraints_json: { type: 'string', description: 'Optional JSON overrides for panel min/max, required agents, exclusions, or scope' },
        },
        required: ['id', 'title'],
      },
    },
    source: 'pipeline',
    aliases: ['pipeline', 'pipeline-write', 'article-write'],
    safety: { readOnly: false, writesState: true, externalSideEffects: false },
    handler: async (args, context) => {
      const repo = requireRepo(context);
      const id = args['id'];
      const title = args['title'];
      if (typeof id !== 'string' || !id || typeof title !== 'string' || !title) {
        return errorResult('id and title are required');
      }
      const created = repo.createArticle({
        id,
        title,
        primary_team: typeof args['primary_team'] === 'string' ? args['primary_team'] : undefined,
        league: typeof args['league'] === 'string' ? args['league'] : undefined,
        depth_level: typeof args['depth_level'] === 'number' ? args['depth_level'] : undefined,
        preset_id: typeof args['preset_id'] === 'string' ? args['preset_id'] as any : undefined,
        reader_profile: typeof args['reader_profile'] === 'string' ? args['reader_profile'] as any : undefined,
        article_form: typeof args['article_form'] === 'string' ? args['article_form'] as any : undefined,
        panel_shape: typeof args['panel_shape'] === 'string' ? args['panel_shape'] as any : undefined,
        analytics_mode: typeof args['analytics_mode'] === 'string' ? args['analytics_mode'] as any : undefined,
        panel_constraints_json: typeof args['panel_constraints_json'] === 'string' ? args['panel_constraints_json'] : undefined,
      });
      return textResult({ created: true, article: summariseArticle(created) });
    },
  },
  {
    manifest: {
      name: 'article_advance',
      description: 'Advance an article to the next pipeline stage. Validates guard conditions first.',
      parameters: {
        type: 'object',
        properties: {
          article_id: { type: 'string', description: 'Article slug / ID' },
          agent: { type: 'string', description: 'Agent name performing the advance (default: "mcp")' },
        },
        required: ['article_id'],
      },
    },
    source: 'pipeline',
    aliases: ['pipeline', 'pipeline-write', 'article-write'],
    safety: { readOnly: false, writesState: true, externalSideEffects: false },
    handler: async (args, context) => {
      const repo = requireRepo(context);
      const engine = requireEngine(context);
      const articleId = args['article_id'];
      if (typeof articleId !== 'string' || !articleId) return errorResult('article_id is required');
      const article = repo.getArticle(articleId);
      if (!article) return errorResult(`Article '${articleId}' not found`);
      if (context.actionContext) {
        const fromStage = article.current_stage;
        const result = await autoAdvanceArticle(articleId, context.actionContext, {
          maxStage: Math.min(fromStage + 1, 7) as Stage,
        });
        if (result.error) {
          return errorResult(`Cannot advance '${articleId}' from stage ${fromStage} (${STAGE_NAMES[fromStage]}): ${result.error}`);
        }
        const updated = repo.getArticle(articleId);
        return textResult({
          advanced: true,
          article_id: articleId,
          from_stage: fromStage,
          to_stage: updated?.current_stage ?? fromStage,
          from_name: STAGE_NAMES[fromStage],
          to_name: STAGE_NAMES[(updated?.current_stage ?? fromStage) as Stage],
          steps: result.steps,
          revisionCount: result.revisionCount,
        });
      }
      const fromStage = article.current_stage;
      const check = engine.canAdvance(articleId, fromStage);
      if (!check.allowed) {
        return errorResult(`Cannot advance '${articleId}' from stage ${fromStage} (${STAGE_NAMES[fromStage]}): ${check.reason}`);
      }
      const agent = typeof args['agent'] === 'string' ? args['agent'] : 'mcp';
      const newStage = engine.advance(articleId, fromStage, agent);
      return textResult({
        advanced: true,
        article_id: articleId,
        from_stage: fromStage,
        to_stage: newStage,
        from_name: STAGE_NAMES[fromStage],
        to_name: STAGE_NAMES[newStage],
      });
    },
  },
  {
    manifest: {
      name: 'article_list',
      description: 'List articles with optional stage/status filters.',
      parameters: {
        type: 'object',
        properties: {
          stage: { type: 'number', description: 'Filter by pipeline stage (1–8)' },
          status: { type: 'string', description: 'Filter by status: proposed, approved, in_production, in_discussion, published, archived' },
          limit: { type: 'number', description: 'Max results (default: 50)' },
        },
        required: [],
      },
    },
    source: 'pipeline',
    aliases: ['pipeline', 'pipeline-read', 'article'],
    safety: { readOnly: true, writesState: false, externalSideEffects: false },
    handler: async (args, context) => {
      const repo = requireRepo(context);
      const filters: { stage?: number; status?: string; limit?: number } = {};
      if (typeof args['stage'] === 'number') filters.stage = args['stage'];
      if (typeof args['status'] === 'string') filters.status = args['status'];
      filters.limit = typeof args['limit'] === 'number' ? args['limit'] : 50;
      const articles = repo.listArticles(filters);
      return textResult({ count: articles.length, articles: articles.map(summariseArticle) });
    },
  },
  {
    manifest: {
      name: 'pipeline_batch',
      description: 'Check which articles at a given stage can advance and optionally advance them all.',
      parameters: {
        type: 'object',
        properties: {
          stage: { type: 'number', description: 'Pipeline stage to batch-check (1–7)' },
          execute: { type: 'boolean', description: 'If true, actually advance eligible articles (default: false — dry run)' },
        },
        required: ['stage'],
      },
    },
    source: 'pipeline',
    aliases: ['pipeline', 'pipeline-write'],
    safety: { readOnly: false, writesState: true, externalSideEffects: false },
    handler: async (args, context) => {
      const repo = requireRepo(context);
      const engine = requireEngine(context);
      const stage = args['stage'];
      if (typeof stage !== 'number') return errorResult('stage is required');
      const execute = args['execute'] === true;
      const candidates = repo.listArticles({ stage });
      const results: Array<{ id: string; title: string; canAdvance: boolean; reason: string; advanced?: boolean }> = [];
      for (const article of candidates) {
        const check = engine.canAdvance(article.id, article.current_stage);
        const entry: (typeof results)[number] = {
          id: article.id,
          title: article.title,
          canAdvance: check.allowed,
          reason: check.reason,
        };
        if (execute && check.allowed) {
          engine.advance(article.id, article.current_stage, 'mcp-batch');
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
    },
  },
  {
    manifest: {
      name: 'pipeline_drift',
      description: 'Check for drift between pipeline DB state and on-disk artifacts for one or all articles.',
      parameters: {
        type: 'object',
        properties: {
          article_id: { type: 'string', description: 'Article ID to check. If omitted, checks all articles.' },
        },
        required: [],
      },
    },
    source: 'pipeline',
    aliases: ['pipeline', 'pipeline-read'],
    safety: { readOnly: true, writesState: false, externalSideEffects: false },
    handler: async (args, context) => {
      const repo = requireRepo(context);
      const config = requireConfig(context);
      const requestedArticleId = typeof args['article_id'] === 'string' ? args['article_id'] : undefined;
      const articlesToCheck = requestedArticleId
        ? [repo.getArticle(requestedArticleId)].filter(Boolean) as Article[]
        : repo.getAllArticles();
      if (requestedArticleId && articlesToCheck.length === 0) {
        return errorResult(`Article '${requestedArticleId}' not found`);
      }
      const driftItems: Array<{ id: string; stage: number; missing_artifacts: string[]; has_drift: boolean }> = [];
      for (const article of articlesToCheck) {
        const expected = EXPECTED_ARTIFACTS[article.current_stage] ?? [];
        const dir = join(config.articlesDir, article.id);
        const missing = expected.filter((artifact) => !existsSync(join(dir, artifact)));
        if (missing.length > 0) {
          driftItems.push({ id: article.id, stage: article.current_stage, missing_artifacts: missing, has_drift: true });
        }
      }
      return textResult({ checked: articlesToCheck.length, drift_count: driftItems.length, items: driftItems });
    },
  },
];

export function getPipelineToolDefinitions(): ToolDefinition[] {
  return PIPELINE_TOOL_DEFINITIONS;
}
