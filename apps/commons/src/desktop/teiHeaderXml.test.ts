import {
  inspectHeaderLooseText,
  mergeEditorBodyWithStoredHeader,
  mergeStoredHeaderForValidation,
  stripTeiHeaderForVisualEditor,
} from './teiHeaderXml';

const skeleton = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
<teiHeader>
  <fileDesc>
    <titleStmt><title>Untitled</title></titleStmt>
    <publicationStmt><p/></publicationStmt>
    <sourceDesc><p/></sourceDesc>
  </fileDesc>
</teiHeader>
<text>
  <body>
    <p>Body text</p>
  </body>
</text>
</TEI>`;

describe('stripTeiHeaderForVisualEditor', () => {
  test('removes teiHeader but keeps text body', () => {
    const stripped = stripTeiHeaderForVisualEditor(skeleton);
    expect(stripped).not.toContain('<teiHeader');
    expect(stripped).toContain('<text');
    expect(stripped).toContain('Body text');
  });
});

describe('mergeEditorBodyWithStoredHeader', () => {
  test('replaces text from editor while preserving stored header', () => {
    const editorOnly = stripTeiHeaderForVisualEditor(skeleton).replace(
      'Body text',
      'Edited body',
    );
    const merged = mergeEditorBodyWithStoredHeader(editorOnly, skeleton);
    expect(merged).toContain('<teiHeader');
    expect(merged).toContain('<title>Untitled</title>');
    expect(merged).toContain('Edited body');
    expect(merged).not.toContain('Body text');
  });
});

describe('mergeStoredHeaderForValidation', () => {
  test('reattaches header from stored file for validation', () => {
    const editorOnly = stripTeiHeaderForVisualEditor(skeleton);
    const merged = mergeStoredHeaderForValidation(editorOnly, skeleton);
    expect(merged).toContain('<teiHeader');
    expect(merged).toContain('Body text');
  });

  test('returns editor xml when stored has no header', () => {
    const editorOnly = stripTeiHeaderForVisualEditor(skeleton);
    expect(mergeStoredHeaderForValidation(editorOnly, editorOnly)).toBe(editorOnly);
  });

  test('strips encodingDesc from merged validation xml', () => {
    const withEncoding = skeleton.replace(
      '</fileDesc>',
      '</fileDesc><encodingDesc><appInfo><application ident="le-jean-baptiste"><label>App</label></application></appInfo></encodingDesc>',
    );
    const editorOnly = stripTeiHeaderForVisualEditor(withEncoding);
    const merged = mergeStoredHeaderForValidation(editorOnly, withEncoding);
    expect(merged).toContain('<teiHeader');
    expect(merged).not.toContain('<encodingDesc');
    expect(merged).toContain('Body text');
  });
});

describe('inspectHeaderLooseText', () => {
  test('detects loose text in publicationStmt', () => {
    const bad = skeleton.replace(
      '<publicationStmt><p/></publicationStmt>',
      '<publicationStmt>oops</publicationStmt>',
    );
    expect(inspectHeaderLooseText(bad)).toMatchObject({
      hasHeader: true,
      publicationStmt: true,
      sourceDesc: false,
    });
  });
});
