import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  TwitterService,
  TWEET_MAX_LENGTH,
  TCO_URL_LENGTH,
  effectiveTweetLength,
  percentEncode,
} from '../../src/services/twitter.js';
import type { TwitterConfig, OAuthParams } from '../../src/services/twitter.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const TEST_CONFIG: TwitterConfig = {
  apiKey: 'test-consumer-key',
  apiSecret: 'test-consumer-secret',
  accessToken: 'test-access-token',
  accessTokenSecret: 'test-access-token-secret',
};

const KNOWN_OAUTH: OAuthParams = {
  method: 'POST',
  url: 'https://api.twitter.com/2/tweets',
  consumerKey: 'xvz1evFS4wEEPTGEFPHBog',
  consumerSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw',
  token: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
  tokenSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE',
  nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg',
  timestamp: '1318622958',
};

// ── percentEncode ────────────────────────────────────────────────────────────

describe('percentEncode', () => {
  it('encodes RFC 3986 special characters', () => {
    expect(percentEncode('Ladies + Gentlemen')).toBe('Ladies%20%2B%20Gentlemen');
    expect(percentEncode('An encoded string!')).toBe('An%20encoded%20string%21');
    expect(percentEncode("!'()*")).toBe('%21%27%28%29%2A');
  });

  it('leaves unreserved characters untouched', () => {
    expect(percentEncode('abc-._~')).toBe('abc-._~');
    expect(percentEncode('ABC123')).toBe('ABC123');
  });
});

// ── effectiveTweetLength ─────────────────────────────────────────────────────

describe('effectiveTweetLength', () => {
  it('returns plain text length for tweets without URLs', () => {
    expect(effectiveTweetLength('Hello world')).toBe(11);
  });

  it('counts URLs as 23 characters (t.co wrapping)', () => {
    const text = 'Check this out https://example.com/very-long-path/article';
    const urlLen = 'https://example.com/very-long-path/article'.length;
    const expected = text.length + (TCO_URL_LENGTH - urlLen);
    expect(effectiveTweetLength(text)).toBe(expected);
  });

  it('handles multiple URLs', () => {
    const text = 'See https://a.com and https://b.com/long';
    const url1Len = 'https://a.com'.length;
    const url2Len = 'https://b.com/long'.length;
    const expected = text.length + (TCO_URL_LENGTH - url1Len) + (TCO_URL_LENGTH - url2Len);
    expect(effectiveTweetLength(text)).toBe(expected);
  });

  it('returns correct length at exactly 280 characters', () => {
    const text = 'a'.repeat(280);
    expect(effectiveTweetLength(text)).toBe(280);
  });
});

// ── OAuth signature generation ───────────────────────────────────────────────

describe('TwitterService.generateOAuthSignature', () => {
  it('produces a deterministic HMAC-SHA1 signature with known inputs', () => {
    const sig = TwitterService.generateOAuthSignature(KNOWN_OAUTH);

    // Verify by recomputing independently
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: KNOWN_OAUTH.consumerKey,
      oauth_nonce: KNOWN_OAUTH.nonce!,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: KNOWN_OAUTH.timestamp!,
      oauth_token: KNOWN_OAUTH.token,
      oauth_version: '1.0',
    };
    const paramString = Object.keys(oauthParams)
      .sort()
      .map((k) => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
      .join('&');
    const baseString = [
      'POST',
      percentEncode(KNOWN_OAUTH.url),
      percentEncode(paramString),
    ].join('&');
    const signingKey = `${percentEncode(KNOWN_OAUTH.consumerSecret)}&${percentEncode(KNOWN_OAUTH.tokenSecret)}`;
    const expected = createHmac('sha1', signingKey).update(baseString).digest('base64');

    expect(sig).toBe(expected);
  });

  it('produces different signatures for different nonces', () => {
    const sig1 = TwitterService.generateOAuthSignature({ ...KNOWN_OAUTH, nonce: 'aaa' });
    const sig2 = TwitterService.generateOAuthSignature({ ...KNOWN_OAUTH, nonce: 'bbb' });
    expect(sig1).not.toBe(sig2);
  });

  it('includes bodyParams in signature when provided', () => {
    const withBody = TwitterService.generateOAuthSignature({
      ...KNOWN_OAUTH,
      bodyParams: { status: 'Hello' },
    });
    const without = TwitterService.generateOAuthSignature(KNOWN_OAUTH);
    expect(withBody).not.toBe(without);
  });
});

// ── Auth header construction ─────────────────────────────────────────────────

describe('TwitterService.generateAuthHeader', () => {
  it('starts with "OAuth " prefix', () => {
    const header = TwitterService.generateAuthHeader(KNOWN_OAUTH);
    expect(header.startsWith('OAuth ')).toBe(true);
  });

  it('contains all required OAuth parameters', () => {
    const header = TwitterService.generateAuthHeader(KNOWN_OAUTH);
    expect(header).toContain('oauth_consumer_key=');
    expect(header).toContain('oauth_nonce=');
    expect(header).toContain('oauth_signature=');
    expect(header).toContain('oauth_signature_method="HMAC-SHA1"');
    expect(header).toContain('oauth_timestamp=');
    expect(header).toContain('oauth_token=');
    expect(header).toContain('oauth_version="1.0"');
  });

  it('parameters are sorted alphabetically', () => {
    const header = TwitterService.generateAuthHeader(KNOWN_OAUTH);
    const params = header.replace('OAuth ', '').split(', ');
    const keys = params.map((p) => p.split('=')[0]);
    expect(keys).toEqual([...keys].sort());
  });

  it('values are percent-encoded and quoted', () => {
    const header = TwitterService.generateAuthHeader(KNOWN_OAUTH);
    const params = header.replace('OAuth ', '').split(', ');
    for (const param of params) {
      expect(param).toMatch(/^[a-z_]+=".+"$/);
    }
  });
});

// ── Constructor validation ───────────────────────────────────────────────────

describe('TwitterService constructor', () => {
  it('succeeds with valid config', () => {
    expect(() => new TwitterService(TEST_CONFIG)).not.toThrow();
  });

  it('throws when apiKey is missing', () => {
    expect(() => new TwitterService({ ...TEST_CONFIG, apiKey: '' })).toThrow(
      'all credential fields are required',
    );
  });

  it('throws when apiSecret is missing', () => {
    expect(() => new TwitterService({ ...TEST_CONFIG, apiSecret: '' })).toThrow(
      'all credential fields are required',
    );
  });

  it('throws when accessToken is missing', () => {
    expect(() => new TwitterService({ ...TEST_CONFIG, accessToken: '' })).toThrow(
      'all credential fields are required',
    );
  });

  it('throws when accessTokenSecret is missing', () => {
    expect(() => new TwitterService({ ...TEST_CONFIG, accessTokenSecret: '' })).toThrow(
      'all credential fields are required',
    );
  });
});

// ── Tweet text validation ────────────────────────────────────────────────────

describe('postTweet text validation', () => {
  let service: TwitterService;

  beforeEach(() => {
    service = new TwitterService(TEST_CONFIG);
  });

  it('rejects tweets exceeding 280 characters', async () => {
    const longText = 'a'.repeat(281);
    await expect(service.postTweet({ content: longText })).rejects.toThrow(
      `Tweet exceeds ${TWEET_MAX_LENGTH} characters`,
    );
  });

  it('rejects tweets that exceed 280 with URL expansion', async () => {
    // 258 chars text + URL (23 effective) = 281 > 280
    const text = 'a'.repeat(258) + ' https://example.com';
    await expect(service.postTweet({ content: text })).rejects.toThrow(
      `Tweet exceeds ${TWEET_MAX_LENGTH} characters`,
    );
  });

  it('allows tweets at exactly 280 characters', async () => {
    const text = 'a'.repeat(280);
    // Dry run so we don't hit the network
    const result = await service.postTweet({ content: text, dryRun: true });
    expect(result.text).toBe(text);
  });
});

// ── Dry run mode ─────────────────────────────────────────────────────────────

describe('postTweet dry run', () => {
  let service: TwitterService;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    service = new TwitterService(TEST_CONFIG);
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns a fake result without making HTTP calls', async () => {
    const result = await service.postTweet({ content: 'Hello world', dryRun: true });

    expect(result.id).toMatch(/^dry_\d+$/);
    expect(result.url).toContain('https://x.com/i/status/dry_');
    expect(result.text).toBe('Hello world');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ── postTweet network flow ───────────────────────────────────────────────────

describe('postTweet network calls', () => {
  let service: TwitterService;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    service = new TwitterService(TEST_CONFIG);
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('posts a tweet and returns the result', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: '12345', text: 'Hello world' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await service.postTweet({ content: 'Hello world' });

    expect(result.id).toBe('12345');
    expect(result.url).toBe('https://x.com/i/status/12345');
    expect(result.text).toBe('Hello world');
    expect(fetchSpy).toHaveBeenCalledOnce();

    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.twitter.com/2/tweets');
    expect((opts as RequestInit).method).toBe('POST');
    expect(JSON.parse((opts as RequestInit).body as string)).toEqual({ text: 'Hello world' });
  });

  it('throws on HTTP error', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('Rate limit exceeded', { status: 429 }),
    );

    await expect(service.postTweet({ content: 'test' })).rejects.toThrow(
      'Twitter POST /2/tweets HTTP 429',
    );
  });

  it('throws on unexpected response shape', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ errors: [{ message: 'bad' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(service.postTweet({ content: 'test' })).rejects.toThrow(
      'Unexpected tweet response',
    );
  });
});

// ── Media upload ─────────────────────────────────────────────────────────────

describe('uploadMedia', () => {
  let service: TwitterService;
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(() => {
    service = new TwitterService(TEST_CONFIG);
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    tempDir = join(tmpdir(), `twitter-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('uploads an image and returns media_id_string', async () => {
    const imgPath = join(tempDir, 'test.png');
    writeFileSync(imgPath, Buffer.from('fake-png-data'));

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ media_id_string: '9876543210' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const mediaId = await service.uploadMedia(imgPath);
    expect(mediaId).toBe('9876543210');

    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://upload.twitter.com/1.1/media/upload.json');
    expect((opts as RequestInit).method).toBe('POST');

    const contentType = ((opts as RequestInit).headers as Record<string, string>)['Content-Type'];
    expect(contentType).toContain('multipart/form-data');
  });

  it('sends correct MIME type for .jpg files', async () => {
    const imgPath = join(tempDir, 'photo.jpg');
    writeFileSync(imgPath, Buffer.from('fake-jpg'));

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ media_id_string: '111' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await service.uploadMedia(imgPath);

    const body = (fetchSpy.mock.calls[0][1] as RequestInit).body;
    const bodyText = Buffer.isBuffer(body) ? body.toString('utf-8') : String(body);
    expect(bodyText).toContain('image/jpeg');
  });

  it('throws on upload failure', async () => {
    const imgPath = join(tempDir, 'bad.png');
    writeFileSync(imgPath, Buffer.from('data'));

    fetchSpy.mockResolvedValueOnce(
      new Response('Server error', { status: 500 }),
    );

    await expect(service.uploadMedia(imgPath)).rejects.toThrow('Twitter media upload HTTP 500');
  });

  it('throws when media_id_string is missing from response', async () => {
    const imgPath = join(tempDir, 'odd.png');
    writeFileSync(imgPath, Buffer.from('data'));

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'weird' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(service.uploadMedia(imgPath)).rejects.toThrow('No media_id_string');
  });
});

// ── postTweet with image ─────────────────────────────────────────────────────

describe('postTweet with image', () => {
  let service: TwitterService;
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(() => {
    service = new TwitterService(TEST_CONFIG);
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    tempDir = join(tmpdir(), `twitter-img-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('uploads media then posts tweet with media_ids', async () => {
    const imgPath = join(tempDir, 'cover.png');
    writeFileSync(imgPath, Buffer.from('img'));

    // First call: media upload
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ media_id_string: 'media_001' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    // Second call: tweet post
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: 'tw_001', text: 'With image' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await service.postTweet({ content: 'With image', imagePath: imgPath });

    expect(result.id).toBe('tw_001');
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Verify tweet body includes media_ids
    const tweetBody = JSON.parse((fetchSpy.mock.calls[1][1] as RequestInit).body as string);
    expect(tweetBody.media).toEqual({ media_ids: ['media_001'] });
  });
});
