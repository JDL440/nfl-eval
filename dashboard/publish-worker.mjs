import { runPublishWorkflow } from "./publish.mjs";

function parseArgs(argv) {
    const args = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith("--")) continue;
        args[token.slice(2)] = argv[index + 1];
        index += 1;
    }
    return args;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const slug = args.slug;
    const channels = args.channels
        ? args.channels.split(",").map((value) => value.trim()).filter(Boolean)
        : [];
    const target = args.target || "prod";

    if (!slug) {
        throw new Error("Usage: node dashboard/publish-worker.mjs --slug <slug> [--channels substack_note] [--target prod|stage]");
    }

    const result = await runPublishWorkflow(slug, channels, target);
    process.stdout.write(`__PUBLISH_RESULT__${JSON.stringify(result)}\n`);
    process.exit(result.status === "PASS" || result.status === "PARTIAL" ? 0 : 1);
}

main().catch((error) => {
    process.stdout.write(`__PUBLISH_RESULT__${JSON.stringify({
        status: "ERROR",
        error: error.message || String(error),
    })}\n`);
    process.exit(2);
});
