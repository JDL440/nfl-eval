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
      substackConfig: { labName: 'NFL Lab', subscribeCaption: 'Test', footerPatterns: [] },
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
    teams: [{ abbr: 'sea', city: 'Seattle', name: 'Seahawks' }],
    ...overrides,
  };
}

describe('Schedule API routes', () => {
  let repo: Repository;
  let tempDir: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nfl-sched-route-test-'));
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

  it('GET /api/schedules returns empty array initially', async () => {
    const res = await app.request('/api/schedules');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  it('POST /api/schedules creates a schedule', async () => {
    const res = await app.request('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tuesday Test',
        weekday_utc: 2,
        time_of_day_utc: '09:00',
        team_abbr: 'sea',
        prompt: 'Seahawks latest news',
        depth_level: 1,
        content_profile: 'accessible',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Tuesday Test');
    expect(body.weekday_utc).toBe(2);
    expect(body.depth_level).toBe(1);
    expect(body.content_profile).toBe('accessible');
    expect(body.next_run_at).toBeTruthy(); // should be computed
  });

  it('POST /api/schedules returns 400 if required fields missing', async () => {
    const res = await app.request('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Missing team' }),
    });
    expect(res.status).toBe(400);
  });

  it('GET /api/schedules returns created schedule', async () => {
    repo.createArticleSchedule({
      name: 'X',
      weekday_utc: 4,
      time_of_day_utc: '10:00',
      team_abbr: 'sea',
      prompt: 'p',
      depth_level: 3,
      content_profile: 'deep_dive',
      next_run_at: '2025-07-01 09:00:00',
    });
    const res = await app.request('/api/schedules');
    const body = await res.json();
    expect(body.length).toBe(1);
    expect(body[0].name).toBe('X');
    expect(body[0].depth_level).toBe(3);
  });

  it('PATCH /api/schedules/:id updates a schedule', async () => {
    const s = repo.createArticleSchedule({
      name: 'Old',
      weekday_utc: 2,
      time_of_day_utc: '09:00',
      team_abbr: 'sea',
      prompt: 'p',
      content_profile: 'accessible',
      depth_level: 2,
      next_run_at: '2025-07-01 09:00:00',
    });
    const res = await app.request(`/api/schedules/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New', depth_level: 3 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('New');
    expect(body.depth_level).toBe(3);
    expect(body.content_profile).toBe('accessible');
    expect(body.preset_id).toBe('beat_analysis');
    expect(body.article_form).toBe('standard');
  });

  it('PATCH /api/schedules/:id recomputes next_run_at when timing changes', async () => {
    const s = repo.createArticleSchedule({
      name: 'Old',
      weekday_utc: 2,
      time_of_day_utc: '09:00',
      team_abbr: 'sea',
      prompt: 'p',
      content_profile: 'accessible',
      depth_level: 2,
      next_run_at: '2025-07-01 09:00:00',
    });

    const res = await app.request(`/api/schedules/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weekday_utc: 4,
        time_of_day_utc: '11:30',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.weekday_utc).toBe(4);
    expect(body.time_of_day_utc).toBe('11:30');
    expect(body.next_run_at).not.toBe('2025-07-01 09:00:00');
    expect(repo.getArticleSchedule(s.id)?.next_run_at).toBe(body.next_run_at);
  });

  it('PATCH /api/schedules/:id keeps explicit next_run_at when timing changes', async () => {
    const s = repo.createArticleSchedule({
      name: 'Old',
      weekday_utc: 2,
      time_of_day_utc: '09:00',
      team_abbr: 'sea',
      prompt: 'p',
      content_profile: 'accessible',
      depth_level: 2,
      next_run_at: '2025-07-01 09:00:00',
    });

    const res = await app.request(`/api/schedules/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weekday_utc: 4,
        time_of_day_utc: '11:30',
        next_run_at: '2025-08-21 11:30:00',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.next_run_at).toBe('2025-08-21 11:30:00');
  });

  it('PATCH /api/schedules/:id returns 400 JSON for invalid panel constraints', async () => {
    const s = repo.createArticleSchedule({
      name: 'Old',
      weekday_utc: 2,
      time_of_day_utc: '09:00',
      team_abbr: 'sea',
      prompt: 'p',
      content_profile: 'accessible',
      depth_level: 2,
      next_run_at: '2025-07-01 09:00:00',
    });

    const res = await app.request(`/api/schedules/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        panel_constraints_json: '{bad json',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual(expect.objectContaining({
      error: expect.stringContaining('Invalid panel_constraints_json'),
    }));
    expect(repo.getArticleSchedule(s.id)?.panel_constraints_json).toBeNull();
  });

  it('PATCH /api/schedules/:id preserves canonical editorial overrides on non-editorial edits', async () => {
    const s = repo.createArticleSchedule({
      name: 'Old',
      weekday_utc: 2,
      time_of_day_utc: '09:00',
      team_abbr: 'sea',
      prompt: 'p',
      content_profile: 'deep_dive',
      depth_level: 3,
      preset_id: 'technical_deep_dive',
      reader_profile: 'hardcore',
      article_form: 'deep',
      panel_shape: 'scheme_breakdown',
      analytics_mode: 'metrics_forward',
      panel_constraints_json: JSON.stringify({ min_agents: 4, required_agents: ['film'] }),
      next_run_at: '2025-07-01 09:00:00',
    });

    const res = await app.request(`/api/schedules/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed only' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Renamed only');
    expect(body.preset_id).toBe('technical_deep_dive');
    expect(body.panel_shape).toBe('scheme_breakdown');
    expect(body.panel_constraints_json).toBe(JSON.stringify({ min_agents: 4, required_agents: ['film'] }));

    const updated = repo.getArticleSchedule(s.id)!;
    expect(updated.name).toBe('Renamed only');
    expect(updated.preset_id).toBe('technical_deep_dive');
    expect(updated.panel_shape).toBe('scheme_breakdown');
    expect(updated.panel_constraints_json).toBe(JSON.stringify({ min_agents: 4, required_agents: ['film'] }));
  });

  it('POST /api/schedules preserves mixed legacy tuples while deriving canonical controls', async () => {
    const res = await app.request('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Legacy Tuple',
        weekday_utc: 2,
        time_of_day_utc: '09:00',
        team_abbr: 'sea',
        prompt: 'Tuple test',
        depth_level: 2,
        content_profile: 'deep_dive',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.depth_level).toBe(2);
    expect(body.content_profile).toBe('deep_dive');
    expect(body.preset_id).toBe('technical_deep_dive');
    expect(body.article_form).toBe('deep');
  });

  it('DELETE /api/schedules/:id removes the schedule', async () => {
    const s = repo.createArticleSchedule({
      name: 'X',
      weekday_utc: 2,
      time_of_day_utc: '09:00',
      team_abbr: 'sea',
      prompt: 'p',
      content_profile: 'accessible',
      depth_level: 2,
      next_run_at: '2025-07-01 09:00:00',
    });
    const res = await app.request(`/api/schedules/${s.id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(repo.getArticleSchedule(s.id)).toBeNull();
  });

  it('GET /schedules renders the schedule list page', async () => {
    const res = await app.request('/schedules');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Article Schedules');
  });

  it('Tuesday accessible schedule has depth 1, Thursday deep dive has depth 3', async () => {
    const tue = repo.createArticleSchedule({
      name: 'Tuesday Accessible',
      weekday_utc: 2,
      time_of_day_utc: '09:00',
      team_abbr: 'sea',
      prompt: 'p',
      depth_level: 1,
      content_profile: 'accessible',
      next_run_at: '2025-07-01 09:00:00',
    });
    const thu = repo.createArticleSchedule({
      name: 'Thursday Deep Dive',
      weekday_utc: 4,
      time_of_day_utc: '10:00',
      team_abbr: 'sea',
      prompt: 'p',
      depth_level: 3,
      content_profile: 'deep_dive',
      next_run_at: '2025-07-01 09:00:00',
    });
    expect(tue.depth_level).toBe(1);
    expect(tue.content_profile).toBe('accessible');
    expect(thu.depth_level).toBe(3);
    expect(thu.content_profile).toBe('deep_dive');
  });
});
