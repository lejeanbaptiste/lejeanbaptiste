import type { ProjectBundle } from './projectTypes';
import {
  createInitialMetadata,
  emptyMetadata,
  getManagedFieldValues,
  readProjectMetadata,
} from './projectMetadata';
import {
  applyTemplateDefaults,
  readMetadataFieldsTemplate,
  resolveProjectMetadataFields,
} from './metadataFieldsTemplate';
import type {
  ProjectMetadataDialogMode,
  ProjectMetadataDialogState,
  TranslationMetadataSection,
} from './projectMetadataDialogTypes';
import { readTranslationSettings } from './translationSettings';

// Defined in the pure `projectMetadataDialogTypes` leaf so `@cwrc/leafwriter`
// can reference them without pulling this module's runtime imports in; re-exported
// here so existing importers keep working.
export type {
  ProjectMetadataDialogState,
  TranslationMetadataSection,
} from './projectMetadataDialogTypes';

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
  const catalogKind = getCatalogKind(bundle.config.schema?.catalogId, bundle.config.schema?.rng);
  const template = await readMetadataFieldsTemplate(bundle.rootPath);
  const fieldDef = resolveProjectMetadataFields(template, catalogKind);

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
        locked: translationSettings.languages.length > 0,
        alignmentUnit: translationSettings.alignmentUnit,
        languages: translationSettings.languages,
      }
    : { locked: false, alignmentUnit: null, languages: [] };

  return {
    mode,
    note: fieldDef.note,
    fields: fieldDef.fields,
    values: applyTemplateDefaults(getManagedFieldValues(metadata, fieldDef.fields), template),
    custom: metadata.custom.map((row) => ({
      path: row.path,
      label: row.label,
      value: row.value,
    })),
    translation,
    // New projects default to syncing; existing projects keep whatever they
    // were explicitly set to (or false, if never touched).
    syncToCentral:
      mode === 'firstSetup'
        ? bundle.config.syncToCentral !== false
        : bundle.config.syncToCentral === true,
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
