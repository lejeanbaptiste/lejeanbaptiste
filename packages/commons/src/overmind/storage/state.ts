import type { StorageProviderName } from '@src/services';
import type { Resource, StorageDialogState } from '@src/types';

type State = {
  recentDocuments?: Resource[];
  resource?: Resource;
  storageDialogState: StorageDialogState;
  storageProviders: StorageProviderName[];
};

export const state: State = {
  storageDialogState: { open: false },
  storageProviders: [],
};
