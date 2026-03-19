import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

const DEFAULT_REPO_ROOT = resolve(import.meta.dirname, "..");

export const SUBSTACK_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const SUBSTACK_CLIENT_HINT_HEADERS = {
    "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
};

export function loadEnv(repoRoot = DEFAULT_REPO_ROOT) {
    const candidates = [
        resolve(repoRoot, ".env"),
        resolve(homedir(), ".config", "postcli", ".env"),
    ];

    const env = {};
    for (const envPath of candidates) {
        if (!existsSync(envPath)) continue;
        const text = readFileSync(envPath, "utf-8");
        for (const line of text.split("\n")) {
            const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
            if (!match || line.trimStart().startsWith("#")) continue;
            env[match[1]] = match[2].replace(/^["']|["']$/g, "");
        }
        break;
    }
    return env;
}

export function envValue(key, env = loadEnv(DEFAULT_REPO_ROOT), fallback = "") {
    return process.env[key] || env[key] || fallback;
}

export function extractSubdomain(url) {
    if (!url) {
        throw new Error("Cannot extract Substack subdomain from an empty URL.");
    }
    const match =
        url.match(/https?:\/\/([^.]+)\.substack\.com/i) ||
        url.match(/@(\w+)/i);
    if (match) return match[1];
    throw new Error(
        `Cannot extract subdomain from: "${url}". Expected https://yourpub.substack.com`
    );
}

export function decodeSubstackToken(token) {
    if (!token || !String(token).trim()) {
        throw new Error("Missing SUBSTACK_TOKEN.");
    }

    let substackSid;
    let connectSid;
    try {
        const decoded = JSON.parse(Buffer.from(String(token), "base64").toString("utf-8"));
        substackSid = decoded.substack_sid || null;
        connectSid = decoded.connect_sid || decoded.substack_sid || null;
    } catch {
        substackSid = null;
        connectSid = null;
    }

    const rawToken = String(token).trim();
    return {
        substackSid: substackSid || rawToken,
        connectSid: connectSid || substackSid || rawToken,
    };
}

export function buildSubstackCookies(subdomain, token) {
    const { substackSid, connectSid } = decodeSubstackToken(token);
    return [
        {
            name: "substack.sid",
            value: substackSid,
            domain: ".substack.com",
            path: "/",
            httpOnly: true,
            secure: true,
            sameSite: "None",
        },
        {
            name: "connect.sid",
            value: connectSid,
            domain: `.${subdomain}.substack.com`,
            path: "/",
            httpOnly: true,
            secure: true,
            sameSite: "None",
        },
    ];
}

export function makeSubstackHeaders(token, subdomain = null) {
    const { substackSid, connectSid } = decodeSubstackToken(token);
    const origin = subdomain ? `https://${subdomain}.substack.com` : "https://substack.com";
    const referer = subdomain ? `${origin}/publish` : "https://substack.com/";

    return {
        Cookie: `substack.sid=${substackSid}; connect.sid=${connectSid}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": SUBSTACK_USER_AGENT,
        Origin: origin,
        Referer: referer,
    };
}

export function resolvePublicationConfig(target = "prod", repoRoot = DEFAULT_REPO_ROOT) {
    const env = loadEnv(repoRoot);
    const publicationUrl = target === "stage"
        ? envValue("SUBSTACK_STAGE_URL", env)
        : envValue("SUBSTACK_PUBLICATION_URL", env);

    if (!publicationUrl) {
        throw new Error(
            target === "stage"
                ? "Missing SUBSTACK_STAGE_URL in .env."
                : "Missing SUBSTACK_PUBLICATION_URL in .env."
        );
    }

    return {
        env,
        publicationUrl,
        subdomain: extractSubdomain(publicationUrl),
    };
}

export async function createSubstackBrowserSession({
    subdomain,
    token,
    startUrl = `https://${subdomain}.substack.com/publish/home`,
    contextOptions = {},
    launchOptions = {},
}) {
    let chromium;
    try {
        ({ chromium } = await import("playwright"));
    } catch {
        throw new Error("Playwright not available. Run: npm install");
    }

    const browser = await chromium.launch({
        headless: false,
        args: ["--headless=new", "--disable-blink-features=AutomationControlled"],
        ...launchOptions,
    });

    const mergedContextOptions = {
        userAgent: SUBSTACK_USER_AGENT,
        extraHTTPHeaders: {
            ...SUBSTACK_CLIENT_HINT_HEADERS,
            ...(contextOptions.extraHTTPHeaders || {}),
        },
        ...contextOptions,
    };

    const context = await browser.newContext(mergedContextOptions);
    await context.addCookies(buildSubstackCookies(subdomain, token));

    const page = await context.newPage();
    if (startUrl) {
        await page.goto(startUrl, { waitUntil: "networkidle", timeout: 60000 });
    }

    return {
        browser,
        context,
        page,
        close: async () => {
            await page.close().catch(() => {});
            await context.close().catch(() => {});
            await browser.close().catch(() => {});
        },
    };
}
