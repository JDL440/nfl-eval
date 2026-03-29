import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
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

describe('Config Viewer Page', () => {
  let repo: Repository;
  let tempDir: string;
  let app: ReturnType<typeof createApp>;
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
    process.env['MOCK_LLM'] = '1';
    process.env['DASHBOARD_AUTH_MODE'] = 'local';
    process.env['DASHBOARD_AUTH_USERNAME'] = 'joe';
    process.env['DASHBOARD_AUTH_PASSWORD'] = 'secret-pass';
    process.env['DASHBOARD_SESSION_TTL_HOURS'] = '12';

    tempDir = mkdtempSync(join(tmpdir(), 'nfl-config-test-'));
    const dbPath = join(tempDir, 'test.db');
    const dataDir = join(tempDir, 'data');
    const articlesDir = join(dataDir, 'articles');
    const chartersDir = join(dataDir, 'agents', 'charters', 'nfl');
    const skillsDir = join(dataDir, 'agents', 'skills');
    const configDir = join(dataDir, 'config');
    mkdirSync(articlesDir, { recursive: true });
    mkdirSync(chartersDir, { recursive: true });
    mkdirSync(skillsDir, { recursive: true });
    mkdirSync(configDir, { recursive: true });

    writeFileSync(join(chartersDir, 'sea.md'), '# SEA charter');
    writeFileSync(join(skillsDir, 'fact-checking.md'), '# Fact checking');
    writeFileSync(
      join(configDir, 'models.json'),
      JSON.stringify({
        version: 'test',
        models: { lead: 'gpt-4.1', writer: 'gpt-4.1-mini' },
        max_output_tokens: {},
        panel_size_limits: { casual: { min: 2, max: 2 } },
        depth_level_map: { '1': 'casual' },
        supported_models: { low: [], medium: [], high: [], agentic_code: [] },
        task_families: {},
        stage_task_families: {},
        override_policy: { allow_model_override: false, prefer_stage_default_before_tier_precedence: true },
      }),
      'utf-8',
    );

    process.env['NFL_DATA_DIR'] = dataDir;

    repo = new Repository(dbPath);
    app = createApp(repo, makeTestConfig({
      dbPath,
      dataDir,
      articlesDir,
      chartersDir,
      skillsDir,
      logsDir: join(dataDir, 'logs'),
      memoryDbPath: join(dataDir, 'memory.db'),
      dashboardAuth: {
        mode: 'off',
        sessionCookieName: 'config_test_session',
        sessionTtlHours: 24,
        secureCookies: false,
      },
    }));
  });

  afterEach(() => {
    repo.close();
    rmSync(tempDir, { recursive: true, force: true });
    process.env = savedEnv;
  });

  it('GET /config returns 200', async () => {
    const res = await app.request('/config');
    expect(res.status).toBe(200);
  });

  it('shows the redesigned runtime settings overview', async () => {
    const res = await app.request('/config');
    const html = await res.text();
    expect(html).toContain('Runtime Settings');
    expect(html).toContain('Current runtime wiring for NFL Lab');
    expect(html).toContain('Active provider');
    expect(html).toContain('Mock');
    expect(html).toContain('Prompt Inventory');
    expect(html).toContain('fact-checking');
    expect(html).toContain('sea');
  });

  it('page contains maintenance and prompt inventory sections', async () => {
    const res = await app.request('/config');
    const html = await res.text();
    expect(html).toContain('Services &amp; Maintenance');
    expect(html).toContain('Knowledge refresh');
    expect(html).toContain('legacy runtime memory storage still exists');
    expect(html).toContain('the old Memory dashboard stays retired');
    expect(html).toContain('existing refresh-all endpoint from Settings');
    expect(html).toContain('Refresh-all is unavailable until runner + memory services are initialized.');
    expect(html).not.toContain('Refresh All Agent Knowledge');
    expect(html).not.toContain('href="/memory"');
    expect(html).not.toContain('href="/agents"');
    expect(html).not.toContain('href="/runs"');
    expect(html).not.toContain('Context preset:');
    expect(html).toContain('id="knowledge-refresh-result"');
    expect(html).toContain('Prompt Inventory');
    expect(html).toContain('fact-checking');
    expect(html).toContain('sea');
    expect(html).toContain('Dashboard Access');
    expect(html).toContain('config_test_session');
    expect(html).toContain('24 hours');
  });

  it('shows safe environment values and Copilot defaults', async () => {
    const res = await app.request('/config');
    const html = await res.text();
    expect(html).toContain('Environment Surface');
    expect(html).toContain('DASHBOARD_AUTH_MODE');
    expect(html).toContain('local');
    expect(html).toContain('DASHBOARD_AUTH_USERNAME');
    expect(html).toContain('joe');
    expect(html).toContain('COPILOT_MODEL');
    expect(html).toContain('claude-sonnet-4.6 (default)');
    expect(html).toContain('COPILOT_CLI_MODE');
    expect(html).toContain('article-tools (default)');
    expect(html).toContain('COPILOT_CLI_SESSION_REUSE');
    expect(html).toContain('1 (default)');
  });
});
