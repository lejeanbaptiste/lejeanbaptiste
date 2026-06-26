import type { SchemaPickerOpenerOptions } from '@src/types/desktop';

export interface SchemaPickerSession extends SchemaPickerOpenerOptions {
  dialogId: string;
}

const sessions = new Map<string, SchemaPickerSession>();

export const registerSchemaPickerSession = (
  dialogId: string,
  options: SchemaPickerOpenerOptions,
): void => {
  sessions.set(dialogId, { dialogId, ...options });
};

export const getSchemaPickerSession = (dialogId: string): SchemaPickerSession | undefined =>
  sessions.get(dialogId);

export const clearSchemaPickerSession = (dialogId: string): void => {
  sessions.delete(dialogId);
};

export const cancelSchemaPickerSession = (dialogId: string): void => {
  const session = sessions.get(dialogId);
  if (!session) return;
  session.onClose('cancel');
  sessions.delete(dialogId);
};

export const isSchemaPickerDialogId = (dialogId: string): boolean => sessions.has(dialogId);

export const subscribeNativeDialogClosed = (): (() => void) => {
  if (!window.electronAPI?.onNativeDialogClosed) return () => {};

  return window.electronAPI.onNativeDialogClosed((dialogId) => {
    if (isSchemaPickerDialogId(dialogId)) {
      cancelSchemaPickerSession(dialogId);
    }
  });
};
