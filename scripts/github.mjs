const QUERY = `
query ($login: String!, $from: DateTime!, $to: DateTime!, $prQuery: String!) {
  user(login: $login) {
    login
    name
    createdAt
    followers { totalCount }
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC,
                 orderBy: { field: STARGAZERS, direction: DESC }) {
      totalCount
      nodes {
        name
        description
        stargazerCount
        forkCount
        pushedAt
        isArchived
        languages(first: 6, orderBy: { field: SIZE, direction: DESC }) {
          totalSize
          edges { size node { name color } }
        }
      }
    }
  }
  prs: search(type: ISSUE, first: 100, query: $prQuery) {
    issueCount
    nodes {
      ... on PullRequest {
        mergedAt
        additions
        deletions
        repository { nameWithOwner stargazerCount }
      }
    }
  }
}`;

export async function fetchProfile(login, token, now = new Date()) {
  const from = new Date(now.getTime() - 365 * 24 * 3600 * 1000);
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": `${login}-profile`,
    },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        login,
        from: from.toISOString(),
        to: now.toISOString(),
        prQuery: `author:${login} is:pr is:merged is:public -user:${login} sort:updated-desc`,
      },
    }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}: ${await res.text()}`);
  const body = await res.json();
  if (body.errors) throw new Error(`GitHub GraphQL errors: ${JSON.stringify(body.errors)}`);
  return { fetchedAt: now.toISOString(), ...body.data };
}
