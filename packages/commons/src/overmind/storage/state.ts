import type { Resource, StorageDialogState } from '@src/types';

type State = {
  recentDocuments?: Resource[];
  storageDialogState: StorageDialogState;
};

export const state: State = {
  storageDialogState: { open: false },
};
