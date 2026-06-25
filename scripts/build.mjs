#!/usr/bin/env node
/**
 * Builds the static API docs site:
 *
 *   1. Cleans `dist/`.
 *   2. Runs `pumice-docs generate` against the configured API URL.
 *   3. Rewrites Vite's absolute `/assets/*` paths to relative `./assets/*`
 *      so the bundle works on any GitHub Pages sub-path.
 *   4. Writes a `.nojekyll` marker so GitHub Pages serves files starting
 *      with an underscore (and skips Jekyll processing).
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DIST = "dist";
const API_URL = process.env.API_URL ?? "https://api.hematite.gg";

function step(label) {
  console.log(`\n\u2192 ${label}`);
}

step(`Cleaning ${DIST}/`);
fs.rmSync(DIST, { recursive: true, force: true });

step(`Generating docs from ${API_URL}`);
const binDir = path.join("node_modules", ".bin");
const candidates =
  process.platform === "win32"
    ? ["pumice-docs.cmd", "pumice-docs.exe", "pumice-docs.bunx", "pumice-docs"]
    : ["pumice-docs"];
const binPath = candidates
  .map((n) => path.join(binDir, n))
  .find((p) => fs.existsSync(p));
if (!binPath) {
  console.error(
    `Could not find a pumice-docs binary in ${binDir}. Run \`bun install\` first.`,
  );
  process.exit(1);
}
const result = spawnSync(
  binPath,
  ["generate", "-u", API_URL, "-f", "html", "-o", DIST],
  { stdio: "inherit", shell: process.platform === "win32" },
);
if (result.status !== 0) {
  console.error("pumice-docs generate failed.");
  process.exit(result.status ?? 1);
}

step("Rewriting absolute asset paths to relative");
const indexPath = path.join(DIST, "index.html");
let html = fs.readFileSync(indexPath, "utf8");
const before = html;
html = html.replace(/(src|href)="\/assets\//g, '$1="./assets/');
html = html.replace(/(src|href)="\/docs\.json/g, '$1="./docs.json');
fs.writeFileSync(indexPath, html);
console.log(
  before === html
    ? "  (no absolute paths found)"
    : "  rewrote /assets/ -> ./assets/",
);

step("Writing .nojekyll");
fs.writeFileSync(path.join(DIST, ".nojekyll"), "");

if (fs.existsSync("CNAME")) {
  step("Copying CNAME (custom domain) into dist/");
  fs.copyFileSync("CNAME", path.join(DIST, "CNAME"));
}

console.log("\nDone. Output in ./dist");
