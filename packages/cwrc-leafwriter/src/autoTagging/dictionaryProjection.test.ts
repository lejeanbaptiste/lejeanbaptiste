import { dictionaryTag, dictionaryTagProjection } from './dictionary';
import { normalizeDomText } from './normalize';
import type { Suggestion } from './types';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

const TEI_WRAP = (body: string) =>
  `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>${body}</body></text></TEI>`;

const anchorKey = (s: Suggestion) =>
  [
    s.tag,
    s.anchor.surface,
    s.anchor.occurrence,
    s.anchor.xpath,
    s.anchor.offset,
    s.anchor.endXpath ?? '',
    s.anchor.endOffset ?? '',
  ].join('\t');

const normalizeSuggestions = (suggestions: Suggestion[]) =>
  [...suggestions]
    .map(anchorKey)
    .sort((a, b) => a.localeCompare(b));

describe('dictionaryTagProjection', () => {
  it('matches dictionaryTag on plain body text without milestones', () => {
    const doc = parse(TEI_WRAP('<p>見王安石訪鄭玄。</p>'));
    const entries = [
      { string: '王安石', tag: 'persName' },
      { string: '鄭玄', tag: 'persName' },
    ];

    const legacy = dictionaryTag(doc, entries, 'ignore', 'authority');
    const projection = dictionaryTagProjection(doc, entries, 'ignore', 'authority');

    expect(normalizeSuggestions(projection)).toEqual(normalizeSuggestions(legacy));
  });

  it('finds a span split by lb that dictionaryTag misses', () => {
    const doc = parse(TEI_WRAP('<p>《般舟三<lb n="0324b25"/>昧》</p>'));
    const entries = [{ string: '般舟三昧', tag: 'title' }];

    const legacy = dictionaryTag(doc, entries, 'ignore', 'authority');
    const projection = dictionaryTagProjection(doc, entries, 'ignore', 'authority');

    expect(legacy).toHaveLength(0);
    expect(projection).toHaveLength(1);
    expect(projection[0]!.anchor.surface).toBe('般舟三昧');
  });

  it('finds a span split by lb with cross-node anchor boundaries', () => {
    const doc = parse(TEI_WRAP('<p>《般舟三<lb n="0324b25"/>昧》</p>'));
    const entries = [{ string: '般舟三昧', tag: 'title' }];
    const projection = dictionaryTagProjection(doc, entries, 'ignore', 'authority')[0]!;

    expect(projection.anchor.xpath).not.toBe(projection.anchor.endXpath);
    expect(projection.anchor.endOffset).toBeGreaterThan(0);
  });

  it('finds a span split by pb', () => {
    const doc = parse(TEI_WRAP('<p>王<pb n="0324b26"/>安石</p>'));
    const entries = [{ string: '王安石', tag: 'persName' }];

    expect(dictionaryTag(doc, entries, 'ignore')).toHaveLength(0);
    expect(dictionaryTagProjection(doc, entries, 'ignore')).toHaveLength(1);
  });

  it('matches dictionaryTag on corr-only text inside choice (single node)', () => {
    const doc = parse(
      TEI_WRAP('<p><choice><sic>王尭</sic><corr>王堯</corr></choice></p>'),
    );
    const entries = [{ string: '王堯', tag: 'persName' }];

    const legacy = dictionaryTag(doc, entries, 'ignore');
    const projection = dictionaryTagProjection(doc, entries, 'ignore');

    expect(normalizeSuggestions(projection)).toEqual(normalizeSuggestions(legacy));
    expect(projection).toHaveLength(1);
    expect(projection[0]!.anchor.endXpath).toBeUndefined();
  });

  it('finds corr text split by lb inside choice', () => {
    const doc = parse(
      TEI_WRAP(
        '<p><choice><sic>王尭</sic><corr>王<lb/>堯</corr></choice></p>',
      ),
    );
    const entries = [{ string: '王堯', tag: 'persName' }];

    const [hit] = dictionaryTagProjection(doc, entries, 'ignore');
    expect(hit!.anchor.surface).toBe('王堯');
    expect(hit!.anchor.endXpath).toBeTruthy();
  });
});
