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

  it('uses CBDB internal canonical person ids for duplicate rows', () => {
    const canonical = {
      source: 'CBDB',
      authorityId: '141',
      kind: 'person',
      primaryName: '喬維岳',
      searchStrings: ['喬維岳'],
      metadata: { canonicalEntityId: 'cbdb:person:141' },
    } as AuthorityCandidate;
    const duplicate = {
      source: 'CBDB',
      authorityId: '96120',
      kind: 'person',
      primaryName: '喬維岳',
      searchStrings: ['喬維岳'],
      metadata: { canonicalEntityId: 'cbdb:person:141' },
    } as AuthorityCandidate;
    expect(canonicalEntityKey(canonical)).toBe(canonicalEntityKey(duplicate));
  });

  it('merges linked CBDB and DILA candidates', () => {
    const merged = mergeAuthorityCandidates(cbdbWang, dilaWang);
    expect(merged.source).toBe('CBDB+DILA');
    expect(merged.searchStrings.sort()).toEqual(['王介甫', '王安石']);
    expect(merged.metadata?.description).toContain('CBDB 王安石');
    expect(merged.metadata?.description).toContain('DILA 王安石');
    expect(merged.metadata?.crosswalk?.cbdb).toBe('1762');
  });

  it('merges Norbert and CBDB person candidates via crosswalk and stamps both ids', () => {
    const norbertWang: AuthorityCandidate = {
      source: 'Norbert',
      authorityId: '9001',
      kind: 'person',
      primaryName: '王安石',
      searchStrings: ['王安石'],
      metadata: { crosswalk: { cbdb: '1762' } },
    };
    const merged = mergeAuthorityCandidates(cbdbWang, norbertWang);
    expect(merged.source).toBe('CBDB+Norbert');
    expect(merged.metadata?.crosswalk?.cbdb).toBe('1762');
    expect(merged.metadata?.crosswalk?.norbert).toBe('9001');

    const cbdbWithNorbert: AuthorityCandidate = {
      ...cbdbWang,
      metadata: { ...cbdbWang.metadata, crosswalk: { norbert: '9001' } },
    };
    const norbertOnly: AuthorityCandidate = {
      source: 'Norbert',
      authorityId: '9001',
      kind: 'person',
      primaryName: '王安石',
      searchStrings: ['王安石'],
    };
    const collapsed = collapseLinkedCandidates([cbdbWithNorbert, norbertOnly]);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]?.source).toBe('CBDB+Norbert');
    expect(collapsed[0]?.metadata?.crosswalk?.norbert).toBe('9001');
  });

  it('unions appointment assertions when person candidates overlap', () => {
    const merged = mergeAuthorityCandidates(
      {
        ...cbdbWang,
        metadata: {
          appointments: [
            {
              source: 'CBDB',
              authorityId: 'posting:1',
              person: { source: 'CBDB', authorityId: '1762' },
              office: { source: 'CBDB', authorityId: '42', name: '尚書' },
            },
          ],
        },
      },
      {
        ...dilaWang,
        source: 'Norbert',
        metadata: {
          crosswalk: { cbdb: '1762' },
          appointments: [
            {
              source: 'Norbert',
              authorityId: 'person_offices:9',
              person: { source: 'Norbert', authorityId: '123' },
              office: { source: 'Norbert', authorityId: '7', name: '侍中' },
            },
          ],
        },
      },
    );
    expect(merged.metadata?.appointments).toHaveLength(2);
    expect(merged.metadata?.appointments?.map((a) => a.office.name)).toEqual(['尚書', '侍中']);
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

  describe('geo-aware place merging (placename-geo-disambiguation)', () => {
    function jingling(source: string, authorityId: string, geo?: { lat: number; lon: number }) {
      const candidate: AuthorityCandidate = {
        source,
        authorityId,
        kind: 'place',
        primaryName: '竟陵',
        searchStrings: ['竟陵'],
        metadata: { description: `${source} 竟陵`, geo },
      };
      return candidate;
    }

    it('merges same-named places within the proximity threshold', () => {
      const cbdb = jingling('CBDB', 'c1', { lat: 30.65, lon: 113.15 });
      const chgis = jingling('CHGIS', 'ch1', { lat: 30.652, lon: 113.152 }); // ~0.3km away
      const merged = collapseLinkedCandidates([cbdb, chgis], 5);
      expect(merged).toHaveLength(1);
      expect(merged[0].source).toBe('CBDB+CHGIS');
    });

    it('does NOT merge same-named places beyond the proximity threshold — the core fix', () => {
      const cbdb = jingling('CBDB', 'c1', { lat: 30.65, lon: 113.15 }); // Hubei
      const chgis = jingling('CHGIS', 'ch1', { lat: 39.9, lon: 116.4 }); // Beijing, ~1000km away
      const merged = collapseLinkedCandidates([cbdb, chgis], 5);
      expect(merged).toHaveLength(2);
      expect(merged.map((c) => c.source).sort()).toEqual(['CBDB', 'CHGIS']);
    });

    it('falls back to name-only merge when either side has no geo', () => {
      const cbdb = jingling('CBDB', 'c1', { lat: 30.65, lon: 113.15 });
      const dila = jingling('DILA', 'd1', undefined);
      const merged = collapseLinkedCandidates([cbdb, dila], 5);
      expect(merged).toHaveLength(1);
      expect(merged[0].source).toBe('CBDB+DILA');
    });

    it('respects a custom proximityKm (wider radius merges what a tighter one would split)', () => {
      // ~800km apart — beyond a 5km default, within an intentionally wide 1000km test radius.
      const cbdb = jingling('CBDB', 'c1', { lat: 30.65, lon: 113.15 });
      const chgis = jingling('CHGIS', 'ch1', { lat: 37.5, lon: 114.5 });
      expect(collapseLinkedCandidates([cbdb, chgis], 5)).toHaveLength(2);
      expect(collapseLinkedCandidates([cbdb, chgis], 1000)).toHaveLength(1);
    });

    it('crosswalk ids still win over geography (never overridden by distance)', () => {
      const cbdb = jingling('CBDB', 'c1', { lat: 30.65, lon: 113.15 });
      const chgis: AuthorityCandidate = {
        source: 'CHGIS',
        authorityId: 'ch1',
        kind: 'place',
        primaryName: '竟陵',
        searchStrings: ['竟陵'],
        metadata: { geo: { lat: 39.9, lon: 116.4 }, crosswalk: { cbdb: 'c1' } },
      };
      const merged = collapseLinkedCandidates([cbdb, chgis], 5);
      expect(merged).toHaveLength(1);
    });
  });
});
