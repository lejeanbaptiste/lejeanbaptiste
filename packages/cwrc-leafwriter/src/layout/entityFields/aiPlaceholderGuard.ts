/**
 * Inventory AI placeholders and detect deletions so we can reject + resend.
 */

import { normalizeAiPlaceholders } from './normalizeAiPlaceholders';

/** Full placeholder tokens we require the model to copy through unchanged. */
const PLACEHOLDER_TOKEN_RE =
  /\{\{(?:holding:opaque|as:opaque|opaque|holding|as|entity|mention|date|note):[^{}]+\}\}/g;

/** Count each distinct `{{…}}` token in document order. */
export const collectPlaceholderInventory = (text: string): Map<string, number> => {
  const normalized = normalizeAiPlaceholders(text);
  const counts = new Map<string, number>();
  PLACEHOLDER_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = PLACEHOLDER_TOKEN_RE.exec(normalized))) {
    const token = match[0];
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
};

/**
 * Placeholders present in `expected` but missing (or under-counted) in `actual`.
 * Returns one entry per missing copy (so two missing `{{date:0}}` → two rows).
 */
export const missingPlaceholders = (expected: string, actual: string): string[] => {
  const exp = collectPlaceholderInventory(expected);
  const act = collectPlaceholderInventory(actual);
  const missing: string[] = [];
  for (const [token, need] of exp) {
    const have = act.get(token) ?? 0;
    for (let i = have; i < need; i += 1) missing.push(token);
  }
  return missing;
};

/** User-message addendum when the first attempt dropped markers. */
export const buildPlaceholderRetryInstruction = (missing: string[]): string => {
  const unique = [...new Set(missing)];
  return (
    'Your previous translation omitted required placeholders. ' +
    'Copy EVERY placeholder through exactly as written, in the same relative order. ' +
    'Do not expand, translate, swap, or delete them. ' +
    `Missing from your previous attempt: ${unique.join(', ')}. ` +
    'Return a corrected translationXml that includes all of them.'
  );
};
