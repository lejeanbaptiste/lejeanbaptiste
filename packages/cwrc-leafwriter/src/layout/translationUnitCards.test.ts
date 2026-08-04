import { collectTranslationUnitCards } from './translationUnitCards';

describe('collectTranslationUnitCards', () => {
  test('lists companion units in document order with preview and note counts', () => {
    const xml = `<?xml version="1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text><body>
    <p corresp="source.xml#p1">First <note place="foot">n</note></p>
    <p corresp="other.xml#x">Skip</p>
    <p corresp="source.xml#p2">Second paragraph</p>
    <p corresp="source.xml#p3"></p>
  </body></text>
</TEI>`;
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const cards = collectTranslationUnitCards(doc, 'p', 'source.xml');
    expect(cards.map((c) => c.unitId)).toEqual(['p1', 'p2', 'p3']);
    expect(cards[0]?.previewText).toBe('First n');
    expect(cards[0]?.noteCount).toBe(1);
    expect(cards[0]?.previewHtml).toContain('note');
    expect(cards[1]).toMatchObject({
      unitId: 'p2',
      previewText: 'Second paragraph',
      previewHtml: 'Second paragraph',
      noteCount: 0,
    });
    expect(cards[2]).toMatchObject({ unitId: 'p3', previewText: '', previewHtml: '', noteCount: 0 });
  });
});
