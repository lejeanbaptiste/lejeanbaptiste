import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpDir: string;

jest.mock('electron', () => ({
  app: { getPath: () => tmpDir },
}));

import {
  isSyncConfigured,
  readSyncConfig,
  syncConfigConstants,
  writeSyncConfig,
} from './entitySyncConfig';

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'grognard-sync-config-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('entitySyncConfig', () => {
  it('returns disabled defaults when no file exists', async () => {
    expect(await readSyncConfig()).toEqual({
      enabled: false,
      endpoint: '',
      intervalMinutes: syncConfigConstants.DEFAULT_INTERVAL_MINUTES,
      auth: { mode: 'github', issuer: undefined, clientId: undefined },
    });
  });

  it('defaults auth to github and validates the mode', async () => {
    expect((await writeSyncConfig({ auth: { mode: 'bogus' as never } })).auth.mode).toBe('github');
    const bearer = await writeSyncConfig({ auth: { mode: 'bearer' } });
    expect(bearer.auth.mode).toBe('bearer');
    const oidc = await writeSyncConfig({
      auth: { mode: 'oidc', issuer: 'https://auth.example/realms/x/', clientId: ' cid ' },
    });
    expect(oidc.auth).toEqual({
      mode: 'oidc',
      issuer: 'https://auth.example/realms/x',
      clientId: 'cid',
    });
  });

  it('merges an auth patch over the stored auth', async () => {
    await writeSyncConfig({ auth: { mode: 'oidc', issuer: 'https://a', clientId: 'c' } });
    const merged = await writeSyncConfig({ auth: { clientId: 'c2' } });
    expect(merged.auth).toEqual({ mode: 'oidc', issuer: 'https://a', clientId: 'c2' });
  });

  it('trims the endpoint and drops a trailing slash', async () => {
    const saved = await writeSyncConfig({
      enabled: true,
      endpoint: '  https://grognard-entity-sync.example.workers.dev/  ',
    });
    expect(saved.endpoint).toBe('https://grognard-entity-sync.example.workers.dev');
    expect((await readSyncConfig()).endpoint).toBe(
      'https://grognard-entity-sync.example.workers.dev',
    );
  });

  it('clamps the interval into range', async () => {
    expect((await writeSyncConfig({ intervalMinutes: 0 })).intervalMinutes).toBe(
      syncConfigConstants.MIN_INTERVAL_MINUTES,
    );
    expect((await writeSyncConfig({ intervalMinutes: 99999 })).intervalMinutes).toBe(
      syncConfigConstants.MAX_INTERVAL_MINUTES,
    );
  });

  it('merges patches over the stored config', async () => {
    await writeSyncConfig({ enabled: true, endpoint: 'https://a.example', intervalMinutes: 10 });
    const merged = await writeSyncConfig({ intervalMinutes: 15 });
    expect(merged).toMatchObject({
      enabled: true,
      endpoint: 'https://a.example',
      intervalMinutes: 15,
    });
  });

  it('falls back to defaults on a corrupt file', async () => {
    await fs.writeFile(path.join(tmpDir, 'entity-sync-config.json'), '{ not json');
    expect((await readSyncConfig()).enabled).toBe(false);
  });

  it('isSyncConfigured requires both enabled and an endpoint', () => {
    const auth = { mode: 'github' as const };
    expect(
      isSyncConfigured({ enabled: true, endpoint: 'https://a', intervalMinutes: 5, auth }),
    ).toBe(true);
    expect(
      isSyncConfigured({ enabled: false, endpoint: 'https://a', intervalMinutes: 5, auth }),
    ).toBe(false);
    expect(isSyncConfigured({ enabled: true, endpoint: '', intervalMinutes: 5, auth })).toBe(false);
  });
});
