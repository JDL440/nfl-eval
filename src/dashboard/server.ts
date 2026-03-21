/**
 * server.ts — Hono HTTP server for the NFL Lab editorial workstation.
 *
 * Two primary actions: submit an idea (left of pipeline) and publish (right).
 * Everything else is status visibility rendered with htmx partials.
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { join } from 'node:path';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { Repository } from '../db/repository.js';
import type { AppConfig } from '../config/index.js';
import { initDataDir, loadConfig } from '../config/index.js';
import { STAGE_NAMES, VALID_STAGES } from '../types.js';
import type { Stage, Article } from '../types.js';
import { PipelineEngine } from '../pipeline/engine.js';
import {
  renderHome,
  renderReadyToPublish,
  renderRecentIdeas,
  renderPublished,
  renderPipelineSummary,
  renderStageArticles,
  renderFilteredArticles,
} from './views/home.js';
import {
  renderArticleDetail,
  renderArtifactContent,
  renderAdvanceResult,
  renderUsagePanel,
  renderStageRunsPanel,
  renderImageGallery,
  renderArticleMetaDisplay,
  renderArticleMetaEditForm,
  renderContextConfigPanel,
  renderLiveHeader,
  renderLiveArtifacts,
  renderLiveSidebar,
  ARTIFACT_FILES,
} from './views/article.js';
import type { ArtifactName } from './views/article.js';
import { ImageService } from '../services/image.js';
import type { ImageGenerationConfig, ImageResult } from '../services/image.js';
import { escapeHtml, formatDate, renderLayout } from './views/layout.js';
import {
  renderNewIdeaPage,
  renderIdeaSuccess,
  generateSlug,
  extractTitleFromIdea,
  IDEA_TEMPLATE,
  NFL_TEAMS,
} from './views/new-idea.js';
import {
  renderPublishPreview,
  renderPublishResult,
  proseMirrorToHtml,
  extractDraftId,
  renderNoteComposer,
  renderTweetComposer,
  CHECKLIST_ITEMS,
} from './views/publish.js';
import { markdownToProseMirror } from '../services/prosemirror.js';
import { renderArticlePreview, parseImageManifest } from './views/preview.js';
import type { SubstackService } from '../services/substack.js';
import type { TwitterService } from '../services/twitter.js';
import { executeTransition, autoAdvanceArticle, type ActionContext, type AutoAdvanceStep } from '../pipeline/actions.js';
import { assertPipelineConfigValid } from '../pipeline/validation.js';
import {
  CONTEXT_CONFIG,
  getArticleContextOverrides,
  saveArticleContextOverrides,
  deleteArticleContextOverrides,
} from '../pipeline/context-config.js';
import { LLMGateway } from '../llm/gateway.js';
import { ModelPolicy } from '../llm/model-policy.js';
import { AgentRunner, separateThinking } from '../agents/runner.js';
import { AgentMemory } from '../agents/memory.js';
import { PipelineAuditor } from '../pipeline/audit.js';
import { CopilotProvider } from '../llm/providers/copilot.js';
import { MockProvider } from '../llm/providers/mock.js';
import { LMStudioProvider } from '../llm/providers/lmstudio.js';
import { EventBus, registerSSE } from '../dashboard/sse.js';
import {
  renderAgentsPage,
  renderCharterDetail,
  renderSkillDetail,
  renderCharterEditForm,
  renderCharterView,
  renderSkillEditForm,
  renderSkillView,
  classifyCharter,
  extractIdentity,
} from './views/agents.js';
import {
  renderMemoryPage,
  renderMemoryTable,
  renderMemoryRow,
  renderMemoryEditRow,
  renderAgentMemorySection,
} from './views/memory.js';
import type { MemoryCategory } from '../agents/memory.js';
import { renderConfigPage } from './views/config.js';
import type { CharterSummary, SkillSummary } from './views/agents.js';
import { renderRunsPage, renderRunsTable, type RunsFilters } from './views/runs.js';

// ── Title/slug generation from freeform prompt ──────────────────────────────

/**
 * Generate a title and slug from a freeform prompt.
 * Uses simple heuristics now — can be upgraded to LLM later.
 */
function generateTitleAndSlug(prompt: string): { title: string; slug: string } {
  // Take the first sentence or line as the basis for the title
  const firstLine = prompt.split(/[.\n]/)[0].trim();

  // If it's already short enough, use it as the title
  let title: string;
  if (firstLine.length <= 80) {
    title = firstLine;
  } else {
    // Truncate at a word boundary
    title = firstLine.slice(0, 77).replace(/\s+\S*$/, '') + '...';
  }

  // Generate slug from the title
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '');

  return { title, slug };
}

// ── Pipeline summary builder ─────────────────────────────────────────────────

function buildPipelineSummary(
  articles: Article[],
): Record<number, { name: string; count: number }> {
  const summary: Record<number, { name: string; count: number }> = {};
  for (const s of VALID_STAGES) {
    summary[s] = {
      name: STAGE_NAMES[s],
      count: articles.filter(a => a.current_stage === s).length,
    };
  }
  return summary;
}

// ── App factory ──────────────────────────────────────────────────────────────

export function createApp(
  repo: Repository,
  config: AppConfig,
  deps?: { substackService?: SubstackService; twitterService?: TwitterService; actionContext?: ActionContext; imageService?: ImageService; memory?: AgentMemory },
): Hono {
  // Validate pipeline configuration consistency at startup
  assertPipelineConfigValid();

  const app = new Hono();
  const substackService = deps?.substackService;
  const twitterService = deps?.twitterService;
  const imageService = deps?.imageService;
  const memory = deps?.memory;
  const bus = new EventBus();

  // Track active auto-advance runs so article pages know whether to show the progress bar
  const activeAdvances = new Map<string, { startedAt: number }>();

  /** Helper: emit SSE events for auto-advance steps. */
  function emitStepEvents(id: string, step: AutoAdvanceStep): void {
    if (step.type === 'working') {
      const targetStage = step.to;
      const targetName = STAGE_NAMES[targetStage as Stage] ?? `Stage ${targetStage}`;
      bus.emit({ type: 'stage_working', articleId: id, data: { stage: targetStage, stageName: targetName, action: step.action }, timestamp: new Date().toISOString() });
    } else if (step.type === 'error') {
      console.warn(`[auto-advance] Stage ${step.from} failed: ${step.error}`);
      bus.emit({ type: 'stage_error', articleId: id, data: { stage: step.from, error: step.error ?? 'Unknown error' }, timestamp: new Date().toISOString() });
    } else if (step.type === 'regress') {
      bus.emit({ type: 'stage_changed', articleId: id, data: { from: step.from, to: step.to, action: 'auto-advance-regress' }, timestamp: new Date().toISOString() });
    } else if (step.type === 'advance') {
      bus.emit({ type: 'stage_changed', articleId: id, data: { from: step.from, to: step.to, action: 'auto-advance' }, timestamp: new Date().toISOString() });
    }
  }

  /** Run auto-advance in the background. Emits SSE events and cleans up when done. */
  function startBackgroundAutoAdvance(id: string): void {
    activeAdvances.set(id, { startedAt: Date.now() });
    const ctx = deps?.actionContext ?? null;
    const engine = ctx?.engine ?? new PipelineEngine(repo);

    autoAdvanceArticle(id, ctx, {
      maxStage: 7,
      maxRevisions: 2,
      repo,
      engine,
      onStep: (step: AutoAdvanceStep) => emitStepEvents(id, step),
      generateImages: autoGenerateImages,
    }).then((result) => {
      activeAdvances.delete(id);
      const current = repo.getArticle(id);
      bus.emit({
        type: 'pipeline_complete',
        articleId: id,
        data: {
          finalStage: result.finalStage,
          stageName: STAGE_NAMES[result.finalStage as Stage] ?? 'Unknown',
          steps: result.steps.length,
          revisionCount: result.revisionCount,
          error: result.error ?? null,
          success: !result.error,
          currentStage: current?.current_stage ?? result.finalStage,
        },
        timestamp: new Date().toISOString(),
      });
    }).catch((err) => {
      activeAdvances.delete(id);
      bus.emit({
        type: 'pipeline_complete',
        articleId: id,
        data: { error: err instanceof Error ? err.message : String(err), success: false },
        timestamp: new Date().toISOString(),
      });
    });
  }

  /** Generate article images and save manifest. Non-fatal — returns silently on failure. */
  async function autoGenerateImages(articleId: string): Promise<void> {
    if (!imageService) return;
    const art = repo.getArticle(articleId);
    if (!art || art.current_stage < 5) return;
    try {
      const rawDraft = repo.artifacts.get(articleId, 'draft.md');
      const summary = rawDraft ? separateThinking(rawDraft).output.slice(0, 500) : '';
      const team = art.primary_team ?? undefined;
      const results = await imageService.generateArticleImages(articleId, {
        cover: { description: art.title, imageType: 'cover', articleTitle: art.title, articleSummary: summary, team, aspectRatio: '16:9' },
        inline: [
          { description: art.title, imageType: 'inline', articleTitle: art.title, articleSummary: summary, team, aspectRatio: '16:9' },
          { description: art.title, imageType: 'inline', articleTitle: art.title, articleSummary: summary, team, aspectRatio: '16:9' },
        ],
      });
      const manifest: { type: string; path: string; prompt: string }[] = [];
      if (results.cover) manifest.push({ type: 'cover', path: results.cover.path, prompt: results.cover.prompt });
      for (const img of results.inline) manifest.push({ type: 'inline', path: img.path, prompt: img.prompt });
      repo.artifacts.put(articleId, 'images.json', JSON.stringify(manifest, null, 2));
      console.log(`[images] Generated ${manifest.length} images for ${articleId}`);
    } catch (err) {
      console.warn(`[images] Generation failed (non-fatal): ${err instanceof Error ? err.message : err}`);
    }
  }

  // Register SSE event stream
  registerSSE(app, bus);

  // ── Static files ──────────────────────────────────────────────────────────
  const publicRoot = join(__dirname, 'public');
  app.use(
    '/static/*',
    serveStatic({
      root: publicRoot,
      rewriteRequestPath: (path: string) => path.replace(/^\/static/, ''),
    }),
  );

  // Serve generated images from the images directory
  app.get('/images/:slug/:file', async (c) => {
    const slug = c.req.param('slug');
    const file = c.req.param('file');
    // Sanitize to prevent path traversal
    if (slug.includes('..') || file.includes('..') || file.includes('/') || file.includes('\\')) {
      return c.text('Not found', 404);
    }
    const filePath = join(config.imagesDir, slug, file);
    try {
      const { readFileSync } = await import('node:fs');
      const data = readFileSync(filePath);
      const ext = file.split('.').pop()?.toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'application/octet-stream';
      return new Response(data, { headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=3600' } });
    } catch {
      return c.text('Not found', 404);
    }
  });

  // ── HTML pages ────────────────────────────────────────────────────────────

  app.get('/', (c) => {
    const articles = repo.getAllArticles();
    const teams = repo.getDistinctTeams();
    return c.html(
      renderHome({
        config,
        readyArticles: articles.filter(a => a.current_stage === 7),
        recentIdeas: articles.filter(a => a.current_stage === 1),
        published: articles.filter(a => a.current_stage === 8),
        pipelineSummary: buildPipelineSummary(articles),
        teams,
      }),
    );
  });

  app.get('/articles/:id', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.notFound();

    // Check if the article can advance
    const engine = new PipelineEngine(repo);
    const advanceCheck = article.current_stage < 8
      ? engine.canAdvance(id, article.current_stage)
      : undefined;

    // Flash message from auto-advance redirect
    const from = c.req.query('from');
    const errorParam = c.req.query('error');
    let flashMessage: string | undefined;
    let errorMessage: string | undefined;
    // Show progress bar if auto-advance is actively running OR page was just redirected
    let autoAdvanceActive = activeAdvances.has(id);
    if (from === 'auto-advance') {
      if (errorParam) {
        errorMessage = `Auto-advance failed: ${errorParam}`;
        autoAdvanceActive = false;
      } else if (article.current_stage < 7) {
        autoAdvanceActive = true;
      } else {
        flashMessage = `🚀 Auto-advance complete — article is at Stage ${article.current_stage} (${STAGE_NAMES[article.current_stage as Stage]})`;
      }
    }

    return c.html(
      renderArticleDetail({
        config,
        article,
        transitions: repo.getStageTransitions(id),
        reviews: repo.getEditorReviews(id),
        advanceCheck,
        usageEvents: repo.getUsageEvents(id),
        stageRuns: repo.getStageRuns(id),
        artifactNames: repo.artifacts.list(id).map(a => a.name),
        flashMessage,
        errorMessage,
        autoAdvanceActive,
        pinnedAgents: repo.getPinnedAgents(id),
      }),
    );
  });

  // ── htmx: inline article metadata editing ─────────────────────────────────

  app.get('/htmx/articles/:id/meta', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html('<p class="empty-state">Article not found</p>', 404);
    return c.html(renderArticleMetaDisplay(article));
  });

  app.get('/htmx/articles/:id/edit-meta', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html('<p class="empty-state">Article not found</p>', 404);
    return c.html(renderArticleMetaEditForm(article));
  });

  app.post('/htmx/articles/:id/edit-meta', async (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html('<p class="empty-state">Article not found</p>', 404);

    const body = await c.req.parseBody();

    const updates: { title?: string; subtitle?: string | null; depth_level?: number; teams?: string[] } = {};

    if (body.title != null) {
      const title = String(body.title).trim();
      if (!title) return c.html('<p class="empty-state">Title cannot be empty</p>', 400);
      updates.title = title;
    }

    if (body.subtitle !== undefined) {
      const subtitle = String(body.subtitle ?? '').trim();
      updates.subtitle = subtitle || null;
    }

    if (body.depth_level != null) {
      const depth = parseInt(String(body.depth_level), 10);
      if (!Number.isInteger(depth) || depth < 1 || depth > 4) {
        return c.html('<p class="empty-state">Invalid depth level</p>', 400);
      }
      updates.depth_level = depth;
    }

    if (body.teams !== undefined) {
      const raw = String(body.teams ?? '');
      const teams = raw.split(',').map(t => t.trim()).filter(Boolean);
      updates.teams = [...new Set(teams)];
    }

    try {
      const updated = repo.updateArticle(id, updates);
      return c.html(renderArticleMetaDisplay(updated));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.html(`<p class="empty-state">${escapeHtml(message)}</p>`, 400);
    }
  });

  app.get('/ideas/new', (c) => {
    // Build list of expert agents (non-production, non-team) for the pin selector
    let expertAgents: string[] = [];
    const runner = deps?.actionContext?.runner;
    if (runner) {
      const PROD = new Set(['lead', 'writer', 'editor', 'scribe', 'coordinator', 'panel-moderator', 'publisher']);
      const TEAMS = new Set([
        'ari','atl','bal','buf','car','chi','cin','cle','dal','den','det','gb',
        'hou','ind','jax','kc','lac','lar','lv','mia','min','ne','no','nyg',
        'nyj','phi','pit','sea','sf','tb','ten','wsh',
      ]);
      expertAgents = runner.listAgents().filter(a => !PROD.has(a) && !TEAMS.has(a));
    }
    return c.html(renderNewIdeaPage({ labName: config.leagueConfig.name, expertAgents }));
  });

  app.get('/config', (c) => {
    const envVars = [
      'LLM_PROVIDER',
      'LMSTUDIO_URL',
      'GEMINI_API_KEY',
      'SUBSTACK_TOKEN',
      'SUBSTACK_PUBLICATION_URL',
      'TWITTER_API_KEY',
      'DATA_SOURCE',
    ];

    // Non-secret env vars whose values we can safely display
    const displayableVars = new Set(['LLM_PROVIDER', 'LMSTUDIO_URL', 'SUBSTACK_PUBLICATION_URL', 'DATA_SOURCE']);
    const envDefaultValues: Record<string, string> = { DATA_SOURCE: 'scripts' };

    const envStatus = envVars.map((key) => {
      const rawVal = process.env[key] ? String(process.env[key]).trim() : '';
      const isSet = Boolean(rawVal);
      const displayValue = displayableVars.has(key)
        ? (rawVal || envDefaultValues[key] ? `${rawVal || envDefaultValues[key]}${!rawVal && envDefaultValues[key] ? ' (default)' : ''}` : undefined)
        : undefined;
      return { key, isSet, displayValue };
    });

    const usingMock = process.env['MOCK_LLM'] === '1';
    const usingLMStudio = process.env['LLM_PROVIDER'] === 'lmstudio' || Boolean(process.env['LMSTUDIO_URL']);

    let providerName = 'Copilot';
    if (usingMock) providerName = 'Mock';
    else if (usingLMStudio) providerName = 'LM Studio';

    const providerUrl = usingLMStudio
      ? (() => {
          let base = (process.env['LMSTUDIO_URL'] ?? 'http://localhost:1234/v1').replace(/\/+$/, '');
          if (!base.endsWith('/v1')) base += '/v1';
          return base;
        })()
      : undefined;

    let modelPolicyError: string | undefined;
    let modelRouting: Array<{ stageKey: string; model: string }> = [];
    let activeModel = usingMock ? 'mock' : (usingLMStudio ? (process.env['LMSTUDIO_MODEL'] ?? '(auto)') : '');

    try {
      const policyPath = join(config.dataDir, 'config', 'models.json');
      const modelPolicy = new ModelPolicy(policyPath);
      modelRouting = Object.entries(modelPolicy.config.models)
        .map(([stageKey, model]) => ({ stageKey, model }))
        .sort((a, b) => a.stageKey.localeCompare(b.stageKey));

      if (!activeModel && !usingLMStudio) {
        activeModel = modelPolicy.resolve({ stageKey: 'lead' }).selectedModel;
      }
    } catch (err) {
      modelPolicyError = `Model policy not available: ${err instanceof Error ? err.message : String(err)}`;
      if (!activeModel) activeModel = '(unknown)';
    }

    const listCharterNames = (): string[] => {
      if (!existsSync(config.chartersDir)) return [];
      const entries = readdirSync(config.chartersDir, { withFileTypes: true });
      const names: string[] = [];

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          names.push(entry.name.replace(/\.md$/i, ''));
        } else if (entry.isDirectory()) {
          // Match AgentRunner behavior: require charter.md in subdir
          const subCharter = join(config.chartersDir, entry.name, 'charter.md');
          if (existsSync(subCharter)) names.push(entry.name);
        }
      }

      return names.sort();
    };

    const listSkillNames = (): string[] => {
      if (!existsSync(config.skillsDir)) return [];
      const entries = readdirSync(config.skillsDir, { withFileTypes: true });
      const names: string[] = [];
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          names.push(entry.name.replace(/\.md$/i, ''));
        }
      }
      return names.sort();
    };

    const charters = listCharterNames();
    const skills = listSkillNames();

    return c.html(renderConfigPage({
      labName: config.leagueConfig.name,
      provider: {
        name: providerName,
        url: providerUrl,
        model: activeModel,
      },
      modelRouting,
      modelPolicyError,
      charters,
      skills,
      envStatus,
    }));
  });

  // ── API routes (JSON) ─────────────────────────────────────────────────────

  app.get('/api/articles', (c) => {
    const stage = c.req.query('stage');
    const status = c.req.query('status');
    const limit = c.req.query('limit');

    const filters: { stage?: number; status?: string; limit?: number } = {};
    if (stage) filters.stage = parseInt(stage, 10);
    if (status) filters.status = status;
    if (limit) filters.limit = parseInt(limit, 10);

    const articles = repo.listArticles(filters);
    return c.json({ articles, total: articles.length });
  });

  app.get('/api/articles/:id', (c) => {
    const article = repo.getArticle(c.req.param('id'));
    if (!article) return c.json({ error: 'Article not found' }, 404);
    return c.json(article);
  });

  app.patch('/api/articles/:id', async (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.json({ error: 'Article not found' }, 404);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    if (body == null || typeof body !== 'object' || Array.isArray(body)) {
      return c.json({ error: 'Body must be an object' }, 400);
    }

    const allowed = new Set(['title', 'subtitle', 'depth_level', 'teams']);
    for (const key of Object.keys(body as Record<string, unknown>)) {
      if (!allowed.has(key)) {
        return c.json({ error: `Invalid field: ${key}` }, 400);
      }
    }

    const updates: { title?: string; subtitle?: string | null; depth_level?: number; teams?: string[] } = {};
    const b = body as Record<string, unknown>;

    if ('title' in b) {
      if (typeof b.title !== 'string' || !b.title.trim()) {
        return c.json({ error: 'title must be a non-empty string' }, 400);
      }
      updates.title = b.title.trim();
    }

    if ('subtitle' in b) {
      if (b.subtitle !== null && typeof b.subtitle !== 'string') {
        return c.json({ error: 'subtitle must be a string or null' }, 400);
      }
      updates.subtitle = b.subtitle === null ? null : (b.subtitle as string).trim() || null;
    }

    if ('depth_level' in b) {
      if (typeof b.depth_level !== 'number' || !Number.isInteger(b.depth_level) || b.depth_level < 1 || b.depth_level > 4) {
        return c.json({ error: 'depth_level must be an integer 1–4' }, 400);
      }
      updates.depth_level = b.depth_level;
    }

    if ('teams' in b) {
      if (!Array.isArray(b.teams) || !b.teams.every(x => typeof x === 'string')) {
        return c.json({ error: 'teams must be an array of strings' }, 400);
      }
      const normalized = (b.teams as string[])
        .map(t => t.trim())
        .filter(Boolean);
      updates.teams = [...new Set(normalized)];
    }

    try {
      const updated = repo.updateArticle(id, updates);
      return c.json(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  });

  app.post('/api/articles', async (c) => {
    const body = await c.req.json();
    const { id, title, primary_team, league, depth_level } = body;

    if (!id || !title) {
      return c.json({ error: 'id and title are required' }, 400);
    }

    try {
      const article = repo.createArticle({ id, title, primary_team, league, depth_level });

      // Store idea artifact in DB
      repo.artifacts.put(id, 'idea.md', `# ${title}\n`);

      bus.emit({ type: 'article_created', articleId: id, data: { title }, timestamp: new Date().toISOString() });

      return c.json(article, 201);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  });

  app.post('/api/ideas', async (c) => {
    const body = await c.req.json();
    const prompt = (typeof body.prompt === 'string' ? body.prompt : '').trim();

    if (!prompt) {
      return c.json({ error: 'prompt is required' }, 400);
    }

    try {
      const teams: string[] = Array.isArray(body.teams) ? body.teams : [];
      const depthLevel = [1, 2, 3, 4].includes(body.depthLevel) ? body.depthLevel : 2;
      const autoAdvance = body.autoAdvance === true;
      const pinnedAgents: string[] = Array.isArray(body.pinnedAgents) ? body.pinnedAgents.filter((a: unknown) => typeof a === 'string' && a.length > 0) : [];
      const actionContext = deps?.actionContext;

      let ideaContent: string;
      let title: string;
      let ideaThinking: string | null = null;
      let ideaModel = '';
      let ideaAgent = '';
      let ideaProvider = '';
      let ideaTokensUsed: { prompt: number; completion: number } | undefined;

      if (actionContext) {
        // Build team context for the task
        const teamContext = teams.length > 0
          ? teams.map(abbr => {
              const t = NFL_TEAMS.find(x => x.abbr === abbr);
              return t ? `${t.abbr} — ${t.city} ${t.name}` : abbr;
            }).join(', ')
          : 'No specific team';

        const depthLabels: Record<number, string> = {
          1: '1 — Casual Fan (~800 words, 2 agents)',
          2: '2 — The Beat (~1500 words, 3 agents)',
          3: '3 — Deep Dive (~2500 words, 4-5 agents)',
          4: '4 — Feature (~4000 words)',
        };

        // Use AgentRunner with Lead charter + idea-generation skill
        const task = [
          'Generate a structured article idea from the following prompt.',
          `\nTeam context: ${teamContext}`,
          `Depth level: ${depthLabels[depthLevel] ?? depthLabels[2]}`,
          '\nUse this output template:\n',
          IDEA_TEMPLATE,
          '\nFill in every section with specific, actionable content. The Working Title should be clickbait-adjacent but honest, 60-80 characters.',
          `\nUser prompt: ${prompt}`,
        ].join('\n');

        const result = await actionContext.runner.run({
          agentName: 'lead',
          task,
          skills: ['idea-generation'],
        });

        ideaContent = result.content;
        title = extractTitleFromIdea(ideaContent);
        ideaThinking = result.thinking;
        ideaModel = result.model;
        ideaAgent = result.agentName;
        ideaProvider = result.provider;
        ideaTokensUsed = result.tokensUsed;
      } else {
        // Fallback: no LLM available — use raw prompt
        const generated = generateTitleAndSlug(prompt);
        title = generated.title;
        ideaContent = `# Article Idea: ${title}\n\n## Working Title\n${title}\n\n## Angle / Tension\n${prompt}`;
      }

      let slug = generateSlug(title);
      if (!slug) slug = generateSlug(prompt);
      if (!slug) slug = `idea-${Date.now().toString(36)}`;

      // Ensure uniqueness
      if (repo.getArticle(slug)) {
        slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      }

      repo.createArticle({
        id: slug,
        title,
        primary_team: teams[0] ?? undefined,
        league: config.league,
        depth_level: depthLevel,
      });

      // Store pinned expert agents
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
          provider: ideaProvider,
          modelOrTool: ideaModel,
          eventType: 'completed',
          promptTokens: ideaTokensUsed.prompt,
          outputTokens: ideaTokensUsed.completion,
        });
      }

      bus.emit({ type: 'article_created', articleId: slug, data: { title }, timestamp: new Date().toISOString() });

      return c.json({
        id: slug,
        title,
        stage: 1,
        autoAdvance,
      }, 201);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 500);
    }
  });

  app.post('/api/articles/:id/advance', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();

    if (body.to_stage == null) {
      return c.json({ error: 'to_stage is required' }, 400);
    }

    try {
      repo.advanceStage(
        id,
        body.from_stage ?? null,
        body.to_stage,
        body.agent ?? 'dashboard',
        body.notes ?? null,
      );
      const updated = repo.getArticle(id);
      return c.json(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  });

  app.get('/api/pipeline/summary', (c) => {
    const articles = repo.getAllArticles();
    return c.json({
      stages: buildPipelineSummary(articles),
      total: articles.length,
    });
  });

  // ── API: Regress article to previous stage ──────────────────────────────
  app.post('/api/articles/:id/regress', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const article = repo.getArticle(id);
    if (!article) return c.json({ error: 'Article not found' }, 404);

    const toStage = body.to_stage as number;
    const reason = (body.reason as string || '').trim() || 'Sent back for revisions';
    const agent = (body.agent as string || '').trim() || 'dashboard';

    if (!toStage || toStage >= article.current_stage) {
      return c.json({ error: `Target stage must be less than current stage (${article.current_stage})` }, 400);
    }

    try {
      const engine = new PipelineEngine(repo);
      engine.regress(id, article.current_stage as Stage, toStage as Stage, agent, reason);
      const updated = repo.getArticle(id)!;
      return c.json({
        id,
        previousStage: article.current_stage,
        currentStage: updated.current_stage,
        reason,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  });

  // ── API: Auto-advance article through pipeline ───────────────────────────

  app.post('/api/articles/:id/auto-advance', async (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.json({ error: 'Article not found' }, 404);
    if (activeAdvances.has(id)) return c.json({ error: 'Auto-advance already running' }, 409);

    // Fire-and-forget: start in background, return immediately so SSE can deliver events
    startBackgroundAutoAdvance(id);

    return c.json({ id, status: 'started', currentStage: article.current_stage });
  });

  // ── htmx partial routes (HTML fragments) ──────────────────────────────────

  app.get('/htmx/filtered-articles', (c) => {
    const search = c.req.query('search') || undefined;
    const stageStr = c.req.query('stage');
    const team = c.req.query('team') || undefined;
    const depthStr = c.req.query('depth');

    const stage = stageStr ? parseInt(stageStr, 10) : undefined;
    const depthLevel = depthStr ? parseInt(depthStr, 10) : undefined;

    // Only query if at least one filter is active
    if (!search && stage == null && !team && depthLevel == null) {
      return c.html('');
    }

    const articles = repo.listArticles({ search, stage, team, depthLevel, limit: 50 });
    return c.html(renderFilteredArticles(articles));
  });

  app.get('/htmx/pipeline-summary', (c) => {
    const articles = repo.getAllArticles();
    return c.html(renderPipelineSummary(buildPipelineSummary(articles)));
  });

  app.get('/htmx/ready-to-publish', (c) => {
    return c.html(
      renderReadyToPublish(repo.getAllArticles().filter(a => a.current_stage === 7)),
    );
  });

  app.get('/htmx/recent-ideas', (c) => {
    return c.html(
      renderRecentIdeas(repo.getAllArticles().filter(a => a.current_stage === 1)),
    );
  });

  app.get('/htmx/published', (c) => {
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
    return c.html(
      renderPublished(
        repo
          .getAllArticles()
          .filter(a => a.current_stage === 8 && (!a.published_at || a.published_at >= cutoff)),
      ),
    );
  });

  app.get('/htmx/stage/:stage', (c) => {
    const stage = parseInt(c.req.param('stage'), 10) as Stage;
    return c.html(
      renderStageArticles(
        repo.getAllArticles().filter(a => a.current_stage === stage),
        stage,
      ),
    );
  });

  // ── htmx: upstream context config panel ─────────────────────────────────

  function listContextArtifactChoices(articleId: string): string[] {
    const canonical = [
      ...(ARTIFACT_FILES as unknown as string[]),
      'publisher-pass.md',
    ];

    const existing = repo.artifacts
      .list(articleId)
      .map(a => a.name)
      .filter(n => n !== '_config.json');

    const combined = [...canonical, ...existing]
      .filter(n => !n.endsWith('.thinking.md'));

    return Array.from(new Set(combined)).sort();
  }

  app.get('/htmx/articles/:id/context-config', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html('<p class="empty-state">Article not found</p>', 404);

    const stageNames = Object.keys(CONTEXT_CONFIG);
    const defaults: Record<string, string[]> = {};
    for (const s of stageNames) defaults[s] = CONTEXT_CONFIG[s]?.include ?? [];

    const overrides = getArticleContextOverrides(repo, id);
    const artifactChoices = listContextArtifactChoices(id);

    return c.html(renderContextConfigPanel({
      articleId: id,
      stageNames,
      artifactChoices,
      defaults,
      overrides,
    }));
  });

  app.post('/api/articles/:id/context-config', async (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) {
      const isHtmx = c.req.header('hx-request') === 'true';
      return isHtmx
        ? c.html('<p class="empty-state">Article not found</p>', 404)
        : c.json({ error: 'Article not found' }, 404);
    }

    try {
      const body = await c.req.parseBody();
      const stageNames = Object.keys(CONTEXT_CONFIG);
      const artifactChoices = listContextArtifactChoices(id);
      const allowed = new Set(artifactChoices);

      const overridesToSave: Record<string, string[]> = {};
      for (const stage of stageNames) {
        const raw = body[stage];
        let vals: string[] = [];
        if (Array.isArray(raw)) vals = raw.map(v => String(v));
        else if (typeof raw === 'string') vals = [raw];

        const cleaned = vals
          .map(v => v.trim())
          .filter(Boolean)
          .filter(v => allowed.has(v));

        overridesToSave[stage] = Array.from(new Set(cleaned));
      }

      saveArticleContextOverrides(repo, id, overridesToSave);

      const defaults: Record<string, string[]> = {};
      for (const s of stageNames) defaults[s] = CONTEXT_CONFIG[s]?.include ?? [];

      const isHtmx = c.req.header('hx-request') === 'true';
      if (isHtmx) {
        return c.html(renderContextConfigPanel({
          articleId: id,
          stageNames,
          artifactChoices,
          defaults,
          overrides: overridesToSave,
        }));
      }

      return c.json({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const isHtmx = c.req.header('hx-request') === 'true';
      return isHtmx
        ? c.html(`<p class="empty-state">❌ ${escapeHtml(message)}</p>`, 500)
        : c.json({ error: message }, 500);
    }
  });

  app.delete('/api/articles/:id/context-config', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) {
      const isHtmx = c.req.header('hx-request') === 'true';
      return isHtmx
        ? c.html('<p class="empty-state">Article not found</p>', 404)
        : c.json({ error: 'Article not found' }, 404);
    }

    deleteArticleContextOverrides(repo, id);

    const stageNames = Object.keys(CONTEXT_CONFIG);
    const defaults: Record<string, string[]> = {};
    for (const s of stageNames) defaults[s] = CONTEXT_CONFIG[s]?.include ?? [];

    const isHtmx = c.req.header('hx-request') === 'true';
    if (isHtmx) {
      return c.html(renderContextConfigPanel({
        articleId: id,
        stageNames,
        artifactChoices: listContextArtifactChoices(id),
        defaults,
        overrides: null,
      }));
    }

    return c.json({ success: true });
  });

  // ── htmx: artifact content tab ────────────────────────────────────────────

  app.get('/htmx/articles/:id/artifact/:name', (c) => {
    const id = c.req.param('id');
    const name = c.req.param('name');
    const article = repo.getArticle(id);
    if (!article) return c.html(renderArtifactContent(name, null), 404);

    // Allow pipeline artifacts and their thinking traces
    const isThinking = name.endsWith('.thinking.md');
    const baseName = isThinking ? name.replace('.thinking.md', '.md') : name;
    const isPanelArtifact = /^panel-[a-z0-9-]+\.md$/.test(baseName);
    if (!isPanelArtifact && !(ARTIFACT_FILES as readonly string[]).includes(baseName)) {
      return c.html(renderArtifactContent(name, null), 400);
    }

    const content = repo.artifacts.get(id, name);
    if (!content) {
      return c.html(renderArtifactContent(name, null));
    }

    return c.html(renderArtifactContent(name, content));
  });

  // ── htmx: usage panel ───────────────────────────────────────────────────

  app.get('/htmx/articles/:id/usage', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html('<p class="empty-state">Article not found</p>', 404);
    return c.html(renderUsagePanel(repo.getUsageEvents(id)));
  });

  // ── htmx: stage runs panel ────────────────────────────────────────────────

  app.get('/htmx/articles/:id/stage-runs', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html('<p class="empty-state">Article not found</p>', 404);
    return c.html(renderStageRunsPanel(repo.getStageRuns(id)));
  });

  // ── htmx: live partials (SSE-driven auto-refresh) ─────────────────────────

  app.get('/htmx/articles/:id/live-header', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html('', 404);
    return c.html(renderLiveHeader(article, repo.getStageTransitions(id)));
  });

  app.get('/htmx/articles/:id/live-artifacts', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html('', 404);
    return c.html(renderLiveArtifacts(article, repo.artifacts.list(id).map(a => a.name)));
  });

  app.get('/htmx/articles/:id/live-sidebar', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html('', 404);
    return c.html(renderLiveSidebar(
      article,
      repo.getUsageEvents(id),
      repo.getStageRuns(id),
      repo.getStageTransitions(id),
      repo.getPinnedAgents(id),
    ));
  });

  // ── htmx: advance article ─────────────────────────────────────────────────

  app.post('/htmx/articles/:id/advance', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html(renderAdvanceResult(false, 'Article not found'), 404);

    const engine = new PipelineEngine(repo);
    const check = engine.canAdvance(id, article.current_stage);

    if (!check.allowed) {
      return c.html(renderAdvanceResult(false, check.reason), 422);
    }

    try {
      const newStage = engine.advance(id, article.current_stage, 'dashboard');
      bus.emit({ type: 'stage_changed', articleId: id, data: { from: article.current_stage, to: newStage, action: 'advance' }, timestamp: new Date().toISOString() });
      return c.html(
        renderAdvanceResult(true, `Advanced to Stage ${newStage} — ${STAGE_NAMES[newStage]}`),
        200,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.html(renderAdvanceResult(false, message), 422);
    }
  });

  // ── htmx: auto-advance article ──────────────────────────────────────────

  app.post('/htmx/articles/:id/auto-advance', async (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html(renderAdvanceResult(false, 'Article not found'), 404);
    if (activeAdvances.has(id)) return c.html(renderAdvanceResult(false, 'Auto-advance already running'), 409);

    // Fire-and-forget: start in background, return immediately
    startBackgroundAutoAdvance(id);

    return c.html(
      `<div class="advance-result advance-success">🚀 Auto-advance started — watch the progress bar above.</div>`,
      200,
    );
  });

  // ── htmx: regress article ───────────────────────────────────────────────
  app.post('/htmx/articles/:id/regress', async (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html(renderAdvanceResult(false, 'Article not found'), 404);

    const body = await c.req.parseBody();
    const toStage = parseInt(String(body.to_stage || '0'), 10);
    const reason = (body.reason as string || '').trim() || 'Sent back for revisions';

    if (!toStage || toStage >= article.current_stage) {
      return c.html(renderAdvanceResult(false, `Target stage must be less than current stage (${article.current_stage})`), 422);
    }

    try {
      const engine = new PipelineEngine(repo);
      engine.regress(id, article.current_stage as Stage, toStage as Stage, 'dashboard', reason);
      return c.html(
        renderAdvanceResult(true, `Sent back to Stage ${toStage} — ${STAGE_NAMES[toStage as Stage]}`),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.html(renderAdvanceResult(false, message), 422);
    }
  });

  // ── Rich article preview ────────────────────────────────────────────────────

  app.get('/articles/:id/preview', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.notFound();

    const rawMarkdown = repo.artifacts.get(id, 'draft.md');
    let htmlBody = '<p class="empty-state">No article draft found</p>';
    if (rawMarkdown) {
      const markdown = separateThinking(rawMarkdown).output;
      const doc = markdownToProseMirror(markdown);
      htmlBody = proseMirrorToHtml(doc);
    }

    // Parse image manifest for cover and inline images
    let coverImageUrl: string | null = null;
    let inlineImageUrls: string[] = [];
    const manifestJson = repo.artifacts.get(id, 'images.json');
    if (manifestJson) {
      const parsed = parseImageManifest(manifestJson);
      coverImageUrl = parsed.cover;
      inlineImageUrls = parsed.inlines;
    }

    return c.html(
      renderArticlePreview({
        config,
        article,
        htmlBody,
        coverImageUrl,
        inlineImageUrls,
      }),
    );
  });

  // ── Publish workflow routes ─────────────────────────────────────────────────

  app.get('/articles/:id/publish', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.notFound();

    let htmlPreview = '';

    // Load article markdown from DB artifact store
    const rawMd = repo.artifacts.get(id, 'draft.md');
    if (rawMd) {
      const cleanMd = separateThinking(rawMd).output;
      const doc = markdownToProseMirror(cleanMd);
      htmlPreview = proseMirrorToHtml(doc);
    } else {
      htmlPreview = '<p class="empty-state">No article draft found</p>';
    }

    return c.html(
      renderPublishPreview({
        config,
        article,
        htmlPreview,
      }),
    );
  });

  app.get('/htmx/articles/:id/preview', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html('<p class="empty-state">Article not found</p>', 404);

    const rawDraft = repo.artifacts.get(id, 'draft.md');
    if (!rawDraft) {
      return c.html('<p class="empty-state">No article draft found</p>');
    }

    const cleanDraft = separateThinking(rawDraft).output;
    const doc = markdownToProseMirror(cleanDraft);
    return c.html(proseMirrorToHtml(doc));
  });

  app.post('/api/articles/:id/draft', async (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.json({ error: 'Article not found' }, 404);

    if (!substackService) {
      // Return htmx-compatible HTML if Accept header suggests it
      const isHtmx = c.req.header('hx-request') === 'true';
      if (isHtmx) {
        return c.html(
          renderPublishResult({ article, success: false, error: 'Substack service not configured' }),
          500,
        );
      }
      return c.json({ error: 'Substack service not configured' }, 500);
    }

    try {
      // Load article markdown from DB artifact store
      const markdown = repo.artifacts.get(id, 'draft.md');
      if (!markdown) {
        throw new Error('No article draft found');
      }

      const doc = markdownToProseMirror(markdown);
      const bodyHtml = JSON.stringify(doc);

      const draft = await substackService.createDraft({
        title: article.title,
        subtitle: article.subtitle ?? undefined,
        bodyHtml,
      });

      repo.setDraftUrl(id, draft.editUrl);

      const isHtmx = c.req.header('hx-request') === 'true';
      if (isHtmx) {
        return c.html(
          renderPublishResult({ article: repo.getArticle(id)!, success: true, draftUrl: draft.editUrl }),
        );
      }
      return c.json({ success: true, draftUrl: draft.editUrl, draftId: draft.id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const isHtmx = c.req.header('hx-request') === 'true';
      if (isHtmx) {
        return c.html(
          renderPublishResult({ article, success: false, error: message }),
          500,
        );
      }
      return c.json({ error: message }, 500);
    }
  });

  app.post('/api/articles/:id/publish', async (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.json({ error: 'Article not found' }, 404);

    if (!substackService) {
      const isHtmx = c.req.header('hx-request') === 'true';
      if (isHtmx) {
        return c.html(
          renderPublishResult({ article, success: false, error: 'Substack service not configured' }),
          500,
        );
      }
      return c.json({ error: 'Substack service not configured' }, 500);
    }

    const draftUrl = article.substack_draft_url;
    if (!draftUrl) {
      const isHtmx = c.req.header('hx-request') === 'true';
      if (isHtmx) {
        return c.html(
          renderPublishResult({ article, success: false, error: 'No draft exists — create a draft first' }),
          400,
        );
      }
      return c.json({ error: 'No draft exists — create a draft first' }, 400);
    }

    const draftId = extractDraftId(draftUrl);
    if (!draftId) {
      const isHtmx = c.req.header('hx-request') === 'true';
      if (isHtmx) {
        return c.html(
          renderPublishResult({ article, success: false, error: 'Cannot extract draft ID from URL' }),
          400,
        );
      }
      return c.json({ error: 'Cannot extract draft ID from URL' }, 400);
    }

    try {
      const post = await substackService.publishDraft({ draftId });

      // Record publish: advances to Stage 8, sets substack_url + published_at
      repo.recordPublish(id, post.canonicalUrl, 'dashboard');

      bus.emit({ type: 'article_published', articleId: id, data: { url: post.canonicalUrl }, timestamp: new Date().toISOString() });

      const isHtmx = c.req.header('hx-request') === 'true';
      if (isHtmx) {
        return c.html(
          renderPublishResult({
            article: repo.getArticle(id)!,
            success: true,
            publishedUrl: post.canonicalUrl,
          }),
        );
      }
      return c.json({ success: true, publishedUrl: post.canonicalUrl });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const isHtmx = c.req.header('hx-request') === 'true';
      if (isHtmx) {
        return c.html(
          renderPublishResult({ article, success: false, error: message }),
          500,
        );
      }
      return c.json({ error: message }, 500);
    }
  });

  // ── htmx: toggle publisher checklist item ──────────────────────────────────

  app.post('/htmx/articles/:id/checklist/:key', (c) => {
    const id = c.req.param('id');
    const key = c.req.param('key');
    const article = repo.getArticle(id);
    if (!article) return c.html('<p class="empty-state">Article not found</p>', 404);

    const pass = repo.getPublisherPass(id);

    if (key === 'publish_datetime') {
      const current = pass ? (pass as unknown as Record<string, unknown>)[key] : null;
      const newValue = current != null ? null : new Date().toISOString();
      repo.updateChecklistItem(id, key, newValue);
    } else {
      const current = pass ? (pass as unknown as Record<string, unknown>)[key] : 0;
      const newValue = current === 1 ? 0 : 1;
      repo.updateChecklistItem(id, key, newValue);
    }

    const updatedPass = repo.getPublisherPass(id)!;
    const items = CHECKLIST_ITEMS.map(({ key: k, label }) => {
      const val = (updatedPass as unknown as Record<string, unknown>)[k];
      const checked = k === 'publish_datetime' ? val != null : val === 1;
      return { key: k, label, checked };
    });

    return c.html(
      items.map(i => `
        <div class="checklist-item ${i.checked ? 'checked' : ''}"
             hx-post="/htmx/articles/${escapeHtml(id)}/checklist/${escapeHtml(i.key)}"
             hx-target="#publisher-checklist"
             hx-swap="innerHTML">
          <span class="check-icon">${i.checked ? '✅' : '⬜'}</span>
          <span class="check-label">${escapeHtml(i.label)}</span>
        </div>
      `).join(''),
    );
  });

  // ── POST Note to Substack ───────────────────────────────────────────────────

  app.post('/api/articles/:id/note', async (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) {
      const isHtmx = c.req.header('hx-request') === 'true';
      return isHtmx
        ? c.html('<div class="note-error">Article not found</div>', 404)
        : c.json({ error: 'Article not found' }, 404);
    }

    if (!substackService) {
      const isHtmx = c.req.header('hx-request') === 'true';
      return isHtmx
        ? c.html('<div class="note-error">Substack service not configured</div>', 500)
        : c.json({ error: 'Substack service not configured' }, 500);
    }

    try {
      const body = await c.req.parseBody();
      const content = String(body['content'] ?? '').trim();
      if (!content) {
        const isHtmx = c.req.header('hx-request') === 'true';
        return isHtmx
          ? c.html('<div class="note-error">Note content is required</div>', 400)
          : c.json({ error: 'Note content is required' }, 400);
      }
      const attachArticle = body['attachArticle'] === 'on' || body['attachArticle'] === 'true';

      const result = await substackService.createNote({
        content,
        articleSlug: attachArticle ? article.id : undefined,
      });

      repo.recordNote(article.id, 'promotion', content, result.url, 'prod', 'dashboard');

      const isHtmx = c.req.header('hx-request') === 'true';
      if (isHtmx) {
        return c.html(
          `<div class="note-success">✅ Note posted! <a href="${escapeHtml(result.url)}" target="_blank">View on Substack ↗</a></div>`,
        );
      }
      return c.json({ success: true, noteUrl: result.url, noteId: result.id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const isHtmx = c.req.header('hx-request') === 'true';
      return isHtmx
        ? c.html(`<div class="note-error">❌ ${escapeHtml(message)}</div>`, 500)
        : c.json({ error: message }, 500);
    }
  });

  // ── POST Tweet to X ─────────────────────────────────────────────────────────

  app.post('/api/articles/:id/tweet', async (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) {
      const isHtmx = c.req.header('hx-request') === 'true';
      return isHtmx
        ? c.html('<div class="tweet-error">Article not found</div>', 404)
        : c.json({ error: 'Article not found' }, 404);
    }

    if (!twitterService) {
      const isHtmx = c.req.header('hx-request') === 'true';
      return isHtmx
        ? c.html('<div class="tweet-error">Twitter service not configured</div>', 500)
        : c.json({ error: 'Twitter service not configured' }, 500);
    }

    try {
      const body = await c.req.parseBody();
      let content = String(body['content'] ?? '').trim();
      if (!content) {
        const isHtmx = c.req.header('hx-request') === 'true';
        return isHtmx
          ? c.html('<div class="tweet-error">Tweet content is required</div>', 400)
          : c.json({ error: 'Tweet content is required' }, 400);
      }
      const dryRun = body['dryRun'] === 'on' || body['dryRun'] === 'true';

      // Append article URL if it exists and isn't already in the tweet
      if (article.substack_url && !content.includes(article.substack_url)) {
        content = content + '\n' + article.substack_url;
      }

      const result = await twitterService.postTweet({ content, dryRun });

      const isHtmx = c.req.header('hx-request') === 'true';
      if (isHtmx) {
        const label = dryRun ? '🧪 Dry run — tweet not posted' : '✅ Tweet posted!';
        const link = result.url ? ` <a href="${escapeHtml(result.url)}" target="_blank">View on X ↗</a>` : '';
        return c.html(`<div class="tweet-success">${label}${link}</div>`);
      }
      return c.json({ success: true, tweetUrl: result.url, tweetId: result.id, dryRun });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const isHtmx = c.req.header('hx-request') === 'true';
      return isHtmx
        ? c.html(`<div class="tweet-error">❌ ${escapeHtml(message)}</div>`, 500)
        : c.json({ error: message }, 500);
    }
  });

  // ── API: Generate article images ────────────────────────────────────────

  app.post('/api/articles/:id/generate-images', async (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.json({ error: 'Not found' }, 404);
    if (article.current_stage < 5) {
      return c.json({ error: 'Draft must exist first (Stage 5+)' }, 422);
    }

    if (!imageService) {
      return c.json({ error: 'Image service not configured' }, 500);
    }

    try {
      const draft = repo.artifacts.get(id, 'draft.md');
      const summary = draft?.slice(0, 500) ?? '';
      const team = article.primary_team ?? undefined;

      const results = await imageService.generateArticleImages(id, {
        cover: {
          description: article.title,
          imageType: 'cover',
          articleTitle: article.title,
          articleSummary: summary,
          team,
          aspectRatio: '16:9',
        },
        inline: [
          {
            description: article.title,
            imageType: 'inline',
            articleTitle: article.title,
            articleSummary: summary,
            team,
            aspectRatio: '16:9',
          },
          {
            description: article.title,
            imageType: 'inline',
            articleTitle: article.title,
            articleSummary: summary,
            team,
            aspectRatio: '16:9',
          },
        ],
      });

      const imageManifest: { type: string; path: string; prompt: string }[] = [];
      if (results.cover) {
        imageManifest.push({ type: 'cover', path: results.cover.path, prompt: results.cover.prompt });
      }
      for (const img of results.inline) {
        imageManifest.push({ type: 'inline', path: img.path, prompt: img.prompt });
      }

      repo.artifacts.put(id, 'images.json', JSON.stringify(imageManifest, null, 2));

      return c.json({ success: true, count: imageManifest.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 500);
    }
  });

  // ── htmx: generate images (returns HTML fragment) ───────────────────────

  app.post('/htmx/articles/:id/generate-images', async (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html(renderAdvanceResult(false, 'Article not found'), 404);
    if (article.current_stage < 5) {
      return c.html(renderAdvanceResult(false, 'Draft must exist first (Stage 5+)'), 422);
    }
    if (!imageService) {
      return c.html(renderAdvanceResult(false, 'Image service not configured \u2014 set GEMINI_API_KEY'), 500);
    }

    try {
      // Call imageService directly (NOT autoGenerateImages) so errors propagate to the user
      const rawDraft2 = repo.artifacts.get(id, 'draft.md');
      const summary = rawDraft2 ? separateThinking(rawDraft2).output.slice(0, 500) : '';
      const team = article.primary_team ?? undefined;
      const results = await imageService.generateArticleImages(id, {
        cover: { description: article.title, imageType: 'cover', articleTitle: article.title, articleSummary: summary, team, aspectRatio: '16:9' },
        inline: [
          { description: article.title, imageType: 'inline', articleTitle: article.title, articleSummary: summary, team, aspectRatio: '16:9' },
          { description: article.title, imageType: 'inline', articleTitle: article.title, articleSummary: summary, team, aspectRatio: '16:9' },
        ],
      });
      const manifest: { type: string; path: string; prompt: string }[] = [];
      if (results.cover) manifest.push({ type: 'cover', path: results.cover.path, prompt: results.cover.prompt });
      for (const img of results.inline) manifest.push({ type: 'inline', path: img.path, prompt: img.prompt });
      repo.artifacts.put(id, 'images.json', JSON.stringify(manifest, null, 2));
      return c.html(
        `<div class="advance-result advance-success">\u2705 Generated ${manifest.length} image(s)</div>
         ${renderImageGallery(manifest)}`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.html(renderAdvanceResult(false, `Image generation failed: ${message}`), 500);
    }
  });

  // ── htmx: image gallery ─────────────────────────────────────────────────

  app.get('/htmx/articles/:id/images', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html('<p class="empty-state">Article not found</p>', 404);

    const manifestJson = repo.artifacts.get(id, 'images.json');
    if (!manifestJson) {
      return c.html('<p class="empty-state">No images generated yet</p>');
    }

    try {
      const manifest = JSON.parse(manifestJson) as { type: string; path: string; prompt: string }[];
      return c.html(renderImageGallery(manifest));
    } catch {
      return c.html('<p class="empty-state">Invalid image manifest</p>');
    }
  });

  // ── Agent charter & skill viewer ──────────────────────────────────────────

  function resolveCharterPath(name: string): string | null {
    const candidates = [
      join(config.chartersDir, `${name}.md`),
      join(config.chartersDir, name, 'charter.md'),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }

    return null;
  }

  function readCharterSummaries(): CharterSummary[] {
    if (!existsSync(config.chartersDir)) return [];

    return readdirSync(config.chartersDir, { withFileTypes: true })
      .flatMap((entry): CharterSummary[] => {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const content = readFileSync(join(config.chartersDir, entry.name), 'utf-8');
          return [{
            name: entry.name.replace(/\.md$/i, ''),
            filename: entry.name,
            type: classifyCharter(entry.name),
            identity: extractIdentity(content),
          }];
        }

        if (entry.isDirectory()) {
          const filePath = join(config.chartersDir, entry.name, 'charter.md');
          if (!existsSync(filePath)) return [];

          const content = readFileSync(filePath, 'utf-8');
          return [{
            name: entry.name,
            filename: `${entry.name}\\charter.md`,
            type: classifyCharter(entry.name),
            identity: extractIdentity(content),
          }];
        }

        return [];
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function readSkillSummaries(): SkillSummary[] {
    if (!existsSync(config.skillsDir)) return [];
    return readdirSync(config.skillsDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .map(f => ({
        name: f.replace(/\.md$/i, ''),
        filename: f,
      }));
  }

  app.get('/agents', (c) => {
    return c.html(
      renderAgentsPage({
        labName: config.leagueConfig.name,
        charters: readCharterSummaries(),
        skills: readSkillSummaries(),
      }),
    );
  });

  // skills/:name MUST come before :name to avoid the catch-all matching "skills"
  app.get('/agents/skills/:name', (c) => {
    const name = c.req.param('name');
    const filePath = join(config.skillsDir, `${name}.md`);
    if (!existsSync(filePath)) {
      return c.html('<p class="empty-state">Skill not found</p>', 404);
    }
    const content = readFileSync(filePath, 'utf-8');
    return c.html(renderSkillDetail(name, content, config.leagueConfig.name));
  });

  app.get('/agents/:name', (c) => {
    const name = c.req.param('name');
    const filePath = resolveCharterPath(name);
    if (!filePath) {
      return c.html('<p class="empty-state">Charter not found</p>', 404);
    }
    const content = readFileSync(filePath, 'utf-8');
    let memoryHtml: string | undefined;
    if (memory) {
      const entries = memory.recall(name, { limit: 50, includeExpired: true });
      memoryHtml = renderAgentMemorySection(name, entries);
    }
    return c.html(renderCharterDetail(name, content, config.leagueConfig.name, memoryHtml));
  });

  // ── htmx: agent charter/skill inline editing ─────────────────────────────

  app.get('/htmx/agents/skills/:name/edit', (c) => {
    const name = c.req.param('name');
    const filePath = join(config.skillsDir, `${name}.md`);
    if (!existsSync(filePath)) return c.html('<p class="empty-state">Skill not found</p>', 404);
    const content = readFileSync(filePath, 'utf-8');
    return c.html(renderSkillEditForm(name, content));
  });

  app.get('/htmx/agents/skills/:name/view', (c) => {
    const name = c.req.param('name');
    const filePath = join(config.skillsDir, `${name}.md`);
    if (!existsSync(filePath)) return c.html('<p class="empty-state">Skill not found</p>', 404);
    const content = readFileSync(filePath, 'utf-8');
    return c.html(renderSkillView(name, content));
  });

  app.get('/htmx/agents/:name/edit', (c) => {
    const name = c.req.param('name');
    const filePath = resolveCharterPath(name);
    if (!filePath) return c.html('<p class="empty-state">Charter not found</p>', 404);
    const content = readFileSync(filePath, 'utf-8');
    return c.html(renderCharterEditForm(name, content));
  });

  app.get('/htmx/agents/:name/view', (c) => {
    const name = c.req.param('name');
    const filePath = resolveCharterPath(name);
    if (!filePath) return c.html('<p class="empty-state">Charter not found</p>', 404);
    const content = readFileSync(filePath, 'utf-8');
    return c.html(renderCharterView(name, content));
  });

  app.put('/api/agents/skills/:name', async (c) => {
    const name = c.req.param('name');
    const filePath = join(config.skillsDir, `${name}.md`);
    if (!existsSync(filePath)) return c.html('<p class="empty-state">Skill not found</p>', 404);
    const body = await c.req.parseBody();
    const content = typeof body['content'] === 'string' ? body['content'] : '';
    writeFileSync(filePath, content, 'utf-8');
    return c.html(renderSkillView(name, content));
  });

  app.put('/api/agents/:name', async (c) => {
    const name = c.req.param('name');
    const filePath = resolveCharterPath(name);
    if (!filePath) return c.html('<p class="empty-state">Charter not found</p>', 404);

    // Read existing content for history
    const existingContent = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';

    const body = await c.req.parseBody();
    const content = typeof body['content'] === 'string' ? body['content'] : '';

    // Save history if content actually changed
    if (existingContent.trim() !== content.trim()) {
      try {
        repo.insertCharterHistory(name, existingContent);
      } catch (_) { /* non-fatal */ }
    }

    writeFileSync(filePath, content, 'utf-8');
    return c.html(renderCharterView(name, content));
  });

  // ── Charter History ─────────────────────────────────────────────────────

  app.get('/api/agents/:name/history', (c) => {
    const name = c.req.param('name');
    const rows = repo.getCharterHistorySummary(name);
    return c.json(rows);
  });

  app.get('/htmx/agents/:name/history', (c) => {
    const name = c.req.param('name');
    const rows = repo.getCharterHistory(name);

    if (rows.length === 0) {
      return c.html('<p class="empty-state">No edit history</p>');
    }

    const items = rows.map(r => `
      <details class="history-entry">
        <summary>${formatDate(r.edited_at)} — ${r.content.length} chars</summary>
        <pre class="history-content">${escapeHtml(r.content.slice(0, 2000))}</pre>
      </details>
    `).join('');

    return c.html(`<div class="charter-history">${items}</div>`);
  });

  // ── Memory Browser ──────────────────────────────────────────────────────

  /** Helper: open a lightweight admin connection for delete/update ops not in AgentMemory API. */
  function memoryAdminDb(): DatabaseSync | null {
    if (!config.memoryDbPath || !existsSync(config.memoryDbPath)) return null;
    return new DatabaseSync(config.memoryDbPath);
  }

  /** Helper: get current filter params and refresh the memory table. */
  function getFilteredEntries(c: { req: { query: (k: string) => string | undefined } }): { entries: import('../agents/memory.js').MemoryEntry[]; agent?: string; category?: string; search?: string } {
    const agent = c.req.query('agent') || undefined;
    const category = c.req.query('category') || undefined;
    const search = c.req.query('search') || undefined;

    if (!memory) return { entries: [], agent, category, search };

    if (agent) {
      return {
        entries: memory.recall(agent, {
          category: category as MemoryCategory | undefined,
          limit: 200,
          includeExpired: true,
        }).filter(e => !search || e.content.toLowerCase().includes(search.toLowerCase())),
        agent, category, search,
      };
    }

    return {
      entries: memory.recallGlobal({
        category: category as MemoryCategory | undefined,
        search,
        limit: 200,
      }),
      agent, category, search,
    };
  }

  app.get('/memory', (c) => {
    if (!memory) {
      return c.html(renderLayout('Memory', '<div class="empty-state">Agent memory is not available. Start the server with LLM providers configured.</div>', config.leagueConfig.name));
    }

    const { entries, agent, category, search } = getFilteredEntries(c);
    const stats = memory.stats();
    const agentNames = stats.map(s => s.agentName);

    return c.html(renderMemoryPage({
      labName: config.leagueConfig.name,
      entries,
      stats,
      filters: { agent, category, search },
      agentNames,
    }));
  });

  // htmx: filtered memory table partial
  app.get('/htmx/memory', (c) => {
    const { entries } = getFilteredEntries(c);
    return c.html(renderMemoryTable(entries));
  });

  // htmx: single entry edit form
  app.get('/htmx/memory/:id/edit', (c) => {
    const id = parseInt(c.req.param('id'), 10);
    if (!memory) return c.html('', 404);
    const entries = memory.recallGlobal({ limit: 500 });
    const entry = entries.find(e => e.id === id);
    if (!entry) return c.html('', 404);
    return c.html(renderMemoryEditRow(entry));
  });

  // htmx: single entry view (cancel edit)
  app.get('/htmx/memory/:id/view', (c) => {
    const id = parseInt(c.req.param('id'), 10);
    if (!memory) return c.html('', 404);
    const entries = memory.recallGlobal({ limit: 500 });
    const entry = entries.find(e => e.id === id);
    if (!entry) return c.html('', 404);
    return c.html(renderMemoryRow(entry));
  });

  // Delete a single memory entry
  app.delete('/api/memory/:id', (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const db = memoryAdminDb();
    if (!db) return c.html('', 404);
    try {
      db.prepare('DELETE FROM agent_memory WHERE id = ?').run(id);
      return c.html(''); // Empty response removes the row via hx-swap="outerHTML"
    } finally {
      db.close();
    }
  });

  // Update a memory entry
  app.put('/api/memory/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const db = memoryAdminDb();
    if (!db) return c.html('', 404);
    try {
      const body = await c.req.parseBody();
      const content = typeof body['content'] === 'string' ? body['content'] : undefined;
      const category = typeof body['category'] === 'string' ? body['category'] : undefined;
      const relevanceStr = typeof body['relevanceScore'] === 'string' ? body['relevanceScore'] : undefined;
      const relevanceScore = relevanceStr ? parseFloat(relevanceStr) : undefined;

      const sets: string[] = [];
      const params: (string | number)[] = [];
      if (content !== undefined) { sets.push('content = ?'); params.push(content); }
      if (category !== undefined) { sets.push('category = ?'); params.push(category); }
      if (relevanceScore !== undefined && !isNaN(relevanceScore)) { sets.push('relevance_score = ?'); params.push(relevanceScore); }

      if (sets.length > 0) {
        params.push(id);
        db.prepare(`UPDATE agent_memory SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      }

      // Re-fetch updated entry to render the row
      const row = db.prepare('SELECT * FROM agent_memory WHERE id = ?').get(id) as any;
      if (!row) return c.html('', 404);
      const entry = {
        id: row.id,
        agentName: row.agent_name,
        category: row.category,
        content: row.content,
        sourceSession: row.source_session,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        relevanceScore: row.relevance_score,
        accessCount: row.access_count,
      } as import('../agents/memory.js').MemoryEntry;
      return c.html(renderMemoryRow(entry));
    } finally {
      db.close();
    }
  });

  // Create a new memory entry
  app.post('/api/memory', async (c) => {
    if (!memory) return c.html('<div class="empty-state">Memory not available</div>', 500);
    const body = await c.req.parseBody();
    const agentName = typeof body['agentName'] === 'string' ? body['agentName'] : '';
    const category = typeof body['category'] === 'string' ? body['category'] as MemoryCategory : 'learning';
    const content = typeof body['content'] === 'string' ? body['content'] : '';
    const relevanceStr = typeof body['relevanceScore'] === 'string' ? body['relevanceScore'] : '1.0';
    const relevanceScore = parseFloat(relevanceStr) || 1.0;

    if (!agentName || !content) {
      return c.html('<div class="empty-state">Agent name and content are required.</div>', 400);
    }

    memory.store({ agentName, category, content, relevanceScore });

    // Return refreshed table
    const entries = memory.recallGlobal({ limit: 200 });
    return c.html(renderMemoryTable(entries));
  });

  // Prune stale entries
  app.post('/api/memory/prune', (c) => {
    if (!memory) return c.html('<div class="empty-state">Memory not available</div>', 500);
    const pruned = memory.prune();
    const entries = memory.recallGlobal({ limit: 200 });
    return c.html(
      `<div class="memory-action-result">Pruned ${pruned} stale entries</div>` +
      renderMemoryTable(entries),
    );
  });

  // Decay all agents
  app.post('/api/memory/decay', (c) => {
    if (!memory) return c.html('<div class="empty-state">Memory not available</div>', 500);
    const stats = memory.stats();
    let totalDecayed = 0;
    for (const s of stats) {
      totalDecayed += memory.decay(s.agentName);
    }
    const entries = memory.recallGlobal({ limit: 200 });
    return c.html(
      `<div class="memory-action-result">Decayed ${totalDecayed} entries across ${stats.length} agents</div>` +
      renderMemoryTable(entries),
    );
  });

  // ── Pipeline Runs page ────────────────────────────────────────────────────

  app.get('/runs', (c) => {
    const statusQuery = c.req.query('status');
    const statusFilter: RunsFilters['status'] =
      statusQuery === 'success' || statusQuery === 'error' ? statusQuery : '';
    const search = c.req.query('search') || undefined;
    const limitStr = c.req.query('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const filters = { status: statusFilter, search };
    const runs = repo.getAllStageRuns({ ...filters, limit, offset: 0 });
    const totalCount = repo.countAllStageRuns(filters);
    return c.html(
      renderRunsPage({ config, runs, filters, totalCount, offset: 0, limit }),
    );
  });

  // ── htmx: filtered runs partial ───────────────────────────────────────────

  app.get('/htmx/runs', (c) => {
    const statusQuery = c.req.query('status');
    const statusFilter: RunsFilters['status'] =
      statusQuery === 'success' || statusQuery === 'error' ? statusQuery : '';
    const search = c.req.query('search') || undefined;
    const offsetStr = c.req.query('offset');
    const limitStr = c.req.query('limit');
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const filters = { status: statusFilter, search };
    const runs = repo.getAllStageRuns({ ...filters, limit, offset });
    const totalCount = repo.countAllStageRuns(filters);
    return c.html(renderRunsTable(runs, filters, totalCount, offset, limit));
  });

  return app;
}

// ── Server startup ───────────────────────────────────────────────────────────

export async function startServer(overrides?: Partial<AppConfig>): Promise<void> {
  const config = loadConfig(overrides);
  initDataDir(config.dataDir, config.league);
  const repo = new Repository(config.dbPath);

  // Build ActionContext for agent-powered auto-advance (optional)
  let actionContext: ActionContext | undefined;
  let memory: AgentMemory | undefined;
  try {
    const modelPolicy = new ModelPolicy();
    const gateway = new LLMGateway({ modelPolicy });

    // Register available LLM providers
    if (process.env['MOCK_LLM'] === '1') {
      const mock = new MockProvider();
      gateway.registerProvider(mock);
      console.log('Mock LLM provider registered (testing mode)');
    } else if (process.env['LLM_PROVIDER'] === 'lmstudio' || process.env['LMSTUDIO_URL']) {
      const baseUrl = process.env['LMSTUDIO_URL'] ?? undefined;
      const defaultModel = process.env['LMSTUDIO_MODEL'] ?? undefined;
      const lmstudio = new LMStudioProvider({ baseUrl, defaultModel });
      // Auto-detect loaded models and pick the first non-embedding one
      try {
        const models = await lmstudio.fetchModels();
        if (models.length > 0 && !defaultModel) {
          const chatModel = models.find(m => !m.includes('embed')) ?? models[0];
          (lmstudio as any).defaultModel = chatModel;
        }
      } catch { /* LM Studio may not be running yet */ }
      gateway.registerProvider(lmstudio);
      console.log(`LM Studio provider registered (${lmstudio.baseUrl}, model: ${lmstudio.defaultModel})`);
    } else {
      try {
        const copilot = new CopilotProvider();
        copilot.resolveToken(); // Verify token is available before registering
        gateway.registerProvider(copilot);
        console.log('Copilot Pro+ provider registered (GitHub Models API)');
      } catch (err) {
        console.log(`Copilot provider not available: ${err instanceof Error ? err.message : err}`);
      }
    }

    memory = new AgentMemory(config.memoryDbPath);
    const runner = new AgentRunner({
      gateway,
      memory,
      chartersDir: config.chartersDir,
      skillsDir: config.skillsDir,
    });
    const engine = new PipelineEngine(repo);
    const auditor = new PipelineAuditor(repo, config.logsDir);

    actionContext = { repo, engine, runner, auditor, config };
    console.log('Agent runner initialized — auto-advance will invoke LLM agents');
  } catch (err) {
    console.log(`Agent runner not available — auto-advance will use lightweight mode: ${err instanceof Error ? err.message : err}`);
  }

  // Build ImageService (Gemini if key available, otherwise stub)
  let imageService: ImageService | undefined;
  try {
    const geminiKey = process.env['GEMINI_API_KEY'];
    const provider = geminiKey ? 'gemini' : 'stub';
    if (!geminiKey) {
      console.log('GEMINI_API_KEY not set — using stub image provider (placeholder PNGs)');
    }
    imageService = new ImageService({
      provider,
      apiKey: geminiKey,
      outputDir: config.imagesDir,
    });
    console.log(`Image service initialized (provider: ${provider})`);
  } catch (err) {
    console.log(`Image service not available: ${err instanceof Error ? err.message : err}`);
  }

  const app = createApp(repo, config, { actionContext, imageService, memory });

  serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`NFL Lab Dashboard running at http://localhost:${info.port}`);
  });
}

// Allow direct execution: npx tsx src/dashboard/server.ts
if (require.main === module) {
  startServer();
}
