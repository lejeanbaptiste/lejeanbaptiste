/**
 * Atomic date fields in the translation pane — parallel to grognard-entity refs.
 * Stores Sanmiao structure on the element so the gloss can be recomputed.
 */

import {
  dateGlossInputFromParts,
  formatDateGlossTokens,
  type DateGlossInput,
  type DateGlossToken,
  type DateMonthSpanStyle,
  type DateWesternDisplayMode,
} from './dateGloss';
import {
  getDateMonthSpanStyle,
  getDateShowAttrBrackets,
  getDateWesternDisplayMode,
} from './scholarlyConventions';

export const DATE_REF_TYPE = 'grognard-date';
export const DATE_FIELD_ATTR = 'data-leaf-date-field';
/** JSON-serialized {@link DateGlossInput} for recalculation. */
export const DATE_PARTS_ATTR = 'data-date-parts';

const appendTokens = (parent: Element, tokens: DateGlossToken[]): void => {
  const doc = parent.ownerDocument ?? document;
  while (parent.firstChild) parent.removeChild(parent.firstChild);
  for (const token of tokens) {
    if (token.kind === 'ganzhi') {
      const hi = doc.createElement('hi');
      hi.setAttribute('rend', 'italic');
      hi.textContent = token.text;
      parent.appendChild(hi);
    } else if (token.text) {
      parent.appendChild(doc.createTextNode(token.text));
    }
  }
};

export const serializeDateParts = (input: DateGlossInput): string =>
  JSON.stringify({
    dyn: input.dyn ?? undefined,
    ruler: input.ruler ?? undefined,
    era: input.era ?? undefined,
    year: input.year ?? undefined,
    season: input.season ?? undefined,
    month: input.month ?? undefined,
    intercalary: input.intercalary || undefined,
    day: input.day ?? undefined,
    gz: input.gz ?? undefined,
    nmdGz: input.nmdGz ?? undefined,
    lp: input.lp ?? undefined,
    attrs: input.attrs ?? undefined,
    when: input.when ?? undefined,
    notBefore: input.notBefore ?? undefined,
    notAfter: input.notAfter ?? undefined,
    surface: input.surface ?? undefined,
  });

export const readDatePartsFromField = (field: Element): DateGlossInput | null => {
  const raw = field.getAttribute(DATE_PARTS_ATTR);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DateGlossInput;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

/** Fill (or rebuild) the visible gloss inside a date field. */
export const renderDateFieldContent = (
  field: Element,
  input: DateGlossInput,
  lang?: string | null,
  mode?: DateWesternDisplayMode,
  monthSpanStyle?: DateMonthSpanStyle,
  showAttrBrackets?: boolean,
): void => {
  const tokens = formatDateGlossTokens(
    input,
    lang,
    mode ?? getDateWesternDisplayMode(),
    monthSpanStyle ?? getDateMonthSpanStyle(),
    showAttrBrackets ?? getDateShowAttrBrackets(),
  );
  if (tokens.length > 0) {
    appendTokens(field, tokens);
    return;
  }
  // Stand-in when structure is too thin: surface text, else when, else "?".
  const fallback = input.surface?.trim() || input.when?.trim() || '?';
  while (field.firstChild) field.removeChild(field.firstChild);
  field.appendChild((field.ownerDocument ?? document).createTextNode(fallback));
};

export const createDateFieldElement = (
  input: DateGlossInput,
  lang?: string | null,
): HTMLElement => {
  const ref = document.createElement('ref');
  ref.setAttribute('type', DATE_REF_TYPE);
  ref.setAttribute('contenteditable', 'false');
  ref.setAttribute(DATE_FIELD_ATTR, 'true');
  ref.setAttribute(DATE_PARTS_ATTR, serializeDateParts(input));
  if (input.when?.trim()) ref.setAttribute('when', input.when.trim());
  ref.setAttribute('title', input.surface?.trim() || 'date');
  renderDateFieldContent(ref, input, lang);
  return ref;
};

export const prepareAtomicDateFields = (root: ParentNode): void => {
  for (const ref of Array.from(
    (
      root as ParentNode & { querySelectorAll: typeof Element.prototype.querySelectorAll }
    ).querySelectorAll?.(`ref[type="${DATE_REF_TYPE}"]`) ?? [],
  )) {
    ref.setAttribute('contenteditable', 'false');
    ref.setAttribute(DATE_FIELD_ATTR, 'true');
  }
};

export const recalculateDateFieldsInRoot = (root: ParentNode, lang?: string | null): void => {
  const fields = Array.from(
    (
      root as ParentNode & { querySelectorAll: typeof Element.prototype.querySelectorAll }
    ).querySelectorAll?.(`ref[type="${DATE_REF_TYPE}"]`) ?? [],
  );
  for (const field of fields) {
    const parts = readDatePartsFromField(field);
    if (!parts) continue;
    renderDateFieldContent(field, parts, lang);
    field.setAttribute('contenteditable', 'false');
    field.setAttribute(DATE_FIELD_ATTR, 'true');
  }
};

/** Helper for tests / collectors that already have attrs + children maps. */
export const dateFieldFromParts = (
  attrs: Record<string, string | undefined | null>,
  children: Record<string, string | undefined | null>,
  surface: string | null | undefined,
  lang?: string | null,
): HTMLElement => createDateFieldElement(dateGlossInputFromParts(attrs, children, surface), lang);
