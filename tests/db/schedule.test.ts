import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { Repository } from '../../src/db/repository.js';

describe('Article Schedule Repository', () => {
  let repo: Repository;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nfl-sched-test-'));
    repo = new Repository(join(tempDir, 'test.db'));
  });

  afterEach(() => {
    repo.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('schedule CRUD', () => {
    it('creates and retrieves a schedule', () => {
      const s = repo.createArticleSchedule({
        name: 'Tuesday Accessible',
        weekday_utc: 2,
        time_of_day_utc: '09:00',
        team_abbr: 'seahawks',
        prompt: 'Latest Seahawks news',
        depth_level: 1,
        content_profile: 'accessible',
        next_run_at: '2025-07-01 09:00:00',
      });
      expect(s.id).toBeTruthy();
      expect(s.name).toBe('Tuesday Accessible');
      expect(s.weekday_utc).toBe(2);
      expect(s.depth_level).toBe(1);
      expect(s.content_profile).toBe('accessible');
      expect(s.enabled).toBe(1);
      expect(s.provider_mode).toBe('default');

      const retrieved = repo.getArticleSchedule(s.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.name).toBe('Tuesday Accessible');
    });

    it('lists schedules', () => {
      repo.createArticleSchedule({
        name: 'Disabled',
        weekday_utc: 4,
        time_of_day_utc: '10:00',
        team_abbr: 'packers',
        prompt: 'p',
        enabled: false,
        content_profile: 'accessible',
        depth_level: 2,
        next_run_at: '2025-07-01 09:00:00',
      });
      repo.createArticleSchedule({
        name: 'Enabled',
        weekday_utc: 2,
        time_of_day_utc: '09:00',
        team_abbr: 'seahawks',
        prompt: 'p',
        content_profile: 'accessible',
        depth_level: 2,
        next_run_at: '2025-07-01 09:00:00',
      });
      const list = repo.listArticleSchedules();
      expect(list.length).toBe(2);
    });

    it('updates a schedule', () => {
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
      const updated = repo.updateArticleSchedule(s.id, { name: 'New', depth_level: 3 });
      expect(updated.name).toBe('New');
      expect(updated.depth_level).toBe(3);
      expect(updated.content_profile).toBe('accessible');
      expect(updated.preset_id).toBe('beat_analysis');
      expect(updated.article_form).toBe('standard');
    });

    it('preserves mixed legacy tuples on create while deriving canonical controls', () => {
      const deepBeat = repo.createArticleSchedule({
        name: 'Legacy deep beat',
        weekday_utc: 2,
        time_of_day_utc: '09:00',
        team_abbr: 'sea',
        prompt: 'p',
        content_profile: 'deep_dive',
        depth_level: 2,
        next_run_at: '2025-07-01 09:00:00',
      });

      expect(deepBeat.depth_level).toBe(2);
      expect(deepBeat.content_profile).toBe('deep_dive');
      expect(deepBeat.preset_id).toBe('technical_deep_dive');
      expect(deepBeat.article_form).toBe('deep');

      const accessibleDeep = repo.createArticleSchedule({
        name: 'Legacy accessible deep',
        weekday_utc: 3,
        time_of_day_utc: '09:00',
        team_abbr: 'sea',
        prompt: 'p',
        content_profile: 'accessible',
        depth_level: 3,
        next_run_at: '2025-07-02 09:00:00',
      });

      expect(accessibleDeep.depth_level).toBe(3);
      expect(accessibleDeep.content_profile).toBe('accessible');
      expect(accessibleDeep.preset_id).toBe('beat_analysis');
      expect(accessibleDeep.article_form).toBe('standard');
    });

    it('preserves mixed legacy tuples on legacy-only updates', () => {
      const schedule = repo.createArticleSchedule({
        name: 'Old',
        weekday_utc: 2,
        time_of_day_utc: '09:00',
        team_abbr: 'sea',
        prompt: 'p',
        content_profile: 'accessible',
        depth_level: 2,
        next_run_at: '2025-07-01 09:00:00',
      });

      const updated = repo.updateArticleSchedule(schedule.id, {
        depth_level: 3,
        content_profile: 'accessible',
      });

      expect(updated.depth_level).toBe(3);
      expect(updated.content_profile).toBe('accessible');
      expect(updated.preset_id).toBe('beat_analysis');
      expect(updated.article_form).toBe('standard');
    });

    it('enables and disables a schedule', () => {
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
      const disabled = repo.updateArticleSchedule(s.id, { enabled: false });
      expect(disabled.enabled).toBe(0);
      const enabled = repo.updateArticleSchedule(s.id, { enabled: true });
      expect(enabled.enabled).toBe(1);
    });

    it('deletes a schedule', () => {
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
      repo.deleteArticleSchedule(s.id);
      expect(repo.getArticleSchedule(s.id)).toBeNull();
    });

    it('returns due schedules', () => {
      const past = '2020-01-01 09:00:00';
      const future = '2099-12-31 09:00:00';
      const s1 = repo.createArticleSchedule({
        name: 'Due',
        weekday_utc: 2,
        time_of_day_utc: '09:00',
        team_abbr: 'sea',
        prompt: 'p',
        content_profile: 'accessible',
        depth_level: 2,
        next_run_at: past,
      });
      repo.createArticleSchedule({
        name: 'Future',
        weekday_utc: 4,
        time_of_day_utc: '10:00',
        team_abbr: 'gb',
        prompt: 'p',
        content_profile: 'accessible',
        depth_level: 2,
        next_run_at: future,
      });
      const due = repo.listArticleSchedules({ enabledOnly: true, dueBefore: '2025-06-01 00:00:00' });
      expect(due.length).toBe(1);
      expect(due[0].id).toBe(s1.id);
    });

    it('does not return disabled schedules as due', () => {
      const past = '2020-01-01 09:00:00';
      repo.createArticleSchedule({
        name: 'Disabled Due',
        weekday_utc: 2,
        time_of_day_utc: '09:00',
        team_abbr: 'sea',
        prompt: 'p',
        content_profile: 'accessible',
        depth_level: 2,
        next_run_at: past,
        enabled: false,
      });
      const due = repo.listArticleSchedules({ enabledOnly: true, dueBefore: '2025-06-01 00:00:00' });
      expect(due.length).toBe(0);
    });
  });

  describe('schedule run claim idempotency', () => {
    it('claims a run slot and returns a run object', () => {
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
      const run = repo.claimArticleScheduleRun(s.id, '2025-07-01 09:00:00');
      expect(run).toBeTruthy();
      expect(run!.status).toBe('claimed');
    });

    it('returns null on second claim for same slot', () => {
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
      const slot = '2025-07-01 09:00:00';
      const first = repo.claimArticleScheduleRun(s.id, slot);
      const second = repo.claimArticleScheduleRun(s.id, slot);
      expect(first).toBeTruthy();
      expect(second).toBeNull();
    });

    it('allows claiming different slots for the same schedule', () => {
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
      const r1 = repo.claimArticleScheduleRun(s.id, '2025-07-01 09:00:00');
      const r2 = repo.claimArticleScheduleRun(s.id, '2025-07-08 09:00:00');
      expect(r1).toBeTruthy();
      expect(r2).toBeTruthy();
      expect(r1!.id).not.toBe(r2!.id);
    });

    it('completes a run and records article id', () => {
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
      // Create the article first to satisfy foreign key constraint
      repo.createArticle({ id: 'my-article-slug', title: 'Test Article' });
      const run = repo.claimArticleScheduleRun(s.id, '2025-07-01 09:00:00')!;
      repo.markArticleScheduleRunCompleted(run.id, {
        status: 'completed',
        article_id: 'my-article-slug',
        selected_story_json: JSON.stringify({ title: 'Test Story' }),
      });
      const updated = repo.getArticleScheduleRun(run.id);
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('completed');
      expect(updated!.article_id).toBe('my-article-slug');
    });

    it('fails a run and records error text', () => {
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
      const run = repo.claimArticleScheduleRun(s.id, '2025-07-01 09:00:00')!;
      repo.markArticleScheduleRunCompleted(run.id, {
        status: 'failed',
        error_text: 'LLM timeout',
      });
      const updated = repo.getArticleScheduleRun(run.id);
      expect(updated!.status).toBe('failed');
      expect(updated!.error_text).toBe('LLM timeout');
    });
  });

  describe('schedule run listing', () => {
    it('lists runs newest first', async () => {
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
      repo.claimArticleScheduleRun(s.id, '2025-07-01 09:00:00');
      // Wait a millisecond to ensure different started_at timestamps
      await new Promise(resolve => setTimeout(resolve, 2));
      repo.claimArticleScheduleRun(s.id, '2025-07-08 09:00:00');
      const runs = repo.listArticleScheduleRuns(s.id);
      expect(runs.length).toBe(2);
      // Should be sorted by started_at DESC, so the second claim (2025-07-08) should be first
      expect(runs[0].scheduled_for).toBe('2025-07-08 09:00:00');
    });
  });

  describe('legacy editorial backfill', () => {
    it('backfills existing schedule rows from legacy depth/content semantics', () => {
      repo.close();
      const dbPath = join(tempDir, 'legacy.db');
      const db = new DatabaseSync(dbPath);
      db.exec(`
        CREATE TABLE article_schedules (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          team_abbr TEXT NOT NULL,
          prompt TEXT NOT NULL,
          weekday_utc INTEGER NOT NULL,
          time_of_day_utc TEXT NOT NULL,
          content_profile TEXT NOT NULL DEFAULT 'accessible',
          depth_level INTEGER NOT NULL DEFAULT 2,
          preset_id TEXT DEFAULT 'beat_analysis',
          reader_profile TEXT DEFAULT 'engaged',
          article_form TEXT DEFAULT 'standard',
          panel_shape TEXT DEFAULT 'auto',
          analytics_mode TEXT DEFAULT 'normal',
          panel_constraints_json TEXT,
          provider_mode TEXT NOT NULL DEFAULT 'default',
          provider_id TEXT,
          last_run_at TEXT,
          next_run_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
      db.exec(`
        INSERT INTO article_schedules (
          id, name, team_abbr, prompt, weekday_utc, time_of_day_utc, content_profile, depth_level,
          preset_id, reader_profile, article_form, panel_shape, analytics_mode, next_run_at
        ) VALUES (
          'legacy-schedule', 'Legacy', 'SEA', 'Prompt', 2, '09:00', 'deep_dive', 2,
          'beat_analysis', 'engaged', 'standard', 'auto', 'normal', '2025-07-01 09:00:00'
        );
      `);
      db.close();

      repo = new Repository(dbPath);

      const schedule = repo.getArticleSchedule('legacy-schedule');
      expect(schedule).not.toBeNull();
      expect(schedule?.preset_id).toBe('technical_deep_dive');
      expect(schedule?.reader_profile).toBe('hardcore');
      expect(schedule?.article_form).toBe('deep');
      expect(schedule?.analytics_mode).toBe('metrics_forward');
      expect(schedule?.depth_level).toBe(2);
      expect(schedule?.content_profile).toBe('deep_dive');
    });
  });
});
