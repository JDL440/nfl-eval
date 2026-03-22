import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

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
      expect(existsSync(file), 'missing glossary: ' + file).toBe(true);
    }
  });

  it('captures the minimal factual glossary schema', () => {
    for (const file of glossaryFiles) {
      const content = readFileSync(file, 'utf-8');
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
          notes?: string[];
          examples?: string[];
          source: { refs: string[] };
          verified_date: string;
          ttl_days: number;
        }>;
      };

      expect(parsed.schema_version).toBe(1);
      expect(parsed.glossary).toMatch(/^[a-z-]+$/);
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
  it('ships the validated phase 3 team sheets', () => {
    for (const file of teamSheetFiles) {
      expect(existsSync(file), 'missing team sheet: ' + file).toBe(true);
    }
  });

  it('uses the agreed markdown plus frontmatter layout', () => {
    for (const file of teamSheetFiles) {
      const content = readFileSync(file, 'utf-8');
      const normalized = content.replace(/^\uFEFF/, '').trimStart();

      expect(normalized.startsWith('---'), file + ' should start with frontmatter').toBe(true);
      expect(normalized).toMatch(/^team:\s[A-Z]{2,3}$/m);
      expect(normalized).toMatch(/^team_name:\s.+$/m);
      expect(normalized).toMatch(/^verified_date:\s\d{4}-\d{2}-\d{2}$/m);
      expect(normalized).toMatch(/^ttl_days:\s\d+$/m);
      expect(normalized).toContain('sources:');
      expect(normalized).toContain('volatility:');
      expect(normalized).toContain('## Durable snapshot');
      expect(normalized).toContain('## Identity anchors');
      expect(normalized).toContain('### Offense');
      expect(normalized).toContain('### Defense');
      expect(normalized).toContain('## Roster-building and cap framing');
      expect(normalized).toContain('## Source guidance');
      expect((normalized.match(/^- \*\*/gm) ?? []).length).toBeGreaterThanOrEqual(4);
    }
  });
});