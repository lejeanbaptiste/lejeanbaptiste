/**
 * Identity check: ask GitHub who a token belongs to. Same approach as the
 * leaderboard Worker — the client can claim anything in its request body
 * except this; the token has to actually be valid and GitHub has to vouch
 * for the account. Scope doesn't matter (an empty-scope token that can only
 * `GET /user` is enough), so the client ships a minimal one.
 */

export interface GitHubUser {
  id: number;
  login: string;
}

export async function verifyGitHubUser(
  token: string,
  apiBase = 'https://api.github.com',
): Promise<GitHubUser | null> {
  const response = await fetch(`${apiBase}/user`, {
    headers: {
      authorization: `Bearer ${token}`,
      'user-agent': 'ljb-entity-sync-worker',
      accept: 'application/vnd.github+json',
    },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { id?: unknown; login?: unknown };
  if (typeof data.id !== 'number' || typeof data.login !== 'string') return null;
  return { id: data.id, login: data.login };
}

/** Pull a bearer token out of the Authorization header. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1]!.trim() : null;
}
