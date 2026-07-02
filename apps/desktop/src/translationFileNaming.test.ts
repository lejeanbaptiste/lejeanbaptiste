import {
  isTranslationFile,
  parseTranslationFilePath,
  translationFilePathFor,
} from './translationFileNaming';

describe('translationFilePathFor / parseTranslationFilePath', () => {
  test('round-trips a simple filename', () => {
    const translationPath = translationFilePathFor('/proj/chapter1.xml', 'fr');
    expect(translationPath).toBe('/proj/chapter1.fr.translation.xml');

    const parsed = parseTranslationFilePath(translationPath);
    expect(parsed).toEqual({ sourceFileName: 'chapter1.xml', lang: 'fr' });
  });

  test('round-trips a dotted source filename', () => {
    const translationPath = translationFilePathFor('/proj/chapter.1.xml', 'en');
    expect(translationPath).toBe('/proj/chapter.1.en.translation.xml');

    const parsed = parseTranslationFilePath(translationPath);
    expect(parsed).toEqual({ sourceFileName: 'chapter.1.xml', lang: 'en' });
  });

  test('round-trips a hyphenated language code', () => {
    const translationPath = translationFilePathFor('/proj/chapter1.xml', 'en-US');
    const parsed = parseTranslationFilePath(translationPath);
    expect(parsed).toEqual({ sourceFileName: 'chapter1.xml', lang: 'en-US' });
  });

  test('is case-insensitive on the .xml extension', () => {
    const parsed = parseTranslationFilePath('/proj/chapter1.fr.translation.XML');
    expect(parsed).toEqual({ sourceFileName: 'chapter1.xml', lang: 'fr' });
  });

  test('returns null for a plain source file', () => {
    expect(parseTranslationFilePath('/proj/chapter1.xml')).toBeNull();
  });

  test('returns null for an unrelated file', () => {
    expect(parseTranslationFilePath('/proj/notes.txt')).toBeNull();
  });
});

describe('isTranslationFile', () => {
  test('true for a companion translation file', () => {
    expect(isTranslationFile('/proj/chapter1.fr.translation.xml')).toBe(true);
  });

  test('false for a plain source file', () => {
    expect(isTranslationFile('/proj/chapter1.xml')).toBe(false);
  });
});
