/**
 * Repair AI-mangled LJBtero placeholders before substitution.
 *
 * Models sometimes insert smart/straight quotes: `{{“date:0}}`, `{{"entity:…"}}`.
 */

/** Normalize `{{…}}` placeholders so substitute* regexes can match them. */
export const normalizeAiPlaceholders = (text: string): string => {
  if (!text.includes('{{')) return text;
  let out = text;
  // {{“date:0}} / {{"date:0"}} / {{ date : 0 }}
  out = out.replace(
    /\{\{\s*[\u201C\u201D\u201E\u201F"']?\s*date\s*:\s*[\u201C\u201D\u201E\u201F"']?\s*(\d+)\s*[\u201C\u201D\u201E\u201F"']?\s*\}\}/gi,
    '{{date:$1}}',
  );
  // {{“entity:key”}} / {{entity:"key"}}
  out = out.replace(
    /\{\{\s*[\u201C\u201D\u201E\u201F"']?\s*entity\s*:\s*[\u201C\u201D\u201E\u201F"']?\s*([^{}\s"'“”]+?)\s*[\u201C\u201D\u201E\u201F"']?\s*\}\}/gi,
    (_match, key: string) => `{{entity:${String(key).trim()}}}`,
  );
  return out;
};
