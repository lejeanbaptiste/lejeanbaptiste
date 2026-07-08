import {
  applySourceDescriptionToXml,
  emptySourceDescription,
  readSourceDescriptionFromXml,
  type SourceDescription,
} from './sourceDescription';

const skeleton = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
<teiHeader>
  <fileDesc>
    <titleStmt><title>Untitled</title></titleStmt>
    <publicationStmt><authority/></publicationStmt>
    <sourceDesc><p/></sourceDesc>
  </fileDesc>
</teiHeader>
<text><body><p>Body text</p></body></text>
</TEI>`;

const fullData = (): SourceDescription => ({
  title: 'Les Misérables',
  authors: [{ name: 'Victor Hugo', ref: 'https://www.wikidata.org/wiki/Q535' }],
  workDate: { when: '1862' },
  edition: '2nd edition',
  editionDate: '1863',
  sourceNote: 'Transcribed from the BnF Gallica scan.',
});

describe('applySourceDescriptionToXml', () => {
  test('writes title, authors, dates, edition, and note in standard TEI locations', () => {
    const xml = applySourceDescriptionToXml(skeleton, fullData());

    expect(xml).toContain('<title>Les Misérables</title>');
    expect(xml).toContain('<author ref="https://www.wikidata.org/wiki/Q535">Victor Hugo</author>');
    expect(xml).toContain('<biblStruct><monogr>');
    expect(xml).toContain('<edition>2nd edition</edition>');
    expect(xml).toContain('<imprint><date when="1863">1863</date></imprint>');
    expect(xml).toContain('<note>Transcribed from the BnF Gallica scan.</note>');
    expect(xml).toContain('<creation><date when="1862">1862</date></creation>');
    // Legacy empty p is removed once biblStruct is present.
    expect(xml).not.toContain('<sourceDesc><p/>');
  });

  test('round-trips through read', () => {
    const xml = applySourceDescriptionToXml(skeleton, fullData());
    expect(readSourceDescriptionFromXml(xml)).toEqual(fullData());
  });

  test('supports notBefore/notAfter date ranges', () => {
    const data = { ...fullData(), workDate: { notBefore: '1850', notAfter: '1860' } };
    const xml = applySourceDescriptionToXml(skeleton, data);
    expect(xml).toContain('<date notBefore="1850" notAfter="1860">1850–1860</date>');
    expect(readSourceDescriptionFromXml(xml).workDate).toEqual({
      notBefore: '1850',
      notAfter: '1860',
    });
  });

  test('inserts profileDesc before revisionDesc', () => {
    const withRevision = skeleton.replace(
      '</teiHeader>',
      '<revisionDesc><change>edit</change></revisionDesc></teiHeader>',
    );
    const xml = applySourceDescriptionToXml(withRevision, fullData());
    expect(xml.indexOf('<profileDesc>')).toBeLessThan(xml.indexOf('<revisionDesc>'));
    expect(xml.indexOf('<fileDesc>')).toBeLessThan(xml.indexOf('<profileDesc>'));
  });

  test('migrates legacy sourceDesc/p text and clearing all fields restores empty p', () => {
    const legacy = skeleton.replace('<sourceDesc><p/>', '<sourceDesc><p>Old source note</p>');
    expect(readSourceDescriptionFromXml(legacy).sourceNote).toBe('Old source note');

    const cleared = applySourceDescriptionToXml(
      applySourceDescriptionToXml(legacy, fullData()),
      emptySourceDescription(),
    );
    expect(cleared).not.toContain('biblStruct');
    expect(cleared).not.toContain('profileDesc');
    expect(cleared).toContain('<sourceDesc><p/></sourceDesc>');
  });

  test('keeps multiple authors in order in titleStmt after the title', () => {
    const data = {
      ...fullData(),
      authors: [
        { name: 'Victor Hugo', ref: 'https://www.wikidata.org/wiki/Q535' },
        { name: 'Anonymous Collaborator' },
      ],
    };
    const xml = applySourceDescriptionToXml(skeleton, data);
    const read = readSourceDescriptionFromXml(xml);
    expect(read.authors).toEqual(data.authors);
    expect(xml.indexOf('<title>Les Misérables</title>')).toBeLessThan(
      xml.indexOf('Victor Hugo'),
    );
  });

  test('leaves non-TEI XML untouched', () => {
    const other = '<root><child/></root>';
    expect(applySourceDescriptionToXml(other, fullData())).toBe(other);
  });
});
