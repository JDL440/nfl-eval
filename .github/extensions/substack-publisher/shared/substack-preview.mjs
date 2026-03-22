import {
    extractMetaFromMarkdown,
    markdownToProseMirror,
    ensureSubscribeButtons,
    ensureHeroFirstImage,
} from "./substack-prosemirror.mjs";

export async function buildCanonicalPreview(markdown, options = {}) {
    if (!markdown) {
        return {
            title: null,
            subtitle: null,
            doc: { type: "doc", content: [] },
            warnings: [],
            hero: { safe: true, warning: null },
        };
    }

    const meta = extractMetaFromMarkdown(markdown);
    const doc = await markdownToProseMirror(
        meta.bodyMarkdown,
        options.imageResolver || null,
        { previewMode: true },
    );

    const warnings = [...(doc._warnings || [])];
    ensureSubscribeButtons(doc);

    const hero = ensureHeroFirstImage(doc);
    if (hero.warning) {
        warnings.push({
            type: "hero_image",
            message: hero.warning,
            safe: hero.safe,
        });
    }

    return {
        title: meta.title,
        subtitle: meta.subtitle,
        doc,
        warnings,
        hero,
    };
}
