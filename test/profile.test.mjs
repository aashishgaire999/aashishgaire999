import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildModel, languageTotals, streaks } from "../scripts/model.mjs";
import { heatLevels, renderProfile, wrap } from "../scripts/render.mjs";

const fixture = JSON.parse(readFileSync(new URL("fixture.json", import.meta.url), "utf8"));
const config = JSON.parse(readFileSync(new URL("../config/profile.json", import.meta.url), "utf8"));
const day = (date, contributionCount) => ({ date, contributionCount });

test("streaks ignore an empty today but break on an empty yesterday", () => {
  const days = [day("2026-10-06", 1), day("2026-10-07", 2), day("2026-10-08", 0), day("2026-10-09", 3), day("2026-10-10", 0)];
  assert.deepEqual(streaks(days, "2026-10-10"), { current: 1, longest: 2 });
  assert.deepEqual(streaks(days.slice(0, 3), "2026-10-08"), { current: 2, longest: 2 });
});

test("language shares sum to 100 and sort by size", () => {
  const repo = (edges) => ({ languages: { edges } });
  const langs = languageTotals([
    repo([{ size: 30, node: { name: "Go", color: "#00ADD8" } }]),
    repo([{ size: 70, node: { name: "Go", color: "#00ADD8" } }, { size: 100, node: { name: "Rust", color: null } }]),
  ]);
  assert.deepEqual(langs.map((l) => [l.name, l.pct]), [["Go", 50], ["Rust", 50]]);
  assert.equal(langs[1].color, "#8b8b8b");
});

test("model counts only live public data and skips archived repos", () => {
  const m = buildModel(fixture, config);
  assert.equal(m.contributions.total, fixture.user.contributionsCollection.contributionCalendar.totalContributions);
  assert.ok(!m.topRepos.some((r) => r.name === "sample-archived"));
  assert.equal(m.topRepos[0].name, "sample-repo-one");
  assert.deepEqual(m.mergedPullRequests.repos.map((r) => [r.repo, r.count]), [["sample-org/sample-lib", 2], ["other/docs", 1]]);
});

test("wrap truncates with an ellipsis", () => {
  assert.deepEqual(wrap("aa bb cc dd", 5, 2), ["aa bb", "cc dd"]);
  assert.deepEqual(wrap("aa bb cc dd ee", 5, 2), ["aa bb", "cc d…"]);
  assert.deepEqual(wrap("aaaa b cccc", 5, 1), ["aaaa…"]);
});

test("heat levels map zero to 0 and the busiest days to 4", () => {
  const level = heatLevels([1, 2, 3, 4, 10].map((c, i) => day(`d${i}`, c)));
  assert.equal(level(0), 0);
  assert.equal(level(1), 1);
  assert.equal(level(10), 4);
});

test("render escapes text and omits empty sections", () => {
  const m = buildModel(fixture, { ...config, displayName: "A <b> & C" });
  m.mergedPullRequests = { total: 0, repos: [] };
  const svg = renderProfile(m, "dark", { embedFont: false });
  assert.match(svg, /A &lt;B&gt; &amp; C/);
  assert.doesNotMatch(svg, /FIG\.08/);
  assert.match(svg, /^<svg [^>]*viewBox="0 0 1200 \d+"/);
});
