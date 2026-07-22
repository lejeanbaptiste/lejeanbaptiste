/** Letters, numbers, and underscore from any script — our Unicode-aware \\w. */
export const UNICODE_WORD_CLASS = '\\p{L}\\p{N}_';

const countBackslashesBefore = (pattern: string, index: number): number => {
  let count = 0;
  for (let j = index - 1; j >= 0 && pattern[j] === '\\'; j -= 1) count += 1;
  return count;
};

const isEscaped = (pattern: string, index: number): boolean =>
  countBackslashesBefore(pattern, index) % 2 === 1;

/** Expand ASCII-only \\w / \\W to Unicode letter/number classes (includes Han). */
export const expandUnicodeWordShorthand = (pattern: string): string => {
  let result = '';
  let inClass = false;
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    if (ch === '\\' && i + 1 < pattern.length) {
      const next = pattern[i + 1];
      if (next === 'w' && isEscaped(pattern, i + 1)) {
        result += inClass ? UNICODE_WORD_CLASS : `[${UNICODE_WORD_CLASS}]`;
        i += 2;
        continue;
      }
      if (next === 'W' && isEscaped(pattern, i + 1) && !inClass) {
        result += `[^${UNICODE_WORD_CLASS}]`;
        i += 2;
        continue;
      }
    }

    if (ch === '[' && !inClass && !isEscaped(pattern, i)) {
      inClass = true;
    } else if (ch === ']' && inClass && !isEscaped(pattern, i)) {
      inClass = false;
    }

    result += ch;
    i += 1;
  }

  return result;
};

export const compileFindRegex = (pattern: string, ignoreCase = false): RegExp => {
  const expanded = expandUnicodeWordShorthand(pattern);
  return new RegExp(expanded, ignoreCase ? 'giu' : 'gu');
};

export const tryCompileFindRegex = (pattern: string, ignoreCase = false): RegExp | null => {
  try {
    return compileFindRegex(pattern, ignoreCase);
  } catch {
    return null;
  }
};

export const compileFindLiteralRegex = (query: string, ignoreCase = false): RegExp => {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, ignoreCase ? 'giu' : 'gu');
};
