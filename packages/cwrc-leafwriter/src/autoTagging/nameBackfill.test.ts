import { addEntity, createEntitiesScaffold, parseEntities } from './entities';
import { listEntities } from './entityOps';
import { backfillEntityNames } from './nameBackfill';
import { clearWikidataNamesCacheForTests, clearWikidataTypedNamesCacheForTests } from './disambiguationMatch';
import type { AuthorityPackId } from './packPaths';

const makeDoc = () => parseEntities(createEntitiesScaffold('test-db'));

const cbdbPackRow = (authorityId: string, names: { text: string; type?: string }[]) =>
  JSON.stringify({
    source: 'CBDB',
    authorityId,
    kind: 'person',
    primaryName: '王安石',
    searchStrings: ['王安石'],
    names,
    metadata: { pinyin: 'Wang Anshi' },
  });

describe('backfillEntityNames', () => {
  afterEach(() => {
    clearWikidataNamesCacheForTests();
    clearWikidataTypedNamesCacheForTests();
  });

  it('adds bare courtesy 字 from a CBDB pack row; second run is a no-op', async () => {
    const doc = makeDoc();
    addEntity(doc, 'person', {
      name: '王安石',
      authorityIds: [{ type: 'CBDB', value: '1762' }],
    });

    const readPackFile = jest.fn(async (packId: AuthorityPackId) => {
      if (packId === 'cbdb-persons') {
        return `${cbdbPackRow('1762', [
          { text: '王安石', type: 'primary' },
          { text: '介甫', type: 'courtesy' },
        ])}\n`;
      }
      throw new Error(`unexpected pack ${packId}`);
    });

    const first = await backfillEntityNames(doc, { readPackFile });
    expect(first).toMatchObject({
      entitiesScanned: 1,
      entitiesUpdated: 1,
      namesAdded: 1,
      cancelled: false,
    });
    expect(listEntities(doc)[0]!.nameEntries).toEqual(
      expect.arrayContaining([{ text: '介甫', lang: null, type: 'courtesy' }]),
    );

    const second = await backfillEntityNames(doc, { readPackFile });
    expect(second).toMatchObject({ entitiesUpdated: 0, namesAdded: 0 });
    expect(listEntities(doc)[0]!.names.filter((name) => name === '介甫')).toHaveLength(1);
  });

  it('does not overwrite an existing typed name', async () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', {
      name: '王安石',
      authorityIds: [{ type: 'CBDB', value: '1762' }],
      altNames: [{ text: '介甫', type: 'variant' }],
    });

    const readPackFile = async (packId: AuthorityPackId) => {
      if (packId === 'cbdb-persons') {
        return `${cbdbPackRow('1762', [
          { text: '王安石', type: 'primary' },
          { text: '介甫', type: 'courtesy' },
        ])}\n`;
      }
      throw new Error(`unexpected pack ${packId}`);
    };

    await backfillEntityNames(doc, { readPackFile });
    const entry = listEntities(doc).find((entity) => entity.id === id)!;
    expect(entry.nameEntries.find((row) => row.text === '介甫')?.type).toBe('variant');
  });

  it('honours abort mid-run', async () => {
    const doc = makeDoc();
    addEntity(doc, 'person', {
      name: '甲',
      authorityIds: [{ type: 'CBDB', value: '1' }],
    });
    addEntity(doc, 'person', {
      name: '乙',
      authorityIds: [{ type: 'CBDB', value: '2' }],
    });

    const controller = new AbortController();
    const readPackFile = async (packId: AuthorityPackId) => {
      if (packId !== 'cbdb-persons') throw new Error('missing');
      return [
        cbdbPackRow('1', [{ text: '甲', type: 'primary' }, { text: '甲字', type: 'courtesy' }]),
        cbdbPackRow('2', [{ text: '乙', type: 'primary' }, { text: '乙字', type: 'courtesy' }]),
      ].join('\n');
    };

    let progressCalls = 0;
    const result = await backfillEntityNames(doc, {
      readPackFile,
      signal: controller.signal,
      onProgress: () => {
        progressCalls += 1;
        if (progressCalls === 1) controller.abort();
      },
    });

    expect(result.cancelled).toBe(true);
    expect(result.entitiesScanned).toBe(1);
    expect(listEntities(doc).some((entity) => entity.names.includes('乙字'))).toBe(false);
  });

  it('merges live Wikidata typed names for Wikidata-linked persons', async () => {
    const doc = makeDoc();
    addEntity(doc, 'person', {
      name: '張衡',
      authorityIds: [{ type: 'Wikidata', value: 'Q11332' }],
    });

    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () =>
      ({
        ok: true,
        json: async () => ({
          entities: {
            Q11332: {
              claims: {
                P1782: [{ mainsnak: { datavalue: { value: { text: '平子', language: 'zh' } } } }],
              },
            },
          },
        }),
      }) as unknown as Response) as unknown as typeof fetch;

    try {
      const result = await backfillEntityNames(doc, { fetchImpl: global.fetch });
      expect(result.namesAdded).toBe(1);
      expect(listEntities(doc)[0]!.nameEntries).toEqual(
        expect.arrayContaining([{ text: '平子', lang: 'zh', type: 'courtesy' }]),
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('counts persons without authorities as skipped when scanning all', async () => {
    const doc = makeDoc();
    addEntity(doc, 'person', { name: '無號' });
    addEntity(doc, 'person', {
      name: '有號',
      authorityIds: [{ type: 'CBDB', value: '99' }],
    });

    const readPackFile = async (packId: AuthorityPackId) => {
      if (packId === 'cbdb-persons') {
        return `${cbdbPackRow('99', [{ text: '有號', type: 'primary' }])}\n`;
      }
      throw new Error('missing');
    };

    const result = await backfillEntityNames(doc, { readPackFile });
    expect(result.skippedNoAuthority).toBe(1);
    expect(result.entitiesScanned).toBe(1);
  });
});
