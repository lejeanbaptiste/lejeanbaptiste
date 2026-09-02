/**
 * Author date-formatting conventions for entity mentions in translation.
 * Personal prefs (per browser/profile), one bucket per language — same model
 * as the Word add-in. Switching translation language never clobbers edits
 * made for another language.
 */

const STORAGE_KEY = 'ljb.translationPolicy.dateFormat.v2';

export type YearNumbering = 'astronomical' | 'historical';
export type EraDisplay = 'none' | 'bce_only' | 'always';

/** How first-occurrence titles lead: romanization or vernacular gloss. */
export type TitleConvention = 'romanization-first' | 'translation-first';

export const DEFAULT_TITLE_CONVENTION: TitleConvention = 'romanization-first';

/** When to show inferred family in brackets for partial kinship names. */
export type BracketsPolicy = 'never' | 'first-mention-only' | 'always';

export const DEFAULT_BRACKETS_POLICY: BracketsPolicy = 'first-mention-only';

export interface DateFormatSettings {
  birthWord: string;
  deathWord: string;
  floruitWord: string;
  activeWord: string;
  activeToWord: string;
  circaWord: string;
  /** Shown after a year per `eraDisplay`. */
  ceLabel: string;
  bceLabel: string;
  eraDisplay: EraDisplay;
  /**
   * Stored years are astronomical (ISO 8601: year 0 = 1 BCE, year -1 = 2 BCE).
   * `historical` converts to traditional counting with no year zero.
   */
  yearNumbering: YearNumbering;
  /**
   * Default first-occurrence title order for this language bucket.
   * Per-mention EntityDisplaySpec.titleConvention overrides when set.
   */
  titleConvention: TitleConvention;
  /** Inferred family brackets for partial person names (Western + CJK). */
  bracketsPolicy: BracketsPolicy;
  /** CJK entity life-date typography (Western years). */
  rangeSeparator?: string;
  yearSuffix?: string;
  bcePrefix?: string;
  parenOpen?: string;
  parenClose?: string;
}

export const ENGLISH_DEFAULTS: DateFormatSettings = {
  birthWord: 'b.',
  deathWord: 'd.',
  floruitWord: 'fl.',
  activeWord: 'active',
  activeToWord: 'active to',
  circaWord: 'ca.',
  ceLabel: 'CE',
  bceLabel: 'BCE',
  eraDisplay: 'none',
  yearNumbering: 'astronomical',
  titleConvention: DEFAULT_TITLE_CONVENTION,
  bracketsPolicy: DEFAULT_BRACKETS_POLICY,
};

export const FRENCH_DEFAULTS: DateFormatSettings = {
  birthWord: 'n.',
  deathWord: 'm.',
  floruitWord: 'fl.',
  activeWord: 'actif',
  activeToWord: "actif jusqu'à",
  circaWord: 'v.',
  ceLabel: 'apr. J.-C.',
  bceLabel: 'av. J.-C.',
  eraDisplay: 'none',
  yearNumbering: 'astronomical',
  titleConvention: DEFAULT_TITLE_CONVENTION,
  bracketsPolicy: DEFAULT_BRACKETS_POLICY,
};

export const GERMAN_DEFAULTS: DateFormatSettings = {
  birthWord: 'geb.',
  deathWord: 'gest.',
  floruitWord: 'fl.',
  activeWord: 'tätig',
  activeToWord: 'tätig bis',
  circaWord: 'ca.',
  ceLabel: 'n. Chr.',
  bceLabel: 'v. Chr.',
  eraDisplay: 'none',
  yearNumbering: 'astronomical',
  titleConvention: DEFAULT_TITLE_CONVENTION,
  bracketsPolicy: DEFAULT_BRACKETS_POLICY,
};

export const CHINESE_DEFAULTS: DateFormatSettings = {
  birthWord: '生於',
  deathWord: '卒於',
  floruitWord: '活躍於',
  activeWord: '活動於',
  activeToWord: '活動至',
  circaWord: '約',
  ceLabel: '',
  bceLabel: '',
  eraDisplay: 'none',
  yearNumbering: 'historical',
  titleConvention: DEFAULT_TITLE_CONVENTION,
  bracketsPolicy: DEFAULT_BRACKETS_POLICY,
  rangeSeparator: '～',
  yearSuffix: '年',
  bcePrefix: '前',
  parenOpen: '（',
  parenClose: '）',
};

export const JAPANESE_DEFAULTS: DateFormatSettings = {
  ...CHINESE_DEFAULTS,
  birthWord: '生於',
  deathWord: '没於',
};

export const KOREAN_DEFAULTS: DateFormatSettings = {
  ...CHINESE_DEFAULTS,
  birthWord: '생於',
  deathWord: '卒於',
};

export const LANGUAGE_PRESETS = {
  en: ENGLISH_DEFAULTS,
  fr: FRENCH_DEFAULTS,
  de: GERMAN_DEFAULTS,
  zh: CHINESE_DEFAULTS,
  ja: JAPANESE_DEFAULTS,
  ko: KOREAN_DEFAULTS,
} as const;

export type DateFormatLanguage = keyof typeof LANGUAGE_PRESETS;

export const FIELD_OPTIONS: Partial<
  Record<DateFormatLanguage, Partial<Record<keyof DateFormatSettings, string[]>>>
> = {
  en: {
    birthWord: ['b.', '°'],
    deathWord: ['d.', '†'],
    circaWord: ['ca.', 'c.'],
    bceLabel: ['BCE', 'BC'],
    ceLabel: ['CE', 'AD'],
  },
  fr: {
    birthWord: ['n.', '°'],
    deathWord: ['m.', 'déc.', '†'],
    circaWord: ['v.', 'env.'],
  },
  de: {
    birthWord: ['geb.', '°'],
    deathWord: ['gest.', '†'],
    circaWord: ['ca.', 'etwa'],
  },
};

export type DateFormatSettingsByLanguage = Record<DateFormatLanguage, DateFormatSettings>;

export interface StoredDateFormatState {
  byLanguage: DateFormatSettingsByLanguage;
}

const parseTitleConvention = (value: unknown): TitleConvention | undefined => {
  if (value === 'romanization-first' || value === 'translation-first') return value;
  return undefined;
};

const parseBracketsPolicy = (value: unknown): BracketsPolicy | undefined => {
  if (value === 'never' || value === 'first-mention-only' || value === 'always') return value;
  return undefined;
};

const mergeLanguage = (
  preset: DateFormatSettings,
  stored: Partial<DateFormatSettings> | undefined,
): DateFormatSettings => ({
  ...preset,
  ...stored,
  titleConvention: parseTitleConvention(stored?.titleConvention) ?? preset.titleConvention,
  bracketsPolicy: parseBracketsPolicy(stored?.bracketsPolicy) ?? preset.bracketsPolicy,
});

const defaultByLanguage = (): DateFormatSettingsByLanguage => ({
  en: { ...ENGLISH_DEFAULTS },
  fr: { ...FRENCH_DEFAULTS },
  de: { ...GERMAN_DEFAULTS },
  zh: { ...CHINESE_DEFAULTS },
  ja: { ...JAPANESE_DEFAULTS },
  ko: { ...KOREAN_DEFAULTS },
});

export const loadDateFormatState = (): StoredDateFormatState => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { byLanguage: defaultByLanguage() };
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = window.localStorage.getItem('ljb.translationPolicy.dateFormat.v1');
      if (legacy) {
        const parsed = JSON.parse(legacy) as Partial<StoredDateFormatState>;
        return {
          byLanguage: {
            en: mergeLanguage(ENGLISH_DEFAULTS, parsed.byLanguage?.en),
            fr: mergeLanguage(FRENCH_DEFAULTS, parsed.byLanguage?.fr),
            de: mergeLanguage(GERMAN_DEFAULTS, parsed.byLanguage?.de),
            zh: { ...CHINESE_DEFAULTS },
            ja: { ...JAPANESE_DEFAULTS },
            ko: { ...KOREAN_DEFAULTS },
          },
        };
      }
    }
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredDateFormatState>;
      return {
        byLanguage: {
          en: mergeLanguage(ENGLISH_DEFAULTS, parsed.byLanguage?.en),
          fr: mergeLanguage(FRENCH_DEFAULTS, parsed.byLanguage?.fr),
          de: mergeLanguage(GERMAN_DEFAULTS, parsed.byLanguage?.de),
          zh: mergeLanguage(CHINESE_DEFAULTS, parsed.byLanguage?.zh),
          ja: mergeLanguage(JAPANESE_DEFAULTS, parsed.byLanguage?.ja),
          ko: mergeLanguage(KOREAN_DEFAULTS, parsed.byLanguage?.ko),
        },
      };
    }
  } catch {
    // Ignore malformed storage.
  }
  return { byLanguage: defaultByLanguage() };
};

export const saveDateFormatState = (state: StoredDateFormatState): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota / private mode — in-memory callers still hold the update.
  }
  window.dispatchEvent(new CustomEvent('desktop:translation-policy-changed'));
};

/** Map a translation language code (e.g. fr-FR, de, zh-Hant) to a date-format bucket. */
export const dateFormatLanguageForCode = (lang: string | null | undefined): DateFormatLanguage => {
  const code = (lang ?? '').trim().toLowerCase().split(/[-_]/)[0] ?? '';
  if (code === 'fr') return 'fr';
  if (code === 'de') return 'de';
  if (code === 'zh' || code === 'lzh') return 'zh';
  if (code === 'ja') return 'ja';
  if (code === 'ko') return 'ko';
  return 'en';
};

export const dateFormatSettingsForLang = (
  lang: string | null | undefined,
  state: StoredDateFormatState = loadDateFormatState(),
): DateFormatSettings => state.byLanguage[dateFormatLanguageForCode(lang)];

export const bracketsPolicyForLang = (
  lang: string | null | undefined,
  state: StoredDateFormatState = loadDateFormatState(),
): BracketsPolicy => dateFormatSettingsForLang(lang, state).bracketsPolicy;

/** Language-bucket default for title order (overridable per mention). */
export const titleConventionForLang = (
  lang: string | null | undefined,
  state: StoredDateFormatState = loadDateFormatState(),
): TitleConvention =>
  dateFormatSettingsForLang(lang, state).titleConvention ?? DEFAULT_TITLE_CONVENTION;

export const TRANSLATION_POLICY_CHANGED_EVENT = 'desktop:translation-policy-changed';
