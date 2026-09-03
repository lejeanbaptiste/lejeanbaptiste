import { normalizeBdrcId } from './bdrcIds';
import {
  addBdrcWikidataPair,
  clearBdrcWikidataConcordanceCacheForTests,
  emptyBdrcWikidataIndex,
  enrichCandidatesWithBdrcWikidataConcordance,
  fetchBdrcIdsForQids,
  indexBdrcWikidataFromPackNdjson,
  loadBdrcWikidataConcordance,
  parseBdrcWikidataConcordance,
} from './bdrcWikidataConcordance';

describe('bdrcWikidataConcordance', () => {
  it('parses concordance NDJSON', () => {
    const index = parseBdrcWikidataConcordance(
      '{"wikidata":"Q106801354","bdrc":"P7758"}\n{"qid":"Q42","bdrc":"P1KG18539"}\n',
    );
    expect([...index.bdrcByWikidata.get('Q106801354')!]).toEqual(['P7758']);
    expect([...index.wikidataByBdrc.get('P1KG18539')!]).toEqual(['Q42']);
  });

  it('indexes P2477 from a Tibetan Wikidata pack row', () => {
    const index = indexBdrcWikidataFromPackNdjson(
      `${JSON.stringify({
        authorityId: 'Q106801354',
        metadata: { crosswalk: { bdrc: 'P7758', wikidata: 'Q106801354' } },
      })}\n`,
    );
    expect([...index.bdrcByWikidata.get('Q106801354')!]).toEqual(['P7758']);
  });

  it('adds a BDRC badge source to a live Wikidata candidate', () => {
    const index = emptyBdrcWikidataIndex();
    addBdrcWikidataPair(index, 'Q106801354', 'P7758');

    const [row] = enrichCandidatesWithBdrcWikidataConcordance(
      [
        {
          uri: 'https://www.wikidata.org/wiki/Q106801354',
          sources: ['Wikidata'],
          authorityIds: [{ type: 'Wikidata', value: 'Q106801354' }],
        },
      ],
      index,
    );

    expect(row?.sources).toEqual(['Wikidata', 'BDRC']);
    expect(row?.authorityIds).toEqual(
      expect.arrayContaining([
        { type: 'Wikidata', value: 'Q106801354' },
        { type: 'BDRC', value: 'P7758' },
      ]),
    );
    expect(normalizeBdrcId('P7758')).toBe('P7758');
  });

  it('reads P2477 from a live Wikidata entity payload', async () => {
    const fetchImpl = (async () => ({
      ok: true,
      json: async () => ({
        entities: {
          Q106801354: {
            claims: {
              P2477: [{ mainsnak: { snaktype: 'value', datavalue: { value: 'P7758' } } }],
            },
          },
        },
      }),
    })) as unknown as typeof fetch;

    const index = await fetchBdrcIdsForQids(['Q106801354'], fetchImpl);
    expect([...index.bdrcByWikidata.get('Q106801354')!]).toEqual(['P7758']);
  });

  it('does not scan Tibetan Wikidata packs when loading the concordance', async () => {
    clearBdrcWikidataConcordanceCacheForTests();
    const requested: string[] = [];
    const readPackFile = async (packId: string) => {
      requested.push(packId);
      if (packId === 'wikidata-bdrc-concordance') {
        return '{"wikidata":"Q1","bdrc":"P1"}\n';
      }
      throw new Error(`should not read ${packId}`);
    };
    const index = await loadBdrcWikidataConcordance(readPackFile);
    expect([...index.bdrcByWikidata.get('Q1')!]).toEqual(['P1']);
    expect(requested).toEqual(['wikidata-bdrc-concordance']);
  });
});
