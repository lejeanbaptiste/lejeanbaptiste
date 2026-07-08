export const LEAF_WRITER_CLIPBOARD_MIME = 'application/x-le-jean-baptiste-fragment+json';

export type PasteMode = 'paragraphs' | 'line-breaks' | 'xml' | 'plain';
export type PasteAmbiguity = 'line-breaks' | 'xml';

export interface LeafWriterClipboardPayload {
  app: 'le-jean-baptiste';
  copiedAt: string;
  version: 1;
}

const XML_DECLARATION = /^\s*<\?xml[\s\S]*?\?>/i;
const XML_LIKE = /^\s*<([A-Za-z_][\w:.-]*)(\s|>|\/>)/;
const INLINE_XML_LIKE =
  /<([A-Za-z_][\w:.-]*)(?:\s[^<>]*)?>[\s\S]*?<\/\1>|<[A-Za-z_][\w:.-]*(?:\s[^<>]*)?\/>/;
const ENTITY_LIKE = /&(lt|gt|amp|quot|apos|nbsp|#\d+|#x[\da-f]+);/i;

export const buildLeafWriterClipboardPayload = (): string =>
  JSON.stringify({
    app: 'le-jean-baptiste',
    copiedAt: new Date().toISOString(),
    version: 1,
  } satisfies LeafWriterClipboardPayload);

export const isLeafWriterClipboardPayload = (value: string | null | undefined): boolean => {
  if (!value) return false;
  try {
    const parsed = JSON.parse(value) as Partial<LeafWriterClipboardPayload>;
    return parsed.app === 'le-jean-baptiste' && parsed.version === 1;
  } catch {
    return false;
  }
};

export const decodeHtmlEntities = (value: string): string => {
  if (!ENTITY_LIKE.test(value)) return value;

  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  }

  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
};

export const normalizeClipboardText = (text: string): string => decodeHtmlEntities(text);

export const looksLikeXml = (text: string): boolean => {
  const normalized = normalizeClipboardText(text).replace(XML_DECLARATION, '').trim();
  return XML_LIKE.test(normalized) || INLINE_XML_LIKE.test(normalized);
};

export const hasAmbiguousLineBreaks = (text: string): boolean => {
  const normalized = normalizeClipboardText(text).replace(/\r\n?/g, '\n').trim();
  if (!normalized.includes('\n')) return false;

  const lines = normalized.split('\n');
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  const blankLines = lines.length - nonEmptyLines.length;
  return nonEmptyLines.length >= 2 && blankLines === 0;
};

export const detectPasteAmbiguity = ({
  fromLeafWriter,
  text,
}: {
  fromLeafWriter: boolean;
  text: string;
}): PasteAmbiguity | null => {
  if (fromLeafWriter) return null;
  if (looksLikeXml(text)) return 'xml';
  if (hasAmbiguousLineBreaks(text)) return 'line-breaks';
  return null;
};

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const splitParagraphs = (text: string, singleNewlineFallback = false): string[] => {
  const normalized = text.replace(/\r\n?/g, '\n');
  // In paragraphs mode, text without any blank lines splits on every line break —
  // otherwise the mode could never produce more than one paragraph for such text.
  const separator = !singleNewlineFallback || /\n{2,}/.test(normalized) ? /\n{2,}/ : /\n/;
  return normalized
    .split(separator)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
};

export const textToParagraphHtml = (text: string, blockTag = 'p', singleNewlineFallback = false): string =>
  splitParagraphs(text, singleNewlineFallback)
    .map((paragraph) => {
      const html = paragraph
        .split('\n')
        .map((line) => escapeHtml(line))
        .join('<br />');
      return `<${blockTag}>${html}</${blockTag}>`;
    })
    .join('');

export const textToLineBreakXml = (text: string): string => {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd());

  return `<p>${lines.map((line) => escapeHtml(line)).join('<lb/>')}</p>`;
};

export const parseXmlFragment = (text: string): { document: XMLDocument; error?: string } => {
  const parser = new DOMParser();
  const wrapped = `<__ljb_fragment__>${text.replace(XML_DECLARATION, '')}</__ljb_fragment__>`;
  const document = parser.parseFromString(wrapped, 'application/xml');
  const parseError = document.querySelector('parsererror');
  if (parseError) {
    return {
      document,
      error: parseError.textContent?.trim() || 'The XML fragment is not well formed.',
    };
  }
  return { document };
};
