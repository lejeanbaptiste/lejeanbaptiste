// Counts progress toward the "Flag of Commitment" ladder: issues, pull
// requests, and commits the player has contributed to the Grognard repositories.
// Uses the same GitHub token already cached for leaderboard publication
// (see AchievementsDialog.tsx's submitToLeaderboard) - no separate auth flow.

export const FLAG_OF_COMMITMENT_REPOS = [
  'grognard/authoritypacks',
  'grognard/grognard',
  'grognard/plugins',
] as const;

const GITHUB_API = 'https://api.github.com';

// Logged to the console (not surfaced in the UI - this is a decorative
// feature) so a low/zero count can be told apart from a real API failure
// (bad token scope, rate limit, private-repo access) instead of both
// silently looking like "no contributions yet".
const runSearch = async (
  endpoint: 'issues' | 'commits',
  query: string,
  token: string,
): Promise<number> => {
  const response = await fetch(`${GITHUB_API}/search/${endpoint}?q=${encodeURIComponent(query)}`, {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    console.warn(
      `[Flag of Commitment] ${endpoint} search failed (${response.status}) for query "${query}": ${await response.text().catch(() => '<no body>')}`,
    );
    return 0;
  }
  const body = (await response.json()) as { total_count?: number };
  console.debug(`[Flag of Commitment] ${endpoint} search "${query}" -> ${body.total_count ?? 0}`);
  return body.total_count ?? 0;
};

const searchTotalCount = (query: string, token: string) => runSearch('issues', query, token);
const searchCommitCount = (query: string, token: string) => runSearch('commits', query, token);

/** Not part of any interactive login flow - just reads whichever GitHub
 * identity the cached token already belongs to. */
const fetchGithubUsername = async (token: string): Promise<string | null> => {
  const response = await fetch(`${GITHUB_API}/user`, {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { login?: string };
  return body.login ?? null;
};

/** Sum of issues authored + PRs authored + commits authored across the Grognard
 * repos. Returns null (rather than 0) on any failure - a network hiccup or
 * an unlinked GitHub account should never reset earned progress. */
export const fetchFlagOfCommitmentCount = async (token: string): Promise<number | null> => {
  try {
    const username = await fetchGithubUsername(token);
    if (!username) {
      console.warn(
        '[Flag of Commitment] could not resolve a GitHub username from the cached token',
      );
      return null;
    }
    console.debug(`[Flag of Commitment] counting contributions for GitHub user "${username}"`);

    const counts = await Promise.all(
      FLAG_OF_COMMITMENT_REPOS.flatMap((repo) => [
        searchTotalCount(`repo:${repo} type:issue author:${username}`, token),
        searchTotalCount(`repo:${repo} type:pr author:${username}`, token),
        searchCommitCount(`repo:${repo} author:${username}`, token),
      ]),
    );
    return counts.reduce((total, count) => total + count, 0);
  } catch {
    return null;
  }
};
