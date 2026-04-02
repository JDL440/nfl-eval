import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Repository } from '../../src/db/repository.js';
import { createApp } from '../../src/dashboard/server.js';
import type { AppConfig } from '../../src/config/index.js';

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

describe('Dashboard article metadata editing', () => {
  let repo: Repository;
  let tempDir: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nfl-meta-test-'));
    const dbPath = join(tempDir, 'test.db');
    const articlesDir = join(tempDir, 'articles');
    mkdirSync(articlesDir, { recursive: true });
    repo = new Repository(dbPath);
    app = createApp(repo, makeTestConfig({ dbPath, articlesDir }));
  });

  afterEach(() => {
    repo.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('PATCH /api/articles/:id', () => {
    it('updates whitelisted fields with validation + normalization', async () => {
      repo.createArticle({ id: 'a1', title: 'Old Title' });
      const before = repo.getArticle('a1')!;

      const res = await app.request('/api/articles/a1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '  New Title  ',
          subtitle: '   ',
          depth_level: 4,
          teams: [' seahawks ', 'seahawks', 'chiefs'],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as { id: string; title: string; subtitle: string | null; depth_level: number; teams: string | null; updated_at: string };
      expect(body.id).toBe('a1');
      expect(body.title).toBe('New Title');
      expect(body.subtitle).toBeNull();
      expect(body.depth_level).toBe(4);
      expect(body.teams).toBe(JSON.stringify(['seahawks', 'chiefs']));
      // updated_at is second-resolution in sqlite helpers; avoid flakiness when updates occur within the same second.
      expect(body.updated_at).toBeTypeOf('string');

      const persisted = repo.getArticle('a1')!;
      expect(persisted.title).toBe('New Title');
      expect(persisted.subtitle).toBeNull();
      expect(persisted.depth_level).toBe(4);
      expect(persisted.article_form).toBe('feature');
      expect(persisted.preset_id).toBe('narrative_feature');
      expect(persisted.teams).toBe(JSON.stringify(['seahawks', 'chiefs']));
    });

    it('rejects unknown fields (id/slug immutability)', async () => {
      repo.createArticle({ id: 'a2', title: 'Immutability' });

      const res = await app.request('/api/articles/a2', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: 'new-slug' }),
      });

      expect(res.status).toBe(400);
      const after = repo.getArticle('a2')!;
      expect(after.id).toBe('a2');
      expect(after.title).toBe('Immutability');
    });
  });

  describe('HTMX inline metadata partials', () => {
    it('GET /htmx/articles/:id/meta returns display partial', async () => {
      repo.createArticle({ id: 'h1', title: 'HTMX Title' });
      repo.recordUsageEvent({
        articleId: 'h1',
        surface: 'ideaGeneration',
        provider: 'openai',
        modelOrTool: 'gpt-5.2-codex',
        promptTokens: 300,
        outputTokens: 150,
      });

      const res = await app.request('/htmx/articles/h1/meta');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('HTMX Title');
      expect(html).toContain('hx-get="/htmx/articles/h1/edit-meta"');
      expect(html).toContain('id="article-meta"');
      expect(html).toContain('badge-model">gpt-5.2-codex</span>');
    });

    it('POST /htmx/articles/:id/edit-meta saves and returns updated display partial', async () => {
      repo.createArticle({ id: 'h2', title: 'Before' });

      const form = new URLSearchParams({
        title: 'After',
        subtitle: 'Sub',
        depth_level: '3',
        teams: 'seahawks, chiefs, seahawks',
      });

      const res = await app.request('/htmx/articles/h2/edit-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });

      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('After');
      expect(html).toContain('Sub');
      expect(html).toContain('Deep Dive');
      expect(html).toContain('badge-team');

      const updated = repo.getArticle('h2')!;
      expect(updated.title).toBe('After');
      expect(updated.subtitle).toBe('Sub');
      expect(updated.depth_level).toBe(3);
      expect(updated.article_form).toBe('deep');
      expect(updated.teams).toBe(JSON.stringify(['seahawks', 'chiefs']));
    });

    it('POST /htmx/articles/:id/edit-meta returns a 400 partial for invalid panel constraints JSON', async () => {
      repo.createArticle({ id: 'h3', title: 'Before' });

      const form = new URLSearchParams({
        panel_constraints_json: '{bad json',
      });

      const res = await app.request('/htmx/articles/h3/edit-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });

      expect(res.status).toBe(400);
      const html = await res.text();
      expect(html).toContain('Invalid panel_constraints_json');
      expect(repo.getArticle('h3')?.panel_constraints_json).toBeNull();
    });
  });
});
