import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv } from "./substack-session.mjs";

const TWITTER_API_BASE = "https://api.twitter.com/2";
const TWITTER_UPLOAD_BASE = "https://upload.twitter.com/1.1";
const TCO_URL_LENGTH = 23;
const TWEET_MAX_LENGTH = 280;

const REQUIRED_KEYS = [
    "TWITTER_API_KEY",
    "TWITTER_API_SECRET",
    "TWITTER_ACCESS_TOKEN",
    "TWITTER_ACCESS_TOKEN_SECRET",
];

// RFC 3986 percent-encoding (unreserved chars: A-Z a-z 0-9 - . _ ~)
function percentEncode(str) {
    return encodeURIComponent(str).replace(/[!'()*]/g, (c) =>
        `%${c.charCodeAt(0).toString(16).toUpperCase()}`
    );
}

// ── Credentials ──────────────────────────────────────────────────────────────

export function loadTwitterCredentials(repoRoot) {
    const env = loadEnv(repoRoot);
    const missing = REQUIRED_KEYS.filter(
        (k) => !process.env[k] && !env[k]
    );

    return {
        valid: missing.length === 0,
        missing,
        apiKey: process.env.TWITTER_API_KEY || env.TWITTER_API_KEY || "",
        apiSecret: process.env.TWITTER_API_SECRET || env.TWITTER_API_SECRET || "",
        accessToken: process.env.TWITTER_ACCESS_TOKEN || env.TWITTER_ACCESS_TOKEN || "",
        accessTokenSecret:
            process.env.TWITTER_ACCESS_TOKEN_SECRET || env.TWITTER_ACCESS_TOKEN_SECRET || "",
    };
}

// ── OAuth 1.0a (RFC 5849, HMAC-SHA1) ────────────────────────────────────────

export function buildOAuth1Header({ method, url, creds, bodyParams = {} }) {
    const oauthParams = {
        oauth_consumer_key: creds.apiKey,
        oauth_nonce: randomBytes(16).toString("hex"),
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_token: creds.accessToken,
        oauth_version: "1.0",
    };

    // Collect all params for the signature base string.
    // For JSON-body requests bodyParams will be empty — only OAuth params are signed.
    const sigParams = { ...oauthParams, ...bodyParams };

    const paramString = Object.keys(sigParams)
        .sort()
        .map((k) => `${percentEncode(k)}=${percentEncode(sigParams[k])}`)
        .join("&");

    const baseString = [
        method.toUpperCase(),
        percentEncode(url),
        percentEncode(paramString),
    ].join("&");

    const signingKey = `${percentEncode(creds.apiSecret)}&${percentEncode(creds.accessTokenSecret)}`;
    const signature = createHmac("sha1", signingKey)
        .update(baseString)
        .digest("base64");

    oauthParams.oauth_signature = signature;

    const header = Object.keys(oauthParams)
        .sort()
        .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
        .join(", ");

    return `OAuth ${header}`;
}

// ── Tweet posting (v2) ───────────────────────────────────────────────────────

export async function postTweet({ text, creds, mediaIds = [] }) {
    const url = `${TWITTER_API_BASE}/tweets`;
    const body = { text };
    if (mediaIds.length > 0) {
        body.media = { media_ids: mediaIds };
    }

    // JSON body — no body params in signature base string
    const authorization = buildOAuth1Header({ method: "POST", url, creds });

    const res = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: authorization,
            "Content-Type": "application/json",
            "User-Agent": "NFLLab/1.0",
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Twitter POST /2/tweets HTTP ${res.status}: ${errText.slice(0, 500)}`);
    }

    const data = await res.json();
    const tweetId = data?.data?.id;
    if (!tweetId) {
        throw new Error(`Unexpected tweet response: ${JSON.stringify(data).slice(0, 300)}`);
    }

    return {
        tweetId,
        tweetUrl: `https://x.com/i/status/${tweetId}`,
        text: data.data.text || text,
    };
}

// ── Media upload (v1.1) ──────────────────────────────────────────────────────

const MIME_BY_EXT = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
};

export async function uploadMediaForTweet(imagePath, creds) {
    const absPath = resolve(imagePath);
    const ext = absPath.slice(absPath.lastIndexOf(".")).toLowerCase();
    const mimeType = MIME_BY_EXT[ext] || "application/octet-stream";
    const mediaData = readFileSync(absPath).toString("base64");

    const url = `${TWITTER_UPLOAD_BASE}/media/upload.json`;

    // Sign with only OAuth params (no body params) — safe for large media payloads.
    const authorization = buildOAuth1Header({ method: "POST", url, creds });

    // Build multipart/form-data manually using built-in APIs
    const boundary = `----NFLLab${randomBytes(12).toString("hex")}`;
    const parts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="media_data"\r\n\r\n${mediaData}\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="media_type"\r\n\r\n${mimeType}\r\n`,
        `--${boundary}--\r\n`,
    ];
    const bodyBuffer = Buffer.from(parts.join(""), "utf-8");

    const res = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: authorization,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "Content-Length": bodyBuffer.length.toString(),
            "User-Agent": "NFLLab/1.0",
        },
        body: bodyBuffer,
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Twitter media upload HTTP ${res.status}: ${errText.slice(0, 500)}`);
    }

    const data = await res.json();
    const mediaIdString = data?.media_id_string;
    if (!mediaIdString) {
        throw new Error(`No media_id_string in response: ${JSON.stringify(data).slice(0, 300)}`);
    }

    return mediaIdString;
}

// ── Tweet text builder ───────────────────────────────────────────────────────

export function buildPromotionTweetText(subtitle, articleUrl) {
    const url = String(articleUrl || "").trim();
    // Twitter wraps every URL in a t.co link (23 chars) + newlines separator
    const urlCost = url ? TCO_URL_LENGTH : 0;
    const separatorCost = url ? 2 : 0; // "\n\n"
    const maxSubtitle = TWEET_MAX_LENGTH - urlCost - separatorCost;

    let text = String(subtitle || "").trim();
    if (text.length > maxSubtitle) {
        text = text.slice(0, maxSubtitle - 1) + "\u2026"; // ellipsis
    }

    return url ? `${text}\n\n${url}` : text;
}
