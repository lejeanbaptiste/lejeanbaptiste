import { crawlEntities } from './crawl';
import { applySuggestions } from './apply';
import { dictionaryTag } from './dictionary';
import { normalizeDomText } from './normalize';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

const byString = (entries: { string: string }[], s: string) =>
  entries.find((e) => e.string === s);

describe('crawlEntities', () => {
  it('collects distinct (surface, tag) pairs from tagged entities', () => {
    const doc = parse(
      `<TEI xmlns="http://www.tei-c.org/ns/1.0"><p>
        <persName>上陽子</persName>與<persName>老君</persName>論道，<placeName>洛陽</placeName>。
        又見<persName>上陽子</persName>。
      </p></TEI>`,
    );
    const entries = crawlEntities(doc, 'ignore');
    expect(entries).toHaveLength(3);
    expect(byString(entries, '上陽子')!.tag).toBe('persName');
    expect(byString(entries, '洛陽')!.tag).toBe('placeName');
  });

  it('propagates an entity id only when every instance agrees', () => {
    const doc = parse(
      `<TEI xmlns="http://www.tei-c.org/ns/1.0"><p>
        <persName ref="p1">甲</persName><persName ref="p1">甲</persName>
        <persName ref="p2">乙</persName><persName ref="p3">乙</persName>
        <persName ref="p4">丙</persName><persName>丙</persName>
      </p></TEI>`,
    );
    const entries = crawlEntities(doc, 'ignore');
    expect(byString(entries, '甲')!.entityId).toBe('p1'); // unanimous
    expect(byString(entries, '乙')!.entityId).toBeUndefined(); // conflicting keys
    expect(byString(entries, '丙')!.entityId).toBeUndefined(); // one instance keyless
  });

  it('normalizes surfaces with the whitespace policy so they match later', () => {
    const doc = parse(
      `<TEI xmlns="http://www.tei-c.org/ns/1.0"><p><persName>上\n  陽子</persName></p></TEI>`,
    );
    const [entry] = crawlEntities(doc, 'ignore');
    expect(entry!.string).toBe('上陽子');
  });

  it('feeds the producer: tags untagged occurrences of already-tagged names', () => {
    const doc = parse(
      `<TEI xmlns="http://www.tei-c.org/ns/1.0"><body>
        <p><persName ref="p1">上陽子</persName>曰。</p>
        <p>又見上陽子，上陽子再曰。</p>
      </body></TEI>`,
    );
    const entries = crawlEntities(doc, 'ignore');
    const suggestions = dictionaryTag(doc, entries, 'ignore', 'this document');

    // two untagged occurrences in the second paragraph
    expect(suggestions).toHaveLength(2);
    expect(suggestions.every((s) => s.tag === 'persName')).toBe(true);
    // the unanimous ref is carried onto the new tags
    expect(suggestions.every((s) => s.attributes?.key === 'p1')).toBe(true);

    const { applied } = applySuggestions(doc, suggestions, { policy: 'ignore' });
    expect(applied).toBe(2);
    const xml = new XMLSerializer().serializeToString(doc);
    expect(xml).toContain('又見<persName key="p1">上陽子</persName>');
  });
});
