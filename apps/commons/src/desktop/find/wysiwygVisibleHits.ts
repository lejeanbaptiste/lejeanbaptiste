import { resolveTextHitInXml } from './resolveTextHitInXml';
import type { TextHit } from './types';

const HIDDEN_HEADER_TAGS = ['teiHeader', 'header'];

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

const findElementRange = (
  content: string,
  tagName: string,
): { end: number; start: number } | null => {
  const openPattern = new RegExp(`<${tagName}(\\s|>|/)`, 'i');
  const openMatch = openPattern.exec(content);
  if (!openMatch) return null;

  const tagStart = openMatch.index;
  const tagEnd = findTagEnd(content, tagStart);
  if (tagEnd === -1) return null;

  const inner = content.slice(tagStart + 1, tagEnd);
  if (inner.trim().endsWith('/')) {
    return { start: tagStart, end: tagEnd + 1 };
  }

  const stack = [tagName.toLowerCase()];
  let i = tagEnd + 1;

  while (i < content.length && stack.length > 0) {
    if (content[i] !== '<') {
      i += 1;
      continue;
    }

    const nextTagEnd = findTagEnd(content, i);
    if (nextTagEnd === -1) break;

    const tagInner = content.slice(i + 1, nextTagEnd).trim();
    const isClose = tagInner.startsWith('/');
    const isSelfClosing = tagInner.endsWith('/');
    const nameMatch = tagInner.match(/^(\/?)([\w:-]+)/);
    const name = nameMatch?.[2]?.toLowerCase();
    if (!name) {
      i = nextTagEnd + 1;
      continue;
    }

    if (isClose) {
      if (stack[stack.length - 1] === name) stack.pop();
    } else if (!isSelfClosing) {
      stack.push(name);
    }

    i = nextTagEnd + 1;
  }

  if (stack.length > 0) return null;

  return { start: tagStart, end: i };
};

/** True when offset lies inside a TEI header block that is hidden in the WYSIWYG editor. */
export const isOffsetInHiddenHeader = (content: string, offset: number): boolean => {
  for (const tag of HIDDEN_HEADER_TAGS) {
    const range = findElementRange(content, tag);
    if (range && offset >= range.start && offset < range.end) return true;
  }
  return false;
};

export const isHitVisibleInWysiwygEditor = (
  content: string,
  start: number,
  end: number,
): boolean => {
  if (isOffsetInHiddenHeader(content, start) || isOffsetInHiddenHeader(content, end - 1)) {
    return false;
  }

  const resolved = resolveTextHitInXml(content, start, end);
  if (!resolved) return false;

  return !HIDDEN_HEADER_TAGS.some((tag) => resolved.teiXPath.includes(`/${tag}[`));
};

export const filterHitsForWysiwygEditor = (content: string, hits: TextHit[]): TextHit[] => {
  const visible = hits.filter((hit) => isHitVisibleInWysiwygEditor(content, hit.start, hit.end));
  return visible.map((hit, matchIndex) => ({ ...hit, matchIndex }));
};
