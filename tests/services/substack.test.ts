import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  SubstackService,
  decodeSubstackToken,
  extractSubdomain,
  type SubstackConfig,
  type DraftCreateParams,
  type DraftUpdateParams,
  type NoteParams,
} from '../../src/services/substack.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(overrides?: Partial<SubstackConfig>): SubstackConfig {
  return {
    publicationUrl: 'https://nfllab.substack.com',
    token: 'test-token-abc',
    ...overrides,
  };
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, text = 'Error'): Response {
  return new Response(text, { status });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SubstackService', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ id: 1 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Construction ─────────────────────────────────────────────────────────

  describe('construction', () => {
    it('creates service with valid config', () => {
      const svc = new SubstackService(makeConfig());
      expect(svc).toBeInstanceOf(SubstackService);
    });

    it('throws on empty publication URL', () => {
      expect(() => new SubstackService(makeConfig({ publicationUrl: '' }))).toThrow(
        'Cannot extract Substack subdomain from an empty URL',
      );
    });

    it('throws on invalid publication URL', () => {
      expect(
        () => new SubstackService(makeConfig({ publicationUrl: 'https://example.com' })),
      ).toThrow('Cannot extract subdomain');
    });

    it('throws on empty token', () => {
      expect(() => new SubstackService(makeConfig({ token: '' }))).toThrow(
        'Missing SUBSTACK_TOKEN',
      );
    });
  });

  // ── createDraft ──────────────────────────────────────────────────────────

  describe('createDraft', () => {
    it('sends POST to /api/v1/drafts with correct payload', async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ id: 42, slug: 'test-draft' }),
      );

      const svc = new SubstackService(makeConfig());
      const params: DraftCreateParams = {
        title: 'My Draft',
        subtitle: 'A subtitle',
        bodyHtml: '<p>Hello</p>',
        audience: 'everyone',
        tags: ['Seattle Seahawks'],
      };

      const result = await svc.createDraft(params);

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://nfllab.substack.com/api/v1/drafts');
      expect(opts.method).toBe('POST');

      const body = JSON.parse(opts.body as string);
      expect(body.type).toBe('newsletter');
      expect(body.draft_title).toBe('My Draft');
      expect(body.draft_subtitle).toBe('A subtitle');
      expect(body.draft_body).toBe('<p>Hello</p>');
      expect(body.audience).toBe('everyone');
      expect(body.postTags).toEqual(['Seattle Seahawks']);
      expect(body.draft_bylines).toEqual([]);

      expect(result).toEqual({
        id: '42',
        editUrl: 'https://nfllab.substack.com/publish/post/42',
        slug: 'test-draft',
      });
    });

    it('defaults audience to everyone and tags to empty', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 1, slug: '' }));
      const svc = new SubstackService(makeConfig());
      await svc.createDraft({ title: 'T', bodyHtml: '<p>B</p>' });

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.audience).toBe('everyone');
      expect(body.postTags).toEqual([]);
      expect(body.draft_subtitle).toBe('');
    });

    it('throws on HTTP error', async () => {
      fetchSpy.mockResolvedValueOnce(errorResponse(403, 'Forbidden'));
      const svc = new SubstackService(makeConfig());
      await expect(
        svc.createDraft({ title: 'T', bodyHtml: '<p>B</p>' }),
      ).rejects.toThrow('Create draft failed: HTTP 403');
    });
  });

  // ── updateDraft ──────────────────────────────────────────────────────────

  describe('updateDraft', () => {
    it('sends PUT to /api/v1/drafts/:id', async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ id: 99, slug: 'updated' }),
      );

      const svc = new SubstackService(makeConfig());
      const params: DraftUpdateParams = {
        draftId: '99',
        title: 'Updated Title',
        bodyHtml: '<p>New body</p>',
      };

      const result = await svc.updateDraft(params);

      const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://nfllab.substack.com/api/v1/drafts/99');
      expect(opts.method).toBe('PUT');

      const body = JSON.parse(opts.body as string);
      expect(body.draft_title).toBe('Updated Title');
      expect(body.draft_body).toBe('<p>New body</p>');

      expect(result.id).toBe('99');
    });

    it('only includes provided fields in payload', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 5, slug: '' }));
      const svc = new SubstackService(makeConfig());
      await svc.updateDraft({ draftId: '5', title: 'Only title' });

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.draft_title).toBe('Only title');
      expect(body).not.toHaveProperty('draft_body');
      expect(body).not.toHaveProperty('draft_subtitle');
      expect(body).not.toHaveProperty('audience');
      expect(body).not.toHaveProperty('postTags');
    });

    it('throws on HTTP error', async () => {
      fetchSpy.mockResolvedValueOnce(errorResponse(500, 'Server error'));
      const svc = new SubstackService(makeConfig());
      await expect(
        svc.updateDraft({ draftId: '1', title: 'X' }),
      ).rejects.toThrow('Update draft failed: HTTP 500');
    });
  });

  // ── publishDraft ─────────────────────────────────────────────────────────

  describe('publishDraft', () => {
    it('sends POST to /api/v1/drafts/:id/publish with empty body', async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          id: 7,
          slug: 'my-article',
          canonical_url: 'https://nfllab.substack.com/p/my-article',
        }),
      );

      const svc = new SubstackService(makeConfig());
      const result = await svc.publishDraft({ draftId: '7' });

      const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://nfllab.substack.com/api/v1/drafts/7/publish');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body as string)).toEqual({});

      expect(result).toEqual({
        id: '7',
        slug: 'my-article',
        canonicalUrl: 'https://nfllab.substack.com/p/my-article',
        isPublished: true,
      });
    });

    it('constructs canonical URL from slug when not provided', async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ id: 3, slug: 'fallback-slug' }),
      );
      const svc = new SubstackService(makeConfig());
      const result = await svc.publishDraft({ draftId: '3' });
      expect(result.canonicalUrl).toBe(
        'https://nfllab.substack.com/p/fallback-slug',
      );
    });

    it('throws on HTTP error', async () => {
      fetchSpy.mockResolvedValueOnce(errorResponse(422, 'Cannot publish'));
      const svc = new SubstackService(makeConfig());
      await expect(svc.publishDraft({ draftId: '1' })).rejects.toThrow(
        'Publish draft failed: HTTP 422',
      );
    });
  });

  // ── getDraft ─────────────────────────────────────────────────────────────

  describe('getDraft', () => {
    it('sends GET to /api/v1/drafts/:id', async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ id: 10, slug: 'existing' }),
      );

      const svc = new SubstackService(makeConfig());
      const result = await svc.getDraft('10');

      const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://nfllab.substack.com/api/v1/drafts/10');
      expect(opts.method).toBe('GET');

      expect(result).toEqual({
        id: '10',
        editUrl: 'https://nfllab.substack.com/publish/post/10',
        slug: 'existing',
      });
    });

    it('returns null on 404', async () => {
      fetchSpy.mockResolvedValueOnce(errorResponse(404, 'Not Found'));
      const svc = new SubstackService(makeConfig());
      const result = await svc.getDraft('999');
      expect(result).toBeNull();
    });

    it('throws on non-404 errors', async () => {
      fetchSpy.mockResolvedValueOnce(errorResponse(500, 'Server error'));
      const svc = new SubstackService(makeConfig());
      await expect(svc.getDraft('1')).rejects.toThrow('Get draft failed: HTTP 500');
    });
  });

  // ── uploadImage ──────────────────────────────────────────────────────────

  describe('uploadImage', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `substack-img-test-${Date.now()}`);
      mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('uploads image as base64 data URI and returns CDN URL', async () => {
      const imgPath = join(tempDir, 'hero.png');
      writeFileSync(imgPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ url: 'https://cdn.substack.com/image/abc.png' }),
      );

      const svc = new SubstackService(makeConfig());
      const url = await svc.uploadImage(imgPath);

      expect(url).toBe('https://cdn.substack.com/image/abc.png');

      const [reqUrl, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(reqUrl).toBe('https://nfllab.substack.com/api/v1/image');
      expect(opts.method).toBe('POST');

      const body = JSON.parse(opts.body as string);
      expect(body.image).toMatch(/^data:image\/png;base64,/);
    });

    it('resolves JPEG mime type from .jpg extension', async () => {
      const imgPath = join(tempDir, 'photo.jpg');
      writeFileSync(imgPath, Buffer.from([0xff, 0xd8, 0xff]));

      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ url: 'https://cdn.substack.com/image/jpg.jpg' }),
      );

      const svc = new SubstackService(makeConfig());
      await svc.uploadImage(imgPath);

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.image).toMatch(/^data:image\/jpeg;base64,/);
    });

    it('throws when image file does not exist', async () => {
      const svc = new SubstackService(makeConfig());
      await expect(svc.uploadImage('/nonexistent/img.png')).rejects.toThrow(
        'Image file not found',
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('throws on upload HTTP error', async () => {
      const imgPath = join(tempDir, 'fail.png');
      writeFileSync(imgPath, Buffer.from([0x89, 0x50]));

      fetchSpy.mockResolvedValueOnce(errorResponse(413, 'Too large'));
      const svc = new SubstackService(makeConfig());
      await expect(svc.uploadImage(imgPath)).rejects.toThrow(
        'Image upload failed: HTTP 413',
      );
    });
  });

  // ── createNote ───────────────────────────────────────────────────────────

  describe('createNote', () => {
    const notesConfig = makeConfig({
      notesEndpoint: '/api/v1/notes/create',
    });

    it('sends POST to the notes endpoint with ProseMirror body', async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ id: 501, url: 'https://nfllab.substack.com/note/c-501' }),
      );

      const svc = new SubstackService(notesConfig);
      const params: NoteParams = { content: 'Check out this analysis!' };
      const result = await svc.createNote(params);

      const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://nfllab.substack.com/api/v1/notes/create');
      expect(opts.method).toBe('POST');

      const body = JSON.parse(opts.body as string);
      expect(body.bodyJson).toEqual({
        type: 'doc',
        attrs: { schemaVersion: 'v1' },
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Check out this analysis!' }],
          },
        ],
      });
      expect(body.tabId).toBe('for-you');
      expect(body.surface).toBe('feed');
      expect(body.replyMinimumRole).toBe('everyone');
      expect(body).not.toHaveProperty('attachmentIds');

      expect(result.id).toBe('501');
      expect(result.url).toBe('https://nfllab.substack.com/note/c-501');
    });

    it('registers attachment when articleSlug is provided', async () => {
      // First call: attachment registration
      fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 'att-123' }));
      // Second call: note creation
      fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 502 }));

      const svc = new SubstackService(notesConfig);
      await svc.createNote({ content: 'Read more', articleSlug: 'my-article' });

      // Verify attachment call
      const [attUrl, attOpts] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(attUrl).toBe(
        'https://nfllab.substack.com/api/v1/comment/attachment',
      );
      const attBody = JSON.parse(attOpts.body as string);
      expect(attBody).toEqual({
        url: 'https://nfllab.substack.com/p/my-article',
        type: 'post',
      });

      // Verify note call includes attachmentIds
      const noteBody = JSON.parse(
        (fetchSpy.mock.calls[1][1] as RequestInit).body as string,
      );
      expect(noteBody.attachmentIds).toEqual(['att-123']);
    });

    it('falls back to constructed URL when response has no explicit URL', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ comment: { id: 600 } }));

      const svc = new SubstackService(notesConfig);
      const result = await svc.createNote({ content: 'Fallback test' });

      expect(result.id).toBe('600');
      expect(result.url).toBe('https://nfllab.substack.com/note/c-600');
    });

    it('uses default notesEndpoint when not configured', async () => {
      const svc = new SubstackService(makeConfig());
      const result = await svc.createNote({ content: 'Default endpoint test' });

      expect(result.id).toBe('1');
      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/api/v1/comment/feed');
    });

    it('throws on HTTP error', async () => {
      fetchSpy.mockResolvedValueOnce(errorResponse(401, 'Unauthorized'));
      const svc = new SubstackService(notesConfig);
      await expect(
        svc.createNote({ content: 'Auth fail' }),
      ).rejects.toThrow('Create note failed: HTTP 401');
    });
  });

  // ── URL construction (prod vs stage) ─────────────────────────────────────

  describe('URL construction', () => {
    it('builds prod URLs from publicationUrl', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 1, slug: 's' }));

      const svc = new SubstackService(makeConfig());
      await svc.createDraft({ title: 'T', bodyHtml: '<p>B</p>' });

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('nfllab.substack.com');
    });

    it('resolveBaseUrl returns prod URL by default', () => {
      const svc = new SubstackService(
        makeConfig({ stageUrl: 'https://nfllabstage.substack.com' }),
      );
      expect(svc.resolveBaseUrl('prod')).toBe('https://nfllab.substack.com');
    });

    it('resolveBaseUrl returns stage URL when target is stage', () => {
      const svc = new SubstackService(
        makeConfig({ stageUrl: 'https://nfllabstage.substack.com' }),
      );
      expect(svc.resolveBaseUrl('stage')).toBe(
        'https://nfllabstage.substack.com',
      );
    });

    it('resolveBaseUrl throws when stage URL is missing', () => {
      const svc = new SubstackService(makeConfig());
      expect(() => svc.resolveBaseUrl('stage')).toThrow(
        'Missing stageUrl',
      );
    });

    it('strips trailing slash from resolved URLs', () => {
      const svc = new SubstackService(
        makeConfig({
          publicationUrl: 'https://nfllab.substack.com/',
          stageUrl: 'https://nfllabstage.substack.com/',
        }),
      );
      expect(svc.resolveBaseUrl('prod')).toBe('https://nfllab.substack.com');
      expect(svc.resolveBaseUrl('stage')).toBe(
        'https://nfllabstage.substack.com',
      );
    });
  });

  // ── Auth header construction ─────────────────────────────────────────────

  describe('auth headers', () => {
    it('sends cookie header with raw token', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 1, slug: '' }));
      const svc = new SubstackService(makeConfig({ token: 'my-raw-sid' }));
      await svc.createDraft({ title: 'T', bodyHtml: '<p>B</p>' });

      const headers = (fetchSpy.mock.calls[0][1] as RequestInit)
        .headers as Record<string, string>;
      expect(headers.Cookie).toBe(
        'substack.sid=my-raw-sid; connect.sid=my-raw-sid',
      );
    });

    it('sends cookie header with decoded base64 token', async () => {
      const encoded = Buffer.from(
        JSON.stringify({ substack_sid: 'ss-123', connect_sid: 'cs-456' }),
      ).toString('base64');

      fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 1, slug: '' }));
      const svc = new SubstackService(makeConfig({ token: encoded }));
      await svc.createDraft({ title: 'T', bodyHtml: '<p>B</p>' });

      const headers = (fetchSpy.mock.calls[0][1] as RequestInit)
        .headers as Record<string, string>;
      expect(headers.Cookie).toBe(
        'substack.sid=ss-123; connect.sid=cs-456',
      );
    });

    it('sets Origin and Referer headers for the publication', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 1, slug: '' }));
      const svc = new SubstackService(makeConfig());
      await svc.createDraft({ title: 'T', bodyHtml: '<p>B</p>' });

      const headers = (fetchSpy.mock.calls[0][1] as RequestInit)
        .headers as Record<string, string>;
      expect(headers.Origin).toBe('https://nfllab.substack.com');
      expect(headers.Referer).toBe('https://nfllab.substack.com/publish');
    });

    it('sets User-Agent header', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 1, slug: '' }));
      const svc = new SubstackService(makeConfig());
      await svc.createDraft({ title: 'T', bodyHtml: '<p>B</p>' });

      const headers = (fetchSpy.mock.calls[0][1] as RequestInit)
        .headers as Record<string, string>;
      expect(headers['User-Agent']).toContain('Chrome/131');
    });
  });

  // ── Network error handling ───────────────────────────────────────────────

  describe('network error handling', () => {
    it('propagates fetch network errors', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      const svc = new SubstackService(makeConfig());
      await expect(
        svc.createDraft({ title: 'T', bodyHtml: '<p>B</p>' }),
      ).rejects.toThrow('Failed to fetch');
    });

    it('handles empty error response body gracefully', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response('', { status: 502 }),
      );
      const svc = new SubstackService(makeConfig());
      await expect(
        svc.createDraft({ title: 'T', bodyHtml: '<p>B</p>' }),
      ).rejects.toThrow('Create draft failed: HTTP 502');
    });
  });
});

// ── Standalone helper tests ──────────────────────────────────────────────────

describe('decodeSubstackToken', () => {
  it('returns raw token as both SIDs for plain string', () => {
    const result = decodeSubstackToken('raw-sid-value');
    expect(result.substackSid).toBe('raw-sid-value');
    expect(result.connectSid).toBe('raw-sid-value');
  });

  it('decodes base64 JSON with both SIDs', () => {
    const encoded = Buffer.from(
      JSON.stringify({ substack_sid: 'ss', connect_sid: 'cs' }),
    ).toString('base64');
    const result = decodeSubstackToken(encoded);
    expect(result.substackSid).toBe('ss');
    expect(result.connectSid).toBe('cs');
  });

  it('falls back connect_sid to substack_sid when missing', () => {
    const encoded = Buffer.from(
      JSON.stringify({ substack_sid: 'only-one' }),
    ).toString('base64');
    const result = decodeSubstackToken(encoded);
    expect(result.substackSid).toBe('only-one');
    expect(result.connectSid).toBe('only-one');
  });

  it('throws on empty token', () => {
    expect(() => decodeSubstackToken('')).toThrow('Missing SUBSTACK_TOKEN');
  });

  it('throws on whitespace-only token', () => {
    expect(() => decodeSubstackToken('   ')).toThrow('Missing SUBSTACK_TOKEN');
  });
});

describe('extractSubdomain', () => {
  it('extracts subdomain from standard URL', () => {
    expect(extractSubdomain('https://nfllab.substack.com')).toBe('nfllab');
  });

  it('extracts subdomain from URL with path', () => {
    expect(extractSubdomain('https://myblog.substack.com/publish')).toBe(
      'myblog',
    );
  });

  it('extracts from @mention syntax', () => {
    expect(extractSubdomain('@nfllab')).toBe('nfllab');
  });

  it('throws on empty URL', () => {
    expect(() => extractSubdomain('')).toThrow('empty URL');
  });

  it('throws on non-substack URL without @ prefix', () => {
    expect(() => extractSubdomain('https://example.com')).toThrow(
      'Cannot extract subdomain',
    );
  });
});
