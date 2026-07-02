/**
 * Renderer-side mirror of apps/desktop/src/translationFileNaming.ts. Duplicated because the
 * commons renderer has no direct Node `path`/`fs` access (contextIsolation, nodeIntegration:
 * false) — only pure string logic, no filesystem calls, belongs here.
 */
const TRANSLATION_SUFFIX_PATTERN = /^(.*)\.([A-Za-z0-9-]+)\.translation\.xml$/i;

const splitDirAndFile = (filePath: string): { dir: string; file: string } => {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (idx === -1) return { dir: '', file: filePath };
  return { dir: filePath.slice(0, idx + 1), file: filePath.slice(idx + 1) };
};

export const translationFilePathFor = (sourcePath: string, langCode: string): string => {
  const { dir, file } = splitDirAndFile(sourcePath);
  const extIdx = file.toLowerCase().lastIndexOf('.xml');
  const base = extIdx >= 0 ? file.slice(0, extIdx) : file;
  return `${dir}${base}.${langCode}.translation.xml`;
};

export interface ParsedTranslationFilePath {
  sourceFileName: string;
  lang: string;
}

export const parseTranslationFilePath = (
  filePath: string,
): ParsedTranslationFilePath | null => {
  const { file } = splitDirAndFile(filePath);
  const match = file.match(TRANSLATION_SUFFIX_PATTERN);
  if (!match) return null;

  const [, base, lang] = match;
  return { sourceFileName: `${base}.xml`, lang };
};

export const isTranslationFile = (filePath: string): boolean =>
  parseTranslationFilePath(filePath) !== null;
