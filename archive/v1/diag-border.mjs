import { writeFileSync, readFileSync, existsSync, mkdtempSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Original CSS (the one that fails) but test different Chrome flags
const css = `
html, body { margin:0; width:520px; height:300px; background:#f8fafc; overflow:hidden; }
body { box-sizing:border-box; padding:6px; }
.table-frame { box-sizing:border-box; width:100%; border:3px solid red; border-radius:10px; overflow:hidden; background:#fff; padding:0 10px; }`;

const tableHtml = `<table><colgroup><col style="width:35%"><col style="width:65%"></colgroup>
<thead><tr><th>A</th><th>B</th></tr></thead>
<tbody><tr><td>Left</td><td>Right</td></tr></tbody></table>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
${css}
table { width:100%; border-collapse:separate; border-spacing:0; table-layout:fixed; }
thead th { padding:12px 10px; border-bottom:1px solid #cbd5e1; font-size:17px; }
tbody td { padding:10px; font-size:22px; }
</style></head><body><div class="table-frame">${tableHtml}</div></body></html>`;

const tests = {
  "overlay-scrollbar": ["--enable-features=OverlayScrollbar"],
  "wider-window": [],  // use wider --window-size
  "overlay-plus-flag": ["--enable-features=OverlayScrollbar", "--force-overlay-scrollbar"],
};

const tempRoot = mkdtempSync(join(tmpdir(), "diag7-"));
const browser = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

for (const [name, extraFlags] of Object.entries(tests)) {
  const htmlPath = join(tempRoot, name + ".html");
  const outputPath = join(tempRoot, name + ".png");
  const userDataDir = join(tempRoot, "profile-" + name);
  mkdirSync(userDataDir, { recursive: true });
  writeFileSync(htmlPath, html, "utf-8");

  const windowWidth = name === "wider-window" ? 540 : 520;

  spawnSync(browser, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--allow-file-access-from-files", "--force-device-scale-factor=2",
    `--window-size=${windowWidth},300`,
    "--run-all-compositor-stages-before-draw", "--virtual-time-budget=2500",
    "--user-data-dir=" + userDataDir, "--screenshot=" + outputPath,
    ...extraFlags,
    pathToFileURL(htmlPath).href,
  ], { encoding:"utf-8", timeout:15000, windowsHide:true });

  if (existsSync(outputPath)) {
    const buf = readFileSync(outputPath);
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    console.log(`${name}: ${w}x${h}`);
    mkdirSync("content/images/diag-test", { recursive: true });
    copyFileSync(outputPath, `content/images/diag-test/diag-${name}.png`);
  }
}
rmSync(tempRoot, { recursive: true, force: true });
