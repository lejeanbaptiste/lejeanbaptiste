import type { TranslationLanguage } from './translationTypes';

/**
 * Pure type module for the project-metadata dialog, following the same
 * convention as `projectTypes` / `translationTypes` / `schemaUpdateTypes`.
 *
 * These shapes cross the Electron bridge, so `@cwrc/leafwriter`'s
 * `globals.d.ts` references them. They live here — free of runtime imports —
 * so that referencing them does not drag `projectMetadataDialogState`'s
 * implementation (and transitively `fileMetadata`, which imports through
 * commons' `@src/*` alias) into that package's `tsc` program.
 *
 * Keeping `ProjectMetadataDialogMode` here as well breaks the type cycle that
 * previously ran between `projectMetadataDialogState` and
 * `projectMetadataSession`; both now re-export from this module.
 */
export type ProjectMetadataDialogMode = 'firstSetup' | 'edition';

export interface TranslationMetadataSection {
  locked: boolean;
  alignmentUnit: 'div' | 'p' | 'ab' | null;
  languages: TranslationLanguage[];
}

export interface ProjectMetadataDialogState {
  mode: ProjectMetadataDialogMode;
  note?: string;
  fields: { path: string; label: string }[];
  values: Record<string, string>;
  custom: { path: string; label: string; value: string }[];
  translation: TranslationMetadataSection;
  syncToCentral: boolean;
}
