import { nanoid } from 'nanoid';

import {
  clearProjectMetadataSession,
  registerProjectMetadataSession,
  type ProjectMetadataDialogMode,
} from './projectMetadataSession';
import { isDesktop } from '@src/types/desktop';

export const openNativeProjectMetadata = (
  projectFilePath: string,
  mode: ProjectMetadataDialogMode,
): Promise<'saved' | 'cancelled'> => {
  if (!isDesktop() || !window.electronAPI?.openNativeDialog) {
    return Promise.resolve('cancelled');
  }

  return new Promise((resolve) => {
    const dialogId = nanoid();

    registerProjectMetadataSession(dialogId, {
      dialogId,
      mode,
      projectFilePath,
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
    });
  });
};
