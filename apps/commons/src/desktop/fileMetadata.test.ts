import {
  applyFileHeaderFields,
  readFileMetadataFromXml,
} from './fileMetadata';
import { buildTeiSkeletonXml } from './schemaTemplates';

const sampleXml = () =>
  buildTeiSkeletonXml({
    schema: { catalogId: 'teiLite', rng: 'schema/tei_lite.rng', css: 'schema/tei.css' },
  });

describe('readFileMetadataFromXml', () => {
  test('reads title and source from skeleton', () => {
    const values = readFileMetadataFromXml(sampleXml());

    expect(values['titleStmt/title']).toBe('Untitled');
    expect(values['sourceDesc/p']).toBe('');
  });

  test('reads populated header fields', () => {
    const xml = applyFileHeaderFields(sampleXml(), {
      'titleStmt/title': 'My Document',
      'sourceDesc/p': 'British Library MS 123',
    });
    const values = readFileMetadataFromXml(xml);

    expect(values['titleStmt/title']).toBe('My Document');
    expect(values['sourceDesc/p']).toBe('British Library MS 123');
  });
});

describe('applyFileHeaderFields', () => {
  test('updates title and source without changing body', () => {
    const original = sampleXml();
    const updated = applyFileHeaderFields(original, {
      'titleStmt/title': 'Chapter One',
      'sourceDesc/p': 'From the archive',
    });

    expect(updated).toContain('<title>Chapter One</title>');
    expect(updated).toContain('<p>From the archive</p>');
    expect(updated).toContain('<div type="text">');
    expect(updated).toMatch(/<div type="text">\s*<p>/);
  });

  test('creates sourceDesc paragraph when missing', () => {
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

    const updated = applyFileHeaderFields(xml, { 'sourceDesc/p': 'New source' });
    expect(updated).toContain('<sourceDesc><p>New source</p></sourceDesc>');
    expect(updated).toContain('<p>Body</p>');
  });

  test('clears source when value is empty', () => {
    const xml = applyFileHeaderFields(sampleXml(), {
      'sourceDesc/p': 'Temporary source',
    });
    const cleared = applyFileHeaderFields(xml, { 'sourceDesc/p': '' });

    expect(readFileMetadataFromXml(cleared)['sourceDesc/p']).toBe('');
  });
});
