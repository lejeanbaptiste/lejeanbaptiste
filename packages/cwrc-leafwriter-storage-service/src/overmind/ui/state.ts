import type { DialogBarProps } from '@cwrc/leafwriter-storage-service/dialogs';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type State = {
  dialogBar: DialogBarProps[];
};

export const state: State = {
  dialogBar: [],
};
