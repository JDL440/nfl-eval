import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Repository } from '../../src/db/repository.js';
import { createApp } from '../../src/dashboard/server.js';
import { ImageService } from '../../src/services/image.js';
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

describe('Image Generation Endpoint', () => {
  let repo: Repository;
  let tempDir: string;
  let imagesDir: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nfl-img-endpoint-'));
    const dbPath = join(tempDir, 'test.db');
    const articlesDir = join(tempDir, 'articles');
    imagesDir = join(tempDir, 'images');
    mkdirSync(articlesDir, { recursive: true });
    mkdirSync(imagesDir, { recursive: true });
    repo = new Repository(dbPath);
    const imageService = new ImageService({ provider: 'stub', outputDir: imagesDir });
    app = createApp(repo, makeTestConfig({ dbPath, articlesDir, imagesDir }), { imageService });
  });

  afterEach(() => {
    repo.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns 404 for nonexistent article', async () => {
    const res = await app.request('/api/articles/nonexistent/generate-images', { method: 'POST' });
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Not found');
  });

  it('returns 422 when article is below Stage 5', async () => {
    repo.createArticle({ id: 'stage1-art', title: 'Stage 1 Article' });

    const res = await app.request('/api/articles/stage1-art/generate-images', { method: 'POST' });
    expect(res.status).toBe(422);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('Stage 5+');
  });

  it('returns 422 for Stage 4 article', async () => {
    repo.createArticle({ id: 'stage4-art', title: 'Stage 4 Article' });
    for (let s = 2; s <= 4; s++) {
      repo.advanceStage('stage4-art', s - 1, s, 'test');
    }

    const res = await app.request('/api/articles/stage4-art/generate-images', { method: 'POST' });
    expect(res.status).toBe(422);
  });

  it('generates images for Stage 5+ article', async () => {
    repo.createArticle({ id: 'stage5-art', title: 'Ready Article', primary_team: 'Seattle Seahawks' });
    for (let s = 2; s <= 5; s++) {
      repo.advanceStage('stage5-art', s - 1, s, 'test');
    }
    repo.artifacts.put('stage5-art', 'draft.md', '# Ready Article\n\nSome draft content here.');

    const res = await app.request('/api/articles/stage5-art/generate-images', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; count: number };
    expect(body.success).toBe(true);
    expect(body.count).toBe(3); // 1 cover + 2 inline
  });

  it('saves images.json artifact after generation', async () => {
    repo.createArticle({ id: 'manifest-art', title: 'Manifest Test' });
    for (let s = 2; s <= 5; s++) {
      repo.advanceStage('manifest-art', s - 1, s, 'test');
    }
    repo.artifacts.put('manifest-art', 'draft.md', '# Manifest Test\n\nContent.');

    await app.request('/api/articles/manifest-art/generate-images', { method: 'POST' });

    const manifestJson = repo.artifacts.get('manifest-art', 'images.json');
    expect(manifestJson).toBeTruthy();

    const manifest = JSON.parse(manifestJson!) as { type: string; path: string; prompt: string }[];
    expect(manifest).toHaveLength(3);
    expect(manifest[0].type).toBe('cover');
    expect(manifest[1].type).toBe('inline');
    expect(manifest[2].type).toBe('inline');
    expect(manifest[0].path).toContain('cover.png');
    expect(manifest[0].prompt).toBeTruthy();
  });

  it('returns 500 when imageService is not configured', async () => {
    // Create app without image service
    const appNoImages = createApp(repo, makeTestConfig());
    repo.createArticle({ id: 'no-svc', title: 'No Service' });
    for (let s = 2; s <= 5; s++) {
      repo.advanceStage('no-svc', s - 1, s, 'test');
    }

    const res = await appNoImages.request('/api/articles/no-svc/generate-images', { method: 'POST' });
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('not configured');
  });

  it('article detail page shows image section for Stage 5+', async () => {
    repo.createArticle({ id: 'ui-test', title: 'UI Test Article' });
    for (let s = 2; s <= 5; s++) {
      repo.advanceStage('ui-test', s - 1, s, 'test');
    }

    const res = await app.request('/articles/ui-test');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Article Images');
    expect(html).toContain('Generate Images');
  });

  it('article detail page does NOT show image section for Stage <5', async () => {
    repo.createArticle({ id: 'early-stage', title: 'Early Stage' });

    const res = await app.request('/articles/early-stage');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain('Article Images');
    expect(html).not.toContain('Generate Images');
  });

  it('htmx image gallery returns images after generation', async () => {
    repo.createArticle({ id: 'gallery-art', title: 'Gallery Test' });
    for (let s = 2; s <= 5; s++) {
      repo.advanceStage('gallery-art', s - 1, s, 'test');
    }
    repo.artifacts.put('gallery-art', 'draft.md', '# Gallery\n\nContent.');

    // Generate first
    await app.request('/api/articles/gallery-art/generate-images', { method: 'POST' });

    // Then fetch gallery
    const res = await app.request('/htmx/articles/gallery-art/images');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Cover');
    expect(html).toContain('Inline');
    expect(html).toContain('View prompt');
  });

  it('htmx generate-images returns HTML fragment', async () => {
    repo.createArticle({ id: 'htmx-gen', title: 'HTMX Generate' });
    for (let s = 2; s <= 5; s++) {
      repo.advanceStage('htmx-gen', s - 1, s, 'test');
    }
    repo.artifacts.put('htmx-gen', 'draft.md', '# HTMX\n\nContent.');

    const res = await app.request('/htmx/articles/htmx-gen/generate-images', { method: 'POST' });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Generated');
    expect(html).toContain('3 image(s)');
  });
});
