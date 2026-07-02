import { getTranslationSettingsAbsolutePath, type ProjectBundle } from './projectFile';
import type { TranslationLanguage, TranslationSettingsFile } from './translationTypes';

export const readTranslationSettings = async (
  bundle: ProjectBundle,
): Promise<TranslationSettingsFile | null> => {
  if (!window.electronAPI?.readFile) return null;
  const filePath = getTranslationSettingsAbsolutePath(bundle);

  try {
    const raw = await window.electronAPI.readFile(filePath);
    const parsed = JSON.parse(raw) as TranslationSettingsFile;
    if (parsed.alignmentUnit !== 'div' && parsed.alignmentUnit !== 'p') return null;
    return {
      version: 1,
      alignmentUnit: parsed.alignmentUnit,
      languages: Array.isArray(parsed.languages) ? parsed.languages : [],
      lockedAt: parsed.lockedAt,
    };
  } catch {
    return null;
  }
};

export const translationSettingsExist = async (bundle: ProjectBundle): Promise<boolean> => {
  const settings = await readTranslationSettings(bundle);
  return settings !== null;
};

const writeSettingsFile = async (
  bundle: ProjectBundle,
  settings: TranslationSettingsFile,
): Promise<void> => {
  if (!window.electronAPI?.writeFile) {
    throw new Error('File write unavailable');
  }

  const filePath = getTranslationSettingsAbsolutePath(bundle);

  if (window.electronAPI.createDirectory) {
    try {
      await window.electronAPI.createDirectory(bundle.rootPath, 'schema');
    } catch {
      // may already exist
    }
  }

  await window.electronAPI.writeFile(filePath, JSON.stringify(settings, null, 2));
};

/**
 * Creates the project's translation settings for the first time. Rejects if settings
 * already exist — alignmentUnit is locked forever once chosen; use
 * addTranslationLanguage to extend the language list afterwards.
 */
export const writeTranslationSettings = async (
  bundle: ProjectBundle,
  draft: { alignmentUnit: 'div' | 'p'; languages: TranslationLanguage[] },
): Promise<TranslationSettingsFile> => {
  const existing = await readTranslationSettings(bundle);
  if (existing) {
    throw new Error(
      'Translation settings already exist for this project; alignmentUnit cannot be changed.',
    );
  }

  const settings: TranslationSettingsFile = {
    version: 1,
    alignmentUnit: draft.alignmentUnit,
    languages: draft.languages,
    lockedAt: new Date().toISOString(),
  };

  await writeSettingsFile(bundle, settings);
  return settings;
};

export const addTranslationLanguage = async (
  bundle: ProjectBundle,
  language: TranslationLanguage,
): Promise<TranslationSettingsFile> => {
  const existing = await readTranslationSettings(bundle);
  if (!existing) {
    throw new Error('Translation settings must be created before adding a language.');
  }

  if (existing.languages.some((lang) => lang.code === language.code)) {
    return existing;
  }

  const next: TranslationSettingsFile = {
    ...existing,
    languages: [...existing.languages, language],
  };

  await writeSettingsFile(bundle, next);
  return next;
};
