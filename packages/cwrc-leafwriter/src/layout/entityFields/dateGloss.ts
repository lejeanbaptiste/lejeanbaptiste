/**
 * LJBtero vernacular glosses for Sanmiao / East Asian `<date>` spans.
 *
 * Conventions (English skeleton; French mirrors the same slot order):
 * - Translate as written — no prior-context expansion.
 * - Day-level → "On …"; year/month-only → "In …".
 * - Dynasty: directional prefixes (Southern/Northern/…) + concatenated pinyin stem.
 * - Ruler: always "Emperor {Pinyin}".
 * - Era: "{Pinyin} era" (place-style: capitalised, concatenated, no tones).
 * - Months: Roman numerals; intercalary → "intercalary month I".
 * - Ganzhi: concatenated toneless pinyin, italicised by the field renderer.
 * - 朔 → "new moon"; 晦 → "new moon eve".
 * - Western date from Sanmiao `@when` when day-level and YYYY-MM-DD is present.
 * - No trailing punctuation — the translator decides.
 */

import {
  parseChineseNumeral,
  sexagenaryIndexToName,
  sexagenaryToPinyin,
} from '../../dateAuthority/chineseNumerals';
import { autoRomanize } from '../../utilities/romanize';

export type DateGlossLang = 'en' | 'fr';

/** Structured fields extracted from a Sanmiao `<date>` (parse children + attrs). */
export interface DateGlossInput {
  /** Dynasty label as written (e.g. 南齊). */
  dyn?: string | null;
  /** Ruler / temple name as written (e.g. 太祖). */
  ruler?: string | null;
  /** Era / 年號 as written (e.g. 建元). */
  era?: string | null;
  /** Year number or expression (3, 元年, 三年). */
  year?: string | number | null;
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
  /** Sanmiao ISO `@when` (e.g. 0481-02-15). */
  when?: string | null;
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
  const raw = when?.trim();
  if (!raw) return null;
  // Accept 0481-02-15, 481-2-15, optional leading + / era markers.
  const match = raw.match(/^([+-]?\d{1,6})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const year = parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10);
  const day = parseInt(match[3]!, 10);
  if (!month || month > 12 || !day || day > 31) return null;
  const yearLabel = year === 0 ? '0' : year < 0 ? `${Math.abs(year)} BCE` : String(year);
  if (lang === 'fr') {
    const monthName = FR_MONTHS[month];
    if (!monthName) return null;
    return `${day} ${monthName} ${yearLabel.replace(' BCE', ' av. J.-C.')}`;
  }
  const monthName = EN_MONTHS[month];
  if (!monthName) return null;
  return `${day} ${monthName} ${yearLabel}`;
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

/**
 * Build vernacular gloss tokens for a structured East Asian date.
 * Returns an empty array when nothing useful can be said (caller may fall back
 * to the surface / a temporary AI stand-in).
 */
export const formatDateGlossTokens = (
  input: DateGlossInput,
  lang: string | null | undefined = 'en',
): DateGlossToken[] => {
  const bucket = dateGlossLang(lang);
  const year = parseIntish(input.year);
  const month = parseIntish(input.month);
  const day = parseIntish(input.day);
  const intercalary = Boolean(input.intercalary);
  const lp = normalizeLp(input.lp);
  const gzPy = ganzhiPinyin(resolveGzLabel(input.gz) ?? input.gz);
  const nmdPy = ganzhiPinyin(resolveGzLabel(input.nmdGz) ?? input.nmdGz);

  const dyn = input.dyn?.trim() ? romanizeDynasty(input.dyn.trim(), bucket) : null;
  const ruler = input.ruler?.trim() ? romanizeName(input.ruler.trim()) : null;
  const era = input.era?.trim() ? romanizeName(input.era.trim()) : null;

  const dayLevel = Boolean(day != null || gzPy || nmdPy || lp);
  const hasStructure = Boolean(
    dyn || ruler || era || year != null || month != null || dayLevel,
  );
  if (!hasStructure) return [];

  const tokens: DateGlossToken[] = [];
  // Prefixed after we know the first slot (French elision: L’an / L’ère / L’empereur).
  const chunks: Array<() => void> = [];

  if (dyn) {
    chunks.push(() => pushText(tokens, dyn));
  }
  if (ruler) {
    chunks.push(() =>
      pushText(
        tokens,
        bucket === 'fr' ? `empereur ${ruler}` : `Emperor ${ruler}`,
      ),
    );
  }
  if (era) {
    chunks.push(() =>
      pushText(tokens, bucket === 'fr' ? `ère ${era}` : `${era} era`),
    );
  }
  if (year != null) {
    chunks.push(() =>
      pushText(tokens, bucket === 'fr' ? `an ${year}` : `year ${year}`),
    );
  }
  if (month != null) {
    const roman = ROMAN_MONTHS[month] ?? String(month);
    chunks.push(() => {
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

  // Lunar phase + ganzhi: distinguish 朔 alone vs nmdgz+later gz.
  if (lp === '朔' && nmdPy && gzPy && nmdPy !== gzPy) {
    chunks.push(() => {
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
    chunks.push(() => {
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
    chunks.push(() => {
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
    chunks.push(() => {
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

  if (chunks.length === 0) return [];

  let lead: string;
  if (bucket === 'en') {
    lead = dayLevel ? 'On ' : 'In ';
  } else if (dyn) {
    lead = dayLevel ? 'Le ' : 'En ';
  } else if (ruler) {
    // « Sous l’empereur Taizu… » / day-level still uses L’empereur…
    lead = dayLevel ? 'L’' : 'Sous l’';
  } else if (era || year != null) {
    lead = dayLevel ? 'L’' : 'En l’';
  } else {
    lead = dayLevel ? 'Le ' : 'En ';
  }
  pushText(tokens, lead);

  chunks.forEach((write, index) => {
    if (index > 0) pushText(tokens, ', ');
    write();
  });

  if (dayLevel) {
    const western = formatWesternWhen(input.when, bucket);
    if (western) pushText(tokens, ` (${western})`);
  }

  return tokens;
};

/** Plain-text gloss (ganzhi unmarked) — useful for AI payloads / tests. */
export const formatDateGlossPlain = (
  input: DateGlossInput,
  lang: string | null | undefined = 'en',
): string =>
  formatDateGlossTokens(input, lang)
    .map((token) => token.text)
    .join('')
    .trim();

/**
 * Build {@link DateGlossInput} from TEI/Sanmiao attributes + parse-child map.
 * Child tags: dyn, ruler, era, year, month, day, gz, sexYear, int, lp, nmdgz.
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

  const intercalary =
    attr('intercalary') === '1' ||
    Boolean(child('int')) ||
    /閏|闰/.test(child('month') ?? '');

  return {
    dyn: child('dyn') ?? undefined,
    ruler: child('ruler') ?? undefined,
    era: child('era') ?? undefined,
    year: child('year') ?? attr('year'),
    month: child('month') ?? attr('month'),
    intercalary,
    day: child('day') ?? attr('day'),
    gz: child('gz') ?? attr('gz'),
    nmdGz: child('nmdgz') ?? attr('nmd_gz'),
    lp: child('lp') ?? attr('lp'),
    when: attr('when'),
    surface: surface ?? undefined,
  };
};
