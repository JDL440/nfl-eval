import { createSubstackBrowserSession, decodeSubstackToken, loadEnv } from "./substack-session.mjs";

function collectStrings(value, bucket) {
    if (typeof value === "string") {
        bucket.push(value);
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value) collectStrings(item, bucket);
        return;
    }
    if (value && typeof value === "object") {
        for (const nested of Object.values(value)) collectStrings(nested, bucket);
    }
}

function firstMatchingUrl(noteResult, subdomain) {
    const strings = [];
    collectStrings(noteResult, strings);
    for (const candidate of strings) {
        if (/^https?:\/\/.+/i.test(candidate) && candidate.includes("substack.com")) {
            return candidate;
        }
        if (candidate.startsWith("/")) {
            return `https://${subdomain}.substack.com${candidate}`;
        }
    }
    return null;
}

export function buildSubtitleCardNoteBody(subtitle) {
    const text = String(subtitle || "").trim();
    if (!text) {
        throw new Error("Note teaser text cannot be empty.");
    }

    return {
        type: "doc",
        attrs: { schemaVersion: "v1" },
        content: [
            {
                type: "paragraph",
                content: [{ type: "text", text }],
            },
        ],
    };
}

export async function registerPostAttachment({ articleUrl, subdomain, token }) {
    const { substackSid } = decodeSubstackToken(token);

    const response = await fetch(`https://${subdomain}.substack.com/api/v1/comment/attachment`, {
        method: "POST",
        headers: {
            Cookie: `substack.sid=${substackSid}`,
            Accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
        body: JSON.stringify({ url: articleUrl, type: "post" }),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Attachment HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    if (!data.id) {
        throw new Error("Attachment response did not include an attachment ID.");
    }
    return data.id;
}

export async function postNoteWithPage(page, { bodyJson, subdomain, attachmentIds = [], notesEndpointPath = null }) {
    const env = loadEnv();
    const endpointPath = notesEndpointPath || process.env.NOTES_ENDPOINT_PATH || env.NOTES_ENDPOINT_PATH;
    if (!endpointPath) {
        throw new Error("Missing NOTES_ENDPOINT_PATH in .env — required for Substack Notes posting.");
    }

    const url = `https://${subdomain}.substack.com${endpointPath}`;
    const payload = {
        bodyJson,
        tabId: "for-you",
        surface: "feed",
        replyMinimumRole: "everyone",
        ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
    };

    const result = await page.evaluate(async ({ requestUrl, requestPayload }) => {
        const res = await fetch(requestUrl, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestPayload),
            credentials: "same-origin",
        });

        return {
            status: res.status,
            text: await res.text(),
        };
    }, { requestUrl: url, requestPayload: payload });

    if (result.status >= 400) {
        throw new Error(`Note POST HTTP ${result.status}: ${result.text.slice(0, 300)}`);
    }

    return JSON.parse(result.text);
}

export async function createSubstackNote({
    bodyJson,
    subdomain,
    token,
    attachmentIds = [],
    notesEndpointPath = null,
}) {
    const session = await createSubstackBrowserSession({
        subdomain,
        token,
        startUrl: `https://${subdomain}.substack.com/publish/home`,
    });

    try {
        return await postNoteWithPage(session.page, {
            bodyJson,
            subdomain,
            attachmentIds,
            notesEndpointPath,
        });
    } finally {
        await session.close();
    }
}

export function extractNoteInfo(noteResult, subdomain) {
    const noteId = noteResult?.id || noteResult?.comment?.id || null;
    const noteUrl = firstMatchingUrl(noteResult, subdomain) ||
        (noteId ? `https://${subdomain}.substack.com/note/c-${noteId}` : null);

    return { noteId, noteUrl };
}
