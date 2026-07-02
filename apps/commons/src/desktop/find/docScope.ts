import { isTranslationFile } from '../translationFileNaming';

export type DocScope = 'source' | 'translation' | 'both';

export const DOC_SCOPE_LABELS: Record<DocScope, string> = {
  source: 'Source',
  translation: 'Translation',
  both: 'Both',
};

export const matchesDocScope = (filePath: string, docScope: DocScope): boolean => {
  if (docScope === 'both') return true;
  const isTranslation = isTranslationFile(filePath);
  return docScope === 'translation' ? isTranslation : !isTranslation;
};
