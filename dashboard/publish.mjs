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
    extractSubdomain,
    makeSubstackHeaders,
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
const PIPELINE_STATE = join(REPO_ROOT, "content", "pipeline_state.py");
const PYTHON = process.env.PYTHON || "python";

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

async function publishDraftViaApi({ slug, draftId, subdomain, token }) {
    const headers = makeSubstackHeaders(token, subdomain);
    const res = await fetch(`https://${subdomain}.substack.com/api/v1/drafts/${draftId}/publish`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
            `Substack API publish failed for "${slug}" (draft ${draftId}): HTTP ${res.status} — ${text.slice(0, 300)}`
        );
    }

    const data = await res.json();
    const publishedSlug = data.slug || slug;
    const publishedUrl = data.canonical_url || `https://${subdomain}.substack.com/p/${publishedSlug}`;

    return { publishedUrl, postId: data.id || draftId };
}

function normalizeRequestedChannels(requestedChannels) {
    const allowed = new Set(["substack_note", "twitter"]);
    return Array.from(
        new Set(
            (Array.isArray(requestedChannels) ? requestedChannels : [])
                .filter((channel) => allowed.has(channel))
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

export async function runPublishWorkflow(slug, requestedChannels = [], target = "prod") {
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
        publicationConfig = resolvePublicationConfig(target, REPO_ROOT);
    } catch (error) {
        return buildFailureResult(slug, "PREREQ_FAIL", error.message);
    }

    const token = process.env.SUBSTACK_TOKEN || publicationConfig.env.SUBSTACK_TOKEN;
    if (!token) {
        return buildFailureResult(slug, "PREREQ_FAIL", "Missing SUBSTACK_TOKEN in .env.");
    }

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

        liveResult = await publishDraftViaApi({
            slug,
            draftId: draftResult.draftId,
            subdomain: publicationConfig.subdomain,
            token,
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
                    target,
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

    if (channels.includes("twitter")) {
        const twitterChannel = publishState.promotionChannels.twitter;
        if (!twitterChannel || twitterChannel.blockedReason) {
            channelResults.twitter = {
                status: "SKIPPED",
                reason: twitterChannel?.blockedReason || "Twitter channel not configured.",
            };
            warnings.push(twitterChannel?.blockedReason || "Twitter channel not configured.");
        } else {
            try {
                const { loadTwitterCredentials, postTweet, uploadMediaForTweet, buildPromotionTweetText }
                    = await import("../shared/twitter-client.mjs");

                const twitterCreds = loadTwitterCredentials(REPO_ROOT);
                const teaserText = String(draftResult.subtitle || "").trim();
                const tweetText = buildPromotionTweetText(teaserText, liveResult.publishedUrl);

                const mediaIds = [];

                const tweetResult = await postTweet({ text: tweetText, creds: twitterCreds, mediaIds });

                const tweetArgs = [
                    "record-note",
                    "--article-id", slug,
                    "--note-type", "twitter_promotion",
                    "--content", tweetText,
                    "--target", target,
                    "--agent", "Dashboard",
                ];
                if (tweetResult.tweetUrl) {
                    tweetArgs.push("--note-url", tweetResult.tweetUrl);
                }
                runPipelineStateCommand(tweetArgs);

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

    const result = {
        status: warnings.length > 0 ? "PARTIAL" : "PASS",
        reason: warnings.length > 0
            ? "Article published live, but one or more promotion steps were skipped or failed."
            : `Article published live on ${target} and requested promotion channels completed.`,
        filePath: articleFile.relativePath,
        target,
        draftAction: draftResult.isUpdate ? "updated" : "created",
        draftUrl: draftResult.draftUrl,
        publishedUrl: liveResult.publishedUrl,
        tags: draftResult.tags,
        heroWarning: draftResult.heroWarning,
        requestedChannels: channels,
        channelResults,
        warnings,
    };

    saveResult(slug, result);
    return result;
}
