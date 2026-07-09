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
  it('matches a tagged alternate name exactly', () => {
    const results = searchPackContent(content, 'cbdb', 'person', '攸之');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      label: '沈攸之',
      uri: 'https://cbdb.fas.harvard.edu/person?id=31305',
    });
    expect(results[0]!.description).toContain('劉宋');
  });

  it('does not match a shorter query against a longer alt name that merely contains it', () => {
    const rowWithLongerAltName = JSON.stringify({
      source: 'cbdb',
      authorityId: '1',
      kind: 'person',
      primaryName: '王導',
      searchStrings: ['王導', '王茂弘'],
    });
    const results = searchPackContent(rowWithLongerAltName, 'cbdb', 'person', '王茂');
    expect(results).toHaveLength(0);
  });

  it('does not match a longer query against a shorter stored variant it merely contains', () => {
    const shortRow = JSON.stringify({
      source: 'cbdb',
      authorityId: '1',
      kind: 'person',
      primaryName: '攸之',
      searchStrings: ['攸之'],
    });
    const results = searchPackContent(shortRow, 'cbdb', 'person', '沈攸之');
    expect(results).toHaveLength(0);
  });

  it('matches only the exact row when multiple rows share a substring', () => {
    const results = searchPackContent(content, 'cbdb', 'person', '沈攸之');
    expect(results).toHaveLength(1);
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

  it('strips administrative division markers from place name queries', () => {
    const placeRow = JSON.stringify({
      source: 'dila',
      authorityId: 'PL000000029418',
      kind: 'place',
      primaryName: '會稽',
      searchStrings: ['會稽'],
      metadata: { description: 'place in Zhejiang' },
    });
    const placeContent = placeRow + '\n';

    // With 省 (province), 市 (city), 區 (district), etc., should still match
    expect(searchPackContent(placeContent, 'dila', 'place', '會稽省')).toHaveLength(1);
    expect(searchPackContent(placeContent, 'dila', 'place', '會稽市')).toHaveLength(1);
    expect(searchPackContent(placeContent, 'dila', 'place', '會稽縣')).toHaveLength(1);
    expect(searchPackContent(placeContent, 'dila', 'place', '會稽郡')).toHaveLength(1);

    // Without administrative markers, should also match
    expect(searchPackContent(placeContent, 'dila', 'place', '會稽')).toHaveLength(1);

    // Different base name should not match
    expect(searchPackContent(placeContent, 'dila', 'place', '越州省')).toHaveLength(0);

    // A place row whose canonical name itself ends in an administrative marker
    // (very common — e.g. "武陵郡") must still match on the raw, unstripped query.
    const countyRow = JSON.stringify({
      source: 'dila',
      authorityId: 'PL000000029418',
      kind: 'place',
      primaryName: '武陵郡',
      searchStrings: ['武陵郡'],
      metadata: { description: 'place in Hunan' },
    });
    expect(searchPackContent(countyRow + '\n', 'dila', 'place', '武陵郡')).toHaveLength(1);

    // Non-place entities should NOT strip markers (just in case the name ends with these characters legitimately)
    const personRow = JSON.stringify({
      source: 'cbdb',
      authorityId: '1',
      kind: 'person',
      primaryName: '阿省',
      searchStrings: ['阿省'],
    });
    expect(searchPackContent(personRow + '\n', 'cbdb', 'person', '阿')).toHaveLength(0);
    expect(searchPackContent(personRow + '\n', 'cbdb', 'person', '阿省')).toHaveLength(1);
  });

  it('annotates a place label with the alias that actually matched', () => {
    // DILA lists 吳興 as a historical alternate name of 湖州府 — surface that so
    // the user can see why a search for 吳興 also returned 湖州府.
    const huzhouRow = JSON.stringify({
      source: 'dila',
      authorityId: 'PL000000012997',
      kind: 'place',
      primaryName: '湖州府',
      searchStrings: ['湖州府', '吳興'],
      metadata: { description: '湖州府 (吳興區)' },
    });
    const results = searchPackContent(huzhouRow + '\n', 'dila', 'place', '吳興');
    expect(results).toHaveLength(1);
    expect(results[0]!.label).toBe('湖州府（吳興）');

    // Searching by the row's own primary name should not add a redundant annotation.
    const directResults = searchPackContent(huzhouRow + '\n', 'dila', 'place', '湖州府');
    expect(directResults).toHaveLength(1);
    expect(directResults[0]!.label).toBe('湖州府');
  });

  it('does not annotate person labels matched via an alt name', () => {
    // Existing behavior for persons (e.g. courtesy names) is unannotated —
    // alias annotation is currently scoped to places only.
    const results = searchPackContent(content, 'cbdb', 'person', '攸之');
    expect(results[0]!.label).toBe('沈攸之');
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
