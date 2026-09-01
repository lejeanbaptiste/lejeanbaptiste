/**
 * Chooses how the sync client gets its bearer token, from `config.auth.mode`.
 * Keeps the rest of the sync code provider-agnostic: `entitySyncClient` just
 * takes a `getToken` function.
 *
 *   github → the cached GitHub token (same identity as the leaderboard)
 *   bearer → a static token the user pasted, kept encrypted
 *   oidc   → an OpenID Connect device flow (not implemented yet — lands with
 *            a non-Cloudflare server, e.g. huma-num / Keycloak)
 */
import { readSyncBearerToken } from './entitySyncAuthSecret';
import type { EntitySyncConfig } from './entitySyncConfig';
import { getCachedLeaderboardToken } from './leaderboardAuth';

export type TokenProvider = () => Promise<string | null>;

export const OIDC_NOT_IMPLEMENTED =
  'OIDC sign-in for entity sync is not implemented yet — use "GitHub" or "Bearer token".';

export const resolveTokenProvider = (config: EntitySyncConfig): TokenProvider => {
  switch (config.auth.mode) {
    case 'bearer':
      return readSyncBearerToken;
    case 'oidc':
      return () => Promise.reject(new Error(OIDC_NOT_IMPLEMENTED));
    case 'github':
    default:
      return getCachedLeaderboardToken;
  }
};

/** True when a usable credential exists for the configured auth mode. */
export const isSignedInForSync = async (config: EntitySyncConfig): Promise<boolean> => {
  try {
    return Boolean(await resolveTokenProvider(config)());
  } catch {
    return false;
  }
};
