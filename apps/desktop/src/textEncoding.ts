/**
 * Encoding detection for imported plain-text documents. Uses only the
 * built-in TextDecoder (full-ICU in Electron/Node), no dependencies.
 */

export interface DecodedTextFile {
  encoding: string;
  text: string;
}

const LEGACY_CANDIDATES = ['gb18030', 'big5', 'shift_jis', 'euc-kr', 'windows-1252'];

/**
 * High-frequency characters (classical and modern Chinese particles plus
 * common Japanese kana). A correct decode of CJK text hits many of these;
 * a wrong-codepage decode yields valid but obscure ideographs that miss.
 */
const COMMON_CJK =
  '之乎者也不而以其於于為为曰是天人上下大中小一二三四五十百千日月山水火土金木' +
  '道德神經经名常非可有無无生死子母君臣王國国家言行事物心身年時时出入東西南北' +
  '的了在我他她你此彼何如若所自從从与與同異异書书史記记文字語语說说' +
  'のはにをがとでもしてるいたですます、。「」';

const COMMON_CJK_SET = new Set(COMMON_CJK);

const scoreDecodedText = (text: string): number => {
  let score = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code === 0xfffd) score -= 60;
    else if (COMMON_CJK_SET.has(char)) score += 10;
    else if (code >= 0x4e00 && code <= 0x9fff) score += 2;
    else if (code >= 0x3000 && code <= 0x30ff) score += 2; // CJK punct + kana
    else if (code >= 0xac00 && code <= 0xd7af) score += 2; // hangul
    else if (code >= 0xff01 && code <= 0xff60) score += 2; // fullwidth forms
    else if (code >= 0x20 && code <= 0x7e) score += 1;
    else if (code === 0x09 || code === 0x0a || code === 0x0d || code === 0x85) score += 1;
    else if (code >= 0xe000 && code <= 0xf8ff) score -= 10; // private use
    else if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) score -= 20;
  }
  return score;
};

const tryDecode = (buffer: Uint8Array, encoding: string, fatal: boolean): string | null => {
  try {
    return new TextDecoder(encoding, { fatal }).decode(buffer);
  } catch {
    return null;
  }
};

export const decodeTextBuffer = (input: Buffer | Uint8Array): DecodedTextFile => {
  const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);

  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { encoding: 'utf-8', text: tryDecode(buffer, 'utf-8', false) ?? '' };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { encoding: 'utf-16le', text: tryDecode(buffer, 'utf-16le', false) ?? '' };
  }
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    return { encoding: 'utf-16be', text: tryDecode(buffer, 'utf-16be', false) ?? '' };
  }

  const utf8 = tryDecode(buffer, 'utf-8', true);
  if (utf8 !== null) return { encoding: 'utf-8', text: utf8 };

  let best: DecodedTextFile = {
    encoding: 'utf-8',
    text: tryDecode(buffer, 'utf-8', false) ?? '',
  };
  let bestScore = scoreDecodedText(best.text);

  for (const encoding of LEGACY_CANDIDATES) {
    const text = tryDecode(buffer, encoding, false);
    if (text === null) continue;
    const score = scoreDecodedText(text);
    if (score > bestScore) {
      best = { encoding, text };
      bestScore = score;
    }
  }

  return best;
};
