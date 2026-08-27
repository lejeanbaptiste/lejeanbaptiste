import type { ImportableDocumentFormat } from './documentImport';
import { extractPlainTextForImport } from './documentImport';

/** Strip XML/HTML chrome but keep Han, punctuation, and paragraph breaks. */
export const stripXmlToParallelText = (xml: string): string => {
  const text = xml
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<\/?(?:p|div|br|l|lg|head|para|ab|lb)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_match, digits: string) => {
      const code = Number.parseInt(digits, 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    });

  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const basename = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index === -1 ? normalized : normalized.slice(index + 1);
};

/** Load a parallel transcription from a path already approved for renderer reads. */
export const loadParallelPlainText = async ({
  format,
  sourcePath,
}: {
  format: ImportableDocumentFormat;
  sourcePath: string;
}): Promise<{ label: string; text: string }> => {
  const api = window.electronAPI;
  if (!api) throw new Error('Parallel files are available in the desktop app.');
  const label = basename(sourcePath);

  if (format === 'docx') {
    if (!api.extractDocxText) throw new Error('DOCX extraction is unavailable.');
    const { text } = await api.extractDocxText(sourcePath);
    return { label, text };
  }
  if (format === 'odt') {
    if (!api.extractOdtText) throw new Error('ODT extraction is unavailable.');
    const { text } = await api.extractOdtText(sourcePath);
    return { label, text };
  }

  let raw: string;
  if (api.readFileAutoEncoding) {
    raw = (await api.readFileAutoEncoding(sourcePath)).text;
  } else if (api.readFile) {
    raw = await api.readFile(sourcePath);
  } else {
    throw new Error('Reading files is unavailable.');
  }
  if (format === 'xml') {
    return { label, text: stripXmlToParallelText(raw) };
  }
  return { label, text: extractPlainTextForImport(raw, format) };
};
