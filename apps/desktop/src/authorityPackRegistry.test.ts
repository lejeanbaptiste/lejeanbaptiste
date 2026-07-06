import {
  artifactRawUrl,
  parsePacksIndex,
  parsePacksManifest,
  packsIndexUrl,
  AUTHORITY_PACK_REGISTRY,
} from '../../commons/src/desktop/authorityPackRegistryTypes';
import { remotePackUpdateAvailable } from './authorityPackRegistry';

describe('authorityPackRegistryTypes', () => {
  it('builds GitLab artifact URLs', () => {
    expect(packsIndexUrl()).toBe(
      'https://gitlab.huma-num.fr/dmorgan1/ljb-authorities/-/jobs/artifacts/main/raw/dist/packs-index.json?job=build-packs',
    );
    expect(artifactRawUrl(AUTHORITY_PACK_REGISTRY, 'authority-packs-x.tar.gz')).toBe(
      'https://gitlab.huma-num.fr/dmorgan1/ljb-authorities/-/jobs/artifacts/main/raw/dist/authority-packs-x.tar.gz?job=build-packs',
    );
  });

  it('parses a packs index', () => {
    const parsed = parsePacksIndex(
      JSON.stringify({
        schemaVersion: 1,
        bundleVersion: '2026-07-05+cbdb20260627',
        compilePolicyVersion: '2026-07-05',
        builtAt: '2026-07-05T00:00:00.000Z',
        tarball: {
          fileName: 'authority-packs-2026-07-05+cbdb20260627.tar.gz',
          bytes: 100,
          sha256: 'a'.repeat(64),
        },
        files: [{ path: 'cbdb/manifest.json', bytes: 1, sha256: 'b'.repeat(64) }],
      }),
    );
    expect(parsed?.bundleVersion).toBe('2026-07-05+cbdb20260627');
  });

  it('parses an installed packs manifest', () => {
    const parsed = parsePacksManifest(
      JSON.stringify({
        bundleVersion: '2026-07-05+cbdb20260627',
        compilePolicyVersion: '2026-07-05',
        tarballSha256: 'c'.repeat(64),
        installedAt: '2026-07-05T00:00:00.000Z',
      }),
    );
    expect(parsed?.bundleVersion).toContain('cbdb');
  });
});

describe('remotePackUpdateAvailable', () => {
  const remote = {
    schemaVersion: 1,
    bundleVersion: '2026-07-05+cbdb20260627',
    compilePolicyVersion: '2026-07-05',
    builtAt: '',
    tarball: { fileName: 'x.tar.gz', bytes: 1, sha256: 'a'.repeat(64) },
    files: [],
  };

  it('is true when nothing installed locally', () => {
    expect(remotePackUpdateAvailable(null, remote, '2026-07-05')).toBe(true);
  });

  it('is false when versions match', () => {
    expect(
      remotePackUpdateAvailable(
        {
          bundleVersion: '2026-07-05+cbdb20260627',
          compilePolicyVersion: '2026-07-05',
          tarballSha256: 'a'.repeat(64),
          installedAt: '',
        },
        remote,
        '2026-07-05',
      ),
    ).toBe(false);
  });
});
