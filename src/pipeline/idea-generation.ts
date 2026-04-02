import type { AppConfig } from '../config/index.js';
import type { Repository } from '../db/repository.js';
import { parseStructuredJson } from '../llm/gateway.js';
import { buildTeamRosterContext } from './roster-context.js';
import { getLeagueDataTool, type ActionContext } from './actions.js';
import {
  ARTICLE_FORM_LABELS,
  ANALYTICS_MODE_LABELS,
  formatPresetLabel,
  PANEL_SHAPE_LABELS,
  READER_PROFILE_LABELS,
  resolveEditorialControls,
  type AnalyticsMode,
  type ArticleForm,
  type EditorialPresetId,
  type PanelShape,
  type ReaderProfile,
} from '../types.js';
import {
  extractTitleFromIdea,
  generateSlug,
  IDEA_TEMPLATE,
} from '../dashboard/views/new-idea.js';

export const IDEA_DEPTH_LABELS: Record<number, string> = {
  1: '1 — Casual Fan (~800 words, 2 agents)',
  2: '2 — The Beat (~1500 words, 3 agents)',
  3: '3 — Deep Dive (~2500 words, 4-5 agents)',
  4: '4 — Feature (~4000 words)',
};

export interface CreateIdeaArticleParams {
  repo: Repository;
  config: AppConfig;
  actionContext?: ActionContext;
  prompt: string;
  teams: string[];
  depthLevel: number;
  presetId?: EditorialPresetId;
  readerProfile?: ReaderProfile;
  articleForm?: ArticleForm;
  panelShape?: PanelShape;
  analyticsMode?: AnalyticsMode;
  panelConstraintsJson?: string | null;
  provider?: string;
  pinnedAgents?: string[];
  surface?: string;
  actor?: string;
}

export interface CreateIdeaArticleResult {
  id: string;
  title: string;
  stage: number;
  ideaContent: string;
  traceId: string | null;
}

export class IdeaArticleCreationError extends Error {
  traceId: string | null;
  traceUrl: string | null;

  constructor(message: string, traceId: string | null = null, traceUrl: string | null = null) {
    super(message);
    this.name = 'IdeaArticleCreationError';
    this.traceId = traceId;
    this.traceUrl = traceUrl;
  }
}

export interface ScheduledStoryCandidate {
  title: string;
  angle: string;
  whyNow: string;
  score: number;
  prompt: string;
  evidence: Array<{ url: string; note?: string }>;
}

export interface ScheduledStoryDiscovery {
  candidates: ScheduledStoryCandidate[];
  selectedIndex?: number;
  selectionReason?: string;
}

function generateTitleAndSlug(prompt: string): { title: string; slug: string } {
  const firstLine = prompt.split(/[.\n]/)[0].trim();
  const title = firstLine.length <= 80
    ? firstLine
    : firstLine.slice(0, 77).replace(/\s+\S*$/, '') + '...';
  return {
    title,
    slug: title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60)
      .replace(/-$/, ''),
  };
}

function normalizeDepthLevel(value: number): number {
  return [1, 2, 3, 4].includes(value) ? value : 2;
}

function buildTeamContext(teams: string[], config: AppConfig): string {
  return teams.length > 0
    ? teams.map((abbr) => {
        const team = (config.teams ?? []).find((entry) => entry.abbr === abbr);
        return team ? `${team.abbr} — ${team.city} ${team.name}` : abbr;
      }).join(', ')
    : 'No specific team';
}

function buildIdeaTask(
  prompt: string,
  teams: string[],
  depthLevel: number,
  config: AppConfig,
  editorial: ReturnType<typeof resolveEditorialControls>,
): string {
  const panelConstraintNotes: string[] = [];
  if (editorial.panel_constraints?.min_agents != null || editorial.panel_constraints?.max_agents != null) {
    const minAgents = editorial.panel_constraints.min_agents ?? editorial.panel_constraints.max_agents;
    const maxAgents = editorial.panel_constraints.max_agents ?? editorial.panel_constraints.min_agents;
    panelConstraintNotes.push(`Panel constraints: ${minAgents}${minAgents === maxAgents ? '' : `-${maxAgents}`} agents`);
  }
  if (editorial.panel_constraints?.required_agents?.length) {
    panelConstraintNotes.push(`Required downstream agents: ${editorial.panel_constraints.required_agents.join(', ')}`);
  }
  if (editorial.panel_constraints?.excluded_agents?.length) {
    panelConstraintNotes.push(`Excluded downstream agents: ${editorial.panel_constraints.excluded_agents.join(', ')}`);
  }
  if (editorial.panel_constraints?.scope_mode) {
    panelConstraintNotes.push(`Discussion scope: ${editorial.panel_constraints.scope_mode}`);
  }
  if (editorial.panel_constraints?.allow_team_agent_omission) {
    panelConstraintNotes.push('Team-agent omission is allowed when the article scope is cross-team or cohort-based.');
  }
  return [
    'Generate a structured article idea from the following prompt.',
    `\nTeam context: ${buildTeamContext(teams, config)}`,
    `Editorial preset: ${formatPresetLabel(editorial.preset_id)}`,
    `Reader profile: ${READER_PROFILE_LABELS[editorial.reader_profile]}`,
    `Article form: ${ARTICLE_FORM_LABELS[editorial.article_form]} (legacy depth ${depthLevel})`,
    `Panel shape: ${PANEL_SHAPE_LABELS[editorial.panel_shape]}`,
    `Analytics mode: ${ANALYTICS_MODE_LABELS[editorial.analytics_mode]}`,
    ...panelConstraintNotes,
    'Treat article form and reader profile as editorial targets. Do not treat them as a panel-size command unless panel shape or explicit constraints require it.',
    editorial.article_form === 'feature'
      ? 'Feature means a longer-form narrative structure; it does not automatically require the biggest or most technical panel.'
      : null,
    '\nUse this output template:\n',
    IDEA_TEMPLATE,
    '\nFill in every section with specific, actionable content. The Working Title should be clickbait-adjacent but honest, 60-80 characters.',
    editorial.analytics_mode === 'explain_only'
      ? 'Keep advanced analytics light and explain any metric in plain language for casual readers.'
      : editorial.analytics_mode === 'metrics_forward'
        ? 'Use stronger analytical evidence and be comfortable foregrounding metrics when they sharpen the argument.'
        : 'Use analytics to support the angle, but keep the prose readable for engaged fans.',
    `\nUser prompt: ${prompt}`,
  ].join('\n');
}

export async function createIdeaArticle(params: CreateIdeaArticleParams): Promise<CreateIdeaArticleResult> {
  const {
    repo,
    config,
    actionContext,
    pinnedAgents = [],
    surface = 'ideaGeneration',
    actor = 'ideaGeneration',
  } = params;
  const prompt = params.prompt.trim();
  const teams = params.teams.map((team) => team.trim()).filter(Boolean);
  const editorial = resolveEditorialControls({
    preset_id: params.presetId,
    reader_profile: params.readerProfile,
    article_form: params.articleForm,
    panel_shape: params.panelShape,
    analytics_mode: params.analyticsMode,
    panel_constraints_json: params.panelConstraintsJson ?? null,
    depth_level: params.depthLevel,
  });
  const depthLevel = normalizeDepthLevel(editorial.legacy_depth_level);
  const requestedProvider = params.provider?.trim() ?? '';

  if (!prompt) {
    throw new IdeaArticleCreationError('prompt is required');
  }

  if (requestedProvider && actionContext && !actionContext.runner.gateway.getProvider(requestedProvider)) {
    throw new IdeaArticleCreationError(`Unknown provider: ${requestedProvider}`);
  }

  let ideaTraceId: string | null = null;

  try {
    let ideaContent: string;
    let title: string;
    let ideaThinking: string | null = null;
    let ideaModel = '';
    let ideaAgent = '';
    let ideaProvider = '';
    let ideaTokensUsed: { prompt: number; completion: number } | undefined;

    if (actionContext) {
      const rosterCtx = teams.length > 0
        ? buildTeamRosterContext(teams[0], config.league, config.scriptsDir)
        : null;

      const result = await actionContext.runner.run({
        agentName: 'lead',
        provider: requestedProvider || undefined,
        task: buildIdeaTask(prompt, teams, depthLevel, config, editorial),
        skills: ['idea-generation'],
        rosterContext: rosterCtx ?? undefined,
        toolCalling: {
          enabled: true,
          includeLocalExtensions: true,
          includeWebSearch: true,
          allowWriteTools: false,
          requestedTools: [getLeagueDataTool(config.league), 'prediction-markets', 'web_search'],
          maxToolCalls: 50,
          context: {
            repo,
            engine: actionContext.engine,
            config,
            actionContext,
            stage: 1,
            surface,
            agentName: 'lead',
          },
        },
        trace: {
          repo,
          stage: 1,
          surface,
        },
      });

      ideaContent = result.content;
      title = extractTitleFromIdea(ideaContent);
      ideaThinking = result.thinking;
      ideaModel = result.model;
      ideaAgent = result.agentName;
      ideaProvider = result.provider;
      ideaTokensUsed = result.tokensUsed;
      ideaTraceId = result.traceId ?? null;
    } else {
      const generated = generateTitleAndSlug(prompt);
      title = generated.title;
      ideaContent = `# Article Idea: ${title}\n\n## Working Title\n${title}\n\n## Angle / Tension\n${prompt}`;
    }

    let slug = generateSlug(title);
    if (!slug) slug = generateSlug(prompt);
    if (!slug) slug = `idea-${Date.now().toString(36)}`;
    if (repo.getArticle(slug)) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    repo.createArticle({
      id: slug,
      title,
      llm_provider: requestedProvider || undefined,
      primary_team: teams[0] ?? undefined,
      league: config.league,
      depth_level: depthLevel,
      preset_id: editorial.preset_id,
      reader_profile: editorial.reader_profile,
      article_form: editorial.article_form,
      panel_shape: editorial.panel_shape,
      analytics_mode: editorial.analytics_mode,
      panel_constraints_json: editorial.panel_constraints_json,
    });

    const ideaStageRunId = repo.startStageRun({
      articleId: slug,
      stage: 1,
      surface,
      actor,
      requestedModel: ideaModel || null,
    });

    for (const agentName of pinnedAgents) {
      repo.pinAgent(slug, agentName);
    }

    repo.artifacts.put(slug, 'idea.md', ideaContent);
    if (ideaThinking) {
      const header = `# Thinking Trace\n\n**Agent:** ${ideaAgent}  \n**Model:** ${ideaModel}  \n**Artifact:** idea.md\n\n---\n\n`;
      repo.artifacts.put(slug, 'idea.thinking.md', header + ideaThinking);
    }

    if (ideaTokensUsed) {
      repo.recordUsageEvent({
        articleId: slug,
        stage: 1,
        surface: 'ideaGeneration',
        stageRunId: ideaStageRunId,
        provider: ideaProvider,
        modelOrTool: ideaModel,
        eventType: 'completed',
        promptTokens: ideaTokensUsed.prompt,
        outputTokens: ideaTokensUsed.completion,
      });
    }

    if (ideaTraceId) {
      repo.attachLlmTrace(ideaTraceId, {
        articleId: slug,
        stage: 1,
        surface,
        stageRunId: ideaStageRunId,
      });
    }

    repo.finishStageRun(ideaStageRunId, 'completed');

    return {
      id: slug,
      title,
      stage: 1,
      ideaContent,
      traceId: ideaTraceId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const traceId = ideaTraceId
      ?? (err instanceof Error && typeof (err as Error & { traceId?: unknown }).traceId === 'string'
        ? (err as Error & { traceId?: string }).traceId ?? null
        : null);
    const traceUrl = traceId
      ? (err instanceof Error && typeof (err as Error & { traceUrl?: unknown }).traceUrl === 'string'
        ? (err as Error & { traceUrl?: string }).traceUrl ?? `/traces/${traceId}`
        : `/traces/${traceId}`)
      : null;
    throw new IdeaArticleCreationError(message, traceId, traceUrl);
  }
}

function coerceCandidate(value: unknown): ScheduledStoryCandidate | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
  const angle = typeof candidate.angle === 'string' ? candidate.angle.trim() : '';
  const whyNow = typeof candidate.whyNow === 'string' ? candidate.whyNow.trim() : '';
  const prompt = typeof candidate.prompt === 'string' ? candidate.prompt.trim() : '';
  const scoreRaw = candidate.score;
  const score = typeof scoreRaw === 'number'
    ? scoreRaw
    : typeof scoreRaw === 'string'
      ? Number(scoreRaw)
      : NaN;
  if (!title || !angle || !whyNow || !prompt || !Number.isFinite(score)) {
    return null;
  }
  const evidence = Array.isArray(candidate.evidence)
    ? candidate.evidence.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
        const record = entry as Record<string, unknown>;
        const url = typeof record.url === 'string' ? record.url.trim() : '';
        if (!url) return [];
        const note = typeof record.note === 'string' && record.note.trim() ? record.note.trim() : undefined;
        return [{ url, note }];
      })
    : [];
  return { title, angle, whyNow, prompt, score, evidence };
}

export function parseScheduledStoryDiscovery(raw: string): ScheduledStoryDiscovery {
  const parsed = parseStructuredJson(raw) as Record<string, unknown>;
  const rawCandidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];
  const candidates = rawCandidates.flatMap((candidate) => {
    const normalized = coerceCandidate(candidate);
    return normalized ? [normalized] : [];
  });
  if (candidates.length === 0) {
    throw new Error('Scheduled discovery returned no valid candidates');
  }
  const selectedIndex = typeof parsed.selectedIndex === 'number' ? parsed.selectedIndex : undefined;
  const selectionReason = typeof parsed.selectionReason === 'string' ? parsed.selectionReason.trim() : undefined;
  return { candidates, selectedIndex, selectionReason };
}
