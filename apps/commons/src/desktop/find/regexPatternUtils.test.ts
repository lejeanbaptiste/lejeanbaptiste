import {
  applyRegexReplacement,
  compileFindRegex,
  expandUnicodeWordShorthand,
} from './regexPatternUtils';

describe('expandUnicodeWordShorthand', () => {
  test('expands \\w to Unicode letters and numbers outside a class', () => {
    expect(expandUnicodeWordShorthand('(\\w+)')).toBe('([\\p{L}\\p{N}_]+)');
  });

  test('expands \\w inside a character class', () => {
    expect(expandUnicodeWordShorthand('[\\w-]')).toBe('[\\p{L}\\p{N}_-]');
  });

  test('leaves escaped \\\\w alone', () => {
    expect(expandUnicodeWordShorthand('\\\\w')).toBe('\\\\w');
  });
});

describe('compileFindRegex', () => {
  test('matches classical Chinese names with \\w', () => {
    const text = '除通直郎，';
    const regex = compileFindRegex('([轉遷除])(\\w+)([。，])');
    expect([...text.matchAll(regex)]).toHaveLength(1);
    expect([...text.matchAll(regex)][0]?.[2]).toBe('通直郎');
  });

  test('still matches ASCII word characters', () => {
    const regex = compileFindRegex('\\w+');
    expect('hello_9'.match(regex)?.[0]).toBe('hello_9');
  });
});

describe('applyRegexReplacement', () => {
  test('supports dollar, slash, and hash capture aliases', () => {
    const match = compileFindRegex('(甲)(\\w+)').exec('甲乙丙');
    expect(match).not.toBeNull();
    expect(applyRegexReplacement(match!, '$2-\\1-#2')).toBe('乙丙-甲-乙丙');
  });
});
