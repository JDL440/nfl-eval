import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import db from '../src/db.js';
import { isSignificant, evaluateSignificance } from '../config/significance.js';
import { v4 as uuid } from 'uuid';

describe('Queue Tests', () => {
  beforeAll(() => {
    // Clear test data
    db.prepare('DELETE FROM jobs WHERE id LIKE "test-%"').run();
    db.prepare('DELETE FROM token_usage WHERE id LIKE "test-%"').run();
    db.prepare('DELETE FROM audit_log WHERE id LIKE "test-%"').run();
  });

  afterAll(() => {
    // Cleanup
    db.prepare('DELETE FROM jobs WHERE id LIKE "test-%"').run();
  });

  test('should initialize SQLite schema without error', () => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('jobs', 'token_usage', 'audit_log', 'config')"
      )
      .all();

    expect(tables.length).toBe(4);
  });

  test('should insert job into SQLite', () => {
    const jobId = `test-${uuid()}`;
    const stmt = db.prepare(`
      INSERT INTO jobs (id, type, state, data, token_usage, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    stmt.run(jobId, 'article-draft', 'pending', JSON.stringify({ test: true }), JSON.stringify({}));

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    expect(job).toBeDefined();
    expect(job.type).toBe('article-draft');
    expect(job.state).toBe('pending');
  });

  test('should transition job state from pending to processing', () => {
    const jobId = `test-${uuid()}`;
    db.prepare(
      'INSERT INTO jobs (id, type, state, data, token_usage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
    ).run(jobId, 'article-draft', 'pending', '{}', '{}');

    db.prepare('UPDATE jobs SET state = ? WHERE id = ?').run('processing', jobId);

    const job = db.prepare('SELECT state FROM jobs WHERE id = ?').get(jobId);
    expect(job.state).toBe('processing');
  });

  test('should record token usage for a job', () => {
    const jobId = `test-${uuid()}`;
    const tokenId = `test-${uuid()}`;

    db.prepare(
      'INSERT INTO jobs (id, type, state, data, token_usage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
    ).run(jobId, 'article-draft', 'completed', '{}', '{}');

    db.prepare(
      'INSERT INTO token_usage (id, job_id, model, input_tokens, output_tokens, cost, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
    ).run(tokenId, jobId, 'claude-3-5-haiku', 1000, 500, 0.0045);

    const token = db.prepare('SELECT * FROM token_usage WHERE job_id = ?').get(jobId);
    expect(token).toBeDefined();
    expect(token.model).toBe('claude-3-5-haiku');
    expect(token.input_tokens).toBe(1000);
  });

  test('should insert audit log entry', () => {
    const jobId = `test-${uuid()}`;
    const auditId = `test-${uuid()}`;

    db.prepare(
      'INSERT INTO jobs (id, type, state, data, token_usage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
    ).run(jobId, 'article-draft', 'pending', '{}', '{}');

    db.prepare(
      'INSERT INTO audit_log (id, job_id, action, actor, details, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
    ).run(auditId, jobId, 'enqueued', 'media-sweep', JSON.stringify({ test: true }));

    const audit = db.prepare('SELECT * FROM audit_log WHERE id = ?').get(auditId);
    expect(audit).toBeDefined();
    expect(audit.action).toBe('enqueued');
    expect(audit.actor).toBe('media-sweep');
  });

  test('should query jobs by state', () => {
    const jobId1 = `test-${uuid()}`;
    const jobId2 = `test-${uuid()}`;

    db.prepare(
      'INSERT INTO jobs (id, type, state, data, token_usage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
    ).run(jobId1, 'article-draft', 'pending', '{}', '{}');

    db.prepare(
      'INSERT INTO jobs (id, type, state, data, token_usage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
    ).run(jobId2, 'article-draft', 'completed', '{}', '{}');

    const pending = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE state = ? AND id LIKE "test-%"').get('pending');
    const completed = db
      .prepare('SELECT COUNT(*) as count FROM jobs WHERE state = ? AND id LIKE "test-%"')
      .get('completed');

    expect(pending.count).toBeGreaterThan(0);
    expect(completed.count).toBeGreaterThan(0);
  });
});
