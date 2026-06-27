import { leafwriterAtom } from '@src/jotai';
import { useActions, useAppState } from '@src/overmind';
import type { Locales } from '@src/i18n';
import type { PaletteMode } from '@src/types';
import { isDesktop } from '@src/types/desktop';
import { useAtom } from 'jotai';
import { useEffect } from 'react';

import {
  clearSchemaPickerSession,
  getSchemaPickerSession,
  subscribeNativeDialogClosed,
} from './schemaPickerSession';

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

export const useNativeDialogBridge = () => {
  const { currentLocale, skipCopyPasteHelp, skipExplorerDeleteConfirm, themeAppearance } =
    useAppState().ui;
  const { setSkipCopyPasteHelp, setSkipExplorerDeleteConfirm, setThemeAppearance, switchLanguage } =
    useActions().ui;
  const [leafWriter] = useAtom(leafwriterAtom);

  useEffect(() => {
    if (!isDesktop()) return;

    return subscribeNativeDialogClosed();
  }, []);

  useEffect(() => {
    if (!isDesktop()) return;

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
          default:
            return null;
        }
      },
    };

    return () => {
      delete window.__ljbNativeBridge;
    };
  }, [
    currentLocale,
    leafWriter,
    setSkipCopyPasteHelp,
    setSkipExplorerDeleteConfirm,
    setThemeAppearance,
    skipCopyPasteHelp,
    skipExplorerDeleteConfirm,
    switchLanguage,
    themeAppearance,
  ]);
};
