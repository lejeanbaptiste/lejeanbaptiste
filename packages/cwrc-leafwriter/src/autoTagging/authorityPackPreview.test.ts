import type { AuthorityPackId } from './packPaths';
import { countAuthorityPackStrings } from './authorityPackPreview';

const ndjson = (rows: object[]) => rows.map((row) => JSON.stringify(row)).join('\n');

describe('countAuthorityPackStrings', () => {
  const packs: Partial<Record<AuthorityPackId, string>> = {
    'cbdb-persons': ndjson([
      {
        source: 'CBDB',
        authorityId: '1',
        kind: 'person',
        primaryName: '王安石',
        searchStrings: ['王安石'],
        metadata: { startYear: 1021, endYear: 1086 },
      },
    ]),
    'wikidata-persons-tang': ndjson([
      {
        source: 'Wikidata',
        authorityId: 'Q1',
        kind: 'person',
        primaryName: '李白',
        searchStrings: ['李白', '李太白'],
        metadata: { startYear: 701, endYear: 762 },
      },
    ]),
    'wikidata-persons-ming': ndjson([
      {
        source: 'Wikidata',
        authorityId: 'Q2',
        kind: 'person',
        primaryName: '王安石',
        searchStrings: ['王安石'],
        metadata: { startYear: 1021, endYear: 1086 },
      },
    ]),
  };

  const readPackFile = async (packId: AuthorityPackId) => packs[packId] ?? '';

  it('counts per UI pack and unions wikidata child packs', async () => {
    const installed = new Set([
      'cbdb-persons',
      'wikidata-persons-tang',
      'wikidata-persons-ming',
    ] as const);
    const counts = await countAuthorityPackStrings(
      ['cbdb-persons', 'wikidata-persons'],
      readPackFile,
      installed,
    );
    expect(counts['cbdb-persons']).toEqual({ entities: 1, uniqueStrings: 1 });
    expect(counts['wikidata-persons']).toEqual({ entities: 2, uniqueStrings: 3 });
  });

  it('applies the year filter', async () => {
    const installed = new Set(['wikidata-persons-tang', 'wikidata-persons-ming'] as const);
    const counts = await countAuthorityPackStrings(
      ['wikidata-persons'],
      readPackFile,
      installed,
      { mode: 'limit', start: 600, end: 900 },
    );
    expect(counts['wikidata-persons']).toEqual({ entities: 1, uniqueStrings: 2 });
  });
});
