import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Repository } from '../../src/db/repository.js';
import { writeAgentResult } from '../../src/pipeline/actions.js';

describe('writeAgentResult', () => {
  let tmpDir: string;
  let repo: Repository;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'write-agent-'));
    const dbPath = join(tmpDir, 'pipeline.db');
    repo = new Repository(dbPath);
    repo.createArticle({ id: 'test-article', title: 'Test Article', primary_team: 'SEA' });
  });

  afterEach(() => {
    repo.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('saves main artifact when no thinking present', () => {
    writeAgentResult(repo, 'test-article', 'draft.md', {
      content: '# Article\n\nBody text.',
      thinking: null,
      model: 'gpt-4o',
      agentName: 'writer',
    });

    const main = repo.artifacts.get('test-article', 'draft.md');
    expect(main).toBe('# Article\n\nBody text.');

    const thinkFile = repo.artifacts.get('test-article', 'draft.thinking.md');
    expect(thinkFile).toBeNull();
  });

  it('saves main artifact and thinking file when thinking present', () => {
    writeAgentResult(repo, 'test-article', 'draft.md', {
      content: '# Article\n\nBody text.',
      thinking: 'I analyzed the data and decided on this structure.',
      model: 'qwen-2.5',
      agentName: 'writer',
    });

    const main = repo.artifacts.get('test-article', 'draft.md');
    expect(main).toBe('# Article\n\nBody text.');

    const thinkFile = repo.artifacts.get('test-article', 'draft.thinking.md');
    expect(thinkFile).not.toBeNull();
    expect(thinkFile).toContain('# Thinking Trace');
    expect(thinkFile).toContain('**Agent:** writer');
    expect(thinkFile).toContain('**Model:** qwen-2.5');
    expect(thinkFile).toContain('**Artifact:** draft.md');
    expect(thinkFile).toContain('I analyzed the data and decided on this structure.');
  });

  it('thinking file header contains correct metadata', () => {
    writeAgentResult(repo, 'test-article', 'editor-review.md', {
      content: 'Review result.',
      thinking: 'Checked grammar and style.',
      model: 'deepseek-r1',
      agentName: 'editor',
    });

    const thinkFile = repo.artifacts.get('test-article', 'editor-review.thinking.md');
    expect(thinkFile).not.toBeNull();
    expect(thinkFile).toMatch(/\*\*Agent:\*\* editor/);
    expect(thinkFile).toMatch(/\*\*Model:\*\* deepseek-r1/);
    expect(thinkFile).toMatch(/\*\*Artifact:\*\* editor-review\.md/);
  });

  it('multiple calls save separate thinking files without overwriting', () => {
    writeAgentResult(repo, 'test-article', 'draft.md', {
      content: 'Draft content.',
      thinking: 'Writer thinking.',
      model: 'gpt-4o',
      agentName: 'writer',
    });

    writeAgentResult(repo, 'test-article', 'editor-review.md', {
      content: 'Editor result.',
      thinking: 'Editor thinking.',
      model: 'deepseek-r1',
      agentName: 'editor',
    });

    const writerThink = repo.artifacts.get('test-article', 'draft.thinking.md');
    const editorThink = repo.artifacts.get('test-article', 'editor-review.thinking.md');

    expect(writerThink).toContain('Writer thinking.');
    expect(writerThink).toContain('**Agent:** writer');

    expect(editorThink).toContain('Editor thinking.');
    expect(editorThink).toContain('**Agent:** editor');
  });
});
