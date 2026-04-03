import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  ImageService,
  StubImageProvider,
  GeminiImageProvider,
  extractArticleSummary,
  type ImageGenerationConfig,
  type ImagePrompt,
} from '../../src/services/image.js';

// Minimal valid PNG signature (first 8 bytes)
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isPng(filePath: string): boolean {
  const buf = readFileSync(filePath);
  return buf.subarray(0, 8).equals(PNG_SIGNATURE);
}

describe('StubImageProvider', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nfl-img-stub-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('generates a valid placeholder PNG file', async () => {
    const provider = new StubImageProvider();
    const outPath = join(tempDir, 'test.png');
    const prompt: ImagePrompt = { description: 'A football game scene' };

    const result = await provider.generate(prompt, outPath);

    expect(existsSync(result.path)).toBe(true);
    expect(isPng(result.path)).toBe(true);
    expect(result.provider).toBe('stub');
    expect(result.prompt).toContain('A football game scene');
  });

  it('creates parent directories if needed', async () => {
    const provider = new StubImageProvider();
    const outPath = join(tempDir, 'nested', 'deep', 'test.png');

    await provider.generate({ description: 'test' }, outPath);

    expect(existsSync(outPath)).toBe(true);
  });

  it('returns correct dimensions for each aspect ratio', async () => {
    const provider = new StubImageProvider();

    const r16x9 = await provider.generate(
      { description: 'test', aspectRatio: '16:9' },
      join(tempDir, 'a.png'),
    );
    expect(r16x9.width).toBe(1920);
    expect(r16x9.height).toBe(1080);

    const r1x1 = await provider.generate(
      { description: 'test', aspectRatio: '1:1' },
      join(tempDir, 'b.png'),
    );
    expect(r1x1.width).toBe(1080);
    expect(r1x1.height).toBe(1080);

    const r4x3 = await provider.generate(
      { description: 'test', aspectRatio: '4:3' },
      join(tempDir, 'c.png'),
    );
    expect(r4x3.width).toBe(1440);
    expect(r4x3.height).toBe(1080);
  });

  it('includes team and player info in the prompt text', async () => {
    const provider = new StubImageProvider();
    const prompt: ImagePrompt = {
      description: 'Game action',
      team: 'Seattle Seahawks',
      players: ['Geno Smith', 'DK Metcalf'],
      style: 'editorial sports photography',
    };

    const result = await provider.generate(prompt, join(tempDir, 'team.png'));

    expect(result.prompt).toContain('Seattle Seahawks');
    expect(result.prompt).toContain('Geno Smith');
    expect(result.prompt).toContain('DK Metcalf');
    expect(result.prompt).toContain('editorial sports photography');
  });
});

describe('GeminiImageProvider', () => {
  it('throws when constructed without an API key', () => {
    expect(() => new GeminiImageProvider('')).toThrow('requires an API key');
  });

  it('can be constructed with a valid API key', () => {
    const provider = new GeminiImageProvider('test-key-123');
    expect(provider.id).toBe('gemini');
  });

  it('constructs correct API URL with key', async () => {
    const provider = new GeminiImageProvider('test-api-key');
    const tempDir = mkdtempSync(join(tmpdir(), 'nfl-img-gemini-'));

    // Mock fetch to capture the request
    const originalFetch = globalThis.fetch;
    let capturedUrl = '';
    let capturedBody: any = null;
    globalThis.fetch = async (input: any, init: any) => {
      capturedUrl = typeof input === 'string' ? input : input.url;
      capturedBody = JSON.parse(init.body);
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ inlineData: {
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8BQDwAEgAF/pooBPQAAAABJRU5ErkJggg=='
        } }] } }]
      }), { status: 200 });
    };

    try {
      await provider.generate(
        { description: 'Test image', team: 'Seattle Seahawks', aspectRatio: '16:9' },
        join(tempDir, 'test.png'),
      );
      expect(capturedUrl).toContain('key=test-api-key');
      expect(capturedUrl).toContain('generativelanguage.googleapis.com');
      expect(capturedBody.contents[0].parts[0].text).toContain('Test image');
      expect(capturedBody.contents[0].parts[0].text).toContain('Seattle Seahawks');
      expect(capturedBody.generationConfig.responseModalities).toContain('IMAGE');
    } finally {
      globalThis.fetch = originalFetch;
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('throws on API error response', async () => {
    const provider = new GeminiImageProvider('bad-key');
    const tempDir = mkdtempSync(join(tmpdir(), 'nfl-img-gemini-err-'));

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('Unauthorized', { status: 401 });

    try {
      await expect(
        provider.generate({ description: 'fail' }, join(tempDir, 'test.png')),
      ).rejects.toThrow('Gemini API error 401');
    } finally {
      globalThis.fetch = originalFetch;
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('throws when API returns no image data', async () => {
    const provider = new GeminiImageProvider('valid-key');
    const tempDir = mkdtempSync(join(tmpdir(), 'nfl-img-gemini-nodata-'));

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 });

    try {
      await expect(
        provider.generate({ description: 'empty' }, join(tempDir, 'test.png')),
      ).rejects.toThrow('no image data');
    } finally {
      globalThis.fetch = originalFetch;
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('ImageService', () => {
  let tempDir: string;
  let config: ImageGenerationConfig;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nfl-img-svc-'));
    config = { provider: 'stub', outputDir: tempDir };
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // -- Config validation --------------------------------------------------

  it('throws when outputDir is empty', () => {
    expect(() => new ImageService({ provider: 'stub', outputDir: '' })).toThrow(
      'outputDir is required',
    );
  });

  it('throws for an invalid provider name', () => {
    expect(
      () => new ImageService({ provider: 'dalle' as any, outputDir: tempDir }),
    ).toThrow('Invalid provider');
  });

  it('throws when gemini provider has no API key', () => {
    expect(
      () => new ImageService({ provider: 'gemini', outputDir: tempDir }),
    ).toThrow('requires config.apiKey');
  });

  it('throws for unimplemented imagen provider', () => {
    expect(
      () => new ImageService({ provider: 'imagen', outputDir: tempDir, apiKey: 'k' }),
    ).toThrow('not yet implemented');
  });

  // -- Directory structure ------------------------------------------------

  it('creates article slug directory under outputDir', async () => {
    const svc = new ImageService(config);
    await svc.generateCover('my-article', { description: 'Hero shot' });

    expect(existsSync(join(tempDir, 'my-article'))).toBe(true);
  });

  // -- Cover images -------------------------------------------------------

  it('names cover images as {slug}-cover.png', async () => {
    const svc = new ImageService(config);
    const result = await svc.generateCover('seahawks-preview', {
      description: 'Seahawks preview hero',
    });

    expect(result.path).toBe(
      join(tempDir, 'seahawks-preview', 'seahawks-preview-cover.png'),
    );
    expect(existsSync(result.path)).toBe(true);
    expect(isPng(result.path)).toBe(true);
  });

  it('defaults cover images to 16:9', async () => {
    const svc = new ImageService(config);
    const result = await svc.generateCover('test-slug', { description: 'cover' });

    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
  });

  // -- Inline images ------------------------------------------------------

  it('names inline images as {slug}-inline-{n}.png', async () => {
    const svc = new ImageService(config);

    const r1 = await svc.generateInline('my-article', { description: 'chart 1' }, 1);
    const r2 = await svc.generateInline('my-article', { description: 'chart 2' }, 2);

    expect(r1.path).toBe(join(tempDir, 'my-article', 'my-article-inline-1.png'));
    expect(r2.path).toBe(join(tempDir, 'my-article', 'my-article-inline-2.png'));
    expect(existsSync(r1.path)).toBe(true);
    expect(existsSync(r2.path)).toBe(true);
  });

  it('defaults inline index to 1', async () => {
    const svc = new ImageService(config);
    const result = await svc.generateInline('slug', { description: 'inline' });

    expect(result.path).toContain('slug-inline-1.png');
  });

  // -- Batch generation ---------------------------------------------------

  it('generates all requested images in batch', async () => {
    const svc = new ImageService(config);
    const result = await svc.generateArticleImages('batch-test', {
      cover: { description: 'Hero image' },
      inline: [{ description: 'Inline 1' }, { description: 'Inline 2' }],
    });

    expect(result.cover).toBeDefined();
    expect(result.cover!.path).toContain('batch-test-cover.png');
    expect(result.inline).toHaveLength(2);
    expect(result.inline[0].path).toContain('batch-test-inline-1.png');
    expect(result.inline[1].path).toContain('batch-test-inline-2.png');

    // All files exist
    expect(existsSync(result.cover!.path)).toBe(true);
    expect(existsSync(result.inline[0].path)).toBe(true);
    expect(existsSync(result.inline[1].path)).toBe(true);
  });

  it('handles batch with cover only', async () => {
    const svc = new ImageService(config);
    const result = await svc.generateArticleImages('cover-only', {
      cover: { description: 'Just a cover' },
    });

    expect(result.cover).toBeDefined();
    expect(result.inline).toHaveLength(0);
  });

  it('handles batch with inline only', async () => {
    const svc = new ImageService(config);
    const result = await svc.generateArticleImages('inline-only', {
      inline: [{ description: 'Just an inline' }],
    });

    expect(result.cover).toBeUndefined();
    expect(result.inline).toHaveLength(1);
  });

  it('handles batch with no prompts', async () => {
    const svc = new ImageService(config);
    const result = await svc.generateArticleImages('empty', {});

    expect(result.cover).toBeUndefined();
    expect(result.inline).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// extractArticleSummary tests
// ---------------------------------------------------------------------------

describe('extractArticleSummary', () => {
  it('extracts body prose after the title heading', () => {
    const draft = [
      '# The Big Game Recap',
      '',
      '*A thrilling Sunday in the NFL*',
      '',
      'The Kansas City Chiefs dominated the first half with a relentless ground game.',
      'Patrick Mahomes connected on 22 of 28 passes for 310 yards.',
    ].join('\n');

    const summary = extractArticleSummary(draft);
    expect(summary).toContain('Kansas City Chiefs');
    expect(summary).toContain('Patrick Mahomes');
    // Should NOT include the subtitle (italic line)
    expect(summary).not.toContain('thrilling Sunday');
  });

  it('skips editorial preamble before the heading', () => {
    const draft = [
      '**Preflight complete.** Three 🔴 contradicted claims from `panel-factcheck.md` are scrubbed.',
      'DEN pick origin fixed. SF volume narrative preserved.',
      '',
      '# The No-Net Draft: Four Teams, One Thursday',
      '',
      'Houston enters the 2026 draft with legitimate needs at cornerback and edge rusher.',
    ].join('\n');

    const summary = extractArticleSummary(draft);
    expect(summary).toContain('Houston');
    expect(summary).not.toContain('Preflight');
    expect(summary).not.toContain('contradicted');
  });

  it('skips emoji-prefixed editorial lines', () => {
    const draft = [
      '🔴 Wrong team cited for pick',
      '⚠️ Cap figure needs attribution',
      '✅ All player names verified',
      '',
      '# Draft Day Decisions',
      '',
      'Three teams face pivotal choices in the first round.',
    ].join('\n');

    const summary = extractArticleSummary(draft);
    expect(summary).toContain('Three teams');
    expect(summary).not.toContain('Wrong team');
    expect(summary).not.toContain('Cap figure');
  });

  it('falls back to title when no body prose found', () => {
    const draft = '# The Big Game Recap\n\n---\n\n';
    const summary = extractArticleSummary(draft);
    expect(summary).toBe('The Big Game Recap');
  });

  it('handles drafts with no heading by stripping noise', () => {
    const draft = [
      '**Preflight complete.** All checks passed.',
      'The Cowboys secured a dominant victory on Monday Night Football.',
    ].join('\n');

    const summary = extractArticleSummary(draft);
    expect(summary).toContain('Cowboys');
    expect(summary).not.toContain('Preflight');
  });

  it('respects maxLen parameter', () => {
    const draft = '# Title\n\n' + 'A'.repeat(1000);
    const summary = extractArticleSummary(draft, 100);
    expect(summary.length).toBeLessThanOrEqual(100);
  });

  it('skips sub-headings and horizontal rules', () => {
    const draft = [
      '# Main Title',
      '',
      '## Section One',
      '',
      '---',
      '',
      'The actual content starts here with real analysis.',
    ].join('\n');

    const summary = extractArticleSummary(draft);
    expect(summary).toContain('actual content');
    expect(summary).not.toContain('Section One');
  });
});
