/**
 * Temporal prepositions before LJBtero date placeholders / fields.
 *
 * Gloss text no longer begins with In/On — the model (or human) may write
 * by / until / before / in / on / … immediately before `{{date:N}}`. We only
 * rewrite the in↔on pair (French en↔le) so it matches day vs year/month
 * granularity. All other prepositions are left alone.
 */

import { dateGlossIsDayLevel, dateGlossLang, type DateGlossInput } from './dateGloss';
import { readDatePartsFromField } from './translationDateFields';

/** English/French pairs we may rewrite. Everything else is sacred. */
const ADJUSTABLE = {
  en: { day: 'On', month: 'In', pattern: 'In|On' },
  fr: { day: 'Le', month: 'En', pattern: 'En|Le' },
} as const;

const matchCase = (sample: string, canonical: string): string => {
  if (!sample) return canonical;
  const upper = sample[0] === sample[0]!.toUpperCase();
  if (upper) return canonical[0]!.toUpperCase() + canonical.slice(1).toLowerCase();
  return canonical.toLowerCase();
};

const preferredPreposition = (dayLevel: boolean, lang: 'en' | 'fr'): string =>
  dayLevel ? ADJUSTABLE[lang].day : ADJUSTABLE[lang].month;

/** Build index → dayLevel from the same date map used for substitution. */
export const dayLevelByDateIndex = (
  dates: Map<number, DateGlossInput>,
): Map<number, boolean> => {
  const out = new Map<number, boolean>();
  for (const [index, input] of dates) {
    out.set(index, dateGlossIsDayLevel(input));
  }
  return out;
};

/**
 * Rewrite In/On (En/Le) immediately before `{{date:N}}` to match that date's
 * granularity. Leaves by / until / before / dès / avant / … untouched.
 */
export const adjustDatePrepositionsInText = (
  text: string,
  dayLevelByIndex: Map<number, boolean>,
  lang: string | null | undefined = 'en',
): string => {
  if (!text.includes('{{date:')) return text;
  const bucket = dateGlossLang(lang);
  const { pattern } = ADJUSTABLE[bucket];
  const re = new RegExp(
    `(^|[\\s\\(\\[\\{«"“'])(${pattern})(\\s+)(?=\\{\\{date:(\\d+)\\}\\})`,
    'gi',
  );
  return text.replace(re, (full, prefix: string, prep: string, space: string, indexStr: string) => {
    const index = parseInt(indexStr, 10);
    if (!dayLevelByIndex.has(index)) return full;
    const wanted = preferredPreposition(Boolean(dayLevelByIndex.get(index)), bucket);
    return `${prefix}${matchCase(prep, wanted)}${space}`;
  });
};

/**
 * After date fields are substituted, rewrite In/On (En/Le) in the text node
 * immediately preceding each `ref[type="ljb-date"]` using that field's parts.
 */
export const adjustDatePrepositionsBeforeDateFields = (
  root: ParentNode,
  lang?: string | null,
): void => {
  const bucket = dateGlossLang(lang);
  const { pattern } = ADJUSTABLE[bucket];
  const prepositionAtEnd = new RegExp(`^(.*?)\\b(${pattern})(\\s*)$`, 'i');

  const fields = Array.from(
    (root as ParentNode & { querySelectorAll: typeof Element.prototype.querySelectorAll }).querySelectorAll?.(
      'ref[type="ljb-date"]',
    ) ?? [],
  );

  for (const field of fields) {
    const parts = readDatePartsFromField(field);
    if (!parts) continue;
    const prev = field.previousSibling;
    if (!prev || prev.nodeType !== Node.TEXT_NODE) continue;
    const text = prev.textContent ?? '';
    const match = text.match(prepositionAtEnd);
    if (!match) continue;
    const kept = match[1] ?? '';
    const prep = match[2] ?? '';
    const trailing = match[3] ?? '';
    if (kept === text) continue;
    const wanted = preferredPreposition(dateGlossIsDayLevel(parts), bucket);
    prev.textContent = `${kept}${matchCase(prep, wanted)}${trailing}`;
  }
};
