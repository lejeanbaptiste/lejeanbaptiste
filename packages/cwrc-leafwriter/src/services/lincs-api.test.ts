import { getAuthoritySources, reconcile } from './lincs-api';

describe('getAuthoritySources', () => {
  it('routes `thing` to a broad catch-all source for authorities that have one', () => {
    expect(getAuthoritySources('dbpedia', 'thing')).toEqual(['DBpedia-All']);
    expect(getAuthoritySources('getty', 'thing')).toEqual(['Getty-AAT', 'Getty-All']);
    expect(getAuthoritySources('gnd', 'thing')).toEqual(['GND-Subject']);
    expect(getAuthoritySources('lincs', 'thing')).toEqual(['LINCS-All']);
  });

  it('routes `thing` to no VIAF sources — VIAF has no generic-concept authority', () => {
    // VIAF-Works/Expressions are bibliographic (author + title) records, not a fit
    // for an arbitrary thing like a philosophical concept or a medicinal plant.
    expect(getAuthoritySources('viaf', 'thing')).toEqual([]);
  });

  it('still routes `work` to the bibliographic VIAF sources (unaffected by the `thing` fix)', () => {
    expect(getAuthoritySources('viaf', 'work')).toEqual([
      'VIAF-Bibliographic',
      'VIAF-Expressions',
      'VIAF-Works',
    ]);
  });
});

describe('reconcile', () => {
  it('short-circuits with no results instead of calling the API when an authority has no sources for the entity type', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const results = await reconcile({
      query: '萬里',
      entityType: 'thing',
      options: { authorityId: 'viaf' },
    });
    expect(results).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
