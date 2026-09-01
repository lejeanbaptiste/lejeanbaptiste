jest.mock('./leaderboardAuth', () => ({
  getCachedLeaderboardToken: jest.fn(async () => 'github-token'),
}));
jest.mock('./entitySyncAuthSecret', () => ({
  readSyncBearerToken: jest.fn(async () => 'bearer-token'),
}));

import { getCachedLeaderboardToken } from './leaderboardAuth';
import { readSyncBearerToken } from './entitySyncAuthSecret';
import {
  OIDC_NOT_IMPLEMENTED,
  isSignedInForSync,
  resolveTokenProvider,
} from './entitySyncTokenProvider';
import type { EntitySyncConfig } from './entitySyncConfig';

const configWith = (mode: EntitySyncConfig['auth']['mode']): EntitySyncConfig => ({
  enabled: true,
  endpoint: 'https://sync.example',
  intervalMinutes: 5,
  auth: { mode },
});

describe('resolveTokenProvider', () => {
  it('github mode uses the cached leaderboard token', async () => {
    expect(await resolveTokenProvider(configWith('github'))()).toBe('github-token');
    expect(getCachedLeaderboardToken).toHaveBeenCalled();
  });

  it('bearer mode uses the stored bearer token', async () => {
    expect(await resolveTokenProvider(configWith('bearer'))()).toBe('bearer-token');
    expect(readSyncBearerToken).toHaveBeenCalled();
  });

  it('oidc mode rejects until implemented', async () => {
    await expect(resolveTokenProvider(configWith('oidc'))()).rejects.toThrow(OIDC_NOT_IMPLEMENTED);
  });
});

describe('isSignedInForSync', () => {
  it('is true when the provider yields a token', async () => {
    expect(await isSignedInForSync(configWith('github'))).toBe(true);
    expect(await isSignedInForSync(configWith('bearer'))).toBe(true);
  });

  it('is false when the provider throws (oidc) or yields nothing', async () => {
    expect(await isSignedInForSync(configWith('oidc'))).toBe(false);
    (readSyncBearerToken as jest.Mock).mockResolvedValueOnce(null);
    expect(await isSignedInForSync(configWith('bearer'))).toBe(false);
  });
});
