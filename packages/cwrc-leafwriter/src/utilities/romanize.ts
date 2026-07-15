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

function pinyinFor(name: string): string | null {
  const syllables = pinyin(name, { toneType: 'none', type: 'array' })
    .map((syllable) => syllable.trim())
    .filter(Boolean);
  if (syllables.length === 0) return null;
  const romanized = syllables.map(capitalize).join(' ');
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
 * Best-effort romanization of a project-script name. Returns null for Latin
 * input, unsupported languages (e.g. Korean), and Japanese input that is not
 * pure kana.
 */
export function autoRomanize(
  name: string,
  projectLang: string | null | undefined,
): string | null {
  const trimmed = name.normalize('NFC').trim();
  if (!trimmed || isLatinScript(trimmed)) return null;
  if (isChineseLanguageCode(projectLang)) return pinyinFor(trimmed);
  if (isTibetanLanguageCode(projectLang)) return wylieFor(trimmed);
  if (isJapaneseLanguageCode(projectLang)) return romajiForKana(trimmed);
  return null;
}

/**
 * Romanization from authority metadata (CBDB `pinyin`, NDL `yomi` katakana →
 * Hepburn), falling back to {@link autoRomanize} on the primary name.
 */
export function romanizeFromAuthorityMetadata(
  metadata: { pinyin?: string; yomi?: string; yomiHiragana?: string } | undefined,
  primaryName: string,
  projectLang: string | null | undefined,
): string | null {
  const fromPinyin = metadata?.pinyin?.trim();
  if (fromPinyin && isLatinScript(fromPinyin)) return fromPinyin;
  const yomi = metadata?.yomi?.trim() || metadata?.yomiHiragana?.trim();
  if (yomi) {
    const romaji = romajiForKana(yomi);
    if (romaji) return romaji;
  }
  return autoRomanize(primaryName, projectLang);
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
