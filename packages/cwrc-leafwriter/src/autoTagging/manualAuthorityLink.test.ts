import { resolveManualAuthorityLink, resolveWikidataQidFromWikipediaUrl } from './manualAuthorityLink';

describe('manualAuthorityLink', () => {
  it('accepts a Wikidata item URL', async () => {
    const id = await resolveManualAuthorityLink('https://www.wikidata.org/wiki/Q42');
    expect(id).toEqual({ type: 'Wikidata', value: 'https://www.wikidata.org/wiki/Q42' });
  });

  it('accepts a VIAF cluster URL', async () => {
    const id = await resolveManualAuthorityLink('https://viaf.org/viaf/16332263');
    expect(id).toEqual({ type: 'VIAF', value: 'https://viaf.org/viaf/16332263' });
  });

  it('accepts DBPedia, Getty, GND, and Geonames URLs', async () => {
    expect(await resolveManualAuthorityLink('https://dbpedia.org/page/Yu_the_Great')).toEqual({
      type: 'DBPedia',
      value: 'https://dbpedia.org/page/Yu_the_Great',
    });
    expect(await resolveManualAuthorityLink('http://vocab.getty.edu/page/ulan/500115588')).toEqual({
      type: 'Getty',
      value: 'http://vocab.getty.edu/page/ulan/500115588',
    });
    expect(await resolveManualAuthorityLink('https://d-nb.info/gnd/118530471')).toEqual({
      type: 'GND',
      value: 'https://d-nb.info/gnd/118530471',
    });
    expect(await resolveManualAuthorityLink('https://www.geonames.org/1816670/beijing.html')).toEqual({
      type: 'Geonames',
      value: 'https://www.geonames.org/1816670/beijing.html',
    });
  });

  it('resolves a Wikipedia article to its Wikidata Q-id via the pageprops API', async () => {
    const fetchImpl = jest.fn(async (url: string) => {
      expect(url).toContain('fr.wikipedia.org/w/api.php');
      expect(url).toContain('titles=Yu_le_Grand');
      return {
        ok: true,
        json: async () => ({
          query: { pages: { '12345': { pageprops: { wikibase_item: 'Q505183' } } } },
        }),
      } as Response;
    });

    const qid = await resolveWikidataQidFromWikipediaUrl(
      'https://fr.wikipedia.org/wiki/Yu_le_Grand',
      fetchImpl,
    );
    expect(qid).toBe('Q505183');

    const id = await resolveManualAuthorityLink('https://fr.wikipedia.org/wiki/Yu_le_Grand', fetchImpl);
    expect(id).toEqual({ type: 'Wikidata', value: 'https://www.wikidata.org/wiki/Q505183' });
  });

  it('returns null when the Wikipedia page has no linked Wikidata item', async () => {
    const fetchImpl = jest.fn(async () =>
      ({ ok: true, json: async () => ({ query: { pages: { '1': {} } } }) }) as unknown as Response,
    );
    const id = await resolveManualAuthorityLink('https://en.wikipedia.org/wiki/Nonexistent', fetchImpl);
    expect(id).toBeNull();
  });

  it('rejects URLs from unrecognized domains', async () => {
    expect(await resolveManualAuthorityLink('https://en.wikisource.org/wiki/Something')).toBeNull();
    expect(await resolveManualAuthorityLink('https://baike.baidu.com/item/foo')).toBeNull();
    expect(await resolveManualAuthorityLink('not a url at all')).toBeNull();
    expect(await resolveManualAuthorityLink('')).toBeNull();
  });
});
