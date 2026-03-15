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

import { approveAll } from "@github/copilot-sdk";
import { joinSession } from "@github/copilot-sdk/extension";
import {
    readFileSync,
    writeFileSync,
    existsSync,
    mkdirSync,
} from "node:fs";
import { resolve, join, dirname } from "node:path";
import { homedir } from "node:os";

// ─── Config ─────────────────────────────────────────────────────────────────

function loadEnv() {
    const candidates = [
        resolve(process.cwd(), ".env"),
        resolve(homedir(), ".config", "postcli", ".env"),
    ];
    const env = {};
    for (const p of candidates) {
        if (!existsSync(p)) continue;
        const text = readFileSync(p, "utf-8");
        for (const line of text.split("\n")) {
            const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
            if (!m || line.trimStart().startsWith("#")) continue;
            env[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
        break;
    }
    return env;
}

// ─── Gemini API ──────────────────────────────────────────────────────────────

// Model priority: Imagen 4 for highest quality editorial images.
// Falls back to Gemini Flash if Imagen unavailable.
// Note: Gemini Flash tends to produce better athlete likenesses; Imagen 4 is
// higher quality for abstract/atmospheric shots. Both produce people fine.
const IMAGEN_MODEL = "imagen-4.0-generate-001";
const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview";
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

    const styleGuide = [
        "Editorial sports photography style.",
        "High contrast, dramatic lighting.",
        "NFL football aesthetic — stadium atmosphere, team colors, intensity.",
        "No text, logos, watermarks, or numbers overlaid on the image.",
        "Cinematic composition, widescreen feel.",
        "Professional quality suitable for a sports blog header.",
    ].join(" ");

    if (imageType === "cover") {
        return [
            `Cover image for an NFL article titled "${articleTitle}".`,
            articleSummary ? `Article topic: ${articleSummary}.` : "",
            `Subject: ${teamStr} ${playerStr}.`,
            styleGuide,
            "Wide aspect ratio. Hero image that captures the emotional core of the article.",
            "Abstract or atmospheric interpretation encouraged — not literal.",
        ].filter(Boolean).join(" ");
    }

    if (imageType === "inline") {
        return [
            `Inline editorial image for an NFL article.`,
            `Context: ${articleSummary || articleTitle}.`,
            `Subject: ${teamStr} ${playerStr}.`,
            styleGuide,
            "Square or 4:3 aspect ratio suitable for inline placement within body text.",
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

async function generateArticleImages(params) {
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
        image_types = ["cover"],
        count_per_type = 1,
        custom_prompts = {},
        use_model = "auto",
    } = params;

    if (!article_slug) throw new Error("article_slug is required");
    if (!article_title) throw new Error("article_title is required");

    // Resolve output directory — always content/images/{slug}/
    const repoRoot = process.cwd();
    const outputDir = join(repoRoot, "content", "images", article_slug);
    mkdirSync(outputDir, { recursive: true });

    const results = [];
    const errors = [];

    for (const imageType of image_types) {
        const aspectRatio = imageType === "cover" ? "16:9" : "1:1";
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
            if (use_model === "gemini-flash") {
                images = await generateWithGeminiFlash(prompt, apiKey, count_per_type);
                modelUsed = GEMINI_IMAGE_MODEL;
            } else {
                // Default: try Imagen 4 first, fall back to Gemini Flash
                try {
                    images = await generateWithImagen3(prompt, apiKey, count_per_type, aspectRatio);
                    modelUsed = IMAGEN_MODEL;
                } catch (imagenErr) {
                    console.error(`Imagen 4 failed (${imagenErr.message}), falling back to Gemini Flash...`);
                    images = await generateWithGeminiFlash(prompt, apiKey, count_per_type);
                    modelUsed = GEMINI_IMAGE_MODEL;
                }
            }
        } catch (err) {
            errors.push(`${imageType}: ${err.message}`);
            continue;
        }

        for (let i = 0; i < images.length; i++) {
            const suffix = images.length > 1 ? `-${i + 1}` : "";
            const filename = `${article_slug}-${imageType}${suffix}`;
            const { absPath, filename: savedName } = saveImage(
                images[i].base64,
                images[i].mimeType,
                outputDir,
                filename
            );

            const relativePath = `./images/${article_slug}/${savedName}`;
            const altText = imageType === "cover"
                ? `Cover image: ${article_title}`
                : `${article_title} — ${imageType} image ${i + 1}`;

            results.push({
                type: imageType,
                filename: savedName,
                absPath,
                relativePath,
                markdownRef: `![${altText}|${altText}](${relativePath})`,
                prompt,
                model: modelUsed,
            });
        }
    }

    return { results, errors, outputDir };
}

// ─── Extension Entrypoint ────────────────────────────────────────────────────

await joinSession({
    onPermissionRequest: approveAll,
    tools: [
        {
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
                        description: "Types of images to generate. 'cover' = 16:9 hero image. 'inline' = 1:1 body image. Default: ['cover']",
                        default: ["cover"],
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
                        enum: ["auto", "imagen-4", "gemini-flash"],
                        description: "Image model to use. 'auto' tries Imagen 4 first, falls back to Gemini Flash. Default: 'auto'",
                        default: "auto",
                    },
                },
            },
            handler: async (params) => {
                const { results, errors, outputDir } = await generateArticleImages(params);

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
                    lines.push("   - Cover image: directly after the subtitle line (`*subtitle*`)");
                    lines.push("   - Inline images: at natural section breaks or to illustrate specific points");
                    lines.push("3. The cover image will also be set in the Substack editor (Stage 8)");
                    lines.push("4. Proceed to the Editor pass — Editor can review images alongside the text");

                    if (errors.length > 0) {
                        lines.push("");
                        lines.push("## ⚠️ Errors");
                        for (const e of errors) lines.push(`- ${e}`);
                    }
                } else {
                    lines.push("❌ No images were generated.");
                    lines.push("");
                    if (errors.length > 0) {
                        lines.push("**Errors:**");
                        for (const e of errors) lines.push(`- ${e}`);
                    }
                }

                return lines.join("\n");
            },
        },
    ],
});
