import { readFileSync, existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';

// ── Public interfaces ────────────────────────────────────────────────────────

export interface SubstackConfig {
  publicationUrl: string;
  stageUrl?: string;
  token: string;
  notesEndpoint?: string;
}

export interface DraftCreateParams {
  title: string;
  subtitle?: string;
  bodyHtml: string;
  audience?: 'everyone' | 'only_paid';
  tags?: string[];
}

export interface DraftUpdateParams extends Partial<DraftCreateParams> {
  draftId: string;
}

export interface PublishParams {
  draftId: string;
}

export interface NoteParams {
  content: string;
  articleSlug?: string;
  imagePath?: string;
}

export interface SubstackDraft {
  id: string;
  editUrl: string;
  slug: string;
}

export interface SubstackPost {
  id: string;
  slug: string;
  canonicalUrl: string;
  isPublished: boolean;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

const SUBSTACK_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Default Substack Notes endpoint path. */
const DEFAULT_NOTES_ENDPOINT = '/api/v1/comment/feed';

interface DecodedToken {
  substackSid: string;
  connectSid: string;
}

export function decodeSubstackToken(token: string): DecodedToken {
  if (!token || !token.trim()) {
    throw new Error('Missing SUBSTACK_TOKEN.');
  }

  let substackSid: string | null = null;
  let connectSid: string | null = null;

  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    substackSid = decoded.substack_sid || null;
    connectSid = decoded.connect_sid || decoded.substack_sid || null;
  } catch {
    substackSid = null;
    connectSid = null;
  }

  const raw = token.trim();
  return {
    substackSid: substackSid || raw,
    connectSid: connectSid || substackSid || raw,
  };
}

export function extractSubdomain(url: string): string {
  if (!url) {
    throw new Error('Cannot extract Substack subdomain from an empty URL.');
  }
  const match =
    url.match(/https?:\/\/([^.]+)\.substack\.com/i) ||
    url.match(/@(\w+)/i);
  if (match) return match[1];
  throw new Error(
    `Cannot extract subdomain from: "${url}". Expected https://yourpub.substack.com`,
  );
}

function buildHeaders(token: string, subdomain: string): Record<string, string> {
  const { substackSid, connectSid } = decodeSubstackToken(token);
  const origin = `https://${subdomain}.substack.com`;

  return {
    Cookie: `substack.sid=${substackSid}; connect.sid=${connectSid}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': SUBSTACK_USER_AGENT,
    Origin: origin,
    Referer: `${origin}/publish`,
  };
}

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

// ── Service class ────────────────────────────────────────────────────────────

export class SubstackService {
  private readonly config: SubstackConfig;
  private readonly subdomain: string;
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(config: SubstackConfig) {
    this.config = config;
    this.subdomain = extractSubdomain(config.publicationUrl);
    this.baseUrl = `https://${this.subdomain}.substack.com`;
    this.headers = buildHeaders(config.token, this.subdomain);
  }

  // ── Draft management ─────────────────────────────────────────────────────

  async createDraft(params: DraftCreateParams): Promise<SubstackDraft> {
    const payload = {
      type: 'newsletter',
      audience: params.audience || 'everyone',
      draft_title: params.title,
      draft_subtitle: params.subtitle || '',
      draft_body: params.bodyHtml,
      draft_bylines: [],
      postTags: params.tags || [],
    };

    const res = await fetch(`${this.baseUrl}/api/v1/drafts`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Create draft failed: HTTP ${res.status} — ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    return this.toDraft(data);
  }

  async updateDraft(params: DraftUpdateParams): Promise<SubstackDraft> {
    const payload: Record<string, unknown> = {};
    if (params.audience !== undefined) payload.audience = params.audience;
    if (params.title !== undefined) payload.draft_title = params.title;
    if (params.subtitle !== undefined) payload.draft_subtitle = params.subtitle;
    if (params.bodyHtml !== undefined) payload.draft_body = params.bodyHtml;
    if (params.tags !== undefined) payload.postTags = params.tags;

    const res = await fetch(`${this.baseUrl}/api/v1/drafts/${params.draftId}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Update draft failed: HTTP ${res.status} — ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    return this.toDraft(data);
  }

  async publishDraft(params: PublishParams): Promise<SubstackPost> {
    const res = await fetch(
      `${this.baseUrl}/api/v1/drafts/${params.draftId}/publish`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({}),
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Publish draft failed: HTTP ${res.status} — ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    return {
      id: String(data.id),
      slug: (data.slug as string) || '',
      canonicalUrl:
        (data.canonical_url as string) ||
        `${this.baseUrl}/p/${(data.slug as string) || data.id}`,
      isPublished: true,
    };
  }

  // ── Image upload ─────────────────────────────────────────────────────────

  async uploadImage(imagePath: string): Promise<string> {
    const absPath = resolve(imagePath);
    if (!existsSync(absPath)) {
      throw new Error(`Image file not found: ${absPath}`);
    }

    const ext = extname(absPath).toLowerCase();
    const mime = MIME_MAP[ext] || 'image/jpeg';
    const dataUri = `data:${mime};base64,${readFileSync(absPath).toString('base64')}`;

    const res = await fetch(`${this.baseUrl}/api/v1/image`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ image: dataUri }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Image upload failed: HTTP ${res.status} — ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    return data.url as string;
  }

  // ── Notes ────────────────────────────────────────────────────────────────

  async createNote(params: NoteParams): Promise<{ id: string; url: string }> {
    const endpoint = this.config.notesEndpoint || DEFAULT_NOTES_ENDPOINT;

    const attachmentIds: string[] = [];
    if (params.articleSlug) {
      const attachmentId = await this.registerPostAttachment(params.articleSlug);
      if (attachmentId) {
        attachmentIds.push(attachmentId);
      }
    }

    const bodyJson = this.buildNoteBody(params.content);

    const payload: Record<string, unknown> = {
      bodyJson,
      tabId: 'for-you',
      surface: 'feed',
      replyMinimumRole: 'everyone',
    };
    if (attachmentIds.length > 0) {
      payload.attachmentIds = attachmentIds;
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Create note failed: HTTP ${res.status} — ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    const comment = data.comment as Record<string, unknown> | undefined;
    const noteId = String(data.id || comment?.id || '');
    const noteUrl =
      this.findNoteUrl(data) ||
      (noteId ? `${this.baseUrl}/note/c-${noteId}` : '');

    return { id: noteId, url: noteUrl };
  }

  // ── Utility ──────────────────────────────────────────────────────────────

  async getDraft(draftId: string): Promise<SubstackDraft | null> {
    const res = await fetch(`${this.baseUrl}/api/v1/drafts/${draftId}`, {
      method: 'GET',
      headers: this.headers,
    });

    if (res.status === 404) return null;

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Get draft failed: HTTP ${res.status} — ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    return this.toDraft(data);
  }

  /** Resolve the base URL for a given target environment. */
  resolveBaseUrl(target: 'prod' | 'stage'): string {
    if (target === 'stage') {
      if (!this.config.stageUrl) {
        throw new Error('Missing stageUrl in SubstackConfig for stage target.');
      }
      return this.config.stageUrl.replace(/\/+$/, '');
    }
    return this.config.publicationUrl.replace(/\/+$/, '');
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private toDraft(data: Record<string, unknown>): SubstackDraft {
    const id = String(data.id);
    return {
      id,
      editUrl: `${this.baseUrl}/publish/post/${id}`,
      slug: (data.slug as string) || '',
    };
  }

  private buildNoteBody(text: string): Record<string, unknown> {
    return {
      type: 'doc',
      attrs: { schemaVersion: 'v1' },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text }],
        },
      ],
    };
  }

  private async registerPostAttachment(articleSlug: string): Promise<string | null> {
    const articleUrl = `${this.baseUrl}/p/${articleSlug}`;
    const { substackSid } = decodeSubstackToken(this.config.token);

    const res = await fetch(`${this.baseUrl}/api/v1/comment/attachment`, {
      method: 'POST',
      headers: {
        Cookie: `substack.sid=${substackSid}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': SUBSTACK_USER_AGENT,
      },
      body: JSON.stringify({ url: articleUrl, type: 'post' }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Attachment register failed: HTTP ${res.status} — ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    return data.id ? String(data.id) : null;
  }

  private findNoteUrl(data: unknown): string | null {
    const strings: string[] = [];
    this.collectStrings(data, strings);
    for (const candidate of strings) {
      if (/^https?:\/\/.+/i.test(candidate) && candidate.includes('substack.com')) {
        return candidate;
      }
    }
    return null;
  }

  private collectStrings(value: unknown, bucket: string[]): void {
    if (typeof value === 'string') {
      bucket.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) this.collectStrings(item, bucket);
      return;
    }
    if (value && typeof value === 'object') {
      for (const nested of Object.values(value)) this.collectStrings(nested, bucket);
    }
  }
}
