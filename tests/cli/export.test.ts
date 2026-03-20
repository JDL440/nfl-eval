import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { exportArticle } from '../../src/cli/export.js';
import { Repository } from '../../src/db/repository.js';
import { loadConfig, initDataDir } from '../../src/config/index.js';
import { ARTIFACT_FILES } from '../../src/dashboard/views/article.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'nfl-export-test-'));
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('exportArticle', () => {
  let tmpDir: string;
  let outputDir: string;
  let dbPath: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    tmpDir = createTempDir();
    outputDir = join(tmpDir, 'export-output');
    process.env.NFL_DATA_DIR = tmpDir;
    const config = loadConfig({ dataDir: tmpDir });
    initDataDir(config.dataDir);
    dbPath = config.dbPath;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors on Windows
    }
  });

  it('exports metadata.json and available artifacts', () => {
    const repo = new Repository(dbPath);
    repo.createArticle({ id: 'test-export', title: 'Export Test', subtitle: 'Sub' });
    repo.artifacts.put('test-export', 'idea.md', '# My Idea');
    repo.artifacts.put('test-export', 'draft.md', '# My Draft');
    repo.close();

    const result = exportArticle({ articleId: 'test-export', outputDir, dbPath });

    expect(result.exported).toContain('metadata.json');
    expect(result.exported).toContain('idea.md');
    expect(result.exported).toContain('draft.md');

    // Verify metadata contents
    const meta = JSON.parse(readFileSync(join(outputDir, 'metadata.json'), 'utf-8'));
    expect(meta.id).toBe('test-export');
    expect(meta.title).toBe('Export Test');

    // Verify artifact contents
    expect(readFileSync(join(outputDir, 'idea.md'), 'utf-8')).toBe('# My Idea');
    expect(readFileSync(join(outputDir, 'draft.md'), 'utf-8')).toBe('# My Draft');
  });

  it('skips artifacts that do not exist', () => {
    const repo = new Repository(dbPath);
    repo.createArticle({ id: 'sparse-article', title: 'Sparse' });
    repo.artifacts.put('sparse-article', 'idea.md', '# Just an idea');
    repo.close();

    const result = exportArticle({ articleId: 'sparse-article', outputDir, dbPath });

    expect(result.exported).toContain('metadata.json');
    expect(result.exported).toContain('idea.md');

    // All other ARTIFACT_FILES should be skipped
    const otherArtifacts = ARTIFACT_FILES.filter(f => f !== 'idea.md');
    for (const name of otherArtifacts) {
      expect(result.skipped).toContain(name);
      expect(existsSync(join(outputDir, name))).toBe(false);
    }
  });

  it('throws for non-existent article', () => {
    expect(() =>
      exportArticle({ articleId: 'nonexistent', outputDir, dbPath }),
    ).toThrow('Article not found: nonexistent');
  });

  it('creates output directory if it does not exist', () => {
    const nested = join(outputDir, 'deeply', 'nested', 'dir');
    expect(existsSync(nested)).toBe(false);

    const repo = new Repository(dbPath);
    repo.createArticle({ id: 'nested-test', title: 'Nested' });
    repo.close();

    const result = exportArticle({ articleId: 'nested-test', outputDir: nested, dbPath });

    expect(existsSync(nested)).toBe(true);
    expect(result.exported).toContain('metadata.json');
    expect(existsSync(join(nested, 'metadata.json'))).toBe(true);
  });

  it('exports stage transitions when present', () => {
    const repo = new Repository(dbPath);
    repo.createArticle({ id: 'trans-test', title: 'Transitions' });
    repo.advanceStage('trans-test', null, 1, 'test-agent', 'initial');
    repo.close();

    const result = exportArticle({ articleId: 'trans-test', outputDir, dbPath });

    expect(result.exported).toContain('stage-transitions.json');
    const transitions = JSON.parse(readFileSync(join(outputDir, 'stage-transitions.json'), 'utf-8'));
    expect(Array.isArray(transitions)).toBe(true);
    expect(transitions.length).toBeGreaterThan(0);
  });
});
