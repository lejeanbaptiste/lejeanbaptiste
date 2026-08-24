import {
  addViafWikidataPair,
  authorityIdsFromPackCrosswalk,
  enrichCandidatesWithViafWikidataConcordance,
  emptyViafWikidataIndex,
  normalizeViafId,
  normalizeWikidataQid,
  parseViafWikidataConcordance,
} from './viafWikidataConcordance';
import { collapseCrossAuthorityCandidates } from './disambiguationCandidates';

describe('viafWikidataConcordance', () => {
  it('normalizes Q-ids and VIAF cluster ids', () => {
    expect(normalizeWikidataQid('31')).toBe('Q31');
    expect(normalizeWikidataQid('Q31')).toBe('Q31');
    expect(normalizeWikidataQid('https://www.wikidata.org/wiki/Q31')).toBe('Q31');
    expect(normalizeViafId('144248059')).toBe('144248059');
    expect(normalizeViafId('https://viaf.org/viaf/144248059')).toBe('144248059');
    expect(normalizeViafId('https://viaf.org/fr/viaf/144248059')).toBe('144248059');
  });

  it('parses concordance NDJSON', () => {
    const index = parseViafWikidataConcordance(
      '{"wikidata":"Q31","viaf":"144248059"}\n{"qid":"45","viaf":"153009195"}\n',
    );
    expect([...index.viafByWikidata.get('Q31')!]).toEqual(['144248059']);
    expect([...index.wikidataByViaf.get('153009195')!]).toEqual(['Q45']);
  });

  it('emits authority ids from pack crosswalk', () => {
    expect(authorityIdsFromPackCrosswalk({ viaf: '24645678', wikidata: ['5581'] })).toEqual(
      expect.arrayContaining([
        { type: 'VIAF', value: '24645678' },
        { type: 'Wikidata', value: 'Q5581' },
      ]),
    );
  });

  it('emits CBDB / DILA / Norbert crosswalk ids for person packs', () => {
    expect(
      authorityIdsFromPackCrosswalk(
        { cbdb: '1762', dila: 'A002401', norbert: '4135' },
        { norbertKind: 'person' },
      ),
    ).toEqual(
      expect.arrayContaining([
        { type: 'CBDB', value: '1762' },
        { type: 'DILA', value: 'A002401' },
        { type: 'NORBERT', value: 'person-4135' },
      ]),
    );
  });

  it('enriches live Wikidata + VIAF rows so collapse merges them without description scraping', () => {
    const index = emptyViafWikidataIndex();
    addViafWikidataPair(index, 'Q1137864', '404064183');

    const enriched = enrichCandidatesWithViafWikidataConcordance(
      [
        {
          id: 'https://www.wikidata.org/wiki/Q1137864',
          label: 'Example Person',
          sources: ['Wikidata'],
          uri: 'https://www.wikidata.org/wiki/Q1137864',
          authorityIds: [{ type: 'Wikidata', value: 'Q1137864' }],
        },
        {
          id: 'https://viaf.org/viaf/404064183',
          label: 'Example Person',
          sources: ['VIAF'],
          uri: 'https://viaf.org/viaf/404064183',
          authorityIds: [{ type: 'VIAF', value: '404064183' }],
        },
      ],
      index,
    );

    const rows = collapseCrossAuthorityCandidates(enriched);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sources).toEqual(expect.arrayContaining(['Wikidata', 'VIAF']));
    expect(rows[0]?.authorityIds).toEqual(
      expect.arrayContaining([
        { type: 'Wikidata', value: 'Q1137864' },
        { type: 'VIAF', value: '404064183' },
      ]),
    );
  });
});
