import { nameTypeLabel, NAME_TYPE_GLOSSES } from './nameTypeLabels';

describe('nameTypeLabel', () => {
  it('returns English-only labels when no gloss language applies', () => {
    expect(nameTypeLabel('courtesy')).toBe('Courtesy name');
    expect(nameTypeLabel('family', 'en')).toBe('Family name');
  });

  it('appends zh glosses from the project source language', () => {
    expect(nameTypeLabel('family', 'zh-Hant')).toBe('Family name (姓)');
    expect(nameTypeLabel('courtesy', 'zh')).toBe('Courtesy name (字)');
  });

  it('appends ja and bo glosses', () => {
    expect(nameTypeLabel('family', 'ja')).toBe('Family name (苗字)');
    expect(nameTypeLabel('family', 'bo')).toBe(`Family name (${NAME_TYPE_GLOSSES.bo.family})`);
  });

  it('labels romanization distinctly from translation', () => {
    expect(nameTypeLabel('romanization')).toBe('Romanization');
    expect(nameTypeLabel('romanization', 'zh-Hant')).toBe('Romanization (羅馬拼音)');
    expect(nameTypeLabel('translation')).toBe('Translation');
  });
});
