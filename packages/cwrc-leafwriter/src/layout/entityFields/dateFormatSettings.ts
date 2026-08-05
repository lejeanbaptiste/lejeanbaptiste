/**
 * Author date-formatting conventions for entity mentions in translation.
 * Personal prefs (per browser/profile), one bucket per language — same model
 * as the Word add-in. Switching translation language never clobbers edits
 * made for another language.
 */

const STORAGE_KEY = 'ljb.translationPolicy.dateFormat.v1';

export type YearNumbering = 'astronomical' | 'historical';
export type EraDisplay = 'none' | 'bce_only' | 'always';

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
};

export const LANGUAGE_PRESETS = {
  en: ENGLISH_DEFAULTS,
  fr: FRENCH_DEFAULTS,
  de: GERMAN_DEFAULTS,
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

const DEFAULT_STATE: StoredDateFormatState = {
  byLanguage: {
    en: { ...ENGLISH_DEFAULTS },
    fr: { ...FRENCH_DEFAULTS },
    de: { ...GERMAN_DEFAULTS },
  },
};

const mergeLanguage = (
  preset: DateFormatSettings,
  stored: Partial<DateFormatSettings> | undefined,
): DateFormatSettings => ({ ...preset, ...stored });

export const loadDateFormatState = (): StoredDateFormatState => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredDateFormatState>;
      return {
        byLanguage: {
          en: mergeLanguage(ENGLISH_DEFAULTS, parsed.byLanguage?.en),
          fr: mergeLanguage(FRENCH_DEFAULTS, parsed.byLanguage?.fr),
          de: mergeLanguage(GERMAN_DEFAULTS, parsed.byLanguage?.de),
        },
      };
    }
  } catch {
    // Ignore malformed storage.
  }
  return {
    byLanguage: {
      en: { ...ENGLISH_DEFAULTS },
      fr: { ...FRENCH_DEFAULTS },
      de: { ...GERMAN_DEFAULTS },
    },
  };
};

export const saveDateFormatState = (state: StoredDateFormatState): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota / private mode — in-memory callers still hold the update.
  }
  window.dispatchEvent(new CustomEvent('desktop:translation-policy-changed'));
};

/** Map a translation language code (e.g. fr-FR, de) to a date-format bucket. */
export const dateFormatLanguageForCode = (
  lang: string | null | undefined,
): DateFormatLanguage => {
  const code = (lang ?? '').trim().toLowerCase().split(/[-_]/)[0] ?? '';
  if (code === 'fr') return 'fr';
  if (code === 'de') return 'de';
  return 'en';
};

export const dateFormatSettingsForLang = (
  lang: string | null | undefined,
  state: StoredDateFormatState = loadDateFormatState(),
): DateFormatSettings => state.byLanguage[dateFormatLanguageForCode(lang)];

export const TRANSLATION_POLICY_CHANGED_EVENT = 'desktop:translation-policy-changed';
