import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { lookupAuthorityPackRowsByIds } from './authorityPacks';

describe('lookupAuthorityPackRowsByIds', () => {
  it('returns only matching NDJSON rows from a single-file pack', async () => {
    const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'grognard-pack-lookup-'));
    const packDir = path.join(root, 'authority-packs', 'cbdb');
    await fsp.mkdir(packDir, { recursive: true });
    const lines = [
      JSON.stringify({
        source: 'CBDB',
        authorityId: '1',
        kind: 'person',
        primaryName: '甲',
        searchStrings: ['甲'],
        names: [{ text: '甲', type: 'primary' }],
      }),
      JSON.stringify({
        source: 'CBDB',
        authorityId: '504899',
        kind: 'person',
        primaryName: '陳顯達',
        searchStrings: ['陳顯達'],
        names: [
          { text: '陳顯達', type: 'primary' },
          { text: '陳', type: 'family' },
          { text: '顯達', type: 'given' },
        ],
      }),
      JSON.stringify({
        source: 'CBDB',
        authorityId: '2',
        kind: 'person',
        primaryName: '乙',
        searchStrings: ['乙'],
        names: [{ text: '乙', type: 'primary' }],
      }),
    ];
    await fsp.writeFile(path.join(packDir, 'persons.ndjson'), `${lines.join('\n')}\n`, 'utf8');

    const hit = await lookupAuthorityPackRowsByIds(root, 'cbdb-persons', ['504899']);
    expect(hit).toHaveLength(1);
    expect(JSON.parse(hit[0]!).authorityId).toBe('504899');
    expect(JSON.parse(hit[0]!).primaryName).toBe('陳顯達');

    const missing = await lookupAuthorityPackRowsByIds(root, 'cbdb-persons', ['999999']);
    expect(missing).toEqual([]);

    await fsp.rm(root, { recursive: true, force: true });
  });

  it('scans date-chunked packs including undated', async () => {
    const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'grognard-pack-chunks-'));
    const packDir = path.join(root, 'authority-packs', 'cbdb');
    await fsp.mkdir(path.join(packDir, 'persons'), { recursive: true });
    await fsp.writeFile(path.join(packDir, 'persons.ndjson'), '', 'utf8');
    await fsp.writeFile(
      path.join(packDir, 'persons', '00001-00200.ndjson'),
      `${JSON.stringify({
        source: 'CBDB',
        authorityId: '10',
        kind: 'person',
        primaryName: '早',
        searchStrings: ['早'],
        names: [],
      })}\n`,
      'utf8',
    );
    await fsp.writeFile(
      path.join(packDir, 'persons', 'undated.ndjson'),
      `${JSON.stringify({
        source: 'CBDB',
        authorityId: '504899',
        kind: 'person',
        primaryName: '陳顯達',
        searchStrings: ['陳顯達'],
        names: [{ text: '陳', type: 'family' }],
      })}\n`,
      'utf8',
    );
    await fsp.writeFile(
      path.join(packDir, 'manifest.json'),
      JSON.stringify({
        files: {
          'persons.ndjson': {
            dateChunks: {
              version: 1,
              blockYears: 200,
              chunks: [{ path: 'persons/00001-00200.ndjson', start: 1, end: 200 }],
              undatedPath: 'persons/undated.ndjson',
              includeUndatedForLimit: true,
            },
          },
        },
      }),
      'utf8',
    );

    const hit = await lookupAuthorityPackRowsByIds(root, 'cbdb-persons', ['504899']);
    expect(hit).toHaveLength(1);
    expect(JSON.parse(hit[0]!).primaryName).toBe('陳顯達');

    await fsp.rm(root, { recursive: true, force: true });
  });
});
