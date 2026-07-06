import type { AuthorityCandidate } from './authority';
import {
  canonicalEntityKey,
  collapseLinkedCandidates,
  mergeAuthorityCandidates,
  normalizeCbdbId,
} from './authorityOverlap';

describe('authorityOverlap', () => {
  const cbdbWang: AuthorityCandidate = {
    source: 'CBDB',
    authorityId: '1762',
    kind: 'person',
    primaryName: '王安石',
    searchStrings: ['王安石'],
    metadata: { startYear: 1021, endYear: 1086, description: 'CBDB 王安石' },
  };

  const dilaWang: AuthorityCandidate = {
    source: 'DILA',
    authorityId: 'A002401',
    kind: 'person',
    primaryName: '王安石',
    searchStrings: ['王安石', '王介甫'],
    metadata: {
      startYear: 1021,
      endYear: 1086,
      description: 'DILA 王安石',
      crosswalk: { cbdb: '01762' },
    },
  };

  it('normalizes CBDB ids for crosswalk matching', () => {
    expect(normalizeCbdbId('01762')).toBe('1762');
    expect(canonicalEntityKey(cbdbWang)).toBe('person:CBDB:1762');
    expect(canonicalEntityKey(dilaWang)).toBe('person:CBDB:1762');
  });

  it('merges linked CBDB and DILA candidates', () => {
    const merged = mergeAuthorityCandidates(cbdbWang, dilaWang);
    expect(merged.source).toBe('CBDB+DILA');
    expect(merged.searchStrings.sort()).toEqual(['王介甫', '王安石']);
    expect(merged.metadata?.description).toContain('CBDB 王安石');
    expect(merged.metadata?.description).toContain('DILA 王安石');
    expect(merged.metadata?.crosswalk?.cbdb).toBe('1762');
  });

  it('collapseLinkedCandidates keeps distinct people with the same surface', () => {
    const other: AuthorityCandidate = {
      source: 'CBDB',
      authorityId: '9999',
      kind: 'person',
      primaryName: '王安石',
      searchStrings: ['王安石'],
      metadata: { description: 'Different person' },
    };
    const collapsed = collapseLinkedCandidates([cbdbWang, dilaWang, other]);
    expect(collapsed).toHaveLength(2);
    expect(collapsed.some((c) => c.source.includes('DILA'))).toBe(true);
    expect(collapsed.some((c) => c.authorityId === '9999')).toBe(true);
  });
});
