import {
  buildExclusionFilterSparql,
  buildKindFilterSparql,
  clearWikidataKindCacheForTests,
  parseKindFilterSparqlResponse,
  wikidataQidsExcludingKnownKinds,
  wikidataQidsMatchingKind,
} from './wikidataKindFilter';

describe('wikidataKindFilter', () => {
  afterEach(() => {
    clearWikidataKindCacheForTests();
  });

  it('builds SPARQL with P31/P279* roots for person', () => {
    const query = buildKindFilterSparql(['Q1188379', 'Q85466117'], 'person');
    expect(query).toContain('wd:Q1188379');
    expect(query).toContain('wd:Q85466117');
    expect(query).toContain('wd:Q5');
    expect(query).toContain('wdt:P31/wdt:P279* ?root');
  });

  it('parses SPARQL bindings into Q-ids', () => {
    const matched = parseKindFilterSparqlResponse({
      results: {
        bindings: [{ item: { value: 'http://www.wikidata.org/entity/Q1188379' } }],
      },
    });
    expect(matched.has('Q1188379')).toBe(true);
    expect(matched.has('Q85466117')).toBe(false);
  });

  it('filters Q-ids by kind via mocked SPARQL', async () => {
    const fetchImpl = async () =>
      ({
        ok: true,
        json: async () => ({
          results: {
            bindings: [{ item: { value: 'http://www.wikidata.org/entity/Q1188379' } }],
          },
        }),
      }) as Response;

    const matched = await wikidataQidsMatchingKind(['Q1188379', 'Q85466117'], 'person', fetchImpl);
    expect(matched.has('Q1188379')).toBe(true);
    expect(matched.has('Q85466117')).toBe(false);

    const cached = await wikidataQidsMatchingKind(['Q85466117'], 'person', fetchImpl);
    expect(cached.has('Q85466117')).toBe(false);
    expect(cached.size).toBe(0);
  });
});

describe('the "thing" exclusion filter', () => {
  afterEach(() => {
    clearWikidataKindCacheForTests();
  });

  it('builds SPARQL that excludes person/place/org/work roots, with no positive root restriction', () => {
    const query = buildExclusionFilterSparql(['Q42']);
    expect(query).toContain('wd:Q42');
    // person's root
    expect(query).toContain('wd:Q5');
    // a place root and a work root, to confirm the union spans multiple kinds
    expect(query).toContain('wd:Q515');
    expect(query).toContain('wd:Q386724');
    expect(query).toContain('FILTER NOT EXISTS');
    // unlike buildKindFilterSparql, there's no positive `?item wdt:P31/wdt:P279* ?root`
    // constraint outside the FILTER NOT EXISTS block — a "thing" has no root of its own.
    expect(query.replace(/FILTER NOT EXISTS[\s\S]*?}\s*}/, '')).not.toContain(
      'wdt:P31/wdt:P279* ?root',
    );
  });

  it('matches a Q-id that is none of the other kinds via mocked SPARQL', async () => {
    const fetchImpl = async () =>
      ({
        ok: true,
        json: async () => ({
          results: { bindings: [{ item: { value: 'http://www.wikidata.org/entity/Q42' } }] },
        }),
      }) as Response;

    const matched = await wikidataQidsExcludingKnownKinds(['Q42', 'Q5'], fetchImpl);
    expect(matched.has('Q42')).toBe(true);
    expect(matched.has('Q5')).toBe(false);
  });
});
