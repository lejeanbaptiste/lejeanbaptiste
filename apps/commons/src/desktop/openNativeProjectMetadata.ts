import { nanoid } from 'nanoid';

import { resolveProjectBundleByPath } from './activeProjectBundle';
import {
  buildProjectMetadataDialogState,
  getCachedMetadataDialogState,
  setCachedMetadataDialogState,
} from './projectMetadataDialogState';
import {
  clearProjectMetadataSession,
  getProjectMetadataSession,
  registerProjectMetadataSession,
  type ProjectMetadataDialogMode,
} from './projectMetadataSession';
import { isDesktop } from '@src/types/desktop';

const fillMetadataDialogState = async (
  dialogId: string,
  projectFilePath: string,
  mode: ProjectMetadataDialogMode,
) => {
  const bundle = await resolveProjectBundleByPath(projectFilePath);
  if (!bundle) return;

  const state = await buildProjectMetadataDialogState(bundle, mode);
  setCachedMetadataDialogState(projectFilePath, mode, state);

  const session = getProjectMetadataSession(dialogId);
  if (session) session.initialState = state;

  await window.electronAPI?.updateNativeDialogState?.({ dialogId, initialState: state });
};

export const openNativeProjectMetadata = (
  projectFilePath: string,
  mode: ProjectMetadataDialogMode,
): Promise<'saved' | 'cancelled'> => {
  if (!isDesktop() || !window.electronAPI?.openNativeDialog) {
    return Promise.resolve('cancelled');
  }

  const initialState = getCachedMetadataDialogState(projectFilePath, mode);

  return new Promise((resolve) => {
    const dialogId = nanoid();

    registerProjectMetadataSession(dialogId, {
      dialogId,
      mode,
      projectFilePath,
      initialState,
      onSave: () => {
        clearProjectMetadataSession(dialogId);
        resolve('saved');
      },
      onCancel: () => {
        clearProjectMetadataSession(dialogId);
        resolve('cancelled');
      },
    });

    void window.electronAPI!.openNativeDialog({
      id: dialogId,
      type: 'projectMetadata',
      title: mode === 'firstSetup' ? 'Project metadata' : 'Edition metadata',
      initialState,
    });

    if (!initialState) {
      void fillMetadataDialogState(dialogId, projectFilePath, mode);
    }
  });
};
