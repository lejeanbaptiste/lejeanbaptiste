import { normalizeDomText } from './normalize';
import { runAuthorityTagBombOnDocument } from './authorityTagBomb';
import type { AuthorityPackId } from './packPaths';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

const doc = () =>
  parse(
    '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>見王安石訪鄭玄。</p></body></text></TEI>',
  );

const dilaPack = JSON.stringify({
  source: 'DILA',
  authorityId: 'wang-anshi',
  kind: 'person',
  primaryName: '王安石',
  searchStrings: ['王安石'],
  metadata: { startYear: 1021, endYear: 1086 },
});

describe('runAuthorityTagBombOnDocument extraCandidates', () => {
  const readPack = async (_packId: AuthorityPackId) => dilaPack;

  it('merges extraCandidates (e.g. PEDB) alongside NDJSON packs', async () => {
    const result = await runAuthorityTagBombOnDocument(doc(), ['dila-persons'], readPack, 'ignore', {
      extraCandidates: [
        {
          groupLabel: 'pedb-persons',
          candidates: [
            {
              source: 'PEDB',
              authorityId: 'person-1',
              kind: 'person',
              primaryName: '鄭玄',
              searchStrings: ['鄭玄'],
              metadata: { startYear: 127, endYear: 200 },
            },
          ],
        },
      ],
    });

    expect(result.matchCount).toBe(2);
    expect(result.loaded['dila-persons']).toBe(1);
    expect(result.loaded['pedb-persons' as AuthorityPackId]).toBe(1);
    expect(result.suggestions.map((s) => s.anchor.surface).sort()).toEqual(['王安石', '鄭玄']);
  });

  it('applies the date filter to extraCandidates the same as pack candidates', async () => {
    const result = await runAuthorityTagBombOnDocument(doc(), ['dila-persons'], readPack, 'ignore', {
      dateFilter: { mode: 'limit', start: 25, end: 220 },
      extraCandidates: [
        {
          groupLabel: 'pedb-persons',
          candidates: [
            {
              source: 'PEDB',
              authorityId: 'person-1',
              kind: 'person',
              primaryName: '鄭玄',
              searchStrings: ['鄭玄'],
              metadata: { startYear: 127, endYear: 200 },
            },
          ],
        },
      ],
    });

    // DILA's 王安石 (1021-1086) falls outside the 25-220 CE window; PEDB's 鄭玄 is inside it.
    expect(result.loaded['dila-persons']).toBe(0);
    expect(result.loaded['pedb-persons' as AuthorityPackId]).toBe(1);
    expect(result.suggestions.map((s) => s.anchor.surface)).toEqual(['鄭玄']);
  });
});
