import {
  applyProjectSchemaProcessingInstructions,
  buildDocumentImportPlan,
  buildImportedDocumentXml,
  buildImportedXmlDocument,
  catalogXmlFamily,
  demoteEntityKeys,
  detectXmlDocumentFamily,
  FORMER_KEY_ANA_PREFIX,
  inspectImportedXml,
  isEntityDatabaseFilename,
  normalizeImportedParagraphs,
  stripMarkdownToPlainText,
  stripRtfToPlainText,
} from './documentImport';
import type { ProjectFileConfig } from './projectFile';

const config: ProjectFileConfig = {
  name: 'Test project',
  schema: {
    catalogId: 'teiLite',
    css: 'schema/tei.css',
    rng: 'schema/tei_lite.rng',
  },
  version: 1,
};

const sampleTei = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-model href="https://example.org/other.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
<teiHeader>
  <fileDesc>
    <titleStmt><title>Han Xin</title></titleStmt>
    <publicationStmt><publisher>Source Press</publisher></publicationStmt>
    <sourceDesc><p>Old source</p></sourceDesc>
  </fileDesc>
</teiHeader>
<text>
  <body>
    <p><persName key="person-000014">張衡</persName> met <placeName key="place-000002">洛陽</placeName>.</p>
  </body>
</text>
</TEI>`;

describe('documentImport', () => {
  test('normalizes paragraphs from blank-line separated text', () => {
    expect(normalizeImportedParagraphs('First line\ncontinues\n\nSecond paragraph')).toEqual([
      'First line continues',
      'Second paragraph',
    ]);
  });

  test('strips common Markdown syntax to plain text', () => {
    expect(stripMarkdownToPlainText('# Heading\n\n- **Item** with [link](https://example.com)')).toBe(
      'Heading\n\nItem with link',
    );
  });

  test('strips simple RTF controls to plain text', () => {
    expect(stripRtfToPlainText('{\\rtf1\\ansi First\\par Second}')).toContain('First\n\nSecond');
  });

  test('builds TEI XML with escaped paragraphs and imported title', () => {
    const xml = buildImportedDocumentXml({
      config,
      format: 'txt',
      sourcePath: '/tmp/A & B.txt',
      text: 'One & two\n\n<Three>',
    });

    expect(xml).toContain('<titleStmt><title>A &amp; B</title></titleStmt>');
    expect(xml).toContain('<p>One &amp; two</p>');
    expect(xml).toContain('<p>&lt;Three&gt;</p>');
  });

  test('removes XML-forbidden control characters from imported text', () => {
    const xml = buildImportedDocumentXml({
      config,
      format: 'txt',
      sourcePath: '/tmp/control.txt',
      text: 'One\fTwo',
    });

    expect(xml).toContain('<p>OneTwo</p>');
    expect(inspectImportedXml(xml)).toEqual({ ok: true });
  });

  test('converts a sequential page number into a <pb/> milestone between paragraphs', () => {
    const xml = buildImportedDocumentXml({
      config,
      format: 'txt',
      sourcePath: '/tmp/paginated.txt',
      text: 'First paragraph ends here.\n\n12\n\nSecond paragraph starts here.',
    });

    expect(xml).toContain('<p>First paragraph ends here.</p>');
    expect(xml).toContain('<pb n="12"/>');
    expect(xml).toContain('<p>Second paragraph starts here.</p>');
  });

  test('heals a paragraph split across a page boundary with no preceding punctuation', () => {
    const xml = buildImportedDocumentXml({
      config,
      format: 'txt',
      sourcePath: '/tmp/paginated-heal.txt',
      text: 'This sentence continues\n12\nacross the page break.',
    });

    expect(xml).toContain('<p>This sentence continues <pb n="12"/> across the page break.</p>');
  });

  test('reports parser diagnostics for malformed generated XML', () => {
    const inspection = inspectImportedXml('<root><broken></root>');

    expect(inspection.ok).toBe(false);
    expect(inspection.error?.message).toBeTruthy();
    expect(inspection.error?.snippet).toContain('<root><broken></root>');
  });

  test('auto-suffixes duplicate and existing output paths', () => {
    const plan = buildDocumentImportPlan({
      destinationRoot: '/project',
      existingOutputPaths: ['/project/a.xml'],
      sources: [
        { format: 'txt', relativePath: 'a.txt', sourcePath: '/import/a.txt' },
        { format: 'md', relativePath: 'a.md', sourcePath: '/import/a.md' },
      ],
    });

    expect(plan.map((item) => item.outputPath)).toEqual(['/project/a-2.xml', '/project/a-3.xml']);
  });

  test('detects TEI and Orlando document families', () => {
    expect(detectXmlDocumentFamily(sampleTei)).toBe('tei');
    expect(detectXmlDocumentFamily('<ORLANDO><ORLANDOHEADER/></ORLANDO>')).toBe('orlando');
    expect(detectXmlDocumentFamily('<bio><person/></bio>')).toBe('unknown');
    expect(catalogXmlFamily('teiLite')).toBe('tei');
    expect(catalogXmlFamily('orlando')).toBe('orlando');
  });

  test('demotes @key onto @ana with a former-key token', () => {
    const result = demoteEntityKeys(
      '<p><persName key="person-000014">張衡</persName> and <placeName key="place-1" ana="geo">洛陽</placeName></p>',
    );

    expect(result.count).toBe(2);
    expect(result.xml).not.toMatch(/\skey=/);
    expect(result.xml).toContain(`ana="${FORMER_KEY_ANA_PREFIX}person-000014"`);
    expect(result.xml).toContain(`ana="geo ${FORMER_KEY_ANA_PREFIX}place-1"`);
  });

  test('rewrites schema processing instructions to the project schema', () => {
    const updated = applyProjectSchemaProcessingInstructions(sampleTei, config);
    expect(updated).toContain('href="schema/tei_lite.rng"');
    expect(updated).toContain('href="schema/tei.css"');
    expect(updated).not.toContain('https://example.org/other.rng');
  });

  test('imports TEI XML with demoted keys, project schema, and provenance', () => {
    const result = buildImportedXmlDocument({
      config,
      sourcePath: '/incoming/HanXin.xml',
      xml: sampleTei,
    });

    expect(result.keysDemoted).toBe(2);
    expect(result.xml).not.toMatch(/\skey=/);
    expect(result.xml).toContain(`${FORMER_KEY_ANA_PREFIX}person-000014`);
    expect(result.xml).toContain('href="schema/tei_lite.rng"');
    expect(result.xml).toContain('<title>Han Xin</title>');
    expect(result.xml).toContain('Imported into this project from HanXin');
    expect(inspectImportedXml(result.xml)).toEqual({ ok: true });
  });

  test('rejects entities.xml and cross-family XML imports', () => {
    expect(isEntityDatabaseFilename('/project/entities.xml')).toBe(true);
    expect(() =>
      buildImportedXmlDocument({
        config,
        sourcePath: '/project/entities.xml',
        xml: sampleTei,
      }),
    ).toThrow(/entity database/i);

    expect(() =>
      buildImportedXmlDocument({
        config,
        sourcePath: '/incoming/orlando.xml',
        xml: '<ORLANDO><ORLANDOHEADER/></ORLANDO>',
      }),
    ).toThrow(/Cross-family/i);
  });
});
