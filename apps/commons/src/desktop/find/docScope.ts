import { isTranslationFile } from '../translationFileNaming';

export type DocScope = 'source' | 'translation' | 'both';

export const DOC_SCOPE_LABEL_KEYS: Record<DocScope, string> = {
  source: 'LWC.desktop.shared.doc_scope.source',
  translation: 'LWC.desktop.shared.doc_scope.translation',
  both: 'LWC.desktop.shared.doc_scope.both',
};

export const matchesDocScope = (filePath: string, docScope: DocScope): boolean => {
  if (docScope === 'both') return true;
  const isTranslation = isTranslationFile(filePath);
  return docScope === 'translation' ? isTranslation : !isTranslation;
};
