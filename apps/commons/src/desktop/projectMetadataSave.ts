import {
  ALL_NAME_TYPES,
  type NameTypeId,
} from '../../../../packages/cwrc-leafwriter/src/autoTagging/nameTypes';
import {
  resolveNameTypeTaggingPolicy,
  type NameTypeTaggingBucket,
} from '../../../../packages/cwrc-leafwriter/src/autoTagging/nameTypeTaggingPolicy';
import type { TFunction } from 'i18next';
import type { NotificationProps } from '@src/types';
import { resolveProjectBundleByPath } from './activeProjectBundle';
import { getProjectSourceLanguage } from './projectLanguage';
import type { ProjectBundle } from './projectTypes';
import {
  applyMetadataToProjectFiles,
  buildLastAppliedSnapshot,
  readProjectMetadata,
  sanitizeMetadataForSave,
  writeProjectMetadata,
} from './projectMetadata';
import {
  buildProjectMetadataDialogState,
  invalidateMetadataDialogStateCache,
  warmMetadataDialogStateCache,
} from './projectMetadataDialogState';
import type { ProjectMetadataDialogMode } from './projectMetadataSession';
import type { AutoTaggingAuthoritySettings, ProjectMetadataFile } from './projectTypes';
import {
  readTranslationSettings,
  upsertTranslationSettings,
} from './translationSettings';
import type { TranslationLanguage } from './translationTypes';

export interface ProjectMetadataSavePayload {
  projectFilePath: string;
  values: Record<string, string>;
  custom: { path: string; label: string; value: string }[];
  applyToDocuments: boolean;
  translationAlignmentUnit?: 'div' | 'p' | 'ab';
  translationLanguages?: TranslationLanguage[];
  syncToCentral?: boolean;
  mode?: ProjectMetadataDialogMode;
}

export interface ProjectMetadataSaveResult {
  ok: boolean;
  error?: string;
  summary?: string;
  syncReport?: { broken: number; conflicts: number };
}

export interface ProjectMetadataSaveDeps {
  electronAPI: NonNullable<Window['electronAPI']>;
  openTabs: { filePath: string; dirty: boolean }[];
  reloadTabFromDisk: (filePath: string) => Promise<boolean>;
  notifyViaSnackbar: (notification: NotificationProps | string) => void;
  t: TFunction;
  getAuthoritySettings: (bundle: ProjectBundle) => AutoTaggingAuthoritySettings | undefined;
  setAuthoritySettings: (settings: AutoTaggingAuthoritySettings) => void;
}

const resolveBundle = async (projectFilePath: string): Promise<ProjectBundle | null> =>
  resolveProjectBundleByPath(projectFilePath);

export const loadProjectMetadataDialogState = async (
  projectFilePath: string,
  mode: ProjectMetadataDialogMode,
) => {
  const bundle = await resolveBundle(projectFilePath);
  if (!bundle) return null;
  return buildProjectMetadataDialogState(bundle, mode);
};

export const saveProjectMetadataChanges = async (
  deps: ProjectMetadataSaveDeps,
  payload: ProjectMetadataSavePayload,
): Promise<ProjectMetadataSaveResult> => {
  const { electronAPI, openTabs, reloadTabFromDisk, notifyViaSnackbar, t } = deps;
  const mode = payload.mode ?? 'edition';

  const bundle = await resolveBundle(payload.projectFilePath);
  if (!bundle) return { ok: false, error: 'Project not found.' };

  const previous = await readProjectMetadata(bundle);
  const draft: ProjectMetadataFile = {
    version: 1,
    catalogId: bundle.config.schema?.catalogId,
    fields: payload.values ?? {},
    custom: (payload.custom ?? []).map((row) => ({
      path: row.path?.trim() ?? '',
      label: row.label?.trim() || row.path?.trim() || 'Custom field',
      value: row.value?.trim() ?? '',
    })),
  };

  try {
    await writeProjectMetadata(bundle, draft);
    if (typeof payload.syncToCentral === 'boolean' && electronAPI.updateProjectFileConfig) {
      await electronAPI.updateProjectFileConfig(bundle.projectFilePath, {
        syncToCentral: payload.syncToCentral,
      });
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : t('LWC.desktop.could_not_save_metadata'),
    };
  }

  if (payload.translationAlignmentUnit) {
    try {
      const existingTranslationSettings = await readTranslationSettings(bundle);
      const translationLanguages = payload.translationLanguages ?? [];
      const shouldSaveTranslation =
        translationLanguages.length > 0 || existingTranslationSettings !== null;
      if (shouldSaveTranslation) {
        await upsertTranslationSettings(bundle, {
          alignmentUnit: payload.translationAlignmentUnit,
          languages: translationLanguages,
        });
      }
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : t('LWC.desktop.could_not_save_translation_settings'),
      };
    }
  }

  invalidateMetadataDialogStateCache(bundle.projectFilePath);
  void warmMetadataDialogStateCache(bundle, mode);

  const sanitized = sanitizeMetadataForSave(draft);
  let summary: string | undefined;

  if (payload.applyToDocuments) {
    const dirtyTabs = openTabs.filter((tab) => tab.dirty);
    if (dirtyTabs.length > 0) {
      if (!electronAPI.showNativeMessageBox) {
        return { ok: false, error: 'Desktop dialog API unavailable' };
      }
      const warn = await electronAPI.showNativeMessageBox({
        type: 'warning',
        title: t('LWC.desktop.unsaved_documents'),
        message: t('LWC.desktop.bulk_update_warning', { count: dirtyTabs.length }),
        buttons: [t('LWC.commons.continue'), t('LWC.commons.cancel')],
        cancelId: 1,
        defaultId: 1,
      });
      if (warn.response !== 0) {
        return { ok: false, error: 'cancelled' };
      }
    }

    const result = await applyMetadataToProjectFiles(bundle, sanitized, {
      previous,
      clearRemovedFromFiles: false,
    });

    const withLastApplied = {
      ...sanitized,
      lastApplied: buildLastAppliedSnapshot(sanitized),
    };
    await writeProjectMetadata(bundle, withLastApplied);
    invalidateMetadataDialogStateCache(bundle.projectFilePath);
    void warmMetadataDialogStateCache(bundle, mode);

    for (const tab of openTabs) {
      await reloadTabFromDisk(tab.filePath);
    }

    summary = t('LWC.desktop.updated_files_summary', {
      updated: result.updated,
      skipped: result.skipped,
    });
    if (result.overridesSkipped > 0) {
      summary += ` ${t('LWC.desktop.updated_files_overrides_skipped', { count: result.overridesSkipped })}`;
    }
    if (result.errors.length > 0) {
      notifyViaSnackbar({
        message: result.errors[0],
        options: { variant: 'error' },
      });
    } else {
      notifyViaSnackbar({
        message: summary,
        options: { variant: 'success' },
      });
    }
  }

  window.dispatchEvent(
    new CustomEvent('ljb-project-config-saved', {
      detail: { projectFilePath: bundle.projectFilePath, syncToCentral: payload.syncToCentral },
    }),
  );

  if (!payload.applyToDocuments && mode === 'edition') {
    notifyViaSnackbar({
      message: t('LWC.desktop.project_settings_saved'),
      options: { variant: 'success' },
    });
  }

  return { ok: true, summary };
};

export const loadNameTypeTaggingPolicyState = async (
  projectFilePath: string,
  getAuthoritySettings: (bundle: ProjectBundle) => AutoTaggingAuthoritySettings | undefined,
) => {
  const bundle = await resolveBundle(projectFilePath);
  if (!bundle) return null;
  const settings = getAuthoritySettings(bundle);
  const sourceLanguage = await getProjectSourceLanguage(bundle);
  const policy = resolveNameTypeTaggingPolicy(settings, sourceLanguage);
  return {
    buckets: policy.buckets,
    customTypes: policy.customTypes,
    artMinCodePoints: policy.artMinCodePoints,
    sourceLanguage,
  };
};

export const persistNameTypeTaggingPolicyChanges = async (
  projectFilePath: string,
  payload: {
    buckets: Record<NameTypeId, NameTypeTaggingBucket>;
    customTypes?: AutoTaggingAuthoritySettings['customNameTypes'];
    artMinCodePoints?: number;
  },
  deps: Pick<
    ProjectMetadataSaveDeps,
    'electronAPI' | 'getAuthoritySettings' | 'setAuthoritySettings'
  >,
): Promise<{ ok: boolean; error?: string }> => {
  const { electronAPI, getAuthoritySettings, setAuthoritySettings } = deps;
  const bundle = await resolveBundle(projectFilePath);
  if (!bundle) return { ok: false, error: 'Project not found.' };
  if (!electronAPI.updateProjectFileConfig) {
    return { ok: false, error: 'Could not update project settings.' };
  }

  const current = getAuthoritySettings(bundle) ?? {};
  const next: AutoTaggingAuthoritySettings = {
    ...current,
    nameTypeTaggingPolicy: Object.fromEntries(
      ALL_NAME_TYPES.map((type) => [type, payload.buckets[type]]),
    ),
    customNameTypes: payload.customTypes ?? current.customNameTypes,
    artMinCodePoints: payload.artMinCodePoints ?? current.artMinCodePoints,
  };
  await electronAPI.updateProjectFileConfig(bundle.projectFilePath, {
    autoTaggingAuthority: next,
  });
  setAuthoritySettings(next);
  return { ok: true };
};
