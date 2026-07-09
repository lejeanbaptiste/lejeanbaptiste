import {
  applyHeaderPathUpdates,
  inspectHeaderLooseText,
  mergeEditorBodyWithStoredHeader,
  mergeStoredHeaderForValidation,
  readHeaderPathValues,
  normalizeTeiHeaderLanguageElements,
  stripTeiHeaderForVisualEditor,
} from './teiHeaderXml';

const skeleton = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
<teiHeader>
  <fileDesc>
    <titleStmt><title>Untitled</title></titleStmt>
    <publicationStmt><authority/></publicationStmt>
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
    const editorOnly = stripTeiHeaderForVisualEditor(skeleton).replace('Body text', 'Edited body');
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

  test('keeps malformed source xml so validation reports the source parse error', () => {
    const malformed = skeleton.replace('<p>Body text</p>', '<p>Body text');
    expect(mergeStoredHeaderForValidation(malformed, skeleton)).toBe(malformed);
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

describe('language metadata path', () => {
  test('stores language as ident attribute without text content', () => {
    const updated = applyHeaderPathUpdates(skeleton, [
      { path: 'profileDesc/langUsage/language', value: 'English' },
    ]);
    expect(updated).toContain('ident="eng"');
    expect(updated).not.toMatch(/<language[^>]*>English<\/language>/);

    const values = readHeaderPathValues(updated, ['profileDesc/langUsage/language']);
    expect(values['profileDesc/langUsage/language']).toBe('eng');
  });

  test('migrates legacy language text content to ident attribute', () => {
    const legacy = skeleton.replace(
      '</fileDesc>',
      '</fileDesc><profileDesc><langUsage><language>English</language></langUsage></profileDesc>',
    );
    const fixed = normalizeTeiHeaderLanguageElements(legacy);
    expect(fixed).toContain('ident="eng"');
    expect(fixed).not.toMatch(/<language[^>]*>English<\/language>/);
  });
});

describe('inspectHeaderLooseText', () => {
  test('detects loose text in publicationStmt', () => {
    const bad = skeleton.replace(
      '<publicationStmt><authority/></publicationStmt>',
      '<publicationStmt>oops</publicationStmt>',
    );
    expect(inspectHeaderLooseText(bad)).toMatchObject({
      hasHeader: true,
      publicationStmt: true,
      sourceDesc: false,
    });
  });
});

describe('sourceDesc paragraph normalization', () => {
  test('migrates loose text in sourceDesc into a paragraph', () => {
    const legacy = skeleton.replace(
      '<sourceDesc><p/></sourceDesc>',
      '<sourceDesc>Born digital</sourceDesc>',
    );
    const fixed = normalizeTeiHeaderLanguageElements(legacy);
    expect(fixed).toContain('<sourceDesc><p>Born digital</p></sourceDesc>');
    expect(inspectHeaderLooseText(fixed).sourceDesc).toBe(false);
  });

  test('keeps an empty paragraph when sourceDesc/p is cleared', () => {
    const updated = applyHeaderPathUpdates(skeleton, [
      { path: 'titleStmt/title', value: 'Chapter One' },
      { path: 'sourceDesc/p', value: '' },
    ]);
    expect(updated).toContain('<title>Chapter One</title>');
    expect(updated).toMatch(/<sourceDesc>\s*<p\s*\/?>\s*<\/sourceDesc>/);
    expect(inspectHeaderLooseText(updated).sourceDesc).toBe(false);
  });
});

describe('publicationStmt normalization', () => {
  test('removes placeholder paragraph and orders structured publication metadata', () => {
    const updated = applyHeaderPathUpdates(skeleton, [
      { path: 'publicationStmt/availability/licence', value: 'CC BY' },
      { path: 'publicationStmt/distributor', value: 'CNRS' },
    ]);

    expect(updated).toContain(
      '<publicationStmt><distributor>CNRS</distributor><authority/><availability><licence>CC BY</licence></availability></publicationStmt>',
    );
    expect(updated).not.toContain('<publicationStmt><p/>');
  });

  test('adds agency placeholder when only licence metadata is provided', () => {
    const updated = applyHeaderPathUpdates(skeleton, [
      { path: 'publicationStmt/availability/licence', value: 'CC BY' },
    ]);

    expect(updated).toContain('<authority/>');
    expect(updated).toContain('<availability><licence>CC BY</licence></availability>');
    expect(updated).not.toContain('<publicationStmt><p');
  });
});
