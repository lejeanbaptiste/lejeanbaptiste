/**
 * Latin-script romanization of entity names for non-Latin project languages:
 * Chinese → toneless pinyin, Tibetan → EWTS/Wylie, Japanese → Hepburn (kana
 * readings only — kanji cannot be read without a reading). Plus the search
 * folding used to match either script in the entity database ("zhangheng" ↔
 * "Zhāng Héng" ↔ 張衡 via a stored/generated romanization).
 */

import { pinyin } from 'pinyin-pro';
import { EwtsConverter } from 'tibetan-ewts-converter';
import { isKana, toRomaji } from 'wanakana';
import {
  isChineseLanguageCode,
  isJapaneseLanguageCode,
  isTibetanLanguageCode,
  latnLangFor,
} from './languageCodes';

export { latnLangFor };

/** Entity kinds that affect romanization style (mirrors EntityKind). */
export type RomanizeEntityKind = 'person' | 'place' | 'org' | 'work' | 'office';

/** True when the string is entirely Latin letters/marks/spaces/common punctuation. */
export function isLatinScript(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^[\p{Script=Latin}\p{M}\s.'’-]+$/u.test(trimmed);
}

/** True when {@link autoRomanize} supports this project language. */
export function canAutoRomanize(projectLang: string | null | undefined): boolean {
  return (
    isChineseLanguageCode(projectLang) ||
    isTibetanLanguageCode(projectLang) ||
    isJapaneseLanguageCode(projectLang)
  );
}

const capitalize = (value: string): string =>
  value ? value[0]!.toUpperCase() + value.slice(1) : value;

function pinyinFor(name: string, options?: { concatenate?: boolean }): string | null {
  const syllables = pinyin(name, { toneType: 'none', type: 'array' })
    .map((syllable) => syllable.trim())
    .filter(Boolean);
  if (syllables.length === 0) return null;
  // Word mode (concatenate): syllables within one name part (e.g. a 2-character
  // given name, or a compound surname like 歐陽) run together as a single word
  // with only the initial letter capitalized — "Chunfeng", not "Chun Feng".
  const romanized = options?.concatenate
    ? capitalize(syllables.join(''))
    : syllables.map(capitalize).join(' ');
  // pinyin-pro echoes non-Chinese characters back; if nothing changed script,
  // the input wasn't romanizable.
  return isLatinScript(romanized) ? romanized : null;
}

let ewtsConverter: EwtsConverter | null = null;

function wylieFor(name: string): string | null {
  ewtsConverter ??= new EwtsConverter();
  const wylie = ewtsConverter
    .to_ewts(name)
    .replace(/[/_]+$/g, '') // trailing shad / explicit-space artifacts
    .trim();
  if (!wylie) return null;
  return isLatinScript(wylie) ? capitalize(wylie) : null;
}

/** Hepburn romaji, only when every part of the name is kana (never guess kanji readings). */
function romajiForKana(name: string): string | null {
  const parts = name.split(/[\s、,，・･]+/u).filter(Boolean);
  if (parts.length === 0) return null;
  if (!parts.every((part) => isKana(part))) return null;
  return parts.map((part) => capitalize(toRomaji(part))).join(' ');
}

/**
 * Trailing Chinese administrative-unit characters split off as a lowercase
 * pinyin word: 建康郡 → "Jiankang jun". Sorted longest-first for future
 * multi-character suffixes. 州/京/市 stay attached (揚州 → Yangzhou).
 */
export const PLACE_ADMIN_SUFFIXES: readonly { chars: string; pinyin: string }[] = [
  { chars: '郡', pinyin: 'jun' },
  { chars: '縣', pinyin: 'xian' },
  { chars: '县', pinyin: 'xian' },
  { chars: '府', pinyin: 'fu' },
  { chars: '省', pinyin: 'sheng' },
  { chars: '軍', pinyin: 'jun' },
  { chars: '军', pinyin: 'jun' },
  { chars: '路', pinyin: 'lu' },
  { chars: '道', pinyin: 'dao' },
];

/** Split a place label into stem + admin suffix when the suffix is recognized. */
export function splitPlaceAdminSuffix(
  name: string,
): { stem: string; suffixPinyin: string } | null {
  const trimmed = name.normalize('NFC').trim();
  if (!trimmed) return null;
  for (const { chars, pinyin: suffixPinyin } of PLACE_ADMIN_SUFFIXES) {
    if (trimmed.length > chars.length && trimmed.endsWith(chars)) {
      return { stem: trimmed.slice(0, -chars.length), suffixPinyin };
    }
  }
  return null;
}

/**
 * Best-effort romanization of a project-script name. Returns null for Latin
 * input, unsupported languages (e.g. Korean), and Japanese input that is not
 * pure kana.
 *
 * @param options.concatenate Treat `name` as a single name part (a given
 * name or a surname) whose syllables should run together as one word, rather
 * than a full label whose characters are independently-capitalized units.
 * Chinese-only; Tibetan/Japanese already romanize a part as one word.
 */
export function autoRomanize(
  name: string,
  projectLang: string | null | undefined,
  options?: { concatenate?: boolean },
): string | null {
  const trimmed = name.normalize('NFC').trim();
  if (!trimmed || isLatinScript(trimmed)) return null;
  if (isChineseLanguageCode(projectLang)) return pinyinFor(trimmed, options);
  if (isTibetanLanguageCode(projectLang)) return wylieFor(trimmed);
  if (isJapaneseLanguageCode(projectLang)) return romajiForKana(trimmed);
  return null;
}

/**
 * Kind-aware autogeneration for stored/display romanizations.
 * - **person** (or unknown kind): syllable Title Case — callers that know the
 *   person should prefer {@link suggestPersonRomanization} instead.
 * - **place**: concatenated stem + lowercase admin suffix when recognized
 *   (`建康郡` → `Jiankang jun`); otherwise fully concatenated (`江南` → `Jiangnan`).
 * - **work / org / office**: fully concatenated (`晉書` → `Jinshu`).
 */
export function autoRomanizeForKind(
  name: string,
  projectLang: string | null | undefined,
  kind: RomanizeEntityKind | null | undefined,
): string | null {
  if (!kind || kind === 'person') {
    return autoRomanize(name, projectLang);
  }
  if (kind === 'place' && isChineseLanguageCode(projectLang)) {
    const split = splitPlaceAdminSuffix(name);
    if (split) {
      const stem = autoRomanize(split.stem, projectLang, { concatenate: true });
      if (stem) return `${stem} ${split.suffixPinyin}`;
    }
  }
  return autoRomanize(name, projectLang, { concatenate: true });
}

/**
 * Romanization from authority metadata (CBDB `pinyin`, NDL `yomi` katakana →
 * Hepburn), falling back to kind-aware autogeneration on the primary name.
 */
export function romanizeFromAuthorityMetadata(
  metadata: { pinyin?: string; yomi?: string; yomiHiragana?: string } | undefined,
  primaryName: string,
  projectLang: string | null | undefined,
  kind?: RomanizeEntityKind | null,
): string | null {
  const fromPinyin = metadata?.pinyin?.trim();
  if (fromPinyin && isLatinScript(fromPinyin)) return fromPinyin;
  const yomi = metadata?.yomi?.trim() || metadata?.yomiHiragana?.trim();
  if (yomi) {
    const romaji = romajiForKana(yomi);
    if (romaji) return romaji;
  }
  return autoRomanizeForKind(primaryName, projectLang, kind);
}

/**
 * Fold a string for script-insensitive search: NFD, strip combining marks,
 * lowercase, drop separators (spaces, hyphens, apostrophes, middle dots,
 * periods). "Zhāng Héng" → "zhangheng".
 */
export function foldForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[\s.'’·‧・･\-_]+/gu, '');
}
