/**
 * settings-routes.test.ts — E2E tests for every settings API route.
 *
 * Each test submits form-encoded data exactly as the HTMX UI sends it,
 * and verifies the route succeeds with persisted state.
 */
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

/** Helper to make a form POST like HTMX does */
function formPost(app: ReturnType<typeof createApp>, path: string, data: Record<string, string>) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data).toString(),
  });
}

/** Helper to make a DELETE like HTMX hx-delete does */
function formDelete(app: ReturnType<typeof createApp>, path: string, data?: Record<string, string>) {
  return app.request(path, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: data ? new URLSearchParams(data).toString() : '',
  });
}

describe('Settings API Routes', () => {
  let repo: Repository;
  let tempDir: string;
  let app: ReturnType<typeof createApp>;
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
    process.env['MOCK_LLM'] = '1';

    tempDir = mkdtempSync(join(tmpdir(), 'nfl-settings-routes-'));
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
        sessionCookieName: 'test_session',
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

  // ── Workspace settings ──────────────────────────────────

  describe('POST /api/settings/workspace', () => {
    it('saves publishing settings from form', async () => {
      const res = await formPost(app, '/api/settings/workspace', {
        namespace: 'publishing',
        substackPublicationUrl: 'https://test.substack.com',
        substackStageUrl: 'https://test.substack.com/api/v1/drafts',
        notesEndpointPath: '/api/v1/notes',
        defaultAudience: 'everyone',
        enablePublishAll: 'true',
        enableNotes: 'true',
        enableTwitter: 'true',
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Saved');
    });

    it('saves images settings from form', async () => {
      const res = await formPost(app, '/api/settings/workspace', {
        namespace: 'images',
        provider: 'gemini',
        defaultEnabled: 'true',
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Saved');
    });

    it('saves access/auth settings from form', async () => {
      const res = await formPost(app, '/api/settings/workspace', {
        namespace: 'dashboard_auth',
        mode: 'local',
        sessionTtlHours: '24',
        sessionCookieName: 'test_cookie',
        secureCookies: 'true',
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Saved');
    });

    it('returns 400 when namespace is missing', async () => {
      const res = await formPost(app, '/api/settings/workspace', {
        someKey: 'someValue',
      });
      expect(res.status).toBe(400);
    });
  });

  // ── User preferences ───────────────────────────────────

  describe('POST /api/settings/me', () => {
    it('saves user preferences from form', async () => {
      const res = await formPost(app, '/api/settings/me', {
        defaultTraceView: 'markdown',
        defaultArticleTab: 'preview',
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Preferences updated');
    });
  });

  // ── Provider profiles ──────────────────────────────────

  describe('POST /api/settings/provider-profiles (create)', () => {
    it('creates a provider profile from form', async () => {
      // The form sends providerId (camelCase), defaultModel, baseUrl
      const res = await formPost(app, '/api/settings/provider-profiles', {
        providerId: 'copilot-cli',
        label: 'My Copilot',
        defaultModel: 'gpt-4o',
        baseUrl: '',
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Created');
    });

    it('returns 400 if provider or label missing', async () => {
      const res = await formPost(app, '/api/settings/provider-profiles', {
        providerId: '',
        label: '',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/settings/provider-profiles/:id (update)', () => {
    it('updates a provider profile', async () => {
      // First create one
      const profile = repo.createProviderProfile({
        scopeType: 'workspace',
        providerId: 'copilot-cli',
        label: 'Original',
        configJson: '{}',
      });

      const res = await formPost(app, `/api/settings/provider-profiles/${profile.id}`, {
        label: 'Updated Label',
        config_json: '{"model":"gpt-4o"}',
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Updated');
    });
  });

  describe('POST /api/settings/provider-profiles/:id/set-default', () => {
    it('sets a profile as default', async () => {
      const profile = repo.createProviderProfile({
        scopeType: 'workspace',
        providerId: 'copilot-cli',
        label: 'Test',
      });

      // Form posts to /set-default (not /default)
      const res = await formPost(app, `/api/settings/provider-profiles/${profile.id}/set-default`, {});
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Default');
    });
  });

  describe('POST /api/settings/provider-profiles/:id/toggle', () => {
    it('toggles enabled state of a profile', async () => {
      const profile = repo.createProviderProfile({
        scopeType: 'workspace',
        providerId: 'copilot-cli',
        label: 'Test',
      });

      const res = await formPost(app, `/api/settings/provider-profiles/${profile.id}/toggle`, {});
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Toggled');
    });
  });

  describe('DELETE /api/settings/provider-profiles/:id', () => {
    it('deletes a provider profile via hx-delete', async () => {
      const profile = repo.createProviderProfile({
        scopeType: 'workspace',
        providerId: 'copilot-cli',
        label: 'ToDelete',
      });

      const res = await formDelete(app, `/api/settings/provider-profiles/${profile.id}`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Deleted');
    });
  });

  // ── Article schedules ───────────────────────────────────

  describe('article schedule settings routes', () => {
    it('creates a schedule from the config form', async () => {
      const res = await formPost(app, '/api/settings/article-schedules', {
        name: 'Seahawks Tuesday Accessible',
        teamAbbr: 'SEA',
        prompt: 'Find the best current Seahawks storyline for a broad audience.',
        weekdayUtc: '2',
        timeOfDayUtc: '14:00',
        presetId: 'casual_explainer',
        providerMode: 'default',
        providerId: '',
        enabled: 'true',
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Created');

      const schedules = repo.listArticleSchedules();
      expect(schedules).toHaveLength(1);
      expect(schedules[0].team_abbr).toBe('SEA');
      expect(schedules[0].content_profile).toBe('accessible');
      expect(schedules[0].depth_level).toBe(1);
    });

    it('updates a schedule from the config form', async () => {
      const schedule = repo.createArticleSchedule({
        name: 'Seahawks Tuesday Accessible',
        team_abbr: 'SEA',
        prompt: 'Old prompt',
        weekday_utc: 2,
        time_of_day_utc: '14:00',
        content_profile: 'accessible',
        depth_level: 1,
        next_run_at: '2025-07-15 14:00:00',
      });

      const res = await formPost(app, `/api/settings/article-schedules/${schedule.id}`, {
        name: 'Packers Thursday Deep Dive',
        teamAbbr: 'GB',
        prompt: 'Find the best Packers analytical angle this week.',
        weekdayUtc: '4',
        timeOfDayUtc: '15:30',
        presetId: 'technical_deep_dive',
        providerMode: 'default',
        providerId: '',
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Updated');

      const updated = repo.getArticleSchedule(schedule.id);
      expect(updated?.name).toBe('Packers Thursday Deep Dive');
      expect(updated?.team_abbr).toBe('GB');
      expect(updated?.content_profile).toBe('deep_dive');
      expect(updated?.depth_level).toBe(3);
    });

    it('returns a 400 partial for invalid panel constraints JSON from the config form', async () => {
      const res = await formPost(app, '/api/settings/article-schedules', {
        name: 'Seahawks Tuesday Accessible',
        teamAbbr: 'SEA',
        prompt: 'Find the best current Seahawks storyline for a broad audience.',
        weekdayUtc: '2',
        timeOfDayUtc: '14:00',
        presetId: 'casual_explainer',
        panelConstraintsJson: '{bad json',
        providerMode: 'default',
        providerId: '',
        enabled: 'true',
      });

      expect(res.status).toBe(400);
      const html = await res.text();
      expect(html).toContain('Invalid panel_constraints_json');
      expect(repo.listArticleSchedules()).toHaveLength(0);
    });

    it('preserves next_run_at when schedule timing is unchanged', async () => {
      const schedule = repo.createArticleSchedule({
        name: 'Seahawks Tuesday Accessible',
        team_abbr: 'SEA',
        prompt: 'Old prompt',
        weekday_utc: 2,
        time_of_day_utc: '14:00',
        content_profile: 'accessible',
        depth_level: 1,
        next_run_at: '2025-07-15 14:00:00',
      });

      const res = await formPost(app, `/api/settings/article-schedules/${schedule.id}`, {
        name: 'Seahawks Tuesday Deep Dive',
        teamAbbr: 'SEA',
        prompt: 'New prompt',
        weekdayUtc: '2',
        timeOfDayUtc: '14:00',
        contentProfile: 'deep_dive',
        depthLevel: '3',
        providerMode: 'override',
        providerId: 'gemini',
      });

      expect(res.status).toBe(200);
      const updated = repo.getArticleSchedule(schedule.id);
      expect(updated?.next_run_at).toBe('2025-07-15 14:00:00');
      expect(updated?.content_profile).toBe('deep_dive');
      expect(updated?.depth_level).toBe(3);
      expect(updated?.provider_mode).toBe('override');
      expect(updated?.provider_id).toBe('gemini');
    });

    it('toggles a schedule enabled state', async () => {
      const schedule = repo.createArticleSchedule({
        name: 'Seahawks Tuesday Accessible',
        team_abbr: 'SEA',
        prompt: 'Prompt',
        weekday_utc: 2,
        time_of_day_utc: '14:00',
        content_profile: 'accessible',
        depth_level: 1,
        next_run_at: '2025-07-15 14:00:00',
      });

      const res = await formPost(app, `/api/settings/article-schedules/${schedule.id}/toggle`, {});
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Toggled');
      expect(repo.getArticleSchedule(schedule.id)?.enabled).toBe(0);
    });

    it('deletes a schedule', async () => {
      const schedule = repo.createArticleSchedule({
        name: 'Seahawks Tuesday Accessible',
        team_abbr: 'SEA',
        prompt: 'Prompt',
        weekday_utc: 2,
        time_of_day_utc: '14:00',
        content_profile: 'accessible',
        depth_level: 1,
        next_run_at: '2025-07-15 14:00:00',
      });

      const res = await formDelete(app, `/api/settings/article-schedules/${schedule.id}`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Deleted');
      expect(repo.getArticleSchedule(schedule.id)).toBeNull();
    });
  });

  // ── Secrets ────────────────────────────────────────────

  describe('POST /api/settings/secrets', () => {
    it('stores publishing secrets from form', async () => {
      // The form sends individual named fields like substackToken, twitterApiKey
      // Need to set master key for crypto
      process.env['NFL_SETTINGS_MASTER_KEY'] = 'test-master-key-at-least-16-chars';
      const res = await formPost(app, '/api/settings/secrets', {
        group: 'publishing',
        substackToken: 'sk_test_abc123',
        twitterApiKey: 'twitter-key',
        twitterApiSecret: 'twitter-secret',
        twitterAccessToken: 'access-token',
        twitterAccessTokenSecret: 'access-secret',
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Saved');
    });

    it('stores image secrets from form', async () => {
      process.env['NFL_SETTINGS_MASTER_KEY'] = 'test-master-key-at-least-16-chars';
      const res = await formPost(app, '/api/settings/secrets', {
        group: 'images',
        geminiApiKey: 'gemini-key-123',
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Saved');
    });

    it('returns error when crypto is unavailable', async () => {
      delete process.env['NFL_SETTINGS_MASTER_KEY'];
      const res = await formPost(app, '/api/settings/secrets', {
        group: 'publishing',
        substackToken: 'sk_test_abc123',
      });
      expect(res.status).toBe(400);
      const html = await res.text();
      expect(html).toContain('NFL_SETTINGS_MASTER_KEY');
    });
  });

  describe('POST /api/settings/secrets/clear', () => {
    it('clears a secret', async () => {
      process.env['NFL_SETTINGS_MASTER_KEY'] = 'test-master-key-at-least-16-chars';
      // First store a secret
      const { encryptSecret } = await import('../../src/settings/crypto.js');
      repo.setEncryptedSecret('workspace', null, 'publishing', 'substackToken', encryptSecret('test'));

      const res = await formPost(app, '/api/settings/secrets/clear', {
        group: 'publishing',
        key: 'substackToken',
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Cleared');
    });
  });

  // ── Effective/diagnostics ─────────────────────────────

  describe('GET /api/settings/effective', () => {
    it('returns effective settings JSON', async () => {
      const res = await app.request('/api/settings/effective');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('entries');
      expect(json).toHaveProperty('serviceReadiness');
    });
  });
});
