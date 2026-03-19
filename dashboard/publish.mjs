import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, join, relative } from "node:path";

import {
    getArticle,
    getPublisherPass,
    getNotes,
    buildPublishState,
    resolveArticleMarkdownPath,
} from "./data.mjs";
import {
    createSubstackBrowserSession,
    extractSubdomain,
    resolvePublicationConfig,
} from "../shared/substack-session.mjs";
import { upsertSubstackDraftFromMarkdown } from "../shared/substack-article.mjs";
import {
    buildSubtitleCardNoteBody,
    registerPostAttachment,
    createSubstackNote,
    extractNoteInfo,
} from "../shared/substack-notes.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const RESULTS_PATH = join(import.meta.dirname, "publish-results.json");
const ARTIFACTS_BASE = join(REPO_ROOT, "content", "images", "publish-artifacts");
const PIPELINE_STATE = join(REPO_ROOT, "content", "pipeline_state.py");
const PYTHON = process.env.PYTHON || "python";

const PUBLISH_BUTTON_PATTERNS = [
    /^send to .+ now$/i,
    /^publish to .+ now$/i,
    /^publish now$/i,
    /^send now$/i,
    /^publish$/i,
    /^continue$/i,
    /^next$/i,
    /^confirm$/i,
    /^done$/i,
];

function loadResults() {
    if (!existsSync(RESULTS_PATH)) return {};
    try {
        return JSON.parse(readFileSync(RESULTS_PATH, "utf-8"));
    } catch {
        return {};
    }
}

function saveResult(slug, result) {
    const all = loadResults();
    all[slug] = { ...result, timestamp: new Date().toISOString() };
    writeFileSync(RESULTS_PATH, JSON.stringify(all, null, 2));
}

export function getPublishResults(slug) {
    return loadResults()[slug] || null;
}

function runPipelineStateCommand(args) {
    const result = spawnSync(PYTHON, [PIPELINE_STATE, ...args], {
        cwd: REPO_ROOT,
        encoding: "utf-8",
        windowsHide: true,
    });

    if (result.status !== 0) {
        const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
        throw new Error(output || `pipeline_state.py ${args[0]} failed with code ${result.status}`);
    }

    return (result.stdout || "").trim();
}

function collectCandidateUrls(value, subdomain, bucket) {
    if (typeof value === "string") {
        if (/^https?:\/\/.+/i.test(value) && value.includes("substack.com")) {
            bucket.push(value);
        } else if (value.startsWith("/")) {
            bucket.push(`https://${subdomain}.substack.com${value}`);
        }
        return;
    }

    if (Array.isArray(value)) {
        for (const item of value) collectCandidateUrls(item, subdomain, bucket);
        return;
    }

    if (value && typeof value === "object") {
        for (const nested of Object.values(value)) collectCandidateUrls(nested, subdomain, bucket);
    }
}

function isPublishedArticleUrl(url, subdomain) {
    return typeof url === "string" &&
        url.includes(`${subdomain}.substack.com`) &&
        /\/p\//.test(url);
}

async function collectVisibleButtons(page) {
    return await page.evaluate(() => {
        const isVisible = (element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none" &&
                style.visibility !== "hidden" &&
                rect.width > 0 &&
                rect.height > 0;
        };

        return Array.from(document.querySelectorAll("button, [role='button'], [role='menuitem']"))
            .map((element) => ({
                text: (element.innerText || element.getAttribute("aria-label") || "").trim(),
                disabled:
                    Boolean(element.disabled) ||
                    element.getAttribute("aria-disabled") === "true",
                visible: isVisible(element),
            }))
            .filter((button) => button.visible && !button.disabled && button.text);
    });
}

async function clickNextPublishButton(page) {
    const buttons = await collectVisibleButtons(page);
    for (const pattern of PUBLISH_BUTTON_PATTERNS) {
        const match = buttons.find((button) => pattern.test(button.text));
        if (!match) continue;

        const locator = page
            .locator("button, [role='button'], [role='menuitem']")
            .filter({ hasText: match.text })
            .first();

        try {
            await locator.click({ timeout: 5000 });
            return { clickedLabel: match.text, visibleButtons: buttons.map((button) => button.text) };
        } catch {
            // Keep trying lower-priority labels in the same state snapshot.
        }
    }

    return { clickedLabel: null, visibleButtons: buttons.map((button) => button.text) };
}

async function discoverPublishedUrl(page, subdomain, responsePayloads) {
    const currentUrl = page.url();
    if (isPublishedArticleUrl(currentUrl, subdomain)) {
        return currentUrl;
    }

    const domCandidate = await page.evaluate(() => {
        const candidates = [
            document.querySelector("meta[property='og:url']")?.content,
            document.querySelector("link[rel='canonical']")?.href,
            ...Array.from(document.querySelectorAll("a[href]")).map((anchor) => anchor.href),
        ].filter(Boolean);

        return candidates.find((candidate) => /\/p\//.test(candidate)) || null;
    });
    if (isPublishedArticleUrl(domCandidate, subdomain)) {
        return domCandidate;
    }

    for (const payload of responsePayloads) {
        const urls = [];
        collectCandidateUrls(payload.json, subdomain, urls);
        const match = urls.find((candidate) => isPublishedArticleUrl(candidate, subdomain));
        if (match) return match;
    }

    return null;
}

async function waitForEditor(page) {
    try {
        await page.locator('[contenteditable="true"], .ProseMirror, [role="textbox"]').first().waitFor({
            state: "visible",
            timeout: 15000,
        });
        return true;
    } catch {
        return false;
    }
}

async function publishDraftThroughBrowser({ slug, draftUrl, token, screenshotAbsPath }) {
    const subdomain = extractSubdomain(draftUrl);
    const session = await createSubstackBrowserSession({
        subdomain,
        token,
        startUrl: draftUrl,
    });

    const responsePayloads = [];
    session.page.on("response", async (response) => {
        const url = response.url();
        const contentType = response.headers()["content-type"] || "";
        if (!contentType.includes("json")) return;
        if (!url.includes(`${subdomain}.substack.com`)) return;
        if (!/api|publish|draft|post|newsletter/i.test(url)) return;
        try {
            responsePayloads.push({
                url,
                json: await response.json(),
            });
        } catch {
            // Ignore unreadable responses.
        }
    });

    try {
        const editorReady = await waitForEditor(session.page);
        if (!editorReady) {
            const currentUrl = session.page.url();
            if (/sign-in|login/i.test(currentUrl)) {
                throw new Error("Redirected to login while opening the Substack draft. SUBSTACK_TOKEN may be expired.");
            }
        }

        const clickedButtons = [];
        let lastVisibleButtons = [];

        for (let step = 0; step < 5; step += 1) {
            const publishedUrl = await discoverPublishedUrl(session.page, subdomain, responsePayloads);
            if (publishedUrl) {
                if (screenshotAbsPath) {
                    await session.page.screenshot({ path: screenshotAbsPath, fullPage: true }).catch(() => {});
                }
                return { publishedUrl, clickedButtons };
            }

            const { clickedLabel, visibleButtons } = await clickNextPublishButton(session.page);
            lastVisibleButtons = visibleButtons;
            if (!clickedLabel) {
                break;
            }

            clickedButtons.push(clickedLabel);
            await Promise.race([
                session.page.waitForLoadState("networkidle", { timeout: 6000 }),
                session.page.waitForTimeout(2500),
            ]).catch(() => {});
        }

        const publishedUrl = await discoverPublishedUrl(session.page, subdomain, responsePayloads);
        if (publishedUrl) {
            if (screenshotAbsPath) {
                await session.page.screenshot({ path: screenshotAbsPath, fullPage: true }).catch(() => {});
            }
            return { publishedUrl, clickedButtons };
        }

        if (screenshotAbsPath) {
            await session.page.screenshot({ path: screenshotAbsPath, fullPage: true }).catch(() => {});
        }

        throw new Error(
            `Could not confirm a live publish for "${slug}". ` +
            `Visible buttons: ${lastVisibleButtons.length > 0 ? lastVisibleButtons.join(", ") : "(none)"}`
        );
    } finally {
        await session.close();
    }
}

function normalizeRequestedChannels(requestedChannels) {
    return Array.from(
        new Set(
            (Array.isArray(requestedChannels) ? requestedChannels : [])
                .filter((channel) => channel === "substack_note")
        )
    );
}

function buildFailureResult(slug, status, message, extra = {}) {
    const result = {
        status,
        error: message,
        ...extra,
    };
    saveResult(slug, result);
    return result;
}

export async function runPublishWorkflow(slug, requestedChannels = []) {
    const article = getArticle(slug);
    const publisherPass = getPublisherPass(slug);
    const notes = getNotes(slug);
    const publishState = await buildPublishState(article, publisherPass, notes, slug);
    const articleFile = resolveArticleMarkdownPath(slug, article);
    const channels = normalizeRequestedChannels(requestedChannels);

    if (!publishState.canPublish) {
        return buildFailureResult(
            slug,
            "PREREQ_FAIL",
            publishState.blockedReasons.join(" "),
            {
                blockedReasons: publishState.blockedReasons,
                filePath: articleFile.relativePath || null,
            },
        );
    }

    if (!articleFile.exists || !articleFile.absolutePath) {
        return buildFailureResult(
            slug,
            "PREREQ_FAIL",
            "No canonical article markdown file found for live publish.",
        );
    }

    let publicationConfig;
    try {
        publicationConfig = resolvePublicationConfig("prod", REPO_ROOT);
    } catch (error) {
        return buildFailureResult(slug, "PREREQ_FAIL", error.message);
    }

    const token = process.env.SUBSTACK_TOKEN || publicationConfig.env.SUBSTACK_TOKEN;
    if (!token) {
        return buildFailureResult(slug, "PREREQ_FAIL", "Missing SUBSTACK_TOKEN in .env.");
    }

    const artifactDir = join(ARTIFACTS_BASE, slug);
    mkdirSync(artifactDir, { recursive: true });
    const screenshotAbsPath = join(artifactDir, "publish-live.png");
    const screenshotRelPath = relative(REPO_ROOT, screenshotAbsPath).replace(/\\/g, "/");

    let draftResult = null;
    let liveResult = null;

    try {
        draftResult = await upsertSubstackDraftFromMarkdown({
            filePath: articleFile.absolutePath,
            token,
            targetUrl: publicationConfig.publicationUrl,
            existingDraftUrl: article?.substack_draft_url || null,
            teamName: article?.primary_team || null,
            audience: "everyone",
            cwd: REPO_ROOT,
        });

        runPipelineStateCommand([
            "set-draft-url",
            "--article-id",
            slug,
            "--draft-url",
            draftResult.draftUrl,
        ]);

        liveResult = await publishDraftThroughBrowser({
            slug,
            draftUrl: draftResult.draftUrl,
            token,
            screenshotAbsPath,
        });

        runPipelineStateCommand([
            "record-publish",
            "--article-id",
            slug,
            "--substack-url",
            liveResult.publishedUrl,
            "--agent",
            "Dashboard",
        ]);
    } catch (error) {
        return buildFailureResult(slug, "ERROR", error.message, {
            draftUrl: draftResult?.draftUrl || null,
            publishedUrl: liveResult?.publishedUrl || null,
            screenshotPath: existsSync(screenshotAbsPath) ? screenshotRelPath : null,
        });
    }

    const warnings = [];
    const channelResults = {};

    if (channels.includes("substack_note")) {
        const noteChannel = publishState.promotionChannels.substack_note;
        if (noteChannel.blockedReason) {
            channelResults.substack_note = {
                status: "SKIPPED",
                reason: noteChannel.blockedReason,
            };
            warnings.push(noteChannel.blockedReason);
        } else {
            try {
                const teaserText = String(draftResult.subtitle || "").trim();
                const bodyJson = buildSubtitleCardNoteBody(teaserText);
                const attachmentId = await registerPostAttachment({
                    articleUrl: liveResult.publishedUrl,
                    subdomain: publicationConfig.subdomain,
                    token,
                });
                const noteResponse = await createSubstackNote({
                    bodyJson,
                    subdomain: publicationConfig.subdomain,
                    token,
                    attachmentIds: [attachmentId],
                });
                const noteInfo = extractNoteInfo(noteResponse, publicationConfig.subdomain);

                const noteArgs = [
                    "record-note",
                    "--article-id",
                    slug,
                    "--note-type",
                    "promotion",
                    "--content",
                    teaserText,
                    "--target",
                    "prod",
                    "--agent",
                    "Dashboard",
                ];
                if (noteInfo.noteUrl) {
                    noteArgs.push("--note-url", noteInfo.noteUrl);
                }
                runPipelineStateCommand(noteArgs);

                channelResults.substack_note = {
                    status: "PASS",
                    noteId: noteInfo.noteId,
                    noteUrl: noteInfo.noteUrl,
                    teaserText,
                };
            } catch (error) {
                channelResults.substack_note = {
                    status: "ERROR",
                    error: error.message,
                };
                warnings.push(`Substack Note failed: ${error.message}`);
            }
        }
    }

    const result = {
        status: warnings.length > 0 ? "PARTIAL" : "PASS",
        reason: warnings.length > 0
            ? "Article published live, but one or more promotion steps were skipped or failed."
            : "Article published live and requested promotion channels completed.",
        filePath: articleFile.relativePath,
        draftAction: draftResult.isUpdate ? "updated" : "created",
        draftUrl: draftResult.draftUrl,
        publishedUrl: liveResult.publishedUrl,
        tags: draftResult.tags,
        heroWarning: draftResult.heroWarning,
        requestedChannels: channels,
        channelResults,
        warnings,
        screenshotPath: existsSync(screenshotAbsPath) ? screenshotRelPath : null,
    };

    saveResult(slug, result);
    return result;
}
