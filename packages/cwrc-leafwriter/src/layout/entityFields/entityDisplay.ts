import type { EntityDates, EntitySummary } from './entitySummary';
import { ENGLISH_DEFAULTS, type DateFormatSettings } from './dateFormatSettings';

export type DisplayFormatOverride =
  | 'family_only'
  | 'given_only'
  | 'full'
  | 'full_chinese'
  | 'full_date'
  | 'title_only'
  | 'author_only';

export type EntityPartId = 'family' | 'given' | 'chinese' | 'dates';

/**
 * Persisted recipe for one entity mention; part *values* always refresh from the DB.
 * Name order is always family → given (romanized Chinese convention).
 */
export interface EntityDisplaySpec {
  /** Parts the user hid — remain hidden even when the mention becomes first. */
  hidden: EntityPartId[];
  /** At most one part wrapped in square brackets […]. */
  bracketsAround: EntityPartId | null;
  /** Append ’s after the last visible of {family, given}. */
  possessive: boolean;
}

export const EMPTY_DISPLAY_SPEC: EntityDisplaySpec = {
  hidden: [],
  bracketsAround: null,
  possessive: false,
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

const PART_IDS: EntityPartId[] = ['family', 'given', 'chinese', 'dates'];

const isRomanizationLang = (lang: string | null): boolean => (lang ?? '').endsWith('-Latn');

/** True when the string is primarily CJK characters (not a Latin romanization). */
const isMostlyCjk = (text: string): boolean => /[\u3400-\u9FFF]/.test(text);

const shortNameOf = (entity: EntitySummary): string =>
  entity.romanizedName ?? entity.primaryName ?? entity.names[0]?.text ?? '[Unknown entity]';

export const chineseNameOf = (entity: EntitySummary): string | null =>
  entity.names.find((n) => (n.lang ?? '').startsWith('zh') && !isRomanizationLang(n.lang))
    ?.text ?? null;

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
  const latinFamily =
    storedFamily && !isMostlyCjk(storedFamily) ? storedFamily : null;

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

/** Parses LJB's stored `DatePrecision` string (entityOps.ts) into a base marker + circa flag. */
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
 */
export const formatDates = (
  dates: EntityDates | null,
  settings: DateFormatSettings = ENGLISH_DEFAULTS,
): string | null => {
  if (!dates) return null;
  const { startYear, endYear, startPrecision, endPrecision } = dates;
  if (startYear != null && endYear != null) {
    return `${formatYearValue(startYear, settings)}–${formatYearValue(endYear, settings)}`;
  }
  if (startYear != null) {
    const prefix = localizePrecision(startPrecision, 'b', settings);
    return `${prefix} ${formatYearValue(startYear, settings)}`;
  }
  if (endYear != null) {
    const prefix = localizePrecision(endPrecision, 'd', settings);
    return `${prefix} ${formatYearValue(endYear, settings)}`;
  }
  return null;
};

export const isEmptyDisplaySpec = (spec: EntityDisplaySpec): boolean =>
  spec.hidden.length === 0 && spec.bracketsAround === null && !spec.possessive;

export const parseDisplaySpec = (raw: string | null | undefined): EntityDisplaySpec | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<EntityDisplaySpec> & { nameOrder?: string };
    if (!parsed || typeof parsed !== 'object') return null;
    const hidden = Array.isArray(parsed.hidden)
      ? parsed.hidden.filter((id): id is EntityPartId => PART_IDS.includes(id as EntityPartId))
      : [];
    const bracketsAround =
      parsed.bracketsAround && PART_IDS.includes(parsed.bracketsAround as EntityPartId)
        ? (parsed.bracketsAround as EntityPartId)
        : null;
    return {
      hidden,
      bracketsAround,
      possessive: Boolean(parsed.possessive),
    };
  } catch {
    return null;
  }
};

export const serializeDisplaySpec = (spec: EntityDisplaySpec): string | null => {
  if (isEmptyDisplaySpec(spec)) return null;
  return JSON.stringify({
    hidden: spec.hidden,
    bracketsAround: spec.bracketsAround,
    possessive: spec.possessive,
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

const partValue = (
  id: EntityPartId,
  entity: EntitySummary,
  settings: DateFormatSettings,
): string | null => {
  const { family, given } = familyAndGivenOf(entity);
  switch (id) {
    case 'family':
      return family;
    case 'given':
      return given;
    case 'chinese': {
      const chinese = chineseNameOf(entity);
      const short = shortNameOf(entity);
      if (!chinese || chinese === short) return null;
      return chinese;
    }
    case 'dates':
      return formatDates(entity.dates, settings);
  }
};

/**
 * Base parts from occurrence, minus user-hidden parts, minus missing values.
 * First occurrence adds chinese + dates; later keeps family + given only.
 * Order is always family → given → chinese → dates.
 */
export const resolveEntityParts = (
  entity: EntitySummary,
  occurrenceIndex: number,
  spec: EntityDisplaySpec = EMPTY_DISPLAY_SPEC,
  settings: DateFormatSettings = ENGLISH_DEFAULTS,
): ResolvedEntityPart[] => {
  const hidden = new Set(spec.hidden);
  const first = occurrenceIndex <= 1;
  const baseIds: EntityPartId[] = first
    ? ['family', 'given', 'chinese', 'dates']
    : ['family', 'given'];

  const parts: ResolvedEntityPart[] = [];
  for (const id of baseIds) {
    if (hidden.has(id)) continue;
    const text = partValue(id, entity, settings);
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

/** Round parentheses for the dates part’s normal presentation. */
const wrapParenDates = (text: string): string => {
  if (text.startsWith('(') && text.endsWith(')')) return text;
  return `(${text})`;
};

/**
 * Compose visible parts with square brackets + language-aware possessive.
 * Dates render as `(…)` by default; if brackets are on dates, use `[…]` instead.
 */
export const renderEntityFromSpec = (
  entity: EntitySummary,
  occurrenceIndex: number,
  spec: EntityDisplaySpec = EMPTY_DISPLAY_SPEC,
  settings: DateFormatSettings = ENGLISH_DEFAULTS,
  lang?: string | null,
): string => {
  const parts = resolveEntityParts(entity, occurrenceIndex, spec, settings);
  if (parts.length === 0) return shortNameOf(entity);

  const possessiveStyle = possessiveStyleForLang(lang);
  const tokens: string[] = [];
  let possessiveApplied = false;

  parts.forEach((part, index) => {
    let text = part.text;
    if (part.id === 'dates') {
      text =
        spec.bracketsAround === 'dates' ? wrapSquareBrackets(text) : wrapParenDates(text);
    } else if (spec.bracketsAround === part.id) {
      text = wrapSquareBrackets(text);
    }

    const isNamePart = part.id === 'family' || part.id === 'given';
    const next = parts[index + 1];
    const nextIsName = next && (next.id === 'family' || next.id === 'given');
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
  if (
    isEmptyDisplaySpec(spec) &&
    !options.spec &&
    !options.legacyOverride
  ) {
    return renderEntityText(entity, occurrenceIndex, null, settings);
  }
  return renderEntityFromSpec(entity, occurrenceIndex, spec, settings);
};
