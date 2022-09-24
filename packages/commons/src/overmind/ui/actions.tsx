import { Button } from '@mui/material';
import type { AlertDialog, INotification, MessageDialog, PaletteMode } from '@src/types';
import { supportedLanguages } from '@src/utilities';
import { VariantType } from 'notistack';
import React from 'react';
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
}

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

// Message

export const showAlertDialog = ({ state }: Context, alertDialog: Omit<AlertDialog, 'open'>) => {
  if (!alertDialog.type) alertDialog.type = 'error';
  state.ui.alertDialog = { open: true, ...alertDialog };
};

export const closeAlertDialog = ({ state }: Context) => {
  state.ui.alertDialog = { open: false };
};

export const showMessageDialog = (
  { state }: Context,
  messageDialog: Omit<MessageDialog, 'open'>
) => {
  state.ui.messageDialog = { open: true, ...messageDialog };
};

export const closeCloseMessageDialog = ({ state }: Context) => {
  state.ui.messageDialog = { open: false };
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
