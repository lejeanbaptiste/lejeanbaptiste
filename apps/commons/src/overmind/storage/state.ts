import type { StorageDialogState } from '@src/types';

export interface State {
  storageDialogState: StorageDialogState;
}

export const state: State = {
  storageDialogState: { open: false },
};
