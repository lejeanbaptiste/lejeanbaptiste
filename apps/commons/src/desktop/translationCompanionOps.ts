import { getActiveProjectBundle } from './activeProjectBundle';
import { isTranslationFile, translationFilePathFor } from './translationFileNaming';
import { readTranslationSettings } from './translationSettings';

const isXmlFile = (filePath: string) => filePath.toLowerCase().endsWith('.xml');

export interface CompanionFile {
  path: string;
  lang: string;
}

/**
 * Companion translation files that exist on disk for the given source file, per the
 * project's configured languages. Returns [] for directories, translation files themselves,
 * or projects without translation settings — so explorer file operations can call this
 * unconditionally and only pay the cost when it matters.
 */
export const findCompanionTranslationFiles = async (
  sourcePath: string,
): Promise<CompanionFile[]> => {
  if (!isXmlFile(sourcePath) || isTranslationFile(sourcePath)) return [];
  if (!window.electronAPI?.statFile) return [];

  const bundle = getActiveProjectBundle();
  if (!bundle) return [];

  const settings = await readTranslationSettings(bundle);
  if (!settings || settings.languages.length === 0) return [];

  const existing: CompanionFile[] = [];
  for (const language of settings.languages) {
    const companionPath = translationFilePathFor(sourcePath, language.code);
    try {
      // eslint-disable-next-line no-await-in-loop
      await window.electronAPI.statFile(companionPath);
      existing.push({ path: companionPath, lang: language.code });
    } catch {
      // companion not created yet for this language
    }
  }
  return existing;
};

/**
 * Rewrites @corresp references inside a companion translation file after its source file was
 * renamed — both the root's `corresp="old.xml"` and per-unit `corresp="old.xml#id"` values.
 * Without this, unit lookups (which match against the current source filename) silently fail
 * after a rename even though the translated content is still there.
 *
 * Returns the updated XML, the original string if nothing referenced the old name, or null if
 * the content is not parseable XML.
 */
export const rewriteCompanionSourceReferences = (
  xml: string,
  oldSourceFileName: string,
  newSourceFileName: string,
): string | null => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror')[0]) return null;

  let changed = false;
  for (const element of Array.from(doc.getElementsByTagName('*'))) {
    const corresp = element.getAttribute('corresp');
    if (!corresp) continue;

    if (corresp === oldSourceFileName) {
      element.setAttribute('corresp', newSourceFileName);
      changed = true;
    } else if (corresp.startsWith(`${oldSourceFileName}#`)) {
      element.setAttribute(
        'corresp',
        `${newSourceFileName}${corresp.slice(oldSourceFileName.length)}`,
      );
      changed = true;
    }
  }

  return changed ? new XMLSerializer().serializeToString(doc) : xml;
};
