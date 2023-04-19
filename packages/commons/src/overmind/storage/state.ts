import type { StorageDialogState } from '@src/types';

type State = {
  storageDialogState: StorageDialogState;
};

export const state: State = {
  storageDialogState: { open: false },
};
