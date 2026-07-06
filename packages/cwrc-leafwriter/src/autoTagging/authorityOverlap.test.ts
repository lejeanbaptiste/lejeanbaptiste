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

  it('merges CHGIS and CBDB places linked by crosswalk', () => {
    const cbdbPlace: AuthorityCandidate = {
      source: 'CBDB',
      authorityId: '3535',
      kind: 'place',
      primaryName: '保德',
      searchStrings: ['保德'],
      metadata: { description: 'CBDB 保德' },
    };
    const chgisPlace: AuthorityCandidate = {
      source: 'CHGIS',
      authorityId: '95002',
      kind: 'place',
      primaryName: '保德县',
      searchStrings: ['保德县', '保德'],
      metadata: {
        description: 'CHGIS 保德县',
        crosswalk: { cbdb: '3535', chgis: '95002' },
      },
    };
    expect(canonicalEntityKey(cbdbPlace)).toBe('place:CBDB:3535');
    expect(canonicalEntityKey(chgisPlace)).toBe('place:CBDB:3535');
    const merged = collapseLinkedCandidates([cbdbPlace, chgisPlace]);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('CBDB+CHGIS');
    expect(merged[0].searchStrings.sort()).toEqual(['保德', '保德县']);
  });

  it('merges CHGIS and DILA places linked by crosswalk', () => {
    const chgisPlace: AuthorityCandidate = {
      source: 'CHGIS',
      authorityId: '12345',
      kind: 'place',
      primaryName: '襄陽',
      searchStrings: ['襄陽'],
      metadata: {
        startYear: 618,
        endYear: 907,
        description: 'CHGIS 襄陽',
        crosswalk: { chgis: '12345', dila: 'PL000000027120' },
      },
    };
    const dilaPlace: AuthorityCandidate = {
      source: 'DILA',
      authorityId: 'PL000000027120',
      kind: 'place',
      primaryName: '襄陽',
      searchStrings: ['襄陽', '襄沔'],
      metadata: {
        description: 'DILA 襄陽',
        crosswalk: { chgis: '12345' },
      },
    };
    expect(canonicalEntityKey(chgisPlace)).toBe('place:CHGIS:12345');
    expect(canonicalEntityKey(dilaPlace)).toBe('place:CHGIS:12345');
    const merged = collapseLinkedCandidates([chgisPlace, dilaPlace]);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('CHGIS+DILA');
    expect(merged[0].searchStrings.sort()).toEqual(['襄沔', '襄陽']);
    expect(merged[0].metadata?.crosswalk?.chgis).toBe('12345');
    expect(merged[0].metadata?.crosswalk?.dila).toBe('PL000000027120');
    expect(merged[0].metadata?.startYear).toBe(618);
  });

  it('merges CHGIS and DILA places with the same primary name when crosswalk is missing', () => {
    const chgisPlace: AuthorityCandidate = {
      source: 'CHGIS',
      authorityId: '12345',
      kind: 'place',
      primaryName: '襄陽',
      searchStrings: ['襄陽'],
      metadata: { description: 'CHGIS 襄陽' },
    };
    const dilaPlace: AuthorityCandidate = {
      source: 'DILA',
      authorityId: 'PL000000027120',
      kind: 'place',
      primaryName: '襄陽',
      searchStrings: ['襄陽', '襄沔'],
      metadata: { description: 'DILA 襄陽' },
    };
    const merged = collapseLinkedCandidates([chgisPlace, dilaPlace]);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('CHGIS+DILA');
    expect(merged[0].searchStrings.sort()).toEqual(['襄沔', '襄陽']);
  });
});
