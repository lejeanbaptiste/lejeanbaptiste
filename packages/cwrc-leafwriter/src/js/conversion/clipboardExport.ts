/**
 * Converts interleaved source/translation TEI unit pairs into the three clipboard
 * flavors written by "Copy for export": plain text, HTML, and RTF. The RTF flavor is
 * the one that matters for Word/LibreOffice — it carries native footnotes
 * ({\footnote}) and live Zotero citation fields (ADDIN ZOTERO_ITEM CSL_CITATION)
 * reconstituted from the CSL-JSON snapshots stored in the translation document's
 * <standOff><listBibl type="zotero">.
 */

export interface CslJsonItem {
  id: string | number;
  type: string;
  [key: string]: unknown;
}

export interface ExportBiblEntry {
  id: string;
  uri: string;
  csl: CslJsonItem;
}

export interface ExportUnitPair {
  source: Element | null;
  translation: Element | null;
}

export interface ClipboardExportFlavors {
  html: string;
  rtf: string;
  text: string;
}

/* ------------------------------------------------------------------ escaping */

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** RTF-escapes a string: control chars, braces, and \uN for anything non-ASCII. */
export const escapeRtfText = (value: string): string => {
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0)!;
    if (char === '\\' || char === '{' || char === '}') {
      out += `\\${char}`;
    } else if (char === '\n') {
      out += '\\line ';
    } else if (char === '\t') {
      out += '\\tab ';
    } else if (code < 0x80) {
      out += char;
    } else if (code <= 0xffff) {
      // RTF \u takes a signed 16-bit value.
      out += `\\u${code > 0x7fff ? code - 0x10000 : code} `;
    } else {
      // Beyond the BMP: emit the UTF-16 surrogate pair as two \u escapes.
      const high = Math.floor((code - 0x10000) / 0x400) + 0xd800;
      const low = ((code - 0x10000) % 0x400) + 0xdc00;
      out += `\\u${high - 0x10000} \\u${low - 0x10000} `;
    }
  }
  return out;
};

/* ------------------------------------------------------------ inline walking */

export type RendStyle = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'sup' | 'sub';

export const rendStylesOf = (element: Element): RendStyle[] => {
  const local = teiTagOf(element).toLowerCase();
  if (local === 'b' || local === 'strong') return ['bold'];
  if (local === 'i' || local === 'em') return ['italic'];
  if (local === 'u') return ['underline'];
  if (local === 's' || local === 'strike') return ['strikethrough'];
  if (local === 'sup') return ['sup'];
  if (local === 'sub') return ['sub'];
  if (local === 'hi') {
    const rend = (element.getAttribute('rend') ?? '').toLowerCase();
    return (['bold', 'italic', 'underline', 'strikethrough'] as RendStyle[]).filter((style) =>
      rend.includes(style),
    );
  }
  return [];
};

export const RTF_STYLE_CONTROL: Record<RendStyle, string> = {
  bold: '\\b',
  italic: '\\i',
  underline: '\\ul',
  strikethrough: '\\strike',
  sup: '\\super',
  sub: '\\sub',
};

const HTML_STYLE_TAG: Record<RendStyle, string> = {
  bold: 'b',
  italic: 'i',
  underline: 'u',
  strikethrough: 's',
  sup: 'sup',
  sub: 'sub',
};

export interface WalkContext {
  biblEntries: Map<string, ExportBiblEntry>;
}

const isElement = (node: Node): node is Element => node.nodeType === 1;

/** The TEI tag of an element, whether it's a real TEI element or an editor element
 * carrying its TEI tag in the `_tag` attribute. */
export const teiTagOf = (element: Element): string =>
  element.getAttribute('_tag') ?? element.localName;

export const zoteroBiblEntryFor = (
  element: Element,
  ctx: WalkContext,
): ExportBiblEntry | undefined => {
  if (teiTagOf(element) !== 'bibl' || element.getAttribute('type') !== 'zotero-ref') {
    return undefined;
  }
  const corresp = element.getAttribute('corresp') ?? '';
  return ctx.biblEntries.get(corresp.replace(/^#/, ''));
};

/** Builds the CSL-JSON citation payload shared by every live-field format (Word's
 * `ADDIN ZOTERO_ITEM CSL_CITATION {json}`, LibreOffice's `ZOTERO_ITEM CSL_CITATION {json}`
 * reference-mark name) — only the surrounding field-code syntax differs by host app. */
export const buildZoteroCitationJson = (
  entry: ExportBiblEntry,
  renderedText: string,
  options: { locator?: string; locatorType?: string } = {},
): string => {
  const citation = {
    citationID: `leaf-${entry.id}-${Math.random().toString(36).slice(2, 10)}`,
    properties: { formattedCitation: renderedText, plainCitation: renderedText, noteIndex: 0 },
    citationItems: [
      {
        id: entry.csl.id,
        uris: [entry.uri],
        itemData: entry.csl,
        ...(options.locator ? { locator: options.locator } : {}),
        ...(options.locatorType ? { label: options.locatorType } : {}),
      },
    ],
    schema: 'https://github.com/citation-style-language/schema/raw/master/csl-citation.json',
  };
  return JSON.stringify(citation);
};

/** Builds the Word field instruction for a live Zotero citation. */
export const buildZoteroFieldInstruction = (
  entry: ExportBiblEntry,
  renderedText: string,
  options: { locator?: string; locatorType?: string } = {},
): string => `ADDIN ZOTERO_ITEM CSL_CITATION ${buildZoteroCitationJson(entry, renderedText, options)}`;

/* ---------------------------------------------------------------- rtf flavor */

const rtfInline = (node: Node, ctx: WalkContext): string => {
  if (node.nodeType === 3) return escapeRtfText(node.nodeValue ?? '');
  if (!isElement(node)) return '';

  const tag = teiTagOf(node);

  if (tag === 'note') {
    const body = Array.from(node.childNodes)
      .map((child) => rtfInline(child, ctx))
      .join('');
    // \chftn = automatic footnote number, in both the anchor and the note body.
    return `{\\super\\chftn}{\\footnote\\pard\\plain {\\super\\chftn} ${body}}`;
  }

  const zotero = zoteroBiblEntryFor(node, ctx);
  if (zotero) {
    const rendered = node.textContent ?? '';
    const instruction = buildZoteroFieldInstruction(zotero, rendered, {
      locator: node.getAttribute('data-locator') ?? undefined,
      locatorType: node.getAttribute('data-locator-type') ?? undefined,
    });
    return `{\\field{\\*\\fldinst {${escapeRtfText(instruction)}}}{\\fldrslt ${escapeRtfText(rendered)}}}`;
  }

  const inner = Array.from(node.childNodes)
    .map((child) => rtfInline(child, ctx))
    .join('');
  const styles = rendStylesOf(node);
  if (styles.length === 0) return inner;
  return `{${styles.map((style) => RTF_STYLE_CONTROL[style]).join('')} ${inner}}`;
};

/* --------------------------------------------------------------- html flavor */

const htmlInline = (node: Node, ctx: WalkContext): string => {
  if (node.nodeType === 3) return escapeHtml(node.nodeValue ?? '');
  if (!isElement(node)) return '';

  const tag = teiTagOf(node);
  // HTML clipboard flavor has no native footnotes; render the note inline in brackets
  // so no content is silently lost for consumers that pick HTML over RTF.
  if (tag === 'note') {
    const body = Array.from(node.childNodes)
      .map((child) => htmlInline(child, ctx))
      .join('');
    return ` <span data-tei="note">[${body}]</span>`;
  }

  const inner = Array.from(node.childNodes)
    .map((child) => htmlInline(child, ctx))
    .join('');
  const styles = rendStylesOf(node);
  return styles.reduce(
    (html, style) => `<${HTML_STYLE_TAG[style]}>${html}</${HTML_STYLE_TAG[style]}>`,
    inner,
  );
};

/* --------------------------------------------------------------- text flavor */

/** Running text only — footnote bodies are dropped (they have no plain-text home);
 * the RTF/HTML flavors carry them. */
export const plainInline = (node: Node): string => {
  if (node.nodeType === 3) return node.nodeValue ?? '';
  if (!isElement(node)) return '';
  if (teiTagOf(node) === 'note') return '';
  return Array.from(node.childNodes).map(plainInline).join('');
};

/* ------------------------------------------------------------------- blocks */

/** An alignment unit is either a <p> itself, or a <div> containing block children:
 * returns the paragraph-level elements to render, in order. */
export const blockElementsOf = (unit: Element): Element[] => {
  const tag = teiTagOf(unit);
  if (tag !== 'div') return [unit];
  const blocks = Array.from(unit.children).filter((child) =>
    ['p', 'head', 'div'].includes(teiTagOf(child)),
  );
  return blocks.length > 0 ? blocks.flatMap(blockElementsOf) : [unit];
};

export const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

/* -------------------------------------------------------------------- main */

export const buildClipboardExport = (
  pairs: ExportUnitPair[],
  biblEntries: Map<string, ExportBiblEntry> = new Map(),
): ClipboardExportFlavors => {
  const ctx: WalkContext = { biblEntries };

  const textBlocks: string[] = [];
  const htmlBlocks: string[] = [];
  const rtfBlocks: string[] = [];

  const pushUnit = (unit: Element | null) => {
    if (!unit) return;
    for (const block of blockElementsOf(unit)) {
      const text = normalizeWhitespace(plainInline(block));
      if (text) textBlocks.push(text);

      const html = htmlInline(block, ctx).trim();
      if (html) htmlBlocks.push(`<p>${html}</p>`);

      const rtf = rtfInline(block, ctx).trim();
      if (rtf) rtfBlocks.push(`\\pard\\plain ${rtf}\\par`);
    }
  };

  for (const pair of pairs) {
    pushUnit(pair.source);
    pushUnit(pair.translation);
  }

  return {
    text: textBlocks.join('\n\n'),
    html: htmlBlocks.join('\n'),
    rtf: `{\\rtf1\\ansi\\ansicpg1252\\uc0\\deff0{\\fonttbl{\\f0 Times New Roman;}}\n${rtfBlocks.join('\n')}\n}`,
  };
};
