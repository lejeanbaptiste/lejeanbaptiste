import i18next from 'i18next';
import { ALL_NAME_TYPES, normalizeNameType, type NameTypeId } from './nameTypes';

/** English display labels for built-in name types (base text before any gloss). */
const ENGLISH_LABELS: Record<NameTypeId, string> = {
  primary: 'Primary name',
  birth: 'Birth name',
  family: 'Family name',
  given: 'Given name',
  courtesy: 'Courtesy name',
  art: 'Art name',
  posthumous: 'Posthumous name',
  temple: 'Temple name',
  dharma: 'Dharma name',
  pen: 'Pen name',
  romanization: 'Romanization',
  translation: 'Translation',
  variant: 'Variant',
};

/** UI-language base label; falls back to English when i18n has no entry. */
const localizedBaseLabel = (id: NameTypeId): string => {
  const english = ENGLISH_LABELS[id];
  const key = `LW.nameTypes.${id}`;
  const translated = i18next.t(key, { defaultValue: english });
  return !translated || translated === key ? english : translated;
};

/**
 * Local glosses appended in parentheses when the project source language is
 * zh, ja, or bo. Canonical ids stay language-neutral; these map onto the
 * concordance in person-shortform-autotag-planning.md.
 */
export const NAME_TYPE_GLOSSES: Record<'zh' | 'ja' | 'bo', Partial<Record<NameTypeId, string>>> = {
  zh: {
    family: '姓',
    given: '名',
    courtesy: '字',
    art: '號',
    posthumous: '諡號',
    temple: '廟號',
    dharma: '法名',
    pen: '筆名',
    birth: '本名',
    romanization: '羅馬拼音',
    translation: '譯名',
  },
  ja: {
    family: '苗字',
    given: '通称',
    courtesy: '字',
    art: '号',
    posthumous: '送り名',
    dharma: '法名',
    pen: '芸名',
    birth: '幼名',
    romanization: 'ローマ字',
    translation: '訳名',
  },
  bo: {
    family: 'རུས་',
    given: 'མིང',
    courtesy: 'མཚན',
    dharma: 'ཆོས་མིང',
    variant: 'གཅེས་མིང',
    birth: 'མིང',
    romanization: 'ལ་ཏིན་ཡིག',
    translation: 'བསྒྱུར་མིང',
  },
};

function glossLanguage(lang?: string | null): 'zh' | 'ja' | 'bo' | null {
  const primary = lang?.split('-')[0]?.toLowerCase();
  if (primary === 'zh' || primary === 'ja' || primary === 'bo') return primary;
  return null;
}

/**
 * Human-readable label for a name type in dropdowns. Built-ins use a
 * UI-language base (via i18n) plus a local gloss when project `lang` is zh,
 * ja, or bo. Unknown/custom ids pass through unchanged (or use an optional
 * display label when provided).
 */
export function nameTypeLabel(
  type: string,
  lang?: string | null,
  customDisplayLabel?: string,
): string {
  const normalized = normalizeNameType(type);
  if (!normalized) {
    return customDisplayLabel?.trim() || type;
  }
  const base = localizedBaseLabel(normalized);
  const glossLang = glossLanguage(lang);
  const gloss = glossLang ? NAME_TYPE_GLOSSES[glossLang]?.[normalized] : undefined;
  return gloss ? `${base} (${gloss})` : base;
}

/** All built-in types with labels for the given project language. */
export function builtInNameTypeOptions(lang?: string | null): { id: NameTypeId; label: string }[] {
  return ALL_NAME_TYPES.map((id) => ({ id, label: nameTypeLabel(id, lang) }));
}
