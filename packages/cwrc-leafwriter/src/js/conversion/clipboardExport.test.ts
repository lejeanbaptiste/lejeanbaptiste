import {
  buildClipboardExport,
  escapeRtfText,
  type ExportBiblEntry,
} from './clipboardExport';

const parseUnit = (xml: string): Element => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error(`Test fixture XML did not parse: ${xml}`);
  }
  return doc.documentElement;
};

describe('escapeRtfText', () => {
  test('passes ASCII through and escapes RTF specials', () => {
    expect(escapeRtfText('plain {a\\b}')).toBe('plain \\{a\\\\b\\}');
  });

  test('escapes non-ASCII as signed 16-bit \\u codes', () => {
    expect(escapeRtfText('é')).toBe('\\u233 ');
    // 道 = U+9053 = 36947 → above 0x7FFF, so wraps to signed -28589
    expect(escapeRtfText('道')).toBe('\\u-28589 ');
    // 神 = U+795E = 31070 → fits in signed 16-bit, stays positive
    expect(escapeRtfText('神')).toBe('\\u31070 ');
  });

  test('emits surrogate pairs for astral characters', () => {
    // U+20BB7 (𠮷) → surrogates D842 DFB7 → signed -10174 -8265
    expect(escapeRtfText('𠮷')).toBe('\\u-10174 \\u-8265 ');
  });
});

describe('buildClipboardExport', () => {
  test('interleaves source and translation paragraphs with blank lines', () => {
    const source = parseUnit('<p xml:id="u1">道可道，非常道。</p>');
    const translation = parseUnit('<p corresp="a.xml#u1">The Way that can be spoken…</p>');

    const { text, html, rtf } = buildClipboardExport([{ source, translation }]);

    expect(text).toBe('道可道，非常道。\n\nThe Way that can be spoken…');
    expect(html).toBe('<p>道可道，非常道。</p>\n<p>The Way that can be spoken…</p>');
    expect(rtf).toContain('\\pard\\plain \\u-28589 ');
    expect(rtf.indexOf('\\u-28589')).toBeLessThan(rtf.indexOf('The Way'));
    expect(rtf.startsWith('{\\rtf1\\ansi')).toBe(true);
    expect(rtf.endsWith('}')).toBe(true);
  });

  test('expands div units into their block children', () => {
    const source = parseUnit(
      '<div xml:id="d1"><head>Title</head><p>First.</p><p>Second.</p></div>',
    );
    const { text } = buildClipboardExport([{ source, translation: null }]);
    expect(text).toBe('Title\n\nFirst.\n\nSecond.');
  });

  test('renders hi/rend formatting in html and rtf', () => {
    const source = parseUnit('<p>plain <hi rend="bold italic">fancy</hi> end</p>');
    const { html, rtf, text } = buildClipboardExport([{ source, translation: null }]);
    expect(text).toBe('plain fancy end');
    expect(html).toContain('<i><b>fancy</b></i>');
    expect(rtf).toContain('{\\b\\i fancy}');
  });

  test('emits native RTF footnotes and drops them from plain text', () => {
    const translation = parseUnit('<p>Claim.<note place="foot">See discussion.</note> More.</p>');
    const { text, rtf, html } = buildClipboardExport([{ source: null, translation }]);

    expect(text).toBe('Claim. More.');
    expect(rtf).toContain('{\\super\\chftn}{\\footnote\\pard\\plain {\\super\\chftn} See discussion.}');
    expect(html).toContain('[See discussion.]');
  });

  test('reconstitutes Zotero citations as live Word fields', () => {
    const translation = parseUnit(
      '<p>Text.<note place="foot">Cf. ' +
        '<bibl type="zotero-ref" corresp="#zbib-ABCD1234" data-locator="12" data-locator-type="page">Pregadio 2006, 12</bibl>' +
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

    const { rtf } = buildClipboardExport([{ source: null, translation }], entries);

    expect(rtf).toContain('\\field');
    expect(rtf).toContain('ADDIN ZOTERO_ITEM CSL_CITATION');
    expect(rtf).toContain('Great Clarity');
    expect(rtf).toContain('\\fldrslt Pregadio 2006, 12');
    // locator carried into the citation item
    expect(rtf).toContain('locator');
  });

  test('unknown zotero refs degrade to plain rendered text', () => {
    const translation = parseUnit(
      '<p><note><bibl type="zotero-ref" corresp="#zbib-GONE">Lost 1900</bibl></note>x</p>',
    );
    const { rtf } = buildClipboardExport([{ source: null, translation }]);
    expect(rtf).not.toContain('\\field');
    expect(rtf).toContain('Lost 1900');
  });

  test('handles editor-style elements carrying _tag attributes', () => {
    const doc = new DOMParser().parseFromString(
      '<div _tag="p">editor <span _tag="hi" rend="bold">bold</span></div>',
      'text/html',
    );
    const unit = doc.body.firstElementChild!;
    const { text, rtf } = buildClipboardExport([{ source: unit, translation: null }]);
    expect(text).toBe('editor bold');
    expect(rtf).toContain('{\\b bold}');
  });
});
