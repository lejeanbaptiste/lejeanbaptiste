import type {
  ProjectMetadataDialogMode,
  ProjectMetadataDialogState,
} from './projectMetadataDialogTypes';

// Defined in the pure `projectMetadataDialogTypes` leaf; re-exported here so
// existing importers keep working.
export type { ProjectMetadataDialogMode } from './projectMetadataDialogTypes';

export interface ProjectMetadataSession {
  dialogId: string;
  mode: ProjectMetadataDialogMode;
  projectFilePath: string;
  initialState?: ProjectMetadataDialogState;
  onSave: () => void;
  onCancel: () => void;
}

const sessions = new Map<string, ProjectMetadataSession>();

export const registerProjectMetadataSession = (
  dialogId: string,
  session: ProjectMetadataSession,
) => {
  sessions.set(dialogId, session);
};

export const getProjectMetadataSession = (dialogId: string) => sessions.get(dialogId);

export const clearProjectMetadataSession = (dialogId: string) => {
  sessions.delete(dialogId);
};

export const isProjectMetadataDialogId = (dialogId: string) => sessions.has(dialogId);

export const subscribeProjectMetadataDialogClosed = (): (() => void) => {
  if (!window.electronAPI?.onNativeDialogClosed) return () => {};

  return window.electronAPI.onNativeDialogClosed((dialogId) => {
    const session = sessions.get(dialogId);
    if (!session) return;
    session.onCancel();
    sessions.delete(dialogId);
  });
};
