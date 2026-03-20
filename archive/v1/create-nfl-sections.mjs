/**
 * create-nfl-sections.mjs
 *
 * Creates one Substack section per NFL team on nfllab.substack.com,
 * applying each team's official primary and secondary colors via custom_config.
 *
 * Usage:
 *   node create-nfl-sections.mjs                        # dry run against nfllab
 *   node create-nfl-sections.mjs --run                  # create sections on nfllab
 *   node create-nfl-sections.mjs --pub nfllabstage --run # target a different publication
 *   node create-nfl-sections.mjs --delete               # delete all existing sections (reset)
 */

import { readFileSync } from "fs";

// ─── Config ──────────────────────────────────────────────────────────────────

const env = {};
for (const line of readFileSync(".env", "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
    if (m && !line.trimStart().startsWith("#")) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const decoded = JSON.parse(Buffer.from(env.SUBSTACK_TOKEN, "base64").toString());
const cookie = "substack.sid=" + decoded.substack_sid;

// Target: publication (override with --pub <subdomain>)
const pubArg = process.argv.indexOf("--pub");
const PUB = pubArg !== -1 ? process.argv[pubArg + 1] : "nfllab";
const BASE = `https://${PUB}.substack.com`;
const HEADERS = {
    Cookie: cookie,
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Origin: BASE,
    Referer: `${BASE}/publish`,
};

const DRY_RUN = !process.argv.includes("--run");
const DELETE_ALL = process.argv.includes("--delete");

// ─── NFL Teams ────────────────────────────────────────────────────────────────
// Colors: official team brand hex codes (primary pop / secondary accent)

const NFL_TEAMS = [
    { name: "Arizona Cardinals",       pop: "#97233F", accent: "#FFB612", city: "Arizona" },
    { name: "Atlanta Falcons",         pop: "#A71930", accent: "#000000", city: "Atlanta" },
    { name: "Baltimore Ravens",        pop: "#241773", accent: "#9E7C0C", city: "Baltimore" },
    { name: "Buffalo Bills",           pop: "#C60C30", accent: "#00338D", city: "Buffalo" },
    { name: "Carolina Panthers",       pop: "#0085CA", accent: "#101820", city: "Carolina" },
    { name: "Chicago Bears",           pop: "#C83803", accent: "#0B162A", city: "Chicago" },
    { name: "Cincinnati Bengals",      pop: "#FB4F14", accent: "#000000", city: "Cincinnati" },
    { name: "Cleveland Browns",        pop: "#FF3C00", accent: "#311D00", city: "Cleveland" },
    { name: "Dallas Cowboys",          pop: "#003594", accent: "#041E42", city: "Dallas" },
    { name: "Denver Broncos",          pop: "#FB4F14", accent: "#002244", city: "Denver" },
    { name: "Detroit Lions",           pop: "#0076B6", accent: "#B0B7BC", city: "Detroit" },
    { name: "Green Bay Packers",       pop: "#203731", accent: "#FFB612", city: "Green Bay" },
    { name: "Houston Texans",          pop: "#A71930", accent: "#03202F", city: "Houston" },
    { name: "Indianapolis Colts",      pop: "#002C5F", accent: "#A2AAAD", city: "Indianapolis" },
    { name: "Jacksonville Jaguars",    pop: "#D7A22A", accent: "#101820", city: "Jacksonville" },
    { name: "Kansas City Chiefs",      pop: "#E31837", accent: "#FFB81C", city: "Kansas City" },
    { name: "Las Vegas Raiders",       pop: "#A5ACAF", accent: "#000000", city: "Las Vegas" },
    { name: "Los Angeles Chargers",    pop: "#0080C6", accent: "#FFC20E", city: "Los Angeles" },
    { name: "Los Angeles Rams",        pop: "#003594", accent: "#FFA300", city: "Los Angeles" },
    { name: "Miami Dolphins",          pop: "#008E97", accent: "#FC4C02", city: "Miami" },
    { name: "Minnesota Vikings",       pop: "#4F2683", accent: "#FFC62F", city: "Minnesota" },
    { name: "New England Patriots",    pop: "#002244", accent: "#C60C30", city: "New England" },
    { name: "New Orleans Saints",      pop: "#D3BC8D", accent: "#101820", city: "New Orleans" },
    { name: "New York Giants",         pop: "#0B2265", accent: "#A71930", city: "New York" },
    { name: "New York Jets",           pop: "#125740", accent: "#000000", city: "New York" },
    { name: "Philadelphia Eagles",     pop: "#004C54", accent: "#A5ACAF", city: "Philadelphia" },
    { name: "Pittsburgh Steelers",     pop: "#FFB612", accent: "#101820", city: "Pittsburgh" },
    { name: "San Francisco 49ers",     pop: "#AA0000", accent: "#B3995D", city: "San Francisco" },
    { name: "Seattle Seahawks",        pop: "#69BE28", accent: "#002244", city: "Seattle" },
    { name: "Tampa Bay Buccaneers",    pop: "#D50A0A", accent: "#FF7900", city: "Tampa Bay" },
    { name: "Tennessee Titans",        pop: "#4B92DB", accent: "#0C2340", city: "Tennessee" },
    { name: "Washington Commanders",   pop: "#773141", accent: "#FFB612", city: "Washington" },
];

function makeDescription(team) {
    return `AI-powered analysis, depth charts, cap intelligence, and expert panel takes for the ${team.name}.`;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function listSections() {
    const r = await fetch(`${BASE}/api/v1/publication/sections`, { headers: HEADERS });
    return r.json();
}

async function createSection(team) {
    const r = await fetch(`${BASE}/api/v1/publication/sections`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({
            name: team.name,
            description: makeDescription(team),
        }),
    });
    if (!r.ok) throw new Error(`Create failed (${r.status}): ${await r.text()}`);
    const data = await r.json();
    return data.section || data;
}

async function patchSectionColors(id, pop, accent) {
    const r = await fetch(`${BASE}/api/v1/publication/sections/${id}`, {
        method: "PATCH",
        headers: HEADERS,
        body: JSON.stringify({ custom_config: { theme_var_background_pop: pop, accent_color: accent } }),
    });
    if (!r.ok) throw new Error(`Patch failed (${r.status}): ${await r.text()}`);
    return (await r.json()).section;
}

async function deleteSection(id) {
    const r = await fetch(`${BASE}/api/v1/publication/sections/${id}`, {
        method: "DELETE",
        headers: HEADERS,
    });
    return r.status;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const existing = await listSections();
console.log(`\n📋 nfllab.substack.com — current sections: ${existing.length}`);
if (existing.length > 0) {
    existing.forEach(s => console.log(`  • [${s.id}] ${s.name}`));
}

if (DELETE_ALL) {
    console.log(`\n🗑  Deleting ${existing.length} sections...`);
    for (const s of existing) {
        const status = await deleteSection(s.id);
        console.log(`  DELETE ${s.name} → ${status}`);
    }
    console.log("Done.");
    process.exit(0);
}

// Filter out teams already created
const existingNames = new Set(existing.map(s => s.name));
const toCreate = NFL_TEAMS.filter(t => !existingNames.has(t.name));

console.log(`\n${DRY_RUN ? "🔍 DRY RUN" : "🚀 CREATING"} — ${toCreate.length} sections to create (${NFL_TEAMS.length - toCreate.length} already exist)\n`);

if (DRY_RUN) {
    toCreate.forEach(t =>
        console.log(`  ${t.name.padEnd(28)} pop=${t.pop}  accent=${t.accent}`)
    );
    console.log("\nRun with --run to create these sections on nfllab.substack.com");
    process.exit(0);
}

// Create all sections + re-apply colors to any missing custom_config
let created = 0, failed = 0, colored = 0;

// Step 1: create missing sections
for (const team of toCreate) {
    try {
        process.stdout.write(`  Creating ${team.name}...`);
        const section = await createSection(team);
        await patchSectionColors(section.id, team.pop, team.accent);
        console.log(` ✅ id=${section.id}  ${team.pop} / ${team.accent}`);
        created++;
        await new Promise(r => setTimeout(r, 800));
    } catch (err) {
        console.log(` ❌ ${err.message}`);
        failed++;
    }
}

// Step 2: re-apply colors to any existing sections with empty custom_config
const teamColorMap = Object.fromEntries(NFL_TEAMS.map(t => [t.name, t]));
const needsColor = existing.filter(s =>
    s.name in teamColorMap &&
    (!s.custom_config || Object.keys(s.custom_config).length === 0)
);
if (needsColor.length > 0) {
    console.log(`\n🎨 Applying colors to ${needsColor.length} existing sections with no custom_config...`);
    for (const s of needsColor) {
        const team = teamColorMap[s.name];
        try {
            process.stdout.write(`  Patching ${s.name}...`);
            await patchSectionColors(s.id, team.pop, team.accent);
            console.log(` ✅ ${team.pop} / ${team.accent}`);
            colored++;
            await new Promise(r => setTimeout(r, 800));
        } catch (err) {
            console.log(` ❌ ${err.message}`);
            failed++;
        }
    }
}

console.log(`\n✅ Created: ${created} | 🎨 Colored: ${colored} | ❌ Failed: ${failed}`);
console.log("\nView sections: https://nfllab.substack.com/publish/settings/sections");

// Final listing
const final = await listSections();
console.log(`\nTotal sections on nfllab: ${final.length}`);
