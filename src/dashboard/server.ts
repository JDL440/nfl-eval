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
} from './views/home.js';
import { renderArticleDetail, renderArtifactContent, renderAdvanceResult, renderUsagePanel, renderStageRunsPanel, ARTIFACT_FILES } from './views/article.js';
import type { ArtifactName } from './views/article.js';
import { escapeHtml } from './views/layout.js';
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
} from './views/publish.js';
import { markdownToProseMirror } from '../services/prosemirror.js';
import type { SubstackService } from '../services/substack.js';
import { executeTransition, type ActionContext } from '../pipeline/actions.js';
import { LLMGateway } from '../llm/gateway.js';
import { ModelPolicy } from '../llm/model-policy.js';
import { AgentRunner } from '../agents/runner.js';
import { AgentMemory } from '../agents/memory.js';
import { PipelineAuditor } from '../pipeline/audit.js';
import { CopilotProvider } from '../llm/providers/copilot.js';
import { MockProvider } from '../llm/providers/mock.js';
import { LMStudioProvider } from '../llm/providers/lmstudio.js';

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
  deps?: { substackService?: SubstackService; actionContext?: ActionContext },
): Hono {
  const app = new Hono();
  const substackService = deps?.substackService;

  // ── Static files ──────────────────────────────────────────────────────────
  const publicRoot = join(__dirname, 'public');
  app.use(
    '/static/*',
    serveStatic({
      root: publicRoot,
      rewriteRequestPath: (path: string) => path.replace(/^\/static/, ''),
    }),
  );

  // ── HTML pages ────────────────────────────────────────────────────────────

  app.get('/', (c) => {
    const articles = repo.getAllArticles();
    return c.html(
      renderHome({
        config,
        readyArticles: articles.filter(a => a.current_stage === 7),
        recentIdeas: articles.filter(a => a.current_stage === 1),
        published: articles.filter(a => a.current_stage === 8),
        pipelineSummary: buildPipelineSummary(articles),
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
    if (from === 'auto-advance') {
      if (errorParam) {
        errorMessage = `Auto-advance failed: ${errorParam}`;
      } else {
        flashMessage = `🚀 Auto-advance ran — article is now at Stage ${article.current_stage} (${STAGE_NAMES[article.current_stage as Stage]})`;
      }
    }

    return c.html(
      renderArticleDetail({
        config,
        article,
        transitions: repo.getStageTransitions(id),
        reviews: repo.getEditorReviews(id),
        publisherPass: repo.getPublisherPass(id),
        advanceCheck,
        usageEvents: repo.getUsageEvents(id),
        stageRuns: repo.getStageRuns(id),
        flashMessage,
        errorMessage,
      }),
    );
  });

  app.get('/ideas/new', (c) => {
    return c.html(renderNewIdeaPage({ labName: config.leagueConfig.name }));
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
      const depthLevel = [1, 2, 3].includes(body.depthLevel) ? body.depthLevel : 2;
      const autoAdvance = body.autoAdvance === true;
      const actionContext = deps?.actionContext;

      let ideaContent: string;
      let title: string;

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

      repo.artifacts.put(slug, 'idea.md', ideaContent);

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

    const maxStage = 7; // Stop before publish
    const engine = new PipelineEngine(repo);
    const steps: { from: number; to: number; action: string; duration?: number }[] = [];
    let lastError: string | undefined;

    let current = repo.getArticle(id)!;

    // If we have an ActionContext (agents available), use executeTransition
    const ctx = deps?.actionContext;

    while (current.current_stage < maxStage) {
      if (ctx) {
        // Full execution: run agent → write artifact → advance
        const result = await executeTransition(id, current.current_stage as Stage, ctx);
        if (!result.success) {
          lastError = result.error;

          // Check for editor REVISE verdict — regress to draft stage
          if (current.current_stage === 5 && result.error?.includes('REVISE')) {
            try {
              engine.regress(id, current.current_stage as Stage, 4 as Stage, 'auto-advance', 'Editor requested revisions');
              steps.push({
                from: current.current_stage,
                to: 4,
                action: 'Sent back to Stage 4 — Editor requested revisions',
                duration: result.duration,
              });
            } catch { /* ignore regression failure */ }
          }
          break;
        }

        const updated = repo.getArticle(id)!;
        steps.push({
          from: current.current_stage,
          to: updated.current_stage,
          action: `Advanced to Stage ${updated.current_stage} — ${STAGE_NAMES[updated.current_stage as Stage]}`,
          duration: result.duration,
        });
        current = updated;
      } else {
        // Lightweight mode (no agents): just check guards and advance
        const check = engine.canAdvance(id, current.current_stage as Stage);
        if (!check.allowed) {
          lastError = check.reason;
          break;
        }

        try {
          const newStage = engine.advance(id, current.current_stage as Stage, 'auto-advance');
          steps.push({
            from: current.current_stage,
            to: newStage,
            action: `Advanced to Stage ${newStage} — ${STAGE_NAMES[newStage]}`,
          });
          current = repo.getArticle(id)!;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          break;
        }
      }
    }

    current = repo.getArticle(id)!;
    return c.json({
      id,
      currentStage: current.current_stage,
      steps,
      stoppedAt: current.current_stage,
      reason: lastError
        ?? (current.current_stage >= maxStage
          ? 'Reached Stage 7 — ready for publish review'
          : engine.canAdvance(id, current.current_stage as Stage).reason),
    });
  });

  // ── htmx partial routes (HTML fragments) ──────────────────────────────────

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

  // ── htmx: artifact content tab ────────────────────────────────────────────

  app.get('/htmx/articles/:id/artifact/:name', (c) => {
    const id = c.req.param('id');
    const name = c.req.param('name');
    const article = repo.getArticle(id);
    if (!article) return c.html(renderArtifactContent(name, null), 404);

    // Validate artifact name
    if (!(ARTIFACT_FILES as readonly string[]).includes(name)) {
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

    // Reuse the same auto-advance logic as POST /api/articles/:id/auto-advance
    const maxStage = 7;
    const engine = new PipelineEngine(repo);
    const steps: { from: number; to: number; action: string; duration?: number }[] = [];
    let lastError: string | undefined;

    let current = repo.getArticle(id)!;
    const ctx = deps?.actionContext;

    while (current.current_stage < maxStage) {
      if (ctx) {
        const result = await executeTransition(id, current.current_stage as Stage, ctx);
        if (!result.success) {
          lastError = result.error;
          if (current.current_stage === 5 && result.error?.includes('REVISE')) {
            try {
              engine.regress(id, current.current_stage as Stage, 4 as Stage, 'auto-advance', 'Editor requested revisions');
              steps.push({ from: current.current_stage, to: 4, action: 'Sent back to Stage 4 — Editor requested revisions', duration: result.duration });
            } catch { /* ignore regression failure */ }
          }
          break;
        }
        const updated = repo.getArticle(id)!;
        steps.push({ from: current.current_stage, to: updated.current_stage, action: `Advanced to Stage ${updated.current_stage} — ${STAGE_NAMES[updated.current_stage as Stage]}`, duration: result.duration });
        current = updated;
      } else {
        const check = engine.canAdvance(id, current.current_stage as Stage);
        if (!check.allowed) { lastError = check.reason; break; }
        try {
          const newStage = engine.advance(id, current.current_stage as Stage, 'auto-advance');
          steps.push({ from: current.current_stage, to: newStage, action: `Advanced to Stage ${newStage} — ${STAGE_NAMES[newStage]}` });
          current = repo.getArticle(id)!;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          break;
        }
      }
    }

    current = repo.getArticle(id)!;

    if (lastError) {
      const stepsHtml = steps.length > 0
        ? `<div style="margin-bottom:0.5rem">Traversed ${steps.length} stage(s) before failing.</div>`
        : '';
      return c.html(
        `<div class="advance-result advance-error">${stepsHtml}❌ ${escapeHtml(lastError)}</div>`,
        200,
      );
    }

    const stageList = steps.map(s => `Stage ${s.to}`).join(' → ');
    return c.html(
      `<div class="advance-result advance-success">✅ Auto-advanced: ${escapeHtml(stageList)}. Now at Stage ${current.current_stage} — ${escapeHtml(STAGE_NAMES[current.current_stage as Stage] ?? 'Unknown')}.</div>
       <script>setTimeout(() => window.location.reload(), 1500);</script>`,
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

  // ── Publish workflow routes ─────────────────────────────────────────────────

  app.get('/articles/:id/publish', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.notFound();

    const publisherPass = repo.getPublisherPass(id);
    let htmlPreview = '';

    // Load article markdown from DB artifact store
    const markdown = repo.artifacts.get(id, 'draft.md');
    if (markdown) {
      const doc = markdownToProseMirror(markdown);
      htmlPreview = proseMirrorToHtml(doc);
    } else {
      htmlPreview = '<p class="empty-state">No article draft found</p>';
    }

    return c.html(
      renderPublishPreview({
        config,
        article,
        htmlPreview,
        publisherPass,
      }),
    );
  });

  app.get('/htmx/articles/:id/preview', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html('<p class="empty-state">Article not found</p>', 404);

    const markdown = repo.artifacts.get(id, 'draft.md');
    if (!markdown) {
      return c.html('<p class="empty-state">No article draft found</p>');
    }

    const doc = markdownToProseMirror(markdown);
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

  // ── SSE stub for future real-time updates ─────────────────────────────────
  // app.get('/events', (c) => { ... Server-Sent Events stream ... });

  return app;
}

// ── Server startup ───────────────────────────────────────────────────────────

export async function startServer(overrides?: Partial<AppConfig>): Promise<void> {
  const config = loadConfig(overrides);
  initDataDir(config.dataDir);
  const repo = new Repository(config.dbPath);

  // Build ActionContext for agent-powered auto-advance (optional)
  let actionContext: ActionContext | undefined;
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

    const memory = new AgentMemory(config.memoryDbPath);
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

  const app = createApp(repo, config, { actionContext });

  serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`NFL Lab Dashboard running at http://localhost:${info.port}`);
  });
}

// Allow direct execution: npx tsx src/dashboard/server.ts
if (require.main === module) {
  startServer();
}
