import { readFileSync } from "node:fs";

const W = 1200;
const M = 48;
const INNER = W - 2 * M;
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
const SERIF = "Georgia, 'Times New Roman', serif";
const PIXEL = "VT323, " + MONO;

export const THEMES = {
  dark: {
    bg: "#0b0d14",
    dot: "#1a1e2b",
    fg: "#e6e8f0",
    muted: "#8a90a6",
    rule: "#262a3a",
    accent: "#a78bfa",
    add: "#4ade80",
    del: "#f87171",
    heat: ["#161a26", "#3b2f6b", "#5b45a8", "#7c5ce0", "#a78bfa"],
  },
  light: {
    bg: "#fbfbfd",
    dot: "#e8e8f0",
    fg: "#12131a",
    muted: "#5c6070",
    rule: "#dcdde5",
    accent: "#6d28d9",
    add: "#15803d",
    del: "#b91c1c",
    heat: ["#ececf3", "#d9ccfb", "#b49af5", "#8b5cf6", "#6d28d9"],
  },
};

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (n) => n.toLocaleString("en-US");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const date = (iso) => {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const plural = (n, word) => `${num(n)} ${word}${n === 1 ? "" : "s"}`;

function text(x, y, value, { size = 14, fill, font = MONO, anchor = "start", weight, spacing, upper } = {}) {
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `font-family="${font}"`,
    `font-size="${size}"`,
    `fill="${fill}"`,
    anchor !== "start" && `text-anchor="${anchor}"`,
    weight && `font-weight="${weight}"`,
    spacing && `letter-spacing="${spacing}"`,
  ].filter(Boolean);
  return `<text ${attrs.join(" ")}>${esc(upper ? String(value).toUpperCase() : value)}</text>`;
}

export function wrap(value, maxChars, maxLines) {
  const lines = [];
  let line = "";
  for (const word of value.split(/\s+/).filter(Boolean)) {
    if (line && (line + " " + word).length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? line + " " + word : word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = (last.length < maxChars ? last : last.slice(0, maxChars - 1).trimEnd()) + "…";
  }
  return lines;
}

export function heatLevels(days) {
  const counts = days.map((d) => d.contributionCount).filter((c) => c > 0).sort((a, b) => a - b);
  const q = (p) => counts[Math.min(counts.length - 1, Math.floor(p * counts.length))] ?? 0;
  const [t1, t2, t3] = [q(0.25), q(0.5), q(0.75)];
  return (c) => (c === 0 ? 0 : c <= t1 ? 1 : c <= t2 ? 2 : c <= t3 ? 3 : 4);
}

function langBar(x, y, width, langs, t, height = 10) {
  if (!langs.length) return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${t.rule}"/>`;
  let cx = x;
  return langs
    .map((l, i) => {
      const w = i === langs.length - 1 ? x + width - cx : Math.round((l.pct / 100) * width);
      const r = `<rect x="${cx}" y="${y}" width="${Math.max(0, w)}" height="${height}" fill="${l.color}"/>`;
      cx += w;
      return r;
    })
    .join("");
}

function langLegend(x, y, langs, t, { columns, colWidth, limit }) {
  const shown = langs.slice(0, limit);
  const rest = langs.slice(limit).reduce((s, l) => s + l.pct, 0);
  if (rest >= 0.05) shown.push({ name: "Other", color: "#8b8b8b", pct: rest });
  return shown
    .map((l, i) => {
      const lx = x + (i % columns) * colWidth;
      const ly = y + Math.floor(i / columns) * 22;
      return (
        `<circle cx="${lx + 5}" cy="${ly - 4}" r="5" fill="${l.color}"/>` +
        text(lx + 18, ly, `${l.name} ${l.pct.toFixed(1)}%`, { size: 13, fill: t.fg })
      );
    })
    .join("");
}

function sectionHead(y, left, right, t) {
  return (
    `<line x1="${M}" y1="${y}" x2="${W - M}" y2="${y}" stroke="${t.rule}"/>` +
    text(M, y + 28, left, { size: 13, fill: t.accent, spacing: 1, upper: true, weight: 600 }) +
    (right ? text(W - M, y + 28, right, { size: 12, fill: t.muted, anchor: "end", spacing: 1, upper: true }) : "")
  );
}

function header(m, t, y) {
  const parts = [
    text(M, y, "FIG.00 / Public builder profile", { size: 13, fill: t.accent, spacing: 1, upper: true, weight: 600 }),
    text(W - M, y, `@${m.login}`, { size: 13, fill: t.muted, anchor: "end" }),
    `<line x1="${M}" y1="${y + 14}" x2="${W - M}" y2="${y + 14}" stroke="${t.rule}"/>`,
    text(M - 4, y + 104, m.name.toUpperCase(), { size: 104, fill: t.accent, font: PIXEL }),
    text(M, y + 146, m.tagline, { size: 26, fill: t.fg, font: SERIF }),
    text(M, y + 176, m.roles.join("  ·  "), { size: 13, fill: t.muted, spacing: 1, upper: true }),
  ];
  return { svg: parts.join(""), height: 206 };
}

function contributions(m, t, y) {
  const c = m.contributions;
  const split = 760;
  const note = c.private > 0
    ? `Includes ${plural(c.private, "private contribution")} GitHub reports without detail`
    : "Public activity only";
  const parts = [
    sectionHead(y, "FIG.01 / Contributions · last 365 days", null, t),
    text(M - 8, y + 226, num(c.total), { size: 240, fill: t.accent, font: PIXEL }),
    text(M, y + 292, note, { size: 13, fill: t.muted }),
    `<line x1="${split}" y1="${y + 50}" x2="${split}" y2="${y + 296}" stroke="${t.rule}" stroke-dasharray="3 5"/>`,
    text(split + 32, y + 28, "FIG.02 / Rhythm", { size: 13, fill: t.accent, spacing: 1, upper: true, weight: 600 }),
  ];
  const rows = [
    ["Current streak", plural(c.current, "day")],
    ["Longest streak", plural(c.longest, "day")],
    ["Active days", `${num(c.activeDays)} / 365`],
  ];
  rows.forEach(([label, value], i) => {
    const ry = y + 100 + i * 80;
    parts.push(text(split + 32, ry - 26, label, { size: 12, fill: t.muted, spacing: 1, upper: true }));
    parts.push(text(split + 32, ry + 20, value, { size: 54, fill: t.fg, font: PIXEL }));
  });
  return { svg: parts.join(""), height: 316 };
}

function statRow(m, t, y) {
  const c = m.contributions;
  const stats = [
    ["Commits", c.commits],
    ["Pull requests", c.pullRequests],
    ["Issues", c.issues],
    ["Reviews", c.reviews],
    ["Public repos", m.publicRepos],
    ["Followers", m.followers],
  ];
  const cw = INNER / stats.length;
  const parts = [`<line x1="${M}" y1="${y}" x2="${W - M}" y2="${y}" stroke="${t.rule}"/>`];
  stats.forEach(([label, value], i) => {
    const x = M + i * cw;
    parts.push(text(x, y + 64, num(value), { size: 60, fill: t.fg, font: PIXEL }));
    parts.push(text(x, y + 88, i < 4 ? `${label} / 365d` : label, { size: 12, fill: t.muted, spacing: 1, upper: true }));
  });
  return { svg: parts.join(""), height: 112 };
}

function calendar(m, t, y) {
  const weeks = m.calendar;
  const days = weeks.flatMap((w) => w.contributionDays);
  const level = heatLevels(days);
  const gap = 4;
  const step = Math.floor((INNER + gap) / weeks.length);
  const cell = step - gap;
  const gridTop = y + 74;
  const parts = [sectionHead(y, "FIG.03 / Contribution calendar", `${num(m.contributions.total)} in the last year`, t)];
  let lastMonth = -1;
  weeks.forEach((w, wi) => {
    const first = w.contributionDays[0];
    const month = new Date(first.date).getUTCMonth();
    if (month !== lastMonth && wi < weeks.length - 2) {
      parts.push(text(M + wi * step, gridTop - 12, MONTHS[month], { size: 12, fill: t.muted }));
      lastMonth = month;
    }
    for (const d of w.contributionDays) {
      const row = new Date(d.date).getUTCDay();
      parts.push(
        `<rect x="${M + wi * step}" y="${gridTop + row * step}" width="${cell}" height="${cell}" rx="2" fill="${t.heat[level(d.contributionCount)]}"><title>${d.date}: ${d.contributionCount}</title></rect>`,
      );
    }
  });
  const legendY = gridTop + 7 * step + 18;
  parts.push(text(W - M - 5 * 18 - 56, legendY, "LESS", { size: 11, fill: t.muted, anchor: "end" }));
  t.heat.forEach((color, i) => {
    parts.push(`<rect x="${W - M - 5 * 18 - 48 + i * 18}" y="${legendY - 11}" width="14" height="14" rx="2" fill="${color}"/>`);
  });
  parts.push(text(W - M, legendY, "MORE", { size: 11, fill: t.muted, anchor: "end" }));
  return { svg: parts.join(""), height: legendY - y + 26 };
}

function chip(x, y, label, t, { size = 14, font = MONO, charWidth = 0.6, pad = 12, height = 30 } = {}) {
  const w = Math.round(label.length * size * charWidth + pad * 2);
  return {
    width: w,
    svg:
      `<rect x="${x}" y="${y}" width="${w}" height="${height}" fill="none" stroke="${t.accent}" stroke-opacity="0.7"/>` +
      text(x + pad, y + height / 2 + size * 0.35, label, { size, fill: t.fg, font }),
  };
}

function featured(m, t, y) {
  const f = m.featured;
  if (!f) return { svg: "", height: 0 };
  const parts = [sectionHead(y, "FIG.04 / Featured project", "Self-reported · private repo", t)];
  parts.push(text(M - 2, y + 96, f.name, { size: 72, fill: t.accent, font: PIXEL }));
  parts.push(text(M + f.name.length * 31 + 24, y + 92, f.url, { size: 16, fill: t.muted }));
  parts.push(text(M, y + 126, `${f.role} · since ${f.since}`, { size: 13, fill: t.fg, spacing: 1, upper: true }));
  let ly = y + 164;
  for (const line of f.lines) {
    parts.push(text(M, ly, "›", { size: 16, fill: t.accent }));
    parts.push(text(M + 22, ly, line, { size: 16, fill: t.fg }));
    ly += 28;
  }
  let cx = M;
  for (const s of f.stack) {
    const c = chip(cx, ly, s, t);
    parts.push(c.svg);
    cx += c.width + 10;
  }
  ly += 30;
  if (f.note) {
    ly += 28;
    parts.push(text(M, ly, f.note, { size: 12, fill: t.muted }));
  }
  return { svg: parts.join(""), height: ly - y + 26 };
}

function stack(m, t, y) {
  const parts = [];
  let h = 0;
  if (m.techStack.length) {
    parts.push(sectionHead(y, "FIG.05 / Tech stack", "Self-reported", t));
    const gap = 16;
    const n = m.techStack.length;
    const w = (INNER - gap * (n - 1)) / n;
    m.techStack.forEach((s, i) => {
      const x = M + i * (w + gap);
      parts.push(`<rect x="${x}" y="${y + 52}" width="${w}" height="48" fill="none" stroke="${t.accent}" stroke-width="1.5"/>`);
      parts.push(text(x + 14, y + 86, s, { size: 34, fill: t.accent, font: PIXEL }));
    });
    h = 124;
  }
  if (m.languages.length) {
    const ly = y + h;
    parts.push(sectionHead(ly, "FIG.06 / Languages by code size", `Across ${plural(m.publicRepos, "public repo")} · GitHub Linguist`, t));
    parts.push(langBar(M, ly + 52, INNER, m.languages, t, 14));
    parts.push(langLegend(M, ly + 96, m.languages, t, { columns: 4, colWidth: INNER / 4, limit: 7 }));
    h += 96 + Math.ceil(Math.min(8, m.languages.length + (m.languages.length > 7 ? 1 : 0)) / 4) * 22 + 10;
  }
  return { svg: parts.join(""), height: h };
}

function repoCard(r, x, y, width, t) {
  const parts = [
    text(x, y + 24, r.name, { size: 24, fill: t.fg, weight: 600 }),
    text(x, y + 50, `${plural(r.stars, "star")} / ${plural(r.forks, "fork")}`, { size: 13, fill: t.accent, spacing: 1, upper: true }),
  ];
  const desc = wrap(r.description || "No description.", Math.floor(width / 8.4), 2);
  desc.forEach((line, i) => parts.push(text(x, y + 76 + i * 20, line, { size: 14, fill: t.muted })));
  parts.push(langBar(x, y + 108, width, r.languages, t));
  if (r.languages.length) {
    parts.push(langLegend(x, y + 142, r.languages, t, { columns: 2, colWidth: width / 2, limit: 3 }));
  } else {
    parts.push(text(x, y + 142, "No language breakdown reported", { size: 13, fill: t.muted }));
  }
  parts.push(text(x, y + 200, `Pushed ${date(r.pushedAt)}`, { size: 12, fill: t.muted }));
  return parts.join("");
}

function repos(m, t, y) {
  if (!m.topRepos.length) return { svg: "", height: 0 };
  const parts = [sectionHead(y, "FIG.07 / Top public repositories", "Original work · not forks", t)];
  const gap = 48;
  const cw = (INNER - gap) / 2;
  const rowH = 232;
  m.topRepos.forEach((r, i) => {
    const x = M + (i % 2) * (cw + gap);
    const ry = y + 56 + Math.floor(i / 2) * rowH;
    parts.push(repoCard(r, x, ry, cw, t));
  });
  return { svg: parts.join(""), height: 56 + Math.ceil(m.topRepos.length / 2) * rowH };
}

function pullRequests(m, t, y) {
  const prs = m.mergedPullRequests;
  if (!prs.total) return { svg: "", height: 0 };
  const parts = [sectionHead(y, "FIG.08 / Merged PRs to other projects", `${plural(prs.total, "merged PR")} · all time`, t)];
  prs.repos.forEach((r, i) => {
    const ry = y + 60 + i * 86;
    parts.push(`<circle cx="${M + 7}" cy="${ry + 10}" r="6" fill="none" stroke="${t.accent}" stroke-width="2"/>`);
    parts.push(text(M + 28, ry + 18, r.repo, { size: 22, fill: t.fg, weight: 600 }));
    parts.push(text(M + 28, ry + 44, `${plural(r.count, "merged PR")} · ${plural(r.stars, "star")}`, { size: 13, fill: t.accent, spacing: 1, upper: true }));
    parts.push(text(M + 28, ry + 68, `+${num(r.additions)}`, { size: 16, fill: t.add }));
    parts.push(text(M + 148, ry + 68, `-${num(r.deletions)}`, { size: 16, fill: t.del }));
    parts.push(text(W - M, ry + 18, `Latest merge ${date(r.latest)}`, { size: 12, fill: t.muted, anchor: "end" }));
  });
  const note = prs.total > 100 ? "Per-repo counts cover the 100 most recently updated merged PRs." : "";
  const h = 60 + prs.repos.length * 86;
  if (note) parts.push(text(M, y + h, note, { size: 12, fill: t.muted }));
  return { svg: parts.join(""), height: h + (note ? 24 : 0) };
}

function footer(m, t, y) {
  return {
    svg:
      `<line x1="${M}" y1="${y}" x2="${W - M}" y2="${y}" stroke="${t.rule}"/>` +
      text(M, y + 32, "Source / public GitHub GraphQL API", { size: 12, fill: t.muted, spacing: 1, upper: true }) +
      text(W - M, y + 32, `Refreshed ${date(m.refreshedAt)} UTC`, { size: 12, fill: t.muted, anchor: "end", spacing: 1, upper: true }),
    height: 64,
  };
}

let fontCache;
function fontFace() {
  fontCache ??= readFileSync(new URL("../assets/fonts/VT323-Regular.ttf", import.meta.url)).toString("base64");
  return `@font-face{font-family:'VT323';src:url(data:font/ttf;base64,${fontCache}) format('truetype');}`;
}

export function renderProfile(m, themeName, { embedFont = true } = {}) {
  const t = THEMES[themeName];
  const sections = [header, contributions, statRow, calendar, featured, stack, repos, pullRequests, footer];
  let y = 40;
  const body = [];
  for (const section of sections) {
    const { svg, height } = section(m, t, y);
    if (!height) continue;
    body.push(svg);
    y += height + (section === header ? 0 : 20);
  }
  const H = y;
  const alt = `${m.name}: ${m.contributions.total} public GitHub contributions in the last 365 days.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(alt)}">
<style>${embedFont ? fontFace() : ""}</style>
<defs><pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${t.dot}"/></pattern></defs>
<rect width="${W}" height="${H}" fill="${t.bg}"/>
<rect width="${W}" height="${H}" fill="url(#dots)"/>
${body.join("\n")}
<rect y="${H - 6}" width="${W}" height="6" fill="${t.accent}"/>
</svg>
`;
}
