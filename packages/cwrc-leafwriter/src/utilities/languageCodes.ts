/**
 * Fixed project/translation language codes (BCP-47). Free-text language entry
 * is being phased out: authority-database gating (CBDB/DILA — Phase A0) keys
 * off these codes, so anywhere a language is chosen must offer this list
 * rather than a type-it-yourself field.
 */

export interface LanguageOption {
  /** BCP-47 tag in canonical case. */
  code: string;
  label: string;
}

export const FIXED_LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'zh-Hant', label: 'Chinese, Traditional 繁體中文' },
  { code: 'zh-Hans', label: 'Chinese, Simplified 简体中文' },
  { code: 'lzh', label: 'Literary Chinese 文言' },
  { code: 'ja', label: 'Japanese 日本語' },
  { code: 'ko', label: 'Korean 한국어' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French Français' },
  { code: 'de', label: 'German Deutsch' },
  { code: 'es', label: 'Spanish Español' },
  { code: 'it', label: 'Italian Italiano' },
  { code: 'pt', label: 'Portuguese Português' },
  { code: 'nl', label: 'Dutch Nederlands' },
  { code: 'ru', label: 'Russian Русский' },
  { code: 'la', label: 'Latin' },
  { code: 'grc', label: 'Ancient Greek Ἑλληνική' },
  { code: 'el', label: 'Greek, Modern Ελληνικά' },
  { code: 'ar', label: 'Arabic العربية' },
  { code: 'he', label: 'Hebrew עברית' },
  { code: 'sa', label: 'Sanskrit संस्कृतम्' },
  { code: 'bo', label: 'Tibetan བོད་སྐད།' },
  { code: 'vi', label: 'Vietnamese Tiếng Việt' },
];

/**
 * Canonicalize a BCP-47 tag's case (zh-hant → zh-Hant, en-us → en-US).
 * Returns the input trimmed if it doesn't look like a tag at all.
 */
export const canonicalLanguageCode = (code: string): string => {
  const trimmed = code.trim();
  if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(trimmed)) return trimmed;
  return trimmed
    .split('-')
    .map((subtag, i) => {
      if (i === 0) return subtag.toLowerCase();
      if (subtag.length === 4) return subtag[0].toUpperCase() + subtag.slice(1).toLowerCase();
      if (subtag.length === 2) return subtag.toUpperCase();
      return subtag.toLowerCase();
    })
    .join('-');
};

export const isKnownLanguageCode = (code: string): boolean => {
  const canonical = canonicalLanguageCode(code);
  return FIXED_LANGUAGE_OPTIONS.some((option) => option.code === canonical);
};

export const languageLabelForCode = (code: string): string => {
  const canonical = canonicalLanguageCode(code);
  return FIXED_LANGUAGE_OPTIONS.find((option) => option.code === canonical)?.label ?? code;
};

/**
 * Normalize project metadata or TEI header language values to a BCP-47-ish code
 * (`zh-Hant`, `ja`, legacy `chi`, …).
 */
export const normalizeSourceLanguageCode = (raw: string | null | undefined): string | null => {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  const byCode = FIXED_LANGUAGE_OPTIONS.find(
    (option) => canonicalLanguageCode(option.code) === canonicalLanguageCode(trimmed),
  );
  if (byCode) return byCode.code;
  const byLabel = FIXED_LANGUAGE_OPTIONS.find((option) => option.label === trimmed);
  if (byLabel) return byLabel.code;
  if (/^[a-z]{2,3}(-[a-z0-9]{2,8})+$/i.test(trimmed)) return canonicalLanguageCode(trimmed);
  const legacy: Record<string, string> = {
    english: 'en',
    chinese: 'zh-Hans',
    japanese: 'ja',
    korean: 'ko',
    chi: 'zh-Hans',
    zho: 'zh-Hans',
    jpn: 'ja',
  };
  const mapped = legacy[trimmed.toLowerCase()];
  if (mapped) return mapped;
  return trimmed;
};

/**
 * Chinese gate for authority databases (CBDB/DILA): any `zh` primary subtag
 * (zh, zh-Hant, zh-Hans, …) plus Literary Chinese (`lzh`) and legacy ISO 639-2
 * idents (`chi`, `zho`) still found in older project metadata.
 */
export const isChineseLanguageCode = (code: string | null | undefined): boolean => {
  if (!code) return false;
  const primary = canonicalLanguageCode(code).split('-')[0].toLowerCase();
  return primary === 'zh' || primary === 'lzh' || primary === 'chi' || primary === 'zho';
};

/** Japanese gate for sanmiao (East Asian calendar dates). */
export const isJapaneseLanguageCode = (code: string | null | undefined): boolean => {
  if (!code) return false;
  const primary = canonicalLanguageCode(code).split('-')[0].toLowerCase();
  return primary === 'ja' || primary === 'jpn';
};

/** Korean gate for sanmiao (East Asian calendar dates). */
export const isKoreanLanguageCode = (code: string | null | undefined): boolean => {
  if (!code) return false;
  const primary = canonicalLanguageCode(code).split('-')[0].toLowerCase();
  return primary === 'ko' || primary === 'kor';
};

/**
 * Projects that should run sanmiao before other auto-tagging and disambiguation
 * (Chinese, Japanese, and Korean documentary prose).
 */
export const isEastAsianCalendarLanguageCode = (code: string | null | undefined): boolean =>
  isChineseLanguageCode(code) || isJapaneseLanguageCode(code) || isKoreanLanguageCode(code);

/** Tibetan gate for authority packs (Wikidata bo persons/places/orgs). */
export const isTibetanLanguageCode = (code: string | null | undefined): boolean => {
  if (!code) return false;
  const primary = canonicalLanguageCode(code).split('-')[0].toLowerCase();
  return primary === 'bo' || primary === 'tib' || primary === 'bod';
};
