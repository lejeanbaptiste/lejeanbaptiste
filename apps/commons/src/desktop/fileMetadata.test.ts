import {
  applyFileHeaderFields,
  readFileMetadataFromXml,
} from './fileMetadata';
import { buildOrlandoSkeletonXml, buildTeiSkeletonXml } from './schemaTemplates';

const teiSampleXml = () =>
  buildTeiSkeletonXml({
    schema: { catalogId: 'teiLite', rng: 'schema/tei_lite.rng', css: 'schema/tei.css' },
  });

const orlandoSampleXml = () =>
  buildOrlandoSkeletonXml({
    schema: { catalogId: 'orlando', rng: 'schema/orlando_entry.rng', css: 'schema/orlando.css' },
  });

describe('readFileMetadataFromXml', () => {
  test('reads title and source from TEI skeleton', () => {
    const values = readFileMetadataFromXml(teiSampleXml(), 'teiLite');

    expect(values['titleStmt/title']).toBe('Untitled');
    expect(values['sourceDesc/p']).toBe('');
  });

  test('reads populated TEI header fields', () => {
    const xml = applyFileHeaderFields(
      teiSampleXml(),
      {
        'titleStmt/title': 'My Document',
        'sourceDesc/p': 'British Library MS 123',
      },
      'teiLite',
    );
    const values = readFileMetadataFromXml(xml, 'teiLite');

    expect(values['titleStmt/title']).toBe('My Document');
    expect(values['sourceDesc/p']).toBe('British Library MS 123');
  });

  test('reads title and source from Orlando skeleton', () => {
    const values = readFileMetadataFromXml(orlandoSampleXml(), 'orlando');

    expect(values['FILEDESC/TITLESTMT/DOCTITLE']).toBe('Untitled');
    expect(values['FILEDESC/SOURCEDESC']).toBe('Born digital');
  });
});

describe('applyFileHeaderFields', () => {
  test('updates TEI title and source without changing body', () => {
    const original = teiSampleXml();
    const updated = applyFileHeaderFields(
      original,
      {
        'titleStmt/title': 'Chapter One',
        'sourceDesc/p': 'From the archive',
      },
      'teiLite',
    );

    expect(updated).toContain('<title>Chapter One</title>');
    expect(updated).toContain('<p>From the archive</p>');
    expect(updated).toContain('<div type="text">');
    expect(updated).toContain('<head>Section heading</head>');
    expect(updated).toContain('<p>Paragraph text</p>');
  });

  test('creates TEI sourceDesc paragraph when missing', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
<teiHeader>
  <fileDesc>
    <titleStmt><title>Untitled</title></titleStmt>
    <publicationStmt><p/></publicationStmt>
    <sourceDesc/>
  </fileDesc>
</teiHeader>
<text><body><p>Body</p></body></text>
</TEI>`;

    const updated = applyFileHeaderFields(xml, { 'sourceDesc/p': 'New source' }, 'teiLite');
    expect(updated).toContain('<sourceDesc><p>New source</p></sourceDesc>');
    expect(updated).toContain('<p>Body</p>');
  });

  test('clears TEI source when value is empty but keeps empty paragraph', () => {
    const xml = applyFileHeaderFields(
      teiSampleXml(),
      { 'sourceDesc/p': 'Temporary source' },
      'teiLite',
    );
    const cleared = applyFileHeaderFields(xml, { 'sourceDesc/p': '' }, 'teiLite');

    expect(readFileMetadataFromXml(cleared, 'teiLite')['sourceDesc/p']).toBe('');
    expect(cleared).toMatch(/<sourceDesc>\s*<p\s*\/?>\s*<\/sourceDesc>/);
  });

  test('updating title only does not leave loose text in sourceDesc', () => {
    const updated = applyFileHeaderFields(
      teiSampleXml(),
      {
        'titleStmt/title': 'My Document Title',
        'sourceDesc/p': '',
      },
      'teiLite',
    );

    expect(updated).toContain('<title>My Document Title</title>');
    expect(updated).toMatch(/<sourceDesc>\s*<p\s*\/?>\s*<\/sourceDesc>/);
  });

  test('updates Orlando title and source', () => {
    const updated = applyFileHeaderFields(
      orlandoSampleXml(),
      {
        'FILEDESC/TITLESTMT/DOCTITLE': 'Orlando Entry',
        'FILEDESC/SOURCEDESC': 'University archive',
      },
      'orlando',
    );

    expect(updated).toContain('<DOCTITLE>Orlando Entry</DOCTITLE>');
    expect(updated).toContain('<SOURCEDESC>University archive</SOURCEDESC>');
    expect(updated).toContain('<DIV0>');
  });
});
