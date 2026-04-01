/**
 * server.ts — Hono HTTP server for the NFL Lab editorial workstation.
 *
 * Two primary actions: submit an idea (left of pipeline) and publish (right).
 * Everything else is status visibility rendered with htmx partials.
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { join, resolve } from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createServer as createHttpsServer } from 'node:https';
import { createServer as createHttpServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Repository } from '../db/repository.js';
import type { AppConfig } from '../config/index.js';
import {
  COPILOT_CLI_DEFAULT_MODE,
  COPILOT_CLI_DEFAULT_MODEL,
  COPILOT_CLI_DEFAULT_SESSION_REUSE,
  COPILOT_CLI_DEFAULT_WEB_SEARCH,
  loadConfig,
  prepareRuntimeDataDir,
  resolveDashboardAuthConfig,
} from '../config/index.js';
import { STAGE_NAMES, VALID_STAGES } from '../types.js';
import type { Stage, Article } from '../types.js';
import { SettingsResolver } from '../settings/resolver.js';
import { ensureBootstrapAdmin } from '../settings/bootstrap.js';
import { encryptSecret, isSecretCryptoAvailable } from '../settings/crypto.js';
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
  renderImageGallery,
  renderArticleMetaDisplay,
  renderArticleMetaEditForm,
  renderLiveHeader,
  renderLiveArtifacts,
  ARTIFACT_FILES,
  OPTIONAL_ARTIFACT_FILES,
} from './views/article.js';
import type { ArtifactName } from './views/article.js';
import { ImageService } from '../services/image.js';
import type { ImageGenerationConfig, ImageResult } from '../services/image.js';
import { estimateImageCost, estimateCost } from '../llm/pricing.js';
import { escapeHtml } from './views/layout.js';
import {
  renderNewIdeaPage,
  renderIdeaSuccess,
  generateSlug,
  extractTitleFromIdea,
  IDEA_TEMPLATE,
} from './views/new-idea.js';
import {
  renderPublishPreview,
  renderPublishWorkflow,
  proseMirrorToHtml,
  extractDraftId,
  renderNoteComposer,
  renderTweetComposer,
  CHECKLIST_ITEMS,
} from './views/publish.js';
import {
  buildCaptionedImage,
  createSubscribeWidget,
  extractMetaFromMarkdown,
  isFooterParagraph,
  markdownToProseMirror,
  validateProseMirrorBody,
  type ProseMirrorDoc,
  type ProseMirrorNode,
} from '../services/prosemirror.js';
import { markdownToHtml } from '../services/markdown.js';
import { renderArticlePreview, renderArticlePreviewFrame, parseImageManifest } from './views/preview.js';
import { SubstackService } from '../services/substack.js';
import { TwitterService } from '../services/twitter.js';
import { executeTransition, autoAdvanceArticle, getLeagueDataTool, type ActionContext, type AutoAdvanceStep } from '../pipeline/actions.js';
import { assertPipelineConfigValid } from '../pipeline/validation.js';
import { buildTeamRosterContext } from '../pipeline/roster-context.js';
import { LLMGateway } from '../llm/gateway.js';
import { ModelPolicy } from '../llm/model-policy.js';
import { AgentRunner, separateThinking } from '../agents/runner.js';
import { AgentMemory } from '../agents/memory.js';
import { PipelineAuditor } from '../pipeline/audit.js';
import { aggregatePublishIssues } from '../pipeline/issue-aggregator.js';
import {
  buildRevisionHistoryEntries,
  getArticleConversation,
  getRevisionHistory,
} from '../pipeline/conversation.js';
import { CopilotProvider } from '../llm/providers/copilot.js';
import { CopilotCLIProvider } from '../llm/providers/copilot-cli.js';
import { MockProvider } from '../llm/providers/mock.js';
import { LMStudioProvider } from '../llm/providers/lmstudio.js';
import { GeminiProvider } from '../llm/providers/gemini.js';
import { EventBus, registerSSE } from '../dashboard/sse.js';
import { initGlobalCache, FileCacheProvider } from '../cache/index.js';
import { renderConfigPage } from './views/config.js';
import { renderArticleTraceTimelinePage, renderStandaloneTracePage } from './views/traces.js';
import { renderLoginPage } from './views/login.js';

export const APP_TOOL_LOOP_PROVIDER_IDS = [
  'anthropic',
  'copilot',
  'gemini',
  'lmstudio',
  'local',
  'openai',
] as const;

export function buildDashboardToolLoopOptions(): ConstructorParameters<typeof AgentRunner>[0]['toolLoop'] {
  return {
    enabledProviders: [...APP_TOOL_LOOP_PROVIDER_IDS],
    enableWebSearch: true,
    maxToolCalls: 12,
  };
}

export function getAutoAdvanceArticleFlash(params: {
  from?: string | null;
  error?: string | null;
  currentStage: number;
  status: Article['status'];
  isRunning: boolean;
}): { flashMessage?: string; errorMessage?: string } {
  if (params.from !== 'auto-advance') {
    return {};
  }

  if (params.error) {
    return { errorMessage: `Auto-advance failed: ${params.error}` };
  }

  if (params.isRunning) {
    return {
      flashMessage: '🚀 Auto-advance is running — live sections will refresh as each stage completes.',
    };
  }

  if (params.currentStage === 6 && params.status === 'needs_lead_review') {
    return {
      flashMessage: '⏸ Auto-advance paused at Lead review — repeated editor blocker detected at Stage 6.',
    };
  }

  return {
    flashMessage: `🚀 Auto-advance complete — article is at Stage ${params.currentStage} (${STAGE_NAMES[params.currentStage as Stage]})`,
  };
}

/** Render the AI review result panel with markdown → HTML, refresh button, and spinner. */
function renderAiReviewResult(escapedId: string, markdown: string): string {
  const htmlBody = markdownToHtml(markdown);
  return `
    <div class="ai-review-result">
      <div class="ai-review-body">${htmlBody}</div>
      <p class="hint" style="margin-top: 0.5rem;">Generated from pipeline artifacts. Re-generate if the draft has been updated.</p>
      <button class="btn btn-secondary btn-sm"
        hx-get="/htmx/articles/${escapedId}/ai-review?refresh=1"
        hx-target="#ai-review-content"
        hx-swap="innerHTML"
        hx-indicator="#ai-review-spinner">
        🔄 Refresh
      </button>
      <span id="ai-review-spinner" class="htmx-indicator">Analyzing…</span>
    </div>`;
}

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

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function buildLoginRedirectPath(rawPath: string | undefined): string {
  if (!rawPath || !rawPath.startsWith('/') || rawPath.startsWith('//') || rawPath.includes('\\')) {
    return '/';
  }
  return rawPath;
}

function buildLoginUrl(request: Request): string {
  const url = new URL(request.url);
  const returnTo = buildLoginRedirectPath(`${url.pathname}${url.search}`);
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
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

  // Security headers — applied to all responses
  app.use('*', async (c, next) => {
    await next();
    c.header('X-Frame-Options', 'DENY');
    c.header('X-Content-Type-Options', 'nosniff');
  });

  const dashboardAuth = resolveDashboardAuthConfig(config.env, config.dashboardAuth);
  const substackService = deps?.substackService;
  const twitterService = deps?.twitterService;
  const imageService = deps?.imageService;
  const memory = deps?.memory;
  const bus = new EventBus();

  repo.deleteExpiredDashboardSessions();

  // Track active auto-advance runs so duplicate launches are blocked and SSE updates stay coherent.
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

      // Record image generation token usage
      if (results.totalUsage) {
        repo.recordUsageEvent({
          articleId,
          stage: art.current_stage,
          surface: 'imageGeneration',
          provider: 'gemini',
          modelOrTool: 'gemini-3-pro-image-preview',
          eventType: 'completed',
          promptTokens: results.totalUsage.promptTokens,
          outputTokens: results.totalUsage.completionTokens,
          imageCount: manifest.length,
          costUsdEstimate: estimateImageCost(results.totalUsage.promptTokens, results.totalUsage.completionTokens),
        });
      }

      console.log(`[images] Generated ${manifest.length} images for ${articleId}`);
    } catch (err) {
      console.warn(`[images] Generation failed (non-fatal): ${err instanceof Error ? err.message : err}`);
    }
  }

  function buildPublishPresentation(articleId: string, options?: { previewMode?: boolean }): {
    htmlBody: string;
    coverImageUrl: string | null;
    inlineImageUrls: string[];
    substackDoc: ProseMirrorDoc | null;
    extractedSubtitle: string | null;
  } {
    const rawDraft = repo.artifacts.get(articleId, 'draft.md');
    let htmlBody = '<p class="empty-state">No article draft found yet. Re-run drafting or send the article back to editing.</p>';
    let substackDoc: ProseMirrorDoc | null = null;
    let extractedSubtitle: string | null = null;

    if (rawDraft) {
      const cleanDraft = separateThinking(rawDraft).output;
      // Strip title/subtitle from body — they are sent as Substack API metadata,
      // not as part of the article body.
      const { bodyMarkdown, subtitle: draftSubtitle } = extractMetaFromMarkdown(cleanDraft);
      const doc = markdownToProseMirror(bodyMarkdown, { previewMode: options?.previewMode });
      htmlBody = proseMirrorToHtml(doc);
      substackDoc = doc;
      extractedSubtitle = draftSubtitle;
    }

    let coverImageUrl: string | null = null;
    let inlineImageUrls: string[] = [];
    const manifestJson = repo.artifacts.get(articleId, 'images.json');
    if (manifestJson) {
      const parsed = parseImageManifest(manifestJson);
      coverImageUrl = parsed.cover;
      inlineImageUrls = parsed.inlines;
    }

    return { htmlBody, coverImageUrl, inlineImageUrls, substackDoc, extractedSubtitle };
  }

  /**
   * Build a ProseMirror horizontal rule node.
   */
  function buildHorizontalRule(): ProseMirrorNode {
    return { type: 'horizontal_rule' };
  }

  /**
   * Build publication blurb as ProseMirror nodes.
   */
  function buildBlurbNode(labName: string): ProseMirrorNode {
    return {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'The ', marks: [{ type: 'em' }] },
        { type: 'text', text: labName, marks: [{ type: 'em' }] },
        { type: 'text', text: ' is a virtual front office — specialized AI analysts who debate every angle of every move, moderated and fact-checked by a human editor. When they disagree, that disagreement ', marks: [{ type: 'em' }] },
        { type: 'text', text: 'is', marks: [{ type: 'em' }, { type: 'strong' }] },
        { type: 'text', text: ' the analysis. Welcome to the Lab. Got a trade, signing, or draft scenario you want us to break down? Drop it in the comments.', marks: [{ type: 'em' }] },
      ],
    };
  }

  /**
   * Insert inline images between content nodes in a ProseMirror document.
   * Distributes images evenly throughout the article.
   */
  function intersperseImagesInDoc(content: ProseMirrorNode[], imageNodes: ProseMirrorNode[]): void {
    if (imageNodes.length === 0 || content.length < 3) {
      for (const imageNode of imageNodes) {
        content.push(imageNode);
      }
      return;
    }

    const startIdx = Math.max(3, Math.floor(content.length * 0.2));
    const endIdx = Math.floor(content.length * 0.85);
    const range = Math.max(endIdx - startIdx, 1);

    for (let i = 0; i < imageNodes.length; i++) {
      const pos = startIdx + Math.floor((i + 0.5) * range / imageNodes.length);
      const insertAt = Math.min(pos, content.length);
      content.splice(insertAt, 0, imageNodes[i]);
    }
  }

  function hasSubscribeWidget(content: ProseMirrorNode[]): boolean {
    return content.some((node) => node.type === 'subscribeWidget');
  }

  function hasFooterBlurb(content: ProseMirrorNode[]): boolean {
    return content.some((node) => isFooterParagraph(node));
  }

  function resolveDraftImagePath(imageSrc: string): string | null {
    if (!imageSrc || /^https?:\/\//i.test(imageSrc)) {
      return null;
    }

    const normalized = imageSrc.replace(/\\/g, '/');
    let relativePath = normalized;
    if (relativePath.startsWith('/images/')) {
      relativePath = relativePath.slice('/images/'.length);
    } else if (relativePath.startsWith('../../images/')) {
      relativePath = relativePath.slice('../../images/'.length);
    } else if (relativePath.startsWith('content/images/')) {
      relativePath = relativePath.slice('content/images/'.length);
    }

    return resolve(config.imagesDir, relativePath);
  }

  function getCaptionedImageNode(node: ProseMirrorNode): ProseMirrorNode | null {
    if (node.type !== 'captionedImage') {
      return null;
    }
    const imageNode = node.content?.find((child) => child.type === 'image2');
    return imageNode ?? null;
  }

  async function rewriteDocImageUrls(doc: ProseMirrorDoc, articleId: string): Promise<ProseMirrorDoc> {
    if (!substackService) {
      return doc;
    }

    const cloned = JSON.parse(JSON.stringify(doc)) as ProseMirrorDoc;
    for (const node of cloned.content) {
      const imageNode = getCaptionedImageNode(node);
      const currentSrc = typeof imageNode?.attrs?.src === 'string' ? imageNode.attrs.src : '';
      const absPath = resolveDraftImagePath(currentSrc);
      if (!imageNode || !absPath || !existsSync(absPath)) {
        continue;
      }

      try {
        const uploadedUrl = await substackService.uploadImage(absPath);
        imageNode.attrs = {
          ...imageNode.attrs,
          src: uploadedUrl,
          srcNoWatermark: uploadedUrl,
        };
      } catch (err) {
        console.warn(`[publish] Image upload failed for ${articleId}: ${err instanceof Error ? err.message : err}`);
      }
    }

    return cloned;
  }

  /**
   * Enrich Substack ProseMirror document with uploaded images and publish-only chrome.
   * Rewrites existing markdown image nodes to Substack CDN URLs and only falls back
   * to manifest-driven image placement when the markdown contains no image nodes.
   */
  async function enrichSubstackDoc(
    baseDoc: ProseMirrorDoc,
    coverImagePath: string | null,
    inlineImagePaths: string[],
    articleId: string
  ): Promise<ProseMirrorDoc> {
    const enrichedContent = [...baseDoc.content];
    const hasManifestImages = !!(coverImagePath || inlineImagePaths.length > 0);

    if (hasManifestImages) {
      // When a manifest exists, strip placeholder images (e.g. Unsplash URLs added by the
      // writer) and replace them with the real generated images from the manifest.
      const placeholderIndices: number[] = [];
      for (let i = 0; i < enrichedContent.length; i++) {
        if (enrichedContent[i].type === 'captionedImage') {
          placeholderIndices.push(i);
        }
      }
      // Remove placeholders in reverse order to preserve indices
      for (let j = placeholderIndices.length - 1; j >= 0; j--) {
        enrichedContent.splice(placeholderIndices[j], 1);
      }

      if (coverImagePath) {
        enrichedContent.unshift(buildCaptionedImage(coverImagePath, 'Cover image'));
      }
      if (inlineImagePaths.length > 0) {
        const inlineNodes = inlineImagePaths.map((imagePath, index) =>
          buildCaptionedImage(imagePath, `Inline image ${index + 1}`),
        );
        intersperseImagesInDoc(enrichedContent, inlineNodes);
      }
    }

    const enrichedDoc = await rewriteDocImageUrls(
      {
        ...baseDoc,
        content: enrichedContent,
      },
      articleId,
    );

    const labName = config.leagueConfig.substackConfig.labName;
    const subscribeCaption = config.leagueConfig.substackConfig.subscribeCaption;
    if (!hasSubscribeWidget(enrichedDoc.content)) {
      enrichedDoc.content.push(createSubscribeWidget(subscribeCaption));
    }
    if (!hasFooterBlurb(enrichedDoc.content)) {
      enrichedDoc.content.push(buildHorizontalRule());
      enrichedDoc.content.push(buildBlurbNode(labName));
    }

    const validation = validateProseMirrorBody(enrichedDoc);
    if (!validation.valid) {
      throw new Error(`Publish payload validation failed: ${validation.issues.join('; ')}`);
    }

    return enrichedDoc;
  }

  async function saveOrUpdateSubstackDraft(article: Article): Promise<{ id: string; editUrl: string }> {
    if (!substackService) {
      throw new Error('Substack publishing is not configured for this environment.');
    }

    const presentation = buildPublishPresentation(article.id);
    if (!presentation.substackDoc) {
      throw new Error('No article draft found yet. Re-run drafting or send the article back to editing before publishing.');
    }

    // Backfill subtitle from the draft markdown if the DB subtitle is missing
    let effectiveSubtitle = article.subtitle;
    if (!effectiveSubtitle && presentation.extractedSubtitle) {
      effectiveSubtitle = presentation.extractedSubtitle;
      repo.updateArticle(article.id, { subtitle: effectiveSubtitle });
    }

    // Enrich the ProseMirror document with uploaded images, subscribe CTA, and footer
    const enrichedDoc = await enrichSubstackDoc(
      presentation.substackDoc,
      presentation.coverImageUrl,
      presentation.inlineImageUrls,
      article.id
    );

    // Convert enriched document to JSON string for Substack API
    const bodyJson = JSON.stringify(enrichedDoc);

    const existingDraftId = article.substack_draft_url ? extractDraftId(article.substack_draft_url) : null;
    const draft = existingDraftId
      ? await substackService.updateDraft({
          draftId: existingDraftId,
          title: article.title,
          subtitle: effectiveSubtitle ?? undefined,
          bodyHtml: bodyJson,
        })
      : await substackService.createDraft({
          title: article.title,
          subtitle: effectiveSubtitle ?? undefined,
          bodyHtml: bodyJson,
        });

    repo.setDraftUrl(article.id, draft.editUrl);
    return draft;
  }

  const missingSubstackConfigMessage =
    'Substack publishing is not configured for this environment.';

  function renderMissingSubstackConfig(article: Article, isHtmx: boolean): Response {
    if (isHtmx) {
      return new Response(
        renderPublishWorkflow({
          article,
          success: false,
          error: missingSubstackConfigMessage,
          substackConfigured: false,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        },
      );
    }
    return Response.json({ error: missingSubstackConfigMessage }, { status: 500 });
  }

  // ── Static files ──────────────────────────────────────────────────────────
  const publicRoot = join(__dirname, 'public');
  app.use(
    '/static/*',
    serveStatic({
      root: publicRoot,
      rewriteRequestPath: (path: string) => path.replace(/^\/static/, ''),
    }),
  );

  app.get('/login', (c) => {
    if (dashboardAuth.mode === 'off') {
      return c.redirect('/');
    }

    const existingSessionId = getCookie(c, dashboardAuth.sessionCookieName);
    if (existingSessionId && repo.getDashboardSession(existingSessionId)) {
      const returnTo = buildLoginRedirectPath(c.req.query('returnTo'));
      return c.redirect(returnTo);
    }

    return c.html(renderLoginPage({
      labName: config.leagueConfig.name,
      returnTo: buildLoginRedirectPath(c.req.query('returnTo')),
    }));
  });

  app.post('/login', async (c) => {
    if (dashboardAuth.mode === 'off') {
      return c.redirect('/');
    }

    const body = await c.req.parseBody();
    const username = String(body['username'] ?? '').trim();
    const password = String(body['password'] ?? '');
    const returnTo = buildLoginRedirectPath(String(body['returnTo'] ?? c.req.query('returnTo') ?? '/'));

    if (
      !dashboardAuth.username
      || !dashboardAuth.password
      || !constantTimeEquals(username, dashboardAuth.username)
      || !constantTimeEquals(password, dashboardAuth.password)
    ) {
      return c.html(renderLoginPage({
        labName: config.leagueConfig.name,
        returnTo,
        username,
        error: 'Invalid username or password.',
      }), 401);
    }

    const sessionId = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + dashboardAuth.sessionTtlHours * 3_600_000);
    repo.createDashboardSession(
      sessionId,
      dashboardAuth.username,
      expiresAt.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
    );
    setCookie(c, dashboardAuth.sessionCookieName, sessionId, {
      httpOnly: true,
      path: '/',
      sameSite: 'Lax',
      secure: dashboardAuth.secureCookies,
      maxAge: dashboardAuth.sessionTtlHours * 3_600,
      expires: expiresAt,
    });
    return c.redirect(returnTo);
  });

  app.post('/logout', (c) => {
    const sessionId = getCookie(c, dashboardAuth.sessionCookieName);
    if (sessionId) {
      repo.deleteDashboardSession(sessionId);
    }
    deleteCookie(c, dashboardAuth.sessionCookieName, { path: '/' });
    return c.redirect(dashboardAuth.mode === 'off' ? '/' : '/login');
  });

  app.use('*', async (c, next) => {
    if (dashboardAuth.mode === 'off') {
      return next();
    }

    const path = c.req.path;
    const isPublicRoute = path === '/login' || path === '/logout' || path.startsWith('/static/');
    if (isPublicRoute) {
      return next();
    }

    if (path.startsWith('/images/')) {
      const imageMatch = /^\/images\/([^/]+)\/[^/]+$/.exec(path);
      const imageArticle = imageMatch ? repo.getArticle(imageMatch[1]) : null;
      if (imageArticle?.current_stage === 8 || imageArticle?.status === 'published') {
        return next();
      }
    }

    const sessionId = getCookie(c, dashboardAuth.sessionCookieName);
    const session = sessionId ? repo.getDashboardSession(sessionId) : null;
    if (session) {
      return next();
    }

    const loginUrl = buildLoginUrl(c.req.raw);
    const isHtmx = c.req.header('hx-request') === 'true';
    const isApi = path.startsWith('/api/');
    const isSse = path === '/events';
    const isImage = path.startsWith('/images/');

    if (isHtmx) {
      return new Response(renderAdvanceResult(false, 'Authentication required. Redirecting to login…'), {
        status: 401,
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
          'HX-Redirect': loginUrl,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (isApi) {
      return c.json({ error: 'Authentication required' }, 401, {
        'Cache-Control': 'no-store',
      });
    }

    if (isSse || isImage) {
      return c.text('Authentication required', 401, {
        'Cache-Control': 'no-store',
      });
    }

    return c.redirect(loginUrl);
  });

  // Register SSE event stream
  registerSSE(app, bus);

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
    const articles = repo.getAllArticles().filter(a => a.status !== 'archived');
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
    const { flashMessage, errorMessage } = getAutoAdvanceArticleFlash({
      from: c.req.query('from'),
      error: c.req.query('error'),
      currentStage: article.current_stage,
      status: article.status,
      isRunning: activeAdvances.has(id),
    });

    return c.html(
      renderArticleDetail({
        config,
        article,
        reviews: repo.getEditorReviews(id),
        revisionHistory: buildRevisionHistoryEntries(
          getArticleConversation(repo, id),
          getRevisionHistory(repo, id),
        ),
        advanceCheck,
        usageEvents: repo.getUsageEvents(id),
        artifactNames: repo.artifacts.list(id).map(a => a.name),
        flashMessage,
        errorMessage,
        isAdvancing: activeAdvances.has(id),
      }),
    );
  });

  app.get('/articles/:id/traces', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.notFound();
    return c.html(renderArticleTraceTimelinePage({
      config,
      article,
      traces: repo.getArticleLlmTraces(id, 0),
    }));
  });

  app.get('/traces/:id', (c) => {
    const id = c.req.param('id');
    const trace = repo.getLlmTrace(id);
    if (!trace) return c.notFound();
    const adjacent = trace.article_id
      ? repo.getAdjacentTraces(trace.article_id, id)
      : undefined;
    return c.html(renderStandaloneTracePage({
      config,
      trace,
      adjacent,
    }));
  });

  // AI trace diagnosis — returns compact analysis or placeholder
  app.get('/htmx/articles/:id/trace-diagnosis', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html('<p class="empty-state">Article not found</p>', 404);

    const traces = repo.getArticleLlmTraces(id, 0);
    if (traces.length === 0) {
      return c.html('<p class="hint">No traces found for this article.</p>');
    }

    // Build a compact summary from trace data
    const stageGroups = new Map<number, typeof traces>();
    for (const t of traces) {
      const stage = t.stage ?? 0;
      if (!stageGroups.has(stage)) stageGroups.set(stage, []);
      stageGroups.get(stage)!.push(t);
    }

    const STAGE_NAMES: Record<number, string> = {
      0: 'Pre-pipeline', 1: 'Idea', 2: 'Prompt', 3: 'Discussion',
      4: 'Write Draft', 5: 'Editor', 6: 'Publisher Pass', 7: 'Publish',
    };

    const summaryLines: string[] = [];
    for (const [stage, stageTraces] of [...stageGroups.entries()].sort((a, b) => a[0] - b[0])) {
      const name = STAGE_NAMES[stage] ?? `Stage ${stage}`;
      const failed = stageTraces.filter((t) => t.status === 'failed');
      const completed = stageTraces.filter((t) => t.status === 'completed');
      const totalTokens = stageTraces.reduce((s, t) => s + (t.total_tokens ?? 0), 0);
      const agents = [...new Set(stageTraces.map((t) => t.agent_name))];

      let status = '✅';
      if (failed.length > 0) status = `❌ ${failed.length} failed`;
      else if (completed.length === 0) status = '⏳ in progress';

      summaryLines.push(`<tr>
        <td><strong>${escapeHtml(name)}</strong></td>
        <td>${stageTraces.length} trace${stageTraces.length > 1 ? 's' : ''}</td>
        <td>${escapeHtml(agents.join(', '))}</td>
        <td>${totalTokens.toLocaleString()} tokens</td>
        <td>${status}</td>
      </tr>`);

      // Detect anomalies
      if (failed.length > 0) {
        for (const f of failed) {
          const err = f.error_message ? escapeHtml(f.error_message).slice(0, 200) : 'Unknown error';
          summaryLines.push(`<tr class="issue-row"><td colspan="5">⚠️ <em>${escapeHtml(f.agent_name)}</em>: ${err}</td></tr>`);
        }
      }
    }

    const totalTokens = traces.reduce((s, t) => s + (t.total_tokens ?? 0), 0);
    const totalDuration = traces.reduce((s, t) => s + (t.latency_ms ?? 0), 0);

    return c.html(`
      <div class="trace-diagnosis-result">
        <div class="trace-diagnosis-summary">
          <span class="badge">${traces.length} traces</span>
          <span class="badge">${totalTokens.toLocaleString()} tokens</span>
          <span class="badge">${(totalDuration / 1000).toFixed(1)}s total</span>
        </div>
        <table class="trace-diagnosis-table">
          <thead><tr><th>Stage</th><th>Traces</th><th>Agents</th><th>Tokens</th><th>Status</th></tr></thead>
          <tbody>${summaryLines.join('\n')}</tbody>
        </table>
      </div>`);
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
    let llmProviders: Array<{ id: string; name: string; default?: boolean }> = [];
    const runner = deps?.actionContext?.runner;
    if (runner) {
      const PROD = new Set(['lead', 'writer', 'editor', 'scribe', 'coordinator', 'panel-moderator', 'publisher']);
      const TEAMS = new Set((config.teams ?? []).map(t => t.abbr.toLowerCase()));
      expertAgents = runner.listAgents().filter(a => !PROD.has(a) && !TEAMS.has(a));
      llmProviders = runner.gateway.listProviders().map((provider, index) => ({
        ...provider,
        default: index === 0,
      }));
    }
    return c.html(renderNewIdeaPage({ labName: config.leagueConfig.name, leagueName: config.league.toUpperCase(), teams: config.teams ?? [], expertAgents, llmProviders }));
  });

  app.get('/config', (c) => {
    const resolver = new SettingsResolver(repo, config);
    const profileSet = resolver.resolveProviderProfiles();
    const publishing = resolver.resolvePublishingConfig();
    const images = resolver.resolveImageConfig();
    const auth = resolver.resolveDashboardAuth();
    const uiPrefs = resolver.resolveUiPreferences();
    const diagnostics = resolver.buildDiagnosticsSnapshot();
    const recentAudit = repo.listRecentSettingsAudit(10);

    const activeTab = (c.req.query('tab') as string) || 'overview';

    return c.html(renderConfigPage({
      labName: config.leagueConfig.name,
      league: config.league,
      environment: config.env,
      activeTab,
      defaultProvider: profileSet.defaultProfile
        ? { label: profileSet.defaultProfile.label, providerId: profileSet.defaultProfile.providerId }
        : null,
      serviceReadiness: diagnostics.serviceReadiness,
      recentAudit: recentAudit.map(a => ({
        action: a.action,
        targetKey: a.target_key,
        createdAt: a.created_at,
      })),
      providerProfiles: profileSet.profiles.map(p => ({
        id: p.id,
        providerId: p.providerId,
        label: p.label,
        isDefault: p.isDefault,
        enabled: p.enabled,
        config: p.config as Record<string, unknown>,
      })),
      publishing,
      images,
      dashboardAuth: auth,
      uiPreferences: uiPrefs,
      diagnostics,
      secretCryptoAvailable: isSecretCryptoAvailable(),
      memoryStatus: {
        storagePath: config.memoryDbPath,
        refreshAllAvailable: Boolean(deps?.actionContext?.runner && memory),
      },
    }));
  });

  // ── Settings API routes ───────────────────────────────────────────────────

  app.post('/api/settings/workspace', async (c) => {
    try {
      const body = await c.req.parseBody();
      const namespace = String(body['namespace'] || '');
      const entries = Object.entries(body).filter(([k]) => k !== 'namespace' && k !== '_method');

      if (!namespace) {
        return c.html('<div class="settings-result"><span class="badge badge-verdict-reject">Error</span> Namespace is required</div>', 400);
      }

      for (const [key, value] of entries) {
        const valueJson = JSON.stringify(value);
        repo.setWorkspaceSetting(namespace, key, valueJson, null);
        repo.recordSettingsAudit({
          scopeType: 'workspace',
          targetType: 'workspace_setting',
          targetKey: `${namespace}.${key}`,
          action: 'update',
          afterJson: valueJson,
        });
      }

      return c.html('<div class="settings-result"><span class="badge badge-verdict-approved">Saved</span> Settings updated successfully</div>');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.html(`<div class="settings-result"><span class="badge badge-verdict-reject">Error</span> ${msg}</div>`, 500);
    }
  });

  app.post('/api/settings/me', async (c) => {
    try {
      const body = await c.req.parseBody();
      const namespace = String(body['namespace'] || 'ui');
      const entries = Object.entries(body).filter(([k]) => k !== 'namespace' && k !== '_method');

      // For now, use bootstrap admin (single-user model)
      const user = repo.ensureBootstrapAdmin(null);

      for (const [key, value] of entries) {
        repo.setUserSetting(user.id, namespace, key, JSON.stringify(value));
      }

      return c.html('<div class="settings-result"><span class="badge badge-verdict-approved">Saved</span> Preferences updated</div>');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.html(`<div class="settings-result"><span class="badge badge-verdict-reject">Error</span> ${msg}</div>`, 500);
    }
  });

  // Create profile
  app.post('/api/settings/provider-profiles', async (c) => {
    try {
      const body = await c.req.parseBody();
      const providerId = String(body['providerId'] || body['provider_id'] || '');
      const label = String(body['label'] || '');

      if (!providerId || !label) {
        return c.html('<div class="settings-result"><span class="badge badge-verdict-reject">Error</span> Provider and label are required</div>', 400);
      }

      // Build config_json from individual form fields if not provided as JSON blob
      let configJson = '{}';
      if (body['config_json']) {
        configJson = String(body['config_json']);
      } else {
        const config: Record<string, string> = {};
        const defaultModel = String(body['defaultModel'] || '');
        const baseUrl = String(body['baseUrl'] || '');
        if (defaultModel) config.defaultModel = defaultModel;
        if (baseUrl) config.baseUrl = baseUrl;
        if (Object.keys(config).length > 0) configJson = JSON.stringify(config);
      }

      const profile = repo.createProviderProfile({
        scopeType: 'workspace',
        providerId,
        label,
        configJson,
      });

      repo.recordSettingsAudit({
        scopeType: 'workspace',
        targetType: 'provider_profile',
        targetKey: profile.id,
        action: 'create',
        afterJson: JSON.stringify({ providerId, label }),
      });

      // Return redirect header for HTMX
      c.header('HX-Redirect', '/config?tab=providers');
      return c.html('<div class="settings-result"><span class="badge badge-verdict-approved">Created</span> Provider profile added</div>');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.html(`<div class="settings-result"><span class="badge badge-verdict-reject">Error</span> ${msg}</div>`, 500);
    }
  });

  // Get profile (for edit form)
  app.get('/api/settings/provider-profiles/:id', (c) => {
    const profile = repo.getProviderProfile(c.req.param('id'));
    if (!profile) return c.json({ error: 'Not found' }, 404);
    return c.json(profile);
  });

  // Update profile
  app.post('/api/settings/provider-profiles/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.parseBody();

      const patch: { label?: string; configJson?: string; enabled?: boolean } = {};
      if (body['label']) patch.label = String(body['label']);
      if (body['config_json']) patch.configJson = String(body['config_json']);
      if (body['enabled'] !== undefined) patch.enabled = body['enabled'] === '1' || body['enabled'] === 'true';

      const before = repo.getProviderProfile(id);
      const updated = repo.updateProviderProfile(id, patch);

      repo.recordSettingsAudit({
        scopeType: 'workspace',
        targetType: 'provider_profile',
        targetKey: id,
        action: 'update',
        beforeJson: before ? JSON.stringify({ label: before.label }) : null,
        afterJson: JSON.stringify({ label: updated.label }),
      });

      c.header('HX-Redirect', '/config?tab=providers');
      return c.html('<div class="settings-result"><span class="badge badge-verdict-approved">Updated</span> Profile saved</div>');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.html(`<div class="settings-result"><span class="badge badge-verdict-reject">Error</span> ${msg}</div>`, 500);
    }
  });

  // Set default
  app.post('/api/settings/provider-profiles/:id/set-default', (c) => {
    try {
      const id = c.req.param('id');
      repo.setDefaultProviderProfile('workspace', null, id);

      repo.recordSettingsAudit({
        scopeType: 'workspace',
        targetType: 'provider_profile',
        targetKey: id,
        action: 'set_default',
      });

      c.header('HX-Redirect', '/config?tab=providers');
      return c.html('<div class="settings-result"><span class="badge badge-verdict-approved">Done</span> Default provider updated</div>');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.html(`<div class="settings-result"><span class="badge badge-verdict-reject">Error</span> ${msg}</div>`, 500);
    }
  });

  // Delete profile (POST fallback)
  app.post('/api/settings/provider-profiles/:id/delete', (c) => {
    try {
      const id = c.req.param('id');
      const before = repo.getProviderProfile(id);
      repo.deleteProviderProfile(id);

      repo.recordSettingsAudit({
        scopeType: 'workspace',
        targetType: 'provider_profile',
        targetKey: id,
        action: 'delete',
        beforeJson: before ? JSON.stringify({ label: before.label, providerId: before.provider_id }) : null,
      });

      c.header('HX-Redirect', '/config?tab=providers');
      return c.html('<div class="settings-result"><span class="badge badge-verdict-approved">Deleted</span> Profile removed</div>');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.html(`<div class="settings-result"><span class="badge badge-verdict-reject">Error</span> ${msg}</div>`, 500);
    }
  });

  // Delete profile (HTMX hx-delete)
  app.delete('/api/settings/provider-profiles/:id', (c) => {
    try {
      const id = c.req.param('id');
      const before = repo.getProviderProfile(id);
      repo.deleteProviderProfile(id);

      repo.recordSettingsAudit({
        scopeType: 'workspace',
        targetType: 'provider_profile',
        targetKey: id,
        action: 'delete',
        beforeJson: before ? JSON.stringify({ label: before.label, providerId: before.provider_id }) : null,
      });

      c.header('HX-Redirect', '/config?tab=providers');
      return c.html('<div class="settings-result"><span class="badge badge-verdict-approved">Deleted</span> Profile removed</div>');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.html(`<div class="settings-result"><span class="badge badge-verdict-reject">Error</span> ${msg}</div>`, 500);
    }
  });

  // Toggle profile enabled/disabled
  app.post('/api/settings/provider-profiles/:id/toggle', (c) => {
    try {
      const id = c.req.param('id');
      const existing = repo.getProviderProfile(id);
      if (!existing) {
        return c.html('<div class="settings-result"><span class="badge badge-verdict-reject">Error</span> Profile not found</div>', 404);
      }

      const newEnabled = !existing.enabled;
      repo.updateProviderProfile(id, { enabled: newEnabled });

      repo.recordSettingsAudit({
        scopeType: 'workspace',
        targetType: 'provider_profile',
        targetKey: id,
        action: 'update',
        beforeJson: JSON.stringify({ enabled: !newEnabled }),
        afterJson: JSON.stringify({ enabled: newEnabled }),
      });

      c.header('HX-Redirect', '/config?tab=providers');
      return c.html(`<div class="settings-result"><span class="badge badge-verdict-approved">Toggled</span> Profile ${newEnabled ? 'enabled' : 'disabled'}</div>`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.html(`<div class="settings-result"><span class="badge badge-verdict-reject">Error</span> ${msg}</div>`, 500);
    }
  });

  // Set secret(s) — accepts batch named fields from the HTMX forms.
  // The form sends a hidden `group` field (e.g. "publishing", "images")
  // plus named secret fields (e.g. substackToken, twitterApiKey).
  // Each non-empty, non-meta field is stored as its own encrypted secret.
  app.post('/api/settings/secrets', async (c) => {
    try {
      if (!isSecretCryptoAvailable()) {
        return c.html('<div class="settings-result"><span class="badge badge-verdict-reject">Error</span> NFL_SETTINGS_MASTER_KEY is not configured — secret storage is disabled</div>', 400);
      }

      const body = await c.req.parseBody();
      const metaKeys = new Set(['group', 'key', 'value', '_method']);

      // Legacy single-secret mode: group + key + value
      const group = String(body['group'] || '');
      const singleKey = String(body['key'] || '');
      const singleValue = String(body['value'] || '');

      if (group && singleKey && singleValue) {
        const ciphertext = encryptSecret(singleValue);
        repo.setEncryptedSecret('workspace', null, group, singleKey, ciphertext);
        repo.recordSettingsAudit({
          scopeType: 'workspace',
          targetType: 'secret',
          targetKey: `${group}.${singleKey}`,
          action: 'update',
        });
        return c.html('<div class="settings-result"><span class="badge badge-verdict-approved">Saved</span> Secret updated</div>');
      }

      // Batch mode: iterate over all non-meta fields with non-empty values
      const secretEntries = Object.entries(body).filter(
        ([k, v]) => !metaKeys.has(k) && typeof v === 'string' && v.trim() !== '',
      );

      if (secretEntries.length === 0) {
        return c.html('<div class="settings-result"><span class="badge badge-verdict-reject">Error</span> No secrets to save (all fields are empty)</div>', 400);
      }

      // Infer group from field names or use provided group
      const inferredGroup = group || 'publishing';

      for (const [key, value] of secretEntries) {
        const ciphertext = encryptSecret(String(value));
        repo.setEncryptedSecret('workspace', null, inferredGroup, key, ciphertext);
        repo.recordSettingsAudit({
          scopeType: 'workspace',
          targetType: 'secret',
          targetKey: `${inferredGroup}.${key}`,
          action: 'update',
        });
      }

      return c.html(`<div class="settings-result"><span class="badge badge-verdict-approved">Saved</span> ${secretEntries.length} secret(s) updated</div>`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.html(`<div class="settings-result"><span class="badge badge-verdict-reject">Error</span> ${msg}</div>`, 500);
    }
  });

  // Clear secret
  app.post('/api/settings/secrets/clear', async (c) => {
    try {
      const body = await c.req.parseBody();
      const group = String(body['group'] || '');
      const key = String(body['key'] || '');

      if (!group || !key) {
        return c.html('<div class="settings-result"><span class="badge badge-verdict-reject">Error</span> Group and key are required</div>', 400);
      }

      repo.clearEncryptedSecret('workspace', null, group, key);

      repo.recordSettingsAudit({
        scopeType: 'workspace',
        targetType: 'secret',
        targetKey: `${group}.${key}`,
        action: 'clear',
      });

      return c.html('<div class="settings-result"><span class="badge badge-verdict-approved">Cleared</span> Secret removed</div>');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.html(`<div class="settings-result"><span class="badge badge-verdict-reject">Error</span> ${msg}</div>`, 500);
    }
  });

  app.get('/api/settings/effective', (c) => {
    const resolver = new SettingsResolver(repo, config);
    const snapshot = resolver.buildDiagnosticsSnapshot();
    return c.json(snapshot);
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
    let ideaTraceId: string | null = null;

    if (!prompt) {
      return c.json({ error: 'prompt is required' }, 400);
    }

    try {
      const teams: string[] = Array.isArray(body.teams) ? body.teams : [];
      const depthLevel = [1, 2, 3, 4].includes(body.depthLevel) ? body.depthLevel : 2;
      const requestedProvider = typeof body.provider === 'string' ? body.provider.trim() : '';
      const autoAdvance = body.autoAdvance === true;
      const pinnedAgents: string[] = Array.isArray(body.pinnedAgents) ? body.pinnedAgents.filter((a: unknown) => typeof a === 'string' && a.length > 0) : [];
      const actionContext = deps?.actionContext;

      if (requestedProvider && actionContext && !actionContext.runner.gateway.getProvider(requestedProvider)) {
        return c.json({ error: `Unknown provider: ${requestedProvider}` }, 400);
      }

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
              const t = (config.teams ?? []).find(x => x.abbr === abbr);
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
        // Inject roster context so the LLM doesn't reference stale player data
        const rosterCtx = teams.length > 0 ? buildTeamRosterContext(teams[0]) : null;

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
          provider: requestedProvider || undefined,
          task,
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
              surface: 'ideaGeneration',
              agentName: 'lead',
            },
          },
          trace: {
            repo,
            stage: 1,
            surface: 'ideaGeneration',
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
        llm_provider: requestedProvider || undefined,
        primary_team: teams[0] ?? undefined,
        league: config.league,
        depth_level: depthLevel,
      });

      const ideaStageRunId = repo.startStageRun({
        articleId: slug,
        stage: 1,
        surface: 'ideaGeneration',
        actor: 'ideaGeneration',
        requestedModel: ideaModel || null,
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
          surface: 'ideaGeneration',
          stageRunId: ideaStageRunId,
        });
      }

      repo.finishStageRun(ideaStageRunId, 'completed');

      bus.emit({ type: 'article_created', articleId: slug, data: { title }, timestamp: new Date().toISOString() });

      return c.json({
        id: slug,
        title,
        stage: 1,
        autoAdvance,
      }, 201);
    } catch (err: unknown) {
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
      return c.json({
        error: message,
        traceId,
        traceUrl,
      }, 500);
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

  // ── API: Archive / Unarchive / Delete article ────────────────────────────

  app.post('/api/articles/:id/archive', (c) => {
    const id = c.req.param('id');
    try {
      const updated = repo.archiveArticle(id);
      bus.emit({ type: 'stage_changed', articleId: id, data: { status: 'archived' }, timestamp: new Date().toISOString() });
      c.header('HX-Redirect', '/');
      return c.json(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  });

  app.post('/api/articles/:id/unarchive', (c) => {
    const id = c.req.param('id');
    try {
      const updated = repo.unarchiveArticle(id);
      bus.emit({ type: 'stage_changed', articleId: id, data: { status: updated.status }, timestamp: new Date().toISOString() });
      c.header('HX-Redirect', '/');
      return c.json(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 400);
    }
  });

  app.delete('/api/articles/:id', (c) => {
    const id = c.req.param('id');
    const confirm = c.req.query('confirm');
    if (confirm !== 'true') {
      return c.json({ error: 'Deletion requires ?confirm=true' }, 400);
    }
    try {
      const result = repo.deleteArticle(id);
      bus.emit({ type: 'stage_changed', articleId: id, data: { deleted: true }, timestamp: new Date().toISOString() });
      c.header('HX-Redirect', '/');
      return c.json(result);
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
    const includeArchived = c.req.query('include_archived') === '1';

    const stage = stageStr ? parseInt(stageStr, 10) : undefined;
    const depthLevel = depthStr ? parseInt(depthStr, 10) : undefined;

    // Only query if at least one filter is active
    if (!search && stage == null && !team && depthLevel == null && !includeArchived) {
      return c.html('');
    }

    const articles = repo.listArticles({ search, stage, team, depthLevel, limit: 50, excludeArchived: !includeArchived });
    return c.html(renderFilteredArticles(articles));
  });

  app.get('/htmx/pipeline-summary', (c) => {
    const articles = repo.getAllArticles().filter(a => a.status !== 'archived');
    return c.html(renderPipelineSummary(buildPipelineSummary(articles)));
  });

  app.get('/htmx/ready-to-publish', (c) => {
    return c.html(
      renderReadyToPublish(repo.getAllArticles().filter(a => a.current_stage === 7 && a.status !== 'archived')),
    );
  });

  app.get('/htmx/recent-ideas', (c) => {
    return c.html(
      renderRecentIdeas(repo.getAllArticles().filter(a => a.current_stage === 1 && a.status !== 'archived')),
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

  // ── Roster panel (htmx) ──────────────────────────────────────────────────
  app.get('/htmx/roster/:team', (c) => {
    const team = c.req.param('team').toUpperCase();
    const rosterCtx = buildTeamRosterContext(team);
    if (!rosterCtx) {
      return c.html('<p class="empty-state">Roster data unavailable</p>');
    }
    return c.html(`<div class="roster-content" style="max-height:400px;overflow-y:auto;font-size:0.85rem;">${markdownToHtml(rosterCtx)}</div>`);
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
    const isOptionalArtifact = (OPTIONAL_ARTIFACT_FILES as readonly string[]).includes(baseName);
    if (!isPanelArtifact && !isOptionalArtifact && !(ARTIFACT_FILES as readonly string[]).includes(baseName)) {
      return c.html(renderArtifactContent(name, null), 400);
    }

    const content = repo.artifacts.get(id, name);
    if (!content) {
      return c.html(renderArtifactContent(name, null));
    }

    const persistedThinkingContent = !isThinking && name.endsWith('.md')
      ? repo.artifacts.get(id, name.replace(/\.md$/i, '.thinking.md'))
      : null;

    return c.html(renderArtifactContent(name, content, persistedThinkingContent));
  });

  // ── htmx: usage panel ───────────────────────────────────────────────────

  app.get('/htmx/articles/:id/usage', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html('<p class="empty-state">Article not found</p>', 404);
    return c.html(renderUsagePanel(repo.getUsageEvents(id)));
  });

  // ── htmx: live partials (SSE-driven auto-refresh) ─────────────────────────

  app.get('/htmx/articles/:id/live-header', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html('', 404);
    return c.html(renderLiveHeader(article));
  });

  app.get('/htmx/articles/:id/live-artifacts', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html('', 404);
    return c.html(renderLiveArtifacts(article, repo.artifacts.list(id).map(a => a.name)));
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
      `<div class="advance-result advance-success">🚀 Auto-advance started — live sections will refresh as each stage completes.</div>`,
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

    const presentation = buildPublishPresentation(id, { previewMode: true });

    return c.html(
      renderArticlePreview({
        config,
        article,
        htmlBody: presentation.htmlBody,
        coverImageUrl: presentation.coverImageUrl,
        inlineImageUrls: presentation.inlineImageUrls,
      }),
    );
  });

  // ── Publish workflow routes ─────────────────────────────────────────────────

  app.get('/articles/:id/publish', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.notFound();
    const presentation = buildPublishPresentation(id, { previewMode: true });
    const issues = aggregatePublishIssues(repo, id);

    return c.html(
      renderPublishPreview({
        config,
        article,
        htmlBody: presentation.htmlBody,
        coverImageUrl: presentation.coverImageUrl,
        inlineImageUrls: presentation.inlineImageUrls,
        substackConfigured: !!substackService,
        issues,
      }),
    );
  });

  app.get('/htmx/articles/:id/preview', (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html('<p class="empty-state">Article not found</p>', 404);
    const presentation = buildPublishPresentation(id, { previewMode: true });
    return c.html(
      renderArticlePreviewFrame({
        config,
        article,
        htmlBody: presentation.htmlBody,
        coverImageUrl: presentation.coverImageUrl,
        inlineImageUrls: presentation.inlineImageUrls,
      }),
    );
  });

  // AI pre-publish review — runs LLM analysis on the article draft + artifacts
  app.get('/htmx/articles/:id/ai-review', async (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.html('<p class="empty-state">Article not found</p>', 404);

    const refresh = c.req.query('refresh') === '1';
    const eid = escapeHtml(id);

    // Return cached review unless refresh requested
    if (!refresh) {
      const cachedReview = repo.artifacts.get(id, 'ai-publish-review.md');
      if (cachedReview) {
        return c.html(renderAiReviewResult(eid, cachedReview));
      }
    }

    // Need actionContext (runner) to generate a review
    const actionContext = deps?.actionContext;
    if (!actionContext) {
      return c.html(`
        <p class="hint">AI review requires an LLM provider to be configured. Check your .env settings.</p>
        <p class="hint">In the meantime, review the <strong>Issues &amp; Advisories</strong> panel above for automated findings.</p>`);
    }

    // Gather article context: draft + key pipeline artifacts
    const draft = repo.artifacts.get(id, 'draft.md') ?? '';
    const contextParts: string[] = [];
    if (draft) contextParts.push(`## Draft\n${draft}`);

    for (const name of ['article-contract.md', 'editor-review.md', 'publisher-pass.md', 'roster-validation.md', 'fact-validation.md', 'writer-preflight.md']) {
      const content = repo.artifacts.get(id, name);
      if (content) contextParts.push(`## ${name}\n${content}`);
    }

    const articleContext = contextParts.join('\n\n---\n\n');

    const task = [
      'You are a senior editorial quality reviewer performing a final pre-publish check.',
      'Analyze the article draft against its editorial contract, editor review, and validation artifacts.',
      '',
      'Produce a structured review covering:',
      '## 🔴 Blocking Issues',
      'Critical problems that must be fixed before publishing (factual errors, broken structure, missing required sections).',
      '',
      '## 🟡 Warnings',
      'Notable concerns the editor should review (weak claims, tone issues, stale references, unclear phrasing).',
      '',
      '## 🟢 Strengths',
      'What the article does well (2-3 points).',
      '',
      '## 📋 Publish Readiness',
      'A one-line verdict: READY, NEEDS REVIEW, or NOT READY — with a brief rationale.',
      '',
      'Be concise and specific. Reference exact quotes or sections when flagging issues.',
      'If no blocking issues exist, say so explicitly.',
      '',
      `Article: "${article.title}"`,
      article.subtitle ? `Subtitle: "${article.subtitle}"` : '',
      article.primary_team ? `Team: ${article.primary_team}` : '',
      '',
      articleContext,
    ].filter(Boolean).join('\n');

    try {
      const result = await actionContext.runner.run({
        agentName: 'publisher',
        task,
        skills: ['publisher'],
        trace: {
          repo,
          stage: article.current_stage,
          surface: 'aiPublishReview',
        },
      });

      // Cache the review as an artifact
      repo.artifacts.put(id, 'ai-publish-review.md', result.content);

      // Record usage
      if (result.tokensUsed) {
        const cost = estimateCost(result.model, result.tokensUsed.prompt, result.tokensUsed.completion);
        repo.recordUsageEvent({
          articleId: id,
          stage: article.current_stage,
          surface: 'aiPublishReview',
          stageRunId: null,
          provider: result.provider,
          modelOrTool: result.model,
          eventType: 'completed',
          promptTokens: result.tokensUsed.prompt,
          outputTokens: result.tokensUsed.completion,
          cachedTokens: result.tokensUsed.cached ?? null,
          costUsdEstimate: cost > 0 ? cost : null,
          metadata: result.traceId ? { traceId: result.traceId } : null,
        });
      }

      return c.html(renderAiReviewResult(eid, result.content));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.html(`
        <div class="ai-review-result">
          <p class="flash-banner flash-error">❌ AI review failed: ${escapeHtml(message)}</p>
          <button class="btn btn-secondary btn-sm"
            hx-get="/htmx/articles/${eid}/ai-review?refresh=1"
            hx-target="#ai-review-content"
            hx-swap="innerHTML"
            hx-indicator="#ai-review-spinner">
            🔄 Retry
          </button>
          <span id="ai-review-spinner" class="htmx-indicator">Analyzing…</span>
        </div>`);
    }
  });

  app.post('/api/articles/:id/draft', async (c) => {
    const id = c.req.param('id');
    const article = repo.getArticle(id);
    if (!article) return c.json({ error: 'Article not found' }, 404);

    if (!substackService) {
      const isHtmx = c.req.header('hx-request') === 'true';
      return renderMissingSubstackConfig(article, isHtmx);
    }

    try {
      const draft = await saveOrUpdateSubstackDraft(article);
      const updatedArticle = repo.getArticle(id)!;
      const message = article.substack_draft_url
        ? 'Substack draft updated with the latest article content.'
        : 'Substack draft created and ready for review.';

      const isHtmx = c.req.header('hx-request') === 'true';
      if (isHtmx) {
        return c.html(
          renderPublishWorkflow({
            article: updatedArticle,
            success: true,
            message,
            draftUrl: draft.editUrl,
          }),
        );
      }
      return c.json({ success: true, draftUrl: draft.editUrl, draftId: draft.id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const isHtmx = c.req.header('hx-request') === 'true';
      if (isHtmx) {
        return c.html(
          renderPublishWorkflow({ article, success: false, error: message }),
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
      return renderMissingSubstackConfig(article, isHtmx);
    }

    try {
      const presentation = buildPublishPresentation(id);
      if (!presentation.substackDoc) {
        throw new Error('No article draft found yet. Re-run drafting or send the article back to editing before publishing.');
      }

      if (!article.substack_draft_url) {
        throw new Error('No linked Substack draft found. Save a draft to Substack from this page before publishing.');
      }

      const existingDraftId = extractDraftId(article.substack_draft_url);
      if (!existingDraftId) {
        throw new Error('The saved Substack draft link is invalid. Save the draft again from this page before publishing.');
      }

      const syncedDraft = await saveOrUpdateSubstackDraft(article);
      const draftId = extractDraftId(syncedDraft.editUrl);
      if (!draftId) {
        throw new Error('The saved Substack draft link is invalid. Save the draft again from this page before publishing.');
      }

      const post = await substackService.publishDraft({ draftId });

      // Record publish: advances to Stage 8, sets substack_url + published_at
      repo.recordPublish(id, post.canonicalUrl, 'dashboard');

      bus.emit({ type: 'article_published', articleId: id, data: { url: post.canonicalUrl }, timestamp: new Date().toISOString() });

      const isHtmx = c.req.header('hx-request') === 'true';
      if (isHtmx) {
        return c.html(
          renderPublishWorkflow({
            article: repo.getArticle(id)!,
            success: true,
            message: 'Published to Substack using the latest article content.',
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
          renderPublishWorkflow({ article, success: false, error: message }),
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

      // Record image generation token usage
      if (results.totalUsage) {
        repo.recordUsageEvent({
          articleId: id,
          stage: article.current_stage,
          surface: 'imageGeneration',
          provider: 'gemini',
          modelOrTool: 'gemini-3-pro-image-preview',
          eventType: 'completed',
          promptTokens: results.totalUsage.promptTokens,
          outputTokens: results.totalUsage.completionTokens,
          imageCount: imageManifest.length,
          costUsdEstimate: estimateImageCost(results.totalUsage.promptTokens, results.totalUsage.completionTokens),
        });
      }

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

      // Record image generation token usage
      if (results.totalUsage) {
        repo.recordUsageEvent({
          articleId: id,
          stage: article.current_stage,
          surface: 'imageGeneration',
          provider: 'gemini',
          modelOrTool: 'gemini-3-pro-image-preview',
          eventType: 'completed',
          promptTokens: results.totalUsage.promptTokens,
          outputTokens: results.totalUsage.completionTokens,
          imageCount: manifest.length,
          costUsdEstimate: estimateImageCost(results.totalUsage.promptTokens, results.totalUsage.completionTokens),
        });
      }

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

  // ── Refresh Knowledge ────────────────────────────────────────────────────

  const teamAbbrsSet = new Set((config.teams ?? []).map((t) => t.abbr.toLowerCase()));
  const leagueDataTool = getLeagueDataTool(config.league);

  function knowledgeSkillsFor(agentName: string): string[] {
    if (teamAbbrsSet.has(agentName)) return [leagueDataTool];
    switch (agentName) {
      case 'analytics':
      case 'cap-analyst':
        return [leagueDataTool];
      case 'draft-analyst':
        return [leagueDataTool];
      case 'defense-analyst':
        return [leagueDataTool];
      default:
        return [];
    }
  }

  // Note: text-based JSON envelope instructions removed — the structured tool
  // calling path handles response framing via native tools and the provider's
  // normalizeStructuredFinalContent wrapper.  Models should return plain text.
  const KNOWLEDGE_REFRESH_ENVELOPE_FOOTER = '';

  function knowledgePromptFor(agentName: string): string {
    let base: string;
    if (teamAbbrsSet.has(agentName)) {
      base = `Review and update your domain knowledge for the ${agentName.toUpperCase()} team. Summarize the most important current facts, figures, and developments you need to track. Focus on verifiable data: cap numbers, roster moves, coaching changes, key statistics, and recent transactions. Format as a structured knowledge brief with dates and sources where possible.`;
    } else {
      switch (agentName) {
        case 'analytics':
        case 'cap-analyst':
          base = 'Review and update your domain knowledge on team efficiency metrics and salary cap data across the league. Summarize key figures, trends, and notable changes. Format as a structured knowledge brief.';
          break;
        case 'draft-analyst':
          base = 'Review and update your domain knowledge on draft prospects, combine results, and draft pick value. Summarize key figures, trends, and notable developments. Format as a structured knowledge brief.';
          break;
        case 'defense-analyst':
          base = 'Review and update your domain knowledge on defensive performance across the league. Summarize key figures, rankings, and notable developments. Format as a structured knowledge brief.';
          break;
        default:
          base = 'Review and update your domain knowledge. Summarize the most important current facts, figures, and developments you need to track. Format as a structured knowledge brief.';
      }
    }
    return `${base}\n\n${KNOWLEDGE_REFRESH_ENVELOPE_FOOTER}`;
  }

  app.post('/api/agents/refresh-all', async (c) => {
    const isHtmx = c.req.header('HX-Request') === 'true';

    const runner = deps?.actionContext?.runner;
    if (!runner || !memory) {
      const msg = 'Runner or legacy memory store not available';
      return isHtmx
        ? c.html('<div class="admin-action-result admin-action-result-error">Runner or legacy memory store not available</div>', 503)
        : c.json({ error: msg }, 503);
    }

    const eligible = runner.listAgents().filter((agentName) => knowledgeSkillsFor(agentName).length > 0);
    if (eligible.length === 0) {
      const msg = 'No agents with mapped data tools found';
      return isHtmx
        ? c.html('<div class="admin-action-result">No agents with mapped data tools found</div>')
        : c.json({ error: msg }, 400);
    }

    void (async () => {
      let succeeded = 0;
      let failed = 0;

      for (const name of eligible) {
        try {
          const skills = knowledgeSkillsFor(name);
          const result = await runner.run({
            agentName: name,
            task: knowledgePromptFor(name),
            skills,
            toolCalling: {
              enabled: true,
              includeLocalExtensions: true,
              allowWriteTools: false,
              requestedTools: skills,
              context: {
                repo,
                engine: deps?.actionContext?.engine,
                config,
                actionContext: deps?.actionContext,
                surface: 'knowledgeRefresh',
                agentName: name,
              },
            },
          });

          memory.store({
            agentName: name,
            category: 'domain_knowledge',
            content: result.content,
            relevanceScore: 1.0,
            sourceSession: `refresh-all-${new Date().toISOString()}`,
          });
          succeeded += 1;
        } catch {
          failed += 1;
        }
      }

      bus.emit({
        type: 'refresh_complete',
        articleId: '_all',
        data: { succeeded, failed, total: eligible.length },
        timestamp: new Date().toISOString(),
      });
    })();

    if (isHtmx) {
      return c.html(`<div class="admin-action-result">⏳ Refreshing ${eligible.length} agents — this may take several minutes…</div>`);
    }
    return c.json({ success: true, status: 'started', agentCount: eligible.length });
  });

  return app;
}

// ── Server startup ───────────────────────────────────────────────────────────

export function createSubstackServiceFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): SubstackService | undefined {
  const token = env['SUBSTACK_TOKEN']?.trim();
  const publicationUrl = env['SUBSTACK_PUBLICATION_URL']?.trim();
  if (!token || !publicationUrl) {
    return undefined;
  }

  return new SubstackService({
    publicationUrl,
    token,
    stageUrl: env['SUBSTACK_STAGE_URL']?.trim() || undefined,
    notesEndpoint: env['NOTES_ENDPOINT_PATH']?.trim() || undefined,
  });
}

export function createTwitterServiceFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): TwitterService | undefined {
  const apiKey = env['TWITTER_API_KEY']?.trim();
  const apiSecret = env['TWITTER_API_SECRET']?.trim();
  const accessToken = env['TWITTER_ACCESS_TOKEN']?.trim();
  const accessTokenSecret = env['TWITTER_ACCESS_TOKEN_SECRET']?.trim();
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    return undefined;
  }

  return new TwitterService({
    apiKey,
    apiSecret,
    accessToken,
    accessTokenSecret,
  });
}

export async function startServer(overrides?: Partial<AppConfig>): Promise<void> {
  const config = loadConfig(overrides);
  const startupPrep = prepareRuntimeDataDir(config.dataDir, config.league);
  const refreshedPromptCount = startupPrep.refreshed.charters + startupPrep.refreshed.skills;
  if (refreshedPromptCount > 0) {
    console.log(`[startup] Refreshed ${refreshedPromptCount} core runtime prompt files`);
  }

  // Initialize query cache (file-based, survives restarts)
  const cacheProvider = new FileCacheProvider(config.cacheDir);
  const queryCache = initGlobalCache(cacheProvider);
  const purged = queryCache.purgeExpired();
  if (purged > 0) console.log(`[cache] Purged ${purged} expired entries`);
  const cacheStats = queryCache.stats();
  console.log(`[cache] File cache ready: ${cacheStats.entries} entries, ${((cacheStats.size ?? 0) / 1024).toFixed(1)} KB`);

  const repo = new Repository(config.dbPath);

  // ── Startup recovery: clean up orphaned runs from previous unclean shutdown ──
  try {
    const recovery = repo.recoverOrphanedRuns();
    const parts: string[] = [];
    if (recovery.stageRuns > 0) parts.push(`${recovery.stageRuns} stage runs`);
    if (recovery.articleRuns > 0) parts.push(`${recovery.articleRuns} article runs`);
    if (recovery.traces > 0) parts.push(`${recovery.traces} LLM traces`);
    if (recovery.articles.length > 0) parts.push(`${recovery.articles.length} stuck articles`);
    if (parts.length > 0) {
      console.log(`[recovery] Cleaned up from previous shutdown: ${parts.join(', ')}`);
      for (const id of recovery.articles) {
        console.log(`[recovery]   Reset article: ${id}`);
      }
    }
  } catch (err) {
    console.warn(`[recovery] Startup recovery failed: ${err instanceof Error ? err.message : err}`);
  }

  // ── Bootstrap admin user for DB-backed settings ──
  try {
    const bootstrap = ensureBootstrapAdmin(repo, process.env['DASHBOARD_AUTH_USERNAME']);
    if (bootstrap.created) {
      console.log(`[settings] Bootstrap admin user created: ${bootstrap.username}`);
    }
  } catch (err) {
    console.warn(`[settings] Bootstrap admin creation failed: ${err instanceof Error ? err.message : err}`);
  }

  const useDbConfig = process.env['NFL_USE_DB_CONFIG'] === '1';
  if (useDbConfig) {
    console.log('[settings] DB-backed configuration enabled (NFL_USE_DB_CONFIG=1)');
  }

  // Build ActionContext for agent-powered auto-advance (optional)
  let actionContext: ActionContext | undefined;
  let memory: AgentMemory | undefined;
  try {
    const modelPolicy = new ModelPolicy();
    const gateway = new LLMGateway({ modelPolicy });

    // Register available LLM providers.
    // The first registered provider becomes the default for model-policy routing.
    // Additional providers remain available for explicit UI overrides.
    const explicitProvider = process.env['LLM_PROVIDER'];
    const registerMockProvider = async (): Promise<void> => {
      const mock = new MockProvider();
      gateway.registerProvider(mock);
      console.log('Mock LLM provider registered (testing mode)');
    };

    const registerLMStudioProvider = async (): Promise<void> => {
      if (gateway.getProvider('lmstudio')) return;
      if (explicitProvider !== 'lmstudio' && !process.env['LMSTUDIO_URL']) return;
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
    };

    const registerCopilotApiProvider = async (): Promise<void> => {
      if (gateway.getProvider('copilot-api')) return;
      try {
        const copilot = new CopilotProvider();
        copilot.resolveToken();
        gateway.registerProvider(copilot);
        console.log('Copilot Pro+ provider registered (GitHub Models API)');
      } catch (err) {
        console.log(`Copilot provider not available: ${err instanceof Error ? err.message : err}`);
      }
    };

    const registerCopilotCliProvider = async (): Promise<void> => {
      if (gateway.getProvider('copilot-cli')) return;
      try {
        const repoRoot = resolve(__dirname, '..', '..');
        const rawCliMode = (process.env['COPILOT_CLI_MODE'] ?? '').trim().toLowerCase();
        const cliMode = rawCliMode === 'none'
          ? 'none'
          : rawCliMode === 'article-tools'
            ? 'article-tools'
            : process.env['COPILOT_CLI_ENABLE_TOOLS'] === '1'
              || process.env['COPILOT_ENABLE_TOOLS'] === '1'
              ? 'article-tools'
              : COPILOT_CLI_DEFAULT_MODE;
        const sessionReuseOverride = process.env['COPILOT_CLI_SESSION_REUSE']
          ?? process.env['COPILOT_ENABLE_SESSION_REUSE'];
        const extraFlags = (process.env['COPILOT_EXTRA_FLAGS'] ?? '')
          .split(',')
          .map((flag) => flag.trim())
          .filter((flag) => flag.length > 0);
        const cliProvider = new CopilotCLIProvider({
          defaultModel: process.env['COPILOT_MODEL'] ?? COPILOT_CLI_DEFAULT_MODEL,
          copilotPath: process.env['COPILOT_PATH'] ?? undefined,
          extraFlags,
          repoRoot,
          workingDirectory: process.env['COPILOT_WORKING_DIRECTORY'] ?? repoRoot,
          toolAccessMode: cliMode,
          enableWebFetch:
            cliMode === 'article-tools'
            && process.env['COPILOT_ENABLE_WEB_FETCH'] !== '0'
            && process.env['COPILOT_CLI_WEB_SEARCH'] !== '0',
          enableRepoMcp:
            cliMode === 'article-tools'
            && process.env['COPILOT_ENABLE_REPO_MCP'] !== '0',
          mcpConfigPath:
            process.env['COPILOT_CLI_MCP_CONFIG']
            ?? join(repoRoot, '.copilot', 'mcp-config.json'),
          enableSessionReuse:
            cliMode === 'article-tools'
            && (
              sessionReuseOverride
                ? sessionReuseOverride === '1'
                : COPILOT_CLI_DEFAULT_SESSION_REUSE
            ),
        });
        const version = await cliProvider.verify();
        gateway.registerProvider(cliProvider);
        console.log(`Copilot CLI provider registered (${version}, model: ${cliProvider['defaultModel']})`);
      } catch (err) {
        console.log(`Copilot CLI not available: ${err instanceof Error ? err.message : err}`);
      }
    };

    const registerGeminiProvider = async (): Promise<void> => {
      if (gateway.getProvider('gemini')) return;
      const geminiKey = process.env['GEMINI_API_KEY'];
      if (!geminiKey) {
        console.log('Gemini LLM provider skipped — GEMINI_API_KEY not set');
        return;
      }
      try {
        const gemini = new GeminiProvider(geminiKey);
        gateway.registerProvider(gemini);
        console.log('Gemini LLM provider registered (Google Gemini API)');
      } catch (err) {
        console.log(`Gemini LLM provider not available: ${err instanceof Error ? err.message : err}`);
      }
    };

    if (process.env['MOCK_LLM'] === '1') {
      await registerMockProvider();
    } else {
      const registrationOrder: Array<() => Promise<void>> = explicitProvider === 'lmstudio'
        ? [registerLMStudioProvider, registerCopilotCliProvider, registerCopilotApiProvider, registerGeminiProvider]
        : explicitProvider === 'copilot-api'
          ? [registerCopilotApiProvider, registerCopilotCliProvider, registerLMStudioProvider, registerGeminiProvider]
          : explicitProvider === 'copilot-cli'
            ? [registerCopilotCliProvider, registerCopilotApiProvider, registerLMStudioProvider, registerGeminiProvider]
            : explicitProvider === 'gemini'
              ? [registerGeminiProvider, registerCopilotCliProvider, registerCopilotApiProvider, registerLMStudioProvider]
              : [registerCopilotCliProvider, registerCopilotApiProvider, registerLMStudioProvider, registerGeminiProvider];

      for (const registerProvider of registrationOrder) {
        await registerProvider();
      }
    }

    memory = new AgentMemory(config.memoryDbPath);
    const runner = new AgentRunner({
      gateway,
      memory,
      chartersDir: config.chartersDir,
      skillsDir: config.skillsDir,
      toolLoop: buildDashboardToolLoopOptions(),
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

  let substackService: SubstackService | undefined;
  try {
    substackService = createSubstackServiceFromEnv();
    if (substackService) {
      console.log(
        `Substack service initialized (${substackService.resolveBaseUrl('prod')})`,
      );
    } else {
      console.log(
        'Substack publishing credentials not set — draft/publish actions will remain unavailable',
      );
    }
  } catch (err) {
    console.warn(
      `[startup] Substack service not available: ${err instanceof Error ? err.message : err}`,
    );
  }

  let twitterService: TwitterService | undefined;
  try {
    twitterService = createTwitterServiceFromEnv();
    if (twitterService) {
      console.log('Twitter service initialized');
    } else {
      console.log(
        'Twitter credentials not set — tweet actions will remain unavailable',
      );
    }
  } catch (err) {
    console.warn(
      `[startup] Twitter service not available: ${err instanceof Error ? err.message : err}`,
    );
  }

  // Periodic legacy-memory decay — throttled to once per hour
  if (memory) {
    try {
      if (memory.shouldDecay(3_600_000)) {
        const agentStats = memory.stats();
        let totalDecayed = 0;
        for (const s of agentStats) {
          totalDecayed += memory.decay(s.agentName, 0.95);
        }
        memory.recordDecay();
        if (totalDecayed > 0) {
          console.log(`[memory:legacy] Decayed ${totalDecayed} entries across ${agentStats.length} agents (×0.95)`);
        }
      } else {
        console.log('[memory:legacy] Decay skipped — last decay was less than 1 hour ago');
      }
    } catch (err) {
      console.warn(`[memory:legacy] Startup decay skipped: ${err instanceof Error ? err.message : err}`);
    }
  }

  const app = createApp(repo, config, {
    actionContext,
    imageService,
    memory,
    substackService,
    twitterService,
  });

  // Preflight: block dangerous production configurations
  if (config.env === 'production') {
    const issues: string[] = [];
    if (config.dashboardAuth?.mode === 'off') {
      issues.push('DASHBOARD_AUTH_MODE=off is not allowed in production');
    }
    if (!config.dashboardAuth?.username || !config.dashboardAuth?.password) {
      issues.push('Auth credentials not configured');
    }
    if (config.dataDir.includes('-dev') || config.dataDir.includes('-test')) {
      issues.push(`Data directory looks like a non-prod path: ${config.dataDir}`);
    }
    if (config.tls) {
      if (!existsSync(config.tls.certPath)) {
        issues.push(`TLS certificate not found: ${config.tls.certPath}`);
      }
      if (!existsSync(config.tls.keyPath)) {
        issues.push(`TLS key not found: ${config.tls.keyPath}`);
      }
    }
    if (issues.length > 0) {
      console.error('[PREFLIGHT FAILED]');
      issues.forEach((i) => console.error(`  ✗ ${i}`));
      process.exit(1);
    }
    console.log('[preflight] All checks passed');
  }

  // Startup environment banner
  console.log(`[startup] ════════════════════════════════════════`);
  console.log(`[startup] Environment : ${config.env}`);
  console.log(`[startup] Data dir    : ${config.dataDir}`);
  console.log(`[startup] Auth mode   : ${config.dashboardAuth?.mode ?? 'off'}`);
  console.log(`[startup] Port        : ${config.port}`);
  console.log(`[startup] TLS         : ${config.tls ? 'enabled' : 'off'}`);
  console.log(`[startup] ════════════════════════════════════════`);

  // Public-facing: bind all interfaces. Auth + security headers are the protection layer.
  const hostname = '0.0.0.0';
  const protocol = config.tls ? 'https' : 'http';

  const serveOptions: Parameters<typeof serve>[0] = {
    fetch: app.fetch,
    port: config.port,
    hostname,
  };

  if (config.tls) {
    serveOptions.createServer = createHttpsServer;
    serveOptions.serverOptions = {
      key: readFileSync(config.tls.keyPath),
      cert: readFileSync(config.tls.certPath),
    };
    console.log(`[tls] Certificate: ${config.tls.certPath}`);
    console.log(`[tls] Key:         ${config.tls.keyPath}`);
  }

  serve(serveOptions, (info) => {
    console.log(`NFL Lab Dashboard running at ${protocol}://${hostname}:${info.port}`);
  });

  // When TLS is active, start a plain HTTP listener that redirects everything to HTTPS
  if (config.tls) {
    const httpPort = parseInt(process.env.NFL_HTTP_PORT ?? '80', 10);
    const redirectServer = createHttpServer((req, res) => {
      const host = (req.headers.host ?? 'localhost').replace(/:\d+$/, '');
      const portSuffix = config.port === 443 ? '' : `:${config.port}`;
      const location = `https://${host}${portSuffix}${req.url ?? '/'}`;
      res.writeHead(301, { Location: location });
      res.end();
    });
    redirectServer.listen(httpPort, hostname, () => {
      console.log(`[tls] HTTP→HTTPS redirect listening on ${hostname}:${httpPort}`);
    });
    redirectServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EACCES') {
        console.warn(`[tls] Could not bind HTTP redirect on port ${httpPort} (access denied). ` +
          `Set NFL_HTTP_PORT to a non-privileged port or run as admin.`);
      } else if (err.code === 'EADDRINUSE') {
        console.warn(`[tls] Port ${httpPort} already in use — HTTP redirect server skipped.`);
      } else {
        console.warn(`[tls] HTTP redirect server error: ${err.message}`);
      }
    });
  }
}

// Allow direct execution: npx tsx src/dashboard/server.ts
if (require.main === module) {
  startServer();
}
