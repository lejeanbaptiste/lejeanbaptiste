const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';

const DIGIT_VALUES: Record<string, number> = {
  '〇': 0,
  '零': 0,
  '一': 1,
  '二': 2,
  '三': 3,
  '四': 4,
  '五': 5,
  '六': 6,
  '七': 7,
  '八': 8,
  '九': 9,
};

const UNIT_VALUES: Record<string, number> = {
  '十': 10,
  '百': 100,
  '千': 1000,
};

/** Sexagenary day name (e.g. 甲子) → sanmiao gz index 1–60, or null. */
export function sexagenaryNameToIndex(name: string): number | null {
  const trimmed = name.trim();
  if (trimmed.length !== 2) return null;
  const stem = STEMS.indexOf(trimmed[0]!);
  const branch = BRANCHES.indexOf(trimmed[1]!);
  if (stem === -1 || branch === -1) return null;
  for (let n = 1; n <= 60; n++) {
    if ((n - 1) % 10 === stem && (n - 1) % 12 === branch) return n;
  }
  return null;
}

/**
 * Parse common Chinese numerals (十八, 二十, 300) and Arabic digits.
 * Returns null when the string is not recognized.
 */
export function parseChineseNumeral(text: string): number | null {
  const s = text.trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10);

  let total = 0;
  let current = 0;
  for (const ch of s) {
    if (ch in DIGIT_VALUES) {
      current = DIGIT_VALUES[ch]!;
      continue;
    }
    if (ch in UNIT_VALUES) {
      const unit = UNIT_VALUES[ch]!;
      if (current === 0) current = 1;
      total += current * unit;
      current = 0;
      continue;
    }
    return null;
  }
  total += current;
  return total > 0 ? total : null;
}

/** Normalize sanmiao integer attrs: Arabic digits, Chinese numerals, or 甲子-style gz names. */
export function normalizeIntegerAttributeInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  if (/^\d+$/.test(trimmed)) return trimmed;

  const gzIndex = sexagenaryNameToIndex(trimmed);
  if (gzIndex != null) return String(gzIndex);

  const parsed = parseChineseNumeral(trimmed);
  if (parsed != null) return String(parsed);

  return trimmed;
}
