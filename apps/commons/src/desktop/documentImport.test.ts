import {
  buildDocumentImportPlan,
  buildImportedDocumentXml,
  inspectImportedXml,
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
});
