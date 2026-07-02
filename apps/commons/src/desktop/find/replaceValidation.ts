import { parseXmlDocument } from '../xpath/evaluateXPathAll';
import {
  applyRegexReplacement,
  isReplaceableTextHit,
  replaceAllInContent,
  replaceHitAtOffset,
} from './replaceText';

/** Risk tier for a proposed replace operation (phase 2). */
export type ReplaceRiskTier = 'low' | 'medium' | 'high';

const MARKUP_CHARS = /[<>/&]/;
const GREEDY_REGEX = /\(\.\*|\(\.\+|\\\.\\\*|\\\.\\\+/;

export const INVALID_XML_MESSAGE =
  'Replace would produce invalid XML. No changes were saved.';

export const getReplaceRiskTier = (
  find: string,
  replace: string,
  useRegex: boolean,
): ReplaceRiskTier => {
  if (useRegex && GREEDY_REGEX.test(find)) return 'high';
  if (MARKUP_CHARS.test(find) || MARKUP_CHARS.test(replace)) return 'high';
  if (useRegex) return 'medium';
  return 'low';
};

export { parseXmlDocument };

export const isWellFormedXml = (content: string): boolean => parseXmlDocument(content) !== null;

export interface ValidateReplaceHitResult {
  content?: string;
  error?: string;
  ok: boolean;
  replacementUsed?: string;
}

export interface ValidateReplaceAllResult {
  content?: string;
  count: number;
  error?: string;
  ok: boolean;
  skippedNonReplaceable: number;
}

const buildSearchRegex = (query: string, ignoreCase = false): RegExp | null => {
  try {
    return new RegExp(query, ignoreCase ? 'giu' : 'gu');
  } catch {
    return null;
  }
};

export const validateAndReplaceHit = (
  content: string,
  start: number,
  end: number,
  replacement: string,
  useRegex: boolean,
  query: string,
  ignoreCase = false,
): ValidateReplaceHitResult => {
  if (!isReplaceableTextHit(content, start, end)) {
    return {
      ok: false,
      error: 'This match crosses XML markup and cannot be replaced in Source mode.',
    };
  }

  let nextReplacement = replacement;

  if (useRegex) {
    const regex = buildSearchRegex(query, ignoreCase);
    if (!regex) {
      return { ok: false, error: 'Invalid regular expression.' };
    }

    regex.lastIndex = start;
    const match = regex.exec(content);
    if (!match || match.index !== start || match[0].length !== end - start) {
      return {
        ok: false,
        error: 'This match crosses XML markup and cannot be replaced in Source mode.',
      };
    }

    nextReplacement = applyRegexReplacement(match, replacement);
  }

  const nextContent = replaceHitAtOffset(content, start, end, nextReplacement);

  if (MARKUP_CHARS.test(nextReplacement) && !isWellFormedXml(nextContent)) {
    return { ok: false, error: INVALID_XML_MESSAGE };
  }

  return { ok: true, content: nextContent, replacementUsed: nextReplacement };
};

export const validateAndReplaceAll = (
  content: string,
  query: string,
  replacement: string,
  useRegex: boolean,
  ignoreCase = false,
): ValidateReplaceAllResult => {
  if (useRegex && !buildSearchRegex(query, ignoreCase)) {
    return { ok: false, count: 0, skippedNonReplaceable: 0, error: 'Invalid regular expression.' };
  }

  const { content: nextContent, count, skippedNonReplaceable } = replaceAllInContent(
    content,
    query,
    replacement,
    useRegex,
    ignoreCase,
  );

  if (count === 0) {
    return { ok: true, content, count: 0, skippedNonReplaceable };
  }

  if (!isWellFormedXml(nextContent)) {
    return {
      ok: false,
      count: 0,
      skippedNonReplaceable,
      error: INVALID_XML_MESSAGE,
    };
  }

  return { ok: true, content: nextContent, count, skippedNonReplaceable };
};
