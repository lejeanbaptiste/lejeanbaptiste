import { dictionaryTagProjection } from './dictionary';
import { normalizeDomText } from './normalize';
import { prepareSuggestionsForReview } from './suggestionFilters';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

const TEI = (body: string) =>
  `<TEI xmlns="http://www.tei-c.org/ns/1.0">
    <teiHeader><fileDesc><titleStmt><title>關於丹陽</title></titleStmt></fileDesc></teiHeader>
    <text><body>${body}</body></text>
  </TEI>`;

describe('projection suggestions through prepareSuggestionsForReview', () => {
  it('keeps 丹陽 split by pb when the header also contains the same surface', () => {
    const doc = parse(TEI('<p>丹<pb n="663"/>陽</p>'));
    const raw = dictionaryTagProjection(doc, [{ string: '丹陽', tag: 'placeName' }], 'ignore');
    expect(raw).toHaveLength(1);
    expect(raw[0]!.anchor.endXpath).toBeTruthy();

    const { suggestions, droppedNested } = prepareSuggestionsForReview(doc, 'ignore', raw);
    expect(droppedNested).toBe(0);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.anchor.surface).toBe('丹陽');
  });
});
