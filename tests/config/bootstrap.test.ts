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
import { initDataDir, seedKnowledge, refreshCorePromptDefaults, prepareRuntimeDataDir } from '../../src/config/index.ts';
import { AgentMemory } from '../../src/agents/memory.ts';

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
      const content = readFileSync(join(dataDir, 'agents', 'charters', 'nfl', 'writer.md'), 'utf-8');
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

      expect(readFileSync(skillPath, 'utf-8')).toBe('# Custom Skill');
      expect(result.skills).toBe(seedCount('skills') - 1);
    });

    it('creates bootstrap memory', () => {
      const result = seedKnowledge(dataDir, 'nfl');
      const memoryPath = join(dataDir, 'agents', 'memory.db');

      expect(existsSync(memoryPath)).toBe(true);
      expect(result.memory).toBe(bootstrapMemoryCount());

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
      expect(result.charters).toBe(seedCount(join('charters', 'nfl')));
      expect(result.skills).toBe(seedCount('skills'));
      expect(result.memory).toBe(bootstrapMemoryCount());
    });
  });

  describe('refreshCorePromptDefaults', () => {
    beforeEach(() => {
      initDataDir(dataDir, 'nfl');
      seedKnowledge(dataDir, 'nfl');
    });

    it('overwrites only the allowlisted core runtime prompts', () => {
      const leadPath = join(dataDir, 'agents', 'charters', 'nfl', 'lead.md');
      const writerPath = join(dataDir, 'agents', 'charters', 'nfl', 'writer.md');
      const moderatorPath = join(dataDir, 'agents', 'charters', 'nfl', 'panel-moderator.md');
      const publisherPath = join(dataDir, 'agents', 'charters', 'nfl', 'publisher.md');
      const nonCoreCharterPath = join(dataDir, 'agents', 'charters', 'nfl', 'cap.md');
      const substackSkillPath = join(dataDir, 'agents', 'skills', 'substack-article.md');
      const panelCompositionSkillPath = join(dataDir, 'agents', 'skills', 'panel-composition.md');
      const nonCoreSkillPath = join(dataDir, 'agents', 'skills', 'image-review.md');

      writeFileSync(leadPath, '# Legacy lead prompt');
      writeFileSync(writerPath, '# Legacy writer prompt');
      writeFileSync(moderatorPath, '# Legacy moderator prompt');
      writeFileSync(publisherPath, '# Legacy publisher prompt');
      writeFileSync(nonCoreCharterPath, '# Custom cap charter');
      writeFileSync(substackSkillPath, '# Legacy substack skill');
      writeFileSync(panelCompositionSkillPath, '# Legacy panel composition skill');
      writeFileSync(nonCoreSkillPath, '# Custom image-review skill');

      const result = refreshCorePromptDefaults(dataDir, 'nfl');

      expect(result.charters).toBe(5);
      expect(result.skills).toBe(10);
      expect(result.updated).toEqual([
        'charter:lead',
        'charter:writer',
        'charter:editor',
        'charter:panel-moderator',
        'charter:publisher',
        'skill:article-discussion',
        'skill:article-lifecycle',
        'skill:discussion-prompt',
        'skill:panel-composition',
        'skill:fact-checking',
        'skill:idea-generation',
        'skill:substack-article',
        'skill:writer-fact-check',
        'skill:editor-review',
        'skill:publisher',
      ]);
      expect(readFileSync(leadPath, 'utf-8')).not.toBe('# Legacy lead prompt');
      expect(readFileSync(writerPath, 'utf-8')).not.toBe('# Legacy writer prompt');
      expect(readFileSync(moderatorPath, 'utf-8')).not.toBe('# Legacy moderator prompt');
      expect(readFileSync(publisherPath, 'utf-8')).not.toBe('# Legacy publisher prompt');
      expect(readFileSync(substackSkillPath, 'utf-8')).not.toBe('# Legacy substack skill');
      expect(readFileSync(panelCompositionSkillPath, 'utf-8')).not.toBe('# Legacy panel composition skill');
      expect(readFileSync(nonCoreCharterPath, 'utf-8')).toBe('# Custom cap charter');
      expect(readFileSync(nonCoreSkillPath, 'utf-8')).toBe('# Custom image-review skill');
    });

    it('adds article-lifecycle to existing installs from defaults', () => {
      const lifecyclePath = join(dataDir, 'agents', 'skills', 'article-lifecycle.md');
      rmSync(lifecyclePath, { force: true });

      const result = refreshCorePromptDefaults(dataDir, 'nfl');

      expect(result.updated).toContain('skill:article-lifecycle');
      expect(existsSync(lifecyclePath)).toBe(true);
    });
  });

  describe('prepareRuntimeDataDir', () => {
    it('creates runtime directories and refreshes curated core prompts', () => {
      const leadPath = join(dataDir, 'agents', 'charters', 'nfl', 'lead.md');
      const articleDiscussionPath = join(dataDir, 'agents', 'skills', 'article-discussion.md');

      initDataDir(dataDir, 'nfl');
      writeFileSync(leadPath, '# Legacy lead prompt');
      writeFileSync(articleDiscussionPath, '# Legacy article discussion');

      const result = prepareRuntimeDataDir(dataDir, 'nfl');

      expect(result.refreshed.charters).toBe(5);
      expect(result.refreshed.skills).toBe(10);
      expect(readFileSync(leadPath, 'utf-8')).not.toBe('# Legacy lead prompt');
      expect(readFileSync(articleDiscussionPath, 'utf-8')).not.toBe('# Legacy article discussion');
    });
  });
});
