/**
 * @jest-environment jsdom
 */
import { ENTITY_REF_TYPE } from './translationEntityFields';
import {
  collectEntityFieldsInDocumentOrder,
  countPriorEntityRefsInDocument,
  fileOccurrenceIndexForUnitInsert,
} from './fileWideOccurrence';

const companionXml = `
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text>
    <body>
      <div corresp="source.xml#unit-a"><p>Before <ref type="${ENTITY_REF_TYPE}" key="person-1">A</ref></p></div>
      <div corresp="source.xml#unit-b"><p>Here <ref type="${ENTITY_REF_TYPE}" key="person-1">B</ref></p></div>
    </body>
  </text>
</TEI>`;

describe('fileWideOccurrence', () => {
  test('counts prior refs across units before the current unit', () => {
    const doc = new DOMParser().parseFromString(companionXml, 'application/xml');
    expect(
      countPriorEntityRefsInDocument(doc, 'div', 'source.xml', 'unit-b', 'person-1'),
    ).toBe(1);
  });

  test('fileOccurrenceIndexForUnitInsert adds within-unit offset', () => {
    const doc = new DOMParser().parseFromString(companionXml, 'application/xml');
    expect(
      fileOccurrenceIndexForUnitInsert(doc, 'div', 'source.xml', 'unit-b', 'person-1', 0),
    ).toBe(2);
  });

  test('collectEntityFieldsInDocumentOrder walks companion units', () => {
    const doc = new DOMParser().parseFromString(companionXml, 'application/xml');
    const ordered = collectEntityFieldsInDocumentOrder(doc, 'div', 'source.xml');
    expect(ordered).toHaveLength(2);
    expect(ordered[0]?.unitId).toBe('unit-a');
    expect(ordered[1]?.unitId).toBe('unit-b');
  });
});
