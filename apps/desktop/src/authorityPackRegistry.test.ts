import {
  artifactRawUrl,
  parsePacksIndex,
  parsePacksManifest,
  packsIndexUrl,
  AUTHORITY_PACK_REGISTRY,
  type AuthorityPacksIndex,
} from '../../commons/src/desktop/authorityPackRegistryTypes';
import { remotePackUpdateAvailable } from './authorityPackRegistry';

describe('authorityPackRegistryTypes', () => {
  it('builds GitHub release asset URLs', () => {
    expect(packsIndexUrl()).toBe(
      'https://github.com/lejeanbaptiste/authoritypacks/releases/latest/download/packs-index.json',
    );
    expect(artifactRawUrl(AUTHORITY_PACK_REGISTRY, 'authority-packs-x.tar.gz')).toBe(
      'https://github.com/lejeanbaptiste/authoritypacks/releases/latest/download/authority-packs-x.tar.gz',
    );
  });

  it('parses a packs index', () => {
    const parsed = parsePacksIndex(
      JSON.stringify({
        schemaVersion: 1,
        bundleVersion: '2026-07-05+cbdb20260627',
        compilePolicyVersion: '2026-07-05',
        builtAt: '2026-07-05T00:00:00.000Z',
        defaultBundleId: 'chinese',
        bundles: [
          {
            id: 'chinese',
            fileName: 'authority-packs-chinese.tar.gz',
            bytes: 100,
            sha256: 'a'.repeat(64),
            files: [{ path: 'cbdb/manifest.json', bytes: 1, sha256: 'b'.repeat(64) }],
          },
        ],
      }),
    );
    expect(parsed?.bundleVersion).toBe('2026-07-05+cbdb20260627');
  });

  it('parses an installed packs manifest', () => {
    const parsed = parsePacksManifest(
      JSON.stringify({
        bundleVersion: '2026-07-05+cbdb20260627',
        compilePolicyVersion: '2026-07-05',
        bundles: { chinese: { sha256: 'c'.repeat(64), installedAt: '2026-07-05T00:00:00.000Z' } },
        installedAt: '2026-07-05T00:00:00.000Z',
      }),
    );
    expect(parsed?.bundleVersion).toContain('cbdb');
    expect(parsed?.bundles.chinese?.sha256).toBe('c'.repeat(64));
  });

  it('upgrades a legacy single-bundle manifest to the chinese bundle', () => {
    const parsed = parsePacksManifest(
      JSON.stringify({
        bundleVersion: '2026-07-05+cbdb20260627',
        compilePolicyVersion: '2026-07-05',
        tarballSha256: 'c'.repeat(64),
        installedAt: '2026-07-05T00:00:00.000Z',
      }),
    );
    expect(parsed?.bundles.chinese?.sha256).toBe('c'.repeat(64));
  });
});

describe('remotePackUpdateAvailable', () => {
  const remote: AuthorityPacksIndex = {
    schemaVersion: 1,
    bundleVersion: '2026-07-05+cbdb20260627',
    compilePolicyVersion: '2026-07-05',
    builtAt: '',
    defaultBundleId: 'chinese',
    bundles: [
      {
        id: 'chinese',
        fileName: 'authority-packs-chinese.tar.gz',
        bytes: 1,
        sha256: 'a'.repeat(64),
        files: [{ path: 'cbdb/manifest.json', bytes: 1, sha256: 'b'.repeat(64) }],
      },
    ],
  };

  it('is true when nothing installed locally', () => {
    expect(remotePackUpdateAvailable(null, remote, '2026-07-05', 'chinese')).toBe(true);
  });

  it('is false when the installed bundle hash matches', () => {
    expect(
      remotePackUpdateAvailable(
        {
          bundleVersion: '2026-07-05+cbdb20260627',
          compilePolicyVersion: '2026-07-05',
          bundles: { chinese: { sha256: 'a'.repeat(64), installedAt: '' } },
          installedAt: '',
        },
        remote,
        '2026-07-05',
        'chinese',
      ),
    ).toBe(false);
  });

  it('is true for a profile whose bundle is not installed yet', () => {
    const multiRemote = {
      ...remote,
      bundles: [
        ...(remote.bundles ?? []),
        {
          id: 'tibetan' as const,
          fileName: 'authority-packs-tibetan.tar.gz',
          bytes: 1,
          sha256: 'd'.repeat(64),
          files: [{ path: 'wikidata/person-bo/manifest.json', bytes: 1, sha256: 'e'.repeat(64) }],
        },
      ],
    };
    expect(
      remotePackUpdateAvailable(
        {
          bundleVersion: '2026-07-05+cbdb20260627',
          compilePolicyVersion: '2026-07-05',
          bundles: { chinese: { sha256: 'a'.repeat(64), installedAt: '' } },
          installedAt: '',
        },
        multiRemote,
        '2026-07-05',
        'tibetan',
      ),
    ).toBe(true);
  });
});
