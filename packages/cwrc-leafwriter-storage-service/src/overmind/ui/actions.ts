import type { DialogBarProps } from '@src/dialogs';
import { nanoid } from 'nanoid';
import { Context } from '../';

export const openDialog = ({ state }: Context, dialogBar: DialogBarProps) => {
  const isDisplayed = state.ui.dialogBar.some(({ props }) => props?.id === dialogBar.props?.id);
  if (isDisplayed) return;

  if (!dialogBar.props?.id) dialogBar.props = { ...dialogBar.props, id: nanoid() };
  if (!dialogBar.type) dialogBar.type = 'simple';
  state.ui.dialogBar = [...state.ui.dialogBar, dialogBar];
};

export const closeDialog = ({ state }: Context, id: string) => {
  state.ui.dialogBar = [
    ...state.ui.dialogBar.map((dialogBar) => {
      if (dialogBar.props?.id === id) dialogBar.dismissed = true;
      return dialogBar;
    }),
  ];
};

export const removeDialog = ({ state }: Context, id: string) => {
  state.ui.dialogBar = state.ui.dialogBar.filter((dialogBar) => dialogBar.props?.id !== id);
};

export const setDialogDisplayId = (
  { state }: Context,
  { id, displayId }: { id: string; displayId: string },
) => {
  state.ui.dialogBar = [
    ...state.ui.dialogBar.map((dialogBar) => {
      if (dialogBar.props?.id === id) dialogBar.displayId = displayId;
      return dialogBar;
    }),
  ];
};
