/**
 * Table Image Renderer — Copilot CLI Extension
 *
 * Thin extension wrapper that starts the Copilot tool host and delegates
 * rendering to the importable core implementation in renderer-core.mjs.
 */

import { renderTableImage, formatRenderSuccess } from "./renderer-core.mjs";

const [{ approveAll }, { joinSession }] = await Promise.all([
    import("@github/copilot-sdk"),
    import("@github/copilot-sdk/extension"),
]);

const session = await joinSession({
    onPermissionRequest: approveAll,
    tools: [
        {
            name: "render_table_image",
            description:
                "Render a markdown table from an article or inline input to a polished local PNG for Substack-safe publishing.",
            parameters: {
                type: "object",
                properties: {
                    article_file_path: {
                        type: "string",
                        description: "Path to the target article markdown file, relative to the repo root.",
                    },
                    article_slug: {
                        type: "string",
                        description: "Optional slug override for content/images/{slug}/ output.",
                    },
                    source_path: {
                        type: "string",
                        description: "Optional source markdown file to extract a table from.",
                    },
                    table_index: {
                        type: "integer",
                        description: "1-based table index when extracting from a markdown source file.",
                        default: 1,
                    },
                    table_markdown: {
                        type: "string",
                        description: "Optional raw markdown table content. Use instead of source_path.",
                    },
                    title: {
                        type: "string",
                        description: "Optional title shown above the table image.",
                    },
                    caption: {
                        type: "string",
                        description: "Optional caption returned in the markdown image syntax and used as supporting copy in the image.",
                    },
                    alt_text: {
                        type: "string",
                        description: "Optional alt text override for the returned markdown image syntax.",
                    },
                    output_name: {
                        type: "string",
                        description: "Optional filename stem for the generated image.",
                    },
                    template: {
                        type: "string",
                        description: "Optional template override: auto, generic-comparison, cap-comparison, draft-board, or priority-list.",
                    },
                },
                required: ["article_file_path"],
            },
            async call(args) {
                try {
                    const result = await renderTableImage(args);
                    return formatRenderSuccess(result);
                } catch (err) {
                    return {
                        textResultForLlm: `Error rendering table image: ${err.message}`,
                        resultType: "failure",
                    };
                }
            },
        },
    ],
});

await session.wait();
