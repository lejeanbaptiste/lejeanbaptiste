import type { EntityDates, EntitySummary } from './entitySummary';
import {
  ENGLISH_DEFAULTS,
  titleConventionForLang,
  type DateFormatSettings,
  type TitleConvention,
} from './dateFormatSettings';

export type { TitleConvention } from './dateFormatSettings';

export type DisplayFormatOverride =
  | 'family_only'
  | 'given_only'
  | 'full'
  | 'full_chinese'
  | 'full_date'
  | 'title_only'
  | 'author_only';

export type EntityPartId =
  'family' | 'given' | 'name' | 'classification' | 'chinese' | 'original' | 'translation' | 'dates';

const ITALIC_WORK_TYPES = new Set(['book', 'painting']);
const QUOTED_WORK_TYPES = new Set(['chapter', 'poem']);

/** Scholarly default when a work has no explicit type. */
export const DEFAULT_WORK_TYPE = 'book';

/**
 * Citation styling for a work-kind mention, derived from `workType`.
 * Book/painting are italicized (a data attribute, applied by CSS — see
 * `translationEntityFields.ts`); chapter/poem get literal curly quotes around
 * the rendered text; object gets neither. Unset/`null` defaults to book.
 */
export const workTypeStyle = (entity: EntitySummary): 'italic' | 'quote' | null => {
  if (entity.kind !== 'work') return null;
  const type = entity.workType || DEFAULT_WORK_TYPE;
  if (ITALIC_WORK_TYPES.has(type)) return 'italic';
  if (QUOTED_WORK_TYPES.has(type)) return 'quote';
  return null;
};

/**
 * Persisted recipe for one entity mention; part *values* always refresh from the DB.
 * Name order is always family → given (romanized Chinese convention).
 */
export interface EntityDisplaySpec {
  /** Parts the user hid — remain hidden even when the mention becomes first. */
  hidden: EntityPartId[];
  /**
   * Parts revealed on a 2nd+ mention beyond the short form (name / family+given).
   * First mentions ignore this — they use the full recipe minus `hidden`.
   * Optional for older saved specs that predate this field.
   */
  extraParts?: EntityPartId[];
  /** At most one part wrapped in square brackets […]. */
  bracketsAround: EntityPartId | null;
  /** Append ’s after the last visible name part ({family, given} for a person, else {name}). */
  possessive: boolean;
  /**
   * Per-mention title order. `null` inherits the language-bucket default from
   * translation policy (`titleConventionForLang`).
   */
  titleConvention: TitleConvention | null;
}

export const EMPTY_DISPLAY_SPEC: EntityDisplaySpec = {
  hidden: [],
  extraParts: [],
  bracketsAround: null,
  possessive: false,
  titleConvention: null,
};

/** How (or whether) to mark possession on a name mention for a target language. */
export type PossessiveStyle = 'none' | 'en-apostrophe-s' | 'de-genitive-s';

/**
 * English: ’s (’ alone after a final s).
 * German: genitive -s (apostrophe alone after s/ß/x/z).
 * French and other Romance targets: no clitic possessive — hide the control.
 */
export const possessiveStyleForLang = (lang: string | null | undefined): PossessiveStyle => {
  const code = (lang ?? '').trim().toLowerCase().split(/[-_]/)[0] ?? '';
  if (code === 'fr' || code === 'es' || code === 'pt' || code === 'it') return 'none';
  if (code === 'de') return 'de-genitive-s';
  if (code === 'en') return 'en-apostrophe-s';
  // Unknown / unset: keep English-style as a safe scholarly default.
  return code ? 'none' : 'en-apostrophe-s';
};

export const applyPossessiveSuffix = (nameText: string, style: PossessiveStyle): string => {
  if (style === 'none' || !nameText) return nameText;
  if (style === 'de-genitive-s') {
    // Duden: names ending in s, ss, ß, x, z, or -ce take only an apostrophe.
    if (/([sßxz]|ce)$/i.test(nameText)) return `${nameText}’`;
    return `${nameText}s`;
  }
  // English
  if (/s$/i.test(nameText)) return `${nameText}’`;
  return `${nameText}’s`;
};

export interface ResolvedEntityPart {
  id: EntityPartId;
  text: string;
}

const PART_IDS: EntityPartId[] = [
  'family',
  'given',
  'name',
  'classification',
  'chinese',
  'original',
  'translation',
  'dates',
];

const isRomanizationLang = (lang: string | null | undefined): boolean =>
  !!lang && /(^|-)Latn($|-)/i.test(lang);

/** True when the string is primarily CJK characters (not a Latin romanization). */
const isMostlyCjk = (text: string): boolean => /[\u3400-\u9FFF]/.test(text);

/** Latin letters without CJK — romanization text even when the language tag is wrong. */
const looksLikeRomanizationText = (text: string): boolean =>
  /[A-Za-z\u00C0-\u024F]/.test(text) && !isMostlyCjk(text);

const primaryLangSubtag = (lang: string | null | undefined): string =>
  (lang ?? '').trim().toLowerCase().split(/[-_]/)[0] ?? '';

/**
 * Resolve the romanized short form: stored field, then `romanization` type,
 * then `*-Latn` name, then Latin-script rows mis-tagged under Chinese/und.
 */
export const romanizedNameOf = (entity: EntitySummary): string | null => {
  if (entity.romanizedName?.trim()) return entity.romanizedName.trim();

  const byType = entity.names.find(
    (name) => name.type === 'romanization' && Boolean(name.text?.trim()),
  );
  if (byType?.text?.trim()) return byType.text.trim();

  const byLang = entity.names.find(
    (name) => isRomanizationLang(name.lang) && Boolean(name.text?.trim()),
  );
  if (byLang?.text?.trim()) return byLang.text.trim();

  const misTagged = entity.names.find((name) => {
    if (!name.text?.trim() || !looksLikeRomanizationText(name.text)) return false;
    const primary = primaryLangSubtag(name.lang);
    return !primary || primary === 'zh' || primary === 'und' || primary === 'lzh';
  });
  return misTagged?.text?.trim() || null;
};

export const shortNameOf = (entity: EntitySummary): string =>
  romanizedNameOf(entity) ?? entity.primaryName ?? entity.names[0]?.text ?? '[Unknown entity]';

export const chineseNameOf = (entity: EntitySummary): string | null =>
  entity.names.find((n) => (n.lang ?? '').startsWith('zh') && !isRomanizationLang(n.lang))?.text ??
  null;

const glossFromTable = (entity: EntitySummary, wanted: string): string | null => {
  const fromTable = (entity.translations ?? []).find(
    (entry) => Boolean(entry.text?.trim()) && primaryLangSubtag(entry.lang) === wanted,
  );
  if (fromTable?.text?.trim()) return fromTable.text.trim();

  const hit = entity.names.find((name) => {
    if (name.type !== 'translation' || !name.text?.trim()) return false;
    if (primaryLangSubtag(name.lang) !== wanted) return false;
    if (isRomanizationLang(name.lang)) return false;
    if (looksLikeRomanizationText(name.text)) {
      const primary = primaryLangSubtag(name.lang);
      if (!primary || primary === 'zh' || primary === 'und' || primary === 'lzh') return false;
    }
    return true;
  });
  return hit?.text?.trim() || null;
};

/**
 * Translated gloss for the target language, if any.
 * Prefers `entity.translations` (entity_translations table); falls back to
 * legacy `names` with type `translation`.
 *
 * For offices, when the pane language has no row, try English then French then
 * any stored gloss (Huckbot `en` / MaxiRicci `fr` are common). Other kinds stay
 * language-exact unless `{ allowFallback: true }` is passed. Pass
 * `{ allowFallback: false }` for “missing translation?” nudges.
 */
export const translatedNameOf = (
  entity: EntitySummary,
  lang?: string | null,
  options?: { allowFallback?: boolean },
): string | null => {
  const allowFallback =
    options?.allowFallback !== undefined ? options.allowFallback : entity.kind === 'office';
  const wanted = primaryLangSubtag(lang);
  if (wanted) {
    const exact = glossFromTable(entity, wanted);
    if (exact) return exact;
  }
  if (!allowFallback) return null;

  for (const fallback of ['en', 'fr']) {
    if (fallback === wanted) continue;
    const hit = glossFromTable(entity, fallback);
    if (hit) return hit;
  }

  const anyTable = (entity.translations ?? []).find((entry) => entry.text?.trim());
  if (anyTable?.text?.trim()) return anyTable.text.trim();

  const anyName = entity.names.find((name) => {
    if (name.type !== 'translation' || !name.text?.trim()) return false;
    if (isRomanizationLang(name.lang)) return false;
    return true;
  });
  return anyName?.text?.trim() || null;
};

/**
 * Vernacular glosses (`entity_translations`) are for titles and role/org
 * labels — not person or place names. Those use romanization (and person typed
 * name classes like 字/號), never an AI “English translation” of 姓名/地名.
 */
export const entityKindSupportsVernacularGloss = (kind: string | null | undefined): boolean =>
  Boolean(kind) && kind !== 'person' && kind !== 'place';

/**
 * Among `languageCodes` (e.g. project translation languages), return those
 * with no vernacular gloss yet. Empty / blank codes are skipped.
 */
export const missingTranslationLangs = (
  entity: Pick<EntitySummary, 'translations' | 'names'>,
  languageCodes: string[],
): string[] => {
  const seen = new Set<string>();
  const missing: string[] = [];
  for (const code of languageCodes) {
    const trimmed = code.trim();
    if (!trimmed) continue;
    const key = primaryLangSubtag(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (!translatedNameOf(entity as EntitySummary, trimmed, { allowFallback: false })) {
      missing.push(trimmed);
    }
  }
  return missing;
};

/**
 * Build a gloss-check shape from sidebar `nameEntries` (translations are merged
 * into names as type `translation` after migration 9).
 */
export const entityLikeFromNameEntries = (
  nameEntries: { text: string; lang?: string | null; type?: string | null }[],
): Pick<EntitySummary, 'translations' | 'names'> => ({
  translations: [],
  names: nameEntries.map((entry) => ({
    text: entry.text,
    lang: entry.lang ?? null,
    type: entry.type ?? null,
  })),
});

/**
 * Split the romanized short name into family + given.
 * Prefer a Latin `familyName` that prefixes the short name; otherwise split on the
 * first space (`Lu Shao` → Lu / Shao). Never treat a CJK `familyName` (陸) as the
 * romanized family part — that produced the bad preview `(陸) Lu Shao`.
 */
export const familyAndGivenOf = (
  entity: EntitySummary,
): { family: string | null; given: string | null } => {
  const short = shortNameOf(entity);
  const storedFamily = entity.familyName?.trim() || null;
  const latinFamily = storedFamily && !isMostlyCjk(storedFamily) ? storedFamily : null;

  if (latinFamily && short.startsWith(latinFamily)) {
    const rest = short.slice(latinFamily.length).trim();
    return { family: latinFamily, given: rest || null };
  }

  const space = short.indexOf(' ');
  if (space > 0) {
    return {
      family: short.slice(0, space),
      given: short.slice(space + 1).trim() || null,
    };
  }

  if (latinFamily) {
    return { family: latinFamily, given: short !== latinFamily ? short : null };
  }

  // Single token, no usable Latin family — show it as given so something remains.
  return { family: null, given: short };
};

type PrecisionBase = 'b' | 'd' | 'fl' | 'active' | 'active_to';

/** Parses Grognard's stored `DatePrecision` string (entityOps.ts) into a base marker + circa flag. */
const parsePrecision = (raw: string): { base: PrecisionBase; circa: boolean } | null => {
  switch (raw) {
    case 'b.':
      return { base: 'b', circa: false };
    case 'b. ca.':
      return { base: 'b', circa: true };
    case 'd.':
      return { base: 'd', circa: false };
    case 'd. ca.':
      return { base: 'd', circa: true };
    case 'fl.':
      return { base: 'fl', circa: false };
    case 'active':
      return { base: 'active', circa: false };
    case 'active ca.':
      return { base: 'active', circa: true };
    case 'active to':
      return { base: 'active_to', circa: false };
    case 'active to ca.':
      return { base: 'active_to', circa: true };
    default:
      return null;
  }
};

const wordForBase = (base: PrecisionBase, settings: DateFormatSettings): string => {
  switch (base) {
    case 'b':
      return settings.birthWord;
    case 'd':
      return settings.deathWord;
    case 'fl':
      return settings.floruitWord;
    case 'active':
      return settings.activeWord;
    case 'active_to':
      return settings.activeToWord;
  }
};

/** Localizes a stored precision marker; an unrecognized string is passed through rather than dropped. */
const localizePrecision = (
  raw: string | null,
  fallbackBase: PrecisionBase,
  settings: DateFormatSettings,
): string => {
  const parsed = raw ? parsePrecision(raw) : null;
  if (raw && !parsed) return raw;
  const { base, circa } = parsed ?? { base: fallbackBase, circa: false };
  const word = wordForBase(base, settings);
  return circa ? `${word} ${settings.circaWord}` : word;
};

/**
 * Stored years are astronomical (ISO 8601: year 0 = 1 BCE, year -1 = 2 BCE —
 * no year zero in traditional BC/BCE counting). `yearNumbering: 'historical'`
 * converts to the traditional off-by-one form; the BCE label can't be
 * omitted there without producing a misleadingly bare (and wrong-looking)
 * positive number, so it's always shown for that mode regardless of
 * `eraDisplay`. `eraDisplay` otherwise controls whether CE/BCE labels are
 * shown at all for astronomical (signed) numbering.
 */
const formatYearValue = (isoYear: number, settings: DateFormatSettings): string => {
  if (isoYear > 0) {
    return settings.eraDisplay === 'always' ? `${isoYear} ${settings.ceLabel}` : String(isoYear);
  }
  if (settings.yearNumbering === 'historical') {
    return `${1 - isoYear} ${settings.bceLabel}`;
  }
  const signed = `-${Math.abs(isoYear)}`;
  return settings.eraDisplay === 'none' ? signed : `${signed} ${settings.bceLabel}`;
};

/**
 * When only one side of a birth/death pair is known, this prepends a
 * localized marker (from the stored `precision` when set, else a default
 * `birthWord`/`deathWord`) so a death-only date doesn't show a bare,
 * ambiguous year. A full birth–death range needs no prefix.
 * Floruit (`fl.`) uses one prefix for the whole span: `fl. A–B` / `fl. A`.
 */
export const formatDates = (
  dates: EntityDates | null,
  settings: DateFormatSettings = ENGLISH_DEFAULTS,
  options: { neutral?: boolean } = {},
): string | null => {
  if (!dates) return null;
  const { startYear, endYear, startPrecision, endPrecision } = dates;
  const startParsed = startPrecision ? parsePrecision(startPrecision) : null;
  const endParsed = endPrecision ? parsePrecision(endPrecision) : null;
  const isFloruit = startParsed?.base === 'fl' || endParsed?.base === 'fl';
  if (isFloruit && (startYear != null || endYear != null)) {
    const word = settings.floruitWord;
    if (startYear != null && endYear != null && startYear !== endYear) {
      return `${word} ${formatYearValue(startYear, settings)}–${formatYearValue(endYear, settings)}`;
    }
    const year = startYear ?? endYear!;
    return `${word} ${formatYearValue(year, settings)}`;
  }
  if (startYear != null && endYear != null) {
    return `${formatYearValue(startYear, settings)}–${formatYearValue(endYear, settings)}`;
  }
  // `neutral`: we don't know whether a lone date is a birth/founding or a death/dissolution
  // (place/org/office have no such semantics today), so skip the b./d. word and just show
  // the year, keeping a circa marker if the stored precision carries one.
  if (startYear != null) {
    if (options.neutral) {
      const circa = startParsed?.circa ?? false;
      const year = formatYearValue(startYear, settings);
      return circa ? `${settings.circaWord} ${year}` : year;
    }
    const prefix = localizePrecision(startPrecision, 'b', settings);
    return `${prefix} ${formatYearValue(startYear, settings)}`;
  }
  if (endYear != null) {
    if (options.neutral) {
      const circa = endParsed?.circa ?? false;
      const year = formatYearValue(endYear, settings);
      return circa ? `${settings.circaWord} ${year}` : year;
    }
    const prefix = localizePrecision(endPrecision, 'd', settings);
    return `${prefix} ${formatYearValue(endYear, settings)}`;
  }
  return null;
};

export const isEmptyDisplaySpec = (spec: EntityDisplaySpec): boolean =>
  spec.hidden.length === 0 &&
  (spec.extraParts?.length ?? 0) === 0 &&
  spec.bracketsAround === null &&
  !spec.possessive &&
  spec.titleConvention == null;

export const parseDisplaySpec = (raw: string | null | undefined): EntityDisplaySpec | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<EntityDisplaySpec> & { nameOrder?: string };
    if (!parsed || typeof parsed !== 'object') return null;
    const hidden = Array.isArray(parsed.hidden)
      ? parsed.hidden.filter((id): id is EntityPartId => PART_IDS.includes(id as EntityPartId))
      : [];
    const extraParts = Array.isArray(parsed.extraParts)
      ? parsed.extraParts.filter((id): id is EntityPartId => PART_IDS.includes(id as EntityPartId))
      : [];
    const bracketsAround =
      parsed.bracketsAround && PART_IDS.includes(parsed.bracketsAround as EntityPartId)
        ? (parsed.bracketsAround as EntityPartId)
        : null;
    const titleConvention =
      parsed.titleConvention === 'romanization-first' ||
      parsed.titleConvention === 'translation-first'
        ? parsed.titleConvention
        : null;
    return {
      hidden,
      extraParts,
      bracketsAround,
      possessive: Boolean(parsed.possessive),
      titleConvention,
    };
  } catch {
    return null;
  }
};

export const serializeDisplaySpec = (spec: EntityDisplaySpec): string | null => {
  if (isEmptyDisplaySpec(spec)) return null;
  return JSON.stringify({
    hidden: spec.hidden,
    extraParts: spec.extraParts ?? [],
    bracketsAround: spec.bracketsAround,
    possessive: spec.possessive,
    titleConvention: spec.titleConvention,
  } satisfies EntityDisplaySpec);
};

/** Map coarse Word-style overrides into an equivalent compositional spec. */
export const displaySpecFromLegacyOverride = (
  override: DisplayFormatOverride | null,
): EntityDisplaySpec | null => {
  if (!override) return null;
  switch (override) {
    case 'family_only':
      return {
        ...EMPTY_DISPLAY_SPEC,
        hidden: ['given', 'chinese', 'dates'],
      };
    case 'given_only':
      return {
        ...EMPTY_DISPLAY_SPEC,
        hidden: ['family', 'chinese', 'dates'],
      };
    case 'full':
    case 'title_only':
    case 'author_only':
      return {
        ...EMPTY_DISPLAY_SPEC,
        hidden: ['chinese', 'dates'],
      };
    case 'full_chinese':
      return {
        ...EMPTY_DISPLAY_SPEC,
        hidden: ['dates'],
      };
    case 'full_date':
      return {
        ...EMPTY_DISPLAY_SPEC,
        hidden: ['chinese'],
      };
    default:
      return null;
  }
};

/**
 * Effective title order: explicit mention override, else kind/language default.
 * Offices default to translation-first whenever a gloss exists (see
 * `resolveEntityParts`); other kinds use the language-bucket setting.
 */
export const effectiveTitleConvention = (
  spec: EntityDisplaySpec,
  lang?: string | null,
  kind?: string | null,
): TitleConvention => {
  if (spec.titleConvention) return spec.titleConvention;
  if (kind === 'office') return 'translation-first';
  return titleConventionForLang(lang);
};

/** Offices with a gloss default to the vernacular alone (no pinyin / characters). */
export const officeUsesTranslationOnly = (
  entity: EntitySummary,
  spec: EntityDisplaySpec,
  lang?: string | null,
): boolean =>
  entity.kind === 'office' &&
  Boolean(translatedNameOf(entity, lang)) &&
  spec.titleConvention !== 'romanization-first';

/**
 * Romanization + Chinese bundled for translation-first parenthetical:
 * "Jinshu 晉書" (omit either half when missing or identical).
 */
const originalFormsText = (entity: EntitySummary): string | null => {
  const short = shortNameOf(entity);
  const chinese = chineseNameOf(entity);
  if (chinese && chinese !== short) {
    const bits = [short !== '[Unknown entity]' ? short : null, chinese].filter(Boolean);
    return bits.length ? bits.join(' ') : null;
  }
  return short !== '[Unknown entity]' ? short : null;
};

const partValue = (
  id: EntityPartId,
  entity: EntitySummary,
  settings: DateFormatSettings,
  lang?: string | null,
): string | null => {
  switch (id) {
    case 'family':
      return familyAndGivenOf(entity).family;
    case 'given':
      return familyAndGivenOf(entity).given;
    case 'name':
      return shortNameOf(entity);
    case 'classification':
      return entity.classification;
    case 'chinese': {
      const chinese = chineseNameOf(entity);
      const short = shortNameOf(entity);
      if (!chinese || chinese === short) return null;
      return chinese;
    }
    case 'original':
      return originalFormsText(entity);
    case 'translation': {
      const gloss = translatedNameOf(entity, lang);
      if (!gloss) return null;
      // Don't repeat the gloss if it already is the displayed short name.
      if (gloss === shortNameOf(entity) || gloss === chineseNameOf(entity)) return null;
      return gloss;
    }
    case 'dates':
      // Only 'person' has real birth/death semantics; every other kind gets a
      // bare year (no b./d. word) since we don't know what a lone date means for it.
      return formatDates(entity.dates, settings, { neutral: entity.kind !== 'person' });
  }
};

/**
 * Parts not in the short form (until added to `spec.extraParts`).
 * Used by the format popup so chips reflect what is actually visible.
 * For offices with a gloss, the short form is the translation alone.
 */
export const shortFormOptionalParts = (
  entity: EntitySummary,
  lang?: string | null,
): EntityPartId[] => {
  if (entity.kind === 'office' && translatedNameOf(entity, lang)) {
    return ['name', 'classification', 'chinese', 'original', 'dates'];
  }
  if (entity.kind === 'person') {
    return ['chinese', 'translation', 'dates', 'original', 'classification'];
  }
  return ['classification', 'chinese', 'translation', 'dates', 'original'];
};

/**
 * Whether a part is currently shown for this mention (chip filled vs outlined).
 * Later mentions: short-form cores are shown; optional parts need `extraParts`.
 * Offices with a gloss use translation as the core on every mention.
 */
export const isEntityPartShown = (
  entity: EntitySummary,
  occurrenceIndex: number,
  spec: EntityDisplaySpec,
  id: EntityPartId,
  lang?: string | null,
): boolean => {
  if (spec.hidden.includes(id)) return false;
  if (officeUsesTranslationOnly(entity, spec, lang)) {
    if (id === 'translation') return true;
    return (spec.extraParts ?? []).includes(id);
  }
  if (occurrenceIndex <= 1) return true;
  const shortCore = entity.kind === 'person' ? id === 'family' || id === 'given' : id === 'name';
  if (shortCore) return true;
  return (spec.extraParts ?? []).includes(id);
};

/**
 * Base parts from occurrence, minus user-hidden parts, minus missing values.
 *
 * Romanization-first (default for most kinds): _Jinshu_ 晉書 (Livre des Jin)
 * Translation-first (when a gloss exists): _Livre des Jin_ (Jinshu 晉書)
 * Offices with a gloss: vernacular only — no pinyin, characters, or parentheses
 * (unless the mention forces romanization-first or the user reveals extras).
 * Without a gloss, always romanization-first regardless of settings.
 *
 * Later mentions default to the short form; optional parts listed in
 * `spec.extraParts` can be revealed from the format popup.
 */
export const resolveEntityParts = (
  entity: EntitySummary,
  occurrenceIndex: number,
  spec: EntityDisplaySpec = EMPTY_DISPLAY_SPEC,
  settings: DateFormatSettings = ENGLISH_DEFAULTS,
  lang?: string | null,
): ResolvedEntityPart[] => {
  const hidden = new Set(spec.hidden);
  const first = occurrenceIndex <= 1;
  const isPerson = entity.kind === 'person';
  const hasDates = entity.kind === 'person' || entity.kind === 'work';
  const glossText = translatedNameOf(entity, lang);
  const gloss = glossText ? (partValue('translation', entity, settings, lang) ?? glossText) : null;
  const convention =
    first && gloss && effectiveTitleConvention(spec, lang, entity.kind) === 'translation-first'
      ? 'translation-first'
      : 'romanization-first';

  let baseIds: EntityPartId[];
  if (officeUsesTranslationOnly(entity, spec, lang) && gloss) {
    // Translation alone by default; extras (pinyin, characters, …) via popup.
    const extras = (spec.extraParts ?? []).filter((id) =>
      shortFormOptionalParts(entity, lang).includes(id),
    );
    baseIds = ['translation', ...extras];
  } else if (!first) {
    const shortIds: EntityPartId[] = isPerson ? ['family', 'given'] : ['name'];
    const extras = (spec.extraParts ?? []).filter(
      (id) => !shortIds.includes(id) && shortFormOptionalParts(entity, lang).includes(id),
    );
    baseIds = [...shortIds, ...extras];
  } else if (convention === 'translation-first') {
    baseIds = isPerson
      ? (['translation', 'original', 'dates'] as EntityPartId[])
      : (['translation', 'original', 'classification'] as EntityPartId[]).concat(
          hasDates ? ['dates'] : [],
        );
  } else {
    baseIds = isPerson
      ? ['family', 'given', 'chinese', 'translation', 'dates']
      : (['name', 'classification', 'chinese', 'translation'] as EntityPartId[]).concat(
          hasDates ? ['dates'] : [],
        );
  }

  const parts: ResolvedEntityPart[] = [];
  for (const id of baseIds) {
    if (hidden.has(id)) continue;
    // Offices may use the gloss even when it matches the short name (English primary).
    const text =
      id === 'translation' && entity.kind === 'office' && glossText
        ? glossText
        : partValue(id, entity, settings, lang);
    if (!text) continue;
    parts.push({ id, text });
  }
  return parts;
};

/** Square brackets for clarifying inserted text (e.g. family name). */
const wrapSquareBrackets = (text: string): string => {
  if (text.startsWith('[') && text.endsWith(']')) return text;
  return `[${text}]`;
};

/** Round parentheses for dates / gloss / original-forms. */
const wrapParenDates = (text: string): string => {
  if (text.startsWith('(') && text.endsWith(')')) return text;
  return `(${text})`;
};

const isParenPart = (id: EntityPartId): boolean =>
  id === 'dates' || id === 'translation' || id === 'original';

const isNamePartId = (id: EntityPartId): boolean =>
  id === 'family' || id === 'given' || id === 'name' || id === 'translation';

/**
 * Compose visible parts with square brackets + language-aware possessive.
 * Dates, translation glosses (romanization-first), and original forms
 * (translation-first) render as `(…)`; if brackets are on that part, use `[…]`.
 * Leading translation under translation-first is not parenthesized.
 */
export const renderEntityFromSpec = (
  entity: EntitySummary,
  occurrenceIndex: number,
  spec: EntityDisplaySpec = EMPTY_DISPLAY_SPEC,
  settings: DateFormatSettings = ENGLISH_DEFAULTS,
  lang?: string | null,
): string => {
  const parts = resolveEntityParts(entity, occurrenceIndex, spec, settings, lang);
  if (parts.length === 0) return shortNameOf(entity);

  const possessiveStyle = possessiveStyleForLang(lang);
  const tokens: string[] = [];
  let possessiveApplied = false;
  const convention =
    parts[0]?.id === 'translation' &&
    (officeUsesTranslationOnly(entity, spec, lang) ||
      effectiveTitleConvention(spec, lang, entity.kind) === 'translation-first')
      ? 'translation-first'
      : 'romanization-first';

  parts.forEach((part, index) => {
    let text = part.text;
    const leadTranslation = convention === 'translation-first' && part.id === 'translation';
    if (isParenPart(part.id) && !leadTranslation) {
      text = spec.bracketsAround === part.id ? wrapSquareBrackets(text) : wrapParenDates(text);
    } else if (spec.bracketsAround === part.id) {
      text = wrapSquareBrackets(text);
    }

    const isNamePart = isNamePartId(part.id) && !(part.id === 'translation' && !leadTranslation);
    const next = parts[index + 1];
    const nextIsName =
      next &&
      isNamePartId(next.id) &&
      !(convention === 'translation-first' && next.id === 'translation' && index > 0);
    if (
      spec.possessive &&
      possessiveStyle !== 'none' &&
      isNamePart &&
      !nextIsName &&
      !possessiveApplied
    ) {
      text = applyPossessiveSuffix(text, possessiveStyle);
      possessiveApplied = true;
    }

    tokens.push(text);
  });

  return tokens.join(' ');
};

/** First-occurrence default: short name + Chinese (if distinct) + dates. */
const fullDefaultText = (entity: EntitySummary, settings: DateFormatSettings): string =>
  renderEntityFromSpec(entity, 1, EMPTY_DISPLAY_SPEC, settings);

/**
 * Renders the text for one entity mention. `occurrenceIndex` is always
 * recomputed from document order (never persisted).
 *
 * Prefer `renderEntityFromSpec` for new compositional formatting. This keeps
 * the coarse Word-style overrides for backward compatibility.
 */
export const renderEntityText = (
  entity: EntitySummary,
  occurrenceIndex: number,
  override: DisplayFormatOverride | null,
  settings: DateFormatSettings = ENGLISH_DEFAULTS,
): string => {
  const short = shortNameOf(entity);
  const fromLegacy = displaySpecFromLegacyOverride(override);
  if (fromLegacy) return renderEntityFromSpec(entity, occurrenceIndex, fromLegacy, settings);

  switch (override) {
    case null:
    case undefined:
      return occurrenceIndex <= 1 ? fullDefaultText(entity, settings) : short;
    default:
      return short;
  }
};

/** Unified entry used by translation fields: spec wins; else legacy override; else defaults. */
export const renderEntityMention = (
  entity: EntitySummary,
  occurrenceIndex: number,
  options: {
    spec?: EntityDisplaySpec | null;
    legacyOverride?: DisplayFormatOverride | null;
    settings?: DateFormatSettings;
  } = {},
): string => {
  const settings = options.settings ?? ENGLISH_DEFAULTS;
  const spec =
    options.spec ??
    displaySpecFromLegacyOverride(options.legacyOverride ?? null) ??
    EMPTY_DISPLAY_SPEC;
  // Empty spec + no legacy → same as renderEntityText(null): first gets full, later short.
  // Using renderEntityFromSpec for empty spec already matches first/later part sets.
  if (isEmptyDisplaySpec(spec) && !options.spec && !options.legacyOverride) {
    return renderEntityText(entity, occurrenceIndex, null, settings);
  }
  return renderEntityFromSpec(entity, occurrenceIndex, spec, settings);
};
