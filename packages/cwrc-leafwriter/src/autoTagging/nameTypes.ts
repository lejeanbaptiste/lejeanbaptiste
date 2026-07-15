/**
 * Canonical name-type vocabulary for entity names, with a concordance from
 * authority-specific vocabularies (Wikidata name properties, CJK category
 * labels used by CBDB/DILA exports). Name types classify why an entity bears
 * a given name (courtesy name, posthumous name, …) so downstream consumers —
 * most importantly corpus auto-tagging — can exclude risky classes (a courtesy
 * name like 平子 is a common word and produces nonsense tags).
 */

export type NameTypeId =
  | 'primary' // canonical name
  | 'courtesy' // 字 zi
  | 'art' // 號 hao / art name
  | 'posthumous' // 諡號
  | 'temple' // 廟號
  | 'dharma' // religious/dharma name
  | 'pen' // pen name / pseudonym
  | 'variant'; // unclassified alternate (legacy searchStrings, surface forms)

export const ALL_NAME_TYPES: NameTypeId[] = [
  'primary',
  'courtesy',
  'art',
  'posthumous',
  'temple',
  'dharma',
  'pen',
  'variant',
];

/** Default set excluded from corpus tagging (user-overridable via settings). */
export const DEFAULT_UNTAGGABLE_TYPES: NameTypeId[] = ['courtesy'];

/**
 * True when a name of this type may seed corpus auto-tagging. Untyped names
 * (`null` — legacy records) stay taggable: they were already in use before
 * types existed.
 */
export function isTaggableNameType(
  type: NameTypeId | null,
  excluded: NameTypeId[] = DEFAULT_UNTAGGABLE_TYPES,
): boolean {
  if (type === null) return true;
  return !excluded.includes(type);
}

/** Wikidata name-property → canonical name type. */
export const WIKIDATA_PROP_TO_NAME_TYPE: Record<string, NameTypeId> = {
  P1559: 'primary', // name in native language
  P1782: 'courtesy', // courtesy name (字)
  P1787: 'art', // art name (號)
  P1786: 'posthumous', // posthumous name (諡號)
  P1785: 'temple', // temple name (廟號)
  P742: 'pen', // pseudonym
  P1449: 'variant', // nickname
};

/**
 * CJK category labels (as used in CBDB/DILA exports and Chinese biographical
 * convention) → canonical name type.
 */
export const CJK_LABEL_TO_NAME_TYPE: Record<string, NameTypeId> = {
  字: 'courtesy',
  表字: 'courtesy',
  號: 'art',
  号: 'art',
  別號: 'art',
  别号: 'art',
  諡號: 'posthumous',
  謚號: 'posthumous',
  谥号: 'posthumous',
  廟號: 'temple',
  庙号: 'temple',
  法名: 'dharma',
  法號: 'dharma',
  法号: 'dharma',
  筆名: 'pen',
  笔名: 'pen',
};

const CANONICAL_IDS = new Set<string>(ALL_NAME_TYPES);

/**
 * Normalize an authority-provided name-type marker to a canonical id: accepts
 * canonical ids as-is, Wikidata property ids, and CJK category labels.
 * Unknown/empty markers → null (caller decides between `variant` and no type).
 */
export function normalizeNameType(raw: string | null | undefined): NameTypeId | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (CANONICAL_IDS.has(trimmed)) return trimmed as NameTypeId;
  const byProp = WIKIDATA_PROP_TO_NAME_TYPE[trimmed.toUpperCase()];
  if (byProp) return byProp;
  return CJK_LABEL_TO_NAME_TYPE[trimmed] ?? null;
}
