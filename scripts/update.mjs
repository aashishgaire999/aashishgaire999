// Usage:
//   GH_TOKEN=... node scripts/update.mjs                 fetch live data and render
//   node scripts/update.mjs --fixture test/fixture.json  render sample data into preview/
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fetchProfile } from "./github.mjs";
import { buildModel } from "./model.mjs";
import { renderProfile } from "./render.mjs";

const root = new URL("../", import.meta.url);
const config = JSON.parse(readFileSync(new URL("config/profile.json", root), "utf8"));
const fixtureIndex = process.argv.indexOf("--fixture");

let raw;
let outDir;
if (fixtureIndex !== -1) {
  // Sample data never lands in assets/, so a preview cannot be mistaken for real stats.
  raw = JSON.parse(readFileSync(process.argv[fixtureIndex + 1], "utf8"));
  outDir = new URL("preview/", root);
} else {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Set GH_TOKEN to fetch live data, or pass --fixture <file>.");
  raw = await fetchProfile(config.username, token);
  outDir = new URL("assets/", root);
  mkdirSync(new URL("data/", root), { recursive: true });
}

const model = buildModel(raw, config);
mkdirSync(outDir, { recursive: true });
for (const theme of ["dark", "light"]) {
  writeFileSync(new URL(`profile-${theme}.svg`, outDir), renderProfile(model, theme));
}
if (fixtureIndex === -1) {
  const { calendar, ...summary } = model;
  writeFileSync(new URL("data/profile.json", root), JSON.stringify(summary, null, 2) + "\n");
}
console.log(`Rendered ${model.login}: ${model.contributions.total} contributions → ${outDir.pathname}`);
