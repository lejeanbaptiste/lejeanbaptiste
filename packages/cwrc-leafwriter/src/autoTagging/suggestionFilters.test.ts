import { normalizeDomText } from './normalize';
import { filterNestedSameTagAdds, prepareSuggestionsForReview } from './suggestionFilters';
import type { Suggestion } from './types';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

const addSuggestion = (surface: string, occurrence: number, tag: string): Suggestion => ({
  id: 'x',
  source: 'ai',
  action: 'add',
  tag,
  status: 'pending',
  anchor: {
    documentId: '',
    xpath: '',
    offset: 0,
    surface,
    occurrence,
    contextBefore: '',
    contextAfter: '',
    nodeHash: '',
  },
});

describe('filterNestedSameTagAdds', () => {
  it('drops an add nested inside the same tag type', () => {
    const doc = parse('<TEI><text><body><p><persName>張行成</persName></p></body></text></TEI>');
    const { suggestions, dropped } = filterNestedSameTagAdds(doc, 'ignore', [
      addSuggestion('行成', 1, 'persName'),
      addSuggestion('張行成', 1, 'persName'),
    ]);
    expect(dropped).toBe(2);
    expect(suggestions).toHaveLength(0);
  });

  it('keeps an add on plain text', () => {
    const doc = parse('<TEI><text><body><p><persName>張行成</persName>與洛陽</p></body></text></TEI>');
    const { suggestions, dropped } = filterNestedSameTagAdds(doc, 'ignore', [
      addSuggestion('洛陽', 1, 'placeName'),
    ]);
    expect(dropped).toBe(0);
    expect(suggestions).toHaveLength(1);
  });

  it('keeps an add inside a different tag type', () => {
    const doc = parse('<TEI><text><body><p><persName>張行成</persName></p></body></text></TEI>');
    const { suggestions, dropped } = filterNestedSameTagAdds(doc, 'ignore', [
      addSuggestion('行成', 1, 'placeName'),
    ]);
    expect(dropped).toBe(0);
    expect(suggestions).toHaveLength(1);
  });

  it('passes through non-add actions unchanged', () => {
    const doc = parse('<TEI><text><body><p><persName>張衡</persName></p></body></text></TEI>');
    const remove = { ...addSuggestion('張衡', 1, 'persName'), action: 'remove' as const };
    const { suggestions, dropped } = filterNestedSameTagAdds(doc, 'ignore', [remove]);
    expect(dropped).toBe(0);
    expect(suggestions).toEqual([remove]);
  });

  it('drops an add for placeName already wrapped in placeName', () => {
    const doc = parse(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><placeName>洛陽</placeName></p></body></text></TEI>',
    );
    const { suggestions, dropped } = filterNestedSameTagAdds(doc, 'ignore', [
      addSuggestion('洛陽', 1, 'placeName'),
    ]);
    expect(dropped).toBe(1);
    expect(suggestions).toHaveLength(0);
  });

  it('drops an add for placeName already wrapped in geogName', () => {
    const doc = parse(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><geogName>洛陽</geogName></p></body></text></TEI>',
    );
    const { suggestions, dropped } = filterNestedSameTagAdds(doc, 'ignore', [
      addSuggestion('洛陽', 1, 'placeName'),
    ]);
    expect(dropped).toBe(1);
    expect(suggestions).toHaveLength(0);
  });

  it('dedupes identical location suggestions in prepareSuggestionsForReview', () => {
    const doc = parse('<TEI><text><body><p>洛陽</p></body></text></TEI>');
    const first = addSuggestion('洛陽', 1, 'placeName');
    const duplicate = { ...addSuggestion('洛陽', 1, 'placeName'), id: 'y' };
    const { suggestions, droppedDuplicate } = prepareSuggestionsForReview(doc, 'ignore', [
      first,
      duplicate,
    ]);
    expect(droppedDuplicate).toBe(1);
    expect(suggestions).toHaveLength(1);
  });
});
