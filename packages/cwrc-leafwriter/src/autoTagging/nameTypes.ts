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
  | 'birth' // name given at birth (may differ from courtesy/art/canonical name)
  | 'family' // surname / 姓
  | 'given' // given name / 名
  | 'courtesy' // 字 zi
  | 'art' // 號 hao / art name
  | 'posthumous' // 諡號
  | 'temple' // 廟號
  | 'dharma' // religious/dharma name
  | 'pen' // pen name / pseudonym
  | 'translation' // translated title/label
  | 'variant'; // unclassified alternate (legacy searchStrings, surface forms)

export const ALL_NAME_TYPES: NameTypeId[] = [
  'primary',
  'birth',
  'family',
  'given',
  'courtesy',
  'art',
  'posthumous',
  'temple',
  'dharma',
  'pen',
  'translation',
  'variant',
];

/** Default set excluded from corpus tagging (user-overridable via settings). */
export const DEFAULT_UNTAGGABLE_TYPES: NameTypeId[] = ['courtesy', 'family', 'given'];

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
  P1477: 'birth', // birth name
  P734: 'family', // family name / surname
  P735: 'given', // given name
  P1782: 'courtesy', // courtesy name (字)
  P1787: 'art', // art name (號)
  P1786: 'posthumous', // posthumous name (諡號)
  P1785: 'temple', // temple name (廟號)
  P742: 'pen', // pseudonym
  P1449: 'variant', // nickname
  P1813: 'variant', // short name
};

/**
 * CJK category labels (as used in CBDB/DILA exports and Chinese biographical
 * convention) → canonical name type.
 */
export const CJK_LABEL_TO_NAME_TYPE: Record<string, NameTypeId> = {
  本名: 'birth',
  原名: 'birth',
  姓: 'family',
  姓氏: 'family',
  名: 'given',
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

/** Name types that often appear as 姓+bare-form display composites in authority exports. */
export const FAMILY_PREFIX_STRIP_TYPES: ReadonlySet<NameTypeId> = new Set([
  'courtesy',
  'art',
  'dharma',
]);

/**
 * Authority exports sometimes represent a courtesy/art/dharma name twice: once
 * as the bare form and once as family name + bare form. The composite is a
 * display form; strip the longest matching family prefix so intake keeps the
 * bare 字/號/法號 (and later dedupe collapses 蕭彦学 + 彦学 → 彦学).
 */
export function isFamilyPrefixedCourtesyName(text: string, familyNames: string[]): boolean {
  return stripFamilyPrefixFromCourtesyName(text, familyNames) !== text.normalize('NFC').trim();
}

/**
 * If `text` begins with a known family name and has more characters after it,
 * return the remainder (bare 字/號/法號). Otherwise return the trimmed text unchanged.
 * Prefers the longest matching family prefix (e.g. 司馬 over 司).
 */
export function stripFamilyPrefixFromCourtesyName(text: string, familyNames: string[]): string {
  const normalizedText = text.normalize('NFC').trim();
  if (!normalizedText) return normalizedText;
  let bestPrefix = '';
  for (const familyName of familyNames) {
    const normalizedFamily = familyName.normalize('NFC').trim();
    if (
      normalizedFamily.length > bestPrefix.length &&
      normalizedText.length > normalizedFamily.length &&
      normalizedText.startsWith(normalizedFamily)
    ) {
      bestPrefix = normalizedFamily;
    }
  }
  return bestPrefix ? normalizedText.slice(bestPrefix.length) : normalizedText;
}

export type IntakeTypedName = {
  text: string;
  type: NameTypeId;
  lang?: string;
};

/**
 * Normalize typed names for entity intake: strip 姓 from courtesy/art/dharma
 * composites, then dedupe by NFC text so bare and composite forms collapse.
 */
export function normalizeTypedNamesForIntake(
  names: Array<{ text: string; type: NameTypeId; lang?: string }>,
  extraFamilyNames: string[] = [],
): IntakeTypedName[] {
  const familyNames = [
    ...extraFamilyNames,
    ...names.filter((name) => name.type === 'family').map((name) => name.text),
  ]
    .map((name) => name.normalize('NFC').trim())
    .filter(Boolean);

  const byText = new Map<string, IntakeTypedName>();
  for (const name of names) {
    let text = name.text.normalize('NFC').trim();
    if (!text) continue;
    // Dump placeholder — never keep as a typed name in any language.
    if (/^nan$/i.test(text)) continue;
    if (FAMILY_PREFIX_STRIP_TYPES.has(name.type)) {
      text = stripFamilyPrefixFromCourtesyName(text, familyNames);
      if (!text) continue;
    }
    if (!byText.has(text)) {
      byText.set(text, { text, type: name.type, ...(name.lang ? { lang: name.lang } : {}) });
    }
  }
  return [...byText.values()];
}

/**
 * Pick the 姓/名 pair that best explains a primary headword when an authority
 * lists several family or given variants (e.g. 拓拔 / 托跋 / 元 for 拓拔建).
 * Prefers the longest family that prefixes the primary, then a given that
 * matches the remainder (or the first given if none fit).
 */
export function preferCanonicalFamilyGiven(
  primaryName: string | null | undefined,
  typedNames: Array<{ text: string; type: NameTypeId }>,
): { familyName: string | null; givenName: string | null } {
  const primary = primaryName?.normalize('NFC').trim() || '';
  const families = typedNames
    .filter((name) => name.type === 'family')
    .map((name) => name.text.normalize('NFC').trim())
    .filter(Boolean);
  const givens = typedNames
    .filter((name) => name.type === 'given')
    .map((name) => name.text.normalize('NFC').trim())
    .filter(Boolean);

  let familyName: string | null = families[0] ?? null;
  if (primary && families.length) {
    const prefixHits = families
      .filter((family) => primary.startsWith(family) && primary.length > family.length)
      .sort((a, b) => b.length - a.length || a.localeCompare(b, 'zh'));
    if (prefixHits[0]) familyName = prefixHits[0];
  }

  let givenName: string | null = givens[0] ?? null;
  if (primary && familyName && givens.length) {
    const remainder = primary.slice(familyName.length);
    const exact = givens.find((given) => given === remainder);
    if (exact) givenName = exact;
    else if (primary.startsWith(familyName) && remainder) {
      // Headword is prefixed by this family but remainder is not a pack given —
      // do not invent a 名 (common with noble-title headwords).
      givenName = null;
    }
  }

  return { familyName, givenName };
}
