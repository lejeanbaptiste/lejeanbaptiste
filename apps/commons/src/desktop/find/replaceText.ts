import { resolveTextHitInXml } from './resolveTextHitInXml';
import { searchInContent } from './textSearchUtils';

const MARKUP_IN_SLICE = /[<>]/;

/** True when the hit lies entirely in one raw XML text run (safe for phase 2a replace). */
export const isReplaceableTextHit = (content: string, start: number, end: number): boolean => {
  if (start < 0 || end <= start || end > content.length) return false;
  if (MARKUP_IN_SLICE.test(content.slice(start, end))) return false;
  return resolveTextHitInXml(content, start, end) !== null;
};

export const replaceHitAtOffset = (
  content: string,
  start: number,
  end: number,
  replacement: string,
): string => content.slice(0, start) + replacement + content.slice(end);

/** Apply regex-style `$1`, `$2`, `$$`, and `\1`, `\2` substitution from a match. */
export const applyRegexReplacement = (
  match: RegExpExecArray,
  replacement: string,
): string => {
  const withBackrefs = replacement.replace(/\\([1-9]\d*)/g, (_full, digits: string) => {
    const index = Number.parseInt(digits, 10);
    if (Number.isNaN(index) || index < 1 || index >= match.length) return '';
    return match[index] ?? '';
  });

  return withBackrefs.replace(/\$(\$|\d+)/g, (_full, token: string) => {
    if (token === '$') return '$';
    const index = Number.parseInt(token, 10);
    if (Number.isNaN(index) || index < 1 || index >= match.length) return '';
    return match[index] ?? '';
  });
};

const buildSearchRegex = (
  query: string,
  useRegex: boolean,
  ignoreCase = false,
): RegExp | null => {
  const flags = ignoreCase ? 'giu' : 'gu';
  if (useRegex) {
    try {
      return new RegExp(query, flags);
    } catch {
      return null;
    }
  }

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, flags);
};

export interface ReplaceAllResult {
  content: string;
  count: number;
  skippedNonReplaceable: number;
}

export const replaceAllInContent = (
  content: string,
  query: string,
  replacement: string,
  useRegex: boolean,
  ignoreCase = false,
): ReplaceAllResult => {
  const hits = searchInContent(content, query, useRegex, ignoreCase);
  if (hits.length === 0) {
    return { content, count: 0, skippedNonReplaceable: 0 };
  }

  let nextContent = content;
  let count = 0;
  let skippedNonReplaceable = 0;
  let offsetDelta = 0;

  for (const hit of hits) {
    const start = hit.start + offsetDelta;
    const end = hit.end + offsetDelta;

    if (!isReplaceableTextHit(nextContent, start, end)) {
      skippedNonReplaceable += 1;
      continue;
    }

    let nextReplacement = replacement;
    if (useRegex) {
      const regex = buildSearchRegex(query, true, ignoreCase);
      if (!regex) break;
      regex.lastIndex = start;
      const match = regex.exec(nextContent);
      if (!match || match.index !== start || match[0].length !== end - start) {
        skippedNonReplaceable += 1;
        continue;
      }
      nextReplacement = applyRegexReplacement(match, replacement);
    }

    const updated = replaceHitAtOffset(nextContent, start, end, nextReplacement);
    offsetDelta += nextReplacement.length - (end - start);
    nextContent = updated;
    count += 1;
  }

  return { content: nextContent, count, skippedNonReplaceable };
};
