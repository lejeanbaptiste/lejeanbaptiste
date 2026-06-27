import { leafwriterAtom } from '@src/jotai';
import { useActions, useAppState } from '@src/overmind';
import type { Locales } from '@src/i18n';
import type { PaletteMode } from '@src/types';
import { isDesktop } from '@src/types/desktop';
import { useAtom } from 'jotai';
import { useEffect } from 'react';

import { buildProjectSchemas, type ProjectBundle } from './projectFile';
import {
  applyMetadataToProjectFiles,
  createInitialMetadata,
  emptyMetadata,
  getManagedFieldValues,
  readProjectMetadata,
  sanitizeMetadataForSave,
  writeProjectMetadata,
} from './projectMetadata';
import {
  clearProjectMetadataSession,
  getProjectMetadataSession,
  subscribeProjectMetadataDialogClosed,
} from './projectMetadataSession';
import { registerDesktopSchemas } from './registerDesktopSchemas';
import { getTieredCatalogForSetup } from './schemaCatalog';
import { getMetadataFieldsForCatalog } from './schemaMetadataFields';
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

const getCatalogKind = (catalogId?: string, rngPath?: string): string | undefined => {
  if (catalogId) return catalogId;
  if (rngPath?.toLowerCase().includes('tei')) return 'local-tei';
  return 'custom';
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
    if (!isDesktop()) return;

    const getActiveProjectBundle = (): ProjectBundle | null => {
      if (!rootPath || !projectFilePath || !config) return null;
      return { rootPath, projectFilePath, config };
    };

    const resolveProjectBundle = async (
      sessionProjectFilePath: string,
    ): Promise<ProjectBundle | null> => {
      const active = getActiveProjectBundle();
      if (active?.projectFilePath === sessionProjectFilePath) return active;
      return window.electronAPI?.reloadProjectBundle?.(sessionProjectFilePath) ?? null;
    };

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
            return (await window.electronAPI?.getEncoderName?.()) ?? '';
          case 'setEncoderName':
            await window.electronAPI?.setEncoderName?.(String(args ?? ''));
            return true;
          case 'setThemeAppearance':
            setThemeAppearance(args as PaletteMode);
            leafWriter?.setThemeAppearance?.(args as PaletteMode);
            return true;
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
            const { dialogId } = (args ?? {}) as { dialogId?: string };
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
            const { dialogId, schemaId } = (args ?? {}) as {
              dialogId?: string;
              schemaId?: string;
            };
            const session = dialogId ? getSchemaPickerSession(dialogId) : undefined;
            if (!session || !schemaId) return { ok: false };

            const schema = getWriterSchemasList().find(({ id }) => id === schemaId);
            if (!schema) return { ok: false };

            clearSchemaPickerSession(dialogId);
            await session.onSchemaSelect(schema);
            session.onClose('select');
            return { ok: true };
          }
          case 'cancelSchemaPicker': {
            const { dialogId } = (args ?? {}) as { dialogId?: string };
            const session = dialogId ? getSchemaPickerSession(dialogId) : undefined;
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
            const { dialogId, catalogId } = (args ?? {}) as {
              dialogId?: string;
              catalogId?: string;
            };
            const session = dialogId ? getSchemaSetupSession(dialogId) : undefined;
            if (!session || !catalogId || !window.electronAPI?.installCatalogSchema) {
              return { ok: false, error: 'Invalid schema setup session.' };
            }

            try {
              const bundle = await window.electronAPI.installCatalogSchema(
                session.projectFilePath,
                catalogId,
              );
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
            const { dialogId } = (args ?? {}) as { dialogId?: string };
            const session = dialogId ? getSchemaSetupSession(dialogId) : undefined;
            if (!session || !window.electronAPI?.pickSchemaFiles) {
              return { ok: false, error: 'Invalid schema setup session.' };
            }

            // #region agent log
            fetch('http://127.0.0.1:7253/ingest/aae22f38-d876-4045-816e-e95acef3f779',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dfd93a'},body:JSON.stringify({sessionId:'dfd93a',location:'useNativeDialogBridge.ts:installLocalSchema',message:'before pickSchemaFiles',data:{dialogId},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
            // #endregion

            const picked = await window.electronAPI.pickSchemaFiles();
            if (!picked) return { ok: false, error: 'cancelled' };

            try {
              const bundle = await window.electronAPI.installLocalSchema!(
                session.projectFilePath,
                picked.rngPath,
                picked.cssPath,
              );
              registerDesktopSchemas(buildProjectSchemas(bundle.rootPath, bundle.config));
              clearSchemaSetupSession(dialogId);
              session.onComplete(bundle);
              // #region agent log
              fetch('http://127.0.0.1:7253/ingest/aae22f38-d876-4045-816e-e95acef3f779',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dfd93a'},body:JSON.stringify({sessionId:'dfd93a',location:'useNativeDialogBridge.ts:installLocalSchema',message:'install complete',data:{rng:bundle.config.schema?.rng},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
              // #endregion
              return { ok: true };
            } catch (error) {
              // #region agent log
              fetch('http://127.0.0.1:7253/ingest/aae22f38-d876-4045-816e-e95acef3f779',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dfd93a'},body:JSON.stringify({sessionId:'dfd93a',location:'useNativeDialogBridge.ts:installLocalSchema',message:'install error',data:{error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
              // #endregion
              return {
                ok: false,
                error: error instanceof Error ? error.message : 'Could not copy schema file.',
              };
            }
          }
          case 'getProjectMetadataState': {
            const { dialogId } = (args ?? {}) as { dialogId?: string };
            const session = dialogId ? getProjectMetadataSession(dialogId) : undefined;
            if (!session) return null;

            const metadataLoadStarted = Date.now();
            const activeBundle = getActiveProjectBundle();
            const usedInMemoryBundle =
              activeBundle?.projectFilePath === session.projectFilePath;
            const bundle = usedInMemoryBundle
              ? activeBundle
              : await window.electronAPI?.reloadProjectBundle?.(session.projectFilePath);
            if (!bundle) return null;
            // #region agent log
            fetch('http://127.0.0.1:7253/ingest/aae22f38-d876-4045-816e-e95acef3f779',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dfd93a'},body:JSON.stringify({sessionId:'dfd93a',location:'useNativeDialogBridge.ts:getProjectMetadataState',message:'metadata state loaded',data:{usedInMemoryBundle,elapsedMs:Date.now()-metadataLoadStarted},timestamp:Date.now(),hypothesisId:'S3'})}).catch(()=>{});
            // #endregion

            const catalogKind = getCatalogKind(
              bundle.config.schema?.catalogId,
              bundle.config.schema?.rng,
            );
            const fieldDef = getMetadataFieldsForCatalog(catalogKind);

            let metadata = await readProjectMetadata(bundle);
            if (!metadata && session.mode === 'firstSetup') {
              const encoderName = await window.electronAPI.getEncoderName?.();
              metadata = createInitialMetadata(bundle, encoderName);
            }
            if (!metadata) {
              metadata = emptyMetadata(bundle.config.schema?.catalogId);
            }

            return {
              mode: session.mode,
              note: fieldDef.note,
              fields: fieldDef.fields,
              values: getManagedFieldValues(metadata, fieldDef.fields),
              custom: metadata.custom.map((row) => ({
                path: row.path,
                label: row.label,
                value: row.value,
              })),
            };
          }
          case 'saveProjectMetadata': {
            const { dialogId, values, custom, applyToDocuments } = (args ?? {}) as {
              dialogId?: string;
              values?: Record<string, string>;
              custom?: Array<{ path: string; label: string; value: string }>;
              applyToDocuments?: boolean;
            };
            const session = dialogId ? getProjectMetadataSession(dialogId) : undefined;
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
            } catch (error) {
              return {
                ok: false,
                error: error instanceof Error ? error.message : 'Could not save metadata.',
              };
            }

            const sanitized = sanitizeMetadataForSave(draft);
            let summary: string | undefined;

            if (applyToDocuments) {
              const dirtyTabs = openTabs.filter((tab) => tab.dirty);
              if (dirtyTabs.length > 0) {
                const warn = await window.electronAPI.showNativeMessageBox({
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

              for (const tab of openTabs) {
                await reloadTabFromDisk(tab.filePath);
              }

              summary = `Updated ${result.updated} file(s); ${result.skipped} unchanged.`;
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
            const { dialogId } = (args ?? {}) as { dialogId?: string };
            const session = dialogId ? getProjectMetadataSession(dialogId) : undefined;
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
