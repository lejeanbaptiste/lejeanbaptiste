import type { StorageDialogState } from '@src/types';

interface State {
  storageDialogState: StorageDialogState;
}

export const state: State = {
  storageDialogState: { open: false },
};
