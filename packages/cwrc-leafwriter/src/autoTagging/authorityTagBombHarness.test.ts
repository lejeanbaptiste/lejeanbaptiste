import type { AuthorityPackId } from './packPaths';
import { normalizeDomText } from './normalize';
import { goldMentions, runAuthorityTagBombHarness, stripTags } from './validationHarness';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

const miniPackNdjson = [
  JSON.stringify({
    source: 'DILA',
    authorityId: 'zheng-xuan',
    kind: 'person',
    primaryName: '鄭玄',
    searchStrings: ['鄭玄'],
    metadata: { startYear: 127, endYear: 200, description: '鄭玄 (Han)' },
  }),
  JSON.stringify({
    source: 'DILA',
    authorityId: 'luoyang',
    kind: 'place',
    primaryName: '洛陽',
    searchStrings: ['洛陽'],
    metadata: { startYear: -200, endYear: 200, description: '洛陽' },
  }),
  JSON.stringify({
    source: 'DILA',
    authorityId: 'noise',
    kind: 'person',
    primaryName: '虛構',
    searchStrings: ['虛構'],
    metadata: { startYear: 960, endYear: 1127, description: 'Song-only noise' },
  }),
].join('\n');

describe('runAuthorityTagBombHarness', () => {
  const goldXml =
    '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><persName>鄭玄</persName>遊<placeName>洛陽</placeName>。</p></body></text></TEI>';

  const readPack = async (_packId: AuthorityPackId) => miniPackNdjson;

  it('scores tag bomb against stripped gold mentions', async () => {
    const doc = parse(goldXml);
    const report = await runAuthorityTagBombHarness(doc, {
      policy: 'ignore',
      tags: ['persName', 'placeName'],
      packIds: ['dila-persons'],
      readPackFile: readPack,
      yearRange: { start: 25, end: 220 },
      hideUndated: true,
    });

    expect(report.goldCount).toBe(2);
    expect(report.overall).toMatchObject({ tp: 2, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1 });
    expect(report.candidateCount).toBe(2);
  });

  it('merges CBDB and DILA rows linked by crosswalk into one match', async () => {
    const overlapPack = [
      JSON.stringify({
        source: 'CBDB',
        authorityId: '1762',
        kind: 'person',
        primaryName: '王安石',
        searchStrings: ['王安石'],
        metadata: { startYear: 1021, endYear: 1086, description: 'CBDB 王安石' },
      }),
      JSON.stringify({
        source: 'DILA',
        authorityId: 'A002401',
        kind: 'person',
        primaryName: '王安石',
        searchStrings: ['王安石'],
        metadata: {
          startYear: 1021,
          endYear: 1086,
          description: 'DILA 王安石',
          crosswalk: { cbdb: '01762' },
        },
      }),
    ].join('\n');

    const doc = parse(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>見<persName>王安石</persName>。</p></body></text></TEI>',
    );
    const readOverlap = async (packId: AuthorityPackId) => {
      const lines = overlapPack.split('\n');
      if (packId === 'cbdb-persons') return lines[0] ?? '';
      if (packId === 'dila-persons') return lines[1] ?? '';
      return '';
    };

    const report = await runAuthorityTagBombHarness(doc, {
      policy: 'ignore',
      tags: ['persName'],
      packIds: ['cbdb-persons', 'dila-persons'],
      readPackFile: readOverlap,
    });

    expect(report.overall.tp).toBe(1);
    expect(report.overall.fn).toBe(0);
    expect(report.candidateCount).toBe(2);
  });

  it('year filter excludes out-of-range dictionary entries before matching', async () => {
    const doc = parse(goldXml);
    const report = await runAuthorityTagBombHarness(doc, {
      policy: 'ignore',
      tags: ['persName', 'placeName'],
      packIds: ['dila-persons'],
      readPackFile: readPack,
      yearRange: { start: 960, end: 1279 },
      hideUndated: true,
    });

    expect(report.candidateCount).toBe(1);
    expect(report.overall.fp).toBe(0);
    expect(report.overall.fn).toBe(2);
  });

  it('stripTags leaves the same flattened text the tag bomb scans', () => {
    const doc = parse(goldXml);
    const gold = goldMentions(doc, 'ignore', ['persName', 'placeName']);
    const stripped = stripTags(doc, ['persName', 'placeName']);
    expect(stripped.getElementsByTagName('persName')).toHaveLength(0);
    expect(gold.map((g) => g.surface).sort()).toEqual(['洛陽', '鄭玄']);
  });
});
