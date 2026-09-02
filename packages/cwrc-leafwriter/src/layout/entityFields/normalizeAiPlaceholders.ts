/**
 * Repair AI-mangled LJBtero placeholders before substitution / inventory.
 *
 * Models sometimes insert smart/straight quotes: `{{“date:0}}`, `{{"entity:…"}}`.
 */

const QUOTE = '[\u201C\u201D\u201E\u201F"\']?';

/** Normalize `{{…}}` placeholders so substitute* / inventory regexes can match them. */
export const normalizeAiPlaceholders = (text: string): string => {
  if (!text.includes('{{')) return text;
  let out = text;
  out = out.replace(
    new RegExp(`\\{\\{\\s*${QUOTE}\\s*date\\s*:\\s*${QUOTE}\\s*(\\d+)\\s*${QUOTE}\\s*\\}\\}`, 'gi'),
    '{{date:$1}}',
  );
  out = out.replace(
    new RegExp(`\\{\\{\\s*${QUOTE}\\s*note\\s*:\\s*${QUOTE}\\s*(\\d+)\\s*${QUOTE}\\s*\\}\\}`, 'gi'),
    '{{note:$1}}',
  );
  out = out.replace(
    new RegExp(
      `\\{\\{\\s*${QUOTE}\\s*opaque\\s*:\\s*${QUOTE}\\s*(\\d+)\\s*${QUOTE}\\s*\\}\\}`,
      'gi',
    ),
    '{{opaque:$1}}',
  );
  out = out.replace(
    new RegExp(
      `\\{\\{\\s*${QUOTE}\\s*holding\\s*:\\s*opaque\\s*:\\s*${QUOTE}\\s*(\\d+)\\s*${QUOTE}\\s*\\}\\}`,
      'gi',
    ),
    '{{holding:opaque:$1}}',
  );
  out = out.replace(
    new RegExp(
      `\\{\\{\\s*${QUOTE}\\s*as\\s*:\\s*opaque\\s*:\\s*${QUOTE}\\s*(\\d+)\\s*${QUOTE}\\s*\\}\\}`,
      'gi',
    ),
    '{{as:opaque:$1}}',
  );
  for (const role of ['entity', 'mention', 'holding', 'as'] as const) {
    out = out.replace(
      new RegExp(
        `\\{\\{\\s*${QUOTE}\\s*${role}\\s*:\\s*${QUOTE}\\s*([^{}\\s"'“”]+?)\\s*${QUOTE}\\s*\\}\\}`,
        'gi',
      ),
      (_match, key: string) => `{{${role}:${String(key).trim()}}}`,
    );
  }
  return out;
};
