import { Button } from '@mui/material';
import type { DialogBarProps } from '@src/dialogs';
import type { NotificationProps, PaletteMode } from '@src/types';
import { supportedLanguages } from '@src/utilities';
import i18next from 'i18next';
import type { VariantType } from 'notistack';
import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Context } from '../index';

//* INITIALIZE
/**
 * Run during initialization
 * It sets the theme appearance and language based on the user's preferences
 */
export const onInitializeOvermind = async (
  { state, actions, effects }: Context,
  _overmind: any
) => {
  //DARK MODE
  const prefPaletteMode =
    effects.storage.api.getFromLocalStorage<PaletteMode>('themeAppearance') ?? 'auto';

  actions.ui.setThemeAppearance(prefPaletteMode);

  //LANGUAGE
  const prefLanguageCode = effects.storage.api.getFromLocalStorage('i18nextLng');
  if (prefLanguageCode) {
    const prefLanguage = supportedLanguages.get(prefLanguageCode);
    state.ui.language = prefLanguage
      ? prefLanguage
      : { code: 'en-CA', name: 'english', shortName: 'en' };
  }
};

/**
 * Set the current page view
 */
export const setPage = async ({ state }: Context, value: string) => {
  state.ui.page = value;
};

/**
 * Gets Google Analitics ID from the our local sercer API
 */
export const getGAID = async ({ effects }: Context) => {
  const response = await effects.ui.api.getGAID();
  return response;
};

export const setCookieConsent = ({ state }: Context, values?: string[]) => {
  state.ui.cookieConsent = values ?? [];
};

export const setThemeAppearance = ({ state, actions, effects }: Context, value: PaletteMode) => {
  state.ui.themeAppearance = value;

  const darkMode =
    value === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : value === 'light'
      ? false
      : true;

  actions.ui.setDarkMode(darkMode);

  effects.storage.api.saveToLocalStorage('themeAppearance', value);
};

export const setDarkMode = ({ state }: Context, value: boolean) => {
  state.ui.darkMode = value;

  //Cookies consent form
  if (value && !document.body.classList.contains('c_darkmode')) {
    document.body.classList.add('c_darkmode');
  }

  if (!value && document.body.classList.contains('c_darkmode')) {
    document.body.classList.remove('c_darkmode');
  }

  return state.ui.darkMode;
};

/**
 * Switch language to the value provided. If value is not valid, it fallsback to `en-CA`.
 * @param {string} value - The value of the language code that was selected.
 * @returns The value of the language code.
 */
export const switchLanguage = ({ state }: Context, value: string) => {
  const language = supportedLanguages.get(value) ?? {
    code: 'en-CA',
    name: 'english',
    shortName: 'en',
  };
  state.ui.language = language;
  return value;
};

// * Notification

export const notifyViaSnackbar = ({ state }: Context, notification: NotificationProps | string) => {
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

/**
 * Convenient method to trigger snackbar notifications
 * It takes a message and a variant (error, warning, info, success) and emits a notification via the snackbar
 * @param  - `message` - The message to display in the snackbar.
 * @param  - Optional - `persists` - If notiicattion should persists until the users dismiss it. (Default: true)
 * @param  - Optional - `variant` - Type of of notification: error, warning, info, success. (Default: 'error')
 */
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
          {`${i18next.t('commons:dismiss')}`}
        </Button>
      ),
      persist,
      variant,
    },
  });
};

// * Dialog

export const openDialog = ({ state }: Context, dialogBar: DialogBarProps) => {
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
