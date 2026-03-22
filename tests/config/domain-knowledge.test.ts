import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Structured domain knowledge proof of concept', () => {
  const repoRoot = join(__dirname, '..', '..');

  describe('glossary seeds', () => {
    const glossaryDir = join(repoRoot, 'src', 'config', 'defaults', 'glossaries');
    const glossaryFiles = readdirSync(glossaryDir).filter((file) => file.endsWith('.yaml')).sort();

    it('includes the proof-of-concept glossary files', () => {
      expect(glossaryFiles).toEqual([
        'analytics-metrics.yaml',
        'cap-mechanics.yaml',
        'defense-schemes.yaml',
        'personnel-groupings.yaml',
      ]);
    });

    it('uses the shared glossary schema and entry fields', () => {
      for (const file of glossaryFiles) {
        const content = readFileSync(join(glossaryDir, file), 'utf-8');

        expect(content).toContain('schema_version: 1');
        expect(content).toMatch(/^id:\s[\w-]+/m);
        expect(content).toContain('glossary:');
        expect(content).toContain('description:');
        expect(content).toContain('entry_fields:');
        expect(content).toContain('refresh_guidance:');
        expect(content).toContain('entries:');

        const entryCount = (content.match(/^\s+- term:/gm) ?? []).length;
        expect(entryCount).toBeGreaterThanOrEqual(6);
        expect((content.match(/^\s+definition:/gm) ?? []).length).toBe(entryCount);
        expect((content.match(/^\s+source:/gm) ?? []).length).toBe(entryCount);
        expect((content.match(/^\s+verified_date:/gm) ?? []).length).toBe(entryCount);
        expect((content.match(/^\s+ttl_days:/gm) ?? []).length).toBe(entryCount);
      }
    });
  });

  describe('team identity sheets', () => {
    const teamSheetsDir = join(repoRoot, 'content', 'data', 'team-sheets');
    const expectedTeams = ['BUF', 'KC', 'SEA'];
    const requiredSections = [
      '## Snapshot',
      '## Team Identity',
      '## Offensive Identity',
      '## Defensive Identity',
      '## Roster Construction Signals',
      '## Writing Cues',
    ];

    it('includes the initial proof-of-concept team sheets', () => {
      for (const team of expectedTeams) {
        expect(existsSync(join(teamSheetsDir, ${team}.md))).toBe(true);
      }
    });

    it('ensures each proof-of-concept team sheet includes an H1 and the expected sections', () => {
      for (const team of expectedTeams) {
        const content = readFileSync(join(teamSheetsDir, ${team}.md), 'utf-8');

        expect(content.startsWith('# ')).toBe(true);
        expect(content).toContain(() Team Identity Sheet);
        expect(content).toContain('**Verified date:** 2026-03-22');
        expect(content).toContain('**Primary sources:**');

        for (const section of requiredSections) {
          expect(content).toContain(section);
        }
      }
    });
  });
});
