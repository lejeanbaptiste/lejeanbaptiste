import { buildDocIndex } from './anchor';
import { findOccurrenceOffset, locateInDoc, parseValidItems } from './llmParse';
import { normalizeDomText } from './normalize';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

describe('parseValidItems', () => {
  const validJson = JSON.stringify({
    suggestions: [
      { surface: '張衡', occurrence: 1, tag: 'persName', action: 'add', confidence: 0.9, rationale: 'name' },
    ],
  });

  it('accepts a well-formed response', () => {
    expect(parseValidItems(validJson, ['persName'], ['add'])).toEqual([
      { surface: '張衡', occurrence: 1, tag: 'persName', action: 'add', confidence: 0.9, rationale: 'name' },
    ]);
  });

  it('drops the whole response on invalid JSON', () => {
    expect(parseValidItems('not json', ['persName'], ['add'])).toEqual([]);
  });

  it('drops the whole response when the top-level shape is wrong', () => {
    expect(parseValidItems(JSON.stringify({ items: [] }), ['persName'], ['add'])).toEqual([]);
  });

  it('drops items whose tag was not requested', () => {
    const json = JSON.stringify({
      suggestions: [
        { surface: 'X', occurrence: 1, tag: 'placeName', action: 'add', confidence: 0.5, rationale: 'r' },
      ],
    });
    expect(parseValidItems(json, ['persName'], ['add'])).toEqual([]);
  });

  it('drops items whose action was not allowed', () => {
    const json = JSON.stringify({
      suggestions: [
        { surface: 'X', occurrence: 1, tag: 'persName', action: 'remove', confidence: 0.5, rationale: 'r' },
      ],
    });
    expect(parseValidItems(json, ['persName'], ['add'])).toEqual([]);
  });

  it('drops items with out-of-range confidence', () => {
    const json = JSON.stringify({
      suggestions: [
        { surface: 'X', occurrence: 1, tag: 'persName', action: 'add', confidence: 1.5, rationale: 'r' },
      ],
    });
    expect(parseValidItems(json, ['persName'], ['add'])).toEqual([]);
  });

  it('keeps valid items and drops invalid ones in the same batch', () => {
    const json = JSON.stringify({
      suggestions: [
        { surface: 'good', occurrence: 1, tag: 'persName', action: 'add', confidence: 0.5, rationale: 'r' },
        { surface: 'bad', occurrence: 1, tag: 'unknownTag', action: 'add', confidence: 0.5, rationale: 'r' },
      ],
    });
    expect(parseValidItems(json, ['persName'], ['add'])).toHaveLength(1);
  });

  it('coerces string occurrence and defaults action when only one is allowed', () => {
    const json = JSON.stringify({
      suggestions: [{ surface: '張衡', occurrence: '1', tag: 'persName', confidence: 0.9, rationale: 'name' }],
    });
    expect(parseValidItems(json, ['persName'], ['add'])).toEqual([
      { surface: '張衡', occurrence: 1, tag: 'persName', action: 'add', confidence: 0.9, rationale: 'name' },
    ]);
  });
});

describe('findOccurrenceOffset', () => {
  it('finds the nth occurrence', () => {
    expect(findOccurrenceOffset('ababab', 'ab', 2)).toBe(2);
    expect(findOccurrenceOffset('ababab', 'ab', 3)).toBe(4);
  });

  it('returns null when there are fewer occurrences than requested', () => {
    expect(findOccurrenceOffset('ababab', 'ab', 4)).toBeNull();
  });
});

describe('locateInDoc', () => {
  it('locates a span within a single text node', () => {
    const doc = parse('<TEI><text><body><p>alpha beta gamma</p></body></text></TEI>');
    const index = buildDocIndex(doc, 'collapse');
    const located = locateInDoc(index, index.text.indexOf('beta'), 4);
    expect(located).not.toBeNull();
    expect(located!.node.data.slice(located!.rawStart, located!.rawEnd)).toBe('beta');
  });

  it('returns null when the span crosses a text-node boundary', () => {
    const doc = parse('<TEI><text><body><p>alpha<placeName>beta</placeName>gamma</p></body></text></TEI>');
    const index = buildDocIndex(doc, 'collapse');
    // "phabeta" spans the alpha/beta node boundary.
    const start = index.text.indexOf('pha');
    expect(locateInDoc(index, start, 7)).toBeNull();
  });

  it('returns null for an out-of-range offset', () => {
    const doc = parse('<TEI><text><body><p>alpha</p></body></text></TEI>');
    const index = buildDocIndex(doc, 'collapse');
    expect(locateInDoc(index, 999, 1)).toBeNull();
  });
});
