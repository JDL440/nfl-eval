import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { printUsage, run, handleInit, handleRetrospectiveDigest, handleStatus } from '../src/cli.js';
import { Repository } from '../src/db/repository.js';
import { PipelineEngine } from '../src/pipeline/engine.js';
import { PipelineScheduler } from '../src/pipeline/scheduler.js';
import { loadConfig, initDataDir } from '../src/config/index.js';
import type { AppConfig } from '../src/config/index.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'nfl-cli-test-'));
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('CLI', () => {
  let tmpDir: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    tmpDir = createTempDir();
    process.env.NFL_DATA_DIR = tmpDir;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors on Windows
    }
  });

  describe('printUsage', () => {
    it('prints usage text to stdout', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      printUsage();
      expect(spy).toHaveBeenCalledTimes(1);
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('NFL Lab v2');
      expect(output).toContain('serve');
      expect(output).toContain('init');
      expect(output).toContain('migrate');
      expect(output).toContain('status');
      expect(output).toContain('advance');
      expect(output).toContain('batch');
      expect(output).toContain('retrospective-digest');
      expect(output).toContain('mcp');
      expect(output).toContain('help');
      spy.mockRestore();
    });
  });

  describe('help command', () => {
    it('prints usage when "help" is passed', async () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await run(['node', 'cli.ts', 'help']);
      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('NFL Lab v2');
      spy.mockRestore();
    });

    it('prints usage for --help flag', async () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await run(['node', 'cli.ts', '--help']);
      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('NFL Lab v2');
      spy.mockRestore();
    });
  });

  describe('unknown command', () => {
    it('prints error and usage for unknown command', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const originalExitCode = process.exitCode;

      await run(['node', 'cli.ts', 'foobar']);

      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown command: foobar'));
      // printUsage is also called
      expect(logSpy).toHaveBeenCalled();
      expect(process.exitCode).toBe(1);

      process.exitCode = originalExitCode;
      logSpy.mockRestore();
      errSpy.mockRestore();
    });
  });

  describe('init command', () => {
    it('creates data directory structure', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await handleInit();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Data directory initialized'));
      // Verify core directories were created
      expect(existsSync(join(tmpDir, 'config'))).toBe(true);
      expect(existsSync(join(tmpDir, 'logs'))).toBe(true);
      expect(existsSync(join(tmpDir, 'leagues', 'nfl', 'articles'))).toBe(true);
      expect(existsSync(join(tmpDir, 'agents', 'charters'))).toBe(true);

      logSpy.mockRestore();
    });
  });

  describe('status command', () => {
    it('prints pipeline summary table', async () => {
      initDataDir(tmpDir);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await handleStatus();

      const allOutput = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(allOutput).toContain('Pipeline Status');
      expect(allOutput).toContain('Stage');
      expect(allOutput).toContain('Name');
      expect(allOutput).toContain('Count');
      expect(allOutput).toContain('Ready');
      expect(allOutput).toContain('Idea Generation');
      expect(allOutput).toContain('Published');
      expect(allOutput).toContain('Total');

      logSpy.mockRestore();
    });

    it('reflects actual article counts', async () => {
      initDataDir(tmpDir);
      const config = loadConfig({ dataDir: tmpDir });
      const repo = new Repository(config.dbPath);
      repo.createArticle({ id: 'test-article-1', title: 'Test Article 1' });
      repo.createArticle({ id: 'test-article-2', title: 'Test Article 2' });
      repo.close();

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await handleStatus();

      // The two articles should be at stage 1, so total count = 2
      const allOutput = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(allOutput).toContain('2');

      logSpy.mockRestore();
    });
  });

  describe('advance command', () => {
    it('errors when no article id is given', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const originalExitCode = process.exitCode;

      await run(['node', 'cli.ts', 'advance']);

      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
      expect(process.exitCode).toBe(1);

      process.exitCode = originalExitCode;
      errSpy.mockRestore();
    });
  });

  describe('retrospective digest command', () => {
    it('prints a bounded markdown digest for manual review', async () => {
      initDataDir(tmpDir);
      const config = loadConfig({ dataDir: tmpDir });
      const repo = new Repository(config.dbPath);
      repo.createArticle({ id: 'digest-a', title: 'Digest A' });
      repo.createArticle({ id: 'digest-b', title: 'Digest B' });
      repo.createArticle({ id: 'digest-c', title: 'Digest C' });
      repo.saveArticleRetrospective({
        articleId: 'digest-a',
        completionStage: 7,
        revisionCount: 1,
        forceApprovedAfterMaxRevisions: false,
        participantRoles: ['writer'],
        overallSummary: 'Writer issue.',
        findings: [
          { role: 'writer', findingType: 'churn_cause', findingText: 'Fix stale EPA section.', priority: 'high' },
        ],
      });
      repo.saveArticleRetrospective({
        articleId: 'digest-b',
        completionStage: 7,
        revisionCount: 2,
        forceApprovedAfterMaxRevisions: false,
        participantRoles: ['writer'],
        overallSummary: 'Same issue.',
        findings: [
          { role: 'writer', findingType: 'churn_cause', findingText: 'Fix stale EPA section!', priority: 'high' },
        ],
      });
      repo.saveArticleRetrospective({
        articleId: 'digest-c',
        completionStage: 7,
        revisionCount: 1,
        forceApprovedAfterMaxRevisions: false,
        participantRoles: ['lead'],
        overallSummary: 'Lead process note.',
        findings: [
          { role: 'lead', findingType: 'process_improvement', findingText: 'Add a pre-editor stat check.', priority: 'medium' },
        ],
      });
      repo.saveArticleRetrospective({
        articleId: 'digest-c',
        completionStage: 8,
        revisionCount: 2,
        forceApprovedAfterMaxRevisions: true,
        participantRoles: ['editor'],
        overallSummary: 'Editor repeated note.',
        findings: [
          { role: 'editor', findingType: 'style_gap', findingText: 'Call out injury status changes sooner.', priority: 'high' },
        ],
      });
      repo.close();

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await handleRetrospectiveDigest({ limit: 10 });

      expect(logSpy).toHaveBeenCalledTimes(1);
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain('# Retrospective Digest');
      expect(output).toContain('## Issue-ready Process Improvement Candidates');
      expect(output).toContain('## Learning Update Candidates');
      expect(output).toContain('Add a pre-editor stat check.');
      expect(output).toContain('Call out injury status changes sooner.');
      expect(output).not.toContain('- Fix stale EPA section.');
      expect(output).toContain('Why promoted: lead-authored process-improvement finding');
      expect(output).toContain('Why promoted: high-priority writer/editor signal for manual learning review');
      expect(output).toContain('2 articles; findings 2; priorities high:2');
      expect(output).toContain('force-approved articles 1');

      logSpy.mockRestore();
    });

    it('supports json output through the command dispatcher', async () => {
      initDataDir(tmpDir);
      const config = loadConfig({ dataDir: tmpDir });
      const repo = new Repository(config.dbPath);
      repo.createArticle({ id: 'digest-json', title: 'Digest JSON' });
      repo.saveArticleRetrospective({
        articleId: 'digest-json',
        completionStage: 7,
        revisionCount: 1,
        forceApprovedAfterMaxRevisions: false,
        participantRoles: ['lead'],
        overallSummary: 'JSON summary.',
        findings: [
          { role: 'lead', findingType: 'process_improvement', findingText: 'Document the checklist.', priority: 'high' },
        ],
      });
      repo.close();

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await run(['node', 'cli.ts', 'retrospective-digest', '--json', '--limit', '5']);

      const output = logSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output) as {
        totals: { retrospectives: number };
        candidates: {
          processImprovements: Array<{ text: string; promotionReasons: string[]; evidence: { articleCount: number } }>;
        };
      };
      expect(parsed.totals.retrospectives).toBe(1);
      expect(parsed.candidates.processImprovements[0].text).toBe('Document the checklist.');
      expect(parsed.candidates.processImprovements[0].promotionReasons).toContain('lead-authored process-improvement finding');
      expect(parsed.candidates.processImprovements[0].evidence.articleCount).toBe(1);

      logSpy.mockRestore();
    });

    it('promotes repeated non-lead process improvements to issue-ready candidates', async () => {
      initDataDir(tmpDir);
      const config = loadConfig({ dataDir: tmpDir });
      const repo = new Repository(config.dbPath);
      repo.createArticle({ id: 'digest-repeat-a', title: 'Digest Repeat A' });
      repo.createArticle({ id: 'digest-repeat-b', title: 'Digest Repeat B' });
      repo.saveArticleRetrospective({
        articleId: 'digest-repeat-a',
        completionStage: 7,
        revisionCount: 1,
        forceApprovedAfterMaxRevisions: false,
        participantRoles: ['writer'],
        overallSummary: 'First process note.',
        findings: [
          {
            role: 'writer',
            findingType: 'process_improvement',
            findingText: 'Add a stat freshness checklist before drafting.',
            priority: 'medium',
          },
        ],
      });
      repo.saveArticleRetrospective({
        articleId: 'digest-repeat-b',
        completionStage: 8,
        revisionCount: 2,
        forceApprovedAfterMaxRevisions: false,
        participantRoles: ['writer'],
        overallSummary: 'Second process note.',
        findings: [
          {
            role: 'writer',
            findingType: 'process_improvement',
            findingText: 'Add a stat freshness checklist before drafting!',
            priority: 'low',
          },
        ],
      });
      repo.close();

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await run(['node', 'cli.ts', 'retrospective-digest', '--json', '--limit', '5']);

      const output = logSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output) as {
        candidates: {
          processImprovements: Array<{ text: string; promotionReasons: string[]; evidence: { articleCount: number } }>;
          learningUpdates: Array<{ text: string }>;
        };
      };
      expect(parsed.candidates.processImprovements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: 'Add a stat freshness checklist before drafting!',
            promotionReasons: expect.arrayContaining(['process-improvement finding repeated across 2+ articles']),
            evidence: expect.objectContaining({ articleCount: 2 }),
          }),
        ]),
      );
      expect(parsed.candidates.learningUpdates).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ text: 'Add a stat freshness checklist before drafting!' }),
        ]),
      );

      logSpy.mockRestore();
    });
  });
});

describe('programmatic index exports', () => {
  it('exports core types and classes', async () => {
    const idx = await import('../src/index.js');

    // Config
    expect(typeof idx.loadConfig).toBe('function');
    expect(typeof idx.initDataDir).toBe('function');

    // Types / constants
    expect(idx.VALID_STAGES).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(idx.STAGE_NAMES).toBeDefined();
    expect(idx.VALID_STATUSES).toBeDefined();

    // Classes
    expect(typeof idx.Repository).toBe('function');
    expect(typeof idx.PipelineEngine).toBe('function');
    expect(typeof idx.PipelineScheduler).toBe('function');

    // Dashboard
    expect(typeof idx.createApp).toBe('function');
    expect(typeof idx.startServer).toBe('function');

    // MCP
    expect(typeof idx.createMCPServer).toBe('function');
    expect(typeof idx.startMCPServer).toBe('function');

    // Migration
    expect(typeof idx.migrate).toBe('function');

    // CLI
    expect(typeof idx.run).toBe('function');
    expect(typeof idx.printUsage).toBe('function');
  });
});
