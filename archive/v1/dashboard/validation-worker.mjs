import { runEditorValidation, runMobileValidation } from "./validation.mjs";

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
    const type = args.type;

    if (!slug || !type) {
        throw new Error("Usage: node dashboard/validation-worker.mjs --slug <slug> --type <editor|mobile>");
    }

    const result = type === "mobile"
        ? await runMobileValidation(slug)
        : await runEditorValidation(slug);

    process.stdout.write(`__VALIDATION_RESULT__${JSON.stringify(result)}\n`);
    process.exit(result.status === "PASS" ? 0 : 1);
}

main().catch((error) => {
    process.stdout.write(`__VALIDATION_RESULT__${JSON.stringify({
        status: "ERROR",
        error: error.message || String(error),
    })}\n`);
    process.exit(2);
});
