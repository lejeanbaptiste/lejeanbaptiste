import { IDocTemplate, Resource, StorageDialogState } from '@src/types';
import type { StorageProviderName } from '@src/services';

type State = {
  recentDocuments: Resource[];
  resource?: Resource;
  sampleDocuments?: { title: string; url: string }[];
  storageDialogState: StorageDialogState;
  storageProviders: StorageProviderName[];
  templates: IDocTemplate[];
};

export const state: State = {
  recentDocuments: [],
  sampleDocuments: [],
  storageDialogState: { open: false },
  storageProviders: [],
  templates: [],
};
