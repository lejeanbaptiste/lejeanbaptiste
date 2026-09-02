import { dictionaryTagProjection } from './dictionary';
import { resolveCurrentDocumentXml, type DocumentContentReader } from './documentContent';
import { normalizeDomText } from './normalize';
import { prepareSuggestionsForReview } from './suggestionFilters';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

const STORED = `<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader><fileDesc><titleStmt><title>關於丹陽</title></titleStmt></fileDesc></teiHeader>
  <text><body><p>丹<pb n="663"/>陽</p></body></text>
</TEI>`;

const FLATTENED_EXPORT = `<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text><body><p>丹陽</p></body></text>
</TEI>`;

describe('tag bomb document source with milestone split place name', () => {
  afterEach(() => {
    delete window.__desktopStoredDocumentXml;
  });

  it('matches 丹陽 when visual export drops pb but stored snapshot keeps it', async () => {
    window.__desktopStoredDocumentXml = STORED;
    const reader: DocumentContentReader = {
      converter: { getDocumentContent: async () => FLATTENED_EXPORT },
      overmindState: { ui: { editorViewMode: 'visual' } },
    };

    const xml = await resolveCurrentDocumentXml(reader);
    const doc = parse(xml);
    const raw = dictionaryTagProjection(doc, [{ string: '丹陽', tag: 'placeName' }], 'ignore');
    expect(raw).toHaveLength(1);
    expect(raw[0]!.anchor.endXpath).toBeTruthy();

    const { suggestions, droppedNested } = prepareSuggestionsForReview(doc, 'ignore', raw);
    expect(droppedNested).toBe(0);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.anchor.surface).toBe('丹陽');
  });
});
