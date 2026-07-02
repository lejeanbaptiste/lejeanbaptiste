import type { ProjectBundle } from './projectTypes';
import {
  createInitialMetadata,
  emptyMetadata,
  getManagedFieldValues,
  readProjectMetadata,
} from './projectMetadata';
import { getMetadataFieldsForCatalog } from './schemaMetadataFields';
import type { ProjectMetadataDialogMode } from './projectMetadataSession';
import { readTranslationSettings } from './translationSettings';
import type { TranslationLanguage } from './translationTypes';

export interface TranslationMetadataSection {
  locked: boolean;
  alignmentUnit: 'div' | 'p' | null;
  languages: TranslationLanguage[];
  citationStyle: string | null;
}

export interface ProjectMetadataDialogState {
  mode: ProjectMetadataDialogMode;
  note?: string;
  fields: Array<{ path: string; label: string }>;
  values: Record<string, string>;
  custom: Array<{ path: string; label: string; value: string }>;
  translation: TranslationMetadataSection;
}

const cache = new Map<string, ProjectMetadataDialogState>();

const cacheKey = (projectFilePath: string, mode: ProjectMetadataDialogMode) =>
  `${projectFilePath}:${mode}`;

export const getCachedMetadataDialogState = (
  projectFilePath: string,
  mode: ProjectMetadataDialogMode,
): ProjectMetadataDialogState | undefined => cache.get(cacheKey(projectFilePath, mode));

export const setCachedMetadataDialogState = (
  projectFilePath: string,
  mode: ProjectMetadataDialogMode,
  state: ProjectMetadataDialogState,
) => {
  cache.set(cacheKey(projectFilePath, mode), state);
};

export const invalidateMetadataDialogStateCache = (projectFilePath: string) => {
  for (const key of cache.keys()) {
    if (key.startsWith(`${projectFilePath}:`)) {
      cache.delete(key);
    }
  }
};

const getCatalogKind = (catalogId?: string, rngPath?: string): string | undefined => {
  if (catalogId) return catalogId;
  if (rngPath?.toLowerCase().includes('tei')) return 'local-tei';
  return 'custom';
};

export const buildProjectMetadataDialogState = async (
  bundle: ProjectBundle,
  mode: ProjectMetadataDialogMode,
): Promise<ProjectMetadataDialogState> => {
  const catalogKind = getCatalogKind(
    bundle.config.schema?.catalogId,
    bundle.config.schema?.rng,
  );
  const fieldDef = getMetadataFieldsForCatalog(catalogKind);

  let metadata = await readProjectMetadata(bundle);
  if (!metadata && mode === 'firstSetup') {
    const encoderName = await window.electronAPI?.getEncoderName?.();
    metadata = createInitialMetadata(bundle, encoderName);
  }
  if (!metadata) {
    metadata = emptyMetadata(bundle.config.schema?.catalogId);
  }

  const translationSettings = await readTranslationSettings(bundle);
  const translation: TranslationMetadataSection = translationSettings
    ? {
        locked: true,
        alignmentUnit: translationSettings.alignmentUnit,
        languages: translationSettings.languages,
        citationStyle: translationSettings.citationStyle ?? null,
      }
    : { locked: false, alignmentUnit: null, languages: [], citationStyle: null };

  return {
    mode,
    note: fieldDef.note,
    fields: fieldDef.fields,
    values: getManagedFieldValues(metadata, fieldDef.fields),
    custom: metadata.custom.map((row) => ({
      path: row.path,
      label: row.label,
      value: row.value,
    })),
    translation,
  };
};

/** Preload edition metadata so the dialog can open without a round-trip. */
export const warmMetadataDialogStateCache = async (
  bundle: ProjectBundle,
  mode: ProjectMetadataDialogMode = 'edition',
): Promise<ProjectMetadataDialogState> => {
  const state = await buildProjectMetadataDialogState(bundle, mode);
  setCachedMetadataDialogState(bundle.projectFilePath, mode, state);
  return state;
};
