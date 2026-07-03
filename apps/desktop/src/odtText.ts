/**
 * Plain-text extraction from OpenDocument Text (.odt) files: unzip
 * content.xml and walk the body, emitting one line per text:p / text:h.
 */

import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';
import fs from 'fs/promises';

export interface ExtractedOdtText {
  text: string;
  warnings: string[];
}

const TEXT_NS = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';

const isElement = (node: Node): node is Element => node.nodeType === 1;

const collectInlineText = (element: Element, warnings: string[]): string => {
  let out = '';

  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i];

    if (child.nodeType === 3) {
      out += child.nodeValue ?? '';
      continue;
    }
    if (!isElement(child)) continue;

    if (child.namespaceURI === TEXT_NS) {
      if (child.localName === 's') {
        const count = Number.parseInt(child.getAttributeNS(TEXT_NS, 'c') || '1', 10);
        out += ' '.repeat(Number.isFinite(count) && count > 0 ? count : 1);
        continue;
      }
      if (child.localName === 'tab') {
        out += '\t';
        continue;
      }
      if (child.localName === 'line-break') {
        out += '\n';
        continue;
      }
      // Footnotes/endnotes would splice into the running sentence; skip them
      // until the import pipeline has somewhere structured to put them.
      if (child.localName === 'note') {
        warnings.push('Skipped a footnote/endnote.');
        continue;
      }
    }

    out += collectInlineText(child, warnings);
  }

  return out;
};

export const extractOdtTextFromContentXml = (contentXml: string): ExtractedOdtText => {
  const warnings: string[] = [];
  const doc = new DOMParser().parseFromString(contentXml, 'text/xml');
  const paragraphs: string[] = [];

  const walkBlocks = (element: Element) => {
    if (element.namespaceURI === TEXT_NS && (element.localName === 'p' || element.localName === 'h')) {
      paragraphs.push(collectInlineText(element, warnings));
      return;
    }
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i];
      if (isElement(child)) walkBlocks(child);
    }
  };

  walkBlocks(doc.documentElement);

  return {
    text: paragraphs.map((paragraph) => paragraph.trim()).filter(Boolean).join('\n\n'),
    warnings,
  };
};

export const extractOdtTextFromBuffer = async (
  buffer: Buffer | Uint8Array,
): Promise<ExtractedOdtText> => {
  const zip = await JSZip.loadAsync(buffer);
  const contentEntry = zip.file('content.xml');
  if (!contentEntry) throw new Error('Not a valid ODT file: content.xml is missing.');
  return extractOdtTextFromContentXml(await contentEntry.async('string'));
};

export const extractOdtText = async (filePath: string): Promise<ExtractedOdtText> =>
  extractOdtTextFromBuffer(await fs.readFile(filePath));
