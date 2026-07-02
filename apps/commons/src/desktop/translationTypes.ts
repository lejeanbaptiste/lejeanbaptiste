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
  /** CSL style id for rendering footnote citations (default chicago-note-bibliography).
   * Unlike alignmentUnit this is freely changeable — citations re-render from stored
   * CSL-JSON snapshots. */
  citationStyle?: string;
}
