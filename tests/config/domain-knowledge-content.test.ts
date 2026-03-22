import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();

const glossaryFiles = [
  'analytics-metrics.yaml',
  'cap-mechanics.yaml',
  'defense-schemes.yaml',
  'personnel-groupings.yaml',
].map((file) => join(repoRoot, 'src', 'config', 'defaults', 'glossaries', file));

const teamSheetFiles = ['SEA.md', 'KC.md', 'BUF.md']
  .map((file) => join(repoRoot, 'content', 'data', 'team-sheets', file));

describe('domain knowledge glossary files', () => {
  it('ships the phase 1 glossary set', () => {
    for (const file of glossaryFiles) {
      expect(existsSync(file), missing glossary: ).toBe(true);
    }
  });

  it('captures the factual schema required for issue 85', () => {
    for (const file of glossaryFiles) {
      const content = readFileSync(file, 'utf-8');

      expect(content).toContain('schema_version: 1');
      expect(content).toMatch(/^id:\s[\w-]+/m);
      expect(content).toContain('glossary:');
      expect(content).toContain('description:');
      expect(content).toContain('entry_fields:');
      expect(content).toContain('required:');
      expect(content).toContain('entries:');
      expect(content).toContain('- term');
      expect(content).toContain('- definition');
      expect(content).toContain('- source');
      expect(content).toContain('- verified_date');
      expect(content).toContain('- ttl_days');
      expect((content.match(/refs:/g) ?? []).length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('team identity sheets', () => {
  it('ships the validated phase 3 team sheets', () => {
    for (const file of teamSheetFiles) {
      expect(existsSync(file), missing team sheet: ).toBe(true);
    }
  });

  it('uses the shared markdown layout required by Code', () => {
    for (const file of teamSheetFiles) {
      const content = readFileSync(file, 'utf-8');

      expect(content.startsWith('# '), ${file} should start with an H1).toBe(true);
      expect(content).toContain('## Snapshot');
      expect(content).toContain('## Team Identity');
      expect(content).toContain('## Offensive Identity');
      expect(content).toContain('## Defensive Identity');
      expect(content).toContain('## Roster ConstructionSignals');
      expect(content).toContain('## Writing Cues');
      expect(content).toContain('**Verified date:** 2026-03-22');
      expect(content).toContain('**Primary sources:**');
      expect((content.match(/^- \*\*/gm) ?? []).length).toBeGreaterThanOrEqual(5);
    }
  });
});
