export type FontFamilyOption = {
  label: string;
  value: string;
};

export const SYSTEM_LATIN_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, Helvetica, sans-serif';

export const SYSTEM_ASIAN_FONT =
  '"Noto Sans CJK SC", "Noto Sans CJK JP", "Noto Sans CJK KR", "Hiragino Sans", "Yu Gothic", "Microsoft YaHei", SimSun, sans-serif';

export const DEFAULT_LATIN_FONT = SYSTEM_LATIN_FONT;
export const DEFAULT_ASIAN_FONT = SYSTEM_ASIAN_FONT;

export const FALLBACK_LATIN_FONT_OPTIONS: FontFamilyOption[] = [
  { label: 'System Sans', value: SYSTEM_LATIN_FONT },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Times/Georgia', value: 'Georgia, "Times New Roman", Times, serif' },
  { label: 'Noto Serif', value: '"Noto Serif", Georgia, "Times New Roman", serif' },
];

export const FALLBACK_ASIAN_FONT_OPTIONS: FontFamilyOption[] = [
  { label: 'System CJK', value: SYSTEM_ASIAN_FONT },
  {
    label: 'Noto Sans CJK',
    value: '"Noto Sans CJK SC", "Noto Sans CJK JP", "Noto Sans CJK KR", sans-serif',
  },
  { label: 'Song/Ming Serif', value: 'SimSun, "Songti SC", PMingLiU, serif' },
  { label: 'Japanese Gothic', value: '"Hiragino Sans", "Yu Gothic", Meiryo, sans-serif' },
  { label: 'Korean Gothic', value: '"Apple SD Gothic Neo", "Malgun Gothic", sans-serif' },
];

export const quoteFontFamily = (family: string) => JSON.stringify(family);

export const getFontFamilyLabel = (value: string) => {
  const fallbackOption = [...FALLBACK_LATIN_FONT_OPTIONS, ...FALLBACK_ASIAN_FONT_OPTIONS].find(
    (option) => option.value === value,
  );
  if (fallbackOption) return fallbackOption.label;

  const trimmed = value.trim();
  const singleFamilyMatch = trimmed.match(/^"((?:\\"|[^"])*)"$/);
  if (singleFamilyMatch) return singleFamilyMatch[1].replace(/\\"/g, '"');
  return trimmed;
};

export const getValidFontFamily = (value: string | null | undefined, fallback: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
};
