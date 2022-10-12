import type { StorageProviderName } from '@src/services';
import type { Resource, StorageDialogState } from '@src/types';

type State = {
  recentDocuments: Resource[];
  resource?: Resource;
  sampleDocuments?: { title: string; url: string }[];
  storageDialogState: StorageDialogState;
  storageProviders: StorageProviderName[];
};

export const state: State = {
  recentDocuments: [],
  sampleDocuments: [],
  storageDialogState: { open: false },
  storageProviders: [],
};
