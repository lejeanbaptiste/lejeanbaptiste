import {
  canonicalLanguageCode,
  isChineseLanguageCode,
  isKnownLanguageCode,
  languageLabelForCode,
} from './languageCodes';

describe('canonicalLanguageCode', () => {
  it('canonicalizes subtag case', () => {
    expect(canonicalLanguageCode('zh-hant')).toBe('zh-Hant');
    expect(canonicalLanguageCode('ZH-HANS')).toBe('zh-Hans');
    expect(canonicalLanguageCode('en-us')).toBe('en-US');
    expect(canonicalLanguageCode('  fr ')).toBe('fr');
  });

  it('leaves non-tags alone (trimmed)', () => {
    expect(canonicalLanguageCode('English language')).toBe('English language');
  });
});

describe('isKnownLanguageCode / languageLabelForCode', () => {
  it('matches fixed options case-insensitively', () => {
    expect(isKnownLanguageCode('zh-hant')).toBe(true);
    expect(isKnownLanguageCode('xx')).toBe(false);
    expect(languageLabelForCode('zh-hant')).toContain('Traditional');
    expect(languageLabelForCode('xx')).toBe('xx');
  });
});

describe('isChineseLanguageCode', () => {
  it('accepts zh variants, lzh, and legacy idents', () => {
    expect(isChineseLanguageCode('zh-Hant')).toBe(true);
    expect(isChineseLanguageCode('zh-Hans')).toBe(true);
    expect(isChineseLanguageCode('zh')).toBe(true);
    expect(isChineseLanguageCode('lzh')).toBe(true);
    expect(isChineseLanguageCode('chi')).toBe(true);
    expect(isChineseLanguageCode('zho')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isChineseLanguageCode('ja')).toBe(false);
    expect(isChineseLanguageCode('en')).toBe(false);
    expect(isChineseLanguageCode('')).toBe(false);
    expect(isChineseLanguageCode(undefined)).toBe(false);
  });
});
