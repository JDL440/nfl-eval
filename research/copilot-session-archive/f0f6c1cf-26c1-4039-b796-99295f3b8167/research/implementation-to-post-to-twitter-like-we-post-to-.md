# Implementation Plan: Twitter/X Posting — Mirroring the Substack Notes Architecture

## Executive Summary

This report provides a complete implementation blueprint for adding Twitter/X posting as a promotion channel alongside the existing Substack Notes system in the nfl-eval repository. The current Notes architecture is well-structured and extensible — it uses an MCP tool definition + handler pattern, Playwright-based browser sessions for Cloudflare bypass, ProseMirror JSON payloads, pipeline.db tracking, and a dashboard UI with selectable promotion channels. Twitter/X posting can follow this exact pattern with one critical difference: **Twitter requires OAuth 1.0a authentication** (not session cookies), and the API is a public REST endpoint that doesn't need Playwright browser automation. The Free tier of the X API allows 500 tweets/month at $0, which is more than sufficient for article promotion. Implementation touches 7 files across 4 layers (shared lib, extension, MCP server, dashboard).

## Confidence Assessment

| Aspect | Confidence | Notes |
|--------|------------|-------|
| Current Notes architecture understanding | ✅ High | Full source code read of all layers |
| X API v2 tweet creation endpoint | ✅ High | Well-documented public API, verified via multiple sources |
| OAuth 1.0a for server-side posting | ✅ High | Industry-standard, only viable server-side auth for tweet writes |
| Free tier sufficiency (500 tweets/month) | ✅ High | NFL Lab publishes ~4-8 articles/month; well within limits |
| Media upload via v2 `/2/media/upload` | ⚠️ Medium | v2 media endpoint recently replaced v1.1; docs still evolving |
| Link card unfurling behavior | ⚠️ Medium | X auto-unfurls URLs but has reduced title/description display since 2024 |
| OAuth 2.0 PKCE as alternative | ❌ Not viable | Requires interactive user login; OAuth 1.0a is the only headless server-side option |

---

## Architecture Overview: How Notes Works Today

Before designing the Twitter integration, here's the full anatomy of the existing Notes system, which serves as the template.

```
┌─────────────────────────────────────────────────────────────────┐
│                     ENTRY POINTS                                 │
│                                                                  │
│  MCP Tool Call           Dashboard UI          Batch Script      │
│  (Copilot CLI)           (browser)             (publish-prod-    │
│                                                 notes.mjs)       │
└───────┬───────────────────┬───────────────────────┬──────────────┘
        │                   │                       │
        ▼                   ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│               EXTENSION LAYER (tool.mjs)                         │
│                                                                  │
│  publishNoteToSubstackTool  ← tool definition (schema)          │
│  handlePublishNoteToSubstack ← handler (orchestration)          │
│    • validates inputs                                            │
│    • looks up article URL from pipeline.db                       │
│    • builds ProseMirror body                                     │
│    • registers post attachment                                   │
│    • calls createSubstackNote()                                  │
│    • returns success/failure with writeback instructions          │
└───────┬──────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│               SHARED LIBRARY LAYER                               │
│                                                                  │
│  shared/substack-notes.mjs                                       │
│    • buildSubtitleCardNoteBody()  ← ProseMirror doc builder     │
│    • registerPostAttachment()     ← POST /api/v1/comment/attach │
│    • createSubstackNote()         ← Playwright browser POST     │
│    • extractNoteInfo()            ← parse response              │
│                                                                  │
│  shared/substack-session.mjs                                     │
│    • decodeSubstackToken()        ← cookie auth                 │
│    • buildSubstackCookies()       ← Playwright cookie injection │
│    • createSubstackBrowserSession() ← headless Chrome           │
└──────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│               MCP SERVER (mcp/server.mjs)                        │
│                                                                  │
│  Registers tool with Zod schema                                  │
│  Normalizes handler result → MCP content format                  │
└──────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│               DASHBOARD (dashboard/publish.mjs)                  │
│                                                                  │
│  normalizeRequestedChannels() ← whitelist filter                 │
│  buildPublishState()          ← promotionChannels config         │
│  runPublishWorkflow()         ← orchestrates publish + channels  │
│  dashboard/templates.mjs      ← UI checkbox for channel          │
└──────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│               PIPELINE DB (content/pipeline.db)                  │
│                                                                  │
│  `notes` table ← records all Notes with metadata                 │
│  pipeline_state.py ← Python wrapper for ACID writes              │
└──────────────────────────────────────────────────────────────────┘
```

### Key Files & Line References

| Layer | File | Key Lines | Purpose |
|-------|------|-----------|---------|
| Tool definition | `.github/extensions/substack-publisher/tool.mjs` | 638-680[^1] | `publishNoteToSubstackTool` schema |
| Tool handler | `.github/extensions/substack-publisher/tool.mjs` | 930-1108[^2] | `handlePublishNoteToSubstack` orchestration |
| ProseMirror builder | `.github/extensions/substack-publisher/tool.mjs` | 370-408[^3] | `noteTextToProseMirror` + `parseNoteInline` |
| Attachment registration | `.github/extensions/substack-publisher/tool.mjs` | 419-444[^4] | `registerPostAttachment` via fetch |
| Note creation | `.github/extensions/substack-publisher/tool.mjs` | 462-556[^5] | `createSubstackNote` via Playwright |
| Shared Notes lib | `shared/substack-notes.mjs` | 1-148[^6] | Reusable Notes functions for dashboard |
| Auth/session | `shared/substack-session.mjs` | 54-184[^7] | Token decode, cookie build, browser session |
| MCP registration | `mcp/server.mjs` | 98-106[^8] | Tool wiring with Zod schemas |
| Dashboard publish | `dashboard/publish.mjs` | 288-460[^9] | Workflow with channel orchestration |
| Dashboard state | `dashboard/data.mjs` | 148-211[^10] | `buildPublishState` with promotionChannels |
| Dashboard UI | `dashboard/templates.mjs` | 431-466[^11] | Channel checkbox rendering |
| Channel filter | `dashboard/publish.mjs` | 269-276[^12] | `normalizeRequestedChannels` whitelist |
| Env config | `.env.example` | 1-30[^13] | Environment variable documentation |

---

## Twitter/X API: Technical Requirements

### Authentication: OAuth 1.0a (Only Viable Option for Server-Side Posting)

Twitter/X requires **user-context authentication** to create tweets. The options are[^14]:

| Auth Method | Can Post Tweets? | Server-Side (No User Interaction)? | Recommended? |
|-------------|------------------|------------------------------------|--------------|
| OAuth 2.0 Client Credentials | ❌ No | ✅ Yes | ❌ Read-only |
| OAuth 2.0 Auth Code (PKCE) | ✅ Yes | ❌ Requires browser login | ❌ Not for automation |
| **OAuth 1.0a User Context** | ✅ Yes | ✅ Yes (after one-time setup) | ✅ **Use this** |

**OAuth 1.0a** requires four credentials obtained once during initial setup[^15]:
1. `TWITTER_API_KEY` (Consumer Key) — from X Developer Portal
2. `TWITTER_API_SECRET` (Consumer Secret) — from X Developer Portal
3. `TWITTER_ACCESS_TOKEN` — generated for your account
4. `TWITTER_ACCESS_TOKEN_SECRET` — generated for your account

After one-time setup, these four values enable unlimited server-side posting with no user interaction needed — exactly like how `SUBSTACK_TOKEN` works today.

### API Endpoints

**Create Tweet:**
```
POST https://api.twitter.com/2/tweets
Authorization: OAuth 1.0a signature
Content-Type: application/json

{
  "text": "Article teaser text\n\nhttps://nfllab.substack.com/p/article-slug"
}
```
Response:
```json
{
  "data": {
    "id": "1234567890",
    "text": "Article teaser text..."
  }
}
```

**Upload Media (for cover image):**
```
POST https://api.twitter.com/2/media/upload
Authorization: OAuth 1.0a signature
Content-Type: multipart/form-data

media: <binary image data>
media_type: image/png
```
Response:
```json
{
  "media_id": "1234567890123456789"
}
```

**Tweet with Media:**
```json
{
  "text": "Teaser text",
  "media": {
    "media_ids": ["1234567890123456789"]
  }
}
```

### Pricing & Rate Limits[^16]

| Plan | Cost | Tweet Write Limit | Sufficient for NFL Lab? |
|------|------|-------------------|------------------------|
| **Free** | **$0/month** | **500/month** | **✅ Yes** (~4-8 articles/month) |
| Basic | $200/month | 3,000/month | Overkill |
| Pro | $5,000/month | 1,000,000/month | Way overkill |

### Link Preview / Card Behavior[^17]

When a tweet contains a URL, X auto-generates a link card preview using Open Graph meta tags from the linked page. Substack articles already have proper OG tags, so article links will automatically display with:
- Hero image (from `og:image`)
- Title (from `og:title`) — *note: X has reduced title display in 2024-2025*
- Publication info

**No additional API parameters are needed** for link cards — just include the URL in the tweet text.

---

## Proposed Architecture: Twitter as a Parallel Channel

```
┌─────────────────────────────────────────────────────────────────┐
│                   PROMOTION CHANNELS                             │
│                                                                  │
│  ┌─────────────────────┐    ┌─────────────────────┐             │
│  │   Substack Notes    │    │     Twitter/X        │  ← NEW     │
│  │   (existing)        │    │     (proposed)       │             │
│  │                     │    │                      │             │
│  │  Uses: Playwright   │    │  Uses: OAuth 1.0a    │             │
│  │  Auth: Cookie-based │    │  Auth: 4-token OAuth │             │
│  │  API: /comment/feed │    │  API: /2/tweets      │             │
│  │  Body: ProseMirror  │    │  Body: Plain text    │             │
│  └─────────────────────┘    └──────────────────────┘             │
│                                                                  │
│           Both controlled by dashboard channel checkboxes        │
│           Both recorded in pipeline.db `notes` table             │
│           Both exposed as MCP tools                              │
└──────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **No Playwright needed** — X API v2 is a standard REST API with OAuth 1.0a signatures. Unlike Substack (which requires Playwright to bypass Cloudflare), Twitter accepts direct `fetch()` calls.

2. **Reuse the `notes` table** — Record tweets in the same `notes` table with `note_type = "twitter_promotion"` and `target = "prod"`. The existing `substack_note_url` column becomes `note_url` (or add a `twitter_tweet_url` column).

3. **Same teaser copy pattern** — Use the article subtitle as teaser text (same as Notes), with the published article URL appended. Twitter will auto-unfurl the Substack link into a card.

4. **Optional cover image upload** — Upload the article's cover image to Twitter and attach it to the tweet for maximum visual impact, since X has reduced link card previews.

---

## Implementation Plan: File-by-File

### Layer 1: Shared Library — `shared/twitter-client.mjs` (NEW)

This mirrors `shared/substack-notes.mjs` — a pure library with no MCP/extension dependencies.

```javascript
// shared/twitter-client.mjs
// Twitter/X API v2 client using OAuth 1.0a for server-side posting.

import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { loadEnv } from "./substack-session.mjs";

/**
 * Load Twitter credentials from .env.
 * Required: TWITTER_API_KEY, TWITTER_API_SECRET,
 *           TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET
 */
export function loadTwitterCredentials(repoRoot) {
    const env = loadEnv(repoRoot);
    const creds = {
        apiKey:            process.env.TWITTER_API_KEY            || env.TWITTER_API_KEY,
        apiSecret:         process.env.TWITTER_API_SECRET         || env.TWITTER_API_SECRET,
        accessToken:       process.env.TWITTER_ACCESS_TOKEN       || env.TWITTER_ACCESS_TOKEN,
        accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET || env.TWITTER_ACCESS_TOKEN_SECRET,
    };

    const missing = Object.entries(creds)
        .filter(([, v]) => !v)
        .map(([k]) => k);

    if (missing.length > 0) {
        return { valid: false, missing, ...creds };
    }
    return { valid: true, missing: [], ...creds };
}

/**
 * Generate OAuth 1.0a Authorization header for a request.
 * Implements RFC 5849 signature base string + HMAC-SHA1.
 */
export function buildOAuth1Header({ method, url, creds, body = null }) {
    const oauthParams = {
        oauth_consumer_key: creds.apiKey,
        oauth_nonce: randomBytes(16).toString("hex"),
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_token: creds.accessToken,
        oauth_version: "1.0",
    };

    // Collect all params for signature base string
    const allParams = { ...oauthParams };
    // For JSON body requests, body params are NOT included in signature base

    const paramString = Object.keys(allParams)
        .sort()
        .map(k => `${encodeRFC3986(k)}=${encodeRFC3986(allParams[k])}`)
        .join("&");

    const baseString = [
        method.toUpperCase(),
        encodeRFC3986(url),
        encodeRFC3986(paramString),
    ].join("&");

    const signingKey = `${encodeRFC3986(creds.apiSecret)}&${encodeRFC3986(creds.accessTokenSecret)}`;
    const signature = createHmac("sha1", signingKey)
        .update(baseString)
        .digest("base64");

    oauthParams.oauth_signature = signature;

    const header = "OAuth " + Object.keys(oauthParams)
        .sort()
        .map(k => `${encodeRFC3986(k)}="${encodeRFC3986(oauthParams[k])}"`)
        .join(", ");

    return header;
}

function encodeRFC3986(str) {
    return encodeURIComponent(String(str))
        .replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * Post a tweet via X API v2.
 *
 * @param {object} opts
 * @param {string} opts.text - Tweet body (max 280 chars)
 * @param {object} opts.creds - OAuth 1.0a credentials
 * @param {string[]} [opts.mediaIds] - Optional uploaded media IDs
 * @returns {{ tweetId: string, tweetUrl: string, text: string }}
 */
export async function postTweet({ text, creds, mediaIds = [] }) {
    const url = "https://api.twitter.com/2/tweets";
    const payload = { text };
    if (mediaIds.length > 0) {
        payload.media = { media_ids: mediaIds };
    }

    const authHeader = buildOAuth1Header({ method: "POST", url, creds });

    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
            "User-Agent": "NFLLab/1.0",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Twitter POST /2/tweets HTTP ${response.status}: ${errorText.slice(0, 300)}`);
    }

    const data = await response.json();
    const tweetId = data.data?.id;
    // Twitter username needed for URL — derive from auth or hardcode
    const tweetUrl = tweetId
        ? `https://x.com/i/status/${tweetId}`
        : null;

    return { tweetId, tweetUrl, text: data.data?.text || text };
}

/**
 * Upload an image to Twitter for attachment to a tweet.
 *
 * @param {string} imagePath - Absolute path to local image file
 * @param {object} creds - OAuth 1.0a credentials
 * @returns {string} media_id for use in postTweet({ mediaIds })
 */
export async function uploadMediaForTweet(imagePath, creds) {
    const mimeMap = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
    };
    const ext = extname(imagePath).toLowerCase();
    const mediaType = mimeMap[ext] || "image/jpeg";

    const imageData = readFileSync(imagePath);
    const base64 = imageData.toString("base64");

    // v2 media upload (replaces v1.1 after March 2025)
    const url = "https://api.twitter.com/2/media/upload";
    const authHeader = buildOAuth1Header({ method: "POST", url, creds });

    const formData = new FormData();
    formData.append("media_data", base64);
    formData.append("media_type", mediaType);

    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: authHeader,
            "User-Agent": "NFLLab/1.0",
        },
        body: formData,
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Twitter media upload HTTP ${response.status}: ${errorText.slice(0, 300)}`);
    }

    const data = await response.json();
    return data.media_id || data.media_id_string;
}

/**
 * Build tweet text for an article promotion.
 * Format: subtitle text + newline + article URL.
 * Respects 280-char limit (URLs count as 23 chars per Twitter's t.co).
 */
export function buildPromotionTweetText(subtitle, articleUrl) {
    const url = String(articleUrl || "").trim();
    const text = String(subtitle || "").trim();
    if (!text && !url) throw new Error("Tweet text cannot be empty.");

    // Twitter counts t.co-wrapped URLs as 23 chars
    const T_CO_LENGTH = 23;
    const maxTextLength = 280 - T_CO_LENGTH - 2; // 2 for \n\n separator

    const truncatedText = text.length > maxTextLength
        ? text.slice(0, maxTextLength - 1) + "…"
        : text;

    return url
        ? `${truncatedText}\n\n${url}`
        : truncatedText;
}
```

### Layer 2: Extension Tool Definition — Add to `tool.mjs`

Add the new tool definition alongside `publishNoteToSubstackTool`:

```javascript
// Add after publishNoteToSubstackTool (line ~680 in tool.mjs)

export const publishTweetTool = {
    name: "publish_tweet",
    description:
        "Posts a tweet to X (Twitter) to promote an article. " +
        "Uses OAuth 1.0a credentials from .env (TWITTER_API_KEY, TWITTER_API_SECRET, " +
        "TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET). " +
        "If article_slug is provided, auto-links to the published article URL. " +
        "Defaults to PROD target. X will auto-unfurl the Substack URL into a link card.",
    parameters: {
        type: "object",
        properties: {
            content: {
                type: "string",
                description:
                    "Tweet body text. Plain text, max 280 characters " +
                    "(URLs count as 23 chars). Keep concise for engagement.",
            },
            image_path: {
                type: "string",
                description:
                    "Optional path to a local image file to attach to the tweet. " +
                    "Uploaded to Twitter via the media upload endpoint.",
            },
            article_slug: {
                type: "string",
                description:
                    "Optional article slug (pipeline.db id) to link this tweet to. " +
                    "If provided, the published article URL is looked up from pipeline.db " +
                    "and appended to the tweet text.",
            },
            target: {
                type: "string",
                description: '"prod" (default) or "stage". Stage is a dry-run (no actual tweet).',
                enum: ["stage", "prod"],
            },
        },
        required: ["content"],
    },
};
```

### Layer 2b: Extension Handler — Add `handlePublishTweet`

```javascript
// Add after handlePublishNoteToSubstack in tool.mjs

export async function handlePublishTweet(args, context = {}) {
    const log = createToolLogger(context);

    try {
        const { loadTwitterCredentials, postTweet, uploadMediaForTweet, buildPromotionTweetText }
            = await import("../../../shared/twitter-client.mjs");

        const creds = loadTwitterCredentials(process.cwd());
        if (!creds.valid) {
            return {
                textResultForLlm:
                    `Error: Missing Twitter credentials in .env: ${creds.missing.join(", ")}.\n\n` +
                    "Setup:\n" +
                    "  1. Go to https://developer.x.com/portal/dashboard\n" +
                    "  2. Create a project + app with Read and Write permissions\n" +
                    "  3. Generate OAuth 1.0a tokens\n" +
                    "  4. Add to .env:\n" +
                    "     TWITTER_API_KEY=<consumer key>\n" +
                    "     TWITTER_API_SECRET=<consumer secret>\n" +
                    "     TWITTER_ACCESS_TOKEN=<access token>\n" +
                    "     TWITTER_ACCESS_TOKEN_SECRET=<access token secret>",
                resultType: "failure",
            };
        }

        const target = args.target || "prod";

        // Look up article URL if slug provided
        let linkedArticleUrl = null;
        if (args.article_slug) {
            const articleInfo = await lookupArticleUrlFromDb(args.article_slug, process.cwd());
            if (!articleInfo?.substackUrl) {
                return {
                    textResultForLlm:
                        `Error: Article '${args.article_slug}' has no published URL. ` +
                        "Publish the article first, or omit article_slug for a standalone tweet.",
                    resultType: "failure",
                };
            }
            linkedArticleUrl = articleInfo.substackUrl;
            await log(`Linked article URL: ${linkedArticleUrl}`);
        }

        if (!args.content?.trim()) {
            return {
                textResultForLlm: "Error: Tweet content cannot be empty.",
                resultType: "failure",
            };
        }

        const tweetText = linkedArticleUrl
            ? buildPromotionTweetText(args.content, linkedArticleUrl)
            : args.content.trim();

        if (tweetText.length > 280) {
            await log(`⚠️ Tweet text is ${tweetText.length} chars — will be auto-truncated by Twitter.`);
        }

        // Stage = dry-run
        if (target === "stage") {
            return (
                `🟡 DRY-RUN — Tweet NOT sent (target=stage)\n\n` +
                `**Tweet text (${tweetText.length} chars):**\n${tweetText}\n` +
                (linkedArticleUrl ? `**Linked article:** ${linkedArticleUrl}\n` : "") +
                (args.image_path ? `**Image:** ${args.image_path}\n` : "")
            );
        }

        // Upload image if provided
        const mediaIds = [];
        if (args.image_path) {
            const absPath = /^([A-Za-z]:[\\/]|\/)/.test(args.image_path)
                ? args.image_path
                : resolve(process.cwd(), args.image_path);
            if (!existsSync(absPath)) {
                return {
                    textResultForLlm: `Error: Image file not found: ${absPath}`,
                    resultType: "failure",
                };
            }
            await log("Uploading image to Twitter…");
            const mediaId = await uploadMediaForTweet(absPath, creds);
            mediaIds.push(mediaId);
            await log(`Media uploaded: ${mediaId}`);
        }

        // Post the tweet
        await log("Posting tweet…");
        const result = await postTweet({ text: tweetText, creds, mediaIds });

        const noteType = args.article_slug ? "twitter_promotion" : "twitter_standalone";
        const writebackBlock =
            `\n**⚡ DB Writeback required (record tweet):**\n` +
            "```python\n" +
            `from content.pipeline_state import PipelineState\n` +
            `with PipelineState() as ps:\n` +
            `    ps.record_note(` +
            `${args.article_slug ? `'${args.article_slug}'` : "None"}, ` +
            `'${noteType}', ` +
            `${JSON.stringify(tweetText)}, ` +
            `${result.tweetUrl ? JSON.stringify(result.tweetUrl) : "None"}, ` +
            `target='${target}', agent='Publisher')\n` +
            "```\n";

        return (
            `✅ Tweet posted!\n\n` +
            `**Tweet ID:** ${result.tweetId}\n` +
            (result.tweetUrl ? `**Tweet URL:** ${result.tweetUrl}\n` : "") +
            `**Tweet type:** ${noteType}\n` +
            (linkedArticleUrl ? `**Linked article:** ${linkedArticleUrl}\n` : "") +
            `**Content:** ${tweetText.slice(0, 150)}${tweetText.length > 150 ? "…" : ""}\n` +
            (args.article_slug ? `**Article slug:** ${args.article_slug}\n` : "") +
            writebackBlock
        );
    } catch (err) {
        return {
            textResultForLlm: `Error in publish_tweet: ${err.message}`,
            resultType: "failure",
        };
    }
}
```

### Layer 3: MCP Server Registration — `mcp/server.mjs`

Add the new tool registration alongside the existing four tools:

```javascript
// Add import (after line 18)
import {
    publishToSubstackTool,
    publishNoteToSubstackTool,
    publishTweetTool,           // ← NEW
    handlePublishToSubstack,
    handlePublishNoteToSubstack,
    handlePublishTweet,          // ← NEW
} from "../.github/extensions/substack-publisher/tool.mjs";

// Add registration (after line 106)
server.registerTool(publishTweetTool.name, {
    description: publishTweetTool.description,
    inputSchema: {
        content: z.string().describe(publishTweetTool.parameters.properties.content.description),
        image_path: z.string().optional().describe(publishTweetTool.parameters.properties.image_path.description),
        article_slug: z.string().optional().describe(publishTweetTool.parameters.properties.article_slug.description),
        target: z.enum(["stage", "prod"]).optional().describe(publishTweetTool.parameters.properties.target.description),
    },
}, async (args) => runWithNormalization(handlePublishTweet, args));
```

### Layer 4: Dashboard Integration

#### 4a. `dashboard/data.mjs` — Add Twitter channel to `buildPublishState`

```javascript
// In buildPublishState() (around line 202), expand promotionChannels:

promotionChannels: {
    substack_note: {
        id: "substack_note",
        label: "Substack Note",
        defaultSelected: !noteBlockedReason,
        blockedReason: noteBlockedReason,
    },
    twitter: {                                              // ← NEW
        id: "twitter",
        label: "Twitter/X",
        defaultSelected: !twitterBlockedReason,
        blockedReason: twitterBlockedReason,
    },
},
```

Where `twitterBlockedReason` is derived from:
```javascript
const hasTwitterPromotion = notes.some(
    (note) => note.note_type === "twitter_promotion" && note.target === "prod"
);
const twitterCreds = loadTwitterCredentials(REPO_ROOT);
const twitterBlockedReason = hasTwitterPromotion
    ? "A production Twitter promotion is already recorded for this article."
    : !twitterCreds.valid
    ? `Twitter credentials not configured (missing: ${twitterCreds.missing.join(", ")})`
    : null;
```

#### 4b. `dashboard/publish.mjs` — Add Twitter to channel orchestration

```javascript
// In normalizeRequestedChannels (line 269):
function normalizeRequestedChannels(requestedChannels) {
    const allowed = new Set(["substack_note", "twitter"]); // ← ADD "twitter"
    return Array.from(
        new Set(
            (Array.isArray(requestedChannels) ? requestedChannels : [])
                .filter((channel) => allowed.has(channel))
        )
    );
}

// In runPublishWorkflow, after the substack_note block (after line 438):
if (channels.includes("twitter")) {
    const twitterChannel = publishState.promotionChannels.twitter;
    if (twitterChannel.blockedReason) {
        channelResults.twitter = {
            status: "SKIPPED",
            reason: twitterChannel.blockedReason,
        };
        warnings.push(twitterChannel.blockedReason);
    } else {
        try {
            const { loadTwitterCredentials, postTweet, uploadMediaForTweet, buildPromotionTweetText }
                = await import("../shared/twitter-client.mjs");

            const creds = loadTwitterCredentials(REPO_ROOT);
            const teaserText = String(draftResult.subtitle || "").trim();
            const tweetText = buildPromotionTweetText(teaserText, liveResult.publishedUrl);

            // Optionally upload cover image
            const mediaIds = [];
            // const coverImage = findCoverImage(slug);
            // if (coverImage) {
            //     const mediaId = await uploadMediaForTweet(coverImage, creds);
            //     mediaIds.push(mediaId);
            // }

            const tweetResult = await postTweet({ text: tweetText, creds, mediaIds });

            runPipelineStateCommand([
                "record-note",
                "--article-id", slug,
                "--note-type", "twitter_promotion",
                "--content", tweetText,
                "--target", "prod",
                "--agent", "Dashboard",
                ...(tweetResult.tweetUrl ? ["--note-url", tweetResult.tweetUrl] : []),
            ]);

            channelResults.twitter = {
                status: "PASS",
                tweetId: tweetResult.tweetId,
                tweetUrl: tweetResult.tweetUrl,
                tweetText,
            };
        } catch (error) {
            channelResults.twitter = {
                status: "ERROR",
                error: error.message,
            };
            warnings.push(`Twitter post failed: ${error.message}`);
        }
    }
}
```

#### 4c. `dashboard/templates.mjs` — Add Twitter checkbox

```html
<!-- After the Substack Note checkbox (around line 458) -->
<label class="channel-item${twitterChannel?.blockedReason ? ' channel-item-disabled' : ''}">
    <input type="checkbox" id="channel-twitter"
        ${twitterChannel?.defaultSelected ? 'checked' : ''}
        ${twitterChannel?.blockedReason ? 'disabled' : ''}>
    <span>
        <strong>Twitter/X</strong>
        <span class="dim">Posts article subtitle + link. X auto-unfurls the article card.</span>
        ${twitterChannel?.blockedReason
            ? `<span class="dim"> ${esc(twitterChannel.blockedReason)}</span>`
            : ''}
    </span>
</label>
```

### Layer 5: Environment Configuration — `.env` additions

```bash
# ─── Twitter/X API (article promotion) ───────────────────────────────────────
#
# Setup (one-time):
#   1. Go to https://developer.x.com/portal/dashboard
#   2. Create a project + app under the Free tier
#   3. Set "App permissions" to "Read and Write"
#   4. Under "Keys and Tokens", generate:
#      - Consumer Keys (API Key and Secret)
#      - Authentication Tokens → Access Token and Secret
#   5. Paste all four values below
#
# Rate limit: Free tier = 500 tweets/month (more than enough for NFL Lab)
#
TWITTER_API_KEY=<consumer key from X Developer Portal>
TWITTER_API_SECRET=<consumer secret from X Developer Portal>
TWITTER_ACCESS_TOKEN=<access token for your account>
TWITTER_ACCESS_TOKEN_SECRET=<access token secret for your account>
```

---

## Implementation Comparison: Notes vs. Twitter

| Aspect | Substack Notes (existing) | Twitter/X (proposed) |
|--------|--------------------------|---------------------|
| **Auth mechanism** | Session cookie (`substack.sid`) | OAuth 1.0a (4 tokens in `.env`) |
| **HTTP client** | Playwright `page.evaluate()` (Cloudflare bypass) | Native `fetch()` (no browser needed) |
| **Content format** | ProseMirror JSON document | Plain text (280 char max) |
| **Link attachment** | Register via `/api/v1/comment/attachment` → UUID | Just include URL in text; X auto-unfurls |
| **Image attachment** | Upload via `/api/v1/image` → CDN URL (deferred) | Upload via `/2/media/upload` → media_id |
| **Endpoint** | `POST /api/v1/comment/feed` (publication-scoped) | `POST /2/tweets` (global) |
| **Rate limit** | Unknown (Substack undocumented) | 500/month (Free tier) |
| **Bot detection** | Cloudflare Bot Management (requires Playwright) | None (standard REST API) |
| **DB record** | `notes` table, `note_type = "promotion"` | `notes` table, `note_type = "twitter_promotion"` |
| **Dashboard channel** | `substack_note` checkbox | `twitter` checkbox |
| **Cost** | $0 (uses existing Substack auth) | $0 (X API Free tier) |

---

## Implementation Order (Recommended)

### Phase 1: Foundation (No Side Effects)
1. **Create `shared/twitter-client.mjs`** — Pure library: OAuth 1.0a signing, `postTweet()`, `uploadMediaForTweet()`, `buildPromotionTweetText()`
2. **Add `.env` variables** to `.env.example` — Document the four Twitter credentials
3. **Unit test** the OAuth signature generation against known test vectors

### Phase 2: MCP Tool (Copilot CLI Integration)
4. **Add `publishTweetTool` + `handlePublishTweet`** to `tool.mjs`
5. **Register in `mcp/server.mjs`** — Wire with Zod schema
6. **Test via `target=stage`** — Verify dry-run output without actually posting

### Phase 3: Dashboard Integration
7. **Expand `buildPublishState()`** in `dashboard/data.mjs` — Add `twitter` to `promotionChannels`
8. **Expand `normalizeRequestedChannels()`** in `dashboard/publish.mjs` — Accept `"twitter"`
9. **Add Twitter channel block** to `runPublishWorkflow()` in `dashboard/publish.mjs`
10. **Add checkbox** to `dashboard/templates.mjs`

### Phase 4: Live Testing
11. **Set real credentials** in `.env`
12. **Post a test tweet** via MCP tool with `target=prod`
13. **Verify link card** unfurling on X
14. **Run dashboard publish** with Twitter checkbox enabled

---

## X Developer Portal Setup Guide

Step-by-step for the one-time credential setup:

1. **Sign up** at [developer.x.com](https://developer.x.com)
2. **Create a Project** — name it "NFL Lab" or similar
3. **Create an App** within the project
4. **Set App permissions** to **"Read and Write"** (not just "Read")
5. **Go to "Keys and Tokens"** tab:
   - Under "Consumer Keys" → **Regenerate** → copy `API Key` and `API Key Secret`
   - Under "Authentication Tokens" → **Generate** → copy `Access Token` and `Access Token Secret`
6. **Verify the tokens** are for the correct X account (the one you want tweets to appear from)
7. **Add all four values** to `.env` per the template above

> ⚠️ **Important:** The Access Token + Secret are specific to YOUR account. Tweets will be posted as that account. If you want to post as `@NFLLab`, generate tokens while logged into that account.

---

## Edge Cases & Considerations

### Tweet Length
- URLs are shortened to 23 chars via t.co regardless of actual length[^18]
- `buildPromotionTweetText()` accounts for this, truncating subtitle to fit
- Maximum effective text = 280 - 23 (URL) - 2 (separator) = 255 chars

### Duplicate Prevention
- The `notes` table check (`note_type = "twitter_promotion"`) prevents double-posting same article
- Dashboard checkbox is auto-disabled if a promotion tweet already exists

### Token Expiry
- OAuth 1.0a tokens **do not expire** unless revoked in the Developer Portal[^19]
- This is significantly better than Substack's `substack.sid` which expires after ~30 days
- No refresh flow needed

### Rate Limit Monitoring
- X API returns `x-rate-limit-remaining` header on each response
- Could log this for observability but 500/month is ample headroom

### Error Handling
- If tweet fails, dashboard shows warning but article publish is NOT rolled back (same as Notes pattern)
- `channelResults.twitter.status = "ERROR"` with error message

### Image Upload Considerations
- Cover images are already in `content/images/{slug}/` directory
- The v2 media upload endpoint supports JPEG, PNG, GIF, WEBP up to 5MB
- Image upload is optional — tweets with just text + URL still get link card preview

---

## Footnotes

[^1]: `.github/extensions/substack-publisher/tool.mjs:638-680` — `publishNoteToSubstackTool` definition
[^2]: `.github/extensions/substack-publisher/tool.mjs:930-1108` — `handlePublishNoteToSubstack` handler
[^3]: `.github/extensions/substack-publisher/tool.mjs:370-408` — `noteTextToProseMirror` and `parseNoteInline`
[^4]: `.github/extensions/substack-publisher/tool.mjs:419-444` — `registerPostAttachment`
[^5]: `.github/extensions/substack-publisher/tool.mjs:462-556` — `createSubstackNote` with Playwright
[^6]: `shared/substack-notes.mjs:1-148` — Shared Notes library (used by dashboard)
[^7]: `shared/substack-session.mjs:54-184` — Auth decode, cookie build, browser session
[^8]: `mcp/server.mjs:98-106` — MCP tool registration for Notes
[^9]: `dashboard/publish.mjs:288-460` — `runPublishWorkflow` with channel orchestration
[^10]: `dashboard/data.mjs:148-211` — `buildPublishState` with `promotionChannels`
[^11]: `dashboard/templates.mjs:431-466` — Dashboard UI channel checkboxes
[^12]: `dashboard/publish.mjs:269-276` — `normalizeRequestedChannels` whitelist
[^13]: `.env.example:1-30` — Environment variable documentation
[^14]: [DZone: Create Tweets With X API v2](https://mydeveloperplanet.com/2024/05/01/create-tweets-with-x-api-v2/) — OAuth 1.0a vs 2.0 comparison
[^15]: [X Developer Portal Documentation](https://developer.x.com/docs) — OAuth 1.0a token generation
[^16]: [Dataconomy: X API Pricing Increase](https://dataconomy.com/2024/10/30/x-api-pricing-increase/) — Free tier: 500 tweets/month at $0
[^17]: [Zelolab: Social Share Previews on X](https://www.zelolab.com/blog/social-share-previews-on-x-twitter/) — Link card unfurling via OG tags
[^18]: [Twitter Developer Docs](https://developer.x.com/docs) — t.co URL wrapping (23 chars)
[^19]: [MoldStud: Twitter API Authentication](https://moldstud.com/articles/p-how-to-properly-set-up-twitter-api-authentication-to-avoid-common-errors) — OAuth 1.0a tokens don't expire
