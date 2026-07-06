import {
  normalizeIntegerAttributeInput,
  parseChineseNumeral,
  sexagenaryNameToIndex,
} from './chineseNumerals';

describe('chineseNumerals', () => {
  it('parses Arabic and Chinese numerals', () => {
    expect(parseChineseNumeral('18')).toBe(18);
    expect(parseChineseNumeral('十八')).toBe(18);
    expect(parseChineseNumeral('二十')).toBe(20);
  });

  it('maps sexagenary names to gz indices', () => {
    expect(sexagenaryNameToIndex('甲子')).toBe(1);
    expect(sexagenaryNameToIndex('癸亥')).toBe(60);
  });

  it('normalizes integer attribute input', () => {
    expect(normalizeIntegerAttributeInput('十八')).toBe('18');
    expect(normalizeIntegerAttributeInput('甲子')).toBe('1');
    expect(normalizeIntegerAttributeInput('')).toBe('');
  });
});
