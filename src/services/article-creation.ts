import type { Repository } from '../db/repository.js';
import type { AppConfig } from '../config/index.js';
import type { ActionContext } from '../pipeline/actions.js';
import { createIdeaArticle } from '../pipeline/idea-generation.js';
import type {
  AnalyticsMode,
  ArticleForm,
  EditorialPresetId,
  PanelShape,
  ReaderProfile,
} from '../types.js';

export interface CreateArticleParams {
  prompt: string;
  teams?: string[];
  depthLevel?: number;
  presetId?: EditorialPresetId;
  readerProfile?: ReaderProfile;
  articleForm?: ArticleForm;
  panelShape?: PanelShape;
  analyticsMode?: AnalyticsMode;
  panelConstraintsJson?: string | null;
  provider?: string;
  pinnedAgents?: string[];
  /** Label surfaced in stage-run bookkeeping. Defaults to 'ideaGeneration'. */
  surface?: string;
  /** Actor label in stage-run bookkeeping. Defaults to 'ideaGeneration'. */
  actor?: string;
}

export interface CreateArticleResult {
  id: string;
  title: string;
  stage: 1;
  ideaContent: string;
  traceId: string | null;
}

/**
 * Generate an article idea and persist it as a stage-1 article.
 * This is the same logic that lives in POST /api/ideas, extracted for reuse.
 */
export async function createArticleFromPrompt(
  params: CreateArticleParams,
  repo: Repository,
  config: AppConfig,
  actionContext: ActionContext | null | undefined,
): Promise<CreateArticleResult> {
  const created = await createIdeaArticle({
    repo,
    config,
    actionContext: actionContext ?? undefined,
    prompt: params.prompt,
    teams: params.teams ?? [],
    depthLevel: params.depthLevel ?? 2,
    presetId: params.presetId,
    readerProfile: params.readerProfile,
    articleForm: params.articleForm,
    panelShape: params.panelShape,
    analyticsMode: params.analyticsMode,
    panelConstraintsJson: params.panelConstraintsJson,
    provider: params.provider,
    pinnedAgents: params.pinnedAgents ?? [],
    surface: params.surface,
    actor: params.actor,
  });
  return {
    id: created.id,
    title: created.title,
    stage: 1,
    ideaContent: created.ideaContent,
    traceId: created.traceId,
  };
}
