// Counts progress toward the "Flag of Commitment" ladder: issues, pull
// requests, and commits the player has contributed to the LJB repositories.
// Uses the same GitHub token already cached for leaderboard publication
// (see AchievementsDialog.tsx's submitToLeaderboard) - no separate auth flow.

export const FLAG_OF_COMMITMENT_REPOS = [
  'lejeanbaptiste/authoritypacks',
  'lejeanbaptiste/lejeanbaptiste',
  'lejeanbaptiste/plugins',
] as const;

const GITHUB_API = 'https://api.github.com';

const searchTotalCount = async (query: string, token: string): Promise<number> => {
  const response = await fetch(`${GITHUB_API}/search/issues?q=${encodeURIComponent(query)}`, {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}` },
  });
  if (!response.ok) return 0;
  const body = (await response.json()) as { total_count?: number };
  return body.total_count ?? 0;
};

const searchCommitCount = async (query: string, token: string): Promise<number> => {
  const response = await fetch(`${GITHUB_API}/search/commits?q=${encodeURIComponent(query)}`, {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}` },
  });
  if (!response.ok) return 0;
  const body = (await response.json()) as { total_count?: number };
  return body.total_count ?? 0;
};

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

/** Sum of issues authored + PRs authored + commits authored across the LJB
 * repos. Returns null (rather than 0) on any failure - a network hiccup or
 * an unlinked GitHub account should never reset earned progress. */
export const fetchFlagOfCommitmentCount = async (token: string): Promise<number | null> => {
  try {
    const username = await fetchGithubUsername(token);
    if (!username) return null;

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
