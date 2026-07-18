import JSZip from 'jszip';
import {
  buildDocxDocument,
  buildMarkdownDocument,
  buildOdtDocument,
  buildPlainTextDocument,
  buildRtfDocument,
  type ExportBiblEntry,
  type RenderedBiblEntry,
} from './documentExport';

const parseUnit = (xml: string): Element => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error(`Test fixture XML did not parse: ${xml}`);
  }
  return doc.documentElement;
};

const bibliography: RenderedBiblEntry[] = [
  {
    id: 'zbib-ABCD1234',
    tei: '<hi rend="bold">Pregadio</hi>, F. (2006). <hi rend="italic">Great Clarity</hi>.',
  },
];

describe('buildRtfDocument', () => {
  test('appends a References section before the closing brace', () => {
    const source = parseUnit('<p>Hello world.</p>');
    const rtf = buildRtfDocument([{ source, translation: null }], new Map(), bibliography);

    expect(rtf.startsWith('{\\rtf1\\ansi')).toBe(true);
    expect(rtf.endsWith('}')).toBe(true);
    expect(rtf).toContain('Hello world.');
    expect(rtf).toContain('References');
    expect(rtf).toContain('{\\b Pregadio}');
    expect(rtf).toContain('{\\i Great Clarity}');
  });

  test('sets \\fet2 so footnotes collect at the end of the document, not the page', () => {
    const source = parseUnit('<p>Claim.<note place="foot">See discussion.</note></p>');
    const rtf = buildRtfDocument([{ source, translation: null }]);
    expect(rtf).toContain('\\fet2');
    // The in-text anchor (\chftn) stays exactly where the note is cited.
    expect(rtf).toContain('{\\super\\chftn}{\\footnote\\pard\\plain {\\super\\chftn} See discussion.}');
  });

  test('omits the References section when there is no bibliography', () => {
    const source = parseUnit('<p>Hello world.</p>');
    const rtf = buildRtfDocument([{ source, translation: null }]);
    expect(rtf).not.toContain('References');
  });
});

describe('buildMarkdownDocument', () => {
  test('renders bold/italic/strikethrough and interleaves translation blocks', () => {
    const source = parseUnit('<p xml:id="u1">plain <hi rend="bold italic">fancy</hi> end</p>');
    const translation = parseUnit('<p corresp="a.xml#u1">Translated <s>old</s> new.</p>');

    const md = buildMarkdownDocument([{ source, translation }]);
    expect(md).toContain('_**fancy**_');
    expect(md).toContain('~~old~~');
    expect(md.indexOf('fancy')).toBeLessThan(md.indexOf('Translated'));
  });

  test('renders head blocks as level-3 headings', () => {
    const source = parseUnit('<div><head>Title</head><p>Body.</p></div>');
    const md = buildMarkdownDocument([{ source, translation: null }]);
    expect(md).toContain('### Title');
  });

  test('emits GFM reference-style footnotes', () => {
    const source = parseUnit('<p>Claim.<note place="foot">See discussion.</note></p>');
    const md = buildMarkdownDocument([{ source, translation: null }]);
    expect(md).toContain('Claim.[^1]');
    expect(md).toContain('[^1]: See discussion.');
  });

  test('renders Zotero citations as their already-baked text and appends References', () => {
    const source = parseUnit(
      '<p>Cf. <bibl type="zotero-ref" corresp="#zbib-ABCD1234">Pregadio 2006</bibl>.</p>',
    );
    const entries = new Map<string, ExportBiblEntry>([
      [
        'zbib-ABCD1234',
        { id: 'zbib-ABCD1234', uri: 'http://zotero.org/x', csl: { id: 'x', type: 'book' } },
      ],
    ]);
    const md = buildMarkdownDocument([{ source, translation: null }], entries, bibliography);
    expect(md).toContain('Pregadio 2006');
    expect(md).toContain('## References');
    expect(md).toContain('**Pregadio**, F. (2006). _Great Clarity_.');
  });

  test('escapes markdown-significant characters in plain text', () => {
    const source = parseUnit('<p>1 * 2 = [two] `units`</p>');
    const md = buildMarkdownDocument([{ source, translation: null }]);
    expect(md).toBe('1 \\* 2 = \\[two\\] \\`units\\`');
  });
});

describe('buildPlainTextDocument', () => {
  test('leaves a [n] anchor in place and collects the note body into a trailing Notes section', () => {
    const source = parseUnit('<p>Claim.<note place="foot">See discussion.</note></p>');
    const text = buildPlainTextDocument([{ source, translation: null }], new Map(), bibliography);
    expect(text).toBe(
      'Claim.[1]\n\nNotes\n\n[1] See discussion.\n\nReferences\n\nPregadio, F. (2006). Great Clarity.',
    );
  });

  test('omits the Notes section when there are no footnotes', () => {
    const source = parseUnit('<p>Plain paragraph.</p>');
    const text = buildPlainTextDocument([{ source, translation: null }]);
    expect(text).toBe('Plain paragraph.');
  });
});

describe('buildDocxDocument', () => {
  // jsdom's Blob has no arrayBuffer()/stream(); FileReader is the one conversion path it
  // does implement.
  const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });

  const readZipEntry = async (blob: Blob, path: string): Promise<string> => {
    const zip = await JSZip.loadAsync(await blobToArrayBuffer(blob));
    const file = zip.file(path);
    if (!file) throw new Error(`docx zip is missing ${path}`);
    return file.async('string');
  };

  test('produces a valid docx zip with body text and a References section', async () => {
    const source = parseUnit('<p>plain <hi rend="bold">fancy</hi> end</p>');
    const blob = await buildDocxDocument([{ source, translation: null }], new Map(), bibliography);

    const documentXml = await readZipEntry(blob, 'word/document.xml');
    expect(documentXml).toContain('plain ');
    expect(documentXml).toContain('fancy');
    expect(documentXml).toContain('<w:b/>');
    expect(documentXml).toContain('References');
    expect(documentXml).toContain('Pregadio');
  });

  test('reconstitutes Zotero citations as live w:fldSimple fields', async () => {
    const translation = parseUnit(
      '<p>Text.<note place="foot">Cf. ' +
        '<bibl type="zotero-ref" corresp="#zbib-ABCD1234" data-locator="12">Pregadio 2006, 12</bibl>' +
        '.</note></p>',
    );
    const entries = new Map<string, ExportBiblEntry>([
      [
        'zbib-ABCD1234',
        {
          id: 'zbib-ABCD1234',
          uri: 'http://zotero.org/users/1/items/ABCD1234',
          csl: { id: 'item-1', type: 'book', title: 'Great Clarity' },
        },
      ],
    ]);

    const blob = await buildDocxDocument([{ source: null, translation }], entries);
    const documentXml = await readZipEntry(blob, 'word/document.xml');
    const footnotesXml = await readZipEntry(blob, 'word/footnotes.xml');

    // The note anchor lives in the body; the citation itself is inside the note, so it
    // lands in the real Word footnote, not the body.
    expect(documentXml).toContain('w:footnoteReference');
    expect(documentXml).not.toContain('<w:r><w:r>'); // no redundant run nesting
    // Footnote location is patched to "end of document" rather than the page-bottom default.
    expect(documentXml).toContain('<w:footnotePr><w:pos w:val="docEnd"/></w:footnotePr>');
    expect(footnotesXml).toContain('w:fldSimple');
    expect(footnotesXml).toContain('ADDIN ZOTERO_ITEM CSL_CITATION');
    expect(footnotesXml).toContain('Great Clarity');
    expect(footnotesXml).toContain('Pregadio 2006, 12');
  });

  test('renders a direct (not footnoted) citation as a live field in the body', async () => {
    const translation = parseUnit(
      '<p>a<bibl type="zotero-ref" corresp="#zbib-ABCD1234">Morgan 2025</bibl>.</p>',
    );
    const entries = new Map<string, ExportBiblEntry>([
      [
        'zbib-ABCD1234',
        {
          id: 'zbib-ABCD1234',
          uri: 'http://zotero.org/users/1/items/ABCD1234',
          csl: { id: 'item-1', type: 'article-journal', title: 'Modern Maths for Ancient Odes' },
        },
      ],
    ]);

    const blob = await buildDocxDocument([{ source: null, translation }], entries);
    const documentXml = await readZipEntry(blob, 'word/document.xml');

    expect(documentXml).toContain('w:fldSimple');
    expect(documentXml).toContain('ADDIN ZOTERO_ITEM CSL_CITATION');
    expect(documentXml).toContain('Modern Maths for Ancient Odes');
    expect(documentXml).toContain('Morgan 2025');
  });
});

describe('buildOdtDocument', () => {
  const readZipEntry = async (blob: Blob, path: string): Promise<string> => {
    const reader = new FileReader();
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
    const zip = await JSZip.loadAsync(arrayBuffer);
    const file = zip.file(path);
    if (!file) throw new Error(`odt zip is missing ${path}`);
    return file.async('string');
  };

  test('produces a valid ODF package with body text, nested styles, and a References section', async () => {
    const source = parseUnit('<p>plain <hi rend="bold italic">fancy</hi> end</p>');
    const blob = await buildOdtDocument([{ source, translation: null }], new Map(), bibliography);

    const mimetype = await readZipEntry(blob, 'mimetype');
    expect(mimetype).toBe('application/vnd.oasis.opendocument.text');

    const manifest = await readZipEntry(blob, 'META-INF/manifest.xml');
    expect(manifest).toContain('application/vnd.oasis.opendocument.text');

    const contentXml = await readZipEntry(blob, 'content.xml');
    expect(contentXml).toContain('plain ');
    expect(contentXml).toContain('<text:span text:style-name="Ti"><text:span text:style-name="Tb">fancy</text:span></text:span>');
    expect(contentXml).toContain('References');
    expect(contentXml).toContain('Pregadio');

    const stylesXml = await readZipEntry(blob, 'styles.xml');
    expect(stylesXml).toContain('text:footnotes-position="document"');
  });

  test('reconstitutes Zotero citations as text:reference-mark ranges matching the Zotero LibreOffice naming scheme', async () => {
    const translation = parseUnit(
      '<p>Text.<note place="foot">Cf. ' +
        '<bibl type="zotero-ref" corresp="#zbib-ABCD1234" data-locator="12">Pregadio 2006, 12</bibl>' +
        '.</note></p>',
    );
    const entries = new Map<string, ExportBiblEntry>([
      [
        'zbib-ABCD1234',
        {
          id: 'zbib-ABCD1234',
          uri: 'http://zotero.org/users/1/items/ABCD1234',
          csl: { id: 'item-1', type: 'book', title: 'Great Clarity' },
        },
      ],
    ]);

    const blob = await buildOdtDocument([{ source: null, translation }], entries);
    const contentXml = await readZipEntry(blob, 'content.xml');

    expect(contentXml).toContain('<text:note text:id="ftn1" text:note-class="footnote">');
    expect(contentXml).toContain('<text:reference-mark-start text:name="ZOTERO_ITEM CSL_CITATION ');
    expect(contentXml).toContain('<text:reference-mark-end text:name="ZOTERO_ITEM CSL_CITATION ');
    expect(contentXml).toContain('Great Clarity');
    expect(contentXml).toContain('Pregadio 2006, 12');
    expect(contentXml).toMatch(/ RND[0-9A-Za-z]{10}"\/>/);
  });
});
