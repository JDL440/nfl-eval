import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
  renderIdeaErrorStatus,
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

  it('unwraps JSON envelope and extracts title from inner content', () => {
    const json = JSON.stringify({
      type: 'final',
      content: '# Article Idea: The Falcons\' $180M QB Problem\n\n## Working Title\nKirk Cousins Is Dragging Elite Talent Down a Black Hole\n\n## Angle',
    });
    expect(extractTitleFromIdea(json)).toBe('Kirk Cousins Is Dragging Elite Talent Down a Black Hole');
  });

  it('unwraps JSON envelope and falls back to h1 when no Working Title', () => {
    const json = JSON.stringify({
      type: 'final',
      content: '# Article Idea: Why the Rams Need Help\n\nSome angle text here.',
    });
    expect(extractTitleFromIdea(json)).toBe('Why the Rams Need Help');
  });
});

// ── View rendering tests ────────────────────────────────────────────────────

describe('renderNewIdeaPage', () => {
  it('renders the smart form with prompt, team grid, depth level, and auto-advance', () => {
    const html = renderNewIdeaPage({ labName: 'NFL Lab' });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('New Article Idea');
    expect(html).toContain('name="prompt"');
    expect(html).toContain('team-grid');
    expect(html).toContain('auto-advance');
    expect(html).toContain('name="depthLevel"');
    expect(html).toContain('1 — Casual Fan');
    expect(html).toContain('2 — The Beat');
    expect(html).toContain('3 — Deep Dive');
  });

  it('defaults depth level to 2', () => {
    const html = renderNewIdeaPage({ labName: 'NFL Lab' });
    expect(html).toContain('value="2" selected');
  });

  it('renders an LLM provider selector when providers are available', () => {
    const html = renderNewIdeaPage({
      labName: 'NFL Lab',
      llmProviders: [
        { id: 'lmstudio', name: 'LM Studio (Local)', default: true },
        { id: 'copilot-cli', name: 'GitHub Copilot CLI' },
        { id: 'copilot', name: 'GitHub Copilot Pro+' },
      ],
    });
    expect(html).toContain('name="provider"');
    expect(html).toContain('LM Studio (Local) (default)');
    expect(html).toContain('GitHub Copilot CLI');
    expect(html).toContain('GitHub Copilot Pro+');
    expect(html).toContain('saved on the article and reused for later LLM stages');
    expect(html).toContain('<strong>copilot</strong> = GitHub Copilot Pro+ via GitHub Models API');
    expect(html).toContain('<strong>copilot-cli</strong> = GitHub Copilot CLI agent');
  });

  it('embeds trace-aware error rendering for failed idea creation', () => {
    const html = renderNewIdeaPage({ labName: 'NFL Lab' });
    expect(html).toContain('const renderIdeaErrorStatus =');
    expect(html).toContain('status.innerHTML = renderIdeaErrorStatus(data);');
    expect(html).toContain('Need the failure trace?');
  });

  it('embeds the auto-advance handoff for the created article detail page', () => {
    const html = renderNewIdeaPage({ labName: 'NFL Lab' });
    expect(html).toContain("const articleUrl = '/articles/' + data.id + (data.autoAdvance ? '?from=auto-advance' : '');");
    expect(html).toContain('Running auto-advance pipeline…');
    expect(html).toContain("fetch('/api/articles/' + data.id + '/auto-advance', { method: 'POST' }).catch(() => {});");
  });
});

describe('renderIdeaErrorStatus', () => {
  it('includes trace details when the API returns them', () => {
    const html = renderIdeaErrorStatus({
      error: 'Schema validation failed',
      traceId: 'trace-123',
      traceUrl: '/traces/trace-123',
    });

    expect(html).toContain('Schema validation failed');
    expect(html).toContain('Trace ID: <code>trace-123</code>');
    expect(html).toContain('href="/traces/trace-123"');
    expect(html).toContain('Open trace');
  });

  it('escapes error and trace values before rendering', () => {
    const html = renderIdeaErrorStatus({
      error: 'boom <script>alert(1)</script>',
      traceId: 'trace-<bad>',
      traceUrl: '/traces/"bad"',
    });

    expect(html).toContain('boom &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Trace ID: <code>trace-&lt;bad&gt;</code>');
    expect(html).toContain('href="/traces/&quot;bad&quot;"');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('Quick-action buttons', () => {
  it('contains Surprise Me button', () => {
    const html = renderNewIdeaPage({ labName: 'NFL Lab' });
    expect(html).toContain('Surprise Me');
    expect(html).toContain('id="surprise-btn"');
  });

  it('contains Breaking News button', () => {
    const html = renderNewIdeaPage({ labName: 'NFL Lab' });
    expect(html).toContain('Breaking News');
    expect(html).toContain('id="breaking-btn"');
    expect(html).toContain('quick-action-btn--disabled');
  });

  it('Surprise Me preset prompt is embedded in page script', () => {
    const html = renderNewIdeaPage({ labName: 'NFL Lab' });
    expect(html).toContain('Generate a surprising, timely NFL article idea');
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

function validDraft(wordCount = 1000): string {
  return `# Headline

*Subtitle*

> **📋 TLDR**
> - First takeaway
> - Second takeaway
> - Third takeaway
> - Fourth takeaway

**By: The NFL Lab Expert Panel**

${longText(wordCount)}
`;
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
      expect(html).toContain('name="prompt"');
      expect(html).toContain('team-grid');
      expect(html).toContain('auto-advance');
      expect(html).toContain('name="depthLevel"');
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
    let mockRun: ReturnType<typeof vi.fn>;

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

      mockRun = vi.fn(async () => ({
        content: mockIdeaContent,
        model: 'mock-model',
        provider: 'mock',
        agentName: 'lead',
        memoriesUsed: 0,
      }));

      const mockRunner = {
        gateway: {
          listProviders: () => [
            { id: 'lmstudio', name: 'LM Studio (Local)' },
            { id: 'copilot-cli', name: 'GitHub Copilot CLI' },
          ],
          getProvider: (id: string) => (
            id === 'lmstudio' || id === 'copilot-cli'
              ? { id, name: id }
              : undefined
          ),
        },
        listAgents: () => [],
        run: mockRun,
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

    it('renders the provider selector when multiple providers are registered', async () => {
      const res = await llmApp.request('/ideas/new');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('name="provider"');
      expect(html).toContain('LM Studio (Local) (default)');
      expect(html).toContain('GitHub Copilot CLI');
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

    it('passes the selected provider to the runner', async () => {
      const res = await llmApp.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Use LM Studio for this idea',
          teams: ['SEA'],
          depthLevel: 2,
          provider: 'lmstudio',
        }),
      });

      expect(res.status).toBe(201);
      expect(mockRun).toHaveBeenCalledWith(expect.objectContaining({
        agentName: 'lead',
        provider: 'lmstudio',
      }));
    });

    it('tells the lead task to return the tool-loop final envelope', async () => {
      const res = await llmApp.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Use tools if needed, then give me the final idea',
          teams: ['SEA'],
          depthLevel: 2,
        }),
      });

      expect(res.status).toBe(201);
      expect(mockRun).toHaveBeenCalledWith(expect.objectContaining({
        task: expect.stringContaining('Generate a structured article idea'),
      }));
    });

    it('rejects unknown provider overrides', async () => {
      const res = await llmApp.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Use an unavailable provider',
          provider: 'nonexistent',
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json() as { error: string };
      expect(body.error).toContain('Unknown provider');
    });

    it('attaches idea-generation traces and stage runs to the created article', async () => {
      const mockTraceId = repo.startLlmTrace({
        stage: 1,
        surface: 'ideaGeneration',
        agentName: 'lead',
        requestedModel: 'mock-model',
        systemPrompt: 'Idea system prompt',
        userMessage: 'Idea user prompt',
      });

      const traceRunner = {
        gateway: {},
        run: async () => ({
          content: `# Article Idea: Traceable Idea

## Working Title
Traceable Idea

## Angle / Tension
Trace content.`,
          model: 'mock-model',
          provider: 'mock',
          agentName: 'lead',
          memoriesUsed: 0,
          tokensUsed: { prompt: 120, completion: 45 },
          traceId: mockTraceId,
        }),
      };
      const mockActionContext = {
        repo,
        engine: {} as any,
        runner: traceRunner as any,
        auditor: {} as any,
        config: makeTestConfig({ dbPath: join(tempDir, 'test.db'), articlesDir, dataDir: tempDir }),
      };
      const traceApp = createApp(
        repo,
        makeTestConfig({ dbPath: join(tempDir, 'test.db'), articlesDir, dataDir: tempDir }),
        { actionContext: mockActionContext },
      );

      const res = await traceApp.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Create a traceable idea',
          teams: ['SEA'],
          depthLevel: 2,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json() as { id: string };
      const traces = repo.getArticleLlmTraces(body.id, 0);
      const stageRuns = repo.getStageRuns(body.id);
      const usageEvents = repo.getUsageEvents(body.id);

      expect(stageRuns).toHaveLength(1);
      expect(stageRuns[0].surface).toBe('ideaGeneration');
      expect(traces).toHaveLength(1);
      expect(traces[0].id).toBe(mockTraceId);
      expect(traces[0].article_id).toBe(body.id);
      expect(traces[0].stage_run_id).toBe(stageRuns[0].id);
      expect(usageEvents[0]?.stage_run_id).toBe(stageRuns[0].id);
    });

    it('returns trace metadata when idea creation fails after the trace starts', async () => {
      const mockTraceId = repo.startLlmTrace({
        stage: 1,
        surface: 'ideaGeneration',
        agentName: 'lead',
        requestedModel: 'mock-model',
        systemPrompt: 'Idea system prompt',
        userMessage: 'Idea user prompt',
      });

      const failingRunner = {
        gateway: {
          listProviders: () => [],
          getProvider: () => undefined,
        },
        listAgents: () => [],
        run: async () => ({
          content: `# Article Idea: Broken Persist

## Working Title
Broken Persist

## Angle / Tension
Trace should still be surfaced.`,
          model: 'mock-model',
          provider: 'mock',
          agentName: 'lead',
          memoriesUsed: 0,
          traceId: mockTraceId,
        }),
      };
      const mockActionContext = {
        repo,
        engine: {} as any,
        runner: failingRunner as any,
        auditor: {} as any,
        config: makeTestConfig({ dbPath: join(tempDir, 'test.db'), articlesDir, dataDir: tempDir }),
      };
      const traceApp = createApp(
        repo,
        makeTestConfig({ dbPath: join(tempDir, 'test.db'), articlesDir, dataDir: tempDir }),
        { actionContext: mockActionContext },
      );
      const createSpy = vi.spyOn(repo, 'createArticle').mockImplementation(() => {
        throw new Error('database write failed');
      });

      try {
        const res = await traceApp.request('/api/ideas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: 'Create an idea, then fail after the trace starts',
            teams: ['SEA'],
            depthLevel: 2,
          }),
        });

        expect(res.status).toBe(500);
        const body = await res.json() as { error: string; traceId: string | null; traceUrl: string | null };
        expect(body.error).toContain('database write failed');
        expect(body.traceId).toBe(mockTraceId);
        expect(body.traceUrl).toBe(`/traces/${mockTraceId}`);
      } finally {
        createSpy.mockRestore();
      }
    });

    it('returns trace metadata when the runner throws after creating a trace', async () => {
      const failingRunner = {
        gateway: {
          listProviders: () => [],
          getProvider: () => undefined,
        },
        listAgents: () => [],
        run: async () => {
          const error = new Error('tool loop blew up');
          (error as Error & { traceId?: string; traceUrl?: string }).traceId = 'trace-runner-failure';
          (error as Error & { traceId?: string; traceUrl?: string }).traceUrl = '/traces/trace-runner-failure';
          throw error;
        },
      };
      const mockActionContext = {
        repo,
        engine: {} as any,
        runner: failingRunner as any,
        auditor: {} as any,
        config: makeTestConfig({ dbPath: join(tempDir, 'test.db'), articlesDir, dataDir: tempDir }),
      };
      const traceApp = createApp(
        repo,
        makeTestConfig({ dbPath: join(tempDir, 'test.db'), articlesDir, dataDir: tempDir }),
        { actionContext: mockActionContext },
      );

      const res = await traceApp.request('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Create an idea and fail during generation',
          teams: ['SEA'],
          depthLevel: 2,
        }),
      });

      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toMatchObject({
        error: 'tool loop blew up',
        traceId: 'trace-runner-failure',
        traceUrl: '/traces/trace-runner-failure',
      });
    });
  });

  // ── Auto-advance ─────────────────────────────────────────────────────────

  describe('POST /api/articles/:id/auto-advance', () => {
    // Helper: wait for background auto-advance to finish (lightweight mode completes in <50ms)
    async function waitForAdvance(slug: string, expectedStage?: number, maxMs = 2000): Promise<void> {
      const start = Date.now();
      let lastStage: number | null = null;
      let stablePolls = 0;
      while (Date.now() - start < maxMs) {
        await new Promise(r => setTimeout(r, 50));
        const a = repo.getArticle(slug);
        if (!a) return;
        if (expectedStage != null && a.current_stage >= expectedStage) return;

        if (a.current_stage === lastStage) {
          stablePolls += 1;
        } else {
          stablePolls = 0;
          lastStage = a.current_stage;
        }

        if (stablePolls >= 3) return;
      }
    }

    it('advances article through all satisfied guards', async () => {
      const slug = 'auto-adv-test';
      repo.createArticle({ id: slug, title: 'Auto Advance Test' });
      repo.artifacts.put(slug, 'idea.md', '# Test Idea\nContent here.');
      repo.artifacts.put(slug, 'discussion-prompt.md', 'Prompt content');
      repo.artifacts.put(slug, 'panel-composition.md', 'Panel: writer, editor');
      repo.artifacts.put(slug, 'discussion-summary.md', 'Discussion summary');
      repo.artifacts.put(slug, 'article-contract.md', 'Contract summary');
      repo.artifacts.put(slug, 'draft.md', validDraft(850));
      repo.artifacts.put(slug, 'editor-review.md', '## Verdict: APPROVED\nLooks great.');

      const res = await app.request(`/api/articles/${slug}/auto-advance`, { method: 'POST' });
      expect(res.status).toBe(200);
      const body = await res.json() as { id: string; status: string };
      expect(body.status).toBe('started');

      await waitForAdvance(slug, 7);
      const article = repo.getArticle(slug)!;
      expect(article.current_stage).toBe(7);
    });

    it('stops when a guard fails', async () => {
      const slug = 'auto-adv-stop';
      repo.createArticle({ id: slug, title: 'Auto Stop Test' });
      repo.artifacts.put(slug, 'idea.md', '# Idea\nContent.');
      repo.artifacts.put(slug, 'discussion-prompt.md', 'Prompt');
      // No panel-composition.md — should stop at stage 3

      const res = await app.request(`/api/articles/${slug}/auto-advance`, { method: 'POST' });
      expect(res.status).toBe(200);

      await waitForAdvance(slug, 3);
      const article = repo.getArticle(slug)!;
      expect(article.current_stage).toBe(3);
    });

    it('does not advance past stage 7', async () => {
      const slug = 'auto-adv-cap';
      repo.createArticle({ id: slug, title: 'Cap Test' });
      repo.artifacts.put(slug, 'idea.md', '# Idea\nContent.');
      repo.artifacts.put(slug, 'discussion-prompt.md', 'Prompt');
      repo.artifacts.put(slug, 'panel-composition.md', 'Panel');
      repo.artifacts.put(slug, 'discussion-summary.md', 'Summary');
      repo.artifacts.put(slug, 'article-contract.md', 'Contract');
      repo.artifacts.put(slug, 'draft.md', validDraft(850));
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

      await waitForAdvance(slug, 7);
      const article = repo.getArticle(slug)!;
      expect(article.current_stage).toBe(7);
    });

    it('returns 404 for unknown article', async () => {
      const res = await app.request('/api/articles/nonexistent/auto-advance', { method: 'POST' });
      expect(res.status).toBe(404);
    });
  });
});
