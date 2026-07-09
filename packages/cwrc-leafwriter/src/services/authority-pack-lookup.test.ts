import { packResultUri, searchPackContent } from './authority-pack-lookup';
import { parseAuthorityUri } from '../autoTagging/lookupResolve';

const rows = [
  {
    source: 'cbdb',
    authorityId: '31305',
    kind: 'person',
    primaryName: '沈攸之',
    searchStrings: ['沈攸之', '攸之'],
    metadata: { dynasty: '劉宋', startYear: 415, endYear: 478 },
  },
  {
    source: 'cbdb',
    authorityId: '77777',
    kind: 'person',
    primaryName: '沈約',
    searchStrings: ['沈約'],
    metadata: { description: 'Liang historian' },
  },
  {
    source: 'ndl',
    authorityId: '00270123',
    kind: 'person',
    primaryName: '夏目漱石',
    searchStrings: ['夏目漱石', 'なつめそうせき'],
    metadata: { yomi: 'ナツメ, ソウセキ' },
  },
];
const content = rows.map((row) => JSON.stringify(row)).join('\n') + '\n';

describe('searchPackContent', () => {
  it('matches the full name from a partial tagged string', () => {
    const results = searchPackContent(content, 'cbdb', 'person', '攸之');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      label: '沈攸之',
      uri: 'https://cbdb.fas.harvard.edu/person?id=31305',
    });
    expect(results[0]!.description).toContain('劉宋');
  });

  it('matches when the query is longer than the stored variant (攸之 → 沈攸之)', () => {
    const shortRow = JSON.stringify({
      source: 'cbdb',
      authorityId: '1',
      kind: 'person',
      primaryName: '攸之',
      searchStrings: ['攸之'],
    });
    const results = searchPackContent(shortRow, 'cbdb', 'person', '沈攸之');
    expect(results).toHaveLength(1);
  });

  it('ranks exact matches before partials', () => {
    const results = searchPackContent(content, 'cbdb', 'person', '沈攸之');
    expect(results[0]!.label).toBe('沈攸之');
  });

  it('matches NDL yomi variants', () => {
    const results = searchPackContent(content, 'ndl', 'person', 'なつめそうせき');
    expect(results).toHaveLength(1);
    expect(results[0]!.uri).toBe('https://id.ndl.go.jp/auth/ndlna/00270123');
  });

  it('skips corrupt lines and returns nothing for empty queries', () => {
    expect(searchPackContent('not json\n' + content, 'cbdb', 'person', '沈約')).toHaveLength(1);
    expect(searchPackContent(content, 'cbdb', 'person', '  ')).toHaveLength(0);
  });
});

describe('packResultUri round-trips through parseAuthorityUri', () => {
  it.each([
    ['cbdb' as const, 'person' as const, '31305', 'CBDB'],
    ['cbdb' as const, 'place' as const, '900123', 'CBDB'],
    ['dila' as const, 'person' as const, 'A001492', 'DILA'],
    ['dila' as const, 'place' as const, 'PL000123', 'DILA'],
    ['ndl' as const, 'person' as const, '00270123', 'NDL'],
  ])('%s %s %s → %s', (source, entityType, id, idnoType) => {
    const parsed = parseAuthorityUri(packResultUri(source, entityType, id));
    expect(parsed).toMatchObject({ idnoType, value: id });
  });
});
