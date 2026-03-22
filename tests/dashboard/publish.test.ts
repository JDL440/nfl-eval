import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Repository } from '../../src/db/repository.js';
import { createApp } from '../../src/dashboard/server.js';
import { proseMirrorToHtml } from '../../src/dashboard/views/publish.js';
import { markdownToProseMirror } from '../../src/services/prosemirror.js';
import type { AppConfig } from '../../src/config/index.js';
import type { SubstackService, SubstackDraft, SubstackPost } from '../../src/services/substack.js';
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
    repo.close();
    rmSync(tempDir, { recursive: true, force: true });
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
    it('renders publish preview page with article content', async () => {
      repo.createArticle({ id: 'pub-preview', title: 'Publish Preview Test' });
      advanceToStage(repo, 'pub-preview', 7);
      writeArticleDraft(repo, 'pub-preview', '# Test Article\n\nSome content here.');

      const app = createApp(repo, config);
      const res = await app.request('/articles/pub-preview/publish');
      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain('Publish Preview Test');
      expect(html).toContain('Test Article');
      expect(html).toContain('Some content here');
      expect(html).toContain('Article Preview');
      expect(html).toContain('Create Draft');
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
      expect(html).toContain('No article draft found');
    });

    it('displays publish actions without checklist gate', async () => {
      repo.createArticle({ id: 'with-pass', title: 'With Pass' });
      advanceToStage(repo, 'with-pass', 7);
      writeArticleDraft(repo, 'with-pass', '# Article\n\nContent');

      const app = createApp(repo, config);
      const res = await app.request('/articles/with-pass/publish');
      const html = await res.text();
      expect(html).toContain('Publish Actions');
      expect(html).toContain('Article Preview');
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
      expect(html).toContain('Section');
      expect(html).toContain('Body text');
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
    it('converts markdown via ProseMirror and creates draft', async () => {
      const mockService = createMockSubstackService();
      repo.createArticle({ id: 'draft-test', title: 'Draft Test' });
      advanceToStage(repo, 'draft-test', 7);
      writeArticleDraft(repo, 'draft-test', '# Draft\n\nContent here.');

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

      // Draft URL should be stored on the article
      const updated = repo.getArticle('draft-test');
      expect(updated?.substack_draft_url).toBe('https://test.substack.com/publish/post/12345');
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
      expect(html).toContain('Draft created');
      expect(html).toContain('substack.com');
    });
  });

  // ── POST /api/articles/:id/publish (publish draft) ─────────────────────────

  describe('POST /api/articles/:id/publish', () => {
    it('publishes existing draft and advances to Stage 8', async () => {
      const mockService = createMockSubstackService();
      repo.createArticle({ id: 'pub-test', title: 'Publish Test' });
      advanceToStage(repo, 'pub-test', 7);
      repo.setDraftUrl('pub-test', 'https://test.substack.com/publish/post/12345');

      const app = createApp(repo, config, { substackService: mockService });
      const res = await app.request('/api/articles/pub-test/publish', { method: 'POST' });
      expect(res.status).toBe(200);

      const body = await res.json() as { success: boolean; publishedUrl: string };
      expect(body.success).toBe(true);
      expect(body.publishedUrl).toBe('https://test.substack.com/p/test-article');

      expect(mockService.publishDraft).toHaveBeenCalledWith({ draftId: '12345' });

      // Article should be at Stage 8 with substack_url set
      const updated = repo.getArticle('pub-test');
      expect(updated?.current_stage).toBe(8);
      expect(updated?.substack_url).toBe('https://test.substack.com/p/test-article');
      expect(updated?.status).toBe('published');
      expect(updated?.published_at).toBeTruthy();
    });

    it('returns error when no draft exists', async () => {
      const mockService = createMockSubstackService();
      repo.createArticle({ id: 'no-draft', title: 'No Draft' });

      const app = createApp(repo, config, { substackService: mockService });
      const res = await app.request('/api/articles/no-draft/publish', { method: 'POST' });
      expect(res.status).toBe(400);

      const body = await res.json() as { error: string };
      expect(body.error).toContain('No draft exists');
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
      repo.setDraftUrl('htmx-pub', 'https://test.substack.com/publish/post/12345');

      const app = createApp(repo, config, { substackService: mockService });
      const res = await app.request('/api/articles/htmx-pub/publish', {
        method: 'POST',
        headers: { 'hx-request': 'true' },
      });
      expect(res.status).toBe(200);

      const html = await res.text();
      expect(html).toContain('Published!');
      expect(html).toContain('substack.com');
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
