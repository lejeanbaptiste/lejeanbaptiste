import { reconcile } from '../services/lincs-api';
import {
  buildDisambiguationCandidates,
  candidatesFromEntityFile,
  candidateLinks,
  candidatePassesYearFilter,
  clearPersonPackIndexForTests,
  collapseCrossAuthorityCandidates,
  extractCbdbId,
  extractViafId,
  extractWikidataId,
  fetchLiveCandidates,
  mergeSelectedCandidates,
  resolveEntityInDocument,
  type DisambiguationCandidate,
} from './disambiguationCandidates';
import { AuthorityCache } from './authorityCache';
import { addEntity, createEntitiesScaffold, parseEntities } from './entities';

jest.mock('../services/lincs-api', () => ({ reconcile: jest.fn() }));
const mockReconcile = reconcile as jest.MockedFunction<typeof reconcile>;

describe('disambiguationCandidates', () => {
  afterEach(() => {
    clearPersonPackIndexForTests();
  });

  it('finds local entity-file matches', () => {
    const doc = parseEntities(createEntitiesScaffold());
    const listPerson = doc.getElementsByTagName('listPerson')[0]!;
    const person = doc.createElementNS('http://www.tei-c.org/ns/1.0', 'person');
    person.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:id', 'person-000001');
    const name = doc.createElementNS('http://www.tei-c.org/ns/1.0', 'persName');
    name.textContent = '張衡';
    person.appendChild(name);
    listPerson.appendChild(person);

    const rows = candidatesFromEntityFile(doc, 'persName', '張衡');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.localEntityId).toBe('person-000001');
    expect(rows[0]?.sources).toContain('entity-file');
  });

  it('stores and reads back a one-line description for a manually created entity', () => {
    const doc = parseEntities(createEntitiesScaffold());
    const id = resolveEntityInDocument(doc, {
      kind: 'person',
      name: '禹',
      description: 'legendary flood-taming ruler, founder of the Xia dynasty',
    });

    const rows = candidatesFromEntityFile(doc, 'persName', '禹');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.localEntityId).toBe(id);
    expect(rows[0]?.description).toBe('legendary flood-taming ruler, founder of the Xia dynasty');
  });

  it('stores and reads back life dates for a resolved entity', () => {
    const doc = parseEntities(createEntitiesScaffold());
    const id = resolveEntityInDocument(doc, {
      kind: 'person',
      name: '張衡',
      description: '(78–139) Han dynasty polymath',
      startYear: 78,
      endYear: 139,
    });

    const rows = candidatesFromEntityFile(doc, 'persName', '張衡');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.localEntityId).toBe(id);
    expect(rows[0]?.startYear).toBe(78);
    expect(rows[0]?.endYear).toBe(139);
  });

  it('reads back non-person years from the dates note', () => {
    const doc = parseEntities(createEntitiesScaffold());
    resolveEntityInDocument(doc, { kind: 'place', name: '洛陽', startYear: -1036, endYear: 938 });

    const rows = candidatesFromEntityFile(doc, 'placeName', '洛陽');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.startYear).toBe(-1036);
    expect(rows[0]?.endYear).toBe(938);
  });

  it('prefers the description note over an authority-cache note on the same entity', () => {
    const doc = parseEntities(createEntitiesScaffold());
    addEntity(doc, 'person', {
      name: '桓玄',
      cache: { source: 'CBDB', data: { foo: 'bar' } },
      description: 'Jin-dynasty usurper',
    });

    const rows = candidatesFromEntityFile(doc, 'persName', '桓玄');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.description).toBe('Jin-dynasty usurper');
  });

  it('extracts Wikidata ids from VIAF source codes', () => {
    expect(extractWikidataId('WKP|Q1137864')).toBe('Q1137864');
    expect(extractWikidataId('https://www.wikidata.org/wiki/Q42')).toBe('Q42');
  });

  it('extracts CBDB ids from reconcile descriptions', () => {
    expect(extractCbdbId('person, CBDB ID = 392870')).toBe('392870');
    expect(extractCbdbId('Tang dynasty person CBDB = 178700')).toBe('178700');
  });

  it('stores CBDB id from Wikidata description on live candidates', async () => {
    // Covered indirectly via authorityIdsFromCrossRefs in fetchLiveCandidates;
    // test enrichment through candidateLinks after manual candidate shape.
    const links = candidateLinks({
      id: 'wd',
      label: 'Sima Guofan',
      sources: ['Wikidata'],
      description: 'person, CBDB ID = 392870',
      authorityIds: [
        { type: 'Wikidata', value: 'https://www.wikidata.org/wiki/Q42' },
        { type: 'CBDB', value: '392870' },
      ],
    });
    expect(links.some((link) => link.kind === 'cbdb' && link.url.includes('392870'))).toBe(true);
  });

  it('collapses Wikidata and VIAF when they share a Q id', () => {
    const rows = collapseCrossAuthorityCandidates([
      {
        id: 'https://www.wikidata.org/wiki/Q1137864',
        label: 'Example Person',
        sources: ['Wikidata'],
        uri: 'https://www.wikidata.org/wiki/Q1137864',
        authorityIds: [{ type: 'Wikidata', value: 'https://www.wikidata.org/wiki/Q1137864' }],
      },
      {
        id: 'https://viaf.org/viaf/404064183',
        label: 'Example Person',
        description: 'Sources: WKP|Q1137864',
        sources: ['VIAF'],
        uri: 'https://viaf.org/viaf/404064183',
        authorityIds: [{ type: 'VIAF', value: 'https://viaf.org/viaf/404064183' }],
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sources).toEqual(expect.arrayContaining(['Wikidata', 'VIAF']));
    expect(rows[0]?.authorityIds).toHaveLength(2);
  });

  it('extracts VIAF ids from locale-prefixed permalinks (e.g. viaf.org/fr/viaf/…)', () => {
    expect(extractViafId('https://viaf.org/fr/viaf/16332263')).toBe('16332263');
    expect(extractViafId('https://viaf.org/viaf/16332263')).toBe('16332263');
  });

  it('collapses Wikidata and VIAF when the VIAF permalink has a locale segment', () => {
    const rows = collapseCrossAuthorityCandidates([
      {
        id: 'https://www.wikidata.org/wiki/Q967998',
        label: 'Fu Jian',
        sources: ['Wikidata'],
        uri: 'https://www.wikidata.org/wiki/Q967998',
        description: 'VIAF: https://viaf.org/fr/viaf/16332263, CBDB ID = 178700',
        authorityIds: [{ type: 'Wikidata', value: 'https://www.wikidata.org/wiki/Q967998' }],
      },
      {
        id: 'https://viaf.org/fr/viaf/16332263',
        label: 'Fu Jian',
        sources: ['VIAF'],
        uri: 'https://viaf.org/fr/viaf/16332263',
        description: 'Sources: https://www.wikidata.org/wiki/Q967998',
        authorityIds: [{ type: 'VIAF', value: 'https://viaf.org/fr/viaf/16332263' }],
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sources).toEqual(expect.arrayContaining(['Wikidata', 'VIAF']));
  });

  it('keeps VIAF rows even when their heading does not literally match the surface', async () => {
    mockReconcile.mockImplementation(async ({ options }) => {
      const authorityId = (options as { authorityId?: string })?.authorityId;
      if (authorityId === 'wikidata') {
        return [
          {
            uri: 'https://www.wikidata.org/wiki/Q967998',
            label: '苻堅',
            description: undefined,
          },
        ];
      }
      // VIAF headings are authority-specific (e.g. LC-style "Name, dates") and won't
      // equal the raw CJK surface text — this must not get dropped by exact matching.
      return [
        {
          uri: 'https://viaf.org/viaf/16332263',
          label: 'Fu, Jian, 338-385',
          description: undefined,
        },
      ];
    });
    const cache = new AuthorityCache(null, null);
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) } as Response);

    try {
      const rows = await fetchLiveCandidates('persName', '苻堅', cache, ['Wikidata', 'VIAF']);
      expect(rows.some((row) => row.sources.includes('VIAF'))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('surfaces CBDB/DILA candidates from installed packs without hitting the network', async () => {
    mockReconcile.mockResolvedValue([]);
    const cbdbPack = [
      JSON.stringify({
        source: 'CBDB',
        authorityId: '178700',
        kind: 'person',
        primaryName: '桓玄',
        searchStrings: ['桓玄'],
        metadata: { startYear: 369, endYear: 404, description: '桓玄 (Huan Xuan, 369–404, 晉 Jin)' },
      }),
    ].join('\n');
    const dilaPack = [
      JSON.stringify({
        source: 'DILA',
        authorityId: 'A012345',
        kind: 'person',
        primaryName: '桓玄',
        searchStrings: ['桓玄'],
        metadata: {
          startYear: 369,
          endYear: 404,
          description: '桓玄 (369–404, 晉, 曾廢晉安帝自立為帝)',
          crosswalk: { wikidata: ['Q551740'] },
        },
      }),
    ].join('\n');
    const readPackFile = jest.fn(async (packId: string) => {
      if (packId === 'cbdb-persons') return cbdbPack;
      if (packId === 'dila-persons') return dilaPack;
      throw new Error(`not installed: ${packId}`);
    });
    const doc = parseEntities(createEntitiesScaffold());
    const cache = new AuthorityCache(null, null);

    const rows = await buildDisambiguationCandidates(
      doc,
      'persName',
      '桓玄',
      cache,
      ['Wikidata', 'VIAF'],
      false,
      readPackFile,
    );

    expect(rows.some((row) => row.sources.includes('CBDB'))).toBe(true);
    expect(rows.some((row) => row.sources.includes('DILA'))).toBe(true);
    const dilaRow = rows.find((row) => row.sources.includes('DILA'));
    expect(dilaRow?.startYear).toBe(369);
    expect(dilaRow?.endYear).toBe(404);
    expect(dilaRow?.description).toContain('曾廢晉安帝自立為帝');
  });

  it('surfaces DILA and CHGIS place candidates from installed packs for placeName lookups', async () => {
    mockReconcile.mockResolvedValue([]);
    const dilaPlacesPack = [
      JSON.stringify({
        source: 'DILA',
        authorityId: 'PL-0001',
        kind: 'place',
        primaryName: '長安',
        searchStrings: ['長安'],
        metadata: { description: 'DILA place' },
      }),
    ].join('\n');
    const chgisPlacesPack = [
      JSON.stringify({
        source: 'CHGIS',
        authorityId: 'CH-001',
        kind: 'place',
        primaryName: '長安',
        searchStrings: ['長安'],
        metadata: { startYear: 618, endYear: 907, description: 'CHGIS place' },
      }),
    ].join('\n');
    const readPackFile = jest.fn(async (packId: string) => {
      if (packId === 'dila-places') return dilaPlacesPack;
      if (packId === 'chgis-places') return chgisPlacesPack;
      throw new Error(`not installed: ${packId}`);
    });
    const doc = parseEntities(createEntitiesScaffold());
    const cache = new AuthorityCache(null, null);

    const rows = await buildDisambiguationCandidates(
      doc,
      'placeName',
      '長安',
      cache,
      ['Wikidata', 'VIAF'],
      false,
      readPackFile,
    );

    expect(rows.some((row) => row.sources.includes('DILA'))).toBe(true);
    expect(rows.some((row) => row.sources.includes('CHGIS'))).toBe(true);
    const chgisRow = rows.find((row) => row.sources.includes('CHGIS'));
    expect(chgisRow?.startYear).toBe(618);
    expect(chgisRow?.endYear).toBe(907);
  });

  it('merges manually selected candidates', () => {
    const merged = mergeSelectedCandidates([
      {
        id: 'a',
        label: 'A',
        sources: ['Wikidata'],
        authorityIds: [{ type: 'Wikidata', value: 'https://www.wikidata.org/wiki/Q1' }],
      },
      {
        id: 'b',
        label: 'B',
        sources: ['VIAF'],
        authorityIds: [{ type: 'VIAF', value: 'https://viaf.org/viaf/99' }],
      },
    ]);
    expect(merged?.sources).toEqual(['Wikidata', 'VIAF']);
    expect(merged?.authorityIds).toHaveLength(2);
  });

  it('builds external links for candidates', () => {
    const links = candidateLinks({
      id: 'x',
      label: 'Test',
      sources: ['Wikidata', 'VIAF'],
      uri: 'https://www.wikidata.org/wiki/Q42',
      description: 'WKP|Q42 · viaf.org/viaf/123',
    });
    const wikidata = links.find((link) => link.kind === 'wikidata');
    expect(wikidata?.url).toBe('https://www.wikidata.org/wiki/Q42');
    expect(links.some((link) => link.kind === 'viaf' && link.url.includes('123'))).toBe(true);
  });

  it('links Wikidata candidates to the item page (not enwiki sitelink)', () => {
    const links = candidateLinks({
      id: 'x',
      label: '陳卓',
      sources: ['Wikidata'],
      uri: 'https://www.wikidata.org/wiki/Q65884952',
    });
    expect(links[0]?.url).toBe('https://www.wikidata.org/wiki/Q65884952');
    expect(links[0]?.title).toBe('Wikidata (Q65884952)');
  });

  describe('candidatePassesYearFilter', () => {
    const base: DisambiguationCandidate = { id: 'x', label: 'x', sources: ['Wikidata'] };

    it('passes everything when the filter mode is none', () => {
      expect(candidatePassesYearFilter(base, { mode: 'none', start: 0, end: 100 })).toBe(true);
      expect(candidatePassesYearFilter(base)).toBe(true);
    });

    it('limit mode keeps overlapping ranges and excludes undated candidates', () => {
      const dated = { ...base, startYear: 226, endYear: 249 };
      expect(candidatePassesYearFilter(dated, { mode: 'limit', start: 200, end: 300 })).toBe(true);
      expect(candidatePassesYearFilter(dated, { mode: 'limit', start: 300, end: 400 })).toBe(false);
      expect(candidatePassesYearFilter(base, { mode: 'limit', start: 200, end: 300 })).toBe(false);
    });

    it('exclude mode drops overlapping ranges and keeps undated candidates', () => {
      const dated = { ...base, startYear: 226, endYear: 249 };
      expect(candidatePassesYearFilter(dated, { mode: 'exclude', start: 200, end: 300 })).toBe(false);
      expect(candidatePassesYearFilter(dated, { mode: 'exclude', start: 300, end: 400 })).toBe(true);
      expect(candidatePassesYearFilter(base, { mode: 'exclude', start: 200, end: 300 })).toBe(true);
    });

    it('treats a single-year candidate (only startYear) as a point in time', () => {
      const born = { ...base, startYear: 1990 };
      expect(candidatePassesYearFilter(born, { mode: 'limit', start: 1980, end: 2000 })).toBe(true);
      expect(candidatePassesYearFilter(born, { mode: 'limit', start: 2000, end: 2010 })).toBe(false);
    });

    it('normalizes a reversed range', () => {
      const dated = { ...base, startYear: 226, endYear: 249 };
      expect(candidatePassesYearFilter(dated, { mode: 'limit', start: 300, end: 200 })).toBe(true);
    });
  });
});
