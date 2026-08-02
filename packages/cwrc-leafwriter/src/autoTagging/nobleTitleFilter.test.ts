import { applyNobleTitleFilter, buildNobleTitleFilterIndex } from './nobleTitleFilter';
import type { AuthorityCandidate } from './authority';

const title: AuthorityCandidate = {
  source: 'Noble title filter (CBDB)',
  authorityId: 'noble-title-filter:cbdb:1',
  kind: 'person',
  primaryName: '海鹽公主',
  searchStrings: ['海鹽公主'],
  metadata: {
    isNobleTitle: true,
    nobleTitleFilter: { source: 'CBDB', ruleId: 'haiyan' },
    nobleTitle: { fief: '海鹽', roleName: '公主' },
    teiTag: 'nobleTitle',
  },
};

describe('noble-title filter', () => {
  it('replaces an approved external surface with the derived title candidate', () => {
    const person: AuthorityCandidate = {
      source: 'CBDB', authorityId: '1', kind: 'person', primaryName: '海鹽公主',
      searchStrings: ['海鹽公主', '蕭氏'], names: [{ text: '海鹽公主', type: 'variant' }, { text: '蕭氏', type: 'variant' }],
    };
    const result = applyNobleTitleFilter(person, buildNobleTitleFilterIndex([title]));
    expect(result.candidate?.searchStrings).toEqual(['蕭氏']);
    expect(result.candidate?.names?.map((name) => name.text)).toEqual(['蕭氏']);
    expect(result.titleCandidates).toEqual([title]);
  });

  it('does not apply a source-specific rule to another authority', () => {
    const person: AuthorityCandidate = {
      source: 'DILA', authorityId: '1', kind: 'person', primaryName: '海鹽公主', searchStrings: ['海鹽公主'],
    };
    const result = applyNobleTitleFilter(person, buildNobleTitleFilterIndex([title]));
    expect(result.candidate).toEqual(person);
    expect(result.titleCandidates).toEqual([]);
  });
});
