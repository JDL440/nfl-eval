import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

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

    it('uses the shared glossary schema and content fields', () => {
      for (const file of glossaryFiles) {
        const content = readFileSync(join(glossaryDir, file), 'utf-8');
        const parsed = parse(content) as {
          schema_version: number;
          glossary: string;
          description: string;
          entry_fields: {
            required: string[];
            optional: string[];
          };
          refresh_guidance: string[];
          entries: Array<{
            term: string;
            definition: string;
            source: { refs: string[] };
            verified_date: string;
            ttl_days: number;
          }>;
        };

        expect(parsed.schema_version).toBe(1);
        expect(parsed.glossary).toBe(file.replace('.yaml', ''));
        expect(parsed.description.length).toBeGreaterThan(0);
        expect(parsed.entry_fields.required).toEqual([
          'term',
          'definition',
          'source',
          'verified_date',
          'ttl_days',
        ]);
        expect(parsed.entry_fields.optional).toEqual(['notes', 'examples']);
        expect(parsed.refresh_guidance.length).toBeGreaterThanOrEqual(1);
        expect(parsed.entries.length).toBeGreaterThanOrEqual(5);

        for (const entry of parsed.entries) {
          expect(entry.term.length).toBeGreaterThan(0);
          expect(entry.definition.length).toBeGreaterThan(0);
          expect(entry.source.refs.length).toBeGreaterThanOrEqual(1);
          expect(entry.verified_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(entry.ttl_days).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('team identity sheets', () => {
    const teamSheetsDir = join(repoRoot, 'content', 'data', 'team-sheets');
    const expectedTeams = ['BUF', 'KC', 'SEA'];
    const requiredSections = [
      '## Durable snapshot',
      '## Identity anchors',
      '### Offense',
      '### Defense',
      '## Roster-building and cap framing',
      '## Source guidance',
    ];

    it('includes the initial proof-of-concept team sheets', () => {
      for (const team of expectedTeams) {
        expect(existsSync(join(teamSheetsDir, team + '.md'))).toBe(true);
      }
    });

    it('ensures each proof-of-concept team sheet includes frontmatter and the durable layout', () => {
      for (const team of expectedTeams) {
        const content = readFileSync(join(teamSheetsDir, team + '.md'), 'utf-8');
        const normalized = content.replace(/^\uFEFF/, '').trimStart();

        expect(normalized.startsWith('---')).toBe(true);
        expect(normalized).toMatch(/^team:\s[A-Z]{2,3}$/m);
        expect(normalized).toMatch(/^team_name:\s.+$/m);
        expect(normalized).toMatch(/^verified_date:\s\d{4}-\d{2}-\d{2}$/m);
        expect(normalized).toMatch(/^ttl_days:\s\d+$/m);
        expect(normalized).toContain('sources:');
        expect(normalized).toContain('volatility:');

        for (const section of requiredSections) {
          expect(normalized).toContain(section);
        }

        expect((normalized.match(/^- \*\*/gm) ?? []).length).toBeGreaterThanOrEqual(4);
      }
    });
  });
});