import { getActiveProjectBundle } from '../activeProjectBundle';
import { translationFilePathFor } from '../translationFileNaming';
import { readTranslationSettings } from '../translationSettings';

/** Every companion translation file path configured for the project, for a given source file
 * — regardless of whether that companion has been created on disk yet. */
export const getCompanionTranslationFilePaths = async (sourcePath: string): Promise<string[]> => {
  const bundle = getActiveProjectBundle();
  if (!bundle) return [];

  const settings = await readTranslationSettings(bundle);
  if (!settings) return [];

  return settings.languages.map((lang) => translationFilePathFor(sourcePath, lang.code));
};
