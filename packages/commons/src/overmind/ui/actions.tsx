import { Button } from '@mui/material';
import type { INotification, PaletteMode } from '@src/types';
import { supportedLanguages } from '@src/utilities';
import { VariantType } from 'notistack';
import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { IDialogBar } from '../../dialogs';
import { Context } from '../index';

//* INIITIALIZE
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const onInitializeOvermind = async ({ state, actions }: Context, overmind: any) => {
  //DARK MODE
  const prefPaletteMode: PaletteMode =
    (localStorage.getItem('themeAppearance') as PaletteMode) ?? 'auto';
  actions.ui.setThemeAppearance(prefPaletteMode);

  //LANGUAGE
  const prefLanguageCode = localStorage.getItem('i18nextLng');
  if (prefLanguageCode) {
    const prefLanguage = supportedLanguages.get(prefLanguageCode);
    state.ui.language = prefLanguage
      ? prefLanguage
      : { code: 'en-CA', name: 'english', shortName: 'en' };
  }
};

export const getGAID = async ({ effects }: Context) => {
  const response = await effects.ui.api.getGAID();
  return response;
};

export const setThemeAppearance = ({ state, actions }: Context, value: PaletteMode) => {
  state.ui.themeAppearance = value;

  const darkMode =
    value === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : value === 'light'
      ? false
      : true;

  actions.ui.setDarkMode(darkMode);

  localStorage.setItem('themeAppearance', value);
};

export const setDarkMode = ({ state }: Context, value: boolean) => {
  state.ui.darkMode = value;
  return state.ui.darkMode;
};

export const emitNotification = async (
  { actions }: Context,
  {
    message,
    persist = true,
    variant = 'error',
  }: { message: string; persist?: boolean; variant?: VariantType }
) => {
  actions.ui.notifyViaSnackbar({
    message,
    options: {
      action: (key) => (
        <Button color="inherit" onClick={() => actions.ui.closeNotificationSnackbar(key)}>
          Dismiss
        </Button>
      ),
      persist,
      variant,
    },
  });
};

export const switchLanguage = ({ state }: Context, value: string) => {
  const language = supportedLanguages.get(value) ?? {
    code: 'en-CA',
    name: 'english',
    shortName: 'en',
  };
  state.ui.language = language;
  return value;
};

export const notifyViaSnackbar = ({ state }: Context, notification: INotification | string) => {
  if (typeof notification === 'string') notification = { message: notification };

  let key = notification.options && notification.options.key;
  if (!key) key = new Date().getTime() + Math.random();

  state.ui.notifications = [...state.ui.notifications, { ...notification, key }];
};

export const closeNotificationSnackbar = ({ state }: Context, key?: string | number) => {
  const dismissAll = !key;
  state.ui.notifications = state.ui.notifications.map((notification) =>
    dismissAll || notification.key === key
      ? { ...notification, dismissed: true }
      : { ...notification }
  );
};

export const removeNotificationSnackbar = ({ state }: Context, key: string | number) => {
  state.ui.notifications = state.ui.notifications.filter(
    (notification) => notification.key !== key
  );
};

export const openDialog = ({ state }: Context, dialogBar: IDialogBar) => {
  if (!dialogBar.props?.id) dialogBar.props = { ...dialogBar.props, id: uuidv4() };
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
  { id, displayId }: { id: string; displayId: string }
) => {
  state.ui.dialogBar = [
    ...state.ui.dialogBar.map((dialogBar) => {
      if (dialogBar.props?.id === id) dialogBar.displayId = displayId;
      return dialogBar;
    }),
  ];
};
