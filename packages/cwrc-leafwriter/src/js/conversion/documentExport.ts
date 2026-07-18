/**
 * Whole-document export to RTF, Markdown, and raw text. Builds on the same block-walking
 * primitives as clipboardExport.ts (the "Copy for export" clipboard feature) so all three
 * formats agree on paragraph splitting, inline styling, footnotes, and — most importantly —
 * live Zotero citation reconstitution. RTF gets a live `ADDIN ZOTERO_ITEM CSL_CITATION` Word
 * field per citation (via buildClipboardExport); Markdown and text have no field concept, so
 * citations render as their already-formatted text with a References section appended.
 */

import {
  Document,
  FootnoteReferenceRun,
  HeadingLevel,
  Packer,
  Paragraph,
  SimpleField,
  TextRun,
} from 'docx';
import JSZip from 'jszip';
import {
  RTF_STYLE_CONTROL,
  blockElementsOf,
  buildClipboardExport,
  buildZoteroCitationJson,
  buildZoteroFieldInstruction,
  escapeRtfText,
  normalizeWhitespace,
  rendStylesOf,
  teiTagOf,
  zoteroBiblEntryFor,
  type ExportBiblEntry,
  type ExportUnitPair,
  type RendStyle,
  type WalkContext,
} from './clipboardExport';

/** A CSL-rendered bibliography entry, ready to drop into any of the three formats. */
export interface RenderedBiblEntry {
  id: string;
  /** Inline TEI markup fragment (<hi rend="italic|bold|...">, <sup>, <sub>, plain text) —
   * the same vocabulary citeprocHtmlToTei/renderBibliography (citeproc.ts) emit, so it can
   * be walked with the same rendStylesOf/teiTagOf machinery as document content. */
  tei: string;
}

/** Parses an inline TEI markup fragment into a walkable root element. */
const parseInlineTei = (tei: string): Element =>
  new DOMParser().parseFromString(`<r>${tei}</r>`, 'application/xml').documentElement;

/* --------------------------------------------------------------------- rtf: references */

const referencesRtf = (bibliography: RenderedBiblEntry[]): string => {
  if (bibliography.length === 0) return '';
  const entries = bibliography
    .map((entry) => `\\pard\\plain ${inlineTeiToRtf(parseInlineTei(entry.tei))}\\par`)
    .join('\n');
  return `\\par\\pard\\plain\\b References\\par\n${entries}`;
};

const inlineTeiToRtf = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) return escapeRtfText(node.nodeValue ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const element = node as Element;
  const inner = Array.from(element.childNodes).map(inlineTeiToRtf).join('');
  const styles = rendStylesOf(element);
  if (styles.length === 0) return inner;
  return `{${styles.map((style) => RTF_STYLE_CONTROL[style]).join('')} ${inner}}`;
};

/** Builds a complete, standalone .rtf file for the given unit pairs, with an optional
 * References section rendered from the project's configured CSL style. */
export const buildRtfDocument = (
  pairs: ExportUnitPair[],
  biblEntries: Map<string, ExportBiblEntry> = new Map(),
  bibliography: RenderedBiblEntry[] = [],
): string => {
  const { rtf } = buildClipboardExport(pairs, biblEntries);
  // \fet2 = "footnotes at end of document": the \chftn anchor stays exactly where it's
  // cited, but Word collects the note bodies at the end of the document instead of the
  // bottom of each page — the clipboard "Copy for export" flavor keeps page-bottom
  // placement (\fet0, the RTF default) since it's pasted into an existing document.
  const withEndOfDocumentNotes = rtf.replace(
    '{\\fonttbl{\\f0 Times New Roman;}}',
    '{\\fonttbl{\\f0 Times New Roman;}}\\fet2',
  );
  const references = referencesRtf(bibliography);
  if (!references) return withEndOfDocumentNotes;
  // Splice the References section in before the closing brace of the RTF document.
  return `${withEndOfDocumentNotes.slice(0, -1)}${references}\n}`;
};

/* ---------------------------------------------------------------------- markdown */

const escapeMarkdownText = (value: string): string =>
  value.replace(/[\\*_`[\]~]/g, (char) => `\\${char}`);

const MD_STYLE_MARK: Record<string, string> = {
  bold: '**',
  italic: '_',
  underline: '', // CommonMark has no underline; leave text unmarked rather than misrepresent it.
  strikethrough: '~~',
  sup: '',
  sub: '',
};

interface MarkdownContext extends WalkContext {
  footnotes: string[];
}

const markdownInline = (node: Node, ctx: MarkdownContext): string => {
  if (node.nodeType === 3) return escapeMarkdownText(node.nodeValue ?? '');
  if (node.nodeType !== 1) return '';
  const element = node as Element;
  const tag = teiTagOf(element);

  if (tag === 'note') {
    const body = normalizeWhitespace(
      Array.from(element.childNodes)
        .map((child) => markdownInline(child, ctx))
        .join(''),
    );
    ctx.footnotes.push(body);
    return `[^${ctx.footnotes.length}]`;
  }

  const zotero = zoteroBiblEntryFor(element, ctx);
  if (zotero) return escapeMarkdownText(element.textContent ?? '');

  const inner = Array.from(element.childNodes)
    .map((child) => markdownInline(child, ctx))
    .join('');
  const styles = rendStylesOf(element);
  return styles.reduce((text, style) => {
    const mark = MD_STYLE_MARK[style];
    return mark ? `${mark}${text}${mark}` : text;
  }, inner);
};

const markdownBlock = (block: Element, ctx: MarkdownContext): string => {
  const text = markdownInline(block, ctx).trim();
  if (!text) return '';
  return teiTagOf(block) === 'head' ? `### ${text}` : text;
};

const inlineTeiToMarkdown = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) return escapeMarkdownText(node.nodeValue ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const element = node as Element;
  const inner = Array.from(element.childNodes).map(inlineTeiToMarkdown).join('');
  const styles = rendStylesOf(element);
  return styles.reduce((text, style) => {
    const mark = MD_STYLE_MARK[style];
    return mark ? `${mark}${text}${mark}` : text;
  }, inner);
};

const markdownReferences = (bibliography: RenderedBiblEntry[]): string => {
  if (bibliography.length === 0) return '';
  const entries = bibliography
    .map((entry) => inlineTeiToMarkdown(parseInlineTei(entry.tei)))
    .join('\n\n');
  return `\n\n## References\n\n${entries}`;
};

/** Builds a CommonMark/GFM document: **bold**, _italic_, ~~strikethrough~~, `head` blocks as
 * headings, footnotes as GFM reference-style `[^n]`, Zotero citations as their already-baked
 * rendered text, and a References section from the CSL-rendered bibliography. */
export const buildMarkdownDocument = (
  pairs: ExportUnitPair[],
  biblEntries: Map<string, ExportBiblEntry> = new Map(),
  bibliography: RenderedBiblEntry[] = [],
): string => {
  const ctx: MarkdownContext = { biblEntries, footnotes: [] };
  const blocks: string[] = [];

  for (const pair of pairs) {
    for (const unit of [pair.source, pair.translation]) {
      if (!unit) continue;
      for (const block of blockElementsOf(unit)) {
        const rendered = markdownBlock(block, ctx);
        if (rendered) blocks.push(rendered);
      }
    }
  }

  const body = blocks.join('\n\n');
  const footnoteDefs = ctx.footnotes
    .map((footnoteBody, index) => `[^${index + 1}]: ${footnoteBody}`)
    .join('\n');

  return [body, footnoteDefs, markdownReferences(bibliography).trim()]
    .filter(Boolean)
    .join('\n\n');
};

/* ---------------------------------------------------------------------- raw text */

const plainReferences = (bibliography: RenderedBiblEntry[]): string => {
  if (bibliography.length === 0) return '';
  const entries = bibliography
    .map((entry) => normalizeWhitespace(parseInlineTei(entry.tei).textContent ?? ''))
    .join('\n\n');
  return `\n\nReferences\n\n${entries}`;
};

interface TextContext extends WalkContext {
  footnotes: string[];
}

/** Running text with a bracketed `[n]` anchor left at each note's citation point; the note
 * body itself is collected into ctx.footnotes for the trailing Notes section — text has no
 * page/section concept, so, like Markdown, notes are gathered at the end of the document. */
const plainInlineWithNotes = (node: Node, ctx: TextContext): string => {
  if (node.nodeType === 3) return node.nodeValue ?? '';
  if (node.nodeType !== 1) return '';
  const element = node as Element;

  if (teiTagOf(element) === 'note') {
    const body = normalizeWhitespace(
      Array.from(element.childNodes)
        .map((child) => plainInlineWithNotes(child, ctx))
        .join(''),
    );
    ctx.footnotes.push(body);
    return `[${ctx.footnotes.length}]`;
  }

  return Array.from(element.childNodes)
    .map((child) => plainInlineWithNotes(child, ctx))
    .join('');
};

/** Builds a plain-text document: running text with `[n]` note anchors left in place, note
 * bodies collected into a trailing Notes section, and a References section appended. */
export const buildPlainTextDocument = (
  pairs: ExportUnitPair[],
  biblEntries: Map<string, ExportBiblEntry> = new Map(),
  bibliography: RenderedBiblEntry[] = [],
): string => {
  const ctx: TextContext = { biblEntries, footnotes: [] };
  const textBlocks: string[] = [];

  for (const pair of pairs) {
    for (const unit of [pair.source, pair.translation]) {
      if (!unit) continue;
      for (const block of blockElementsOf(unit)) {
        const text = normalizeWhitespace(plainInlineWithNotes(block, ctx));
        if (text) textBlocks.push(text);
      }
    }
  }

  const body = textBlocks.join('\n\n');
  const notes =
    ctx.footnotes.length > 0
      ? `\n\nNotes\n\n${ctx.footnotes.map((note, index) => `[${index + 1}] ${note}`).join('\n\n')}`
      : '';

  return `${body}${notes}${plainReferences(bibliography)}`;
};

/* ---------------------------------------------------------------------- docx */

const DOCX_STYLE_PROPS: Record<RendStyle, Record<string, unknown>> = {
  bold: { bold: true },
  italic: { italics: true },
  underline: { underline: {} },
  strikethrough: { strike: true },
  sup: { superScript: true },
  sub: { subScript: true },
};

const docxRunProps = (styles: RendStyle[]): Record<string, unknown> =>
  styles.reduce((props, style) => ({ ...props, ...DOCX_STYLE_PROPS[style] }), {});

interface DocxContext extends WalkContext {
  /** OOXML footnotes are collected separately from body content, keyed by id (ids -1 and 0
   * are reserved by the docx library for the separator/continuation-separator marks, so
   * user content starts at 1). Word footnotes default to page-bottom placement; the
   * document-level footnotePr patch in buildDocxDocument moves them to the end of the
   * document instead, matching the RTF \fet2 / Markdown / text convention. */
  footnotes: Record<string, { children: Paragraph[] }>;
  nextFootnoteId: number;
}

type DocxRun = TextRun | SimpleField | FootnoteReferenceRun;

const docxInline = (node: Node, ctx: DocxContext, activeStyles: RendStyle[]): DocxRun[] => {
  if (node.nodeType === 3) {
    const text = node.nodeValue ?? '';
    return text ? [new TextRun({ text, ...docxRunProps(activeStyles) })] : [];
  }
  if (node.nodeType !== 1) return [];
  const element = node as Element;
  const tag = teiTagOf(element);

  if (tag === 'note') {
    const id = ctx.nextFootnoteId++;
    const body = Array.from(element.childNodes).flatMap((child) => docxInline(child, ctx, []));
    ctx.footnotes[String(id)] = { children: [new Paragraph({ children: body })] };
    return [new FootnoteReferenceRun(id)];
  }

  const zotero = zoteroBiblEntryFor(element, ctx);
  if (zotero) {
    const rendered = element.textContent ?? '';
    const instruction = buildZoteroFieldInstruction(zotero, rendered, {
      locator: element.getAttribute('data-locator') ?? undefined,
      locatorType: element.getAttribute('data-locator-type') ?? undefined,
    });
    return [new SimpleField(instruction, rendered)];
  }

  const styles = [...activeStyles, ...rendStylesOf(element)];
  return Array.from(element.childNodes).flatMap((child) => docxInline(child, ctx, styles));
};

const docxBlock = (block: Element, ctx: DocxContext): Paragraph =>
  new Paragraph({
    children: docxInline(block, ctx, []),
    heading: teiTagOf(block) === 'head' ? HeadingLevel.HEADING_3 : undefined,
  });

const inlineTeiToDocxRuns = (node: Node, activeStyles: RendStyle[] = []): TextRun[] => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue ?? '';
    return text ? [new TextRun({ text, ...docxRunProps(activeStyles) })] : [];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const element = node as Element;
  const styles = [...activeStyles, ...rendStylesOf(element)];
  return Array.from(element.childNodes).flatMap((child) => inlineTeiToDocxRuns(child, styles));
};

/** The docx library has no option for footnote placement — CT_SectPr's `w:footnotePr`
 * with `w:pos w:val="docEnd"` is the OOXML equivalent of RTF's \fet2 (Word's own
 * References > Footnote > Location: "End of document" setting, as opposed to the default
 * "Bottom of page"), so it's patched in after packing. footnotePr must precede pgSz per
 * the CT_SectPr schema order. */
const withFootnotesAtDocumentEnd = async (blob: Blob): Promise<Blob> => {
  const zip = await JSZip.loadAsync(blob);
  const documentXmlFile = zip.file('word/document.xml');
  if (!documentXmlFile) return blob;

  const documentXml = await documentXmlFile.async('string');
  const patched = documentXml.replace(
    /<w:sectPr(\s[^>]*)?>/,
    (sectPrTag) => `${sectPrTag}<w:footnotePr><w:pos w:val="docEnd"/></w:footnotePr>`,
  );
  zip.file('word/document.xml', patched);
  return zip.generateAsync({ type: 'blob' });
};

/** Builds a .docx file (as a Blob) for the given unit pairs: live Zotero citation fields
 * (`w:fldSimple`/`ADDIN ZOTERO_ITEM CSL_CITATION`, same instruction payload RTF/DOCX share
 * via buildZoteroFieldInstruction), real Word footnotes positioned at the end of the
 * document for `<note>` content, and a References section from the CSL-rendered
 * bibliography. */
export const buildDocxDocument = async (
  pairs: ExportUnitPair[],
  biblEntries: Map<string, ExportBiblEntry> = new Map(),
  bibliography: RenderedBiblEntry[] = [],
): Promise<Blob> => {
  const ctx: DocxContext = { biblEntries, footnotes: {}, nextFootnoteId: 1 };
  const paragraphs: Paragraph[] = [];

  for (const pair of pairs) {
    for (const unit of [pair.source, pair.translation]) {
      if (!unit) continue;
      for (const block of blockElementsOf(unit)) {
        if (!normalizeWhitespace(block.textContent ?? '')) continue;
        paragraphs.push(docxBlock(block, ctx));
      }
    }
  }

  if (bibliography.length > 0) {
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: 'References', bold: true })] }));
    for (const entry of bibliography) {
      paragraphs.push(new Paragraph({ children: inlineTeiToDocxRuns(parseInlineTei(entry.tei)) }));
    }
  }

  const doc = new Document({
    sections: [{ children: paragraphs }],
    footnotes: ctx.footnotes,
  });

  return withFootnotesAtDocumentEnd(await Packer.toBlob(doc));
};

/* ---------------------------------------------------------------------- odt */

const escapeXmlText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeXmlAttr = (value: string): string => escapeXmlText(value).replace(/"/g, '&quot;');

const RAND_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Matches Zotero's own LibreOffice-integration reference-mark naming scheme (see
 * zotero-libreoffice-integration's Document.java/ReferenceMark.java): a random suffix
 * keeps every mark's `text:name` unique even when the same work is cited twice. */
const randomRefMarkSuffix = (length = 10): string =>
  Array.from({ length }, () => RAND_CHARS[Math.floor(Math.random() * RAND_CHARS.length)]).join('');

const ODT_STYLE_NAME: Record<RendStyle, string> = {
  bold: 'Tb',
  italic: 'Ti',
  underline: 'Tu',
  strikethrough: 'Ts',
  sup: 'Tsup',
  sub: 'Tsub',
};

interface OdtContext extends WalkContext {
  nextFootnoteId: number;
}

/** ODF text:span nests natively (unlike Word runs), so combined styles (bold+italic) are
 * expressed by nesting spans one level per style, mirroring the RTF/DOCX recursive walk. */
const odtInline = (node: Node, ctx: OdtContext): string => {
  if (node.nodeType === 3) return escapeXmlText(node.nodeValue ?? '');
  if (node.nodeType !== 1) return '';
  const element = node as Element;
  const tag = teiTagOf(element);

  if (tag === 'note') {
    const id = ctx.nextFootnoteId++;
    const body = Array.from(element.childNodes)
      .map((child) => odtInline(child, ctx))
      .join('');
    return (
      `<text:note text:id="ftn${id}" text:note-class="footnote">` +
      `<text:note-citation>${id}</text:note-citation>` +
      `<text:note-body><text:p>${body}</text:p></text:note-body>` +
      `</text:note>`
    );
  }

  const zotero = zoteroBiblEntryFor(element, ctx);
  if (zotero) {
    const rendered = element.textContent ?? '';
    const json = buildZoteroCitationJson(zotero, rendered, {
      locator: element.getAttribute('data-locator') ?? undefined,
      locatorType: element.getAttribute('data-locator-type') ?? undefined,
    });
    // Matches Zotero's own field-code vocabulary (see buildZoteroFieldInstruction) minus
    // the Word-specific "ADDIN " prefix — LibreOffice's PREFIXES recognize "ZOTERO_" alone.
    const name = escapeXmlAttr(`ZOTERO_ITEM CSL_CITATION ${json} RND${randomRefMarkSuffix()}`);
    return (
      `<text:reference-mark-start text:name="${name}"/>` +
      `${escapeXmlText(rendered)}` +
      `<text:reference-mark-end text:name="${name}"/>`
    );
  }

  const inner = Array.from(element.childNodes)
    .map((child) => odtInline(child, ctx))
    .join('');
  const styles = rendStylesOf(element);
  return styles.reduce(
    (xml, style) => `<text:span text:style-name="${ODT_STYLE_NAME[style]}">${xml}</text:span>`,
    inner,
  );
};

const odtBlock = (block: Element, ctx: OdtContext): string => {
  const inner = odtInline(block, ctx);
  return teiTagOf(block) === 'head'
    ? `<text:h text:outline-level="3">${inner}</text:h>`
    : `<text:p>${inner}</text:p>`;
};

const inlineTeiToOdt = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) return escapeXmlText(node.nodeValue ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const element = node as Element;
  const inner = Array.from(element.childNodes).map(inlineTeiToOdt).join('');
  const styles = rendStylesOf(element);
  return styles.reduce(
    (xml, style) => `<text:span text:style-name="${ODT_STYLE_NAME[style]}">${xml}</text:span>`,
    inner,
  );
};

const ODT_NAMESPACES =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" ' +
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"';

const ODT_TEXT_STYLE_DEFS: Record<RendStyle, string> = {
  bold: '<style:text-properties fo:font-weight="bold" style:font-weight-asian="bold" style:font-weight-complex="bold"/>',
  italic:
    '<style:text-properties fo:font-style="italic" style:font-style-asian="italic" style:font-style-complex="italic"/>',
  underline:
    '<style:text-properties style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"/>',
  strikethrough: '<style:text-properties style:text-line-through-style="solid"/>',
  sup: '<style:text-properties style:text-position="super 58%"/>',
  sub: '<style:text-properties style:text-position="sub 58%"/>',
};

const odtContentXml = (bodyXml: string): string => {
  const automaticStyles = (Object.keys(ODT_STYLE_NAME) as RendStyle[])
    .map(
      (style) =>
        `<style:style style:name="${ODT_STYLE_NAME[style]}" style:family="text">${ODT_TEXT_STYLE_DEFS[style]}</style:style>`,
    )
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<office:document-content ${ODT_NAMESPACES} office:version="1.3">` +
    `<office:automatic-styles>${automaticStyles}` +
    '<style:style style:name="Pref" style:family="paragraph"><style:text-properties fo:font-weight="bold"/></style:style>' +
    '</office:automatic-styles>' +
    `<office:body><office:text>${bodyXml}</office:text></office:body>` +
    '</office:document-content>'
  );
};

/** \`text:footnotes-position="document"\` requests footnotes collect at the end of the
 * document rather than the page bottom (the RTF \fet2 / Word footnotePr/docEnd
 * equivalent) — but unlike Word, LibreOffice's support for non-default footnote
 * placement has historically been incomplete, so this may not always be honored. */
const ODT_STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  `<office:document-styles ${ODT_NAMESPACES} office:version="1.3">` +
  '<office:styles>' +
  '<text:notes-configuration text:note-class="footnote" text:footnotes-position="document" ' +
  'style:num-format="1" text:start-value="0"/>' +
  '</office:styles>' +
  '</office:document-styles>';

const ODT_META_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" office:version="1.3">' +
  '<office:meta/>' +
  '</office:document-meta>';

const ODT_MANIFEST_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">' +
  '<manifest:file-entry manifest:full-path="/" manifest:version="1.3" ' +
  'manifest:media-type="application/vnd.oasis.opendocument.text"/>' +
  '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>' +
  '<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>' +
  '<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>' +
  '</manifest:manifest>';

const ODT_MIME_TYPE = 'application/vnd.oasis.opendocument.text';

/** Builds a .odt file (as a Blob) for the given unit pairs: live Zotero citations as ODF
 * reference marks in Zotero's own LibreOffice-integration naming scheme (recognized and
 * refreshable by the Zotero LibreOffice plugin), real ODF footnotes for `<note>` content,
 * and a References section from the CSL-rendered bibliography. */
export const buildOdtDocument = async (
  pairs: ExportUnitPair[],
  biblEntries: Map<string, ExportBiblEntry> = new Map(),
  bibliography: RenderedBiblEntry[] = [],
): Promise<Blob> => {
  const ctx: OdtContext = { biblEntries, nextFootnoteId: 1 };
  const blocks: string[] = [];

  for (const pair of pairs) {
    for (const unit of [pair.source, pair.translation]) {
      if (!unit) continue;
      for (const block of blockElementsOf(unit)) {
        if (!normalizeWhitespace(block.textContent ?? '')) continue;
        blocks.push(odtBlock(block, ctx));
      }
    }
  }

  if (bibliography.length > 0) {
    blocks.push('<text:p text:style-name="Pref">References</text:p>');
    for (const entry of bibliography) {
      blocks.push(`<text:p>${inlineTeiToOdt(parseInlineTei(entry.tei))}</text:p>`);
    }
  }

  const zip = new JSZip();
  zip.file('mimetype', ODT_MIME_TYPE, { compression: 'STORE' });
  zip.file('META-INF/manifest.xml', ODT_MANIFEST_XML);
  zip.file('content.xml', odtContentXml(blocks.join('')));
  zip.file('styles.xml', ODT_STYLES_XML);
  zip.file('meta.xml', ODT_META_XML);

  return zip.generateAsync({ type: 'blob', mimeType: ODT_MIME_TYPE });
};

export type { ExportBiblEntry, ExportUnitPair } from './clipboardExport';
export { collectAllUnitIds, findUnitByCorresp, findUnitById } from './copyForExport';
