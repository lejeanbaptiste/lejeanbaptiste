import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { COMPILE_POLICY_VERSION } from '../../commons/src/desktop/authorityLifecycleTypes';
import {
  isUpdateAvailable,
  parseLifecycleConfig,
  readLifecycleConfig,
  writeLifecycleConfig,
} from './authorityLifecycle';

describe('parseLifecycleConfig', () => {
  it('accepts a valid lifecycle file', () => {
    const parsed = parseLifecycleConfig(
      JSON.stringify({
        version: 1,
        enabled: true,
        compilePolicyVersion: COMPILE_POLICY_VERSION,
        declinedFirstPrompt: false,
      }),
    );
    expect(parsed?.enabled).toBe(true);
    expect(parsed?.compilePolicyVersion).toBe(COMPILE_POLICY_VERSION);
  });

  it('rejects malformed lifecycle files', () => {
    expect(parseLifecycleConfig('not json')).toBeNull();
    expect(parseLifecycleConfig(JSON.stringify({ version: 2, enabled: true }))).toBeNull();
    expect(parseLifecycleConfig(JSON.stringify({ version: 1 }))).toBeNull();
  });
});

describe('lifecycle persistence', () => {
  let entityFolder: string;

  beforeEach(async () => {
    entityFolder = await fsp.mkdtemp(path.join(os.tmpdir(), 'authority-lifecycle-'));
    await fsp.mkdir(path.join(entityFolder, 'authority-databases'), { recursive: true });
  });

  afterEach(async () => {
    await fsp.rm(entityFolder, { recursive: true, force: true });
  });

  it('returns defaults when lifecycle.json is missing', async () => {
    const config = await readLifecycleConfig(entityFolder);
    expect(config.enabled).toBe(false);
    expect(config.declinedFirstPrompt).toBe(false);
  });

  it('writes lifecycle.json atomically', async () => {
    const next = await writeLifecycleConfig(entityFolder, {
      enabled: true,
      compilePolicyVersion: COMPILE_POLICY_VERSION,
    });
    expect(next.enabled).toBe(true);
    const reread = await readLifecycleConfig(entityFolder);
    expect(reread.enabled).toBe(true);
    expect(reread.compilePolicyVersion).toBe(COMPILE_POLICY_VERSION);
  });
});

describe('isUpdateAvailable', () => {
  const installedPacks = [
    { id: 'cbdb-persons' as const, label: 'CBDB persons', installed: true },
    { id: 'cbdb-places' as const, label: 'CBDB places', installed: true },
    { id: 'cbdb-offices' as const, label: 'CBDB offices', installed: true },
    { id: 'dila-persons' as const, label: 'DILA persons', installed: true },
    { id: 'dila-places' as const, label: 'DILA places', installed: true },
  ];

  it('is false when disabled', () => {
    expect(
      isUpdateAvailable({ version: 1, enabled: false }, installedPacks, null, null, []),
    ).toBe(false);
  });

  it('is true when compile policy is outdated', () => {
    expect(
      isUpdateAvailable(
        { version: 1, enabled: true, compilePolicyVersion: '2020-01-01' },
        installedPacks,
        {
          bundleVersion: '2026-07-05+cbdb20260627',
          compilePolicyVersion: '2020-01-01',
          tarballSha256: 'a'.repeat(64),
          installedAt: '',
        },
        null,
        [],
      ),
    ).toBe(true);
  });

  it('is true when remote bundle is newer', () => {
    expect(
      isUpdateAvailable(
        { version: 1, enabled: true, compilePolicyVersion: COMPILE_POLICY_VERSION },
        installedPacks,
        {
          bundleVersion: 'old',
          compilePolicyVersion: COMPILE_POLICY_VERSION,
          tarballSha256: 'a'.repeat(64),
          installedAt: '',
        },
        {
          schemaVersion: 1,
          bundleVersion: '2026-07-05+cbdb20260627',
          compilePolicyVersion: COMPILE_POLICY_VERSION,
          builtAt: '',
          tarball: { fileName: 'x.tar.gz', bytes: 1, sha256: 'b'.repeat(64) },
          files: [],
        },
        [],
      ),
    ).toBe(true);
  });
});
