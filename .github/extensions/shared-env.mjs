import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

export function loadExtensionEnv(candidates = []) {
    if (process.env.EXTENSION_ENV_DISABLED === "1") {
        return {};
    }

    const defaultCandidates = [
        resolve(process.cwd(), ".env"),
        resolve(homedir(), ".config", "postcli", ".env"),
    ];

    const env = {};
    for (const p of [...candidates, ...defaultCandidates]) {
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

export function createNoopLogger() {
    return async () => {};
}
