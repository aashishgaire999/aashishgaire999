// Turns the raw GraphQL response into the numbers the card shows.
// Everything here is derived from public GitHub data; nothing is estimated.

export function streaks(days, today) {
  let longest = 0;
  let run = 0;
  for (const d of days) {
    run = d.contributionCount > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  // Today counts toward the current streak only once it has a contribution.
  let i = days.length - 1;
  if (i >= 0 && days[i].date === today && days[i].contributionCount === 0) i--;
  let current = 0;
  for (; i >= 0 && days[i].contributionCount > 0; i--) current++;
  return { current, longest };
}

export function languageTotals(repos) {
  const totals = new Map();
  for (const repo of repos) {
    for (const { size, node } of repo.languages.edges) {
      const prev = totals.get(node.name) ?? { name: node.name, color: node.color, size: 0 };
      prev.size += size;
      totals.set(node.name, prev);
    }
  }
  return share([...totals.values()]);
}

function share(langs) {
  const total = langs.reduce((sum, l) => sum + l.size, 0);
  if (!total) return [];
  return langs
    .sort((a, b) => b.size - a.size)
    .map((l) => ({ name: l.name, color: l.color ?? "#8b8b8b", pct: (l.size / total) * 100 }));
}

function groupPullRequests(nodes) {
  const byRepo = new Map();
  for (const pr of nodes) {
    if (!pr?.repository) continue;
    const key = pr.repository.nameWithOwner;
    const entry = byRepo.get(key) ?? {
      repo: key,
      stars: pr.repository.stargazerCount,
      count: 0,
      additions: 0,
      deletions: 0,
      latest: pr.mergedAt,
    };
    entry.count++;
    entry.additions += pr.additions;
    entry.deletions += pr.deletions;
    if (pr.mergedAt > entry.latest) entry.latest = pr.mergedAt;
    byRepo.set(key, entry);
  }
  return [...byRepo.values()].sort((a, b) => b.count - a.count || b.stars - a.stars);
}

export function buildModel(raw, config) {
  const { user, prs } = raw;
  const cc = user.contributionsCollection;
  const days = cc.contributionCalendar.weeks.flatMap((w) => w.contributionDays);
  const today = raw.fetchedAt.slice(0, 10);
  // The profile repo holds this card, not a project.
  const repos = user.repositories.nodes.filter((r) => !r.isArchived && r.name !== user.login);
  const topRepos = [...repos]
    .sort((a, b) => b.stargazerCount - a.stargazerCount || b.pushedAt.localeCompare(a.pushedAt))
    .slice(0, config.topRepositories)
    .map((r) => ({
      name: r.name,
      description: r.description ?? "",
      stars: r.stargazerCount,
      forks: r.forkCount,
      pushedAt: r.pushedAt,
      languages: share(r.languages.edges.map((e) => ({ ...e.node, size: e.size }))),
    }));

  return {
    login: user.login,
    name: config.displayName || user.name || user.login,
    tagline: config.tagline,
    roles: config.roles ?? [],
    refreshedAt: raw.fetchedAt,
    contributions: {
      total: cc.contributionCalendar.totalContributions,
      private: cc.restrictedContributionsCount,
      commits: cc.totalCommitContributions,
      pullRequests: cc.totalPullRequestContributions,
      issues: cc.totalIssueContributions,
      reviews: cc.totalPullRequestReviewContributions,
      activeDays: days.filter((d) => d.contributionCount > 0).length,
      ...streaks(days, today),
    },
    calendar: cc.contributionCalendar.weeks,
    followers: user.followers.totalCount,
    publicRepos: user.repositories.totalCount,
    stars: repos.reduce((sum, r) => sum + r.stargazerCount, 0),
    languages: languageTotals(repos),
    topRepos,
    mergedPullRequests: {
      total: prs.issueCount,
      repos: groupPullRequests(prs.nodes).slice(0, config.mergedPullRequestRepositories),
    },
    featured: config.featured,
    techStack: config.techStack ?? [],
  };
}
