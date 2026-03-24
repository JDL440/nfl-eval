import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Repository } from '../../src/db/repository.js';
import { createApp } from '../../src/dashboard/server.js';
import type { AppConfig } from '../../src/config/index.js';
import {
  renderIdeaSuccess,
  generateSlug,
  extractTitleFromIdea,
  renderNewIdeaPage,
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
    cacheDir: '/tmp/test/data-cache',
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

describe('extractTitleFromIdea', () => {
  it('extracts title from ## Working Title section', () => {
    const md = `# Article Idea: Some Title

## Working Title
Seahawks Secondary Depth Chart Is a Mess

## Angle / Tension
Some content here.`;
    expect(extractTitleFromIdea(md)).toBe('Seahawks Secondary Depth Chart Is a Mess');
  });

  it('falls back to # Article Idea: heading', () => {
    const md = `# Article Idea: Why the Bills Need a WR Upgrade

## Angle / Tension
Buffalo's receiver room has been inconsistent.`;
    expect(extractTitleFromIdea(md)).toBe('Why the Bills Need a WR Upgrade');
  });

  it('falls back to first non-empty line', () => {
    const md = `Just a plain text idea without structure`;
    expect(extractTitleFromIdea(md)).toBe('Just a plain text idea without structure');
  });

  it('strips markdown heading markers from first line fallback', () => {
    const md = `# My Cool Idea
Some description`;
    expect(extractTitleFromIdea(md)).toBe('My Cool Idea');
  });

  it('handles empty input', () => {
    expect(extractTitleFromIdea('')).toBe('Untitled Idea');
  });

  it('handles whitespace-only input', () => {
    expect(extractTitleFromIdea('  \n  \n  ')).toBe('Untitled Idea');
  });

  it('prefers Working Title over Article Idea heading', () => {
    const md = `# Article Idea: Broad Title

## Working Title
More Specific Clickable Title

## Angle / Tension
Content.`;
    expect(extractTitleFromIdea(md)).toBe('More Specific Clickable Title');
  });

  it('handles Working Title with blank lines', () => {
    const md = `## Working Title

The Actual Title Here

## Next Section`;
    expect(extractTitleFromIdea(md)).toBe('The Actual Title Here');
  });
});

// ── View rendering tests ────────────────────────────────────────────────────

describe('renderNewIdeaPage', () => {
  it('renders the smart form with prompt, primary team, depth level, and deferred advanced controls', () => {
    const html = renderNewIdeaPage({ labName: 'NFL Lab' });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('New Article Idea');
    expect(html).toContain('name="prompt"');
    expect(html).toContain('name="primaryTeam"');
    expect(html).toContain('team-grid');
    expect(html).toContain('auto-advance');
    expect(html).toContain('name="depthLevel"');
    expect(html).toContain('Advanced options');
    expect(html).toContain('1 — Casual Fan');
    expect(html).toContain('2 — The Beat');
    expect(html).toContain('3 — Deep Dive');
  });

  it('defaults depth level to 2', () => {
    const html = renderNewIdeaPage({ labName: 'NFL Lab' });
    expect(html).toContain('value="2" selected');
  });
});

describe('Quick-action buttons', () => {
  it('contains Surprise Me button', () => {
    const html = renderNewIdeaPage({ labName: 'NFL Lab' });
    expect(html).toContain('Surprise Me');
    expect(html).toContain('id="surprise-btn"');
  });

  it('Surprise Me preset prompt is embedded in page script', () => {
    const html = renderNewIdeaPage({ labName: 'NFL Lab' });
    expect(html).toContain('Generate a surprising, timely NFL article idea');
  });

  it('keeps advanced controls behind an optional settings disclosure', () => {
    const html = renderNewIdeaPage({ labName: 'NFL Lab' });
    expect(html).toContain('<details class="idea-advanced">');
    expect(html).toContain('Lead with one prompt');
    expect(html).toContain('Primary Team');
    expect(html).toContain('Pin Expert Agents');
    expect(html).toContain('Auto-advance through pipeline');
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
    it('renders the smart idea form page', async () => {
      const res = await app.request('/ideas/new');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('New Article Idea');
      expect(html).toContain('Lead with one prompt');
      expect(html).toContain('name="prompt"');
      expect(html).toContain('name="primaryTeam"');
      expect(html).toContain('team-grid');
      expect(html).toContain('auto-advance');
      expect(html).toContain('name="depthLevel"');
      expect(html).toContain('Advanced options');
    });
  });

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

    it('stores depth level from request', async () => {
      const res = await app.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Test depth level storage',
          depthLevel: 3,
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as { id: string };
      const article = repo.getArticle(body.id);
      expect(article).not.toBeNull();
      expect(article!.depth_level).toBe(3);
    });

    it('defaults depth level to 2', async () => {
      const res = await app.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Test default depth level',
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as { id: string };
      const article = repo.getArticle(body.id);
      expect(article!.depth_level).toBe(2);
    });

    it('returns 400 for missing prompt field', async () => {
      const res = await app.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams: ['SEA'] }),
      });
      expect(res.status).toBe(400);
    });
  });

  // ── LLM-powered idea generation ─────────────────────────────────────────

  describe('POST /api/ideas (with actionContext / LLM)', () => {
    let llmApp: ReturnType<typeof createApp>;
    let runMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      // Build a mock actionContext with a fake runner.run()
      const mockIdeaContent = `# Article Idea: Seahawks Secondary Crisis

## Working Title
Devon Witherspoon Can't Do It Alone: Seattle's DB Problem

## Angle / Tension
The Seahawks secondary is thin heading into 2025.

## Primary Team
SEA — Seattle Seahawks

## Depth Level
2 — The Beat (~1500 words, 3 agents)

## Suggested Panel
Writer + Analyst + Editor

## Key Context
- Witherspoon allowed 52.3% completion rate
- Safety depth is a concern
- Draft capital may be needed

## Score
- Relevance: 3
- Timeliness: 2
- Reader Value: 3
- Uniqueness: 2
- **Total: 10/12**`;

      runMock = vi.fn().mockResolvedValue({
        content: mockIdeaContent,
        model: 'mock-model',
        provider: 'mock',
        agentName: 'lead',
        memoriesUsed: 0,
      });
      const mockRunner = {
        gateway: {},
        run: runMock,
      };
      const mockActionContext = {
        repo,
        engine: {} as any,
        runner: mockRunner as any,
        auditor: {} as any,
        config: makeTestConfig({ dbPath: join(tempDir, 'test.db'), articlesDir, dataDir: tempDir }),
      };

      llmApp = createApp(
        repo,
        makeTestConfig({ dbPath: join(tempDir, 'test.db'), articlesDir, dataDir: tempDir }),
        { actionContext: mockActionContext },
      );
    });

    it('generates idea via LLM and extracts title', async () => {
      const res = await llmApp.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Analyze the Seahawks secondary depth',
          teams: ['SEA'],
          depthLevel: 2,
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as { id: string; title: string; stage: number };
      expect(body.title).toBe("Devon Witherspoon Can't Do It Alone: Seattle's DB Problem");
      expect(body.stage).toBe(1);
      expect(body.id).toMatch(/^[a-z0-9-]+$/);

      // Verify full idea.md artifact
      const content = repo.artifacts.get(body.id, 'idea.md');
      expect(content).toContain('## Working Title');
      expect(content).toContain('Witherspoon');
      expect(content).toContain('## Score');
    });

    it('stores team and depth level from LLM flow', async () => {
      const res = await llmApp.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Seahawks DB analysis',
          teams: ['SEA'],
          depthLevel: 3,
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as { id: string };
      const article = repo.getArticle(body.id);
      expect(article!.primary_team).toBe('SEA');
      expect(article!.depth_level).toBe(3);
    });

    it('uses the simplified dashboard stage 1 brief for the LLM request', async () => {
      const res = await llmApp.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Build me a fast Seahawks secondary reset idea',
          teams: ['SEA'],
          depthLevel: 2,
          pinnedAgents: ['cap-expert', 'film-room'],
        }),
      });

      expect(res.status).toBe(201);
      expect(runMock).toHaveBeenCalledTimes(1);
      const call = runMock.mock.calls[0]?.[0];
      expect(call.agentName).toBe('lead');
      expect(call.skills).toEqual(['idea-generation']);
      expect(call.maxTokens).toBe(1400);
      expect(call.task).toContain('This is a dashboard Stage 1 ideation request');
      expect(call.task).toContain('Do not mention GitHub comments');
      expect(call.task).toContain('Pinned agents to keep in mind: cap-expert, film-room');
      expect(call.task).toContain('Operator prompt: Build me a fast Seahawks secondary reset idea');
    });
  });

  // ── Auto-advance ─────────────────────────────────────────────────────────

  describe('POST /api/articles/:id/auto-advance', () => {
    // Helper: wait until the background runner settles on a final stage.
    async function waitForAdvance(slug: string, maxMs = 2000): Promise<void> {
      const start = Date.now();
      let lastStage: number | null = null;
      let stablePolls = 0;
      while (Date.now() - start < maxMs) {
        await new Promise(r => setTimeout(r, 50));
        const a = repo.getArticle(slug);
        if (!a) return;
        if (a.current_stage === lastStage) {
          stablePolls += 1;
        } else {
          lastStage = a.current_stage;
          stablePolls = 0;
        }
        if (stablePolls >= 3) return;
      }
    }

    it('advances article through the satisfied lightweight guards', async () => {
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
      const body = await res.json() as { id: string; status: string };
      expect(body.status).toBe('started');

      await waitForAdvance(slug);
      const article = repo.getArticle(slug)!;
      expect(article.current_stage).toBe(5);
    });

    it('stops when a guard fails', async () => {
      const slug = 'auto-adv-stop';
      repo.createArticle({ id: slug, title: 'Auto Stop Test' });
      repo.artifacts.put(slug, 'idea.md', '# Idea\nContent.');
      repo.artifacts.put(slug, 'discussion-prompt.md', 'Prompt');
      // No panel-composition.md — should stop at stage 3

      const res = await app.request(`/api/articles/${slug}/auto-advance`, { method: 'POST' });
      expect(res.status).toBe(200);

      await waitForAdvance(slug);
      const article = repo.getArticle(slug)!;
      expect(article.current_stage).toBe(3);
    });

    it('does not advance past the last satisfied lightweight stage', async () => {
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

      await waitForAdvance(slug);
      const article = repo.getArticle(slug)!;
      expect(article.current_stage).toBe(5);
    });

    it('returns 404 for unknown article', async () => {
      const res = await app.request('/api/articles/nonexistent/auto-advance', { method: 'POST' });
      expect(res.status).toBe(404);
    });
  });
});
