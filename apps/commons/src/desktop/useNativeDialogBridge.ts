import { leafwriterAtom } from '@src/jotai';
import { useActions, useAppState } from '@src/overmind';
import type { Locales } from '@src/i18n';
import type { PaletteMode } from '@src/types';
import { isDesktop, type AiApiSettings } from '@src/types/desktop';
import { useAtom } from 'jotai';
import { useEffect } from 'react';

import { buildProjectSchemas, type ProjectBundle } from './projectFile';
import {
  applyMetadataToProjectFiles,
  buildLastAppliedSnapshot,
  readProjectMetadata,
  sanitizeMetadataForSave,
  writeProjectMetadata,
} from './projectMetadata';
import { invalidateMetadataDialogStateCache, warmMetadataDialogStateCache } from './projectMetadataDialogState';
import {
  clearProjectMetadataSession,
  getProjectMetadataSession,
  subscribeProjectMetadataDialogClosed,
} from './projectMetadataSession';
import { setActiveProjectBundle, resolveProjectBundleByPath } from './activeProjectBundle';
import { buildProjectMetadataDialogState } from './projectMetadataDialogState';
import { registerDesktopSchemas } from './registerDesktopSchemas';
import { getTieredCatalogForSetup } from './schemaCatalog';
import {
  clearSchemaPickerSession,
  getSchemaPickerSession,
  subscribeNativeDialogClosed,
} from './schemaPickerSession';
import {
  clearSchemaSetupSession,
  getSchemaSetupSession,
  subscribeSchemaSetupDialogClosed,
} from './schemaSetupSession';
import type { ProjectMetadataFile } from './projectTypes';
import {
  addTranslationLanguage,
  readTranslationSettings,
  setCitationStyle,
  writeTranslationSettings,
} from './translationSettings';

declare global {
  interface Window {
    __ljbNativeBridge?: {
      invoke: (method: string, args: unknown) => Promise<unknown>;
    };
  }
}

interface SchemaPickerStatePayload {
  defaultSchemaId: string | null;
  schemas: Array<{ id: string; name: string }>;
}

const getStringArg = (args: unknown, key: string): string | null => {
  const value = (args as Record<string, unknown> | null | undefined)?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
};

const getLeafWriterPaletteMode = (mode: PaletteMode): 'light' | 'dark' => {
  if (mode === 'light' || mode === 'dark') return mode;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getWriterSchemasList = (): Array<{
  id: string;
  name: string;
  mapping: string;
  rng: string[];
  css: string[];
}> => {
  const writer = window.writer;
  if (!writer?.overmindState?.editor) return [];

  const { schemasList } = writer.overmindState.editor as {
    schemasList: Array<{
      id: string;
      name: string;
      mapping: string;
      rng: string[];
      css: string[];
    }>;
  };

  return schemasList;
};

export const useNativeDialogBridge = () => {
  const { currentLocale, skipCopyPasteHelp, skipExplorerDeleteConfirm, themeAppearance } =
    useAppState().ui;
  const { config, openTabs, projectFilePath, rootPath } = useAppState().project;
  const { setSkipCopyPasteHelp, setSkipExplorerDeleteConfirm, setThemeAppearance, switchLanguage, notifyViaSnackbar } =
    useActions().ui;
  const { reloadTabFromDisk } = useActions().project;
  const [leafWriter] = useAtom(leafwriterAtom);

  useEffect(() => {
    if (!isDesktop()) return;

    const unsubPicker = subscribeNativeDialogClosed();
    const unsubSetup = subscribeSchemaSetupDialogClosed();
    const unsubMetadata = subscribeProjectMetadataDialogClosed();

    return () => {
      unsubPicker();
      unsubSetup();
      unsubMetadata();
    };
  }, []);

  useEffect(() => {
    if (!isDesktop()) {
      setActiveProjectBundle(null);
      return;
    }
    if (!rootPath || !projectFilePath || !config) {
      setActiveProjectBundle(null);
      return;
    }
    setActiveProjectBundle({ rootPath, projectFilePath, config });
  }, [rootPath, projectFilePath, config]);

  useEffect(() => {
    if (!isDesktop()) return;
    const electronAPI = window.electronAPI;
    if (!electronAPI) return;

    const resolveProjectBundle = async (
      sessionProjectFilePath: string,
    ): Promise<ProjectBundle | null> => resolveProjectBundleByPath(sessionProjectFilePath);

    window.__ljbNativeBridge = {
      invoke: async (method: string, args: unknown) => {
        switch (method) {
          case 'getInterfaceSettings':
            return {
              currentLocale,
              skipCopyPasteHelp,
              skipExplorerDeleteConfirm,
              themeAppearance,
            };
          case 'getEncoderName':
            return (await electronAPI.getEncoderName()) ?? '';
          case 'setEncoderName':
            await electronAPI.setEncoderName(String(args ?? ''));
            return true;
          case 'getAiApiSettings':
            return electronAPI.getAiApiSettings() ?? null;
          case 'setAiApiSettings':
            await electronAPI.setAiApiSettings((args ?? {}) as Partial<AiApiSettings>);
            return true;
          case 'getRememberWorkspaceOnStartup':
            return (await electronAPI.getRememberWorkspaceOnStartup?.()) ?? true;
          case 'setRememberWorkspaceOnStartup':
            await electronAPI.setRememberWorkspaceOnStartup?.(Boolean(args));
            return true;
          case 'testAiConnection':
            return (
              (await electronAPI.testAiConnection?.((args ?? {}) as Partial<AiApiSettings>)) ?? {
                ok: false,
                error: 'Desktop AI API bridge is unavailable.',
              }
            );
          case 'setThemeAppearance': {
            const mode = args as PaletteMode;
            setThemeAppearance(mode);
            leafWriter?.setThemeAppearance?.(getLeafWriterPaletteMode(mode));
            return true;
          }
          case 'setLocale': {
            const locale = args as Locales;
            switchLanguage(locale);
            leafWriter?.switchLocale?.(locale);
            return true;
          }
          case 'setSkipExplorerDeleteConfirm': {
            setSkipExplorerDeleteConfirm(Boolean(args));
            return true;
          }
          case 'setSkipCopyPasteHelp': {
            setSkipCopyPasteHelp(Boolean(args));
            return true;
          }
          case 'getSchemaPickerState': {
            const dialogId = getStringArg(args, 'dialogId');
            const session = dialogId ? getSchemaPickerSession(dialogId) : undefined;
            if (!session) return null;

            const possibleSchemas = getWriterSchemasList().filter((schema) =>
              session.mappingIds.includes(schema.mapping),
            );

            const defaultSchema = session.mappingIds.includes('tei')
              ? possibleSchemas.find((schema) => schema.id === 'teiAll')
              : possibleSchemas[0];

            const payload: SchemaPickerStatePayload = {
              schemas: possibleSchemas.map(({ id, name }) => ({ id, name })),
              defaultSchemaId: defaultSchema?.id ?? null,
            };
            return payload;
          }
          case 'applySchemaPickerSelection': {
            const dialogId = getStringArg(args, 'dialogId');
            const schemaId = getStringArg(args, 'schemaId');
            if (!dialogId || !schemaId) return { ok: false };
            const session = getSchemaPickerSession(dialogId);
            if (!session || !schemaId) return { ok: false };

            const schema = getWriterSchemasList().find(({ id }) => id === schemaId);
            if (!schema) return { ok: false };

            clearSchemaPickerSession(dialogId);
            await session.onSchemaSelect(schema);
            session.onClose('select');
            return { ok: true };
          }
          case 'cancelSchemaPicker': {
            const dialogId = getStringArg(args, 'dialogId');
            if (!dialogId) return { ok: false };
            const session = getSchemaPickerSession(dialogId);
            if (!session) return { ok: false };

            clearSchemaPickerSession(dialogId);
            session.onClose('cancel');
            return { ok: true };
          }
          case 'getSchemaSetupState': {
            const tiered = getTieredCatalogForSetup();
            return {
              primary: tiered.primary,
              more: tiered.more,
              defaultCatalogId: tiered.primary[0]?.id ?? 'teiAll',
            };
          }
          case 'installCatalogSchema': {
            const dialogId = getStringArg(args, 'dialogId');
            const catalogId = getStringArg(args, 'catalogId');
            if (!dialogId || !catalogId) {
              return { ok: false, error: 'Invalid schema setup session.' };
            }
            const session = getSchemaSetupSession(dialogId);
            if (!session || !catalogId || !electronAPI.installCatalogSchema) {
              return { ok: false, error: 'Invalid schema setup session.' };
            }

            try {
              const bundle = await electronAPI.installCatalogSchema(session.projectFilePath, catalogId);
              registerDesktopSchemas(buildProjectSchemas(bundle.rootPath, bundle.config));
              clearSchemaSetupSession(dialogId);
              session.onComplete(bundle);
              return { ok: true };
            } catch (error) {
              return {
                ok: false,
                error: error instanceof Error ? error.message : 'Schema download failed.',
              };
            }
          }
          case 'installLocalSchema': {
            const dialogId = getStringArg(args, 'dialogId');
            if (!dialogId) return { ok: false, error: 'Invalid schema setup session.' };
            const session = getSchemaSetupSession(dialogId);
            if (!session || !electronAPI.pickSchemaFiles || !electronAPI.installLocalSchema) {
              return { ok: false, error: 'Invalid schema setup session.' };
            }
            const picked = await electronAPI.pickSchemaFiles();
            if (!picked) return { ok: false, error: 'cancelled' };

            try {
              const bundle = await electronAPI.installLocalSchema(
                session.projectFilePath,
                picked.rngPath,
                picked.cssPath,
              );
              registerDesktopSchemas(buildProjectSchemas(bundle.rootPath, bundle.config));
              clearSchemaSetupSession(dialogId);
              session.onComplete(bundle);
              return { ok: true };
            } catch (error) {
              return {
                ok: false,
                error: error instanceof Error ? error.message : 'Could not copy schema file.',
              };
            }
          }
          case 'getProjectMetadataState': {
            const dialogId = getStringArg(args, 'dialogId');
            const session = dialogId ? getProjectMetadataSession(dialogId) : undefined;
            if (!session) return null;
            if (session.initialState) return session.initialState;

            const bundle = await resolveProjectBundle(session.projectFilePath);
            if (!bundle) return null;
            return buildProjectMetadataDialogState(bundle, session.mode);
          }
          case 'saveProjectMetadata': {
            const {
              values,
              custom,
              applyToDocuments,
              translationAlignmentUnit,
              translationLanguages,
              translationCitationStyle,
            } = (args ?? {}) as {
              values?: Record<string, string>;
              custom?: Array<{ path: string; label: string; value: string }>;
              applyToDocuments?: boolean;
              translationAlignmentUnit?: 'div' | 'p';
              translationLanguages?: Array<{ code: string; label: string }>;
              translationCitationStyle?: string;
            };
            const dialogId = getStringArg(args, 'dialogId');
            if (!dialogId) {
              return { ok: false, error: 'Invalid metadata session.' };
            }
            const session = getProjectMetadataSession(dialogId);
            if (!session) {
              return { ok: false, error: 'Invalid metadata session.' };
            }

            const bundle = await resolveProjectBundle(session.projectFilePath);
            if (!bundle) return { ok: false, error: 'Project not found.' };

            const previous = await readProjectMetadata(bundle);
            const draft: ProjectMetadataFile = {
              version: 1,
              catalogId: bundle.config.schema?.catalogId,
              fields: values ?? {},
              custom: (custom ?? []).map((row) => ({
                path: row.path?.trim() ?? '',
                label: row.label?.trim() || row.path?.trim() || 'Custom field',
                value: row.value?.trim() ?? '',
              })),
            };

            try {
              await writeProjectMetadata(bundle, draft);
              invalidateMetadataDialogStateCache(bundle.projectFilePath);
              void warmMetadataDialogStateCache(bundle, session.mode);
            } catch (error) {
              return {
                ok: false,
                error: error instanceof Error ? error.message : 'Could not save metadata.',
              };
            }

            if (translationAlignmentUnit) {
              try {
                // Re-read current disk state rather than trusting a stale snapshot — a
                // prior save within the same dialog session may have already locked
                // alignmentUnit.
                const existingTranslationSettings = await readTranslationSettings(bundle);
                if (!existingTranslationSettings) {
                  await writeTranslationSettings(bundle, {
                    alignmentUnit: translationAlignmentUnit,
                    languages: translationLanguages ?? [],
                  });
                } else {
                  const existingCodes = new Set(
                    existingTranslationSettings.languages.map((lang) => lang.code),
                  );
                  for (const lang of translationLanguages ?? []) {
                    if (!existingCodes.has(lang.code)) {
                      // eslint-disable-next-line no-await-in-loop
                      await addTranslationLanguage(bundle, lang);
                    }
                  }
                }

                if (translationCitationStyle) {
                  const styleChanged =
                    (existingTranslationSettings?.citationStyle ?? undefined) !==
                    translationCitationStyle;
                  await setCitationStyle(bundle, translationCitationStyle);
                  if (styleChanged && existingTranslationSettings) {
                    // Open translation panes re-render their footnote citations.
                    window.dispatchEvent(
                      new CustomEvent('desktop:translation-citation-style-changed', {
                        detail: { citationStyle: translationCitationStyle },
                      }),
                    );
                  }
                }
              } catch (error) {
                return {
                  ok: false,
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Could not save translation settings.',
                };
              }
            }

            const sanitized = sanitizeMetadataForSave(draft);
            let summary: string | undefined;

            if (applyToDocuments) {
              const dirtyTabs = openTabs.filter((tab) => tab.dirty);
              if (dirtyTabs.length > 0) {
                const warn = await electronAPI.showNativeMessageBox({
                  type: 'warning',
                  title: 'Unsaved documents',
                  message: `${dirtyTabs.length} open document(s) have unsaved changes. Bulk update writes to disk and may overwrite in-memory edits.`,
                  buttons: ['Continue', 'Cancel'],
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
              void warmMetadataDialogStateCache(bundle, session.mode);

              for (const tab of openTabs) {
                await reloadTabFromDisk(tab.filePath);
              }

              summary = `Updated ${result.updated} file(s); ${result.skipped} unchanged.`;
              if (result.overridesSkipped > 0) {
                summary += ` ${result.overridesSkipped} field(s) left unchanged due to per-file edits.`;
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

            clearProjectMetadataSession(dialogId);
            session.onSave();
            if (!applyToDocuments && session.mode === 'edition') {
              notifyViaSnackbar({
                message: 'Edition metadata saved.',
                options: { variant: 'success' },
              });
            }

            return { ok: true, summary };
          }
          case 'cancelProjectMetadata': {
            const dialogId = getStringArg(args, 'dialogId');
            if (!dialogId) return { ok: false };
            const session = getProjectMetadataSession(dialogId);
            if (!session) return { ok: false };

            clearProjectMetadataSession(dialogId);
            session.onCancel();
            return { ok: true };
          }
          default:
            return null;
        }
      },
    };

    return () => {
      delete window.__ljbNativeBridge;
    };
  }, [
    config,
    currentLocale,
    leafWriter,
    notifyViaSnackbar,
    openTabs,
    projectFilePath,
    reloadTabFromDisk,
    rootPath,
    setSkipCopyPasteHelp,
    setSkipExplorerDeleteConfirm,
    setThemeAppearance,
    skipCopyPasteHelp,
    skipExplorerDeleteConfirm,
    switchLanguage,
    themeAppearance,
  ]);
};
