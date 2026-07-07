import {
  buildKindFilterSparql,
  clearWikidataKindCacheForTests,
  parseKindFilterSparqlResponse,
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
        bindings: [
          { item: { value: 'http://www.wikidata.org/entity/Q1188379' } },
        ],
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

    const matched = await wikidataQidsMatchingKind(
      ['Q1188379', 'Q85466117'],
      'person',
      fetchImpl,
    );
    expect(matched.has('Q1188379')).toBe(true);
    expect(matched.has('Q85466117')).toBe(false);

    const cached = await wikidataQidsMatchingKind(['Q85466117'], 'person', fetchImpl);
    expect(cached.has('Q85466117')).toBe(false);
    expect(cached.size).toBe(0);
  });
});
