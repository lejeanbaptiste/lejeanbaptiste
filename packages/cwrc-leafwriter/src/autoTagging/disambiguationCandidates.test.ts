import { reconcile } from '../services/lincs-api';
import {
  buildDisambiguationCandidates,
  candidatesFromEntityFile,
  candidateLinks,
  candidatePassesYearFilter,
  clearPersonPackIndexForTests,
  collapseCrossAuthorityCandidates,
  collectTypedNamesForCandidate,
  enrichCandidateNames,
  extractCbdbId,
  extractViafId,
  extractWikidataId,
  fetchLiveCandidates,
  mergeCandidates,
  mergeSelectedCandidates,
  resolveEntityInDocument,
  type DisambiguationCandidate,
} from './disambiguationCandidates';
import { AuthorityCache } from './authorityCache';
import { DilaPlaceDetailCache } from './dilaPlaceDetailCache';
import {
  clearWikidataNamesCacheForTests,
  clearWikidataTypedNamesCacheForTests,
} from './disambiguationMatch';
import { addEntity, createEntitiesScaffold, findEntity, parseEntities } from './entities';
import { listEntities } from './entityOps';

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

  it('matches local entities on alternative names, keeping the display name as label', () => {
    const doc = parseEntities(createEntitiesScaffold());
    addEntity(doc, 'person', {
      name: '張衡',
      nameLang: 'zh-Hant',
      romanizedName: 'Zhang Heng',
      altNames: [{ text: '平子', type: 'courtesy' }],
    });

    for (const surface of ['張衡', '平子', 'Zhang Heng']) {
      const rows = candidatesFromEntityFile(doc, 'persName', surface);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.label).toBe('張衡');
      expect(rows[0]?.projectLangName).toBe('張衡');
      expect(rows[0]?.romanizedName).toBe('Zhang Heng');
    }
  });

  describe('dual-script resolve', () => {
    it('mints with the authority project-language name as canonical and the surface as variant', () => {
      const doc = parseEntities(createEntitiesScaffold());
      const id = resolveEntityInDocument(doc, {
        kind: 'person',
        name: '平子',
        projectLangName: '張衡',
        romanizedName: 'Zhang Heng',
        nameLang: 'zh-Hant',
        authorityIds: [{ type: 'CBDB', value: '1762' }],
      });

      expect(listEntities(doc).find((e) => e.id === id)?.nameEntries).toEqual([
        { text: '張衡', lang: 'zh-Hant', type: 'primary' },
        { text: 'Zhang Heng', lang: 'zh-Latn', type: null },
        { text: '平子', lang: null, type: 'variant' },
      ]);
    });

    it('falls back to legacy shape when no dual-script fields are provided', () => {
      const doc = parseEntities(createEntitiesScaffold());
      const id = resolveEntityInDocument(doc, { kind: 'person', name: '禹' });
      const name = findEntity(doc, id)!.getElementsByTagName('persName')[0]!;
      expect(name.textContent).toBe('禹');
      expect(name.getAttribute('xml:lang')).toBeNull();
      expect(name.getAttribute('type')).toBeNull();
    });

    it('backfills romanization and records the new surface on entity reuse', () => {
      const doc = parseEntities(createEntitiesScaffold());
      addEntity(doc, 'person', {
        name: '張衡',
        authorityIds: [{ type: 'CBDB', value: '1762' }],
      });

      const id = resolveEntityInDocument(doc, {
        kind: 'person',
        name: '平子',
        projectLangName: '張衡',
        romanizedName: 'Zhang Heng',
        nameLang: 'zh-Hant',
        authorityIds: [{ type: 'CBDB', value: '1762' }],
      });

      const entity = listEntities(doc).find((e) => e.id === id)!;
      expect(entity.names).toEqual(['張衡', 'Zhang Heng', '平子']);
      expect(entity.romanized).toBe('Zhang Heng');
      expect(entity.nameEntries[2]).toEqual({ text: '平子', lang: null, type: 'variant' });
    });
  });

  describe('typed names ingestion', () => {
    afterEach(() => {
      clearWikidataNamesCacheForTests();
      clearWikidataTypedNamesCacheForTests();
    });

    it('excludes the primary-typed pack entry from a candidate\'s typedNames', async () => {
      mockReconcile.mockResolvedValue([]);
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
      const cbdbPack = [
        JSON.stringify({
          source: 'CBDB',
          authorityId: '1762',
          kind: 'person',
          primaryName: '王安石',
          searchStrings: ['王安石', '王介甫'],
          names: [
            { text: '王安石', type: 'primary' },
            { text: '王介甫', type: 'courtesy' },
          ],
          metadata: { pinyin: 'Wang Anshi' },
        }),
      ].join('\n');
      const readPackFile = jest.fn(async (packId: string) => {
        if (packId === 'cbdb-persons') return cbdbPack;
        throw new Error(`not installed: ${packId}`);
      });

      try {
        const rows = await buildDisambiguationCandidates(
          parseEntities(createEntitiesScaffold()),
          'persName',
          '王安石',
          new AuthorityCache(null, null),
          ['Wikidata', 'VIAF'],
          false,
          readPackFile,
        );

        const cbdbRow = rows.find((row) => row.sources.includes('CBDB'));
        expect(cbdbRow?.typedNames).toEqual([{ text: '王介甫', type: 'courtesy', lang: undefined }]);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('writes authority typed names on mint and on reuse', () => {
      const doc = parseEntities(createEntitiesScaffold());
      const typedNames = [
        { text: '平子', type: 'courtesy' as const, lang: 'zh-Hant' },
        { text: '西鄂侯', type: 'posthumous' as const },
      ];
      const id = resolveEntityInDocument(doc, {
        kind: 'person',
        name: '張衡',
        projectLangName: '張衡',
        romanizedName: 'Zhang Heng',
        nameLang: 'zh-Hant',
        typedNames,
        authorityIds: [{ type: 'CBDB', value: '1762' }],
      });

      let entity = listEntities(doc).find((e) => e.id === id)!;
      expect(entity.nameEntries).toEqual([
        { text: '張衡', lang: 'zh-Hant', type: 'primary' },
        { text: 'Zhang Heng', lang: 'zh-Latn', type: null },
        { text: '平子', lang: 'zh-Hant', type: 'courtesy' },
        { text: '西鄂侯', lang: null, type: 'posthumous' },
      ]);

      // reuse with a new typed name: appended, existing ones deduped
      resolveEntityInDocument(doc, {
        kind: 'person',
        name: '張衡',
        typedNames: [...typedNames, { text: '張平子', type: 'variant' as const }],
        authorityIds: [{ type: 'CBDB', value: '1762' }],
      });
      entity = listEntities(doc).find((e) => e.id === id)!;
      expect(entity.names).toEqual(['張衡', 'Zhang Heng', '平子', '西鄂侯', '張平子']);
      expect(listEntities(doc)).toHaveLength(1);
    });

    it('collectTypedNamesForCandidate merges pack names with Wikidata claims', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn(async () =>
        ({
          ok: true,
          json: async () => ({
            entities: {
              Q11332: {
                claims: {
                  P1782: [{ mainsnak: { datavalue: { value: { text: '平子', language: 'zh' } } } }],
                  P1786: [{ mainsnak: { datavalue: { value: { text: '西鄂侯', language: 'zh' } } } }],
                },
              },
            },
          }),
        }) as unknown as Response) as unknown as typeof fetch;
      try {
        const names = await collectTypedNamesForCandidate({
          id: 'wd',
          label: '張衡',
          sources: ['Wikidata', 'CBDB'],
          uri: 'https://www.wikidata.org/wiki/Q11332',
          typedNames: [{ text: '平子', type: 'courtesy', lang: 'zh-Hant' }],
        });
        // pack-provided entry wins for 平子; Wikidata adds the posthumous name
        expect(names).toEqual([
          { text: '平子', type: 'courtesy', lang: 'zh-Hant' },
          { text: '西鄂侯', type: 'posthumous', lang: 'zh' },
        ]);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('mergeSelectedCandidates script preference', () => {
    const rows: DisambiguationCandidate[] = [
      {
        id: 'ndl',
        label: 'チョウ・コウ',
        sources: ['NDL'],
        romanizedName: 'Chou Kou',
      },
      {
        id: 'cbdb',
        label: '張衡',
        sources: ['CBDB'],
        projectLangName: '張衡',
        romanizedName: 'Zhang Heng',
      },
    ];

    it('keeps first-row label without the preference flag (legacy behavior)', () => {
      expect(mergeSelectedCandidates(rows)?.label).toBe('チョウ・コウ');
    });

    it('prefers a non-Latin label and propagates dual-script fields with the flag', () => {
      const merged = mergeSelectedCandidates(rows, { preferNonLatinLabel: true })!;
      expect(merged.label).toBe('チョウ・コウ'); // first non-Latin label wins deterministically
      expect(merged.projectLangName).toBe('張衡');
      expect(merged.romanizedName).toBe('Chou Kou');
    });

    it('prefers a non-Latin label over a Latin first row', () => {
      const latinFirst: DisambiguationCandidate[] = [
        { id: 'viaf', label: 'Zhang Heng', sources: ['VIAF'] },
        { id: 'cbdb', label: '張衡', sources: ['CBDB'], projectLangName: '張衡' },
      ];
      expect(mergeSelectedCandidates(latinFirst)?.label).toBe('Zhang Heng');
      expect(
        mergeSelectedCandidates(latinFirst, { preferNonLatinLabel: true })?.label,
      ).toBe('張衡');
    });
  });

  describe('enrichCandidateNames', () => {
    afterEach(() => clearWikidataNamesCacheForTests());

    const labelsResponse = (entities: Record<string, Record<string, string>>) =>
      ({
        ok: true,
        json: async () => ({
          entities: Object.fromEntries(
            Object.entries(entities).map(([qid, labels]) => [
              qid,
              {
                labels: Object.fromEntries(
                  Object.entries(labels).map(([lang, value]) => [lang, { value }]),
                ),
              },
            ]),
          ),
        }),
      }) as Response;

    it('fills project-language and Latin names from Wikidata labels', async () => {
      const fetchImpl = jest.fn().mockResolvedValue(
        labelsResponse({ Q11332: { 'zh-hant': '張衡', zh: '张衡', en: 'Zhang Heng' } }),
      );
      const candidates: DisambiguationCandidate[] = [
        {
          id: 'wd',
          label: 'Zhang Heng',
          sources: ['Wikidata'],
          uri: 'https://www.wikidata.org/wiki/Q11332',
        },
      ];

      await enrichCandidateNames(candidates, 'zh-Hant', fetchImpl);
      expect(candidates[0]?.projectLangName).toBe('張衡');
      expect(candidates[0]?.romanizedName).toBe('Zhang Heng');
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('autogenerates pinyin when no Latin label exists', async () => {
      const fetchImpl = jest.fn().mockResolvedValue(
        labelsResponse({ Q999999: { 'zh-hant': '司馬遷' } }),
      );
      const candidates: DisambiguationCandidate[] = [
        {
          id: 'wd',
          label: '司馬遷',
          sources: ['Wikidata'],
          uri: 'https://www.wikidata.org/wiki/Q999999',
        },
      ];

      await enrichCandidateNames(candidates, 'zh-Hant', fetchImpl);
      expect(candidates[0]?.projectLangName).toBe('司馬遷');
      expect(candidates[0]?.romanizedName).toBe('Si Ma Qian');
    });

    it('survives fetch failure by falling back to autogeneration', async () => {
      const fetchImpl = jest.fn().mockRejectedValue(new Error('offline'));
      const candidates: DisambiguationCandidate[] = [
        {
          id: 'wd',
          label: '張衡',
          sources: ['Wikidata'],
          uri: 'https://www.wikidata.org/wiki/Q11332',
        },
      ];

      await enrichCandidateNames(candidates, 'zh-Hant', fetchImpl);
      expect(candidates[0]?.projectLangName).toBe('張衡');
      expect(candidates[0]?.romanizedName).toBe('Zhang Heng');
    });

    it('does nothing without a project language', async () => {
      const fetchImpl = jest.fn();
      const candidates: DisambiguationCandidate[] = [
        { id: 'wd', label: '張衡', sources: ['Wikidata'], uri: 'https://www.wikidata.org/wiki/Q11332' },
      ];
      await enrichCandidateNames(candidates, null, fetchImpl);
      expect(candidates[0]?.projectLangName).toBeUndefined();
      expect(fetchImpl).not.toHaveBeenCalled();
    });
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

  it('extracts concordance ids beyond CBDB from free-text cross references', async () => {
    mockReconcile.mockImplementation(async ({ options }) => {
      const authorityId = (options as { authorityId?: string })?.authorityId;
      if (authorityId === 'wikidata') {
        return [
          {
            uri: 'https://www.wikidata.org/wiki/Q1137864',
            label: 'Example Person',
            description:
              'Sources: https://viaf.org/viaf/404064183, https://authority.dila.edu.tw/person/search.php?code=A001492, https://id.ndl.go.jp/auth/ndlna/00270123',
          },
        ];
      }
      if (authorityId === 'viaf') {
        return [
          {
            uri: 'https://viaf.org/viaf/404064183',
            label: 'Example Person',
            description:
              'Sources: https://www.wikidata.org/wiki/Q1137864, https://authority.dila.edu.tw/person/search.php?code=A001492, https://id.ndl.go.jp/auth/ndlna/00270123',
          },
        ];
      }
      return [];
    });

    const cache = new AuthorityCache(null, null);
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) } as Response);

    try {
      const rows = await fetchLiveCandidates('persName', 'Example Person', cache, ['Wikidata', 'VIAF']);
      const row = rows[0];
      expect(row?.authorityIds).toEqual(
        expect.arrayContaining([
          { type: 'Wikidata', value: 'Q1137864' },
          { type: 'VIAF', value: 'https://viaf.org/viaf/404064183' },
          { type: 'DILA', value: 'A001492' },
          { type: 'NDL', value: '00270123' },
        ]),
      );
    } finally {
      global.fetch = originalFetch;
    }
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

  it('does not leak one DILA place record\'s dates onto another record sharing the same name', async () => {
    mockReconcile.mockResolvedValue([]);
    // DILA splits a place into one row per dynasty/era — same primaryName, distinct authorityId.
    const dilaPlacesPack = [
      JSON.stringify({
        source: 'DILA',
        authorityId: 'PL000000000001',
        kind: 'place',
        primaryName: '始興',
        searchStrings: ['始興'],
        metadata: { description: '始興 (265~316)', startYear: 265, endYear: 316 },
      }),
      JSON.stringify({
        source: 'DILA',
        authorityId: 'PL000000000002',
        kind: 'place',
        primaryName: '始興',
        searchStrings: ['始興'],
        metadata: { description: '始興 (589~618)', startYear: 589, endYear: 618 },
      }),
    ].join('\n');
    const readPackFile = jest.fn(async (packId: string) => {
      if (packId === 'dila-places') return dilaPlacesPack;
      throw new Error(`not installed: ${packId}`);
    });
    const doc = parseEntities(createEntitiesScaffold());
    const cache = new AuthorityCache(null, null);

    const rows = await buildDisambiguationCandidates(
      doc,
      'placeName',
      '始興',
      cache,
      [],
      false,
      readPackFile,
    );

    const dilaRows = rows.filter((row) => row.sources.includes('DILA'));
    expect(dilaRows).toHaveLength(2);
    const byUri = new Map(dilaRows.map((row) => [row.uri, row]));
    const first = byUri.get('https://authority.dila.edu.tw/place/search.php?code=PL000000000001');
    const second = byUri.get('https://authority.dila.edu.tw/place/search.php?code=PL000000000002');
    expect(first?.startYear).toBe(265);
    expect(first?.endYear).toBe(316);
    expect(second?.startYear).toBe(589);
    expect(second?.endYear).toBe(618);

    // authorityIds must hold the bare id, not the already-formatted record URL —
    // otherwise DILA_URL()/candidateLinks() wraps a full URL inside another URL
    // (e.g. ".../person/search.php?code=https://authority.dila.edu.tw/place/...").
    expect(first?.authorityIds).toContainEqual({ type: 'DILA', value: 'PL000000000001' });
    expect(second?.authorityIds).toContainEqual({ type: 'DILA', value: 'PL000000000002' });
  });

  it('prefixes the description with the dynasty from a lazily-fetched DILA place record', async () => {
    mockReconcile.mockResolvedValue([]);
    const dilaPlacesPack = [
      JSON.stringify({
        source: 'DILA',
        authorityId: 'PL000000029418',
        kind: 'place',
        primaryName: '武陵郡',
        searchStrings: ['武陵郡'],
        metadata: { description: '武陵郡 (中研院歷史地名 — 中國-湖南省-常德市-武陵區)' },
      }),
    ].join('\n');
    const readPackFile = jest.fn(async (packId: string) => {
      if (packId === 'dila-places') return dilaPlacesPack;
      throw new Error(`not installed: ${packId}`);
    });
    const doc = parseEntities(createEntitiesScaffold());
    const cache = new AuthorityCache(null, null);
    const dilaDetailCache = new DilaPlaceDetailCache(null, null);
    // Pre-populate the cache as if the background fetch already landed.
    await dilaDetailCache.set('PL000000029418', {
      remark: '（317 ~ 420）郡級行政中心所在地。',
      dynasty: '東晉',
      startYear: 317,
      endYear: 420,
    });

    const rows = await buildDisambiguationCandidates(
      doc,
      'placeName',
      '武陵郡',
      cache,
      [],
      false,
      readPackFile,
      dilaDetailCache,
    );

    const dilaRow = rows.find((row) => row.sources.includes('DILA'));
    expect(dilaRow?.dynasty).toBe('東晉');
    expect(dilaRow?.description).toBe('東晉：（317 ~ 420）郡級行政中心所在地。');
  });

  it('accepts dilaDetailCache and onDilaDatesReady parameters for lazy date enrichment', async () => {
    const dilaDetailCache = new DilaPlaceDetailCache(null, null);
    const onDilaDatesReady = jest.fn();

    const doc = parseEntities(createEntitiesScaffold());
    const cache = new AuthorityCache(null, null);

    // Call with the new optional parameters; should not throw or crash.
    const rows = await buildDisambiguationCandidates(
      doc,
      'placeName',
      'nonexistent',
      cache,
      [],  // no enabled authorities to keep results deterministic
      false,
      undefined,
      dilaDetailCache,
      undefined,
      onDilaDatesReady,
    );

    // Should return an array (possibly empty with no authorities/packs/entities).
    expect(Array.isArray(rows)).toBe(true);
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

  it('dedupes central-database candidates by centralEntityId when re-merging cache', () => {
    const freshCentral: DisambiguationCandidate = {
      id: 'person-cedb-1',
      label: '江德麟',
      romanizedName: 'Jiang De Lin',
      sources: ['central-database'],
      centralEntityId: 'person-cedb-1',
      fromEntityFile: true,
    };
    const cached: DisambiguationCandidate = {
      ...freshCentral,
      sources: ['central-database', 'Wikidata'],
    };

    const rows = mergeCandidates([[freshCentral], [cached]]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.centralEntityId).toBe('person-cedb-1');
    expect(rows[0]?.sources).toEqual(['central-database', 'Wikidata']);
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
