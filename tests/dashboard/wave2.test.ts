/**
 * wave2.test.ts — Tests for Wave 2 features:
 *   - Markdown artifact rendering
 *   - Token usage panel
 *   - Editor verdict badges
 *   - Trace-preserving article detail routes
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Repository } from '../../src/db/repository.js';
import { createApp } from '../../src/dashboard/server.js';
import type { AppConfig } from '../../src/config/index.js';
import { markdownToHtml } from '../../src/services/markdown.js';
import {
  renderArtifactContent,
  renderUsagePanel,
} from '../../src/dashboard/views/article.js';
import { renderLayout } from '../../src/dashboard/views/layout.js';
import type { UsageEvent } from '../../src/types.js';

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

// ── Markdown renderer unit tests ────────────────────────────────────────────

describe('markdownToHtml', () => {
  it('converts headings', () => {
    expect(markdownToHtml('# Title')).toContain('<h1>Title</h1>');
    expect(markdownToHtml('## Subtitle')).toContain('<h2>Subtitle</h2>');
    expect(markdownToHtml('### H3')).toContain('<h3>H3</h3>');
  });

  it('converts bold and italic', () => {
    expect(markdownToHtml('**bold**')).toContain('<strong>bold</strong>');
    expect(markdownToHtml('*italic*')).toContain('<em>italic</em>');
    expect(markdownToHtml('***both***')).toContain('<strong><em>both</em></strong>');
  });

  it('converts inline code', () => {
    expect(markdownToHtml('Use `npm install`')).toContain('<code>npm install</code>');
  });

  it('converts fenced code blocks', () => {
    const md = '```js\nconst x = 1;\n```';
    const html = markdownToHtml(md);
    expect(html).toContain('<pre><code class="language-js">');
    expect(html).toContain('const x = 1;');
  });

  it('converts unordered lists', () => {
    const md = '- one\n- two\n- three';
    const html = markdownToHtml(md);
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<li>three</li>');
  });

  it('converts ordered lists', () => {
    const md = '1. first\n2. second';
    const html = markdownToHtml(md);
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>first</li>');
    expect(html).toContain('<li>second</li>');
  });

  it('converts blockquotes', () => {
    const html = markdownToHtml('> Quote text');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('Quote text');
  });

  it('converts links', () => {
    const html = markdownToHtml('[Click](https://example.com)');
    expect(html).toContain('<a href="https://example.com"');
    expect(html).toContain('Click</a>');
  });

  it('converts images', () => {
    const html = markdownToHtml('![Alt](img.png)');
    expect(html).toContain('<img src="img.png" alt="Alt"');
  });

  it('converts horizontal rules', () => {
    expect(markdownToHtml('---')).toContain('<hr>');
    expect(markdownToHtml('***')).toContain('<hr>');
  });

  it('converts tables', () => {
    const md = '| Name | Age |\n|------|-----|\n| Bob | 30 |';
    const html = markdownToHtml(md);
    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('Name');
    expect(html).toContain('<td');
    expect(html).toContain('Bob');
  });

  it('handles table alignment', () => {
    const md = '| Left | Center | Right |\n|:-----|:------:|------:|\n| a | b | c |';
    const html = markdownToHtml(md);
    expect(html).toContain('text-align:left');
    expect(html).toContain('text-align:center');
    expect(html).toContain('text-align:right');
  });

  it('converts paragraphs', () => {
    const html = markdownToHtml('First paragraph.\n\nSecond paragraph.');
    expect(html).toContain('<p>First paragraph.</p>');
    expect(html).toContain('<p>Second paragraph.</p>');
  });

  it('escapes HTML in content', () => {
    const html = markdownToHtml('# <script>alert("xss")</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('converts strikethrough', () => {
    const html = markdownToHtml('~~deleted~~');
    expect(html).toContain('<del>deleted</del>');
  });

  it('handles complex document', () => {
    const md = `# Analysis

## Key Points

The **Seahawks** need to address:

1. Secondary depth
2. Pass rush

> This is a critical offseason — *time is running out*.

| Player | Position | Grade |
|--------|----------|-------|
| Devon Witherspoon | CB | 89.2 |
| Riq Woolen | CB | 68.4 |

---

### Conclusion

Use \`nflverse\` data for validation.`;

    const html = markdownToHtml(md);
    expect(html).toContain('<h1>Analysis</h1>');
    expect(html).toContain('<h2>Key Points</h2>');
    expect(html).toContain('<strong>Seahawks</strong>');
    expect(html).toContain('<ol>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<table');
    expect(html).toContain('Devon Witherspoon');
    expect(html).toContain('<hr>');
    expect(html).toContain('<h3>Conclusion</h3>');
    expect(html).toContain('<code>nflverse</code>');
  });
});

// ── renderArtifactContent unit tests ────────────────────────────────────────

describe('renderArtifactContent', () => {
  it('returns empty state when content is null', () => {
    const html = renderArtifactContent('draft.md', null);
    expect(html).toContain('Not yet created');
    expect(html).toContain('empty-state');
  });

  it('renders markdown for .md files', () => {
    const html = renderArtifactContent('idea.md', '# My Idea\n\nGreat concept.');
    expect(html).toContain('artifact-rendered');
    expect(html).toContain('<h1>My Idea</h1>');
    expect(html).toContain('Great concept.');
    expect(html).not.toContain('artifact-pre');
  });

  it('renders pre block for non-.md files', () => {
    const html = renderArtifactContent('data.json', '{"key": "value"}');
    expect(html).toContain('artifact-pre');
    expect(html).toContain('&quot;key&quot;');
  });

  it('prefers persisted thinking sidecars over inline think blocks', () => {
    const html = renderArtifactContent(
      'draft.md',
      '<think>inline trace</think>\n\n# Draft\n\nBody copy.',
      'Persisted sidecar trace',
    );
    expect(html).toContain('Persisted Thinking Trace');
    expect(html).toContain('Persisted sidecar trace');
    expect(html).not.toContain('inline trace');
    expect(html).toContain('<h1>Draft</h1>');
  });

  it('falls back to extracting inline think blocks when no sidecar exists', () => {
    const html = renderArtifactContent('draft.md', '<think>inline trace</think>\n\n# Draft\n\nBody copy.');
    expect(html).toContain('Extracted Thinking Trace');
    expect(html).toContain('inline trace');
    expect(html).toContain('<h1>Draft</h1>');
  });
});

describe('shared mobile dashboard shell', () => {
  it('renders mobile navigation hooks and active state in the shared layout', () => {
    const html = renderLayout('Settings', '<div>content</div>', 'NFL Lab');
    expect(html).toContain('shared-mobile-header');
    expect(html).toContain('shared-mobile-nav');
    expect(html).toContain('id="nav-toggle"');
    expect(html).toContain('aria-controls="primary-nav"');
    expect(html).toContain('header-nav-link is-active');
    expect(html).toContain('page-settings');
  });

  it('styles the mobile shell hooks and responsive tables in the shared stylesheet', () => {
    const cssPath = join(process.cwd(), 'src', 'dashboard', 'public', 'styles.css');
    const css = readFileSync(cssPath, 'utf8');
    expect(css).toContain('.shared-mobile-header');
    expect(css).toContain('.shared-mobile-nav');
    expect(css).toContain('.responsive-table');
    expect(css).toContain('.mobile-detail-layout');
    expect(css).toContain('.mobile-primary-column');
    expect(css).toContain('.mobile-secondary-column');
  });
});

// ── Usage panel unit tests ──────────────────────────────────────────────────

function makeUsageEvent(overrides: Partial<UsageEvent>): UsageEvent {
  return {
    id: 1,
    run_id: null,
    stage_run_id: null,
    article_id: 'test',
    stage: 5,
    surface: 'copilot',
    provider: 'anthropic',
    actor: 'writer',
    event_type: 'completed',
    model_or_tool: 'claude-sonnet-4',
    model_tier: 'standard',
    precedence_rank: null,
    request_count: 1,
    quantity: null,
    unit: null,
    prompt_tokens: 5000,
    output_tokens: 2000,
    cached_tokens: 1000,
    premium_requests: null,
    image_count: null,
    cost_usd_estimate: 0.025,
    metadata_json: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('renderUsagePanel', () => {
  it('shows empty state when no events', () => {
    const html = renderUsagePanel([]);
    expect(html).toContain('No usage data recorded');
  });

  it('shows token totals and cost', () => {
    const events = [
      makeUsageEvent({ prompt_tokens: 5000, output_tokens: 2000, cost_usd_estimate: 0.025 }),
      makeUsageEvent({ id: 2, prompt_tokens: 3000, output_tokens: 1000, cost_usd_estimate: 0.015 }),
    ];
    const html = renderUsagePanel(events);
    expect(html).toContain('Token Usage');
    expect(html).toContain('11.0k'); // 5000+2000+3000+1000 = 11000
    expect(html).toContain('$0.0400'); // 0.025+0.015
    expect(html).toContain('2'); // 2 API calls
  });

  it('shows cached tokens', () => {
    const events = [makeUsageEvent({ cached_tokens: 5000 })];
    const html = renderUsagePanel(events);
    expect(html).toContain('5.0k cached');
  });

  it('shows model breakdown', () => {
    const events = [
      makeUsageEvent({ model_or_tool: 'claude-sonnet-4', cost_usd_estimate: 0.02 }),
      makeUsageEvent({ id: 2, model_or_tool: 'gpt-4o', cost_usd_estimate: 0.03 }),
    ];
    const html = renderUsagePanel(events);
    expect(html).toContain('claude-sonnet-4');
    expect(html).toContain('gpt-4o');
    expect(html).toContain('By Model');
  });

  it('shows stage breakdown', () => {
    const events = [
      makeUsageEvent({ stage: 5, cost_usd_estimate: 0.02 }),
      makeUsageEvent({ id: 2, stage: 6, cost_usd_estimate: 0.03 }),
    ];
    const html = renderUsagePanel(events);
    expect(html).toContain('Stage 5');
    expect(html).toContain('Stage 6');
    expect(html).toContain('By Stage');
  });

  it('shows provider breakdown', () => {
    const events = [
      makeUsageEvent({ provider: 'anthropic', prompt_tokens: 5000, output_tokens: 2000, cost_usd_estimate: 0.02 }),
      makeUsageEvent({ id: 2, provider: 'copilot-cli', prompt_tokens: 3000, output_tokens: 1000, cost_usd_estimate: 0.01 }),
    ];
    const html = renderUsagePanel(events);
    expect(html).toContain('anthropic');
    expect(html).toContain('copilot-cli');
    expect(html).toContain('By Provider');
  });
});

// ── Integration tests ───────────────────────────────────────────────────────

describe('Wave 2 Routes', () => {
  let repo: Repository;
  let tempDir: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'w2-test-'));
    const dbPath = join(tempDir, 'pipeline.db');
    repo = new Repository(dbPath);
    const config = makeTestConfig({ dbPath, articlesDir: join(tempDir, 'articles') });
    app = createApp(repo, config);
  });

  afterEach(() => {
    repo.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('GET /htmx/articles/:id/artifact/:name', () => {
    it('renders markdown artifacts as rich HTML', async () => {
      repo.createArticle({ id: 'md-test', title: 'MD Test' });
      repo.artifacts.put('md-test', 'idea.md', '# Big Idea\n\n**Bold** content here.');

      const res = await app.request('/htmx/articles/md-test/artifact/idea.md');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('artifact-rendered');
      expect(html).toContain('<h1>Big Idea</h1>');
      expect(html).toContain('<strong>Bold</strong>');
    });

    it('renders lists and code blocks', async () => {
      repo.createArticle({ id: 'list-test', title: 'List Test' });
      repo.artifacts.put('list-test', 'draft.md', '- item 1\n- item 2\n\n```python\nprint("hello")\n```');

      const res = await app.request('/htmx/articles/list-test/artifact/draft.md');
      const html = await res.text();
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>item 1</li>');
      expect(html).toContain('<pre><code class="language-python">');
      expect(html).toContain('print(&quot;hello&quot;)');
    });
  });

  describe('GET /htmx/articles/:id/usage', () => {
    it('returns usage panel with data', async () => {
      repo.createArticle({ id: 'usage-test', title: 'Usage Test' });
      repo.recordUsageEvent({
        articleId: 'usage-test',
        stage: 5,
        surface: 'copilot',
        eventType: 'completed',
        modelOrTool: 'claude-sonnet-4',
        promptTokens: 8000,
        outputTokens: 3000,
        costUsdEstimate: 0.04,
      });

      const res = await app.request('/htmx/articles/usage-test/usage');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Token Usage');
      expect(html).toContain('11.0k');
      expect(html).toContain('$0.0400');
      expect(html).toContain('claude-sonnet-4');
    });

    it('returns empty state for no usage', async () => {
      repo.createArticle({ id: 'no-usage', title: 'No Usage' });
      const res = await app.request('/htmx/articles/no-usage/usage');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('No usage data recorded');
    });

    it('returns 404 for unknown article', async () => {
      const res = await app.request('/htmx/articles/nonexistent/usage');
      expect(res.status).toBe(404);
    });
  });

  describe('Article detail page', () => {
    it('includes usage panel and trace link', async () => {
      repo.createArticle({ id: 'detail-test', title: 'Detail Test' });
      repo.recordUsageEvent({
        articleId: 'detail-test',
        stage: 1,
        surface: 'copilot',
        eventType: 'completed',
        modelOrTool: 'gpt-4o',
        promptTokens: 1000,
        outputTokens: 500,
        costUsdEstimate: 0.01,
      });
      repo.artifacts.put('detail-test', 'idea.md', '# Test');

      const res = await app.request('/articles/detail-test');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Token Usage');
      expect(html).toContain('/articles/detail-test/traces');
    });

    it('does not include removed stage timeline markup', async () => {
      repo.createArticle({ id: 'timeline-test', title: 'Timeline Test' });
      repo.artifacts.put('timeline-test', 'idea.md', '# Idea');

      const res = await app.request('/articles/timeline-test');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).not.toContain('stage-timeline');
      expect(html).not.toContain('stage-step');
    });

    it('renders editor reviews with verdict badges', async () => {
      repo.createArticle({ id: 'review-test', title: 'Review Test' });
      repo.artifacts.put('review-test', 'idea.md', '# Test');
      repo.recordEditorReview('review-test', 'APPROVED', 0, 3, 1, 1);

      const res = await app.request('/articles/review-test');
      const html = await res.text();
      expect(html).toContain('verdict-approved');
      expect(html).toContain('✅ APPROVED');
      expect(html).toContain('3 suggestions');
      expect(html).toContain('1 note');
    });
  });
});
