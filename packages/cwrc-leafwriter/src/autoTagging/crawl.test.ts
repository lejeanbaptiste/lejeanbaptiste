import { crawlDocuments, crawlEntities } from './crawl';
import { applySuggestions } from './apply';
import type { DictionaryEntry } from './dictionary';
import { dictionaryTag } from './dictionary';
import { normalizeDomText } from './normalize';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

const byString = (entries: DictionaryEntry[], s: string) =>
  entries.find((e) => e.string === s);

describe('crawlDocuments', () => {
  it('merges tagged entities across documents, deduping by (surface, tag)', () => {
    const a = parse(
      `<TEI xmlns="http://www.tei-c.org/ns/1.0"><p><persName>上陽子</persName><placeName>洛陽</placeName></p></TEI>`,
    );
    const b = parse(
      `<TEI xmlns="http://www.tei-c.org/ns/1.0"><p><persName>上陽子</persName><persName>老君</persName></p></TEI>`,
    );
    const entries = crawlDocuments([a, b], 'ignore');
    const key = (e: { string: string; tag: string }) => `${e.tag}:${e.string}`;
    expect(entries.map(key).sort()).toEqual(
      ['persName:上陽子', 'persName:老君', 'placeName:洛陽'].sort(),
    );
  });
});

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

  it('never propagates entity ids — tag stage stays id-free', () => {
    const doc = parse(
      `<TEI xmlns="http://www.tei-c.org/ns/1.0"><p>
        <persName ref="p1">甲乙</persName><persName ref="p1">甲乙</persName>
        <persName ref="p2">丙丁</persName>
      </p></TEI>`,
    );
    const entries = crawlEntities(doc, 'ignore');
    // even a unanimous @ref is not carried into the entry
    expect(entries).toEqual([
      { string: '甲乙', tag: 'persName' },
      { string: '丙丁', tag: 'persName' },
    ]);
  });

  it('normalizes surfaces with the whitespace policy so they match later', () => {
    const doc = parse(
      `<TEI xmlns="http://www.tei-c.org/ns/1.0"><p><persName>上\n  陽子</persName></p></TEI>`,
    );
    const [entry] = crawlEntities(doc, 'ignore');
    expect(entry!.string).toBe('上陽子');
  });

  it('feeds the producer: tags untagged occurrences of already-tagged names', async () => {
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
    // tag stage writes no ids — the existing @ref is not propagated
    expect(suggestions.every((s) => s.attributes === undefined)).toBe(true);

    const { applied } = await applySuggestions(doc, suggestions, { policy: 'ignore' });
    expect(applied).toBe(2);
    const xml = new XMLSerializer().serializeToString(doc);
    expect(xml).toContain('又見<persName>上陽子</persName>');
  });

  it('ignores entity tags inside <date> so they are not propagated', () => {
    const doc = parse(
      `<TEI xmlns="http://www.tei-c.org/ns/1.0"><p>
        <date when="618"><placeName>洛陽</placeName></date>
        又到洛陽。
      </p></TEI>`,
    );
    const entries = crawlEntities(doc, 'ignore');
    expect(entries).toEqual([]);
    const suggestions = dictionaryTag(doc, entries, 'ignore');
    expect(suggestions).toHaveLength(0);
  });
});
