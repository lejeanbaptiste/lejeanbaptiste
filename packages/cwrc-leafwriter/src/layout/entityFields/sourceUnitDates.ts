/**
 * Collect Sanmiao `<date>` spans from the active source alignment unit
 * (TinyMCE live DOM) or from serialized source-unit XML for the AI payload.
 */

import { dateGlossInputFromParts, formatDateGlossPlain, type DateGlossInput } from './dateGloss';
import { getDateMonthSpanStyle, getDateWesternDisplayMode } from './scholarlyConventions';

export interface SourceUnitDateHit {
  /** 0-based index in document order within the unit. */
  index: number;
  surface: string;
  input: DateGlossInput;
  /** Precomputed LJBtero gloss for the target language (AI grammar context). */
  gloss: string;
}

const CHILD_TAGS = [
  'dyn',
  'ruler',
  'era',
  'year',
  'season',
  'month',
  'day',
  'gz',
  'sexYear',
  'int',
  'lp',
  'nmdgz',
] as const;

const readChildrenFromDom = (dateEl: Element): Record<string, string> => {
  const children: Record<string, string> = {};
  for (const child of Array.from(dateEl.children)) {
    const tag =
      child.getAttribute('_tag')?.trim() || child.localName || child.tagName.toLowerCase();
    if (!tag || children[tag]) continue;
    if (!(CHILD_TAGS as readonly string[]).includes(tag) && tag !== 'sexYear') continue;
    const text = (child.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text) children[tag] = text;
  }
  return children;
};

const readChildrenFromXml = (dateEl: Element): Record<string, string> => {
  const children: Record<string, string> = {};
  for (const child of Array.from(dateEl.children)) {
    const tag = child.localName || child.tagName.toLowerCase();
    if (!tag || children[tag]) continue;
    const text = (child.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text) children[tag] = text;
  }
  return children;
};

const attrsFromNamedNodeMap = (el: Element): Record<string, string> => {
  const attrs: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    // TinyMCE uses __attrs JSON sometimes; also plain attributes after apply.
    if (attr.name.startsWith('_')) continue;
    attrs[attr.name] = attr.value;
  }
  return attrs;
};

/**
 * Collect unique date mentions inside the source alignment unit currently
 * selected for translation (live TinyMCE DOM).
 */
export const collectSourceUnitDates = (
  alignmentUnit: 'div' | 'p' | 'ab',
  unitId: string,
  lang?: string | null,
): SourceUnitDateHit[] => {
  const writer = window.writer as
    | {
        editor?: { getBody?: () => HTMLElement | null };
        schemaManager?: { getIdName?: () => string | null };
        tagger?: { getAttributesForTag?: (el: Element) => Record<string, string> };
      }
    | undefined;
  const body = writer?.editor?.getBody?.();
  if (!body) return [];

  const schemaId = writer?.schemaManager?.getIdName?.() ?? 'xml:id';
  const units = Array.from(body.querySelectorAll(`[_tag="${alignmentUnit}"]`));
  const unitEl = units.find((el) => {
    const attrs = writer?.tagger?.getAttributesForTag?.(el) ?? {};
    const id = attrs[schemaId] ?? attrs.id;
    return id === unitId;
  });
  if (!unitEl) return [];

  const hits: SourceUnitDateHit[] = [];
  for (const el of Array.from(unitEl.querySelectorAll('[_tag="date"]'))) {
    const attrs = {
      ...attrsFromNamedNodeMap(el),
      ...(writer?.tagger?.getAttributesForTag?.(el) ?? {}),
    };
    const children = readChildrenFromDom(el);
    const surface = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    const input = dateGlossInputFromParts(attrs, children, surface);
    hits.push({
      index: hits.length,
      surface,
      input,
      gloss: formatDateGlossPlain(
        input,
        lang,
        getDateWesternDisplayMode(),
        getDateMonthSpanStyle(),
      ),
    });
  }
  return hits;
};

/**
 * Collect dates from serialized source-unit XML (what the AI also receives).
 * Prefer this for the AI payload so indices match the XML the model sees.
 */
export const collectDatesFromSourceUnitXml = (
  sourceUnitXml: string,
  lang?: string | null,
): SourceUnitDateHit[] => {
  if (!sourceUnitXml.trim()) return [];
  const doc = new DOMParser().parseFromString(sourceUnitXml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return [];

  const hits: SourceUnitDateHit[] = [];
  for (const el of Array.from(doc.getElementsByTagName('date'))) {
    const attrs: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      attrs[attr.name] = attr.value;
    }
    const children = readChildrenFromXml(el);
    const surface = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    const input = dateGlossInputFromParts(attrs, children, surface);
    hits.push({
      index: hits.length,
      surface,
      input,
      gloss: formatDateGlossPlain(
        input,
        lang,
        getDateWesternDisplayMode(),
        getDateMonthSpanStyle(),
      ),
    });
  }
  return hits;
};

/**
 * Replace every `<date>…</date>` in the source unit with a bare `{{date:N}}`
 * text node (document order). The model then has no Chinese date prose to
 * paraphrase — it can only copy the placeholder through.
 *
 * Returns the rewritten XML, or the original string if parsing fails / no dates.
 */
export const replaceDatesWithPlaceholdersInSourceXml = (sourceUnitXml: string): string => {
  if (!sourceUnitXml.trim() || !sourceUnitXml.includes('<date')) return sourceUnitXml;
  const doc = new DOMParser().parseFromString(sourceUnitXml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return sourceUnitXml;

  const dates = Array.from(doc.getElementsByTagName('date'));
  if (dates.length === 0) return sourceUnitXml;

  dates.forEach((el, index) => {
    const placeholder = doc.createTextNode(`{{date:${index}}}`);
    el.parentNode?.replaceChild(placeholder, el);
  });

  // serializeToString on the document element keeps the unit root (p/div).
  const root = doc.documentElement;
  if (!root) return sourceUnitXml;
  return new XMLSerializer().serializeToString(root);
};
