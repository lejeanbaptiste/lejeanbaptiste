import {
  applyLanguageToolReplacement,
  collectLanguageToolWhitelist,
  filterLanguageToolMatchesByWhitelist,
  mapToLanguageToolLanguage,
  normalizeLanguageToolBaseUrl,
  sanitizeLanguageToolSettings,
  shiftLanguageToolMatchesAfterApply,
  DEFAULT_LANGUAGE_TOOL_SETTINGS,
  type LanguageToolMatch,
  type LanguageToolSettings,
} from './languageTool';

describe('languageTool helpers', () => {
  test('normalizes base URLs and strips /v2/check', () => {
    expect(normalizeLanguageToolBaseUrl('http://localhost:8010/')).toBe('http://localhost:8010');
    expect(normalizeLanguageToolBaseUrl('http://localhost:8010/v2/check')).toBe(
      'http://localhost:8010',
    );
    expect(normalizeLanguageToolBaseUrl('http://127.0.0.1:8081/v2')).toBe('http://127.0.0.1:8081');
  });

  test('maps translation language codes', () => {
    expect(mapToLanguageToolLanguage('fr')).toBe('fr');
    expect(mapToLanguageToolLanguage('en')).toBe('en-US');
    expect(mapToLanguageToolLanguage('en-GB')).toBe('en-GB');
    expect(mapToLanguageToolLanguage('')).toBe('auto');
  });

  test('sanitizes settings defaults', () => {
    expect(sanitizeLanguageToolSettings(undefined)).toEqual(DEFAULT_LANGUAGE_TOOL_SETTINGS);
    expect(sanitizeLanguageToolSettings({ enabled: true, baseUrl: ' http://x:9/ ' }).enabled).toBe(
      true,
    );
    expect(sanitizeLanguageToolSettings({ enabled: true, baseUrl: ' http://x:9/ ' }).baseUrl).toBe(
      'http://x:9',
    );
  });

  test('applies replacements and shifts later matches', () => {
    const text = 'This is an test.';
    const next = applyLanguageToolReplacement(text, 8, 2, 'a');
    expect(next).toBe('This is a test.');

    const matches: LanguageToolMatch[] = [
      { message: 'a', shortMessage: 'a', offset: 8, length: 2, replacements: ['a'] },
      { message: 'later', shortMessage: 'later', offset: 11, length: 4, replacements: ['exam'] },
    ];
    const shifted = shiftLanguageToolMatchesAfterApply(matches, 8, 2, 1);
    expect(shifted).toEqual([
      { message: 'later', shortMessage: 'later', offset: 10, length: 4, replacements: ['exam'] },
    ]);
  });

  test('whitelists latin entity names and filters matches', () => {
    const whitelist = collectLanguageToolWhitelist([
      { text: 'Wang Anshi', language: 'en-Latn' },
      { text: '王安石', language: 'zh-Hani' },
      { text: 'Xuanzang', language: null },
    ]);
    expect(whitelist.has('Wang Anshi')).toBe(true);
    expect(whitelist.has('Xuanzang')).toBe(true);
    expect([...whitelist].some((token) => token.includes('王'))).toBe(false);

    const text = 'Wang Anshi wrote poetry.';
    const matches: LanguageToolMatch[] = [
      {
        message: 'Unknown word',
        shortMessage: 'Spelling',
        offset: 0,
        length: 'Wang Anshi'.length,
        replacements: ['Wang'],
      },
      {
        message: 'grammar',
        shortMessage: 'Grammar',
        offset: 15,
        length: 5,
        replacements: ['write'],
      },
    ];
    const filtered = filterLanguageToolMatchesByWhitelist(text, matches, whitelist);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.offset).toBe(15);
  });
});
