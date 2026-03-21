import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Module from 'node:module';
import { initDataDir, seedKnowledge } from '../../src/config/index.js';
import { AgentMemory } from '../../src/agents/memory.js';

// seedKnowledge uses a dynamic CJS `require('../agents/memory.js')` which
// fails in vitest because the .js file doesn't exist (source is .ts) and the
// .ts source uses ESM syntax. Patch Module.prototype.require so the dynamic
// require returns the vitest-imported AgentMemory.
const _origRequire = Module.prototype.require;
// @ts-expect-error -- intentional monkey-patch for test compatibility
Module.prototype.require = function (id: string, ...rest: unknown[]) {
  if (typeof id === 'string' && id.endsWith('/agents/memory.js')) {
    return { AgentMemory };
  }
  return _origRequire.apply(this, [id, ...rest]);
};

/** Count .md files in a seed subdirectory relative to src/config/defaults */
function seedCount(subdir: string): number {
  const dir = join(__dirname, '..', '..', 'src', 'config', 'defaults', subdir);
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((f) => f.endsWith('.md')).length;
}

/** Count entries in bootstrap-memory.json */
function bootstrapMemoryCount(): number {
  const p = join(__dirname, '..', '..', 'src', 'config', 'defaults', 'bootstrap-memory.json');
  if (!existsSync(p)) return 0;
  return JSON.parse(readFileSync(p, 'utf-8')).length;
}

describe('Bootstrap init', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'nfl-lab-test-'));
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  // ── initDataDir ──────────────────────────────────────────────

  describe('initDataDir', () => {
    it('creates directory structure', () => {
      initDataDir(dataDir, 'nfl');

      for (const rel of [
        'config',
        'logs',
        join('leagues', 'nfl', 'articles'),
        join('leagues', 'nfl', 'images'),
        join('leagues', 'nfl', 'data-cache'),
        join('agents', 'charters', 'nfl'),
        join('agents', 'skills'),
      ]) {
        expect(existsSync(join(dataDir, rel)), `missing: ${rel}`).toBe(true);
      }
    });

    it('copies seed configs', () => {
      initDataDir(dataDir, 'nfl');

      const modelsPath = join(dataDir, 'config', 'models.json');
      const leaguesPath = join(dataDir, 'config', 'leagues.json');

      expect(existsSync(modelsPath)).toBe(true);
      expect(existsSync(leaguesPath)).toBe(true);

      const models = JSON.parse(readFileSync(modelsPath, 'utf-8'));
      expect(models).toHaveProperty('models');

      const leagues = JSON.parse(readFileSync(leaguesPath, 'utf-8'));
      expect(leagues).toHaveProperty('nfl');
    });

    it("doesn't overwrite existing configs", () => {
      initDataDir(dataDir, 'nfl');

      const modelsPath = join(dataDir, 'config', 'models.json');
      writeFileSync(modelsPath, '{"custom":true}');

      // Call again — should leave the custom file in place
      initDataDir(dataDir, 'nfl');

      const content = JSON.parse(readFileSync(modelsPath, 'utf-8'));
      expect(content).toEqual({ custom: true });
    });

    it('works with custom league', () => {
      initDataDir(dataDir, 'mlb');

      for (const rel of [
        join('leagues', 'mlb', 'articles'),
        join('leagues', 'mlb', 'images'),
        join('leagues', 'mlb', 'data-cache'),
        join('agents', 'charters', 'mlb'),
      ]) {
        expect(existsSync(join(dataDir, rel)), `missing: ${rel}`).toBe(true);
      }
    });
  });

  // ── seedKnowledge ────────────────────────────────────────────

  describe('seedKnowledge', () => {
    beforeEach(() => {
      initDataDir(dataDir, 'nfl');
    });

    it('copies charters', () => {
      const result = seedKnowledge(dataDir, 'nfl');
      const charterDir = join(dataDir, 'agents', 'charters', 'nfl');
      const files = readdirSync(charterDir).filter((f) => f.endsWith('.md'));

      const expected = seedCount(join('charters', 'nfl'));
      expect(files.length).toBe(expected);
      expect(result.charters).toBe(expected);
    });

    it('skips charters if dir not empty', () => {
      writeFileSync(join(dataDir, 'agents', 'charters', 'nfl', 'writer.md'), '# Custom');

      const result = seedKnowledge(dataDir, 'nfl');

      expect(result.charters).toBe(0);
      // Custom file untouched
      const content = readFileSync(
        join(dataDir, 'agents', 'charters', 'nfl', 'writer.md'),
        'utf-8',
      );
      expect(content).toBe('# Custom');
    });

    it('copies skills', () => {
      const result = seedKnowledge(dataDir, 'nfl');
      const skillDir = join(dataDir, 'agents', 'skills');
      const files = readdirSync(skillDir).filter((f) => f.endsWith('.md'));

      const expected = seedCount('skills');
      expect(files.length).toBe(expected);
      expect(result.skills).toBe(expected);
    });

    it("doesn't overwrite existing skills", () => {
      const skillPath = join(dataDir, 'agents', 'skills', 'editor-review.md');
      writeFileSync(skillPath, '# Custom Skill');

      const result = seedKnowledge(dataDir, 'nfl');

      // Custom file preserved
      expect(readFileSync(skillPath, 'utf-8')).toBe('# Custom Skill');
      // One fewer skill copied
      expect(result.skills).toBe(seedCount('skills') - 1);
    });

    it('creates bootstrap memory', () => {
      const result = seedKnowledge(dataDir, 'nfl');
      const memoryPath = join(dataDir, 'agents', 'memory.db');

      expect(existsSync(memoryPath)).toBe(true);
      expect(result.memory).toBe(bootstrapMemoryCount());

      // Verify entries actually exist in the database
      const mem = new AgentMemory(memoryPath);
      try {
        const entries = mem.recallGlobal({ limit: 100 });
        expect(entries.length).toBe(bootstrapMemoryCount());
        expect(entries.every((e) => e.category === 'domain_knowledge')).toBe(true);
      } finally {
        mem.close();
      }
    });

    it('skips memory if db exists', () => {
      // Create an empty file at the memory.db path
      writeFileSync(join(dataDir, 'agents', 'memory.db'), '');

      const result = seedKnowledge(dataDir, 'nfl');
      expect(result.memory).toBe(0);
    });

    it('returns counts for all categories', () => {
      const result = seedKnowledge(dataDir, 'nfl');

      expect(result).toHaveProperty('charters');
      expect(result).toHaveProperty('skills');
      expect(result).toHaveProperty('memory');

      expect(result.charters).toBeGreaterThan(0);
      expect(result.skills).toBeGreaterThan(0);
      expect(result.memory).toBeGreaterThan(0);

      // Exact totals match seed content
      expect(result.charters).toBe(seedCount(join('charters', 'nfl')));
      expect(result.skills).toBe(seedCount('skills'));
      expect(result.memory).toBe(bootstrapMemoryCount());
    });
  });
});
