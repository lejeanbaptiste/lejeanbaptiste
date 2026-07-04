import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  AUTHORITY_SOURCES,
  getAuthorityStatuses,
  manifestPath,
  parseAuthorityManifest,
  type AuthorityManifest,
} from './authorityDatabases';

const validManifest = (files: AuthorityManifest['files']): AuthorityManifest => ({
  source: 'dila',
  version: 'test-version',
  files,
  installedAt: '2026-07-04T00:00:00.000Z',
});

describe('parseAuthorityManifest', () => {
  const fileEntry = {
    fileName: 'dila-person.xml',
    sha256: 'a'.repeat(64),
    bytes: 123,
    upstreamUrl: 'https://example.org/x.xml',
  };

  it('accepts a valid manifest', () => {
    const parsed = parseAuthorityManifest(JSON.stringify(validManifest([fileEntry])));
    expect(parsed?.source).toBe('dila');
    expect(parsed?.files).toHaveLength(1);
  });

  it('rejects malformed manifests', () => {
    expect(parseAuthorityManifest('not json')).toBeNull();
    expect(parseAuthorityManifest(JSON.stringify({}))).toBeNull();
    expect(
      parseAuthorityManifest(JSON.stringify({ ...validManifest([fileEntry]), source: 'nope' })),
    ).toBeNull();
    expect(parseAuthorityManifest(JSON.stringify(validManifest([])))).toBeNull();
    expect(
      parseAuthorityManifest(
        JSON.stringify(validManifest([{ ...fileEntry, sha256: 'short' }])),
      ),
    ).toBeNull();
    expect(
      parseAuthorityManifest(JSON.stringify(validManifest([{ ...fileEntry, bytes: 0 }]))),
    ).toBeNull();
  });
});

describe('getAuthorityStatuses', () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'authority-db-'));
  });

  afterEach(async () => {
    await fsp.rm(baseDir, { recursive: true, force: true });
  });

  it('reports every known source as not installed with no base dir', async () => {
    const statuses = await getAuthorityStatuses(null);
    expect(statuses.map((s) => s.id)).toEqual(AUTHORITY_SOURCES.map((s) => s.id));
    expect(statuses.every((s) => !s.installed)).toBe(true);
  });

  it('requires manifest files to exist with the recorded size', async () => {
    const content = '<xml/>';
    await fsp.writeFile(path.join(baseDir, 'dila-person.xml'), content);
    const manifest = validManifest([
      {
        fileName: 'dila-person.xml',
        sha256: 'a'.repeat(64),
        bytes: Buffer.byteLength(content),
        upstreamUrl: 'https://example.org/x.xml',
      },
    ]);
    await fsp.writeFile(manifestPath(baseDir, 'dila'), JSON.stringify(manifest));

    let statuses = await getAuthorityStatuses(baseDir);
    expect(statuses.find((s) => s.id === 'dila')?.installed).toBe(true);
    expect(statuses.find((s) => s.id === 'dila')?.version).toBe('test-version');
    expect(statuses.find((s) => s.id === 'cbdb')?.installed).toBe(false);

    // Size mismatch → not installed.
    await fsp.writeFile(path.join(baseDir, 'dila-person.xml'), `${content} changed`);
    statuses = await getAuthorityStatuses(baseDir);
    expect(statuses.find((s) => s.id === 'dila')?.installed).toBe(false);

    // Missing file → not installed.
    await fsp.rm(path.join(baseDir, 'dila-person.xml'));
    statuses = await getAuthorityStatuses(baseDir);
    expect(statuses.find((s) => s.id === 'dila')?.installed).toBe(false);
  });
});
