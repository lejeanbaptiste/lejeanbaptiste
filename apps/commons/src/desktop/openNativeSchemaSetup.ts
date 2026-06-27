import { nanoid } from 'nanoid';

import type { ProjectBundle } from './projectTypes';
import {
  clearSchemaSetupSession,
  registerSchemaSetupSession,
  type SchemaSetupResult,
} from './schemaSetupSession';
import { isDesktop } from '@src/types/desktop';

export const openNativeSchemaSetup = (
  projectFilePath: string,
): Promise<{ result: SchemaSetupResult; bundle?: ProjectBundle }> => {
  if (!isDesktop() || !window.electronAPI?.openNativeDialog) {
    return Promise.resolve({ result: 'cancelled' });
  }

  return new Promise((resolve) => {
    const dialogId = nanoid();

    registerSchemaSetupSession(dialogId, {
      dialogId,
      projectFilePath,
      onComplete: (bundle) => {
        clearSchemaSetupSession(dialogId);
        resolve({ result: 'installed', bundle });
      },
      onCancel: () => {
        clearSchemaSetupSession(dialogId);
        resolve({ result: 'cancelled' });
      },
    });

    void window.electronAPI!.openNativeDialog({
      id: dialogId,
      type: 'schemaSetup',
      title: 'Project schema setup',
    });
  });
};
