/**
 * Whitespace-safe source formatting applied on save: newly created elements (paragraph
 * splits, inserted <lb/>) come out of the serializer glued to their neighbours on one line.
 * This walks the document and normalizes ONLY the whitespace between block-level tags —
 * inserting a newline plus indentation matching the element depth — and never touches any
 * boundary that carries real text, so no whitespace is ever introduced or changed inside
 * running (mixed) content. Deliberately not a full pretty-printer.
 */

/** Block-ish tags whose boundaries are whitespace-insensitive; matched case-insensitively
 * so Orlando's uppercase tags are covered too. */
const BLOCK_TAGS = new Set([
  'p',
  'div',
  'head',
  'body',
  'text',
  'front',
  'back',
  'lg',
  'l',
  'sp',
  'ab',
]);

const INDENT = '  ';

/** `<lb/>text` — the text after a line break starts a new source line, mirroring the break. */
const AFTER_LB = /(<lb\b[^>]*\/>)(?=[^\s<])/gi;

interface Token {
  type: 'text' | 'open' | 'close' | 'self' | 'other';
  name: string;
  raw: string;
}

const tokenize = (xml: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;

  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    if (lt === -1) {
      tokens.push({ type: 'text', name: '', raw: xml.slice(i) });
      break;
    }
    if (lt > i) tokens.push({ type: 'text', name: '', raw: xml.slice(i, lt) });

    if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt);
      const stop = end === -1 ? xml.length : end + 3;
      tokens.push({ type: 'other', name: '', raw: xml.slice(lt, stop) });
      i = stop;
      continue;
    }
    if (xml.startsWith('<![CDATA[', lt)) {
      const end = xml.indexOf(']]>', lt);
      const stop = end === -1 ? xml.length : end + 3;
      tokens.push({ type: 'other', name: '', raw: xml.slice(lt, stop) });
      i = stop;
      continue;
    }

    // Find the tag end, respecting quoted attribute values.
    let quote: '"' | "'" | null = null;
    let end = -1;
    for (let j = lt + 1; j < xml.length; j++) {
      const ch = xml[j];
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        continue;
      }
      if (ch === '>') {
        end = j;
        break;
      }
    }
    if (end === -1) {
      tokens.push({ type: 'text', name: '', raw: xml.slice(lt) });
      break;
    }

    const raw = xml.slice(lt, end + 1);
    const inner = xml.slice(lt + 1, end);
    if (inner.startsWith('?') || inner.startsWith('!')) {
      tokens.push({ type: 'other', name: '', raw });
    } else if (inner.startsWith('/')) {
      const name = inner.slice(1).trim().match(/^[\w:-]+/)?.[0] ?? '';
      tokens.push({ type: 'close', name, raw });
    } else {
      const name = inner.match(/^[\w:-]+/)?.[0] ?? '';
      const selfClosing = inner.trimEnd().endsWith('/');
      tokens.push({ type: selfClosing ? 'self' : 'open', name, raw });
    }
    i = end + 1;
  }

  return tokens;
};

const isBlockTag = (token: Token | undefined): boolean =>
  !!token &&
  (token.type === 'open' || token.type === 'close' || token.type === 'self') &&
  BLOCK_TAGS.has(token.name.toLowerCase());

export const separateBlockElements = (xml: string): string => {
  const tokens = tokenize(xml);
  let out = '';
  let depth = 0;

  const boundary = (nextToken: Token): string => {
    const indentDepth = nextToken.type === 'close' ? depth - 1 : depth;
    return `\n${INDENT.repeat(Math.max(0, indentDepth))}`;
  };

  for (let k = 0; k < tokens.length; k++) {
    const token = tokens[k]!;

    if (token.type === 'text') {
      const prev = tokens[k - 1];
      const next = tokens[k + 1];
      // Whitespace between two block tags is insignificant — normalize it. Anything with
      // real text in it (mixed content) passes through untouched.
      if (token.raw.trim() === '' && next && isBlockTag(prev) && isBlockTag(next)) {
        out += boundary(next);
      } else {
        out += token.raw;
      }
      continue;
    }

    // Two block tags glued directly together (fresh serializer output) — separate them.
    const prev = tokens[k - 1];
    if (prev && prev.type !== 'text' && isBlockTag(prev) && isBlockTag(token)) {
      out += boundary(token);
    }

    out += token.raw;
    if (token.type === 'open') depth += 1;
    else if (token.type === 'close') depth = Math.max(0, depth - 1);
  }

  return out.replace(AFTER_LB, '$1\n');
};
