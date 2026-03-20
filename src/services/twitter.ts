import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';

// ── Constants ────────────────────────────────────────────────────────────────

const TWITTER_API_BASE = 'https://api.twitter.com/2';
const TWITTER_UPLOAD_BASE = 'https://upload.twitter.com/1.1';
const TCO_URL_LENGTH = 23;
const TWEET_MAX_LENGTH = 280;

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface TwitterConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export interface TweetParams {
  content: string;
  imagePath?: string;
  dryRun?: boolean;
}

export interface TweetResult {
  id: string;
  url: string;
  text: string;
}

export interface OAuthParams {
  method: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
  nonce?: string;
  timestamp?: string;
  bodyParams?: Record<string, string>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** RFC 3986 percent-encoding (unreserved chars: A-Z a-z 0-9 - . _ ~) */
function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * Estimate the effective length of tweet text after t.co URL wrapping.
 * Every URL counts as 23 characters regardless of actual length.
 */
function effectiveTweetLength(text: string): number {
  const urlPattern = /https?:\/\/[^\s]+/g;
  let length = text.length;
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(text)) !== null) {
    length += TCO_URL_LENGTH - match[0].length;
  }
  return length;
}

// ── TwitterService ───────────────────────────────────────────────────────────

export class TwitterService {
  private readonly config: TwitterConfig;

  constructor(config: TwitterConfig) {
    if (!config.apiKey || !config.apiSecret || !config.accessToken || !config.accessTokenSecret) {
      throw new Error('TwitterService: all credential fields are required');
    }
    this.config = config;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  async postTweet(params: TweetParams): Promise<TweetResult> {
    const { content, imagePath, dryRun } = params;

    if (effectiveTweetLength(content) > TWEET_MAX_LENGTH) {
      throw new Error(
        `Tweet exceeds ${TWEET_MAX_LENGTH} characters (effective length: ${effectiveTweetLength(content)})`,
      );
    }

    if (dryRun) {
      const fakeId = `dry_${Date.now()}`;
      return { id: fakeId, url: `https://x.com/i/status/${fakeId}`, text: content };
    }

    let mediaIds: string[] | undefined;
    if (imagePath) {
      const mediaId = await this.uploadMedia(imagePath);
      mediaIds = [mediaId];
    }

    const url = `${TWITTER_API_BASE}/tweets`;
    const body: Record<string, unknown> = { text: content };
    if (mediaIds && mediaIds.length > 0) {
      body.media = { media_ids: mediaIds };
    }

    const authorization = TwitterService.generateAuthHeader({
      method: 'POST',
      url,
      consumerKey: this.config.apiKey,
      consumerSecret: this.config.apiSecret,
      token: this.config.accessToken,
      tokenSecret: this.config.accessTokenSecret,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
        'User-Agent': 'NFLLab/2.0',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Twitter POST /2/tweets HTTP ${res.status}: ${errText.slice(0, 500)}`);
    }

    const data = (await res.json()) as { data?: { id?: string; text?: string } };
    const tweetId = data?.data?.id;
    if (!tweetId) {
      throw new Error(`Unexpected tweet response: ${JSON.stringify(data).slice(0, 300)}`);
    }

    return {
      id: tweetId,
      url: `https://x.com/i/status/${tweetId}`,
      text: data.data?.text ?? content,
    };
  }

  async uploadMedia(imagePath: string): Promise<string> {
    const absPath = resolve(imagePath);
    const ext = extname(absPath).toLowerCase();
    const mimeType = MIME_BY_EXT[ext] ?? 'application/octet-stream';
    const mediaData = readFileSync(absPath).toString('base64');

    const url = `${TWITTER_UPLOAD_BASE}/media/upload.json`;

    const authorization = TwitterService.generateAuthHeader({
      method: 'POST',
      url,
      consumerKey: this.config.apiKey,
      consumerSecret: this.config.apiSecret,
      token: this.config.accessToken,
      tokenSecret: this.config.accessTokenSecret,
    });

    const boundary = `----NFLLab${randomBytes(12).toString('hex')}`;
    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="media_data"\r\n\r\n${mediaData}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="media_type"\r\n\r\n${mimeType}\r\n`,
      `--${boundary}--\r\n`,
    ];
    const bodyBuffer = Buffer.from(parts.join(''), 'utf-8');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length.toString(),
        'User-Agent': 'NFLLab/2.0',
      },
      body: bodyBuffer,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Twitter media upload HTTP ${res.status}: ${errText.slice(0, 500)}`);
    }

    const data = (await res.json()) as { media_id_string?: string };
    const mediaIdString = data?.media_id_string;
    if (!mediaIdString) {
      throw new Error(`No media_id_string in response: ${JSON.stringify(data).slice(0, 300)}`);
    }

    return mediaIdString;
  }

  // ── OAuth 1.0a (RFC 5849, HMAC-SHA1) ────────────────────────────────────

  static generateOAuthSignature(params: OAuthParams): string {
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: params.consumerKey,
      oauth_nonce: params.nonce ?? randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: params.timestamp ?? Math.floor(Date.now() / 1000).toString(),
      oauth_token: params.token,
      oauth_version: '1.0',
    };

    const sigParams = { ...oauthParams, ...(params.bodyParams ?? {}) };

    const paramString = Object.keys(sigParams)
      .sort()
      .map((k) => `${percentEncode(k)}=${percentEncode(sigParams[k])}`)
      .join('&');

    const baseString = [
      params.method.toUpperCase(),
      percentEncode(params.url),
      percentEncode(paramString),
    ].join('&');

    const signingKey = `${percentEncode(params.consumerSecret)}&${percentEncode(params.tokenSecret)}`;

    return createHmac('sha1', signingKey).update(baseString).digest('base64');
  }

  static generateAuthHeader(params: OAuthParams): string {
    const nonce = params.nonce ?? randomBytes(16).toString('hex');
    const timestamp = params.timestamp ?? Math.floor(Date.now() / 1000).toString();

    const fixedParams: OAuthParams = { ...params, nonce, timestamp };
    const signature = TwitterService.generateOAuthSignature(fixedParams);

    const oauthEntries: Record<string, string> = {
      oauth_consumer_key: fixedParams.consumerKey,
      oauth_nonce: nonce,
      oauth_signature: signature,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: fixedParams.token,
      oauth_version: '1.0',
    };

    const header = Object.keys(oauthEntries)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(oauthEntries[k])}"`)
      .join(', ');

    return `OAuth ${header}`;
  }
}

// ── Exported helpers ─────────────────────────────────────────────────────────

export { TWEET_MAX_LENGTH, TCO_URL_LENGTH, effectiveTweetLength, percentEncode };
