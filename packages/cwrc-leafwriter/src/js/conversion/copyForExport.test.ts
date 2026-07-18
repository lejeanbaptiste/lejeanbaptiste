import { collectAllUnitIds, findUnitByCorresp, findUnitById } from './copyForExport';

const parseDoc = (xml: string): Document => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error(`Test fixture XML did not parse: ${xml}`);
  }
  return doc;
};

describe('collectAllUnitIds', () => {
  test('returns unit ids in document order', () => {
    const doc = parseDoc(
      '<TEI><text><body><p xml:id="p1">A</p><p xml:id="p2">B</p></body></text></TEI>',
    );
    expect(collectAllUnitIds(doc, 'p')).toEqual(['p1', 'p2']);
  });

  test('excludes units inside teiHeader', () => {
    const doc = parseDoc(
      '<TEI><teiHeader><p xml:id="hdr">Header text</p></teiHeader>' +
        '<text><body><p xml:id="p1">Body text</p></body></text></TEI>',
    );
    expect(collectAllUnitIds(doc, 'p')).toEqual(['p1']);
  });

  test('deduplicates repeated ids', () => {
    const doc = parseDoc(
      '<TEI><text><body><p xml:id="p1">A</p><div><p id="p1">dup</p></div></body></text></TEI>',
    );
    expect(collectAllUnitIds(doc, 'p')).toEqual(['p1']);
  });
});

describe('findUnitById / findUnitByCorresp', () => {
  test('finds a source unit by xml:id and its translation by corresp', () => {
    const source = parseDoc('<TEI><text><body><p xml:id="p1">Source.</p></body></text></TEI>');
    const translation = parseDoc(
      '<TEI><text><body><p corresp="source.xml#p1">Translated.</p></body></text></TEI>',
    );

    const sourceUnit = findUnitById(source, 'p', 'p1');
    const translationUnit = findUnitByCorresp(translation, 'p', 'source.xml', 'p1');

    expect(sourceUnit?.textContent).toBe('Source.');
    expect(translationUnit?.textContent).toBe('Translated.');
  });
});
