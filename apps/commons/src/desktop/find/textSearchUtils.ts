import type { TextHit, VisibleSnippet } from './types';
import { isReplaceableTextHit } from './replaceText';

const SNIPPET_RADIUS = 36;
const SNIPPET_VISIBLE_RADIUS = 16;
const MAX_SNIPPET_PREFIX_CHARS = 14;
const MAX_SNIPPET_SUFFIX_CHARS = 14;

const findTagEnd = (content: string, tagStart: number) => {
  let quote: '"' | "'" | null = null;

  for (let j = tagStart + 1; j < content.length; j++) {
    const ch = content[j];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '>') return j;
  }

  return -1;
};

const normalizeSnippetPart = (text: string) => text.replace(/\s+/g, ' ').trim();

const stripMarkupArtifacts = (text: string) =>
  normalizeSnippetPart(
    text
      .replace(/\/?[\w:.-]*="[^"]*"/g, ' ')
      .replace(/\/?[\w:.-]*='[^']*'/g, ' ')
      .replace(/\/>/g, ' ')
      .replace(/[<>]/g, ' ')
      .replace(/\/[\w:.-]+/g, ' '),
  );

/** If pos is inside `<...>`, return index after the closing `>`. */
const alignToVisibleStart = (content: string, pos: number) => {
  for (let j = pos - 1; j >= 0; j--) {
    if (content[j] === '>') return pos;
    if (content[j] === '<') {
      const tagEnd = findTagEnd(content, j);
      return tagEnd === -1 ? pos : tagEnd + 1;
    }
  }
  return pos;
};

/** Collect visible (non-markup) characters from a raw XML slice, tracking match offsets. */
const collectVisibleTextInWindow = (
  content: string,
  windowStart: number,
  windowEnd: number,
  matchStart: number,
  matchEnd: number,
) => {
  let text = '';
  let matchStartInText = -1;
  let matchEndInText = -1;
  let i = alignToVisibleStart(content, windowStart);

  const appendChar = (char: string, absoluteIndex: number) => {
    if (text.length === 0 && /\s/.test(char)) return;

    if (absoluteIndex >= matchStart && absoluteIndex < matchEnd) {
      if (matchStartInText === -1) matchStartInText = text.length;
      text += char;
      matchEndInText = text.length;
      return;
    }

    text += char;
  };

  while (i < windowEnd) {
    if (content[i] === '<') {
      const tagEnd = findTagEnd(content, i);
      if (tagEnd === -1) break;

      const inner = content.slice(i + 1, tagEnd);

      if (inner.startsWith('![CDATA[')) {
        const cdataStart = i + '<![CDATA['.length;
        const cdataClose = content.indexOf(']]>', cdataStart);
        if (cdataClose === -1) {
          i = tagEnd + 1;
          continue;
        }

        const cdataTextEnd = Math.min(cdataClose, windowEnd);
        for (let j = Math.max(cdataStart, i); j < cdataTextEnd; j++) {
          appendChar(content[j], j);
        }
        i = cdataClose + 3;
        continue;
      }

      i = tagEnd + 1;
      continue;
    }

    appendChar(content[i], i);
    i += 1;
  }

  return { matchEndInText, matchStartInText, text };
};

export const buildVisibleSnippet = (
  content: string,
  matchStart: number,
  matchEnd: number,
): VisibleSnippet => {
  const windowStart = Math.max(0, matchStart - SNIPPET_RADIUS);
  const windowEnd = Math.min(content.length, matchEnd + SNIPPET_RADIUS);
  const { matchEndInText, matchStartInText, text } = collectVisibleTextInWindow(
    content,
    windowStart,
    windowEnd,
    matchStart,
    matchEnd,
  );

  const matchText = content.slice(matchStart, matchEnd);

  if (matchStartInText === -1 || matchEndInText === -1) {
    const fallback = normalizeSnippetPart(text) || matchText;
    return { prefix: '', match: fallback, suffix: '' };
  }

  const visStart = Math.max(0, matchStartInText - SNIPPET_VISIBLE_RADIUS);
  const visEnd = Math.min(text.length, matchEndInText + SNIPPET_VISIBLE_RADIUS);

  let prefix = stripMarkupArtifacts(text.slice(visStart, matchStartInText));
  const match = text.slice(matchStartInText, matchEndInText);
  let suffix = stripMarkupArtifacts(text.slice(matchEndInText, visEnd));

  if (prefix.length > MAX_SNIPPET_PREFIX_CHARS) {
    prefix = `…${prefix.slice(-MAX_SNIPPET_PREFIX_CHARS)}`;
  } else if (visStart > 0 && prefix) {
    prefix = `…${prefix}`;
  }

  if (suffix.length > MAX_SNIPPET_SUFFIX_CHARS) {
    suffix = `${suffix.slice(0, MAX_SNIPPET_SUFFIX_CHARS)}…`;
  } else if (visEnd < text.length && suffix) {
    suffix = `${suffix}…`;
  }

  return { prefix, match, suffix };
};

export const offsetToLineColumn = (content: string, offset: number) => {
  let line = 1;
  let lineStart = 0;

  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') {
      line += 1;
      lineStart = i + 1;
    }
  }

  return { line, column: offset - lineStart + 1 };
};

export const searchLiteralInContent = (
  content: string,
  needle: string,
  ignoreCase = false,
): TextHit[] => {
  if (!needle) return [];

  const hits: TextHit[] = [];
  const haystack = ignoreCase ? content.toLocaleLowerCase() : content;
  const searchNeedle = ignoreCase ? needle.toLocaleLowerCase() : needle;
  let from = 0;
  let matchIndex = 0;

  while (from <= content.length) {
    const index = haystack.indexOf(searchNeedle, from);
    if (index === -1) break;

    const end = index + needle.length;
    const { line, column } = offsetToLineColumn(content, index);

    hits.push({
      matchIndex,
      start: index,
      end,
      line,
      column,
      snippet: buildVisibleSnippet(content, index, end),
      replaceable: isReplaceableTextHit(content, index, end),
    });

    matchIndex += 1;
    from = index + searchNeedle.length;
  }

  return hits;
};

export const searchRegexInContent = (
  content: string,
  pattern: string,
  ignoreCase = false,
): TextHit[] => {
  if (!pattern) return [];

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, ignoreCase ? 'gi' : 'g');
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Invalid regular expression.');
  }

  const hits: TextHit[] = [];
  let matchIndex = 0;

  for (const match of content.matchAll(regex)) {
    if (match.index === undefined) continue;

    const start = match.index;
    const end = start + match[0].length;
    const { line, column } = offsetToLineColumn(content, start);

    hits.push({
      matchIndex,
      start,
      end,
      line,
      column,
      snippet: buildVisibleSnippet(content, start, end),
      replaceable: isReplaceableTextHit(content, start, end),
    });

    matchIndex += 1;

    if (match[0].length === 0) {
      regex.lastIndex += 1;
    }
  }

  return hits;
};

export const searchInContent = (
  content: string,
  query: string,
  useRegex: boolean,
  ignoreCase = false,
): TextHit[] => {
  if (useRegex) return searchRegexInContent(content, query, ignoreCase);
  return searchLiteralInContent(content, query, ignoreCase);
};
