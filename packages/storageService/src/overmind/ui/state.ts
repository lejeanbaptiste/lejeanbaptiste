import type { DialogBarProps } from '../../dialogs';

type State = {
  darkMode: boolean;
  dialogBar: DialogBarProps[];
};

export const state: State = {
  darkMode: false,
  dialogBar: [],
};
