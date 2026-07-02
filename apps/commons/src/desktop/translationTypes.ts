export const DEFAULT_TRANSLATION_SETTINGS_PATH = 'schema/translation-settings.json';

export interface TranslationLanguage {
  code: string;
  label: string;
}

export interface TranslationSettingsFile {
  version: 1;
  alignmentUnit: 'div' | 'p';
  languages: TranslationLanguage[];
  lockedAt: string;
}
