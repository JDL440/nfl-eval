/**
 * Gemini Image Generator — Copilot CLI Extension
 *
 * Exposes a `generate_article_images` tool that generates images for NFL Lab
 * articles using Google's Imagen 3 model via the Gemini API.
 *
 * Saves generated images to content/images/{slug}/ and returns markdown
 * image references ready to paste into the article.
 *
 * Auth: GEMINI_API_KEY from Google AI Studio (https://ai.google.dev/gemini-api/docs/get-api-key)
 * Set GEMINI_API_KEY in .env (see .env.example for instructions).
 */

import {
    readFileSync,
    writeFileSync,
    existsSync,
    mkdirSync,
} from "node:fs";
import { resolve, join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { hashTelemetryText, recordPipelineUsageEvent } from "../pipeline-telemetry.mjs";
import { loadExtensionEnv } from "../shared-env.mjs";

// ─── Config ─────────────────────────────────────────────────────────────────

function loadEnv() {
    return loadExtensionEnv();
}

// ─── Gemini API ──────────────────────────────────────────────────────────────

// Model priority: Gemini 3 Pro Image for highest quality editorial images.
// Imagen 4 Ultra available as explicit opt-in via use_model="imagen-4".
// Gemini produces better editorial/atmospheric images for this workflow (validated 2026-03-17).
// Available Imagen tiers: ultra (best quality), standard, fast.
// Available Gemini image models: gemini-3-pro-image-preview (best),
//   gemini-3.1-flash-image-preview, gemini-2.5-flash-image.
const IMAGEN_MODEL = "imagen-4.0-ultra-generate-001";
const GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

async function generateWithImagen3(prompt, apiKey, count, aspectRatio) {
    const url = `${GEMINI_API_BASE}/models/${IMAGEN_MODEL}:predict?key=${apiKey}`;
    const body = {
        instances: [{ prompt }],
        parameters: {
            sampleCount: count,
            aspectRatio,
        },
    };

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Imagen 3 API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    // Imagen 3 returns predictions[].bytesBase64Encoded
    return (data.predictions || []).map((p) => ({
        base64: p.bytesBase64Encoded,
        mimeType: p.mimeType || "image/png",
    }));
}

async function generateWithGeminiFlash(prompt, apiKey, count) {
    const url = `${GEMINI_API_BASE}/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`;
    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    };

    const results = [];
    for (let i = 0; i < count; i++) {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Gemini Flash image API error ${res.status}: ${err}`);
        }
        const data = await res.json();
        for (const candidate of data.candidates || []) {
            for (const part of candidate.content?.parts || []) {
                if (part.inlineData?.data) {
                    results.push({
                        base64: part.inlineData.data,
                        mimeType: part.inlineData.mimeType || "image/png",
                    });
                }
            }
        }
    }
    return results;
}

function mimeToExt(mimeType) {
    const map = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
        "image/gif": "gif",
    };
    return map[mimeType] || "png";
}

// ─── Prompt Builder ──────────────────────────────────────────────────────────

function buildImagePrompt(imageType, context) {
    const { articleTitle, articleSummary, team, players, customPrompt } = context;

    // If caller supplied a fully custom prompt, use it directly
    if (customPrompt) return customPrompt;

    const teamStr = team ? `${team} NFL team` : "NFL";
    const playerStr = players?.length ? `featuring ${players.join(", ")}` : "";
    const isPlayerCentric = players?.length > 0;

    const styleGuide = [
        "Photorealistic photograph, not an illustration or digital art.",
        "High contrast, dramatic natural lighting.",
        "NFL football aesthetic — stadium atmosphere, team colors, intensity.",
        "No text, logos, watermarks, or numbers anywhere in the image.",
        "Cinematic composition, widescreen feel.",
        "Professional quality suitable for a sports editorial publication.",
        "Shot on a full-frame DSLR. Natural color grading, realistic film grain.",
        "No oversaturation, no neon glow, no fantasy lighting.",
    ].join(" ");

    if (imageType === "cover") {
        return [
            `Cover image for an NFL article titled "${articleTitle}".`,
            articleSummary ? `Article topic: ${articleSummary}.` : "",
            `Subject: ${teamStr} ${playerStr}.`,
            styleGuide,
            "Wide aspect ratio. Hero image that captures the emotional core of the article.",
            isPlayerCentric
                ? "If the article is centered on a specific player, make that player the clear visual subject in a realistic game-action or sideline moment that reflects the headline."
                : "If the story is team-wide or abstract, use a strong atmospheric team-driven scene tied to the headline.",
            "The image should explain the article at a glance and feel social-share ready.",
        ].filter(Boolean).join(" ");
    }

    if (imageType === "inline") {
        return [
            `Inline editorial image for an NFL article.`,
            `Context: ${articleSummary || articleTitle}.`,
            `Subject: ${teamStr} ${playerStr}.`,
            styleGuide,
            "Wide 16:9 landscape format. Banner-style image that breaks up body text.",
            isPlayerCentric
                ? "When the article is player-centric, use the player as the visual subject rather than a generic atmospheric scene."
                : "When the article is not player-centric, focus on atmosphere, environment, and team-driven editorial storytelling.",
        ].filter(Boolean).join(" ");
    }

    // Generic fallback
    return [
        `NFL editorial image. ${teamStr} ${playerStr}.`,
        articleSummary || articleTitle,
        styleGuide,
    ].filter(Boolean).join(" ");
}

// ─── File Handling ───────────────────────────────────────────────────────────

function saveImage(base64, mimeType, outputDir, filename) {
    const ext = mimeToExt(mimeType);
    const safeName = filename.replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
    const fullName = `${safeName}.${ext}`;
    const absPath = join(outputDir, fullName);
    const buffer = Buffer.from(base64, "base64");
    writeFileSync(absPath, buffer);
    return { absPath, filename: fullName, ext };
}

// ─── Main Tool ───────────────────────────────────────────────────────────────

export async function generateArticleImages(params) {
    const env = loadEnv();
    const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error(
            "GEMINI_API_KEY not set. Add it to .env — see .env.example for instructions.\n" +
            "Get a key at: https://ai.google.dev/gemini-api/docs/get-api-key"
        );
    }

    const {
        article_slug,
        article_title,
        article_summary,
        team,
        players = [],
        image_types = ["inline"],
        count_per_type = 1,
        custom_prompts = {},
        use_model = "gemini",
    } = params;

    if (!article_slug) throw new Error("article_slug is required");
    if (!article_title) throw new Error("article_title is required");

    // Resolve output directory — always content/images/{slug}/
    const repoRoot = process.cwd();
    const outputDir = join(repoRoot, "content", "images", article_slug);
    mkdirSync(outputDir, { recursive: true });

    const results = [];
    const errors = [];
    const telemetryWarnings = [];

    // Pre-count total images per type so filenames are always unique when a type appears multiple times
    const typeTotal = {};
    for (const imageType of image_types) {
        typeTotal[imageType] = (typeTotal[imageType] || 0) + count_per_type;
    }
    const typeIndex = {};

    for (const imageType of image_types) {
        const aspectRatio = "16:9";
        const context = {
            articleTitle: article_title,
            articleSummary: article_summary,
            team,
            players,
            customPrompt: custom_prompts[imageType] || null,
        };
        const prompt = buildImagePrompt(imageType, context);

        let images = [];
        let modelUsed = "";

        try {
            if (use_model === "imagen-4") {
                images = await generateWithImagen3(prompt, apiKey, count_per_type, aspectRatio);
                modelUsed = IMAGEN_MODEL;
            } else if (use_model === "auto") {
                // Auto: try Gemini first, fall back to Imagen 4
                try {
                    images = await generateWithGeminiFlash(prompt, apiKey, count_per_type);
                    modelUsed = GEMINI_IMAGE_MODEL;
                } catch (geminiErr) {
                    console.error(`Gemini failed (${geminiErr.message}), falling back to Imagen 4...`);
                    images = await generateWithImagen3(prompt, apiKey, count_per_type, aspectRatio);
                    modelUsed = IMAGEN_MODEL;
                }
            } else {
                // Default ("gemini"): use Gemini directly
                images = await generateWithGeminiFlash(prompt, apiKey, count_per_type);
                modelUsed = GEMINI_IMAGE_MODEL;
            }
        } catch (err) {
            errors.push(`${imageType}: ${err.message}`);
            try {
                recordPipelineUsageEvent({
                    articleId: article_slug,
                    stage: 5,
                    surface: "generate_article_images",
                    provider: "google",
                    actor: "generate_article_images",
                    eventType: "failed",
                    modelOrTool: use_model === "imagen-4" ? IMAGEN_MODEL : use_model,
                    quantity: count_per_type,
                    unit: "image",
                    metadata: {
                        article_title,
                        error: err.message,
                        image_type: imageType,
                        prompt_hash: hashTelemetryText(prompt),
                        requested_model_mode: use_model,
                    },
                });
            } catch (telemetryErr) {
                telemetryWarnings.push(`Failed to record image telemetry for ${imageType}: ${telemetryErr.message}`);
            }
            continue;
        }

        typeIndex[imageType] = typeIndex[imageType] || 0;
        const batchRelativePaths = [];

        for (let i = 0; i < images.length; i++) {
            typeIndex[imageType]++;
            // Add suffix whenever more than one image of this type will exist (across type repeats or count_per_type > 1)
            const needsSuffix = typeTotal[imageType] > 1;
            const suffix = needsSuffix ? `-${typeIndex[imageType]}` : "";
            const filename = `${article_slug}-${imageType}${suffix}`;
            const { absPath, filename: savedName } = saveImage(
                images[i].base64,
                images[i].mimeType,
                outputDir,
                filename
            );

            const relativePath = `../../images/${article_slug}/${savedName}`;
            const altText = imageType === "cover"
                ? `Cover image: ${article_title}`
                : `${article_title} — ${imageType} image ${typeIndex[imageType]}`;

            results.push({
                type: imageType,
                filename: savedName,
                absPath,
                relativePath,
                markdownRef: `![${altText}](${relativePath})`,
                prompt,
                model: modelUsed,
            });
            batchRelativePaths.push(relativePath);
        }

        try {
            recordPipelineUsageEvent({
                articleId: article_slug,
                stage: 5,
                surface: "generate_article_images",
                provider: modelUsed === IMAGEN_MODEL ? "google_imagen" : "google_gemini",
                actor: "generate_article_images",
                eventType: "completed",
                modelOrTool: modelUsed,
                requestCount: modelUsed === IMAGEN_MODEL ? 1 : count_per_type,
                quantity: batchRelativePaths.length,
                unit: "image",
                imageCount: batchRelativePaths.length,
                costUsdEstimate: modelUsed === IMAGEN_MODEL ? 0.04 * batchRelativePaths.length : 0.04 * batchRelativePaths.length,
                metadata: {
                    article_title,
                    image_type: imageType,
                    output_paths: batchRelativePaths,
                    prompt_hash: hashTelemetryText(prompt),
                    requested_model_mode: use_model,
                },
            });
        } catch (telemetryErr) {
            telemetryWarnings.push(`Failed to record image telemetry for ${imageType}: ${telemetryErr.message}`);
        }
    }

    return { results, errors, outputDir, telemetryWarnings };
}

// ─── Extension Entrypoint ────────────────────────────────────────────────────

export const generateArticleImagesTool = {
    name: "generate_article_images",
    description: [
                "Generate editorial images for an NFL Lab article using Google Imagen 4.",
                "Saves images to content/images/{slug}/ and returns markdown references",
                "ready to insert into the article. Call this after the Writer produces",
                "a draft and before the Editor pass so Editor can review both text and images.",
    ].join(" "),
    parameters: {
        type: "object",
        required: ["article_slug", "article_title"],
        properties: {
            article_slug: {
                type: "string",
                description: "Article slug matching the filename in content/articles/ (e.g. 'witherspoon-extension-analysis')",
            },
            article_title: {
                type: "string",
                description: "Full article headline — used to craft image generation prompts",
            },
            article_summary: {
                type: "string",
                description: "1-3 sentence summary of the article's core argument — improves image prompt quality",
            },
            team: {
                type: "string",
                description: "Primary NFL team name (e.g. 'Seattle Seahawks') — informs visual style",
            },
            players: {
                type: "array",
                items: { type: "string" },
                description: "Player names to reference in image prompts. Both Imagen 4 and Gemini Flash can generate athlete likenesses in editorial sports contexts.",
            },
                    image_types: {
                        type: "array",
                        items: {
                            type: "string",
                            enum: ["cover", "inline"],
                        },
                        description: "Types of images to generate. 'cover' = 16:9 hero image placed at the top of the article body and also suitable for Substack/social sharing. 'inline' = 16:9 wide banner image embedded in the article body. Default: ['inline']. For 2 inline images use ['inline', 'inline'] — they will be named -inline-1.png and -inline-2.png.",
                        default: ["inline"],
                    },
                    count_per_type: {
                        type: "integer",
                        minimum: 1,
                maximum: 4,
                description: "Number of images to generate per type. Default: 1",
                default: 1,
            },
            custom_prompts: {
                type: "object",
                description: "Override the auto-generated prompt for a specific image type. Keys: 'cover' or 'inline'. Values: full prompt string.",
                additionalProperties: { type: "string" },
            },
            use_model: {
                type: "string",
                enum: ["gemini", "auto", "imagen-4"],
                        description: "Image model to use. 'gemini' (default) uses Gemini 3 Pro Image. 'auto' tries Gemini first, falls back to Imagen 4. 'imagen-4' uses Imagen 4 Ultra directly.",
                        default: "gemini",
                    },
                },
            },
};

export function formatGenerateArticleImagesResult({ results, errors, outputDir, telemetryWarnings }) {
    const lines = [];

    if (results.length > 0) {
        lines.push(`✅ Generated ${results.length} image(s) → ${outputDir}`);
        lines.push("");
        lines.push("## Generated Images");
        lines.push("");

        for (const r of results) {
            lines.push(`### ${r.type.charAt(0).toUpperCase() + r.type.slice(1)} Image`);
            lines.push(`- **File:** \`${r.filename}\``);
            lines.push(`- **Model:** \`${r.model}\``);
            lines.push(`- **Prompt used:** ${r.prompt}`);
            lines.push("");
            lines.push("**Markdown reference to paste into article:**");
            lines.push("```markdown");
            lines.push(r.markdownRef);
            lines.push("```");
            lines.push("");
        }

        lines.push("## Next Steps");
        lines.push("");
        lines.push("1. Review the saved images in `" + outputDir + "`");
        lines.push("2. Paste the markdown references above into the article at the right positions:");
        lines.push("   - Cover image: at the very top of the article body, above the TLDR block");
        lines.push("   - Inline images: at natural section breaks or to illustrate specific points");
        lines.push("3. Use clean image markdown without captions; alt text stays, visible captions do not");
        lines.push("4. Proceed to the Editor pass — Editor can review images alongside the text");

        if (errors.length > 0) {
            lines.push("");
            lines.push("## ⚠️ Errors");
            for (const e of errors) lines.push(`- ${e}`);
        }
        if (telemetryWarnings.length > 0) {
            lines.push("");
            lines.push("## ⚠️ Telemetry");
            for (const warning of telemetryWarnings) lines.push(`- ${warning}`);
        }
    } else {
        lines.push("❌ No images were generated.");
        lines.push("");
        if (errors.length > 0) {
            lines.push("**Errors:**");
            for (const e of errors) lines.push(`- ${e}`);
        }
        if (telemetryWarnings.length > 0) {
            lines.push("");
            lines.push("**Telemetry warnings:**");
            for (const warning of telemetryWarnings) lines.push(`- ${warning}`);
        }
    }

    return lines.join("\n");
}

export async function handleGenerateArticleImages(params) {
    const result = await generateArticleImages(params);
    return formatGenerateArticleImagesResult(result);
}

async function main() {
    const [{ approveAll }, { joinSession }] = await Promise.all([
        import("@github/copilot-sdk"),
        import("@github/copilot-sdk/extension"),
    ]);

    await joinSession({
        onPermissionRequest: approveAll,
        tools: [
            {
                ...generateArticleImagesTool,
                handler: handleGenerateArticleImages,
            },
        ],
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await main();
}
