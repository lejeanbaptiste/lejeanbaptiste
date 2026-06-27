import type { ProjectBundle } from './projectTypes';

export type SchemaSetupResult = 'installed' | 'cancelled';

export interface SchemaSetupSession {
  dialogId: string;
  projectFilePath: string;
  onComplete: (bundle: ProjectBundle) => void;
  onCancel: () => void;
}

const sessions = new Map<string, SchemaSetupSession>();

export const registerSchemaSetupSession = (dialogId: string, session: SchemaSetupSession) => {
  sessions.set(dialogId, session);
};

export const getSchemaSetupSession = (dialogId: string) => sessions.get(dialogId);

export const clearSchemaSetupSession = (dialogId: string) => {
  sessions.delete(dialogId);
};

export const isSchemaSetupDialogId = (dialogId: string) => sessions.has(dialogId);

export const subscribeSchemaSetupDialogClosed = (): (() => void) => {
  if (!window.electronAPI?.onNativeDialogClosed) return () => {};

  return window.electronAPI.onNativeDialogClosed((dialogId) => {
    const session = sessions.get(dialogId);
    if (!session) return;
    session.onCancel();
    sessions.delete(dialogId);
  });
};
