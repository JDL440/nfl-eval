import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Repository } from '../../src/db/repository.js';
import {
  createApp,
  createSubstackServiceFromEnv,
  createTwitterServiceFromEnv,
} from '../../src/dashboard/server.js';
import { proseMirrorToHtml } from '../../src/dashboard/views/publish.js';
import { markdownToProseMirror, validateProseMirrorBody } from '../../src/services/prosemirror.js';
import type { AppConfig } from '../../src/config/index.js';
import {
  type SubstackDraft,
  type SubstackPost,
  type SubstackService,
} from '../../src/services/substack.js';
import type { TwitterService, TweetResult } from '../../src/services/twitter.js';

function makeTestConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    dataDir: '/tmp/test',
    league: 'nfl',
    leagueConfig: {
      name: 'NFL Lab',
      panelName: 'Test Panel',
      dataSource: 'nflverse',
      positions: [],
      substackConfig: {
        labName: 'NFL Lab',
        subscribeCaption: 'Test',
        footerPatterns: [],
      },
    },
    dbPath: '/tmp/test/pipeline.db',
    articlesDir: '/tmp/test/articles',
    imagesDir: '/tmp/test/images',
    chartersDir: '/tmp/test/charters',
    skillsDir: '/tmp/test/skills',
    memoryDbPath: '/tmp/test/memory.db',
    logsDir: '/tmp/test/logs',
    cacheDir: '/tmp/test/data-cache',
    port: 3456,
    env: 'development',
    ...overrides,
  };
}

function parseSessionCookie(setCookieHeader: string | null): string {
  expect(setCookieHeader).toBeTruthy();
  return setCookieHeader!.split(';', 1)[0];
}

function createMockSubstackService(overrides?: Partial<SubstackService>): SubstackService {
  return {
    createDraft: vi.fn().mockResolvedValue({
      id: '12345',
      editUrl: 'https://test.substack.com/publish/post/12345',
      slug: 'test-article',
    } satisfies SubstackDraft),
    publishDraft: vi.fn().mockResolvedValue({
      id: '12345',
      slug: 'test-article',
      canonicalUrl: 'https://test.substack.com/p/test-article',
      isPublished: true,
    } satisfies SubstackPost),
    updateDraft: vi.fn().mockResolvedValue({
      id: '12345',
      editUrl: 'https://test.substack.com/publish/post/12345',
      slug: 'test-article',
    }),
    uploadImage: vi.fn().mockResolvedValue('https://cdn.substack.com/image.png'),
    createNote: vi.fn().mockResolvedValue({ id: '1', url: 'https://test.substack.com/note/1' }),
    getDraft: vi.fn().mockResolvedValue(null),
    resolveBaseUrl: vi.fn().mockReturnValue('https://test.substack.com'),
    ...overrides,
  } as unknown as SubstackService;
}

function createMockTwitterService(overrides?: Partial<TwitterService>): TwitterService {
  return {
    postTweet: vi.fn().mockResolvedValue({
      id: '1234567890',
      url: 'https://x.com/user/status/1234567890',
      text: 'Test tweet',
    } satisfies TweetResult),
    uploadMedia: vi.fn().mockResolvedValue('media_001'),
    ...overrides,
  } as unknown as TwitterService;
}

/** Advance an articlefrom stage 1 to `targetStage` by walking each transition. */
function advanceToStage(repo: Repository, id: string, targetStage: number): void {
  for (let s = 2; s <= targetStage; s++) {
    repo.advanceStage(id, s - 1, s, 'test');
  }
}

/** Store a test article draft in the DB artifact store. */
function writeArticleDraft(repo: Repository, id: string, markdown: string): void {
  repo.artifacts.put(id, 'draft.md', markdown);
}

describe('Publish Workflow', () => {
  let repo: Repository;
  let tempDir: string;
  let articlesDir: string;
  let config: AppConfig;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nfl-pub-test-'));
    articlesDir = join(tempDir, 'articles');
    mkdirSync(articlesDir, { recursive: true });
    const dbPath = join(tempDir, 'test.db');
    repo = new Repository(dbPath);
    config = makeTestConfig({ dbPath, articlesDir });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SUBSTACK_TOKEN;
    delete process.env.SUBSTACK_PUBLICATION_URL;
    delete process.env.SUBSTACK_STAGE_URL;
    delete process.env.NOTES_ENDPOINT_PATH;
    delete process.env.TWITTER_API_KEY;
    delete process.env.TWITTER_API_SECRET;
    delete process.env.TWITTER_ACCESS_TOKEN;
    delete process.env.TWITTER_ACCESS_TOKEN_SECRET;
    repo.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('createSubstackServiceFromEnv', () => {
    it('creates the startup Substack service when publish env vars are present', () => {
      const service = createSubstackServiceFromEnv({
        SUBSTACK_TOKEN: 'test-token',
        SUBSTACK_PUBLICATION_URL: 'https://test.substack.com',
        SUBSTACK_STAGE_URL: 'https://stage-test.substack.com',
        NOTES_ENDPOINT_PATH: '/api/v1/comment/feed',
      });

      expect(service).toBeDefined();
      expect(service?.resolveBaseUrl('prod')).toBe('https://test.substack.com');
      expect(service?.resolveBaseUrl('stage')).toBe('https://stage-test.substack.com');
    });
  });

  describe('createTwitterServiceFromEnv', () => {
    it('creates the startup Twitter service when all tweet env vars are present', () => {
      const service = createTwitterServiceFromEnv({
        TWITTER_API_KEY: 'api-key',
        TWITTER_API_SECRET: 'api-secret',
        TWITTER_ACCESS_TOKEN: 'access-token',
        TWITTER_ACCESS_TOKEN_SECRET: 'access-token-secret',
      });

      expect(service).toBeDefined();
    });

    it('returns undefined when any required Twitter credential is missing', () => {
      const service = createTwitterServiceFromEnv({
        TWITTER_API_KEY: 'api-key',
        TWITTER_API_SECRET: 'api-secret',
        TWITTER_ACCESS_TOKEN: 'access-token',
      });

      expect(service).toBeUndefined();
    });
  });

  // ── proseMirrorToHtml ──────────────────────────────────────────────────────

  describe('proseMirrorToHtml', () => {
    it('renders paragraphs and headings', () => {
      const doc = markdownToProseMirror('# Hello\n\nA paragraph.');
      const html = proseMirrorToHtml(doc);
      expect(html).toContain('<h1>');
      expect(html).toContain('Hello');
      expect(html).toContain('<p>');
      expect(html).toContain('A paragraph.');
    });

    it('renders bold and italic marks', () => {
      const doc = markdownToProseMirror('This is **bold** and *italic*.');
      const html = proseMirrorToHtml(doc);
      expect(html).toContain('<strong>');
      expect(html).toContain('bold');
      expect(html).toContain('<em>');
      expect(html).toContain('italic');
    });

    it('renders horizontal rules', () => {
      const doc = markdownToProseMirror('Text\n\n---\n\nMore text');
      const html = proseMirrorToHtml(doc);
      expect(html).toContain('<hr>');
    });
  });

  // ── GET /articles/:id/publish (preview page) ──────────────────────────────

  describe('GET /articles/:id/publish', () => {
    it('redirects publish preview to login when dashboard auth is enabled', async () => {
      repo.createArticle({ id: 'protected-publish', title: 'Protected Publish' });
      advanceToStage(repo, 'protected-publish', 7);
      writeArticleDraft(repo, 'protected-publish', '# Draft');

      const authApp = createApp(repo, makeTestConfig({
        ...config,
        dashboardAuth: {
          mode: 'local',
          username: 'joe',
          password: 'secret-pass',
          sessionCookieName: 'publish_auth_session',
          sessionTtlHours: 12,
          secureCookies: false,
        },
      }));

      const res = await authApp.request('/articles/protected-publish/publish');
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('/login?returnTo=%2Farticles%2Fprotected-publish%2Fpublish');
    });

    it('allows authenticated publish preview access after login', async () => {
      repo.createArticle({ id: 'authed-publish', title: 'Authed Publish' });
      advanceToStage(repo, 'authed-publish', 7);
      writeArticleDraft(repo, 'authed-publish', '# Draft');

      const authApp = createApp(repo, makeTestConfig({
        ...config,
        dashboardAuth: {
          mode: 'local',
          username: 'joe',
          password: 'secret-pass',
          sessionCookieName: 'publish_auth_session',
          sessionTtlHours: 12,
          secureCookies: false,
        },
      }));

      const loginRes = await authApp.request('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          username: 'joe',
          password: 'secret-pass',
          returnTo: '/articles/authed-publish/publish',
        }).toString(),
      });
      const sessionCookie = parseSessionCookie(loginRes.headers.get('set-cookie'));

      const res = await authApp.request('/articles/authed-publish/publish', {
        headers: { Cookie: sessionCookie },
      });
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('Authed Publish');
    });

    it('renders publish preview page with article content', async () => {
      repo.createArticle({ id: 'pub-preview', title: 'Publish Preview Test' });
      advanceToStage(repo, 'pub-preview', 7);
      writeArticleDraft(repo, 'pub-preview', '# Test Article\n\nSome content here.');
      repo.setDraftUrl('pub-preview', 'https://test.substack.com/publish/post/12345');

      const app = createApp(repo, config);
      const res = await app.request('/articles/pub-preview/publish');
      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain('Publish Preview Test');
      expect(html).toContain('shared-mobile-header');
      expect(html).toContain('mobile-detail-layout publish-layout');
      expect(html).toContain('Test Article');
      expect(html).toContain('Some content here');
      expect(html).toContain('Published Layout Preview');
      expect(html).toContain('Primary path');
      expect(html).toContain('publish-status-badge is-ready');
      expect(html).toContain('Optional follow-up');
      expect(html).toContain('Automation');
      expect(html).toContain('Update Draft on Substack');
      expect(html).toContain('Publish Now');
    });

    it('returns 404 for missing article', async () => {
      const app = createApp(repo, config);
      const res = await app.request('/articles/nonexistent/publish');
      expect(res.status).toBe(404);
    });

    it('shows empty state when no draft exists', async () => {
      repo.createArticle({ id: 'no-md', title: 'No Markdown' });
      advanceToStage(repo, 'no-md', 7);

      const app = createApp(repo, config);
      const res = await app.request('/articles/no-md/publish');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('No article draft found yet');
      expect(html).toContain('publish-status-badge is-blocked');
      expect(html).toContain('No Substack draft is linked yet. Save a draft to Substack before publishing live.');
      expect(html).not.toContain('Publish Now');
    });

    it('shows an actionable config warning and disables publish actions when Substack is unavailable', async () => {
      repo.createArticle({ id: 'no-substack-config', title: 'No Substack Config' });
      advanceToStage(repo, 'no-substack-config', 7);
      writeArticleDraft(repo, 'no-substack-config', '# Draft\n\nContent.');

      const app = createApp(repo, config);
      const res = await app.request('/articles/no-substack-config/publish');
      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain('Substack publishing is not configured.');
      expect(html).toContain('Configure Substack credentials');
      expect(html).toContain('/config');
      expect(html).toContain('aria-disabled="true"');
      expect(html).toContain('Draft needed');
      expect(html).toContain('Configure Substack on the <a href="/config">Settings</a> page before using Publish All.');
      expect(html).not.toContain('hx-post="/api/articles/no-substack-config/draft"');
      expect(html).not.toContain('hx-post="/api/articles/no-substack-config/publish"');
    });

    it('displays publish actions without checklist gate', async () => {
      repo.createArticle({ id: 'with-pass', title: 'With Pass' });
      advanceToStage(repo, 'with-pass', 7);
      writeArticleDraft(repo, 'with-pass', '# Article\n\nContent');

      const app = createApp(repo, config);
      const res = await app.request('/articles/with-pass/publish');
      const html = await res.text();
      expect(html).toContain('Publish Status');
      expect(html).toContain('Published Layout Preview');
      // Checklist no longer shown on publish page
      expect(html).not.toContain('Publisher Checklist');
    });
  });

  // ── GET /htmx/articles/:id/preview (preview partial) ──────────────────────

  describe('GET /htmx/articles/:id/preview', () => {
    it('returns HTML preview fragment', async () => {
      repo.createArticle({ id: 'htmx-prev', title: 'HTMX Preview' });
      writeArticleDraft(repo, 'htmx-prev', '## Section\n\nBody text.');

      const app = createApp(repo, config);
      const res = await app.request('/htmx/articles/htmx-prev/preview');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('preview-container');
      expect(html).toContain('Section');
      expect(html).toContain('Body text');
      expect(html).toContain('Subscribe');
      expect(html).not.toContain('<!DOCTYPE html>');
    });

    it('returns 404 for missing article', async () => {
      const app = createApp(repo, config);
      const res = await app.request('/htmx/articles/missing/preview');
      expect(res.status).toBe(404);
    });
  });

  // ── POST /api/articles/:id/draft (create Substack draft) ──────────────────

  describe('POST /api/articles/:id/draft', () => {
    it('converts cleaned markdown via ProseMirror and creates draft', async () => {
      const mockService = createMockSubstackService();
      repo.createArticle({ id: 'draft-test', title: 'Draft Test' });
      advanceToStage(repo, 'draft-test', 7);
      writeArticleDraft(repo, 'draft-test', '<think>trace</think>\n\n# Draft\n\nContent here.');

      const app = createApp(repo, config, { substackService: mockService });
      const res = await app.request('/api/articles/draft-test/draft', { method: 'POST' });
      expect(res.status).toBe(200);

      const body = await res.json() as { success: boolean; draftUrl: string; draftId: string };
      expect(body.success).toBe(true);
      expect(body.draftUrl).toContain('substack.com');
      expect(body.draftId).toBe('12345');

      expect(mockService.createDraft).toHaveBeenCalledOnce();
      const callArgs = (mockService.createDraft as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.title).toBe('Draft Test');
      
      // Parse the JSON to validate ProseMirror structure and verify thinking is removed
      const bodyJson = callArgs.bodyHtml as string;
      const doc = JSON.parse(bodyJson);
      expect(doc.type).toBe('doc');
      const html = proseMirrorToHtml(doc);
      expect(html).not.toContain('trace');

      // Draft URL should be stored on the article
      const updated = repo.getArticle('draft-test');
      expect(updated?.substack_draft_url).toBe('https://test.substack.com/publish/post/12345');
    });

    it('updates an existing linked Substack draft instead of creating a new one', async () => {
      const mockService = createMockSubstackService();
      repo.createArticle({ id: 'draft-update', title: 'Draft Update' });
      advanceToStage(repo, 'draft-update', 7);
      writeArticleDraft(repo, 'draft-update', '# Updated Draft\n\nFresh content.');
      repo.setDraftUrl('draft-update', 'https://test.substack.com/publish/post/12345');

      const app = createApp(repo, config, { substackService: mockService });
      const res = await app.request('/api/articles/draft-update/draft', { method: 'POST' });
      expect(res.status).toBe(200);

      expect(mockService.updateDraft).toHaveBeenCalledOnce();
      expect(mockService.createDraft).not.toHaveBeenCalled();
    });

    it('returns error when no markdown found', async () => {
      const mockService = createMockSubstackService();
      repo.createArticle({ id: 'no-draft-md', title: 'No MD' });

      const app = createApp(repo, config, { substackService: mockService });
      const res = await app.request('/api/articles/no-draft-md/draft', { method: 'POST' });
      expect(res.status).toBe(500);

      const body = await res.json() as { error: string };
      expect(body.error).toContain('No article draft found');
    });

    it('returns error when SubstackService not configured', async () => {
      repo.createArticle({ id: 'no-svc', title: 'No Service' });
      writeArticleDraft(repo, 'no-svc', '# Draft\n\nContent.');

      const app = createApp(repo, config);
      const res = await app.request('/api/articles/no-svc/draft', { method: 'POST' });
      expect(res.status).toBe(500);

      const body = await res.json() as { error: string };
      expect(body.error).toContain('not configured');
    });

    it('returns error when SubstackService throws', async () => {
      const mockService = createMockSubstackService({
        createDraft: vi.fn().mockRejectedValue(new Error('API rate limit')),
      } as unknown as Partial<SubstackService>);
      repo.createArticle({ id: 'api-fail', title: 'API Fail' });
      writeArticleDraft(repo, 'api-fail', '# Draft\n\nContent.');

      const app = createApp(repo, config, { substackService: mockService });
      const res = await app.request('/api/articles/api-fail/draft', { method: 'POST' });
      expect(res.status).toBe(500);

      const body = await res.json() as { error: string };
      expect(body.error).toContain('API rate limit');
    });

    it('returns htmx HTML when hx-request header is present', async () => {
      const mockService = createMockSubstackService();
      repo.createArticle({ id: 'htmx-draft', title: 'HTMX Draft' });
      writeArticleDraft(repo, 'htmx-draft', '# Draft\n\nContent.');

      const app = createApp(repo, config, { substackService: mockService });
      const res = await app.request('/api/articles/htmx-draft/draft', {
        method: 'POST',
        headers: { 'hx-request': 'true' },
      });
      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain('Substack draft created');
      expect(html).toContain('substack.com');
    });

    it('returns an actionable HTMX message when Substack is not configured', async () => {
      repo.createArticle({ id: 'htmx-no-svc', title: 'HTMX No Service' });
      writeArticleDraft(repo, 'htmx-no-svc', '# Draft\n\nContent.');

      const app = createApp(repo, config);
      const res = await app.request('/api/articles/htmx-no-svc/draft', {
        method: 'POST',
        headers: { 'hx-request': 'true' },
      });
      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain('Substack publishing is not configured.');
      expect(html).toContain('Configure Substack credentials');
      expect(html).toContain('/config');
      expect(html).toContain('aria-disabled="true"');
    });

    it('enriches Substack body with subscribe CTA and footer blurb', async () => {
      const mockService = createMockSubstackService();
      repo.createArticle({ id: 'enrich-test', title: 'Enrichment Test' });
      advanceToStage(repo, 'enrich-test', 7);
      writeArticleDraft(repo, 'enrich-test', '# Article\n\nBody content here.');

      const app = createApp(repo, config, { substackService: mockService });
      const res = await app.request('/api/articles/enrich-test/draft', { method: 'POST' });
      expect(res.status).toBe(200);

      expect(mockService.createDraft).toHaveBeenCalledOnce();
      const callArgs = (mockService.createDraft as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const bodyJson = callArgs.bodyHtml as string;

      // Parse the JSON to validate ProseMirror structure
      const doc = JSON.parse(bodyJson);
      expect(doc.type).toBe('doc');
      expect(doc.content).toBeDefined();
      expect(Array.isArray(doc.content)).toBe(true);
      expect(validateProseMirrorBody(doc).valid).toBe(true);

      // Convert to HTML to verify content is present
      const html = proseMirrorToHtml(doc);
      expect(html).toContain('Test');
      expect(html).toContain('Subscribe');
      expect(html).toContain('virtual front office');
      expect(html).toContain('specialized AI analysts');
      expect(html).toContain('Drop it in the comments');
    });

    it('uploads and includes cover image when manifest present', async () => {
      const mockService = createMockSubstackService();
      repo.createArticle({ id: 'cover-test', title: 'Cover Test' });
      advanceToStage(repo, 'cover-test', 7);
      writeArticleDraft(repo, 'cover-test', '# Article\n\nContent.');
      
      // Create images manifest with cover
      const manifest = JSON.stringify([
        { type: 'cover', path: 'content/images/cover-test/cover-1.png', prompt: 'Cover image' }
      ]);
      repo.artifacts.put('cover-test', 'images.json', manifest);

      const app = createApp(repo, config, { substackService: mockService });
      const res = await app.request('/api/articles/cover-test/draft', { method: 'POST' });
      expect(res.status).toBe(200);

      const callArgs = (mockService.createDraft as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const bodyJson = callArgs.bodyHtml as string;

      // Parse the JSON to validate ProseMirror structure
      const doc = JSON.parse(bodyJson);
      expect(doc.type).toBe('doc');
      expect(doc.content).toBeDefined();
      expect(validateProseMirrorBody(doc).valid).toBe(true);
      
      // Convert to HTML to verify content
      const html = proseMirrorToHtml(doc);
      expect(html).toContain('<h1>Article</h1>');
    });

    it('uploads and intersperses inline images when manifest present', async () => {
      const mockService = createMockSubstackService();
      repo.createArticle({ id: 'inline-test', title: 'Inline Test' });
      advanceToStage(repo, 'inline-test', 7);
      writeArticleDraft(repo, 'inline-test', '# Article\n\nFirst para.\n\nSecond para.\n\nThird para.\n\nFourth para.');
      
      // Create images manifest with inline images
      const manifest = JSON.stringify([
        { type: 'inline', path: 'content/images/inline-test/inline-1.png', prompt: 'First image' },
        { type: 'inline', path: 'content/images/inline-test/inline-2.png', prompt: 'Second image' }
      ]);
      repo.artifacts.put('inline-test', 'images.json', manifest);

      const app = createApp(repo, config, { substackService: mockService });
      const res = await app.request('/api/articles/inline-test/draft', { method: 'POST' });
      expect(res.status).toBe(200);

      const callArgs = (mockService.createDraft as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const bodyJson = callArgs.bodyHtml as string;

      // Parse the JSON to validate ProseMirror structure
      const doc = JSON.parse(bodyJson);
      expect(doc.type).toBe('doc');
      expect(validateProseMirrorBody(doc).valid).toBe(true);
      
      // Convert to HTML to verify content
      const html = proseMirrorToHtml(doc);
      expect(html).toContain('First para');
      expect(html).toContain('Fourth para');
    });

    it('rewrites markdown image nodes to uploaded Substack URLs without duplicating them', async () => {
      const mockService = createMockSubstackService();
      const imagesDir = join(tempDir, 'images');
      const slugDir = join(imagesDir, 'rewrite-test');
      mkdirSync(slugDir, { recursive: true });
      writeFileSync(join(slugDir, 'rewrite-1.png'), 'fake-image');
      config = makeTestConfig({ dbPath: config.dbPath, articlesDir, imagesDir });

      repo.createArticle({ id: 'rewrite-test', title: 'Rewrite Test' });
      advanceToStage(repo, 'rewrite-test', 7);
      writeArticleDraft(
        repo,
        'rewrite-test',
        '# Article\n\n![Rewrite alt|Rewrite caption](../../images/rewrite-test/rewrite-1.png)\n\nBody paragraph.',
      );

      const app = createApp(repo, config, { substackService: mockService });
      const res = await app.request('/api/articles/rewrite-test/draft', { method: 'POST' });
      expect(res.status).toBe(200);

      const callArgs = (mockService.createDraft as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const bodyJson = callArgs.bodyHtml as string;
      const doc = JSON.parse(bodyJson);
      expect(validateProseMirrorBody(doc).valid).toBe(true);

      const images = doc.content.filter((node: { type: string }) => node.type === 'captionedImage');
      expect(images).toHaveLength(1);
      expect(images[0].content[0].attrs.src).toBe('https://cdn.substack.com/image.png');
      expect(mockService.uploadImage).toHaveBeenCalledOnce();

      const html = proseMirrorToHtml(doc);
      expect(html).toContain('https://cdn.substack.com/image.png');
      expect(html).not.toContain('../../images/rewrite-test/rewrite-1.png');
    });

  });

  // ── POST /api/articles/:id/publish (publish draft) ─────────────────────────

  describe('POST /api/articles/:id/publish', () => {
    it('publishes existing draft and advances to Stage 8', async () => {
      const mockService = createMockSubstackService();
      repo.createArticle({ id: 'pub-test', title: 'Publish Test' });
      advanceToStage(repo, 'pub-test', 7);
      writeArticleDraft(repo, 'pub-test', '# Publish Test\n\nLatest content.');
      repo.setDraftUrl('pub-test', 'https://test.substack.com/publish/post/12345');

      const app = createApp(repo, config, { substackService: mockService });
      const res = await app.request('/api/articles/pub-test/publish', { method: 'POST' });
      expect(res.status).toBe(200);

      const body = await res.json() as { success: boolean; publishedUrl: string };
      expect(body.success).toBe(true);
      expect(body.publishedUrl).toBe('https://test.substack.com/p/test-article');

      expect(mockService.publishDraft).toHaveBeenCalledWith({ draftId: '12345' });
      expect(mockService.updateDraft).toHaveBeenCalledOnce();

      // Article should be at Stage 8 with substack_url set
      const updated = repo.getArticle('pub-test');
      expect(updated?.current_stage).toBe(8);
      expect(updated?.substack_url).toBe('https://test.substack.com/p/test-article');
      expect(updated?.status).toBe('published');
      expect(updated?.published_at).toBeTruthy();
    });

    it('returns error when publishing without an existing linked Substack draft', async () => {
      const mockService = createMockSubstackService();
      repo.createArticle({ id: 'no-draft', title: 'No Draft' });
      advanceToStage(repo, 'no-draft', 7);
      writeArticleDraft(repo, 'no-draft', '# No Draft\n\nReady to publish.');

      const app = createApp(repo, config, { substackService: mockService });
      const res = await app.request('/api/articles/no-draft/publish', { method: 'POST' });
      expect(res.status).toBe(500);

      const body = await res.json() as { error: string };
      expect(body.error).toContain('No linked Substack draft found');
      expect(mockService.createDraft).not.toHaveBeenCalled();
      expect(mockService.updateDraft).not.toHaveBeenCalled();
      expect(mockService.publishDraft).not.toHaveBeenCalled();
    });

    it('returns error when no article markdown exists for publish-now', async () => {
      const mockService = createMockSubstackService();
      repo.createArticle({ id: 'no-publish-md', title: 'No Publish MD' });
      advanceToStage(repo, 'no-publish-md', 7);

      const app = createApp(repo, config, { substackService: mockService });
      const res = await app.request('/api/articles/no-publish-md/publish', { method: 'POST' });
      expect(res.status).toBe(500);

      const body = await res.json() as { error: string };
      expect(body.error).toContain('No article draft found yet');
    });

    it('returns error when SubstackService not configured', async () => {
      repo.createArticle({ id: 'no-svc-pub', title: 'No Service Pub' });
      repo.setDraftUrl('no-svc-pub', 'https://test.substack.com/publish/post/999');

      const app = createApp(repo, config);
      const res = await app.request('/api/articles/no-svc-pub/publish', { method: 'POST' });
      expect(res.status).toBe(500);

      const body = await res.json() as { error: string };
      expect(body.error).toContain('not configured');
    });

    it('returns error when publish API fails', async () => {
      const mockService = createMockSubstackService({
        publishDraft: vi.fn().mockRejectedValue(new Error('Substack 503')),
      } as unknown as Partial<SubstackService>);
      repo.createArticle({ id: 'pub-fail', title: 'Pub Fail' });
      advanceToStage(repo, 'pub-fail', 7);
      writeArticleDraft(repo, 'pub-fail', '# Pub Fail\n\nLatest content.');
      repo.setDraftUrl('pub-fail', 'https://test.substack.com/publish/post/999');

      const app = createApp(repo, config, { substackService: mockService });
      const res = await app.request('/api/articles/pub-fail/publish', { method: 'POST' });
      expect(res.status).toBe(500);

      const body = await res.json() as { error: string };
      expect(body.error).toContain('Substack 503');
    });

    it('returns htmx HTML for published result', async () => {
      const mockService = createMockSubstackService();
      repo.createArticle({ id: 'htmx-pub', title: 'HTMX Pub' });
      advanceToStage(repo, 'htmx-pub', 7);
      writeArticleDraft(repo, 'htmx-pub', '# HTMX Pub\n\nLatest content.');
      repo.setDraftUrl('htmx-pub', 'https://test.substack.com/publish/post/12345');

      const app = createApp(repo, config, { substackService: mockService });
      const res = await app.request('/api/articles/htmx-pub/publish', {
        method: 'POST',
        headers: { 'hx-request': 'true' },
      });
      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain('Published to Substack using the latest article content.');
      expect(html).toContain('substack.com');
    });

    it('returns an actionable HTMX message when publish is unavailable', async () => {
      repo.createArticle({ id: 'htmx-no-svc-pub', title: 'HTMX No Service Publish' });
      advanceToStage(repo, 'htmx-no-svc-pub', 7);
      writeArticleDraft(repo, 'htmx-no-svc-pub', '# Draft\n\nContent.');

      const app = createApp(repo, config);
      const res = await app.request('/api/articles/htmx-no-svc-pub/publish', {
        method: 'POST',
        headers: { 'hx-request': 'true' },
      });
      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain('Substack publishing is not configured.');
      expect(html).toContain('Configure Substack credentials');
      expect(html).toContain('/config');
      expect(html).toContain('aria-disabled="true"');
    });

    it('updates article with substack_url on publish', async () => {
      const mockService = createMockSubstackService({
        publishDraft: vi.fn().mockResolvedValue({
          id: '99',
          slug: 'my-article',
          canonicalUrl: 'https://test.substack.com/p/my-article',
          isPublished: true,
        }),
      } as unknown as Partial<SubstackService>);

      repo.createArticle({ id: 'url-check', title: 'URL Check' });
      advanceToStage(repo, 'url-check', 7);
      writeArticleDraft(repo, 'url-check', '# URL Check\n\nLatest content.');
      repo.setDraftUrl('url-check', 'https://test.substack.com/publish/post/99');

      const app = createApp(repo, config, { substackService: mockService });
      await app.request('/api/articles/url-check/publish', { method: 'POST' });

      const article = repo.getArticle('url-check');
      expect(article?.substack_url).toBe('https://test.substack.com/p/my-article');
      expect(article?.current_stage).toBe(8);
    });

    it('returns 404 for missing article', async () => {
      const mockService = createMockSubstackService();
      const app = createApp(repo, config, { substackService: mockService });
      const res = await app.request('/api/articles/ghost/publish', { method: 'POST' });
      expect(res.status).toBe(404);
    });
  });

  // ── POST /api/articles/:id/note (post Substack note) ────────────────────────

  describe('POST /api/articles/:id/note', () => {
    it('posts a note and returns success', async () => {
      const mockService = createMockSubstackService();
      repo.createArticle({ id: 'note-test', title: 'Note Test' });

      const app = createApp(repo, config, { substackService: mockService });
      const form = new FormData();
      form.append('content', 'Check out this article!');
      form.append('attachArticle', 'on');

      const res = await app.request('/api/articles/note-test/note', {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(200);

      const body = await res.json() as { success: boolean; noteUrl: string; noteId: string };
      expect(body.success).toBe(true);
      expect(body.noteUrl).toContain('substack.com');
      expect(body.noteId).toBe('1');

      expect(mockService.createNote).toHaveBeenCalledOnce();
      const callArgs = (mockService.createNote as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.content).toBe('Check out this article!');
      expect(callArgs.articleSlug).toBe('note-test');
    });

    it('returns error when SubstackService not configured', async () => {
      repo.createArticle({ id: 'note-no-svc', title: 'No Service Note' });

      const app = createApp(repo, config);
      const form = new FormData();
      form.append('content', 'Hello');

      const res = await app.request('/api/articles/note-no-svc/note', {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(500);

      const body = await res.json() as { error: string };
      expect(body.error).toContain('not configured');
    });

    it('returns error when content is empty', async () => {
      const mockService = createMockSubstackService();
      repo.createArticle({ id: 'note-empty', title: 'Empty Note' });

      const app = createApp(repo, config, { substackService: mockService });
      const form = new FormData();
      form.append('content', '');

      const res = await app.request('/api/articles/note-empty/note', {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(400);

      const body = await res.json() as { error: string };
      expect(body.error).toContain('required');
    });

    it('returns error when createNote throws', async () => {
      const mockService = createMockSubstackService({
        createNote: vi.fn().mockRejectedValue(new Error('Notes rate limit')),
      } as unknown as Partial<SubstackService>);
      repo.createArticle({ id: 'note-fail', title: 'Note Fail' });

      const app = createApp(repo, config, { substackService: mockService });
      const form = new FormData();
      form.append('content', 'Hello world');

      const res = await app.request('/api/articles/note-fail/note', {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(500);

      const body = await res.json() as { error: string };
      expect(body.error).toContain('Notes rate limit');
    });

    it('returns htmx HTML on success', async () => {
      const mockService = createMockSubstackService();
      repo.createArticle({ id: 'note-htmx', title: 'HTMX Note' });

      const app = createApp(repo, config, { substackService: mockService });
      const form = new FormData();
      form.append('content', 'Great article!');

      const res = await app.request('/api/articles/note-htmx/note', {
        method: 'POST',
        body: form,
        headers: { 'hx-request': 'true' },
      });
      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain('Note posted');
      expect(html).toContain('substack.com');
    });

    it('returns 404 for missing article', async () => {
      const mockService = createMockSubstackService();
      const app = createApp(repo, config, { substackService: mockService });
      const form = new FormData();
      form.append('content', 'Hello');

      const res = await app.request('/api/articles/ghost/note', {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(404);
    });

    it('does not attach article slug when checkbox is off', async () => {
      const mockService = createMockSubstackService();
      repo.createArticle({ id: 'note-noattach', title: 'No Attach' });

      const app = createApp(repo, config, { substackService: mockService });
      const form = new FormData();
      form.append('content', 'Standalone note');

      const res = await app.request('/api/articles/note-noattach/note', {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(200);

      const callArgs = (mockService.createNote as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.articleSlug).toBeUndefined();
    });
  });

  // ── POST /api/articles/:id/tweet (post tweet to X) ──────────────────────────

  describe('POST /api/articles/:id/tweet', () => {
    it('posts a tweet and returns success', async () => {
      const mockTwitter = createMockTwitterService();
      repo.createArticle({ id: 'tweet-ok', title: 'Tweet Test' });

      const app = createApp(repo, config, { twitterService: mockTwitter });
      const form = new FormData();
      form.append('content', 'Check out this analysis!');

      const res = await app.request('/api/articles/tweet-ok/tweet', {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(200);

      const body = await res.json() as { success: boolean; tweetUrl: string; tweetId: string };
      expect(body.success).toBe(true);
      expect(body.tweetUrl).toContain('x.com');
      expect(body.tweetId).toBe('1234567890');

      expect(mockTwitter.postTweet).toHaveBeenCalledOnce();
    });

    it('returns error when TwitterService not configured', async () => {
      repo.createArticle({ id: 'tweet-no-svc', title: 'No Twitter' });

      const app = createApp(repo, config); // no deps
      const form = new FormData();
      form.append('content', 'Hello');

      const res = await app.request('/api/articles/tweet-no-svc/tweet', {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(500);

      const body = await res.json() as { error: string };
      expect(body.error).toContain('not configured');
    });

    it('returns error when content is empty', async () => {
      const mockTwitter = createMockTwitterService();
      repo.createArticle({ id: 'tweet-empty', title: 'Empty Tweet' });

      const app = createApp(repo, config, { twitterService: mockTwitter });
      const form = new FormData();
      form.append('content', '');

      const res = await app.request('/api/articles/tweet-empty/tweet', {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(400);

      const body = await res.json() as { error: string };
      expect(body.error).toContain('required');
    });

    it('returns 404 for missing article', async () => {
      const mockTwitter = createMockTwitterService();
      const app = createApp(repo, config, { twitterService: mockTwitter });
      const form = new FormData();
      form.append('content', 'Hello');

      const res = await app.request('/api/articles/ghost/tweet', {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(404);
    });

    it('returns htmx HTML on success', async () => {
      const mockTwitter = createMockTwitterService();
      repo.createArticle({ id: 'tweet-htmx', title: 'HTMX Tweet' });

      const app = createApp(repo, config, { twitterService: mockTwitter });
      const form = new FormData();
      form.append('content', 'Great analysis!');

      const res = await app.request('/api/articles/tweet-htmx/tweet', {
        method: 'POST',
        body: form,
        headers: { 'hx-request': 'true' },
      });
      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain('tweet-success');
      expect(html).toContain('Tweet posted');
    });

    it('returns htmx HTML for dry run', async () => {
      const mockTwitter = createMockTwitterService({
        postTweet: vi.fn().mockResolvedValue({
          id: 'dry_1234',
          url: '',
          text: 'Dry run tweet',
        } satisfies TweetResult),
      } as unknown as Partial<TwitterService>);
      repo.createArticle({ id: 'tweet-dry', title: 'Dry Run Tweet' });

      const app = createApp(repo, config, { twitterService: mockTwitter });
      const form = new FormData();
      form.append('content', 'Test tweet');
      form.append('dryRun', 'on');

      const res = await app.request('/api/articles/tweet-dry/tweet', {
        method: 'POST',
        body: form,
        headers: { 'hx-request': 'true' },
      });
      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain('Dry run');
    });

    it('returns error when postTweet throws', async () => {
      const mockTwitter = createMockTwitterService({
        postTweet: vi.fn().mockRejectedValue(new Error('Rate limit exceeded')),
      } as unknown as Partial<TwitterService>);
      repo.createArticle({ id: 'tweet-fail', title: 'Tweet Fail' });

      const app = createApp(repo, config, { twitterService: mockTwitter });
      const form = new FormData();
      form.append('content', 'Hello world');

      const res = await app.request('/api/articles/tweet-fail/tweet', {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(500);

      const body = await res.json() as { error: string };
      expect(body.error).toContain('Rate limit exceeded');
    });

    it('appends article substack_url to tweet content', async () => {
      const mockTwitter = createMockTwitterService();
      repo.createArticle({ id: 'tweet-url', title: 'URL Append' });
      // Set substack_url on the article
      repo.db.prepare('UPDATE articles SET substack_url = ? WHERE id = ?')
        .run('https://test.substack.com/p/tweet-url', 'tweet-url');

      const app = createApp(repo, config, { twitterService: mockTwitter });
      const form = new FormData();
      form.append('content', 'Check this out');

      const res = await app.request('/api/articles/tweet-url/tweet', {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(200);

      const callArgs = (mockTwitter.postTweet as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.content).toContain('https://test.substack.com/p/tweet-url');
    });
  });
});
