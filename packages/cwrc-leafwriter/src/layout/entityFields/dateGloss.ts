/**
 * LJBtero vernacular glosses for Sanmiao / East Asian `<date>` spans.
 *
 * Conventions (English skeleton; French mirrors the same slot order):
 * - Translate as written — no prior-context expansion.
 * - No leading In/On (En/Le) — the translator or AI supplies temporal
 *   prepositions (by, until, before, in, on, …); a post-pass only corrects
 *   in↔on / en↔le to match day vs year/month granularity.
 * - Dynasty: directional prefixes (Southern/Northern/…) + concatenated pinyin stem.
 * - Ruler: always "Emperor {Pinyin}" / French "l’empereur {Pinyin}".
 * - Era: "{Pinyin} era" / French "l’ère {Pinyin}".
 * - Year: "year N" / French "l’an N".
 * - Season: spring / summer / autumn / winter (春夏秋冬) when a `<season>` child is present.
 * - Months: Roman numerals; intercalary → "intercalary month I".
 * - Ganzhi: concatenated toneless pinyin, italicised by the field renderer.
 * - 朔 → "new moon"; 晦 → "new moon eve".
 * - As-written gloss uses tag *children* only (e.g. 六月壬子 → month VI, day renzi).
 * - Optional brackets can show the full interpolated calendar from attributes
 *   (era … day/gz; no dynasty/emperor) — see scholarly `dateShowAttrBrackets`.
 * - Western date from Sanmiao `@when` when day-level and YYYY-MM-DD is present.
 *   Display mode (translation+western / translation / western) is a scholarly
 *   convention preference — see {@link DateWesternDisplayMode}.
 * - Month-only Sanmiao spans (`notBefore`/`notAfter`) can show Western conversion
 *   when the display mode includes conversion — see {@link DateMonthSpanStyle}.
 * - No trailing punctuation — the translator decides.
 */

import {
  parseChineseNumeral,
  sexagenaryIndexToName,
  sexagenaryToPinyin,
} from '../../dateAuthority/chineseNumerals';
import { peekDateAuthorityCache } from '../../dateAuthority/useDateAuthority';
import { autoRomanize } from '../../utilities/romanize';

export type DateGlossLang = 'en' | 'fr';

/**
 * How a resolved Western `@when` appears beside (or instead of) the East Asian gloss.
 * - `translation+western` — EA gloss + `(15 February 481)` (default)
 * - `translation` — EA gloss only
 * - `western` — `[15 February 481]` only (square brackets)
 */
export type DateWesternDisplayMode = 'translation+western' | 'translation' | 'western';

export const DEFAULT_DATE_WESTERN_DISPLAY: DateWesternDisplayMode = 'translation+western';

export const DATE_WESTERN_DISPLAY_MODES: readonly DateWesternDisplayMode[] = [
  'translation+western',
  'translation',
  'western',
] as const;

export const isDateWesternDisplayMode = (value: unknown): value is DateWesternDisplayMode =>
  value === 'translation+western' || value === 'translation' || value === 'western';

/**
 * How a month-only Sanmiao span (`notBefore`–`notAfter`) is rendered when conversion
 * is shown (i.e. display mode is not `translation`).
 * - `months` — `January–February 187` / `janvier–février 187` (default)
 * - `full` — `2 January–1 February 187` / `2 janvier–1 février 187`
 */
export type DateMonthSpanStyle = 'months' | 'full';

export const DEFAULT_DATE_MONTH_SPAN_STYLE: DateMonthSpanStyle = 'months';

export const DATE_MONTH_SPAN_STYLES: readonly DateMonthSpanStyle[] = ['months', 'full'] as const;

export const isDateMonthSpanStyle = (value: unknown): value is DateMonthSpanStyle =>
  value === 'months' || value === 'full';


/**
 * Calendar slots used for the as-written gloss and for attribute brackets.
 * Brackets never include dynasty / emperor.
 */
export interface DateGlossCalendarParts {
  /** Era / 年號 (e.g. 建元). */
  era?: string | null;
  /** Year number or expression (3, 元年, 三年). */
  year?: string | number | null;
  /** Season as written (春夏秋冬). */
  season?: string | null;
  /** Month number or expression. */
  month?: string | number | null;
  /** True when 閏 / intercalary=1. */
  intercalary?: boolean | null;
  /** Day-of-month number or expression. */
  day?: string | number | null;
  /** Day 干支 (甲子 or index 1–60). */
  gz?: string | null;
  /** New-moon 干支 (nmdgz). */
  nmdGz?: string | null;
  /** Lunar phase: 朔 / 晦, or attr 0 / -1. */
  lp?: string | null;
}

/**
 * Structured fields extracted from a Sanmiao `<date>`.
 * Top-level calendar slots are the as-written gloss (tag children).
 * `attrs` holds the full interpolated calendar for optional brackets.
 */
export interface DateGlossInput extends DateGlossCalendarParts {
  /** Dynasty label as written (e.g. 南齊). */
  dyn?: string | null;
  /** Ruler / temple name as written (e.g. 太祖). */
  ruler?: string | null;
  /**
   * Full interpolated calendar from Sanmiao attributes (+ era from child or
   * `era_id` lookup). Used only when the Dates setting shows attribute brackets.
   * Never includes dynasty / emperor.
   */
  attrs?: DateGlossCalendarParts | null;
  /** Sanmiao ISO `@when` (e.g. 0481-02-15). */
  when?: string | null;
  /** Month-only span start (Sanmiao `notBefore`, e.g. 0213-03-10). */
  notBefore?: string | null;
  /** Month-only span end (Sanmiao `notAfter`, e.g. 0213-04-07). */
  notAfter?: string | null;
  /** Fallback plain surface when structure is missing. */
  surface?: string | null;
}

/** One render token — ganzhi runs are italicised by the date field builder. */
export type DateGlossToken =
  | { kind: 'text'; text: string }
  | { kind: 'ganzhi'; text: string };

const ROMAN_MONTHS = [
  '',
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'XIII',
] as const;

const DYNASTY_DIRECTION: Record<string, { en: string; fr: string }> = {
  南: { en: 'Southern', fr: 'Sud' },
  北: { en: 'Northern', fr: 'Nord' },
  東: { en: 'Eastern', fr: 'Est' },
  东: { en: 'Eastern', fr: 'Est' },
  西: { en: 'Western', fr: 'Ouest' },
  前: { en: 'Former', fr: 'Antérieur' },
  後: { en: 'Later', fr: 'Postérieur' },
  后: { en: 'Later', fr: 'Postérieur' },
};

const EN_MONTHS = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const FR_MONTHS = [
  '',
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export const dateGlossLang = (lang: string | null | undefined): DateGlossLang => {
  const code = (lang ?? '').trim().toLowerCase();
  if (code === 'fr' || code.startsWith('fr-') || code.startsWith('fr_')) return 'fr';
  return 'en';
};

const parseIntish = (value: string | number | null | undefined): number | null => {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed === '元年') return 1;
  // Strip trailing 年 / 月 / 日 / 正 when present on expressions.
  const bare = trimmed
    .replace(/^[正]/u, '一')
    .replace(/[年月日朔晦閏闰]+$/u, '')
    .trim();
  if (/^\d+$/.test(bare)) return parseInt(bare, 10);
  return parseChineseNumeral(bare);
};

const romanizeName = (han: string | null | undefined): string | null => {
  const trimmed = han?.trim();
  if (!trimmed) return null;
  // Place-style: concatenated, capitalised, no tones.
  return autoRomanize(trimmed, 'zh', { concatenate: true });
};

const romanizeDynasty = (han: string, lang: DateGlossLang): string | null => {
  const trimmed = han.trim();
  if (!trimmed) return null;
  const direction = DYNASTY_DIRECTION[trimmed[0]!];
  if (direction && trimmed.length > 1) {
    const stem = romanizeName(trimmed.slice(1));
    if (!stem) return null;
    if (lang === 'fr') {
      // 南/北/東/西 → « Qi du Sud »; 前/後 → « Han antérieurs »-style later if needed.
      if ('南北東西东'.includes(trimmed[0]!)) return `${stem} du ${direction.fr}`;
      return `${stem} ${direction.fr.toLowerCase()}`;
    }
    return `${direction.en} ${stem}`;
  }
  return romanizeName(trimmed);
};

const normalizeLp = (lp: string | null | undefined): '朔' | '晦' | null => {
  const raw = lp?.trim();
  if (!raw) return null;
  if (raw === '朔' || raw === '0') return '朔';
  if (raw === '晦' || raw === '-1') return '晦';
  return null;
};

const SEASON_GLOSS: Record<string, { en: string; fr: string }> = {
  春: { en: 'spring', fr: 'printemps' },
  夏: { en: 'summer', fr: 'été' },
  秋: { en: 'autumn', fr: 'automne' },
  冬: { en: 'winter', fr: 'hiver' },
};

/** Map 春夏秋冬 (or already-English/French) to a vernacular season word. */
export const glossSeason = (
  season: string | null | undefined,
  lang: DateGlossLang,
): string | null => {
  const raw = season?.trim();
  if (!raw) return null;
  const mapped = SEASON_GLOSS[raw];
  if (mapped) return mapped[lang];
  const lower = raw.toLowerCase();
  for (const entry of Object.values(SEASON_GLOSS)) {
    if (entry.en === lower || entry.fr === lower) return entry[lang];
  }
  return null;
};

const ganzhiPinyin = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const fromCycle = sexagenaryToPinyin(trimmed);
  if (fromCycle) return fromCycle;
  // Already latin (e.g. from a prior gloss) — keep lowercase concatenated.
  if (/^[A-Za-z]+$/.test(trimmed)) return trimmed.toLowerCase();
  // Fallback: pinyin the characters.
  return romanizeName(trimmed)?.toLowerCase() ?? null;
};

const resolveGzLabel = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return sexagenaryIndexToName(parseInt(trimmed, 10));
  return trimmed;
};

/** Format Sanmiao `@when` for the parenthetical Western date. */
export const formatWesternWhen = (
  when: string | null | undefined,
  lang: DateGlossLang,
): string | null => {
  const parsed = parseIsoYmd(when);
  if (!parsed) return null;
  return formatWesternDay(parsed, lang);
};

type IsoYmd = { year: number; month: number; day: number };

const parseIsoYmd = (raw: string | null | undefined): IsoYmd | null => {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^([+-]?\d{1,6})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const year = parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10);
  const day = parseInt(match[3]!, 10);
  if (!month || month > 12 || !day || day > 31) return null;
  return { year, month, day };
};

const yearLabelFor = (year: number, lang: DateGlossLang): string => {
  if (year === 0) return '0';
  if (year < 0) {
    const abs = String(Math.abs(year));
    return lang === 'fr' ? `${abs} av. J.-C.` : `${abs} BCE`;
  }
  return String(year);
};

const monthNameFor = (month: number, lang: DateGlossLang): string | null => {
  const name = (lang === 'fr' ? FR_MONTHS : EN_MONTHS)[month];
  return name ?? null;
};

const formatWesternDay = (ymd: IsoYmd, lang: DateGlossLang): string | null => {
  const monthName = monthNameFor(ymd.month, lang);
  if (!monthName) return null;
  return `${ymd.day} ${monthName} ${yearLabelFor(ymd.year, lang)}`;
};

/**
 * Format a Sanmiao month-only span (`notBefore`–`notAfter`) for conversion display.
 * Same calendar year: year once at the end. Cross-year: year on each side.
 */
export const formatWesternMonthSpan = (
  notBefore: string | null | undefined,
  notAfter: string | null | undefined,
  lang: DateGlossLang,
  style: DateMonthSpanStyle = DEFAULT_DATE_MONTH_SPAN_STYLE,
): string | null => {
  const start = parseIsoYmd(notBefore);
  const end = parseIsoYmd(notAfter);
  if (!start || !end) return null;
  const startMonth = monthNameFor(start.month, lang);
  const endMonth = monthNameFor(end.month, lang);
  if (!startMonth || !endMonth) return null;

  const sameYear = start.year === end.year;
  const startYear = yearLabelFor(start.year, lang);
  const endYear = yearLabelFor(end.year, lang);

  if (style === 'months') {
    if (sameYear) {
      if (start.month === end.month) return `${startMonth} ${startYear}`;
      return `${startMonth}–${endMonth} ${startYear}`;
    }
    return `${startMonth} ${startYear}–${endMonth} ${endYear}`;
  }

  // full: include day-of-month on each side
  if (sameYear) {
    return `${start.day} ${startMonth}–${end.day} ${endMonth} ${startYear}`;
  }
  return `${start.day} ${startMonth} ${startYear}–${end.day} ${endMonth} ${endYear}`;
};

const pushText = (tokens: DateGlossToken[], text: string): void => {
  if (!text) return;
  const last = tokens[tokens.length - 1];
  if (last?.kind === 'text') {
    last.text += text;
    return;
  }
  tokens.push({ kind: 'text', text });
};

const pushGanzhi = (tokens: DateGlossToken[], pinyin: string): void => {
  tokens.push({ kind: 'ganzhi', text: pinyin });
};

type CalendarSlice = {
  dyn?: string | null;
  ruler?: string | null;
} & DateGlossCalendarParts;

type ChunkFacts = {
  dyn: string | null;
  ruler: string | null;
  era: string | null;
  year: number | null;
  season: string | null;
  month: number | null;
  day: number | null;
  intercalary: boolean;
  lp: '朔' | '晦' | null;
  gzPy: string | null;
  nmdPy: string | null;
  bucket: DateGlossLang;
};

const buildChunkFactories = (facts: ChunkFacts): Array<(tokens: DateGlossToken[]) => void> => {
  const {
    dyn,
    ruler,
    era,
    year,
    season,
    month,
    day,
    intercalary,
    lp,
    gzPy,
    nmdPy,
    bucket,
  } = facts;
  const chunks: Array<(tokens: DateGlossToken[]) => void> = [];

  if (dyn) {
    chunks.push((tokens) => pushText(tokens, dyn));
  }
  if (ruler) {
    chunks.push((tokens) =>
      pushText(
        tokens,
        bucket === 'fr' ? `l’empereur ${ruler}` : `Emperor ${ruler}`,
      ),
    );
  }
  if (era) {
    chunks.push((tokens) =>
      pushText(tokens, bucket === 'fr' ? `l’ère ${era}` : `${era} era`),
    );
  }
  if (year != null) {
    chunks.push((tokens) =>
      pushText(tokens, bucket === 'fr' ? `l’an ${year}` : `year ${year}`),
    );
  }
  if (season) {
    chunks.push((tokens) => pushText(tokens, season));
  }
  if (month != null) {
    const roman = ROMAN_MONTHS[month] ?? String(month);
    chunks.push((tokens) => {
      if (bucket === 'fr') {
        pushText(
          tokens,
          intercalary ? `mois intercalaire ${roman}` : `mois ${roman}`,
        );
      } else {
        pushText(
          tokens,
          intercalary ? `intercalary month ${roman}` : `month ${roman}`,
        );
      }
    });
  }

  if (lp === '朔' && nmdPy && gzPy && nmdPy !== gzPy) {
    chunks.push((tokens) => {
      if (bucket === 'fr') {
        pushText(tokens, 'nouvelle lune le ');
        pushGanzhi(tokens, nmdPy);
        pushText(tokens, ', jour ');
        pushGanzhi(tokens, gzPy);
      } else {
        pushText(tokens, 'new moon on ');
        pushGanzhi(tokens, nmdPy);
        pushText(tokens, ', day ');
        pushGanzhi(tokens, gzPy);
      }
    });
  } else if (lp === '朔' && (nmdPy || gzPy)) {
    const moonGz = nmdPy ?? gzPy!;
    chunks.push((tokens) => {
      if (bucket === 'fr') {
        if (day != null) {
          pushText(tokens, `jour ${day}, `);
          pushGanzhi(tokens, moonGz);
          pushText(tokens, ', nouvelle lune');
        } else {
          pushText(tokens, 'jour ');
          pushGanzhi(tokens, moonGz);
          pushText(tokens, ', nouvelle lune');
        }
      } else if (day != null) {
        pushText(tokens, `day ${day}, `);
        pushGanzhi(tokens, moonGz);
        pushText(tokens, ', new moon');
      } else {
        pushText(tokens, 'day ');
        pushGanzhi(tokens, moonGz);
        pushText(tokens, ', new moon');
      }
    });
  } else if (lp === '晦') {
    chunks.push((tokens) => {
      if (day != null || gzPy) {
        if (day != null) {
          pushText(tokens, bucket === 'fr' ? `jour ${day}` : `day ${day}`);
          if (gzPy) {
            pushText(tokens, ', ');
            pushGanzhi(tokens, gzPy);
          }
          pushText(tokens, bucket === 'fr' ? ', veille de la nouvelle lune' : ', new moon eve');
        } else if (gzPy) {
          pushText(tokens, bucket === 'fr' ? 'jour ' : 'day ');
          pushGanzhi(tokens, gzPy);
          pushText(tokens, bucket === 'fr' ? ', veille de la nouvelle lune' : ', new moon eve');
        }
      } else {
        pushText(
          tokens,
          bucket === 'fr' ? 'veille de la nouvelle lune' : 'new moon eve',
        );
      }
    });
  } else if (day != null || gzPy) {
    chunks.push((tokens) => {
      if (day != null && gzPy) {
        pushText(tokens, bucket === 'fr' ? `jour ${day}, ` : `day ${day}, `);
        pushGanzhi(tokens, gzPy);
      } else if (day != null) {
        pushText(tokens, bucket === 'fr' ? `jour ${day}` : `day ${day}`);
      } else if (gzPy) {
        pushText(tokens, bucket === 'fr' ? 'jour ' : 'day ');
        pushGanzhi(tokens, gzPy);
      }
    });
  }

  return chunks;
};

const calendarFacts = (
  slice: CalendarSlice,
  bucket: DateGlossLang,
  includeDynRuler: boolean,
): ChunkFacts => {
  const year = parseIntish(slice.year);
  const month = parseIntish(slice.month);
  const day = parseIntish(slice.day);
  const intercalary = Boolean(slice.intercalary);
  const lp = normalizeLp(slice.lp);
  const gzPy = ganzhiPinyin(resolveGzLabel(slice.gz) ?? slice.gz);
  const nmdPy = ganzhiPinyin(resolveGzLabel(slice.nmdGz) ?? slice.nmdGz);
  const dyn =
    includeDynRuler && slice.dyn?.trim()
      ? romanizeDynasty(slice.dyn.trim(), bucket)
      : null;
  const ruler =
    includeDynRuler && slice.ruler?.trim()
      ? romanizeName(slice.ruler.trim())
      : null;
  const era = slice.era?.trim() ? romanizeName(slice.era.trim()) : null;
  const season = glossSeason(slice.season, bucket);
  return {
    dyn,
    ruler,
    era,
    year,
    season,
    month,
    day,
    intercalary,
    lp,
    gzPy,
    nmdPy,
    bucket,
  };
};

const hasCalendarStructure = (facts: ChunkFacts): boolean =>
  Boolean(
    facts.dyn ||
      facts.ruler ||
      facts.era ||
      facts.year != null ||
      facts.season ||
      facts.month != null ||
      facts.day != null ||
      facts.gzPy ||
      facts.lp ||
      facts.nmdPy,
  );

const appendChunkWriters = (
  tokens: DateGlossToken[],
  writers: Array<(tokens: DateGlossToken[]) => void>,
): void => {
  writers.forEach((write, index) => {
    if (index > 0) pushText(tokens, ', ');
    write(tokens);
  });
};

/**
 * Build vernacular gloss tokens for a structured East Asian date.
 * Returns an empty array when nothing useful can be said (caller may fall back
 * to the surface / a temporary AI stand-in).
 *
 * When `mode` is `western` and a resolvable Western conversion exists (day
 * `@when`, or month span), the entire gloss is replaced with `[…]`. Without a
 * conversion, the East Asian gloss is always kept (never empty brackets).
 *
 * When `showAttrBrackets` is on and `input.attrs` has a full calendar reading,
 * that reading is appended in `[…]` after the as-written gloss (and before any
 * Western parentheses). Brackets omit dynasty / emperor.
 */
export const formatDateGlossTokens = (
  input: DateGlossInput,
  lang: string | null | undefined = 'en',
  mode: DateWesternDisplayMode = DEFAULT_DATE_WESTERN_DISPLAY,
  monthSpanStyle: DateMonthSpanStyle = DEFAULT_DATE_MONTH_SPAN_STYLE,
  showAttrBrackets = false,
): DateGlossToken[] => {
  const bucket = dateGlossLang(lang);
  const writtenFacts = calendarFacts(input, bucket, true);
  const hasWritten = hasCalendarStructure(writtenFacts);
  // Attr-only dates (no tag children): use attrs for the main gloss so conversion still works.
  const mainFacts = hasWritten
    ? writtenFacts
    : input.attrs
      ? calendarFacts(input.attrs, bucket, false)
      : writtenFacts;
  if (!hasCalendarStructure(mainFacts)) return [];

  // Day vs month granularity follows what was actually written when present.
  const dayLevel = Boolean(
    (hasWritten ? writtenFacts : mainFacts).day != null ||
      (hasWritten ? writtenFacts : mainFacts).gzPy ||
      (hasWritten ? writtenFacts : mainFacts).lp,
  );

  const westernDay =
    dayLevel && mode !== 'translation' ? formatWesternWhen(input.when, bucket) : null;
  const westernSpan =
    !dayLevel && mode !== 'translation'
      ? formatWesternMonthSpan(input.notBefore, input.notAfter, bucket, monthSpanStyle)
      : null;
  const western = westernDay ?? westernSpan;

  if (mode === 'western' && western) {
    return [{ kind: 'text', text: `[${western}]` }];
  }

  const tokens: DateGlossToken[] = [];
  appendChunkWriters(tokens, buildChunkFactories(mainFacts));

  // Brackets only when the as-written gloss is distinct and attrs carry a full reading.
  if (showAttrBrackets && hasWritten && input.attrs) {
    const attrFacts = calendarFacts(input.attrs, bucket, false);
    if (hasCalendarStructure(attrFacts)) {
      const bracketTokens: DateGlossToken[] = [];
      appendChunkWriters(bracketTokens, buildChunkFactories(attrFacts));
      if (bracketTokens.length > 0) {
        pushText(tokens, ' [');
        for (const token of bracketTokens) {
          if (token.kind === 'ganzhi') pushGanzhi(tokens, token.text);
          else pushText(tokens, token.text);
        }
        pushText(tokens, ']');
      }
    }
  }

  if (mode === 'translation+western' && western) {
    pushText(tokens, ` (${western})`);
  }

  return tokens;
};

/** True when the gloss is day-granular (day / gz / 朔|晦) — drives in↔on adjustment. */
export const dateGlossIsDayLevel = (input: DateGlossInput): boolean => {
  const day = parseIntish(input.day);
  const lp = normalizeLp(input.lp);
  const gzPy = ganzhiPinyin(resolveGzLabel(input.gz) ?? input.gz);
  return Boolean(day != null || gzPy || lp);
};

/** Plain-text gloss (ganzhi unmarked) — useful for AI payloads / tests. */
export const formatDateGlossPlain = (
  input: DateGlossInput,
  lang: string | null | undefined = 'en',
  mode: DateWesternDisplayMode = DEFAULT_DATE_WESTERN_DISPLAY,
  monthSpanStyle: DateMonthSpanStyle = DEFAULT_DATE_MONTH_SPAN_STYLE,
  showAttrBrackets = false,
): string =>
  formatDateGlossTokens(input, lang, mode, monthSpanStyle, showAttrBrackets)
    .map((token) => token.text)
    .join('')
    .trim();

const resolveEraLabelFromId = (eraId: string | undefined): string | undefined => {
  if (!eraId) return undefined;
  const authority = peekDateAuthorityCache();
  const era = authority?.eras.find((entry) => String(entry.eraId) === eraId);
  const label = era?.label?.trim();
  return label || undefined;
};

/**
 * Build {@link DateGlossInput} from TEI/Sanmiao attributes + parse-child map.
 * Child tags: dyn, ruler, era, year, month, day, gz, sexYear, int, lp, nmdgz.
 *
 * As-written gloss fields come from **children only**. Attribute values (plus
 * era from the era child or `era_id` lookup) go on `attrs` for optional brackets.
 * `@when` / `notBefore` / `notAfter` stay on the top-level input for Western conversion.
 */
export const dateGlossInputFromParts = (
  attrs: Record<string, string | undefined | null>,
  children: Record<string, string | undefined | null> = {},
  surface?: string | null,
): DateGlossInput => {
  const child = (name: string): string | undefined => {
    const value = children[name]?.trim();
    return value || undefined;
  };
  const attr = (name: string): string | undefined => {
    const value = attrs[name]?.trim();
    return value || undefined;
  };

  const writtenIntercalary =
    Boolean(child('int')) || /閏|闰/.test(child('month') ?? '');
  const attrIntercalary = attr('intercalary') === '1';

  const eraFromChild = child('era');
  const eraForAttrs = eraFromChild ?? resolveEraLabelFromId(attr('era_id'));

  const attrParts: DateGlossCalendarParts = {
    era: eraForAttrs,
    year: attr('year'),
    month: attr('month'),
    intercalary: attrIntercalary || undefined,
    day: attr('day'),
    gz: attr('gz'),
    // Keep nmd_gz on attrs for completeness; gloss treats it as day-level only with lp.
    nmdGz: attr('nmd_gz'),
    lp: attr('lp'),
  };

  const hasAttrCalendar = Boolean(
    attrParts.era ||
      attrParts.year ||
      attrParts.month ||
      attrParts.day ||
      attrParts.gz ||
      attrParts.lp ||
      attrParts.nmdGz ||
      attrParts.intercalary,
  );

  return {
    dyn: child('dyn'),
    ruler: child('ruler'),
    era: eraFromChild,
    year: child('year'),
    season: child('season'),
    month: child('month'),
    intercalary: writtenIntercalary || undefined,
    day: child('day'),
    gz: child('gz'),
    nmdGz: child('nmdgz'),
    lp: child('lp'),
    attrs: hasAttrCalendar ? attrParts : undefined,
    when: attr('when'),
    notBefore: attr('notBefore'),
    notAfter: attr('notAfter'),
    surface: surface ?? undefined,
  };
};
