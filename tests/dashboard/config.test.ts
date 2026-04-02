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
      teams: [
        { abbr: 'SEA', city: 'Seattle', name: 'Seahawks' },
        { abbr: 'GB', city: 'Green Bay', name: 'Packers' },
      ],
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

  it('shows the tabbed admin settings page with overview', async () => {
    const res = await app.request('/config');
    const html = await res.text();
    expect(html).toContain('Settings');
    // Tab navigation
    expect(html).toContain('settings-tabs');
    expect(html).toContain('Overview');
    expect(html).toContain('LLM Providers');
    expect(html).toContain('Publishing');
    expect(html).toContain('Diagnostics');
    // Overview tab content
    expect(html).toContain('Default Provider');
    expect(html).toContain('Service Readiness');
    // No old removed items
    expect(html).not.toContain('Prompt Inventory');
    expect(html).not.toContain('Runtime Paths');
    expect(html).not.toContain('Stage Key');
  });

  it('diagnostics tab contains effective settings and service readiness', async () => {
    const res = await app.request('/config?tab=diagnostics');
    const html = await res.text();
    expect(html).toContain('Diagnostics');
    expect(html).toContain('Effective Settings');
    // No old navigation links
    expect(html).not.toContain('href="/memory"');
    expect(html).not.toContain('href="/agents"');
    expect(html).not.toContain('href="/runs"');
  });

  it('access tab shows auth settings', async () => {
    const res = await app.request('/config?tab=access');
    const html = await res.text();
    expect(html).toContain('Access');
    expect(html).toContain('Auth Mode');
  });

  it('schedules tab shows schedule management form and existing schedules', async () => {
    repo.createArticleSchedule({
      name: 'Seahawks Tuesday Accessible',
      team_abbr: 'SEA',
      prompt: 'Find the best current Seahawks storyline for a broad audience.',
      weekday_utc: 2,
      time_of_day_utc: '14:00',
      content_profile: 'accessible',
      depth_level: 1,
      next_run_at: '2025-07-15 14:00:00',
    });

    const res = await app.request('/config?tab=schedules');
    const html = await res.text();
    expect(html).toContain('Article schedules');
    expect(html).toContain('Add Schedule');
    expect(html).toContain('Seahawks Tuesday Accessible');
    expect(html).toContain('Use runtime default');
    expect(html).toContain('Advanced editorial overrides');
    expect(html).toContain('Schema example');
    expect(html).toContain('&quot;min_agents&quot;: 2');
  });
});
