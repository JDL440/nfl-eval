import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Repository } from '../../src/db/repository.js';
import { createApp } from '../../src/dashboard/server.js';
import type { AppConfig } from '../../src/config/index.js';
import {
  renderNewIdeaForm,
  renderIdeaSuccess,
  generateSlug,
  validateIdeaForm,
} from '../../src/dashboard/views/new-idea.js';

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
    port: 3456,
    env: 'development',
    ...overrides,
  };
}

// ── Pure unit tests ─────────────────────────────────────────────────────────

describe('generateSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  it('removes special characters', () => {
    expect(generateSlug("Can Jalen Hurts Sustain His MVP Pace?")).toBe(
      'can-jalen-hurts-sustain-his-mvp-pace',
    );
  });

  it('collapses multiple hyphens', () => {
    expect(generateSlug('Too   Many   Spaces')).toBe('too-many-spaces');
  });

  it('truncates to 60 characters', () => {
    const long = 'a'.repeat(100);
    expect(generateSlug(long).length).toBeLessThanOrEqual(60);
  });

  it('strips leading/trailing hyphens', () => {
    expect(generateSlug('  --hello-- ')).toBe('hello');
  });
});

describe('validateIdeaForm', () => {
  it('rejects missing title', () => {
    const errors = validateIdeaForm({ title: '', description: 'A long enough description here' });
    expect(errors.some(e => e.field === 'title')).toBe(true);
  });

  it('rejects short title', () => {
    const errors = validateIdeaForm({ title: 'Hi', description: 'A long enough description here' });
    expect(errors.some(e => e.field === 'title')).toBe(true);
  });

  it('rejects title over 200 chars', () => {
    const errors = validateIdeaForm({ title: 'x'.repeat(201), description: 'A long enough description here' });
    expect(errors.some(e => e.field === 'title')).toBe(true);
  });

  it('rejects short description', () => {
    const errors = validateIdeaForm({ title: 'Valid Title', description: 'Too short' });
    expect(errors.some(e => e.field === 'description')).toBe(true);
  });

  it('rejects missing description', () => {
    const errors = validateIdeaForm({ title: 'Valid Title', description: '' });
    expect(errors.some(e => e.field === 'description')).toBe(true);
  });

  it('accepts valid form data', () => {
    const errors = validateIdeaForm({
      title: 'Valid Title Here',
      description: 'This is a long enough description for validation purposes.',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid depth level', () => {
    const errors = validateIdeaForm({
      title: 'Valid Title',
      description: 'A long enough description here',
      depth_level: 5,
    });
    expect(errors.some(e => e.field === 'depth_level')).toBe(true);
  });
});

// ── View rendering tests ────────────────────────────────────────────────────

describe('renderNewIdeaForm', () => {
  const config = makeTestConfig();

  it('renders a full page with correct fields', () => {
    const html = renderNewIdeaForm(config);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Submit New Idea');
    expect(html).toContain('name="title"');
    expect(html).toContain('name="description"');
    expect(html).toContain('name="primary_team"');
    expect(html).toContain('name="depth_level"');
    expect(html).toContain('name="time_sensitive"');
    expect(html).toContain('name="target_publish_date"');
    expect(html).toContain('Submit Idea');
  });

  it('includes team options in dropdown', () => {
    const html = renderNewIdeaForm(config);
    expect(html).toContain('Seattle Seahawks');
    expect(html).toContain('Kansas City Chiefs');
  });

  it('defaults depth level to 2', () => {
    const html = renderNewIdeaForm(config);
    expect(html).toContain('value="2" selected');
  });

  it('renders validation errors when provided', () => {
    const html = renderNewIdeaForm(config, [
      { field: 'title', message: 'Title is required' },
    ]);
    expect(html).toContain('Title is required');
    expect(html).toContain('has-error');
  });
});

describe('renderIdeaSuccess', () => {
  it('renders success message with article link', () => {
    const html = renderIdeaSuccess({ id: 'test-slug', title: 'Test Article' });
    expect(html).toContain('Idea Submitted');
    expect(html).toContain('Test Article');
    expect(html).toContain('/articles/test-slug');
    expect(html).toContain('View Article');
    expect(html).toContain('Submit Another');
  });
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function longText(wordCount: number): string {
  return Array.from({ length: wordCount }, (_, i) => `word${i}`).join(' ');
}

// ── Integration tests (server routes) ────────────────────────────────────────

describe('New Idea Routes', () => {
  let repo: Repository;
  let tempDir: string;
  let articlesDir: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nfl-idea-test-'));
    articlesDir = join(tempDir, 'leagues', 'nfl', 'articles');
    const dbPath = join(tempDir, 'test.db');
    repo = new Repository(dbPath);
    app = createApp(repo, makeTestConfig({ dbPath, articlesDir, dataDir: tempDir }));
  });

  afterEach(() => {
    repo.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('GET /ideas/new', () => {
    it('renders the full idea form page', async () => {
      const res = await app.request('/ideas/new');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('New Article Idea');
      expect(html).toContain('name="prompt"');
      expect(html).toContain('team-grid');
      expect(html).toContain('auto-advance');
    });
  });

  describe('POST /api/ideas', () => {
    it('creates article in DB and idea.md file', async () => {
      const res = await app.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Can Geno Smith Lead a Playoff Run',
          description: 'An analysis of whether Geno Smith has what it takes to lead Seattle to the playoffs this season.',
          primary_team: 'Seattle Seahawks',
          depth_level: 2,
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as { id: string; title: string; primary_team: string; depth_level: number };
      expect(body.id).toBe('can-geno-smith-lead-a-playoff-run');
      expect(body.title).toBe('Can Geno Smith Lead a Playoff Run');
      expect(body.primary_team).toBe('Seattle Seahawks');
      expect(body.depth_level).toBe(2);

      // Verify DB
      const article = repo.getArticle('can-geno-smith-lead-a-playoff-run');
      expect(article).not.toBeNull();
      expect(article!.current_stage).toBe(1);

      // Verify idea.md in artifact store
      const content = repo.artifacts.get('can-geno-smith-lead-a-playoff-run', 'idea.md');
      expect(content).not.toBeNull();
      expect(content).toContain('# Can Geno Smith Lead a Playoff Run');
      expect(content).toContain('An analysis of whether Geno Smith');
    });

    it('returns 400 for missing title', async () => {
      const res = await app.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '',
          description: 'A long enough description for validation purposes.',
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as { errors: { field: string }[] };
      expect(body.errors.some((e: { field: string }) => e.field === 'title')).toBe(true);
    });

    it('returns 400 for short description', async () => {
      const res = await app.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Valid Title',
          description: 'Too short',
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as { errors: { field: string }[] };
      expect(body.errors.some((e: { field: string }) => e.field === 'description')).toBe(true);
    });

    it('defaults depth_level to 2', async () => {
      const res = await app.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Default Depth Test',
          description: 'A long enough description for the depth level test purposes.',
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as { depth_level: number };
      expect(body.depth_level).toBe(2);
    });
  });

  describe('POST /htmx/ideas (full form)', () => {
    it('creates article and returns success partial', async () => {
      const formBody = new URLSearchParams();
      formBody.set('title', 'HTMX Full Idea Test');
      formBody.set('description', 'This is a detailed description for the HTMX full idea form submission test.');
      formBody.set('primary_team', 'Buffalo Bills');
      formBody.set('depth_level', '3');

      const res = await app.request('/htmx/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.toString(),
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Idea Submitted');
      expect(html).toContain('HTMX Full Idea Test');

      // Verify DB
      const article = repo.getArticle('htmx-full-idea-test');
      expect(article).not.toBeNull();
      expect(article!.primary_team).toBe('Buffalo Bills');
      expect(article!.depth_level).toBe(3);

      // Verify idea.md in artifact store
      expect(repo.artifacts.exists('htmx-full-idea-test', 'idea.md')).toBe(true);
    });

    it('returns validation errors for missing fields', async () => {
      const formBody = new URLSearchParams();
      formBody.set('title', 'Hi');
      formBody.set('description', 'Short');

      const res = await app.request('/htmx/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.toString(),
      });
      expect(res.status).toBe(422);
      const html = await res.text();
      expect(html).toContain('fix the following errors');
    });

    it('legacy form still works (id field, no description)', async () => {
      const formBody = new URLSearchParams();
      formBody.set('id', 'legacy-idea');
      formBody.set('title', 'Legacy Idea');
      formBody.set('primary_team', 'seahawks');

      const res = await app.request('/htmx/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.toString(),
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Legacy Idea');

      const article = repo.getArticle('legacy-idea');
      expect(article).not.toBeNull();
    });
  });

  // ── Prompt-based idea creation ────────────────────────────────────────────

  describe('POST /api/ideas (prompt-based)', () => {
    it('creates article from a freeform prompt', async () => {
      const res = await app.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Analyze the Seahawks secondary depth heading into 2025',
          teams: ['SEA'],
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as { id: string; title: string; stage: number };
      expect(body.title).toBeTruthy();
      expect(body.id).toBeTruthy();
      expect(body.stage).toBe(1);

      // Verify artifact in DB
      const content = repo.artifacts.get(body.id, 'idea.md');
      expect(content).toContain('Seahawks secondary depth');
    });

    it('generates a slug from the prompt', async () => {
      const res = await app.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Why the Bills need a WR upgrade' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as { id: string };
      expect(body.id).toMatch(/^[a-z0-9-]+$/);
      expect(body.id).toContain('bills');
    });

    it('handles duplicate slugs with suffix', async () => {
      // First creation
      await app.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Unique prompt for dup test' }),
      });

      // Second creation with same prompt
      const res = await app.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Unique prompt for dup test' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as { id: string };
      expect(body.id).not.toBe('unique-prompt-for-dup-test');
    });

    it('returns 400 for empty prompt', async () => {
      const res = await app.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '   ' }),
      });
      expect(res.status).toBe(400);
    });

    it('passes autoAdvance flag in response', async () => {
      const res = await app.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Test auto advance flag',
          autoAdvance: true,
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as { autoAdvance: boolean };
      expect(body.autoAdvance).toBe(true);
    });
  });

  // ── Auto-advance ─────────────────────────────────────────────────────────

  describe('POST /api/articles/:id/auto-advance', () => {
    it('advances article through all satisfied guards', async () => {
      const slug = 'auto-adv-test';
      repo.createArticle({ id: slug, title: 'Auto Advance Test' });
      repo.artifacts.put(slug, 'idea.md', '# Test Idea\nContent here.');
      repo.artifacts.put(slug, 'discussion-prompt.md', 'Prompt content');
      repo.artifacts.put(slug, 'panel-composition.md', 'Panel: writer, editor');
      repo.artifacts.put(slug, 'discussion-summary.md', 'Discussion summary');
      repo.artifacts.put(slug, 'draft.md', longText(850));
      repo.artifacts.put(slug, 'editor-review.md', '## Verdict: APPROVED\nLooks great.');

      const res = await app.request(`/api/articles/${slug}/auto-advance`, { method: 'POST' });
      expect(res.status).toBe(200);
      const body = await res.json() as { currentStage: number; steps: unknown[] };
      expect(body.currentStage).toBe(7);
      expect(body.steps.length).toBe(6); // 1→2, 2→3, 3→4, 4→5, 5→6, 6→7
    });

    it('stops when a guard fails', async () => {
      const slug = 'auto-adv-stop';
      repo.createArticle({ id: slug, title: 'Auto Stop Test' });
      repo.artifacts.put(slug, 'idea.md', '# Idea\nContent.');
      repo.artifacts.put(slug, 'discussion-prompt.md', 'Prompt');
      // No panel-composition.md — should stop at stage 3

      const res = await app.request(`/api/articles/${slug}/auto-advance`, { method: 'POST' });
      expect(res.status).toBe(200);
      const body = await res.json() as { currentStage: number; steps: unknown[]; reason: string };
      expect(body.currentStage).toBe(3);
      expect(body.steps.length).toBe(2); // 1→2, 2→3
      expect(body.reason).toContain('Panel composition');
    });

    it('does not advance past stage 7', async () => {
      const slug = 'auto-adv-cap';
      repo.createArticle({ id: slug, title: 'Cap Test' });
      repo.artifacts.put(slug, 'idea.md', '# Idea\nContent.');
      repo.artifacts.put(slug, 'discussion-prompt.md', 'Prompt');
      repo.artifacts.put(slug, 'panel-composition.md', 'Panel');
      repo.artifacts.put(slug, 'discussion-summary.md', 'Summary');
      repo.artifacts.put(slug, 'draft.md', longText(850));
      repo.artifacts.put(slug, 'editor-review.md', '## Verdict: APPROVED\nGood.');
      // Even with publisher pass, auto-advance should stop at 7
      repo.recordPublisherPass(slug, {
        title_final: 1, subtitle_final: 1, body_clean: 1, section_assigned: 1,
        tags_set: 1, url_slug_set: 1, cover_image_set: 1, paywall_set: 1,
        email_send: 1, names_verified: 1, numbers_current: 1, no_stale_refs: 1,
        publish_datetime: new Date().toISOString(),
      });

      const res = await app.request(`/api/articles/${slug}/auto-advance`, { method: 'POST' });
      expect(res.status).toBe(200);
      const body = await res.json() as { currentStage: number; reason: string };
      expect(body.currentStage).toBe(7);
      expect(body.reason).toContain('Stage 7');
    });

    it('returns 404 for unknown article', async () => {
      const res = await app.request('/api/articles/nonexistent/auto-advance', { method: 'POST' });
      expect(res.status).toBe(404);
    });
  });
});
