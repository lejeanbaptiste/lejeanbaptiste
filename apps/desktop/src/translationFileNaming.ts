import path from 'path';

const TRANSLATION_SUFFIX_PATTERN = /^(.*)\.([A-Za-z0-9-]+)\.translation\.xml$/i;

export const translationFilePathFor = (sourcePath: string, langCode: string): string => {
  const dir = path.dirname(sourcePath);
  const ext = path.extname(sourcePath);
  const base = path.basename(sourcePath, ext);
  return path.join(dir, `${base}.${langCode}.translation${ext}`);
};

export interface ParsedTranslationFilePath {
  sourceFileName: string;
  lang: string;
}

export const parseTranslationFilePath = (
  filePath: string,
): ParsedTranslationFilePath | null => {
  const fileName = path.basename(filePath);
  const match = fileName.match(TRANSLATION_SUFFIX_PATTERN);
  if (!match) return null;

  const [, base, lang] = match;
  return { sourceFileName: `${base}.xml`, lang };
};

export const isTranslationFile = (filePath: string): boolean =>
  parseTranslationFilePath(filePath) !== null;
