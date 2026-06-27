import { parseXmlDocument } from '../xpath/evaluateXPathAll';

/** Risk tier for a proposed replace operation (phase 2). */
export type ReplaceRiskTier = 'low' | 'medium' | 'high';

const MARKUP_CHARS = /[<>/&]/;
const GREEDY_REGEX = /\(\.\*|\(\.\+|\\\.\\\*|\\\.\\\+/;

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
